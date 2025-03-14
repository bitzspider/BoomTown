// Enemy Controller for BoomTown
// Handles loading and animating the Character_Enemy model

// Global variables for enemy model
var enemyModels = {}; // Store loaded enemy models by ID
var enemySkeletons = {}; // Store skeletons for animations
var enemyAnimations = {}; // Store animation ranges by enemy ID
var loadedEnemies = {}; // Store loaded enemy instances
var pathVisualization = {}; // Store path visualization meshes by enemy ID
var existingPaths = []; // Store all active patrol paths to avoid overlap

// Add Yuka-specific variables after the global variables
var entityManager = new YUKA.EntityManager();
var time = new YUKA.Time();

// Generate a unique ID for enemies
function generateUniqueId() {
    return 'enemy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

let availableAnimations = {};
let currentAnim = null;

// Function to check if a new path overlaps with existing paths
function doesPathOverlap(newPath, minDistance = 5) {
    if (!newPath || newPath.length === 0) return false;
    
    for (const existingPath of existingPaths) {
        for (const newPoint of newPath) {
            for (const existingPoint of existingPath) {
                const dx = newPoint.x - existingPoint.x;
                const dz = newPoint.z - existingPoint.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                if (distance < minDistance) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Function to get a unique patrol path
function getUniquePatrolPath(position, maxAttempts = 10) {
    let attempts = 0;
    let path;
    
    do {
        // Generate a random number of waypoints between 6 and 13
        const numPoints = 6 + Math.floor(Math.random() * 8);
        
        // Generate random radius between 10 and 25 units
        const radius = 10 + Math.random() * 15;
        
        // Start from the given position
        path = [{ x: position.x, y: 0, z: position.z }];
        
        // Generate points in a polygon pattern with the first point being the start position
        for (let i = 1; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            // Add some randomness to the angle
            const randomAngle = angle + (Math.random() - 0.5) * 0.5;
            
            // Calculate point position with random radius variation
            const pointRadius = radius * (0.7 + Math.random() * 0.6);
            let x = position.x + Math.cos(randomAngle) * pointRadius;
            let z = position.z + Math.sin(randomAngle) * pointRadius;
            
            // Ensure point is within map boundaries
            x = Math.max(window.MAP_BOUNDARIES.minX + 5, Math.min(window.MAP_BOUNDARIES.maxX - 5, x));
            z = Math.max(window.MAP_BOUNDARIES.minZ + 5, Math.min(window.MAP_BOUNDARIES.maxZ - 5, z));
            
            path.push({ x, y: 0, z });
        }
        
        // Add the start point again to close the loop
        path.push({ ...path[0] });
        
        attempts++;
    } while (doesPathOverlap(path) && attempts < maxAttempts);
    
    if (path) {
        existingPaths.push(path);
    }
    
    console.log(`Generated path with ${path.length} waypoints`);
    return path;
}

// Function to generate a random spawn position
function generateRandomSpawnPosition() {
    const margin = 5;
    const x = window.MAP_BOUNDARIES.minX + margin + Math.random() * (window.MAP_BOUNDARIES.maxX - window.MAP_BOUNDARIES.minX - 2 * margin);
    const z = window.MAP_BOUNDARIES.minZ + margin + Math.random() * (window.MAP_BOUNDARIES.maxZ - window.MAP_BOUNDARIES.minZ - 2 * margin);
    return new BABYLON.Vector3(x, 0, z);
}

// Load the Character_Enemy model
async function loadEnemyModel(scene, position, param1 = null, param2 = null, callback = null) {
    // Generate a unique spawn position if none provided
    if (!position) {
        position = generateRandomSpawnPosition();
    }
    
    console.log("Loading enemy model at position:", position);
    
    const modelPath = "/models/";
    const model = "Character_Enemy.glb";
    
    try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync("", modelPath, model, scene);
        console.log("Enemy model loaded successfully:", result);
        
        const enemyId = generateUniqueId();
        const enemyRoot = result.meshes[0];
        
        // Store animations
        console.log("=== AVAILABLE ENEMY ANIMATIONS ===");
        scene.animationGroups.forEach(animGroup => {
            console.log(`Animation found: "${animGroup.name}"`);
            availableAnimations[animGroup.name] = animGroup;
        });
        
        console.log("Available animation keys:", Object.keys(availableAnimations));
        
        // Create transform node for positioning
        const enemyTransform = new BABYLON.TransformNode(`enemy_${enemyId}_root`, scene);
        enemyRoot.parent = enemyTransform;
        
        // Position enemy at spawn point
        enemyTransform.position = position;
        
        // Create Yuka Vehicle
        const vehicle = new YUKA.Vehicle();
        vehicle.position.set(position.x, 0, position.z);
        vehicle.maxSpeed = 2.0;
        vehicle.maxForce = 50;
        vehicle.updateNeeded = true;
        
        // Generate unique patrol path starting from spawn position
        const patrolPath = getUniquePatrolPath(position);
        console.log("Generated unique patrol path:", patrolPath);
        
        // Set up initial velocity and rotation towards first waypoint
        if (patrolPath && patrolPath.length > 0) {
            const firstWaypoint = patrolPath[0];
            const dx = firstWaypoint.x - position.x;
            const dz = firstWaypoint.z - position.z;
            const direction = new YUKA.Vector3(dx, 0, dz).normalize();
            vehicle.velocity.copy(direction).multiplyScalar(vehicle.maxSpeed);
            
            // Set initial rotation to face the first waypoint
            const initialAngle = Math.atan2(dx, dz);
            enemyRoot.rotation = new BABYLON.Vector3(0, initialAngle, 0);
        }
        
        // Store enemy in global map
        loadedEnemies[enemyId] = {
            root: enemyRoot,
            transform: enemyTransform,
            skeleton: result.skeletons[0],
            state: "IDLE",
            stateStartTime: Date.now(),
            idleDuration: 3000,
            currentPath: patrolPath,
            currentPathIndex: 0,
            moveSpeed: 2.0,
            rotationSpeed: 0.1,
            vehicle: vehicle
        };
        
        // Add vehicle to entity manager
        entityManager.add(vehicle);
        
        // Play initial idle animation
        playEnemyAnimation(enemyId, "Idle");
        
        // Set up state transition observer and Yuka update
        scene.onBeforeRenderObservable.add(() => {
            const deltaTime = engine.getDeltaTime() / 1000;
            time.update();
            
            // Update Yuka
            entityManager.update(deltaTime);
            
            // Update enemy state
            updateEnemyState(enemyId);
        });
        
        // Create visualization for initial path
        createPathVisualization(enemyId, patrolPath);
        
        if (callback && typeof callback === 'function') {
            const enemyData = {
                id: enemyId,
                mesh: enemyRoot,
                skeleton: result.skeletons[0]
            };
            callback(enemyData);
        }
        
        return enemyId;
    } catch (error) {
        console.error("Error loading enemy model:", error);
        throw error;
    }
}

// Update enemy state based on time and conditions
function updateEnemyState(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) return;
    
    const currentTime = Date.now();
    const timeInState = currentTime - enemy.stateStartTime;
    
    switch (enemy.state) {
        case "IDLE":
            if (timeInState >= enemy.idleDuration) {
                setEnemyState(enemyId, "PATROL");
            }
            break;
        case "PATROL":
            updateEnemyPatrol(enemyId);
            break;
    }
}

// Update enemy patrol movement
function updateEnemyPatrol(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !enemy.currentPath || enemy.currentPath.length === 0) {
        // Generate new unique path from current position
        const newPath = getUniquePatrolPath({ 
            x: enemy.transform.position.x, 
            z: enemy.transform.position.z 
        });
        
        // Remove old path from existingPaths if it exists
        const oldPathIndex = existingPaths.indexOf(enemy.currentPath);
        if (oldPathIndex !== -1) {
            existingPaths.splice(oldPathIndex, 1);
        }
        
        enemy.currentPath = newPath;
        enemy.currentPathIndex = 0;
        createPathVisualization(enemyId, newPath);
        return;
    }
    
    // Update current waypoint visualization
    updateWaypointVisualization(enemyId);
    
    const currentWaypoint = enemy.currentPath[enemy.currentPathIndex];
    const vehicle = enemy.vehicle;
    
    // Calculate distance to current waypoint
    const dx = currentWaypoint.x - vehicle.position.x;
    const dz = currentWaypoint.z - vehicle.position.z;
    const distanceToWaypoint = Math.sqrt(dx * dx + dz * dz);
    
    // If we've reached the waypoint
    if (distanceToWaypoint < 0.5) {
        enemy.currentPathIndex++;
        
        // If we've completed the path, generate a new one
        if (enemy.currentPathIndex >= enemy.currentPath.length) {
            // Remove old path from existingPaths
            const oldPathIndex = existingPaths.indexOf(enemy.currentPath);
            if (oldPathIndex !== -1) {
                existingPaths.splice(oldPathIndex, 1);
            }
            
            // Generate new path from current position
            enemy.currentPath = getUniquePatrolPath({ 
                x: vehicle.position.x, 
                z: vehicle.position.z 
            });
            enemy.currentPathIndex = 0;
            createPathVisualization(enemyId, enemy.currentPath);
        }
        
        // Update velocity towards next waypoint
        const nextWaypoint = enemy.currentPath[enemy.currentPathIndex];
        const newDx = nextWaypoint.x - vehicle.position.x;
        const newDz = nextWaypoint.z - vehicle.position.z;
        const newDirection = new YUKA.Vector3(newDx, 0, newDz).normalize();
        vehicle.velocity.copy(newDirection).multiplyScalar(vehicle.maxSpeed);
    }
    
    // Update vehicle position with smooth movement
    const deltaTime = engine.getDeltaTime() / 1000;
    const moveStep = vehicle.maxSpeed * deltaTime;
    
    // Calculate normalized direction to waypoint
    const direction = new YUKA.Vector3(dx, 0, dz).normalize();
    
    // Update vehicle position
    vehicle.position.x += direction.x * moveStep;
    vehicle.position.z += direction.z * moveStep;
    
    // Sync with Babylon mesh
    enemy.transform.position.x = vehicle.position.x;
    enemy.transform.position.z = vehicle.position.z;
    
    // Update rotation based on movement direction
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        // Add PI to the angle to rotate the model 180 degrees
        // This fixes the backward walking issue by aligning the model's forward direction with movement
        const targetAngle = Math.atan2(direction.x, direction.z) + Math.PI;
        const currentAngle = enemy.root.rotation.y;
        
        // Smooth rotation
        let angleDiff = targetAngle - currentAngle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Apply smooth rotation
        enemy.root.rotation.y += angleDiff * enemy.rotationSpeed;
    }
    
    // Check for collisions
    if (checkEnemyCollisions(enemy)) {
        // Restore previous position
        vehicle.position.x -= direction.x * moveStep;
        vehicle.position.z -= direction.z * moveStep;
        enemy.transform.position.x = vehicle.position.x;
        enemy.transform.position.z = vehicle.position.z;
        
        // Generate new path from current position
        const newPath = getUniquePatrolPath({ 
            x: vehicle.position.x, 
            z: vehicle.position.z 
        });
        
        // Remove old path from existingPaths
        const oldPathIndex = existingPaths.indexOf(enemy.currentPath);
        if (oldPathIndex !== -1) {
            existingPaths.splice(oldPathIndex, 1);
        }
        
        enemy.currentPath = newPath;
        enemy.currentPathIndex = 0;
        createPathVisualization(enemyId, newPath);
    }
    
    // Ensure walk animation is playing
    if (enemy.state !== "PATROL") {
        setEnemyState(enemyId, "PATROL");
    }
}

// Check for collisions with obstacles and walls
function checkEnemyCollisions(enemy) {
    const enemyPos = enemy.transform.position;
    const collisionRadius = 1.0; // Adjust based on enemy size
    
    // Check collisions with obstacles
    for (const obstacle of obstacles) {
        const dx = enemyPos.x - obstacle.position.x;
        const dz = enemyPos.z - obstacle.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Use the sum of the enemy collision radius and half the obstacle's width/depth
        const minDistance = collisionRadius + Math.max(obstacle.scaling.x, obstacle.scaling.z);
        
        if (distance < minDistance) {
            return true;
        }
    }
    
    // Check collisions with map boundaries
    const margin = 1.0; // Keep some distance from walls
    if (enemyPos.x < window.MAP_BOUNDARIES.minX + margin || 
        enemyPos.x > window.MAP_BOUNDARIES.maxX - margin ||
        enemyPos.z < window.MAP_BOUNDARIES.minZ + margin || 
        enemyPos.z > window.MAP_BOUNDARIES.maxZ - margin) {
        return true;
    }
    
    return false;
}

// Play animation on enemy
function playEnemyAnimation(enemyId, animationName) {
    console.log(`Attempting to play animation for enemy ${enemyId}: "${animationName}"`);
    
    if (!availableAnimations) {
        console.warn("No animations available");
        return;
    }
    
    let animation = null;
    const animationVariants = [
        animationName, // Exact match
        "CharacterArmature|" + animationName, // With prefix
        animationName.toLowerCase(), // Lowercase
        "CharacterArmature|" + animationName.toLowerCase() // Prefix with lowercase
    ];
    
    // Try all animation name variants
    for (const variant of animationVariants) {
        // Try exact match
        if (availableAnimations[variant]) {
            animation = availableAnimations[variant];
            console.log(`Found animation match: "${variant}"`);
            break;
        }
        
        // Try partial match
        const matchingKey = Object.keys(availableAnimations).find(key => 
            key.toLowerCase().includes(variant.toLowerCase()));
        if (matchingKey) {
            animation = availableAnimations[matchingKey];
            console.log(`Found partial animation match: "${matchingKey}" for "${variant}"`);
            break;
        }
    }
    
    if (animation) {
        // Stop all animations first
        Object.values(availableAnimations).forEach(anim => {
            anim.stop();
        });
        
        // Start the requested animation
        animation.start(true);
        currentAnim = animation;
        console.log(`Successfully playing animation: "${animation.name}"`);
    } else {
        console.warn(`Animation not found: "${animationName}". Available animations:`, Object.keys(availableAnimations));
    }
}

// Set enemy state and play corresponding animation
function setEnemyState(enemyId, state) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error("Enemy not found for ID:", enemyId);
        return;
    }
    
    console.log(`Setting enemy ${enemyId} state from ${enemy.state} to ${state}`);
    enemy.state = state;
    enemy.stateStartTime = Date.now();
    
    // If entering patrol state, generate new path if needed
    if (state === "PATROL" && (!enemy.currentPath || enemy.currentPath.length === 0)) {
        enemy.currentPath = getUniquePatrolPath({ 
            x: enemy.transform.position.x, 
            z: enemy.transform.position.z 
        });
        enemy.currentPathIndex = 0;
        console.log("New patrol path generated:", enemy.currentPath);
        
        // Create visualization for new path
        createPathVisualization(enemyId, enemy.currentPath);
    }
    
    // Get animation name from character config
    const configAnimation = CharacterEnemyConfig.getAnimationForMode(state);
    // Remove the "CharacterArmature|" prefix if it exists
    const animationName = configAnimation.replace("CharacterArmature|", "");
    console.log(`Playing animation for state ${state}:`, animationName);
    
    // Update movement speed based on state
    if (enemy.vehicle) {
        const speed = CharacterEnemyConfig.getSpeedForMode(state);
        enemy.vehicle.maxSpeed = speed;
        console.log(`Updated enemy speed to ${speed} for state ${state}`);
    }
    
    // Play the animation
    playEnemyAnimation(enemyId, animationName);
}

