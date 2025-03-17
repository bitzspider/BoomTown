// Map Play Engine - Handles loading and rendering maps for the game
class MapPlayEngine {
    constructor(scene) {
        this.scene = scene;
        this.loadedModels = new Map();
        this.instances = new Map();
        
        // Enable collision system
        this.scene.collisionsEnabled = true;
        this.scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
        
        // Initialize Ammo.js physics engine
        const physicsEngine = new BABYLON.AmmoJSPlugin();
        this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), physicsEngine);
        
        // Enable collision detection for all meshes that start with 'collision_'
        this.scene.meshes.forEach(mesh => {
            if (mesh.name.startsWith('collision_')) {
                mesh.checkCollisions = true;
                mesh.isPickable = true;
                mesh.collisionMask = 1;
                mesh.useOctreeForCollisions = true;
            }
        });
    }

    // Load map data from server
    async loadMapData() {
        try {
            const response = await fetch('/map-data');
            const data = await response.json();
            console.log('Raw map data loaded:', data);
            return data;
        } catch (error) {
            console.error('Error loading map data:', error);
            throw error;
        }
    }

    // Render the map
    async renderMap(mapData) {
        console.log('Starting map render with data:', mapData);
        
        // Clear all existing instances
        this.clearAllInstances();
        
        // Process each object in the map
        for (const obj of mapData.objects) {
            console.log('Processing object:', obj);
            try {
                await this.createInstance(obj);
            } catch (error) {
                console.error(`Failed to create instance for object ${obj.id}:`, error);
                // Continue with next object instead of stopping the entire render
                continue;
            }
        }
        
        // Log final instance positions
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
            // Create collision mesh
            const collisionMesh = BABYLON.MeshBuilder.CreateBox(
                `collision_${obj.id}`,
                {
                    width: obj.scale?.x || 1,
                    height: obj.scale?.y || 1,
                    depth: obj.scale?.z || 1
                },
                this.scene
            );
            
            // Position and rotate collision mesh to match visual mesh
            collisionMesh.position = instance.rootMesh.position.clone();
            collisionMesh.rotation = instance.rootMesh.rotation.clone();
            collisionMesh.scaling = instance.rootMesh.scaling.clone();
            
            // Make collision mesh invisible
            collisionMesh.isVisible = false;
            
            // Set up collision properties
            collisionMesh.checkCollisions = true;
            collisionMesh.isPickable = true;
            collisionMesh.collisionMask = 1;
            collisionMesh.useOctreeForCollisions = true;
            
            // Make the visual mesh also check for collisions
            instance.rootMesh.checkCollisions = true;
            instance.rootMesh.isPickable = true;
            instance.rootMesh.collisionMask = 1;
            instance.rootMesh.useOctreeForCollisions = true;
            
            // Store collision mesh reference
            instance.collisionMesh = collisionMesh;
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