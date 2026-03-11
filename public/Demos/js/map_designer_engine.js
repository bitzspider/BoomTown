/*
 * BoomTown Map Designer Engine (map_designer_engine.js)
 * 
 * PURPOSE:
 * This is the core engine for the Map Designer tool, which allows creating, editing,
 * and saving game maps. It handles:
 * 1. Loading and saving map data from/to map_data.json
 * 2. Loading model data from model_data.json
 * 3. Creating, positioning, rotating, and scaling 3D objects in the scene
 * 4. Managing object attributes and metadata
 * 5. Tracking object instances with unique IDs
 * 6. Assigning proper type/sub_type properties to objects (e.g., character/enemy)
 * 
 * DEPENDENCIES (files this relies on):
 * - model_data.json: For model properties, attributes, and metadata
 * - BabylonJS: For 3D rendering, scene management, and mesh operations
 * - Model files (.glb): The actual 3D model assets in /models/ directory
 * - Server endpoints: '/map-data' and '/model-data' for data persistence
 * 
 * DEPENDENTS (files that rely on this):
 * - Map_Designer.html: UI for the map designer tool, uses this engine for all operations
 * - player_main.js: Loads saved maps for gameplay
 * - character_enemy_controller.js: Uses the map data for enemy spawning and behavior
 * 
 * DATA OUTPUT:
 * Produces map_data.json with:
 * - Object positions, rotations, and scales
 * - Object types and sub-types
 * - Custom attributes that override model and game defaults
 * - Unique IDs for each object instance
 * 
 * OBJECT TYPE ASSIGNMENT:
 * This file automatically assigns type="character" and sub_type="enemy"
 * for the main character models (Character_Enemy, Character_Hazmat, Character_Soldier).
 * This type/sub_type assignment is crucial as it's used by the game to identify
 * which objects should be spawned as enemies.
 */

class MapEngine {
    constructor(scene) {
        this.scene = scene;
        this.loadedObjects = new Map();
        this.mapData = null;
        this.instances = new Map(); // Track instances by ID
        this.modelData = { models: [] }; // Initialize empty model data
        this.modelDataMap = new Map();

        // Load model data right away
        this.loadModelData();
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

    getModelDefinition(modelName) {
        if (!modelName) {
            return null;
        }

        return this.modelDataMap.get(modelName) || null;
    }

    mergeAttributeValues(target, source) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) {
            return target;
        }

        for (const key in source) {
            if (
                typeof source[key] === 'object' &&
                source[key] !== null &&
                !Array.isArray(source[key]) &&
                typeof target[key] === 'object' &&
                target[key] !== null &&
                !Array.isArray(target[key])
            ) {
                target[key] = this.mergeAttributeValues({ ...target[key] }, source[key]);
            } else {
                target[key] = source[key];
            }
        }

        return target;
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

            const modelInfo = this.getModelDefinition(objectData.model);

            // Set instance metadata
            instance.metadata = {
                ...instance.metadata,
                isModel: true,
                modelDefinition: modelInfo,
                builtInActions: Array.isArray(modelInfo?.built_in_actions) ? modelInfo.built_in_actions : []
            };
            
            // Add type and sub_type for character models
            if (objectData.model.includes('Character_Enemy') || 
                objectData.model.includes('Character_Hazmat') || 
                objectData.model.includes('Character_Soldier')) {
                instance.metadata.type = "character";
                instance.metadata.sub_type = "enemy";
            } else {
                if (objectData.type || modelInfo?.type) {
                    instance.metadata.type = objectData.type || modelInfo.type;
                }
                if (objectData.sub_type || modelInfo?.sub_type) {
                    instance.metadata.sub_type = objectData.sub_type || modelInfo.sub_type;
                }
            }
            
            // Get and store merged attributes
            const attributes = this.getModelAttributes(modelInfo, objectData);
            instance.metadata.attributes = attributes;
            
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

        // Make sure model data is loaded
        if (!this.modelData || !this.modelData.models || this.modelData.models.length === 0) {
            try {
                await this.loadModelData();
            } catch (error) {
                console.error('Failed to load model data:', error);
                // Continue with empty model data
            }
        }

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
                    const modelInfo = this.getModelDefinition(object.model);
                    