// Get enemy position
function getEnemyPosition(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error("Enemy not found for ID:", enemyId);
        return null;
    }
    
    return enemy.transform.position;
}

// Set enemy position
function setEnemyPosition(enemyId, position) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error("Enemy not found for ID:", enemyId);
        return;
    }
    
    enemy.transform.position = position;
}

// Set enemy rotation
function setEnemyRotation(enemyId, rotation) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error("Enemy not found for ID:", enemyId);
        return;
    }
    
    enemy.root.rotation = rotation;
}

// Dispose enemy model
function disposeEnemy(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error("Enemy not found for ID:", enemyId);
        return;
    }
    
    // Remove path from existingPaths
    const pathIndex = existingPaths.indexOf(enemy.currentPath);
    if (pathIndex !== -1) {
        existingPaths.splice(pathIndex, 1);
    }
    
    // Remove from entity manager
    if (enemy.vehicle) {
        entityManager.remove(enemy.vehicle);
    }
    
    // Remove from scene observer
    if (scene && scene.onBeforeRenderObservable) {
        // Note: This is a simplified removal. In a full implementation,
        // you'd want to store and remove the specific observer.
        scene.onBeforeRenderObservable.clear();
    }
    
    // Dispose meshes
    if (enemy.root) {
        enemy.root.dispose();
    }
    if (enemy.transform) {
        enemy.transform.dispose();
    }
    
    // Remove visualization
    if (pathVisualization[enemyId]) {
        pathVisualization[enemyId].lines.dispose();
        pathVisualization[enemyId].points.forEach(point => point.dispose());
        delete pathVisualization[enemyId];
    }
    
    // Remove from storage
    delete loadedEnemies[enemyId];
}

