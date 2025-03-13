import {
    Scene,
    Vector3,
    AbstractMesh,
    AnimationGroup,
    SceneLoader,
    Mesh,
    AssetsManager,
    MeshAssetTask
} from "@babylonjs/core";

export class Enemy {
    private mesh: AbstractMesh | null = null;
    private animations: { [key: string]: AnimationGroup } = {};
    private currentAnimation: AnimationGroup | null = null;
    private scene: Scene;
    private currentState: 'idle' | 'walking' | 'running' | 'death' = 'idle';
    private health: number = 100;
    private isAlive: boolean = true;
    private static loadedModel: {
        meshes: AbstractMesh[];
        animationGroups: AnimationGroup[];
    } | null = null;

    constructor(scene: Scene, position: Vector3) {
        this.scene = scene;
        this.spawn(position);
    }

    // Static method to preload the model
    public static async preloadModel(scene: Scene): Promise<void> {
        try {
            console.log("Starting model preload...");
            
            // Configure scene loader
            SceneLoader.ShowLoadingScreen = false;
            
            // Load the model
            const result = await SceneLoader.ImportMeshAsync(
                undefined,  // meshNames (undefined means all)
                "./assets/models/",  // rootUrl
                "Character Soldier.glb",  // sceneFilename
                scene  // scene
            );

            console.log("Model loaded successfully:", result);
            this.loadedModel = {
                meshes: result.meshes,
                animationGroups: result.animationGroups
            };
        } catch (error) {
            console.error("Error during model preload:", error);
            throw error;
        }
    }

    private async spawn(position: Vector3): Promise<void> {
        try {
            console.log("Attempting to spawn enemy at position:", position);

            // If model isn't preloaded yet, preload it
            if (!Enemy.loadedModel) {
                await Enemy.preloadModel(this.scene);
            }

            if (!Enemy.loadedModel?.meshes) {
                throw new Error("Model not loaded properly");
            }

            // Clone the preloaded meshes
            const meshes = Enemy.loadedModel.meshes.map(mesh => mesh.clone("enemy_" + Math.random()));
            this.mesh = meshes[0];

            if (this.mesh) {
                console.log("Enemy mesh cloned successfully");
                
                // Set up the enemy
                this.mesh.scaling = new Vector3(1, 1, 1);
                this.mesh.position = position;
                this.mesh.rotation = new Vector3(0, Math.PI, 0);

                // Clone animations
                if (Enemy.loadedModel.animationGroups) {
                    console.log("Available animations:", Enemy.loadedModel.animationGroups.map(anim => anim.name));
                    
                    Enemy.loadedModel.animationGroups.forEach(animGroup => {
                        const clonedGroup = animGroup.clone(
                            animGroup.name,
                            (oldTarget) => {
                                const index = Enemy.loadedModel!.meshes.indexOf(oldTarget as AbstractMesh);
                                return index !== -1 ? meshes[index] : oldTarget;
                            }
                        );
                        this.animations[animGroup.name] = clonedGroup;
                        clonedGroup.stop();
                    });

                    // Start idle animation
                    this.playAnimation("Idle", true);
                }

                // Add physics
                this.setupPhysics();

                // Start behavior loop
                this.startBehavior();
                
                console.log("Enemy setup complete");
            } else {
                console.error("No meshes found in the model");
            }
        } catch (error) {
            console.error("Error spawning enemy:", error);
            if (error instanceof Error) {
                console.error("Error details:", {
                    message: error.message,
                    stack: error.stack
                });
            }
        }
    }

    private setupPhysics(): void {
        if (!this.mesh) return;

        // Create a collision box
        const collider = Mesh.CreateBox("enemyCollider", 1, this.scene);
        collider.parent = this.mesh;
        collider.isVisible = false;
        collider.position.y = 1; // Adjust based on model height
    }

    private playAnimation(animationName: string, loop: boolean = true): void {
        if (this.currentAnimation) {
            this.currentAnimation.stop();
        }

        const newAnimation = this.animations[animationName];
        if (newAnimation) {
            newAnimation.start(loop);
            this.currentAnimation = newAnimation;
        }
    }

    private startBehavior(): void {
        // Update enemy behavior every 100ms
        setInterval(() => {
            if (!this.isAlive) return;

            // Random behavior pattern
            const rand = Math.random();
            if (rand < 0.3 && this.currentState !== 'walking') {
                this.currentState = 'walking';
                this.playAnimation('Walk');
                this.moveRandomly();
            } else if (rand < 0.4 && this.currentState !== 'running') {
                this.currentState = 'running';
                this.playAnimation('Run');
                this.moveRandomly(true);
            } else if (this.currentState !== 'idle') {
                this.currentState = 'idle';
                this.playAnimation('Idle');
            }
        }, 3000); // Change behavior every 3 seconds
    }

    private moveRandomly(isRunning: boolean = false): void {
        if (!this.mesh) return;

        // Generate random direction
        const angle = Math.random() * Math.PI * 2;
        const distance = isRunning ? 5 : 2;
        const targetPosition = new Vector3(
            this.mesh.position.x + Math.sin(angle) * distance,
            this.mesh.position.y,
            this.mesh.position.z + Math.cos(angle) * distance
        );

        // Keep within bounds
        const boundaryLimit = 45;
        targetPosition.x = Math.max(-boundaryLimit, Math.min(boundaryLimit, targetPosition.x));
        targetPosition.z = Math.max(-boundaryLimit, Math.min(boundaryLimit, targetPosition.z));

        // Rotate towards movement direction
        this.mesh.rotation.y = angle;

        // Move to position over time
        const speed = isRunning ? 0.05 : 0.02;
        const animate = () => {
            if (!this.mesh || !this.isAlive) return;

            const dx = targetPosition.x - this.mesh.position.x;
            const dz = targetPosition.z - this.mesh.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance > 0.1) {
                this.mesh.position.x += dx * speed;
                this.mesh.position.z += dz * speed;
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    public takeDamage(amount: number): void {
        if (!this.isAlive) return;

        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        } else {
            this.playAnimation('HitReact', false);
            // After hit reaction, return to previous state
            setTimeout(() => {
                if (this.isAlive) {
                    this.playAnimation(this.currentState === 'running' ? 'Run' : 
                                    this.currentState === 'walking' ? 'Walk' : 'Idle');
                }
            }, 1000);
        }
    }

    private die(): void {
        this.isAlive = false;
        this.playAnimation('Death', false);
        // Remove enemy after death animation
        setTimeout(() => {
            if (this.mesh) {
                this.mesh.dispose();
            }
        }, 2000);
    }

    public getPosition(): Vector3 | null {
        return this.mesh ? this.mesh.position : null;
    }

    public getMesh(): AbstractMesh | null {
        return this.mesh;
    }

    public isActive(): boolean {
        return this.isAlive;
    }
} 