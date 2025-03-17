// Map Play Engine - Handles loading and rendering maps for the game
class MapPlayEngine {
    constructor(scene) {
        this.scene = scene;
        this.loadedModels = new Map();
        this.instances = new Map();
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
        try {
            // Load model if not already loaded
            if (!this.loadedModels.has(obj.model)) {
                console.log('Loading model:', obj.model);
                const model = await this.loadModel(obj.model);
                this.loadedModels.set(obj.model, model);
            }

            // Get the loaded model
            const container = this.loadedModels.get(obj.model);
            
            // Create instance
            console.log('Creating instance with ID:', obj.id, 'Position:', obj.position);
            const instance = this.createInstanceFromModel(container, obj);
            
            // Store instance
            this.instances.set(obj.id, instance);
            
            console.log('Created instance:', instance);
            console.log('Instance created at position:', {
                id: obj.id,
                finalPosition: instance.position
            });
            
            return instance;
        } catch (error) {
            console.error('Error creating instance:', error);
            throw new Error(`Failed to create instance for model ${obj.model}: ${error.message}`);
        }
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

    // Create an instance from a loaded model
    createInstanceFromModel(container, obj) {
        // Clone the container for this instance
        const instance = container.instantiateModelsToScene();
        const rootMesh = instance.rootNodes[0];
        
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
        
        // Make all child meshes pickable and visible
        const allMeshes = rootMesh.getChildMeshes();
        allMeshes.forEach(mesh => {
            mesh.isPickable = true;
            mesh.isVisible = true;
            mesh.id = `${obj.id}_${mesh.name}`;
            mesh.metadata = { parentId: obj.id }; // Store parent ID in metadata
        });

        // Store both the root mesh and its ID in the instances map
        this.instances.set(obj.id, rootMesh);
        
        return {
            id: obj.id,
            rootId: rootMesh.id,
            position: rootMesh.position,
            meshes: allMeshes.length + 1,
            childIds: allMeshes.map(m => m.id)
        };
    }
}

// Make the class globally accessible
window.MapPlayEngine = MapPlayEngine; 