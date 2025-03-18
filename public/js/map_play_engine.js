// Map Play Engine - Handles loading and rendering maps for the game
class MapPlayEngine {
    constructor(scene) {
        this.scene = scene;
        this.loadedModels = new Map();
        this.instances = new Map();
        this.loadedObjects = []; // Initialize loadedObjects array
        this.modelData = null; // Store model data
        this.modelDataMap = new Map(); // Quick lookup for model data
        
        // Enable collision system
        this.scene.collisionsEnabled = true;
        this.scene.gravity = new BABYLON.Vector3(0, -9.81 / 60, 0);
        
        console.log("MapPlayEngine initialized with collision system");
    }

    // Load map data from server
    async loadMapData() {
        try {
            // Load model data first (if not already loaded)
            if (!this.modelData) {
                await this.loadModelData();
            }
            
            const response = await fetch('/map-data');
            const mapData = await response.json();
            
            // Return the data so it can be used by renderMap
            return mapData;
            
        } catch (error) {
            console.error("Error loading map data:", error);
            throw error;
        }
    }
    
    // Load model data from model_data.json
    async loadModelData() {
        try {
            console.log('Loading model data from model_data.json');
            const response = await fetch('/Demos/model_data.json');
            
            if (!response.ok) {
                throw new Error(`Failed to load model_data.json: ${response.status} ${response.statusText}`);
            }
            
            this.modelData = await response.json();
            
            // Create a lookup map for quick access to model data
            if (this.modelData && this.modelData.models && Array.isArray(this.modelData.models)) {
                this.modelData.models.forEach(model => {
                    if (model && model.name) {
                        this.modelDataMap.set(model.name, model);
                        
                        // Special logging for ammo pickups
                        if (model.type === 'loot' && model.sub_type === 'ammo') {
                            console.log(`Found ammo pickup model in model_data.json: ${model.name}`, model);
                        }
                    }
                });
                
                console.log(`Loaded ${this.modelDataMap.size} model definitions`);
                
                // Log all ammo pickup model names
                const ammoModels = this.modelData.models.filter(m => m.type === 'loot' && m.sub_type === 'ammo');
                if (ammoModels.length > 0) {
                    console.log("Ammo pickup models available:", ammoModels.map(m => m.name));
                } else {
                    console.warn("No ammo pickup models found in model_data.json!");
                }
            } else {
                console.error("Invalid model data format - missing models array:", this.modelData);
            }
            
            return this.modelData;
        } catch (error) {
            console.error("Error loading model data:", error);
            // Create default entry for Box of bullets.glb
            this.modelDataMap.set("Box of bullets.glb", {
                name: "Box of bullets.glb",
                type: "loot",
                sub_type: "ammo",
                description: "Ammo box containing bullets",
                value: 10,
                respawn: true,
                respawn_time: 10000,
                respawn_delay: 5000
            });
            console.log("Created default ammo pickup model entry");
            return null;
        }
    }
    
    // Get model attributes
    getModelAttributes(modelName) {
        return this.modelDataMap.get(modelName);
    }

    // Render the map
    async renderMap(mapData) {
        console.log('Starting map render with data:', mapData);
        
        if (!mapData || !mapData.objects) {
            console.error('Invalid map data:', mapData);
            return;
        }
        
        // Clear all existing instances
        this.clearAllInstances();
        
        // Process each object in the map
        for (const obj of mapData.objects) {
            console.log('Processing object:', obj);
            try {
                await this.createInstance(obj);
            } catch (error) {
                console.error(`Failed to create instance for object ${obj.id}:`, error);
                continue;
            }
        }
        
        console.log('Map render complete. Instance positions:', Array.from(this.instances.values()));
    }

    // Clear all existing instances
    clearAllInstances() {
        console.log('Cleared all existing instances');
        for (const instance of this.instances.values()) {
            if (instance.rootMesh) {
                instance.rootMesh.dispose();
            }
        }
        this.instances.clear();
    }