// Add this function to create path visualization
function createPathVisualization(enemyId, path) {
    // Remove existing visualization if any
    if (pathVisualization[enemyId]) {
        pathVisualization[enemyId].lines.dispose();
        pathVisualization[enemyId].points.forEach(point => point.dispose());
    }

    const enemy = loadedEnemies[enemyId];
    if (!enemy || !path || path.length < 2) return;

    // Create points array for the path
    const points = path.map(waypoint => new BABYLON.Vector3(waypoint.x, 1, waypoint.z));
    
    // Create lines
    const lines = BABYLON.MeshBuilder.CreateLines("path_" + enemyId, {
        points: points,
        updatable: true
    }, scene);
    lines.color = new BABYLON.Color3(1, 0, 0); // Red color for path
    
    // Create spheres for waypoints
    const waypointSpheres = path.map((waypoint, index) => {
        const sphere = BABYLON.MeshBuilder.CreateSphere("waypoint_" + enemyId + "_" + index, {
            diameter: 0.5
        }, scene);
        sphere.position = new BABYLON.Vector3(waypoint.x, 1, waypoint.z);
        sphere.material = new BABYLON.StandardMaterial("waypointMat_" + enemyId + "_" + index, scene);
        sphere.material.diffuseColor = new BABYLON.Color3(0, 1, 0); // Green color for waypoints
        sphere.material.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
        return sphere;
    });
    
    // Store visualization objects
    pathVisualization[enemyId] = {
        lines: lines,
        points: waypointSpheres
    };
}

