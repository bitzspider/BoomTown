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
                objects: Array.from(this.instances.values()).map(instance => ({
                    id: instance.id,
                    model: instance.model,
                    position: {
                        x: instance.position.x,
                        y: instance.position.y,
                        z: instance.position.z
                    },
                    rotation: {
                        x: BABYLON.Tools.ToDegrees(instance.rotation.x),
                        y: BABYLON.Tools.ToDegrees(instance.rotation.y),
                        z: BABYLON.Tools.ToDegrees(instance.rotation.z)
                    },
                    scale: {
                        x: instance.scaling.x,
                        y: instance.scaling.y,
                        z: instance.scaling.z
                    }
                })),
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
} 