    // Create an instance of a model
    async createInstance(obj) {
        console.log('Creating instance for object:', obj);
        
        // Load the model if not already loaded
        let container = this.loadedModels.get(obj.model);
        if (!container) {
            container = await this.loadModel(obj.model);
            this.loadedModels.set(obj.model, container);
        }
        
        // Create the instance
        const instance = this.createInstanceFromModel(container, obj);
        
        if (!instance || !instance.rootMesh) {
            console.error('Failed to create instance from model');
            return null;
        }
        
        // Check for model attributes and apply them if it's an ammo pickup
        const modelAttributes = this.getModelAttributes(obj.model);
        console.log(`Checking model attributes for ${obj.model}:`, modelAttributes);
        
        if (modelAttributes && modelAttributes.type === 'loot' && modelAttributes.sub_type === 'ammo') {
            console.log(`Setting up ammo pickup for ${obj.id} with model ${obj.model}`);
            this.setupAmmoPickup(instance.rootMesh, modelAttributes);
        } else if (obj.model === "Box of bullets.glb" || obj.model.includes("Box of bullets")) {
            // Special case for ammo boxes if the exact name match didn't work
            console.log(`Model is Box of bullets.glb but didn't match attributes. Forcing ammo pickup setup for ${obj.id}`);
            // Look up model with exact name
            const ammoAttributes = Array.from(this.modelDataMap.entries())
                .find(([key, value]) => key.includes("Box of bullets"));
                
            if (ammoAttributes && ammoAttributes[1]) {
                console.log("Found ammo attributes by partial match:", ammoAttributes[1]);
                this.setupAmmoPickup(instance.rootMesh, ammoAttributes[1]);
            } else {
                // Fallback with default values
                console.log("Using fallback ammo attributes");
                this.setupAmmoPickup(instance.rootMesh, {
                    value: 10,
                    respawn: true,
                    respawn_time: 10000,
                    respawn_delay: 5000
                });
            }
        }
        
        // Handle collision if specified (default to true)
        const hasCollision = obj.collision !== false;
        if (hasCollision) {
            // Enable collisions on all meshes
            const meshes = [instance.rootMesh, ...instance.rootMesh.getChildMeshes()];
            meshes.forEach(mesh => {
                mesh.checkCollisions = true;
            });
            
            // Only create a simple debug visualization for hitboxes if debug is enabled
            if (GameConfig?.debug?.showHitboxes) {
                // Create a simple bounding box for visualization
                const boundingInfo = instance.rootMesh.getBoundingInfo();
                const min = boundingInfo.boundingBox.minimumWorld;
                const max = boundingInfo.boundingBox.maximumWorld;
                
                const width = max.x - min.x;
                const height = max.y - min.y;
                const depth = max.z - min.z;
                const center = new BABYLON.Vector3(
                    (min.x + max.x) / 2,
                    (min.y + max.y) / 2,
                    (min.z + max.z) / 2
                );
                
                // Create visualization box
                const debugBox = BABYLON.MeshBuilder.CreateBox(
                    `debug_box_${obj.id}`,
                    {
                        width: width > 0 ? width : 1,
                        height: height > 0 ? height : 1,
                        depth: depth > 0 ? depth : 1
                    },
                    this.scene
                );
                
                // Position box at center
                debugBox.position = center;
                debugBox.material = new BABYLON.StandardMaterial(`debug_mat_${obj.id}`, this.scene);
                debugBox.material.alpha = 0.2;
                debugBox.material.diffuseColor = new BABYLON.Color3(1, 0, 0);
                debugBox.isPickable = false;
                
                // Store debug box reference
                instance.debugBox = debugBox;
            }
        }
        
        // Store the instance
        this.instances.set(obj.id, instance);
        
        return instance;
    }
    
    // Setup ammo pickup with properties from model_data.json
    setupAmmoPickup(mesh, attributes) {
        console.log('Setting up ammo pickup for mesh:', mesh.id);
        
        // Set pickup properties on the mesh
        mesh.isPickup = true;
        mesh.pickupType = "ammo";
        mesh.ammoAmount = attributes.value || 10;
        mesh.respawn = attributes.respawn || false;
        mesh.respawnTime = attributes.respawn_time || 0;
        mesh.respawnDelay = attributes.respawn_delay || 0;
        
        // Also set these properties on all child meshes
        const childMeshes = mesh.getChildMeshes();
        childMeshes.forEach(childMesh => {
            childMesh.isPickup = true;
            childMesh.pickupType = "ammo";
            childMesh.ammoAmount = attributes.value || 10;
            
            // Add materials to make child meshes more visible if they have them
            if (childMesh.material) {
                childMesh.material.emissiveColor = new BABYLON.Color3(0, 0, 0.5); // Blue glow
                childMesh.material.specularColor = new BABYLON.Color3(1, 1, 1);
            }
        });
        
        // Add glowing material to parent mesh if it doesn't have one
        if (!mesh.material) {
            mesh.material = new BABYLON.StandardMaterial("ammo_material_" + mesh.id, this.scene);
        }
        
        // Make the ammo box glow slightly
        mesh.material.emissiveColor = new BABYLON.Color3(0, 0, 0.5); // Blue glow
        mesh.material.specularColor = new BABYLON.Color3(1, 1, 1); // Shiny
        
        // Try to create a highlight layer for the ammo box if it doesn't exist in the scene
        if (!this.scene.ammoHighlightLayer) {
            try {
                this.scene.ammoHighlightLayer = new BABYLON.HighlightLayer("ammoHighlightLayer", this.scene);
                this.scene.ammoHighlightLayer.blurHorizontalSize = 2;
                this.scene.ammoHighlightLayer.blurVerticalSize = 2;
            } catch (e) {
                console.log("HighlightLayer not supported:", e);
            }
        }
        
        // Add mesh to highlight layer
        if (this.scene.ammoHighlightLayer) {
            try {
                this.scene.ammoHighlightLayer.addMesh(mesh, new BABYLON.Color3(0, 0, 1));
            } catch (e) {
                console.log("Could not add mesh to highlight layer:", e);
            }
        }
        
        // Scale up slightly to make it more visible
        const currentScale = mesh.scaling.clone();
        mesh.scaling = new BABYLON.Vector3(
            currentScale.x * 1.5,
            currentScale.y * 1.5,
            currentScale.z * 1.5
        );
        
        // Add simple pickup animation
        this.addPickupAnimation(mesh);
        
        console.log(`Ammo pickup setup complete for ${mesh.id} with amount ${mesh.ammoAmount}`);
    }
    
