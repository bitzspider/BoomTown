class MapEngine {
    constructor(scene) {
        this.scene = scene;
        this.loadedObjects = new Map();
        this.mapData = null;
        this.instances = new Map(); // Track instances by ID
    }

    async loadMapData(mapDataUrl) {
        try {
            console.log('Attempting to load map data from server');
            // Use the new endpoint
            const response = await fetch('/map-data', {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            const data = await response.json();
            console.log('Raw map data loaded:', data);
            this.mapData = data;
            return this.mapData;
        } catch (error) {
            console.error('Error loading map data:', error);
            throw error;
        }
    }

    async loadObject(modelName) {
        if (this.loadedObjects.has(modelName)) {
            return this.loadedObjects.get(modelName);
        }

        try {
            console.log('Loading model:', modelName);
            // Use LoadAssetContainer instead of ImportMeshAsync
            const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
                "/models/",     // Path must start with / to be absolute from public
                modelName,      // Model file name
                this.scene
            );
            console.log('Model loaded successfully:', modelName, container);

            // Store the container
            this.loadedObjects.set(modelName, container);
            
            return container;
        } catch (error) {
            console.error(`Error loading model ${modelName}:`, error);
            throw error;
        }
    }

    createInstance(loadResult, position, rotation, scale, id) {
        console.log('Creating instance with ID:', id, 'Position:', position);
        
        // Create a new instance from the container
        const container = loadResult;
        
        // Clone the container for this instance
        const instance = container.instantiateModelsToScene();
        const rootMesh = instance.rootNodes[0];
        
        // Set the ID on the root mesh
        rootMesh.id = id;
        rootMesh.name = id; // Set name as well for consistency
        
        // Set position
        rootMesh.position = new BABYLON.Vector3(
            parseFloat(position.x) || 0,
            parseFloat(position.y) || 0,
            parseFloat(position.z) || 0
        );
        
        // Set rotation
        rootMesh.rotation = new BABYLON.Vector3(
            BABYLON.Tools.ToRadians(parseFloat(rotation?.x || 0)),
            BABYLON.Tools.ToRadians(parseFloat(rotation?.y || 0)),
            BABYLON.Tools.ToRadians(parseFloat(rotation?.z || 0))
        );
        
        // Set scale
        rootMesh.scaling = new BABYLON.Vector3(
            parseFloat(scale?.x || 1),
            parseFloat(scale?.y || 1),
            parseFloat(scale?.z || 1)
        );

        // Make root node and all meshes pickable and visible
        rootMesh.isPickable = true;
        rootMesh.isVisible = true;
        
        // Make all child meshes pickable and visible
        const allMeshes = rootMesh.getChildMeshes();
        allMeshes.forEach(mesh => {
            mesh.isPickable = true;
            mesh.isVisible = true;
            mesh.id = `${id}_${mesh.name}`;
            mesh.metadata = { parentId: id }; // Store parent ID in metadata
        });

        // Store both the root mesh and its ID in the instances map
        this.instances.set(id, rootMesh);
        
        console.log('Created instance:', {
            id: id,
            rootId: rootMesh.id,
            position: rootMesh.position,
            meshes: allMeshes.length + 1,
            childIds: allMeshes.map(m => m.id)
        });
        
        // Store model name in the metadata for attributes lookup
        rootMesh.metadata = { ...rootMesh.metadata, modelName: container.modelName };
        
        return rootMesh;
    }

    async addObject(objectData) {
        try {
            console.log('Adding new object:', objectData);
            const loadResult = await this.loadObject(objectData.model);
            
            // Store the model name in the container for reference
            loadResult.modelName = objectData.model;
            
            // Create the instance
            const instance = this.createInstance(
                loadResult,
                objectData.position,
                objectData.rotation,
                objectData.scale,
                objectData.id
            );

            // Get and store merged attributes
            const attributes = await this.getModelAttributes(objectData.model, objectData.id);
            instance.metadata = { ...instance.metadata, attributes };
            
            // Add to map data if not already present
            if (!this.mapData) {
                this.mapData = { objects: [] };
            }
            
            // If object already exists in mapData, update it, otherwise add it
            const existingObjectIndex = this.mapData.objects.findIndex(obj => obj.id === objectData.id);
            if (existingObjectIndex !== -1) {
                // Update existing object but preserve any existing attributes
                const existingAttributes = this.mapData.objects[existingObjectIndex].attributes || {};
                this.mapData.objects[existingObjectIndex] = {
                    ...objectData,
                    attributes: { ...existingAttributes, ...objectData.attributes } // Merge attributes
                };
            } else {
                // Add new object with attributes
                this.mapData.objects.push({
                    ...objectData,
                    attributes: objectData.attributes || attributes // Use provided attributes or merged ones
                });
            }

            // Verify the instance was created correctly
            console.log('Object added successfully:', {
                id: objectData.id,
                position: instance.position,
                isVisible: instance.getChildMeshes().every(mesh => mesh.isVisible),
                childCount: instance.getChildMeshes().length,
                attributes: instance.metadata?.attributes
            });

            return instance;
        } catch (error) {
            console.error('Error adding object:', error);
            throw error;
        }
    }

    removeObject(id) {
        const instance = this.instances.get(id);
        if (instance) {
            // Remove from scene
            instance.dispose();
            this.instances.delete(id);

            // Remove from map data
            if (this.mapData && this.mapData.objects) {
                this.mapData.objects = this.mapData.objects.filter(obj => obj.id !== id);
            }
        }
    }

    async renderMap() {
        if (!this.mapData) {
            throw new Error('Map data not loaded. Call loadMapData first.');
        }

        console.log('Starting map render with data:', this.mapData);
        
        // Clear existing objects more thoroughly
        this.instances.forEach(instance => {
            instance.dispose();
        });
        
        this.instances.clear();
        console.log('Cleared all existing instances');

        // Load and place each object
        for (const object of this.mapData.objects) {
            try {
                console.log('Processing object:', {
                    id: object.id,
                    model: object.model,
                    position: object.position
                });

                const container = await this.loadObject(object.model);
                
                // Store the model name in the container for reference
                container.modelName = object.model;
                
                const instance = this.createInstance(
                    container,
                    object.position,
                    object.rotation, 
                    object.scale, 
                    object.id
                );

                if (instance) {
                    // Get and store merged attributes
                    const attributes = await this.getModelAttributes(object.model, object.id);
                    instance.metadata = { ...instance.metadata, attributes };
                    
                    console.log('Instance created at position:', {
                        id: object.id,
                        finalPosition: {
                            x: instance.position.x,
                            y: instance.position.y,
                            z: instance.position.z
                        },
                        attributes: instance.metadata?.attributes
                    });
                }
            } catch (error) {
                console.error(`Error placing object ${object.model}:`, error);
            }
        }

        // Final verification of all instances
        console.log('Map render complete. Instance positions:', 
            Array.from(this.instances.entries()).map(([id, instance]) => ({
                id,
                position: {
                    x: instance.position.x,
                    y: instance.position.y,
                    z: instance.position.z
                },
                attributes: instance.metadata?.attributes
            }))
        );
    }

    async saveMap(mapName) {
        try {
            // Update the map name but preserve the ID
            const currentId = this.mapData?.id || this.generateUUID();
            
            // Prepare map data
            const mapData = {
                id: currentId,
                name: mapName,
                version: "1.0",
                gridSize: 1,
                showGrid: true,
                objects: this.mapData.objects.map(obj => {
                    // Find the instance for this object
                    const instance = this.instances.get(obj.id);
                    
                    // Prepare the updated object data
                    const updatedObj = {
                        id: obj.id,
                        model: obj.model, // Keep the original model name
                        position: instance ? {
                            x: instance.position.x,
                            y: instance.position.y,
                            z: instance.position.z
                        } : obj.position,
                        rotation: instance ? {
                            x: BABYLON.Tools.ToDegrees(instance.rotation.x),
                            y: BABYLON.Tools.ToDegrees(instance.rotation.y),
                            z: BABYLON.Tools.ToDegrees(instance.rotation.z)
                        } : obj.rotation,
                        scale: instance ? {
                            x: instance.scaling.x,
                            y: instance.scaling.y,
                            z: instance.scaling.z
                        } : obj.scale
                    };

                    // Preserve attributes from both the map data and instance metadata
                    if (instance && instance.metadata && instance.metadata.attributes) {
                        updatedObj.attributes = instance.metadata.attributes;
                    } else if (obj.attributes) {
                        updatedObj.attributes = obj.attributes;
                    }

                    return updatedObj;
                }),
                camera: {
                    position: {
                        x: this.scene.activeCamera.position.x,
                        y: this.scene.activeCamera.position.y,
                        z: this.scene.activeCamera.position.z
                    },
                    target: {
                        x: this.scene.activeCamera.target.x,
                        y: this.scene.activeCamera.target.y,
                        z: this.scene.activeCamera.target.z
                    }
                },
                lighting: {
                    ambient: {
                        intensity: 1
                    },
                    directional: {
                        intensity: 0.5,
                        direction: {
                            x: -1,
                            y: -2,
                            z: -1
                        }
                    }
                }
            };

            // Store the current map data
            this.mapData = mapData;

            // Send to server
            const response = await fetch('/save-map', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mapData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to save map');
            }

            return await response.json();
        } catch (error) {
            console.error('Error saving map:', error);
            throw error;
        }
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Helper function to convert world coordinates to grid coordinates
    worldToGrid(worldX, worldZ, gridSize) {
        return {
            x: Math.round(worldX / gridSize),
            z: Math.round(worldZ / gridSize)
        };
    }

    // Helper function to convert grid coordinates to world coordinates
    gridToWorld(gridX, gridZ, gridSize) {
        return {
            x: gridX * gridSize,
            z: gridZ * gridSize
        };
    }

    getMapData() {
        return this.mapData;
    }
    
    // Get merged model attributes from all three sources:
    // 1. GameConfig (from game_config.js) - default game settings
    // 2. Model data (from model_data.json) - model-specific attributes
    // 3. Map data (from map_data.json) - instance-specific overrides
    async getModelAttributes(modelName, objectId) {
        // Start with empty attributes object
        let attributes = {};
        
        try {
            // 1. Get attributes from GameConfig (if it exists in window)
            if (window.GameConfig) {
                // For enemy character models, add the enemy settings
                if (modelName.toLowerCase().includes('character_enemy') || 
                    modelName.toLowerCase().includes('character_hazmat') || 
                    modelName.toLowerCase().includes('character_soldier')) {
                    attributes = { ...attributes, ...window.GameConfig.enemies };
                }
            }
            
            // 2. Get model-specific attributes from model_data.json
            try {
                const modelDataResponse = await fetch('/model-data');
                const modelData = await modelDataResponse.json();
                
                // Find the specific model in the data
                const modelInfo = modelData.models.find(model => model.name === modelName);
                if (modelInfo) {
                    attributes = { ...attributes, ...modelInfo };
                }
            } catch (error) {
                console.error('Error loading model data:', error);
            }
            
            // 3. Get instance-specific attributes from map_data
            if (this.mapData && this.mapData.objects && objectId) {
                const objectData = this.mapData.objects.find(obj => obj.id === objectId);
                if (objectData && objectData.attributes) {
                    attributes = { ...attributes, ...objectData.attributes };
                }
            }
            
            return attributes;
        } catch (error) {
            console.error('Error getting model attributes:', error);
            return attributes; // Return whatever we have even if there was an error
        }
    }
} 