                    // Get and store merged attributes
                    const attributes = this.getModelAttributes(modelInfo, object);
                    instance.metadata = { 
                        ...instance.metadata, 
                        attributes,
                        isModel: true,
                        modelDefinition: modelInfo,
                        builtInActions: Array.isArray(modelInfo?.built_in_actions) ? modelInfo.built_in_actions : []
                    };
                    
                    // Add type and sub_type metadata if available in object
                    if (object.type) {
                        instance.metadata.type = object.type;
                    }
                    if (object.sub_type) {
                        instance.metadata.sub_type = object.sub_type;
                    }
                    if (!object.type && modelInfo?.type) {
                        instance.metadata.type = modelInfo.type;
                    }
                    if (!object.sub_type && modelInfo?.sub_type) {
                        instance.metadata.sub_type = modelInfo.sub_type;
                    }
                    
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

    /**
     * Saves the current map to JSON
     */
    async saveMap(mapName = null) {
        try {
            if (!this.mapData) {
                this.mapData = { objects: [] };
            }

            // Build the saved object list from tracked Babylon instances.
            const savedObjects = [];
            const existingObjectsById = new Map(
                Array.isArray(this.mapData.objects)
                    ? this.mapData.objects.map(object => [object.id, object])
                    : []
            );
            
            // Go through each placed object instance.
            for (const [id, object] of this.instances.entries()) {
                if (!object || !object.metadata || !object.metadata.isModel) continue;

                const existingObject = existingObjectsById.get(id) || {};
                const modelName = object.metadata.modelName || existingObject.model;

                if (!modelName) {
                    console.warn(`Skipping save for object "${id}" because no model name was found.`);
                    continue;
                }

                const objectData = {
                    id,
                    model: modelName,
                    position: {
                        x: object.position.x,
                        y: object.position.y,
                        z: object.position.z
                    },
                    rotation: {
                        x: BABYLON.Tools.ToDegrees(object.rotation.x),
                        y: BABYLON.Tools.ToDegrees(object.rotation.y),
                        z: BABYLON.Tools.ToDegrees(object.rotation.z)
                    },
                    scale: {
                        x: object.scaling.x,
                        y: object.scaling.y,
                        z: object.scaling.z
                    }
                };
                
                // Preserve type and sub_type if they exist
                if (object.metadata.type) {
                    objectData.type = object.metadata.type;
                } else if (existingObject.type) {
                    objectData.type = existingObject.type;
                }
                if (object.metadata.sub_type) {
                    objectData.sub_type = object.metadata.sub_type;
                } else if (existingObject.sub_type) {
                    objectData.sub_type = existingObject.sub_type;
                }
                
                // For character models, set type and sub_type
                if (modelName && (
                    modelName.includes('Character_Enemy') || 
                    modelName.includes('Character_Hazmat') || 
                    modelName.includes('Character_Soldier')
                )) {
                    objectData.type = "character";
                    objectData.sub_type = "enemy";
                }
                
                // Get model object from modelData
                const modelObject = this.modelData.models.find(model => model.name === modelName);
                
                // Handle attributes - ensure it's an object, not an array
                if (
                    object.metadata.attributes &&
                    typeof object.metadata.attributes === 'object' &&
                    !Array.isArray(object.metadata.attributes)
                ) {
                    // Use existing metadata attributes
                    objectData.attributes = { ...object.metadata.attributes };
                } else if (modelObject) {
                    // Get attributes based on the model and this object instance
                    objectData.attributes = this.getModelAttributes(modelObject, existingObject);
                } else {
                    objectData.attributes = existingObject.attributes &&
                        typeof existingObject.attributes === 'object' &&
                        !Array.isArray(existingObject.attributes)
                        ? { ...existingObject.attributes }
                        : {};
                }
                
                savedObjects.push(objectData);
            }
            
            // Update the map data with the current objects
            this.mapData.objects = savedObjects;
            
            // Update map version
            this.mapData.version = this.mapData.version ? (parseFloat(this.mapData.version) + 0.1).toFixed(1) : "1.0";
            
            console.log('Map data ready to save:', this.mapData);
            
            // If a map name was provided by the UI, use it
            if (typeof mapName === 'string' && mapName.trim().length > 0) {
                this.mapData.name = mapName.trim();
            }
            
            // If we have a map name already, use it
            let finalMapName = this.mapData.name;
            
            // If no name yet, ask for one
            if (!finalMapName || finalMapName === 'Untitled Map') {
                finalMapName = prompt('Please enter a name for your map:', 'My Custom Map');
                if (finalMapName) {
                    this.mapData.name = finalMapName;
                } else {
                    this.mapData.name = 'My Custom Map';
                }
            }
            
            // Persist to server so gameplay loads the updated map_data.json
            const response = await fetch('/save-map', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.mapData)
            });
            