    // Add floating and rotation animation to pickups
    addPickupAnimation(mesh) {
        // Create rotation animation
        const rotationAnimation = new BABYLON.Animation(
            "rotationAnimation",
            "rotation.y",
            30,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        
        // Define keyframes
        const rotationKeys = [];
        rotationKeys.push({ frame: 0, value: 0 });
        rotationKeys.push({ frame: 60, value: Math.PI * 2 });
        rotationAnimation.setKeys(rotationKeys);
        
        // Create hover animation
        const hoverAnimation = new BABYLON.Animation(
            "hoverAnimation",
            "position.y",
            30,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        
        // Get the original Y position
        const originalY = mesh.position.y;
        
        // Define keyframes
        const hoverKeys = [];
        hoverKeys.push({ frame: 0, value: originalY });
        hoverKeys.push({ frame: 30, value: originalY + 0.2 });
        hoverKeys.push({ frame: 60, value: originalY });
        hoverAnimation.setKeys(hoverKeys);
        
        // Apply animations to mesh
        mesh.animations = [rotationAnimation, hoverAnimation];
        
        // Start the animations
        this.scene.beginAnimation(mesh, 0, 60, true);
    }

    // Create an instance from a loaded model
    createInstanceFromModel(container, obj) {
        // Clone the container for this instance
        const instance = container.instantiateModelsToScene();
        const rootMesh = instance.rootNodes[0];
        
        if (!rootMesh) {
            console.error('No root mesh found in instance');
            return null;
        }
        
        // Set the ID on the root mesh
        rootMesh.id = obj.id;
        rootMesh.name = obj.id; // Set name as well for consistency
        
        // Set position
        rootMesh.position = new BABYLON.Vector3(
            parseFloat(obj.position.x) || 0,
            parseFloat(obj.position.y) || 0,
            parseFloat(obj.position.z) || 0
        );
        
        // Set rotation
        rootMesh.rotation = new BABYLON.Vector3(
            BABYLON.Tools.ToRadians(parseFloat(obj.rotation?.x || 0)),
            BABYLON.Tools.ToRadians(parseFloat(obj.rotation?.y || 0)),
            BABYLON.Tools.ToRadians(parseFloat(obj.rotation?.z || 0))
        );
        
        // Set scale
        rootMesh.scaling = new BABYLON.Vector3(
            parseFloat(obj.scale?.x || 1),
            parseFloat(obj.scale?.y || 1),
            parseFloat(obj.scale?.z || 1)
        );

        // Make root node and all meshes pickable and visible
        rootMesh.isPickable = true;
        rootMesh.isVisible = true;
        rootMesh.checkCollisions = true;
        rootMesh.collisionMask = 1;
        rootMesh.useOctreeForCollisions = true;
        
        // Make all child meshes pickable, visible, and collision-enabled
        const allMeshes = rootMesh.getChildMeshes();
        allMeshes.forEach(mesh => {
            mesh.isPickable = true;
            mesh.isVisible = true;
            mesh.checkCollisions = true;
            mesh.collisionMask = 1;
            mesh.useOctreeForCollisions = true;
            mesh.id = `${obj.id}_${mesh.name}`;
            mesh.metadata = { parentId: obj.id }; // Store parent ID in metadata
        });

        return {
            id: obj.id,
            rootMesh: rootMesh,
            position: rootMesh.position,
            meshes: allMeshes.length + 1,
            childIds: allMeshes.map(m => m.id)
        };
    }

    // Load a model
    async loadModel(modelPath) {
        try {
            console.log('Loading model:', modelPath);
            // Use LoadAssetContainerAsync instead of ImportMesh
            const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
                "/models/",     // Path must start with / to be absolute from public
                modelPath,      // Model file name
                this.scene
            );

            // Enable collisions on all meshes in the container
            container.meshes.forEach(mesh => {
                // Enable collisions
                mesh.checkCollisions = true;
            });

            console.log('Model loaded successfully:', modelPath, container);
            return container;
        } catch (error) {
            console.error(`Error loading model ${modelPath}:`, error);
            throw error;
        }
    }
}

// Make the class globally accessible
window.MapPlayEngine = MapPlayEngine; 