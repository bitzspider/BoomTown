import {
    Engine,
    Scene,
    Vector3,
    MeshBuilder,
    StandardMaterial,
    Color3,
    FreeCamera,
    HemisphericLight,
    CannonJSPlugin,
    PhysicsImpostor,
    KeyboardEventTypes,
    KeyboardInfo,
    Mesh,
    Ray,
    Quaternion,
    SceneLoader,
    AbstractMesh,
    AnimationGroup,
    TransformNode
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import * as CANNON from 'cannon';
import { EnemyManager } from "./managers/EnemyManager";
import { Enemy } from "./entities/Enemy";

interface ExtendedHTMLCanvasElement extends HTMLCanvasElement {
    requestPointerLock(): void;
}

interface ExtendedDocument extends Document {
    pointerLockElement: Element | null;
}

class Game {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private camera: FreeCamera;
    private isLocked: boolean = false;
    private playerBox: Mesh;
    private jumpForce: number = 5;
    private isJumping: boolean = false;
    private cameraHeight: number = 2;
    private moveDirection: Vector3 = Vector3.Zero();
    private moveSpeed: number = 2.0;
    private inputMap: { [key: string]: boolean } = {};
    private character: AbstractMesh | null = null;
    private animations: { [key: string]: AnimationGroup } = {};
    private currentAnimation: AnimationGroup | null = null;
    private enemyManager!: EnemyManager;

    constructor() {
        const canvas = document.getElementById("renderCanvas");
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            throw new Error("Canvas element not found or is not a canvas!");
        }
        this.canvas = canvas;
        
        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true);

        // Create the scene
        this.scene = new Scene(this.engine);

        // Initialize physics
        const gravityVector = new Vector3(0, -9.81, 0);
        const physicsPlugin = new CannonJSPlugin(true, 10, CANNON);
        this.scene.enablePhysics(gravityVector, physicsPlugin);

        // Initialize camera and player box
        this.camera = new FreeCamera("camera", new Vector3(0, this.cameraHeight, -10), this.scene);
        this.playerBox = MeshBuilder.CreateBox("playerBox", {
            height: 3,
            width: 1,
            depth: 1
        }, this.scene);

        this.createScene();

        // Initialize enemy manager after scene creation and model preloading
        this.initializeEnemyManager();

        // Register a render loop to repeatedly render the scene
        this.engine.runRenderLoop(() => {
            this.scene.render();
            this.updateMovement();
            this.updateCamera();
        });

        // Watch for browser/canvas resize events
        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private async initializeEnemyManager(): Promise<void> {
        console.log("Starting enemy model preload...");
        try {
            const enemy = new Enemy(this.scene, this.playerBox.position);
            await enemy.preloadModel();
            // Store the enemy instance or do whatever you need with it
        } catch (error) {
            console.error("Failed to initialize enemy manager:", error);
            throw error;
        }
    }

    private createScene(): void {
        // Set up camera
        this.camera.setTarget(Vector3.Zero());
        this.camera.attachControl(this.canvas, true);

        // Set up camera movement constraints
        this.camera.minZ = 0.1;
        this.camera.speed = 0.5;
        this.camera.angularSensibility = 1000;

        // Set up player box
        this.playerBox.isVisible = false;
        this.playerBox.position = this.camera.position.clone();

        // Add physics to player box with adjusted parameters
        this.playerBox.physicsImpostor = new PhysicsImpostor(
            this.playerBox,
            PhysicsImpostor.BoxImpostor,
            { 
                mass: 1, 
                restitution: 0,
                friction: 0.05
            },
            this.scene
        );

        // Apply damping after creating the impostor
        if (this.playerBox.physicsImpostor) {
            const body = this.playerBox.physicsImpostor.physicsBody;
            if (body) {
                body.linearDamping = 0.1;
                body.angularDamping = 1;
            }
        }

        // Create light
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;

        // Create ground
        const ground = MeshBuilder.CreateGround("ground", {
            width: 100,
            height: 100,
            subdivisions: 20
        }, this.scene);

        // Create ground material with grid texture
        const groundMaterial = new StandardMaterial("groundMaterial", this.scene);
        groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
        groundMaterial.wireframe = true;
        ground.material = groundMaterial;

        // Add physics to ground with adjusted friction
        ground.physicsImpostor = new PhysicsImpostor(
            ground,
            PhysicsImpostor.BoxImpostor,
            { 
                mass: 0, 
                restitution: 0.1,
                friction: 0.1
            },
            this.scene
        );

        // Create ceiling
        const ceiling = MeshBuilder.CreateBox("ceiling", {
            width: 100,
            height: 2,
            depth: 100
        }, this.scene);
        ceiling.position = new Vector3(0, 20, 0);

        // Add physics to ceiling
        ceiling.physicsImpostor = new PhysicsImpostor(
            ceiling,
            PhysicsImpostor.BoxImpostor,
            { 
                mass: 0, 
                restitution: 0.1,
                friction: 0.1
            },
            this.scene
        );

        // Set up pointer lock
        this.setupPointerLock();

        // Set up keyboard input handling
        this.setupInputHandling();

        // Handle jumping
        this.scene.onKeyboardObservable.add((kbInfo: KeyboardInfo) => {
            if (kbInfo.type === KeyboardEventTypes.KEYDOWN && 
                kbInfo.event.code === 'Space' && 
                !this.isJumping) {
                this.jump();
            }
        });

        // Check for ground contact
        this.scene.registerBeforeRender(() => {
            const origin = this.playerBox.position.clone();
            const ray = new Ray(origin, new Vector3(0, -1, 0), 1.6);
            const hit = this.scene.pickWithRay(ray);
            
            if (hit && hit.hit) {
                this.isJumping = false;
            }
        });
    }

    private setupInputHandling(): void {
        // Handle keydown
        window.addEventListener("keydown", (event) => {
            this.inputMap[event.code] = true;
        });

        // Handle keyup
        window.addEventListener("keyup", (event) => {
            this.inputMap[event.code] = false;
        });
    }

    private updateMovement(): void {
        // Calculate movement direction based on camera rotation
        this.moveDirection.setAll(0);
        
        const cameraRotation = this.camera.rotation;
        const forward = new Vector3(
            Math.sin(cameraRotation.y),
            0,
            Math.cos(cameraRotation.y)
        );
        const right = new Vector3(
            Math.sin(cameraRotation.y + Math.PI/2),
            0,
            Math.cos(cameraRotation.y + Math.PI/2)
        );

        // Update movement based on input
        if (this.inputMap["KeyW"]) {
            this.moveDirection.addInPlace(forward);
        }
        if (this.inputMap["KeyS"]) {
            this.moveDirection.addInPlace(forward.scale(-1));
        }
        if (this.inputMap["KeyA"]) {
            this.moveDirection.addInPlace(right.scale(-1));
        }
        if (this.inputMap["KeyD"]) {
            this.moveDirection.addInPlace(right);
        }

        // Normalize movement direction and apply force
        if (this.moveDirection.length() > 0) {
            this.moveDirection.normalize();
            this.moveDirection.scaleInPlace(this.moveSpeed);
            
            // Only apply horizontal forces
            const currentVelocity = this.playerBox.physicsImpostor?.getLinearVelocity() || new Vector3();
            const horizontalVelocity = new Vector3(
                this.moveDirection.x * 5,
                currentVelocity.y,
                this.moveDirection.z * 5
            );
            
            // Calculate next position
            const nextPosition = this.playerBox.position.clone();
            nextPosition.x += horizontalVelocity.x * this.engine.getDeltaTime() / 1000;
            nextPosition.z += horizontalVelocity.z * this.engine.getDeltaTime() / 1000;

            // Check boundaries (48 instead of 50 to give a small margin)
            const boundaryLimit = 48;
            const isWithinBounds = 
                Math.abs(nextPosition.x) < boundaryLimit && 
                Math.abs(nextPosition.z) < boundaryLimit;

            if (isWithinBounds) {
                this.playerBox.physicsImpostor?.setLinearVelocity(horizontalVelocity);
            } else {
                // If out of bounds, only keep vertical velocity
                this.playerBox.physicsImpostor?.setLinearVelocity(new Vector3(0, currentVelocity.y, 0));
            }
        } else {
            // When no keys are pressed, maintain vertical velocity but stop horizontal movement
            const currentVelocity = this.playerBox.physicsImpostor?.getLinearVelocity() || new Vector3();
            this.playerBox.physicsImpostor?.setLinearVelocity(new Vector3(0, currentVelocity.y, 0));
        }

        // After updating movement, update character rotation to face movement direction
        if (this.moveDirection.length() > 0 && this.character && this.playerBox) {
            const targetRotation = Math.atan2(this.moveDirection.x, this.moveDirection.z);
            this.playerBox.rotation.y = targetRotation;
        }
    }

    private createWall(position: Vector3, rotation: Vector3): void {
        const wall = MeshBuilder.CreateBox("wall", {
            width: 100,
            height: 20,
            depth: 2  // Give the wall actual thickness
        }, this.scene);
        wall.position = position;
        wall.rotation = rotation;

        const wallMaterial = new StandardMaterial("wallMaterial", this.scene);
        wallMaterial.diffuseColor = new Color3(0.4, 0.4, 0.4);
        wallMaterial.alpha = 0.5;
        wall.material = wallMaterial;

        wall.physicsImpostor = new PhysicsImpostor(
            wall,
            PhysicsImpostor.BoxImpostor,
            { 
                mass: 0, 
                restitution: 0.1,
                friction: 0.3
            },
            this.scene
        );
    }

    private jump(): void {
        if (!this.isJumping) {
            this.isJumping = true;
            this.playerBox.physicsImpostor?.applyImpulse(
                new Vector3(0, this.jumpForce, 0),
                this.playerBox.getAbsolutePosition()
            );
        }
    }

    private updateCamera(): void {
        // Update camera position to follow player box, maintaining the camera height
        const playerPos = this.playerBox.position;
        this.camera.position.x = playerPos.x;
        this.camera.position.z = playerPos.z;
        
        // Smoothly interpolate camera height
        this.camera.position.y = playerPos.y + this.cameraHeight - 1.5; // Offset for player height
    }

    private setupPointerLock(): void {
        // On click event, request pointer lock
        this.scene.onPointerDown = () => {
            if (!this.isLocked) {
                this.canvas.requestPointerLock();
            }
        };

        // Event listener for pointer lock state
        const pointerlockchange = () => {
            const pointerLockElement = document.pointerLockElement;
            this.isLocked = pointerLockElement instanceof HTMLCanvasElement && pointerLockElement === this.canvas;
        };

        // Attach event to the document
        document.addEventListener("pointerlockchange", pointerlockchange, false);
    }
}

// Create the game
new Game(); 