            let result = null;
            try {
                result = await response.json();
            } catch (_) {
                // ignore parse errors; we'll use HTTP status as the signal
            }
            
            if (!response.ok) {
                const message = (result && (result.details || result.error)) ?
                    (result.details || result.error) :
                    `Failed to save map (${response.status} ${response.statusText})`;
                throw new Error(message);
            }
            
            // Show confirmation
            const status = document.getElementById('status');
            status.textContent = 'Map saved successfully!';
            status.style.color = '#4CAF50';
            
            // Clear status after a delay
            setTimeout(() => {
                status.textContent = 'Ready';
                status.style.color = 'white';
            }, 3000);
            
            return true;
        } catch (error) {
            console.error('Error saving map:', error);
            
            // Show error
            const status = document.getElementById('status');
            status.textContent = `Error saving map: ${error.message || error}`;
            status.style.color = '#F44336';
            
            // Clear status after a delay
            setTimeout(() => {
                status.textContent = 'Ready';
                status.style.color = 'white';
            }, 3000);
            
            return false;
        }
    }

    /**
     * Exports the current in-memory map JSON as a downloaded file.
     * This does NOT persist to the server.
     */
    downloadMapJson(filename = null) {
        if (!this.mapData) return false;
        
        const blob = new Blob([JSON.stringify(this.mapData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename || `${(this.mapData.name || 'map').replace(/\s+/g, '_')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
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
    
    /**
     * Gets the model attributes by merging from GameConfig, model_data.json, and map_data
     * @param {*} model The model data from model_data.json
     * @param {*} object The object from map_data.json
     * @returns 
     */
    getModelAttributes(model, object) {
        try {
            // Start with an empty attributes object
            let attributes = {};
            
            // Add attributes from GameConfig if applicable and available
            if (typeof window.GameConfig !== 'undefined' && model?.name && window.GameConfig[model.name]) {
                attributes = { ...window.GameConfig[model.name] };
            }

            if (model?.default_attributes && typeof model.default_attributes === 'object' && !Array.isArray(model.default_attributes)) {
                attributes = this.mergeAttributeValues(attributes, model.default_attributes);
            }
            
            // If the model has attributes in model_data.json, merge them
            if(model?.attributes && typeof model.attributes === 'object') {
                attributes = this.mergeAttributeValues(attributes, model.attributes);
            }
            
            // If the object has instance-specific attributes in map_data, merge them
            if(object?.attributes && typeof object.attributes === 'object') {
                attributes = this.mergeAttributeValues(attributes, object.attributes);
            }
            
            return attributes;
        } catch(error) {
            console.error("Error getting model attributes:", error);
            return {};
        }
    }

    // Add a method to load model data
    async loadModelData() {
        try {
            console.log('Loading model data...');
            const response = await fetch('/model-data', {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load model data: ${response.status} ${response.statusText}`);
            }
            
            this.modelData = await response.json();
            this.modelDataMap = new Map();

            if (Array.isArray(this.modelData.models)) {
                this.modelData.models.forEach(model => {
                    if (model?.name) {
                        this.modelDataMap.set(model.name, model);
                    }
                });
            }

            console.log('Model data loaded successfully:', this.modelData);
            return this.modelData;
        } catch (error) {
            console.error('Error loading model data:', error);
            // Initialize with empty model data if loading fails
            this.modelData = { models: [] };
            this.modelDataMap = new Map();
            return this.modelData;
        }
    }
} 
