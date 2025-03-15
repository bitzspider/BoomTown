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
        
        return rootMesh;
    }

    async addObject(objectData) {
        try {
            console.log('Adding new object:', objectData);
            const loadResult = await this.loadObject(objectData.model);
            
            // Create the instance
            const instance = this.createInstance(
                loadResult,
                objectData.position,
                objectData.rotation,
                objectData.scale,
                objectData.id
            );

            // Add to map data if not already present
            if (!this.mapData) {
                this.mapData = { objects: [] };
            }
            if (!this.mapData.objects.some(obj => obj.id === objectData.id)) {
                this.mapData.objects.push(objectData);
            }

            // Verify the instance was created correctly
            console.log('Object added successfully:', {
                id: objectData.id,
                position: instance.position,
                isVisible: instance.getChildMeshes().every(mesh => mesh.isVisible),
                childCount: instance.getChildMeshes().length
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
                const instance = this.createInstance(
                    container,
                    object.position,
                    object.rotation, 
                    object.scale, 
                    object.id
                );

                if (instance) {
                    console.log('Instance created at position:', {
                        id: object.id,
                        finalPosition: {
                            x: instance.position.x,
                            y: instance.position.y,
                            z: instance.position.z
                        }
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
                }
            }))
        );
    }

    async saveMap(mapName = 'Demo Map') {
        if (!this.mapData) {
            this.mapData = { objects: [] };
        }

        // Use the current state from mapData.objects directly
        // This ensures we're using the most up-to-date positions that have been modified
        const updatedObjects = this.mapData.objects.map(obj => ({
            ...obj,  // Keep all existing properties
            position: {
                x: parseFloat(obj.position.x),
                y: parseFloat(obj.position.y),
                z: parseFloat(obj.position.z)
            },
            rotation: {
                x: parseFloat(obj.rotation.x),
                y: parseFloat(obj.rotation.y),
                z: parseFloat(obj.rotation.z)
            },
            scale: {
                x: parseFloat(obj.scale.x),
                y: parseFloat(obj.scale.y),
                z: parseFloat(obj.scale.z)
            }
        }));

        // Update the map data
        this.mapData.objects = updatedObjects;
        
        // Update metadata
        if (!this.mapData.metadata) {
            this.mapData.metadata = {};
        }
        this.mapData.metadata.name = mapName;
        this.mapData.metadata.lastModified = new Date().toISOString();

        try {
            console.log('Attempting to save map data:', JSON.stringify(this.mapData, null, 2));
            const response = await fetch('/save-map', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.mapData)
            });

            const responseData = await response.json();
            console.log('Save response:', responseData);

            if (!response.ok) {
                throw new Error(responseData.details || 'Failed to save map');
            }

            console.log('Map saved successfully:', responseData);
            return responseData;
        } catch (error) {
            console.error('Error saving map:', error);
            console.error('Error details:', error.stack);
            throw error;
        }
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
} 