// Add this function to update current waypoint visualization
function updateWaypointVisualization(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !pathVisualization[enemyId]) return;
    
    // Update waypoint colors
    pathVisualization[enemyId].points.forEach((sphere, index) => {
        const material = sphere.material;
        if (index === enemy.currentPathIndex) {
            material.diffuseColor = new BABYLON.Color3(1, 1, 0); // Yellow for current waypoint
            material.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0);
        } else {
            material.diffuseColor = new BABYLON.Color3(0, 1, 0); // Green for other waypoints
            material.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
        }
    });
}

// Add function to sync Babylon mesh with Yuka entity
function syncEnemyWithYuka(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !enemy.vehicle) return;
    
    // Update position
    enemy.transform.position.x = enemy.vehicle.position.x;
    enemy.transform.position.z = enemy.vehicle.position.z;
    
    // Update rotation based on vehicle's velocity
    if (enemy.vehicle.velocity.length() > 0.01) {
        const angle = Math.atan2(enemy.vehicle.velocity.x, enemy.vehicle.velocity.z) + Math.PI;
        enemy.root.rotation.y = angle;
    }
}

// Export functions
window.loadEnemyModel = loadEnemyModel;
window.playEnemyAnimation = playEnemyAnimation;
window.setEnemyState = setEnemyState;
window.getEnemyPosition = getEnemyPosition;
window.setEnemyPosition = setEnemyPosition;
window.setEnemyRotation = setEnemyRotation;
window.disposeEnemy = disposeEnemy; 