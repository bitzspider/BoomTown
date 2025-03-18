// Map Play Engine - Handles loading and rendering maps for the game
class MapPlayEngine {
    constructor(scene) {
        this.scene = scene;
        this.loadedModels = new Map();
        this.instances = new Map();
        this.loadedObjects = []; // Initialize loadedObjects array
        
        // Enable collision system
        this.scene.collisionsEnabled = true;
        this.scene.gravity = new BABYLON.Vector3(0, -9.81 / 60, 0);
        
        console.log("MapPlayEngine initialized with collision system");
    }

    // Load map data from server
    async loadMapData() {
        try {
            const response = await fetch('/map-data');
            const mapData = await response.json();
            
            // Return the data so it can be used by renderMap
            return mapData;
            
        } catch (error) {
            console.error("Error loading map data:", error);
            throw error;
        }
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