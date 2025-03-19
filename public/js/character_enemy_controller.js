// Enemy Controller for BoomTown
// Handles loading and animating the Character_Enemy model

// Global variables for enemy model
var enemyModels = {}; // Store loaded enemy models by ID
var enemySkeletons = {}; // Store skeletons for animations
var enemyAnimations = {}; // Store animation ranges by enemy ID
var loadedEnemies = {}; // Store loaded enemy instances
var pathVisualization = {}; // Store path visualization meshes by enemy ID
var existingPaths = []; // Store all active patrol paths to avoid overlap

// Reference to the scene (will be set when loading enemies)
var scene = null;

// Make loadedEnemies globally accessible
window.loadedEnemies = loadedEnemies;

// Reference to player mesh (will be set by player_main.js)
var playerMesh = null;

// Function to set player mesh reference
function setPlayerMeshReference(mesh) {
    playerMesh = mesh;
    debugLog("Player mesh reference set in enemy controller");
}

// Make the function globally accessible
window.setPlayerMeshReference = setPlayerMeshReference;

// Add Yuka-specific variables after the global variables
var entityManager = new YUKA.EntityManager();
var time = new YUKA.Time();

// Generate a unique ID for enemies
function generateUniqueId() {
    return 'enemy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Changed from global to per-enemy animations tracking
var currentAnim = null;

// Function to check if a new path overlaps with existing paths
function doesPathOverlap(newPath, minDistance = GameConfig.patrolPaths.minDistance) {
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
function getUniquePatrolPath(position, maxAttempts = GameConfig.patrolPaths.maxAttempts) {
    let attempts = 0;
    let path;
    let overlapDetected = false;
    
    do {
        overlapDetected = false;
        attempts++;
        
        // Generate a random number of waypoints between min and max from config
        const numPoints = GameConfig.patrolPaths.minWaypoints + 
                          Math.floor(Math.random() * (GameConfig.patrolPaths.maxWaypoints - GameConfig.patrolPaths.minWaypoints + 1));
        
        // Generate random radius between min and max from config
        const radius = GameConfig.patrolPaths.minRadius + 
                       Math.random() * (GameConfig.patrolPaths.maxRadius - GameConfig.patrolPaths.minRadius);
        
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
            const margin = GameConfig.map.boundaryMargin;
            x = Math.max(GameConfig.map.boundaries.minX + margin, Math.min(GameConfig.map.boundaries.maxX - margin, x));
            z = Math.max(GameConfig.map.boundaries.minZ + margin, Math.min(GameConfig.map.boundaries.maxZ - margin, z));
            
            path.push({ x, y: 0, z });
        }
        
        // Add the start point again to close the loop
        path.push({ ...path[0] });
        
        // Check if this path overlaps with any existing path
        overlapDetected = doesPathOverlap(path);
        
    } while (overlapDetected && attempts < maxAttempts);
    
    // If we found a valid path, add it to existingPaths
    if (!overlapDetected) {
        existingPaths.push(path);
        console.log(`Created unique patrol path with ${path.length} waypoints after ${attempts} attempts, total paths: ${existingPaths.length}`);
    } else {
        console.warn(`Failed to create non-overlapping path after ${attempts} attempts, using potentially overlapping path`);
    }
    
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
async function loadEnemyModel(sceneParam, position, modelParam = null, modelDetails = null, callback = null) {
    // Set the global scene reference
    scene = sceneParam;
    
    // Generate a unique spawn position if none provided
    if (!position) {
        position = generateRandomSpawnPosition();
    }
    
    console.log("Loading enemy model at position:", position);
    
    const modelPath = "/models/";
    // Use the provided model parameter or fall back to Character_Enemy.glb
    const model = modelParam || "Character_Enemy.glb";
    const modelType = model.split('.')[0]; // Extract model name without extension
    
    console.log(`Loading enemy model: ${model}, type: ${modelType}`);
    
    // Create configuration object with default values from GameConfig
    let enemyConfig = {
        // Clone default settings to avoid modifying the original
        health: GameConfig.enemies.health,
        idleDuration: GameConfig.enemies.idleDuration,
        moveSpeed: GameConfig.enemies.moveSpeed,
        rotationSpeed: GameConfig.enemies.rotationSpeed,
        chaseSpeed: GameConfig.enemies.chaseSpeed,
        detectionRange: GameConfig.enemies.detectionRange,
        aggroTime: GameConfig.enemies.aggroTime,
        deathAnimDuration: GameConfig.enemies.deathAnimDuration,
        hitReactionDuration: GameConfig.enemies.hitReactionDuration,
        searchDuration: GameConfig.enemies.searchDuration,
        attackRange: GameConfig.enemies.attackRange,
        dodgeFrequency: GameConfig.enemies.dodgeFrequency,
        minDodgeDistance: GameConfig.enemies.minDodgeDistance,
        maxDodgeDistance: GameConfig.enemies.maxDodgeDistance,
        circleStrafing: GameConfig.enemies.circleStrafing,
        minAttackDistance: GameConfig.enemies.minAttackDistance,
        maxAttackDistance: GameConfig.enemies.maxAttackDistance,
        attackModeDecisionTime: GameConfig.enemies.attackModeDecisionTime,
        shootProbability: GameConfig.enemies.shootProbability,
        attackShootProbability: GameConfig.enemies.attackShootProbability,
        burstFireEnabled: GameConfig.enemies.burstFireEnabled,
        burstShotCount: GameConfig.enemies.burstShotCount,
        burstFireInterval: GameConfig.enemies.burstFireInterval
    };
    
    // Apply model-specific overrides from modelDetails if available
    if (modelDetails) {
        console.log(`Applying model-specific settings for ${model}:`, modelDetails);
        // Override default settings with model-specific ones
        Object.keys(modelDetails).forEach(key => {
            // Only override properties that exist in enemyConfig and aren't 'name', 'type', 'sub_type', etc.
            if (key in enemyConfig || ['health', 'moveSpeed', 'chaseSpeed', 'detectionRange'].includes(key)) {
                enemyConfig[key] = modelDetails[key];
            }
        });
    }
    
    try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync("", modelPath, model, scene);
        console.log("Enemy model loaded successfully:", result);
        
        const enemyId = generateUniqueId();
        const enemyRoot = result.meshes[0];
        
        // Clone animation groups to make them unique per enemy
        const enemyAnimations = {};
        console.log(`=== AVAILABLE ANIMATIONS FOR ENEMY ${enemyId} (${modelType}) ===`);
        
        // Clone each animation group with a unique name for this enemy
        result.animationGroups.forEach(originalAnimGroup => {
            // Create a clone with unique name for this enemy instance
            const uniqueName = `${originalAnimGroup.name}_${enemyId}`;
            const clonedGroup = originalAnimGroup.clone();
            clonedGroup.name = uniqueName;
            
            // Store in the enemy's animation collection
            enemyAnimations[originalAnimGroup.name] = clonedGroup;
            console.log(`Animation cloned for ${modelType}: "${originalAnimGroup.name}" -> "${uniqueName}"`);
            
            // Stop the original to ensure it doesn't interfere
            originalAnimGroup.stop();
        });
        
        // List all available animations to help with debugging
        listAvailableAnimations(enemyAnimations);
        
        // Create transform node for positioning
        const enemyTransform = new BABYLON.TransformNode(`enemy_${enemyId}_root`, scene);
        enemyRoot.parent = enemyTransform;
        
        // Position enemy at spawn point
        enemyTransform.position = position;
        
        // Create head hitbox with enemy ID
        const headHitbox = BABYLON.MeshBuilder.CreateBox(`hitbox_head_${enemyId}`, {
            width: GameConfig.enemies.headHitbox.width,
            height: GameConfig.enemies.headHitbox.height,
            depth: GameConfig.enemies.headHitbox.depth
        }, scene);
        
        // Create body hitbox with enemy ID
        const bodyHitbox = BABYLON.MeshBuilder.CreateBox(`hitbox_body_${enemyId}`, {
            width: GameConfig.enemies.bodyHitbox.width,
            height: GameConfig.enemies.bodyHitbox.height,
            depth: GameConfig.enemies.bodyHitbox.depth
        }, scene);
        
        // Create materials for hitboxes with enemy ID
        const headMaterial = new BABYLON.StandardMaterial(`hitbox_head_mat_${enemyId}`, scene);
        headMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red for headshots
        headMaterial.alpha = 0.3;
        headMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        headMaterial.emissiveColor = new BABYLON.Color3(0.5, 0, 0);
        headMaterial.backFaceCulling = false;
        
        const bodyMaterial = new BABYLON.StandardMaterial(`hitbox_body_mat_${enemyId}`, scene);
        bodyMaterial.diffuseColor = new BABYLON.Color3(1, 0.5, 0); // Orange for body shots
        bodyMaterial.alpha = 0.3;
        bodyMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        bodyMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.25, 0);
        bodyMaterial.backFaceCulling = false;
        
        // Apply materials to hitboxes
        headHitbox.material = headMaterial;
        bodyHitbox.material = bodyMaterial;
        
        // Configure hitboxes for collision detection
        headHitbox.isPickable = true;
        bodyHitbox.isPickable = true;
        headHitbox.checkCollisions = true;
        bodyHitbox.checkCollisions = true;
        
        // Make hitboxes children of enemy transform so they follow movement
        headHitbox.parent = enemyTransform;
        bodyHitbox.parent = enemyTransform;
        
        // Position hitboxes relative to enemy model
        headHitbox.position.y = GameConfig.enemies.headHitbox.yPosition;
        bodyHitbox.position.y = GameConfig.enemies.bodyHitbox.yPosition;
        
        // Set initial hitbox visibility based on global setting
        headHitbox.isVisible = GameConfig.debug.showHitboxes;
        bodyHitbox.isVisible = GameConfig.debug.showHitboxes;
        
        // Store enemy in global map with hitbox references and merged configuration
        loadedEnemies[enemyId] = {
            id: enemyId,
            root: enemyRoot,
            transform: enemyTransform,
            skeleton: result.skeletons[0],
            state: "IDLE",
            stateStartTime: Date.now(),
            idleDuration: enemyConfig.idleDuration,
            currentPath: null,
            currentPathIndex: 0,
            moveSpeed: enemyConfig.moveSpeed,
            chaseSpeed: enemyConfig.chaseSpeed,
            rotationSpeed: enemyConfig.rotationSpeed,
            headHitbox: headHitbox,
            bodyHitbox: bodyHitbox,
            health: enemyConfig.health,
            detectionRange: enemyConfig.detectionRange,
            aggroTime: enemyConfig.aggroTime,
            searchDuration: enemyConfig.searchDuration,
            attackRange: enemyConfig.attackRange,
            dodgeFrequency: enemyConfig.dodgeFrequency,
            minDodgeDistance: enemyConfig.minDodgeDistance,
            maxDodgeDistance: enemyConfig.maxDodgeDistance,
            circleStrafing: enemyConfig.circleStrafing,
            minAttackDistance: enemyConfig.minAttackDistance,
            maxAttackDistance: enemyConfig.maxAttackDistance,
            attackModeDecisionTime: enemyConfig.attackModeDecisionTime,
            shootProbability: enemyConfig.shootProbability,
            attackShootProbability: enemyConfig.attackShootProbability,
            burstFireEnabled: enemyConfig.burstFireEnabled,
            burstShotCount: enemyConfig.burstShotCount,
            burstFireInterval: enemyConfig.burstFireInterval,
            animations: enemyAnimations, // Store per-enemy animations
            modelType: modelType, // Store the model type for animation selection
            currentAnim: null // Track current animation for this enemy
        };
        
        // Generate unique patrol path starting from spawn position
        const patrolPath = getUniquePatrolPath(position);
        loadedEnemies[enemyId].currentPath = patrolPath;
        
        // Create Yuka Vehicle for movement
        const vehicle = new YUKA.Vehicle();
        vehicle.position.set(position.x, 0, position.z);
        vehicle.maxSpeed = enemyConfig.moveSpeed;
        vehicle.maxForce = 50;
        vehicle.updateNeeded = true;
        loadedEnemies[enemyId].vehicle = vehicle;
        
        // Add vehicle to entity manager
        entityManager.add(vehicle);
        
        // Play initial idle animation
        playEnemyAnimation(enemyId, "Idle");
        
        // Create visualization for initial path
        createPathVisualization(enemyId, patrolPath);
        
        // Set up state transition observer and Yuka update
        const observer = scene.onBeforeRenderObservable.add(() => {
            // Don't update enemies if game is paused or game over
            if (window.gamePaused || window.gameOver) return;
            
            // Only run this code if the enemy still exists
            if (loadedEnemies[enemyId]) {
                const deltaTime = engine.getDeltaTime() / 1000;
                
                // Update Yuka entity manager only once
                if (!window.yukaUpdated) {
                    time.update();
                    entityManager.update(deltaTime);
                    window.yukaUpdated = true;
                }
                
                updateEnemyState(enemyId);
                
                // Add explicit call to syncEnemyWithYuka
                syncEnemyWithYuka(enemyId);
                
                // Update hitbox visibility whenever it changes
                if (loadedEnemies[enemyId].headHitbox) {
                    loadedEnemies[enemyId].headHitbox.isVisible = GameConfig.debug.showHitboxes;
                    loadedEnemies[enemyId].bodyHitbox.isVisible = GameConfig.debug.showHitboxes;
                }
            }
        });
        
        // Store the observer for cleanup when enemy is disposed
        loadedEnemies[enemyId].observer = observer;
        
        // Call the callback with the enemy data
        if (callback) {
            callback({
                id: enemyId,
                mesh: enemyRoot,
                skeleton: result.skeletons[0],
                headHitbox: headHitbox,
                bodyHitbox: bodyHitbox
            });
        }
        
        // Return the enemy ID for reference
        return enemyId;
    } catch (error) {
        console.error("Error loading enemy model:", error);
        return null;
    }
}

// Clear any rotation quaternions that might interfere with smooth rotation
function clearEnemyRotationQuaternions(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) return;
    
    // Clear root rotation quaternion
    if (enemy.root && enemy.root.rotationQuaternion) {
        enemy.root.rotationQuaternion = null;
    }
    
    // Clear transform rotation quaternion
    if (enemy.transform && enemy.transform.rotationQuaternion) {
        enemy.transform.rotationQuaternion = null;
    }
    
    // Clear rotation quaternions on child meshes
    if (enemy.root && enemy.root.getChildMeshes) {
        const childMeshes = enemy.root.getChildMeshes();
        childMeshes.forEach(mesh => {
            if (mesh.rotationQuaternion) {
                mesh.rotationQuaternion = null;
            }
        });
    }
}

// Get player position
function getPlayerPosition() {
    if (!playerMesh) {
        console.warn("Player mesh not set, using default position");
        return { x: 0, z: 0 };
    }
    return { x: playerMesh.position.x, z: playerMesh.position.z };
}

// Update enemy state based on time and conditions
function updateEnemyState(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) return;
    
    // Clear any rotation quaternions that might interfere with smooth rotation
    clearEnemyRotationQuaternions(enemyId);
    
    const currentTime = Date.now();
    const timeInState = currentTime - enemy.stateStartTime;
    
    // Check if player is within chase range
    const isPlayerInRange = checkPlayerInRange(enemyId, GameConfig.enemies.detectionRange);
    
    // Get distance to player
    const playerPos = getPlayerPosition();
    if (!playerPos) return;
    
    const dx = playerPos.x - enemy.transform.position.x;
    const dz = playerPos.z - enemy.transform.position.z;
    const distanceToPlayer = Math.sqrt(dx * dx + dz * dz);
    
    // Check if enemy is close enough to attack
    const isInAttackRange = distanceToPlayer <= GameConfig.enemies.attackRange;
    
    // Check if enemy is in aggro mode (was hit recently)
    const timeSinceLastHit = enemy.lastHitTime ? currentTime - enemy.lastHitTime : Infinity;
    const isInAggroMode = timeSinceLastHit < (enemy.aggroTime || GameConfig.enemies.aggroTime);
    
    // If in aggro mode, enemy will chase player even if out of normal detection range
    const shouldChasePlayer = isPlayerInRange || isInAggroMode;
    
    // Log aggro status occasionally
    if (isInAggroMode && Math.random() < 0.01) { // 1% chance per frame to log
        const remainingAggroTime = ((enemy.aggroTime || GameConfig.enemies.aggroTime) - timeSinceLastHit) / 1000;
        debugLog(`Enemy ${enemyId} is in aggro mode. Remaining time: ${remainingAggroTime.toFixed(1)} seconds`);
    }
    
    switch (enemy.state) {
        case "IDLE":
            if (shouldChasePlayer) {
                setEnemyState(enemyId, "CHASE");
            } else if (timeInState >= enemy.idleDuration) {
                setEnemyState(enemyId, "PATROL");
            }
            break;
        case "PATROL":
            if (shouldChasePlayer) {
                setEnemyState(enemyId, "CHASE");
            } else {
                updateEnemyPatrol(enemyId);
            }
            break;
        case "CHASE":
            if (!shouldChasePlayer) {
                setEnemyState(enemyId, "PATROL");
            } else if (isInAttackRange) {
                // Transition to attack mode when close enough
                setEnemyState(enemyId, "ATTACK");
            } else {
                updateEnemyChase(enemyId);
                
                // Occasionally shoot at player when in chase mode
                if (Math.random() < GameConfig.enemies.shootProbability) {
                    enemyShootAtPlayer(enemyId);
                }
            }
            break;
        case "ATTACK":
            if (!shouldChasePlayer) {
                setEnemyState(enemyId, "PATROL");
            } else if (distanceToPlayer > GameConfig.enemies.attackRange * 1.5) {
                // If player gets too far away, switch back to chase mode
                setEnemyState(enemyId, "CHASE");
            } else {
                // Update attack behavior
                updateEnemyAttack(enemyId);
                
                // Shoot more frequently in attack mode
                if (Math.random() < GameConfig.enemies.attackShootProbability) {
                    // Potentially use burst fire
                    if (GameConfig.enemies.burstFireEnabled && Math.random() < 0.3) {
                        // Start burst fire sequence
                        startBurstFire(enemyId);
                    } else {
                        enemyShootAtPlayer(enemyId);
                    }
                }
            }
            break;
        case "HIT_REACT":
            // Do nothing during hit reaction, it will transition back automatically via setTimeout
            break;
        case "DEATH":
            // Do nothing, enemy is dead
            break;
        default:
            debugLog(`Unknown enemy state: ${enemy.state}`, true);
            setEnemyState(enemyId, "PATROL");
    }
}

// Check if player is within range of the enemy
function checkPlayerInRange(enemyId, range) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !playerMesh) return false;
    
    const dx = enemy.transform.position.x - playerMesh.position.x;
    const dz = enemy.transform.position.z - playerMesh.position.z;
    const distanceToPlayer = Math.sqrt(dx * dx + dz * dz);
    
    return distanceToPlayer <= range;
}

// Update enemy patrol movement
function updateEnemyPatrol(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !enemy.currentPath || enemy.currentPath.length === 0) {
        console.warn(`[PATROL] Enemy ${enemyId} has no path or path is empty`);
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
        debugLog(`[PATROL] Generated new path for enemy ${enemyId} with ${newPath.length} waypoints`);
        return;
    }
    
    // Check if enemy is in aggro mode (was hit recently)
    const currentTime = Date.now();
    const timeSinceLastHit = enemy.lastHitTime ? currentTime - enemy.lastHitTime : Infinity;
    const isInAggroMode = timeSinceLastHit < (enemy.aggroTime || GameConfig.enemies.aggroTime);
    
    // If in aggro mode and searching, try to move towards the player's last known position
    if (isInAggroMode && enemy.isSearching) {
        // Log search status occasionally
        if (Math.random() < 0.01) { // 1% chance per frame to log
            const remainingAggroTime = ((enemy.aggroTime || GameConfig.enemies.aggroTime) - timeSinceLastHit) / 1000;
            debugLog(`Enemy ${enemyId} is searching for player. Remaining aggro time: ${remainingAggroTime.toFixed(1)} seconds`);
        }
        
        // Check if we should generate a path to the player's position
        if (!enemy.searchingForPlayer) {
            enemy.searchingForPlayer = true;
            
            // Get player position
            const playerPos = playerMesh ? { 
                x: playerMesh.position.x, 
                z: playerMesh.position.z 
            } : null;
            
            if (playerPos) {
                debugLog(`Enemy ${enemyId} is generating a search path towards player's position`);
                
                // Remove old path from existingPaths
                const oldPathIndex = existingPaths.indexOf(enemy.currentPath);
                if (oldPathIndex !== -1) {
                    existingPaths.splice(oldPathIndex, 1);
                }
                
                // Generate a path that leads towards the player's position
                const searchPath = generateSearchPath(
                    { x: enemy.transform.position.x, z: enemy.transform.position.z },
                    playerPos
                );
                
                enemy.currentPath = searchPath;
                enemy.currentPathIndex = 0;
                createPathVisualization(enemyId, searchPath);
                
                // After a while, stop searching and go back to normal patrol
                setTimeout(() => {
                    if (enemy && enemy.isSearching) {
                        debugLog(`Enemy ${enemyId} is giving up the search`);
                        enemy.isSearching = false;
                        enemy.searchingForPlayer = false;
                    }
                }, GameConfig.enemies.searchDuration);
            }
        }
    }
    
    // Update current waypoint visualization
    updateWaypointVisualization(enemyId);
    
    const currentWaypoint = enemy.currentPath[enemy.currentPathIndex];
    const vehicle = enemy.vehicle;
    
    // Calculate distance to current waypoint
    const dx = currentWaypoint.x - vehicle.position.x;
    const dz = currentWaypoint.z - vehicle.position.z;
    const distanceToWaypoint = Math.sqrt(dx * dx + dz * dz);
    
    // Log waypoint info occasionally
    if (Math.random() < 0.01) {
        debugLog(`[WAYPOINT] Enemy ${enemyId} at waypoint ${enemy.currentPathIndex}/${enemy.currentPath.length-1}, ` +
                   `distance: ${distanceToWaypoint.toFixed(2)}, ` +
                   `direction: (${dx.toFixed(2)}, ${dz.toFixed(2)})`);
    }
    
    // If we've reached the waypoint
    if (distanceToWaypoint < GameConfig.patrolPaths.waypointReachedThreshold) {
        debugLog(`[WAYPOINT] Enemy ${enemyId} reached waypoint ${enemy.currentPathIndex}`);
        enemy.currentPathIndex++;
        
        // If we've completed the path, generate a new one
        if (enemy.currentPathIndex >= enemy.currentPath.length) {
            debugLog(`[WAYPOINT] Enemy ${enemyId} completed path, generating new one`);
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
    }
    
    // Calculate normalized direction to waypoint
    const direction = new YUKA.Vector3(dx, 0, dz).normalize();
    
    // Update vehicle velocity towards waypoint
    vehicle.velocity.copy(direction).multiplyScalar(vehicle.maxSpeed);
    
    // Update vehicle position with smooth movement
    const deltaTime = engine.getDeltaTime() / 1000;
    const moveStep = vehicle.maxSpeed * deltaTime;
    
    // Store previous position for collision detection
    const previousPosition = {
        x: vehicle.position.x,
        z: vehicle.position.z
    };
    
    // Update vehicle position
    vehicle.position.x += direction.x * moveStep;
    vehicle.position.z += direction.z * moveStep;
    
    // Sync with Babylon mesh
    enemy.transform.position.x = vehicle.position.x;
    enemy.transform.position.z = vehicle.position.z;
    
    // Update rotation based on movement direction
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        // Add PI to the angle to rotate the model 180 degrees
        const targetAngle = Math.atan2(direction.x, direction.z) + Math.PI;
        const currentAngle = enemy.root.rotation.y;
        
        // Smooth rotation
        let angleDiff = targetAngle - currentAngle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Apply smooth rotation
        const newRotation = currentAngle + angleDiff * enemy.rotationSpeed;
        enemy.root.rotation.y = newRotation;
    }
    
    // Check for collisions
    if (checkEnemyCollisions(enemy)) {
        debugLog(`[COLLISION] Enemy ${enemyId} collision detected, restoring position`);
        // Restore previous position
        vehicle.position.x = previousPosition.x;
        vehicle.position.z = previousPosition.z;
        enemy.transform.position.x = previousPosition.x;
        enemy.transform.position.z = previousPosition.z;
        
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

// Update enemy chase movement
function updateEnemyChase(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) return;
    
    // Get player position
    const playerPosition = getPlayerPosition();
    
    // Calculate direction to player
    const dx = playerPosition.x - enemy.transform.position.x;
    const dz = playerPosition.z - enemy.transform.position.z;
    const distanceToPlayer = Math.sqrt(dx * dx + dz * dz);
    
    // Calculate normalized direction to player
    const direction = new YUKA.Vector3(dx, 0, dz).normalize();
    
    // Update vehicle velocity towards player
    enemy.vehicle.velocity.copy(direction).multiplyScalar(enemy.vehicle.maxSpeed * 1.5); // Move faster when chasing
    
    // Update vehicle position with smooth movement
    const deltaTime = engine.getDeltaTime() / 1000;
    const moveStep = enemy.vehicle.maxSpeed * 1.5 * deltaTime;
    
    // Store previous position for collision detection
    const previousPosition = {
        x: enemy.transform.position.x,
        z: enemy.transform.position.z
    };
    
    // Update vehicle position
    enemy.vehicle.position.x += direction.x * moveStep;
    enemy.vehicle.position.z += direction.z * moveStep;
    
    // Sync with Babylon mesh
    enemy.transform.position.x = enemy.vehicle.position.x;
    enemy.transform.position.z = enemy.vehicle.position.z;
    
    // Update rotation based on movement direction
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        // Add PI to the angle to rotate the model 180 degrees
        const targetAngle = Math.atan2(direction.x, direction.z) + Math.PI;
        const currentAngle = enemy.root.rotation.y;
        
        // Smooth rotation
        let angleDiff = targetAngle - currentAngle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Apply smooth rotation
        const newRotation = currentAngle + angleDiff * enemy.rotationSpeed;
        enemy.root.rotation.y = newRotation;
    }
    
    // Check for collisions
    if (checkEnemyCollisions(enemy)) {
        // Restore previous position
        enemy.vehicle.position.x = previousPosition.x;
        enemy.vehicle.position.z = previousPosition.z;
        enemy.transform.position.x = previousPosition.x;
        enemy.transform.position.z = previousPosition.z;
    }
    
    // If we've lost sight of the player, go back to patrol
    if (distanceToPlayer > enemy.detectionRadius * 1.5) {
        debugLog(`[CHASE] Enemy ${enemyId} lost sight of player, returning to patrol`);
        setEnemyState(enemyId, "PATROL");
        
        // Generate new path from current position
        const newPath = getUniquePatrolPath({ 
            x: enemy.transform.position.x, 
            z: enemy.transform.position.z 
        });
        
        // Remove old path from existingPaths if it exists
        if (enemy.currentPath) {
            const oldPathIndex = existingPaths.indexOf(enemy.currentPath);
            if (oldPathIndex !== -1) {
                existingPaths.splice(oldPathIndex, 1);
            }
        }
        
        enemy.currentPath = newPath;
        enemy.currentPathIndex = 0;
        createPathVisualization(enemyId, newPath);
    }
    
    // Ensure run animation is playing
    if (enemy.state !== "CHASE") {
        setEnemyState(enemyId, "CHASE");
    }
}

// Enemy shoots at player
function enemyShootAtPlayer(enemyId) {
    // Don't shoot if game is over or paused
    if (window.gameOver || window.gamePaused) return;
    
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !playerMesh) return;
    
    debugLog(`Enemy ${enemyId} shooting at player`);
    
    // Calculate direction to player
    const dx = playerMesh.position.x - enemy.transform.position.x;
    const dy = playerMesh.position.y - enemy.transform.position.y;
    const dz = playerMesh.position.z - enemy.transform.position.z;
    
    // Create projectile
    const projectileId = "enemyProjectile_" + Date.now();
    const projectile = BABYLON.MeshBuilder.CreateSphere(projectileId, { diameter: 0.2 }, scene);
    
    // Configure projectile for collision detection
    projectile.isPickable = true;
    projectile.checkCollisions = true;
    
    // Position projectile at enemy position + offset
    projectile.position = new BABYLON.Vector3(
        enemy.transform.position.x,
        enemy.transform.position.y + 1.5, // Adjust height to match enemy's "gun" position
        enemy.transform.position.z
    );
    
    // Apply material to projectile
    const projectileMaterial = new BABYLON.StandardMaterial("projectileMaterial_" + projectileId, scene);
    projectileMaterial.emissiveColor = new BABYLON.Color3(1, 0, 0); // Red for enemy projectiles
    projectileMaterial.disableLighting = true;
    projectile.material = projectileMaterial;
    
    // Calculate direction vector
    const direction = new BABYLON.Vector3(dx, dy, dz).normalize();
    
    // Create particle system for trail
    const particleSystem = new BABYLON.ParticleSystem("particles_" + projectileId, 100, scene);
    
    // Check if we have the flare texture
    let particleTexturePath = "/assets/textures/flare_new.png";
    
    particleSystem.particleTexture = new BABYLON.Texture(particleTexturePath, scene);
    particleSystem.emitter = projectile;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.05, -0.05, -0.05);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.05, 0.05, 0.05);
    
    // Particle colors (red for enemy)
    particleSystem.color1 = new BABYLON.Color4(1, 0.2, 0.2, 1.0);
    particleSystem.color2 = new BABYLON.Color4(1, 0, 0, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0.7, 0, 0, 0.0);
    
    // Particle sizes and lifetime
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.3;
    particleSystem.minLifeTime = 0.1;
    particleSystem.maxLifeTime = 0.3;
    
    // Emission rate and power
    particleSystem.emitRate = 100;
    particleSystem.direction1 = new BABYLON.Vector3(-0.5, -0.5, -0.5);
    particleSystem.direction2 = new BABYLON.Vector3(0.5, 0.5, 0.5);
    particleSystem.minEmitPower = 0.1;
    particleSystem.maxEmitPower = 0.3;
    particleSystem.updateSpeed = 0.01;
    
    // Set proper blending mode for transparent textures
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    
    // Add billboarding to ensure particles always face the camera
    particleSystem.billboardMode = BABYLON.ParticleSystem.BILLBOARDMODE_ALL;
    
    // Start the particle system
    particleSystem.start();
    
    // Store projectile data in the global projectiles array
    const projectileData = {
        id: projectileId,
        mesh: projectile,
        particleSystem: particleSystem,
        direction: direction,
        speed: 0.8, // Slightly slower than player projectiles
        createdTime: Date.now(),
        lifespan: 3000, // 3 seconds in ms
        isEnemyProjectile: true, // Flag to identify enemy projectiles
        gravity: 0 // No gravity for enemy projectiles to make them more accurate
    };
    
    // Add to global projectiles array
    if (window.projectiles) {
        window.projectiles.push(projectileData);
    } else {
        console.error("Global projectiles array not found");
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
    // Don't play animations if game is over
    if (window.gameOver) return;
    
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error(`Enemy ${enemyId} not found in loadedEnemies!`);
        return;
    }
    
    const modelType = enemy.modelType || "Character_Enemy";
    console.log(`[ANIMATION] Attempting to play animation for enemy ${enemyId} (${modelType}): "${animationName}"`);
    
    // Use per-enemy animations
    const availableAnimations = enemy.animations;
    if (!availableAnimations || Object.keys(availableAnimations).length === 0) {
        console.warn(`No animations available for enemy ${enemyId}`);
        return;
    }
    
    // Log all available animations to help diagnose issues
    console.log(`[ANIMATION] Available animations for ${modelType} (${enemyId}):`);
    Object.keys(availableAnimations).forEach(key => {
        console.log(`  - ${key}`);
    });
    
    // Special case for death animation - make sure we only play it once
    if (animationName.toLowerCase() === "death" && enemy._deathAnimationPlayed) {
        console.log(`Death animation already played for enemy ${enemyId}, skipping`);
        return;
    }
    
    // Special case for hit reaction - directly try to find the HitReact animation
    if (enemy.state === "HIT_REACT") {
        console.log(`Enemy ${enemyId} is in HIT_REACT state, looking for hit reaction animation`);
        
        // Try to find a hit reaction animation
        const hitAnimationVariants = [
            "HitReact", "Hit", "TakeHit", "Damage", "Hurt",
            "CharacterArmature|HitReact", "CharacterArmature|Hit", 
            "CharacterArmature|TakeHit", "CharacterArmature|Damage", 
            "CharacterArmature|Hurt"
        ];
        
        // Check if any hit animation exists
        for (const variant of hitAnimationVariants) {
            if (availableAnimations[variant]) {
                console.log(`Found hit reaction animation: "${variant}"`);
                animationName = variant;
                break;
            }
            
            // Try partial match
            const matchingKey = Object.keys(availableAnimations).find(key => 
                key.toLowerCase().includes(variant.toLowerCase()));
            if (matchingKey) {
                console.log(`Found partial hit reaction animation match: "${matchingKey}"`);
                animationName = matchingKey;
                break;
            }
        }
    }
    
    let animation = null;
    
    // First, check if any animation key contains "/walk", "/idle", or "/run"
    // This handles "armature/walk" style animation names the user mentioned
    const slashVariants = ["/walk", "/run", "/idle", "/death"];
    if (animationName.toLowerCase() === "walk" || animationName.toLowerCase() === "run" || 
        animationName.toLowerCase() === "idle" || animationName.toLowerCase() === "death") {
        for (const variant of slashVariants) {
            if (variant.includes(animationName.toLowerCase())) {
                const slashKey = Object.keys(availableAnimations).find(key => 
                    key.toLowerCase().includes(variant));
                if (slashKey) {
                    animation = availableAnimations[slashKey];
                    console.log(`[ANIMATION] Found slash-style animation: "${slashKey}" for "${animationName}"`);
                    break;
                }
            }
        }
    }
    
    // If no animation found yet, try extensive animation name variants
    if (!animation) {
        // Create a more extensive list of animation name variants based on model type
        const animationVariants = [];
        
        // Add original animation name
        animationVariants.push(animationName);
        
        // Add armature variants (with and without capitalization)
        animationVariants.push(`armature/${animationName.toLowerCase()}`);
        animationVariants.push(`Armature/${animationName.toLowerCase()}`);
        animationVariants.push(`armature/${animationName}`);
        animationVariants.push(`Armature/${animationName}`);
        
        // Add model-specific variants
        animationVariants.push(`${modelType}|${animationName}`);
        animationVariants.push(`${animationName}_${modelType}`);
        
        // Add standard variants
        animationVariants.push("CharacterArmature|" + animationName);
        animationVariants.push(animationName.toLowerCase());
        animationVariants.push("CharacterArmature|" + animationName.toLowerCase());
        
        // Add common animation name variations
        if (animationName.toLowerCase() === "walk") {
            animationVariants.push("Walk_Shoot");
            animationVariants.push("Walking");
            animationVariants.push("walk");
            animationVariants.push("walkcycle");
            animationVariants.push("WalkCycle");
            animationVariants.push("Walk Cycle");
        } else if (animationName.toLowerCase() === "run") {
            animationVariants.push("Run_Shoot");
            animationVariants.push("Run_Gun");
            animationVariants.push("Running");
            animationVariants.push("run");
            animationVariants.push("runcycle");
            animationVariants.push("RunCycle");
            animationVariants.push("Run Cycle");
        } else if (animationName.toLowerCase() === "idle") {
            animationVariants.push("Idle_Shoot");
            animationVariants.push("Standing");
            animationVariants.push("idle");
            animationVariants.push("stand");
            animationVariants.push("Stand");
        } else if (animationName.toLowerCase() === "death") {
            animationVariants.push("Die");
            animationVariants.push("Dead");
            animationVariants.push("death");
            animationVariants.push("dying");
            animationVariants.push("Dying");
        }
        
        console.log(`[ANIMATION] Trying animation variants for ${animationName}: ${animationVariants.join(', ')}`);
        
        // Try all animation name variants
        for (const variant of animationVariants) {
            // Try exact match
            if (availableAnimations[variant]) {
                animation = availableAnimations[variant];
                console.log(`[ANIMATION] Found exact animation match: "${variant}"`);
                break;
            }
            
            // Try partial match - this helps with prefix/suffix variations
            const matchingKey = Object.keys(availableAnimations).find(key => 
                key.toLowerCase().includes(variant.toLowerCase()));
            if (matchingKey) {
                animation = availableAnimations[matchingKey];
                console.log(`[ANIMATION] Found partial animation match: "${matchingKey}" for "${variant}"`);
                break;
            }
        }
    }
    
    // If still no animation found, try a generic approach by simple string matching
    if (!animation) {
        console.log(`[ANIMATION] No specific match found, trying generic category matching`);
        const lowerAnimName = animationName.toLowerCase();
        
        if (lowerAnimName.includes("walk")) {
            // Look for any walking-related animation
            const walkKey = Object.keys(availableAnimations).find(key => 
                key.toLowerCase().includes("walk") || 
                key.toLowerCase().includes("run") ||
                key.toLowerCase().includes("move"));
                
            if (walkKey) {
                animation = availableAnimations[walkKey];
                console.log(`[ANIMATION] Found walking animation by category: "${walkKey}"`);
            }
        } else if (lowerAnimName.includes("idle")) {
            // Look for any idle/standing animation
            const idleKey = Object.keys(availableAnimations).find(key => 
                key.toLowerCase().includes("idle") || 
                key.toLowerCase().includes("stand"));
                
            if (idleKey) {
                animation = availableAnimations[idleKey];
                console.log(`[ANIMATION] Found idle animation by category: "${idleKey}"`);
            }
        } else if (lowerAnimName.includes("death") || lowerAnimName.includes("die")) {
            // Look for any death animation
            const deathKey = Object.keys(availableAnimations).find(key => 
                key.toLowerCase().includes("death") || 
                key.toLowerCase().includes("die") ||
                key.toLowerCase().includes("dead"));
                
            if (deathKey) {
                animation = availableAnimations[deathKey];
                console.log(`[ANIMATION] Found death animation by category: "${deathKey}"`);
            }
        }
    }
    
    // Last resort - just pick any animation
    if (!animation && Object.keys(availableAnimations).length > 0) {
        // Just use any animation as a fallback
        const firstKey = Object.keys(availableAnimations)[0];
        animation = availableAnimations[firstKey];
        console.log(`[ANIMATION] Using fallback animation: "${firstKey}" as no match found for "${animationName}"`);
    }
    
    if (animation) {
        // Stop this enemy's current animation if it exists
        if (enemy.currentAnim && enemy.currentAnim.isPlaying) {
            enemy.currentAnim.stop();
        }
        
        // Start the requested animation
        animation.start(true);
        enemy.currentAnim = animation; // Store the current animation in the enemy object
        console.log(`[ANIMATION] Successfully playing animation: "${animation.name}" for enemy ${enemyId} (${modelType})`);
        
        // Mark death animation as played if this is a death animation
        if (animationName.toLowerCase() === "death") {
            enemy._deathAnimationPlayed = true;
        }
    } else {
        console.warn(`[ANIMATION ERROR] No animation found or available for "${animationName}" on enemy ${enemyId} (${modelType})`);
    }
}

// Function to list all available animations
function listAvailableAnimations(animations) {
    if (!animations) {
        console.warn("No animations available to list");
        return;
    }
    
    debugLog(`Found ${Object.keys(animations).length} animations:`);
    Object.keys(animations).forEach((key, index) => {
        debugLog(`${index + 1}. "${key}"`);
    });
    debugLog("=======================================");
}

// Make the function globally accessible
window.listAvailableAnimations = listAvailableAnimations;

// Set enemy state and play corresponding animation
function setEnemyState(enemyId, state) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error("Enemy not found for ID:", enemyId);
        return;
    }
    
    // If already in DEATH state, don't change state again
    if (enemy.state === "DEATH" && state === "DEATH") {
        debugLog(`Enemy ${enemyId} is already in DEATH state, ignoring state change`);
        return;
    }
    
    // Check if enemy is in aggro mode (was hit recently)
    const currentTime = Date.now();
    const timeSinceLastHit = enemy.lastHitTime ? currentTime - enemy.lastHitTime : Infinity;
    const isInAggroMode = timeSinceLastHit < (enemy.aggroTime || 10000); // Default to 10 seconds if not set
    
    // If transitioning from CHASE to PATROL but still in aggro mode, keep in CHASE state
    if (enemy.state === "CHASE" && state === "PATROL" && isInAggroMode) {
        debugLog(`Enemy ${enemyId} is still in aggro mode, staying in CHASE state`);
        
        // Check if player is in sight to determine if we should continue chasing
        if (isPlayerInSight(enemyId)) {
            debugLog(`Enemy ${enemyId} can see player, continuing chase`);
            return; // Stay in CHASE state
        } else {
            debugLog(`Enemy ${enemyId} lost sight of player, but will continue searching`);
            // We'll continue to PATROL state but with a special flag to indicate we're still searching
            enemy.isSearching = true;
        }
    }
    
    debugLog(`Setting enemy ${enemyId} state from ${enemy.state} to ${state}`);
    
    // Special case: When transitioning from CHASE to PATROL, always create a new path
    if (enemy.state === "CHASE" && state === "PATROL") {
        debugLog(`Enemy ${enemyId} stopped chasing, creating new patrol path from current position`);
        
        // Remove old path from existingPaths if it exists
        const oldPathIndex = existingPaths.indexOf(enemy.currentPath);
        if (oldPathIndex !== -1) {
            existingPaths.splice(oldPathIndex, 1);
        }
        
        // Generate new path from current position
        enemy.currentPath = getUniquePatrolPath({ 
            x: enemy.transform.position.x, 
            z: enemy.transform.position.z 
        });
        enemy.currentPathIndex = 0;
        
        // Create visualization for new path
        createPathVisualization(enemyId, enemy.currentPath);
    }
    
    enemy.state = state;
    enemy.stateStartTime = Date.now();
    
    // If entering patrol state and no path exists, generate one
    if (state === "PATROL" && (!enemy.currentPath || enemy.currentPath.length === 0)) {
        enemy.currentPath = getUniquePatrolPath({ 
            x: enemy.transform.position.x, 
            z: enemy.transform.position.z 
        });
        enemy.currentPathIndex = 0;
        debugLog("New patrol path generated:", enemy.currentPath);
        
        // Create visualization for new path
        createPathVisualization(enemyId, enemy.currentPath);
    }
    
    // Get animation name from character config
    const modelType = enemy.modelType || "Character_Enemy";
    const configAnimation = CharacterEnemyConfig.getAnimationForMode(state, modelType);
    // Remove the "CharacterArmature|" prefix if it exists
    const animationName = configAnimation.replace("CharacterArmature|", "");
    
    console.log(`Playing animation for state ${state} for ${modelType}: ${animationName}`);
    
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
    console.log(`Disposing enemy ${enemyId}`);
    
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.warn(`Enemy ${enemyId} not found for disposal`);
        return;
    }
    
    // Remove observer
    if (enemy.observer) {
        scene.onBeforeRenderObservable.remove(enemy.observer);
    }
    
    // Remove from entity manager
    if (enemy.vehicle) {
        entityManager.remove(enemy.vehicle);
    }
    
    // Dispose hitboxes
    if (enemy.headHitbox) {
        enemy.headHitbox.dispose();
    }
    
    if (enemy.bodyHitbox) {
        enemy.bodyHitbox.dispose();
    }
    
    // Dispose main mesh
    if (enemy.root) {
        enemy.root.dispose();
    }
    
    // Remove enemy's path from existingPaths
    if (enemy.currentPath) {
        const pathIndex = existingPaths.indexOf(enemy.currentPath);
        if (pathIndex !== -1) {
            existingPaths.splice(pathIndex, 1);
            console.log(`Removed path from existingPaths. Remaining paths: ${existingPaths.length}`);
        }
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

    // Check global settings
    const showLines = GameConfig.debug.showPathLines;
    const showPoints = GameConfig.debug.showWaypoints;
    
    // Create points array for the path
    const points = path.map(waypoint => new BABYLON.Vector3(waypoint.x, 1, waypoint.z));
    
    // Create lines
    const lines = BABYLON.MeshBuilder.CreateLines("path_" + enemyId, {
        points: points,
        updatable: true
    }, scene);
    lines.color = new BABYLON.Color3(1, 0, 0); // Red color for path
    lines.isVisible = showLines; // Set visibility based on global setting
    
    // Create spheres for waypoints
    const waypointSpheres = path.map((waypoint, index) => {
        const sphere = BABYLON.MeshBuilder.CreateSphere("waypoint_" + enemyId + "_" + index, {
            diameter: 0.5
        }, scene);
        sphere.position = new BABYLON.Vector3(waypoint.x, 1, waypoint.z);
        sphere.material = new BABYLON.StandardMaterial("waypointMat_" + enemyId + "_" + index, scene);
        sphere.material.diffuseColor = new BABYLON.Color3(0, 1, 0); // Green color for waypoints
        sphere.material.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
        sphere.isVisible = showPoints; // Set visibility based on global setting
        return sphere;
    });
    
    // Store visualization objects
    pathVisualization[enemyId] = {
        lines: lines,
        points: waypointSpheres
    };
    
    debugLog(`[PATH] Created path visualization for enemy ${enemyId} with ${path.length} waypoints. Visibility: ${showPoints}`);
}

// Add this function to update current waypoint visualization
function updateWaypointVisualization(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !pathVisualization[enemyId]) return;
    
    // Check if waypoints are visible
    const showPoints = GameConfig.debug.showWaypoints;
    
    // Update waypoint colors and visibility
    pathVisualization[enemyId].points.forEach((sphere, index) => {
        // Update visibility first
        sphere.isVisible = showPoints;
        
        // Only update colors if visible
        if (showPoints) {
        const material = sphere.material;
            // Check if highlighting is enabled
            const shouldHighlight = GameConfig.debug.highlightCurrentWaypoint;
            
        if (index === enemy.currentPathIndex && shouldHighlight) {
            material.diffuseColor = new BABYLON.Color3(1, 1, 0); // Yellow for current waypoint
            material.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0);
            // Make current waypoint slightly larger
            sphere.scaling = new BABYLON.Vector3(1.3, 1.3, 1.3);
        } else {
            material.diffuseColor = new BABYLON.Color3(0, 1, 0); // Green for other waypoints
            material.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
            // Reset scaling for non-current waypoints
            sphere.scaling = new BABYLON.Vector3(1, 1, 1);
            }
        }
    });
    
    // Update path line visibility
    if (pathVisualization[enemyId].lines) {
        const showLines = GameConfig.debug.showPathLines;
        pathVisualization[enemyId].lines.isVisible = showLines;
    }
}

// Sync enemy with YUKA vehicle
function syncEnemyWithYuka(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !enemy.vehicle) return;

    // Update position
    enemy.transform.position.x = enemy.vehicle.position.x;
    enemy.transform.position.z = enemy.vehicle.position.z;

    // Update rotation based on velocity
    if (enemy.vehicle.velocity.length() > 0.01) {
        // Add PI to the angle to rotate the model 180 degrees
        const targetAngle = Math.atan2(enemy.vehicle.velocity.x, enemy.vehicle.velocity.z) + Math.PI;
        const currentAngle = enemy.root.rotation.y;
        
        // Smooth rotation
        let angleDiff = targetAngle - currentAngle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Apply smooth rotation
        const newRotation = currentAngle + angleDiff * enemy.rotationSpeed;
        enemy.root.rotation.y = newRotation;
    }
}

// Function to handle enemy hit reaction
function handleEnemyHit(enemyId, damage, hitDirection) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error(`Enemy ${enemyId} not found in loadedEnemies!`);
        return;
    }
    
    // If enemy is already dead, don't process the hit
    if (enemy.state === "DEATH") {
        debugLog(`Enemy ${enemyId} is already dead, ignoring hit`);
        return;
    }
    
    debugLog(`Enemy ${enemyId} hit for ${damage} damage at position: x=${enemy.transform.position.x.toFixed(2)}, y=${enemy.transform.position.y.toFixed(2)}, z=${enemy.transform.position.z.toFixed(2)}`);
    
    // Set the last hit time to make the enemy chase the player
    enemy.lastHitTime = Date.now();
    enemy.aggroTime = GameConfig.enemies.aggroTime;
    debugLog(`Enemy ${enemyId} will chase player for ${GameConfig.enemies.aggroTime/1000} seconds after being hit`);
    
    // Reduce enemy health
    if (!enemy.health) enemy.health = GameConfig.enemies.health; // Initialize health if not set
    enemy.health -= damage;
    debugLog(`Enemy ${enemyId} health reduced to ${enemy.health}`);
    
    // Check if enemy should die
    if (enemy.health <= 0) {
        debugLog(`Enemy ${enemyId} has died!`);
        
        // Set a flag to indicate this enemy is being processed for death
        // This prevents multiple death animations from being triggered
        enemy._deathProcessing = true;
        
        // Set enemy state to DEATH
        setEnemyState(enemyId, "DEATH");
        
        // Create death effect immediately
        if (window.createDeathEffect) {
            window.createDeathEffect(enemy.transform.position.clone());
        }
        
        // Fixed duration for death animation
        const deathAnimDuration = GameConfig.enemies.deathAnimDuration;
        
        // Remove enemy after the death animation finishes
        setTimeout(() => {
            // Check if enemy still exists (might have been disposed already)
            if (loadedEnemies[enemyId]) {
                disposeEnemy(enemyId);
                
                // Notify player_main.js that the enemy died (for respawn logic)
                if (window.handleEnemyDeath) {
                    window.handleEnemyDeath(enemyId);
                }
            }
        }, deathAnimDuration);
        
        return;
    }
    
    // Set enemy to hit react state
    setEnemyState(enemyId, "HIT_REACT");
    
    // Log available animations to help debug hit reaction
    debugLog("Available animations for hit reaction check:");
    Object.keys(enemy.animations).forEach(key => {
        debugLog(`- ${key}`);
    });
    
    // Push enemy back in the direction of the hit
    if (hitDirection) {
        debugLog(`Hit direction: x=${hitDirection.x.toFixed(2)}, y=${hitDirection.y.toFixed(2)}, z=${hitDirection.z.toFixed(2)}`);
        
        // Normalize direction and scale for push back distance
        const pushDistance = 0.5; // Push back distance in units
        const normalizedDirection = hitDirection.normalize();
        
        // Store previous position in case of collision
        const previousPosition = {
            x: enemy.transform.position.x,
            z: enemy.transform.position.z
        };
        
        // Apply push back
        enemy.transform.position.x += normalizedDirection.x * pushDistance;
        enemy.transform.position.z += normalizedDirection.z * pushDistance;
        
        // Update vehicle position to match
        enemy.vehicle.position.x = enemy.transform.position.x;
        enemy.vehicle.position.z = enemy.transform.position.z;
        
        // Check for collisions and restore position if needed
        if (checkEnemyCollisions(enemy)) {
            enemy.transform.position.x = previousPosition.x;
            enemy.transform.position.z = previousPosition.z;
            enemy.vehicle.position.x = previousPosition.x;
            enemy.vehicle.position.z = previousPosition.z;
        }
    }
    
    // Create damage indicator
    createDamageIndicator(enemy.transform.position, damage);
    
    // Return to previous state after hit reaction duration
    setTimeout(() => {
        // Only change state if still in HIT_REACT (might have died or changed state otherwise)
        if (enemy && enemy.state === "HIT_REACT") {
            // Return to patrol or chase state based on player proximity
            const isPlayerInRange = checkPlayerInRange(enemyId, GameConfig.enemies.detectionRange);
            setEnemyState(enemyId, isPlayerInRange ? "CHASE" : "PATROL");
        }
    }, GameConfig.enemies.hitReactionDuration);
}

// Make handleEnemyHit function globally accessible
window.handleEnemyHit = handleEnemyHit;

// Debug function to visualize enemy orientation and movement
function debugEnemyMovement(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) return;
    
    // Create or update debug elements
    if (!enemy.debugElements) {
        // Create debug container
        const debugContainer = document.createElement('div');
        debugContainer.id = `enemy-debug-${enemyId}`;
        debugContainer.style.position = 'absolute';
        debugContainer.style.top = '10px';
        debugContainer.style.left = '10px';
        debugContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        debugContainer.style.color = 'white';
        debugContainer.style.padding = '10px';
        debugContainer.style.fontFamily = 'monospace';
        debugContainer.style.fontSize = '12px';
        debugContainer.style.zIndex = '1000';
        debugContainer.style.maxWidth = '400px';
        debugContainer.style.maxHeight = '300px';
        debugContainer.style.overflow = 'auto';
        document.body.appendChild(debugContainer);
        
        // Create debug arrow for direction visualization
        const directionArrow = BABYLON.MeshBuilder.CreateCylinder(`direction-arrow-${enemyId}`, {
            height: 3,
            diameterTop: 0,
            diameterBottom: 0.5
        }, scene);
        directionArrow.material = new BABYLON.StandardMaterial(`direction-arrow-mat-${enemyId}`, scene);
        directionArrow.material.diffuseColor = new BABYLON.Color3(1, 0, 0);
        directionArrow.material.emissiveColor = new BABYLON.Color3(0.5, 0, 0);
        directionArrow.parent = enemy.transform;
        directionArrow.position.y = 2; // Position above enemy
        directionArrow.rotation.x = Math.PI/2; // Point forward
        
        // Create velocity vector visualization
        const velocityArrow = BABYLON.MeshBuilder.CreateCylinder(`velocity-arrow-${enemyId}`, {
            height: 3,
            diameterTop: 0,
            diameterBottom: 0.5
        }, scene);
        velocityArrow.material = new BABYLON.StandardMaterial(`velocity-arrow-mat-${enemyId}`, scene);
        velocityArrow.material.diffuseColor = new BABYLON.Color3(0, 1, 0);
        velocityArrow.material.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
        velocityArrow.parent = enemy.transform;
        velocityArrow.position.y = 2; // Position above enemy
        
        // Store debug elements
        enemy.debugElements = {
            container: debugContainer,
            directionArrow: directionArrow,
            velocityArrow: velocityArrow,
            lastUpdate: Date.now()
        };
    }
    
    // Only update every 100ms to avoid performance issues
    const now = Date.now();
    if (now - enemy.debugElements.lastUpdate < 100) return;
    enemy.debugElements.lastUpdate = now;
    
    // Get current waypoint if in patrol mode
    let waypointInfo = "No waypoint";
    if (enemy.state === "PATROL" && enemy.currentPath && enemy.currentPath.length > 0) {
        const currentWaypoint = enemy.currentPath[enemy.currentPathIndex];
        const dx = currentWaypoint.x - enemy.transform.position.x;
        const dz = currentWaypoint.z - enemy.transform.position.z;
        const distanceToWaypoint = Math.sqrt(dx * dx + dz * dz);
        const waypointAngle = Math.atan2(dx, dz);
        waypointInfo = `Waypoint ${enemy.currentPathIndex}/${enemy.currentPath.length-1}: ` +
                      `x=${currentWaypoint.x.toFixed(2)}, z=${currentWaypoint.z.toFixed(2)}, ` +
                      `distance=${distanceToWaypoint.toFixed(2)}, angle=${waypointAngle.toFixed(2)}`;
    }
    
    // Update velocity arrow direction
    if (enemy.vehicle && enemy.vehicle.velocity.length() > 0.01) {
        const velocityAngle = Math.atan2(enemy.vehicle.velocity.x, enemy.vehicle.velocity.z);
        enemy.debugElements.velocityArrow.rotation.y = velocityAngle;
        enemy.debugElements.velocityArrow.scaling.y = enemy.vehicle.velocity.length() * 0.5; // Scale by velocity magnitude
    } else {
        enemy.debugElements.velocityArrow.scaling.y = 0.1; // Minimum size when not moving
    }
    
    // Update debug info
    const debugInfo = `
        <h3>Enemy ${enemyId} Debug</h3>
        <p>State: ${enemy.state}</p>
        <p>Position: x=${enemy.transform.position.x.toFixed(2)}, z=${enemy.transform.position.z.toFixed(2)}</p>
        <p>Rotation: y=${enemy.root.rotation.y.toFixed(2)} rad (${(enemy.root.rotation.y * 180 / Math.PI).toFixed(2)}°)</p>
        <p>Velocity: x=${enemy.vehicle?.velocity.x.toFixed(2) || 0}, z=${enemy.vehicle?.velocity.z.toFixed(2) || 0}, 
           magnitude=${enemy.vehicle?.velocity.length().toFixed(2) || 0}</p>
        <p>Velocity Angle: ${Math.atan2(enemy.vehicle?.velocity.x || 0, enemy.vehicle?.velocity.z || 0).toFixed(2)} rad</p>
        <p>${waypointInfo}</p>
        <p>Movement Speed: ${enemy.vehicle?.maxSpeed.toFixed(2) || 0}</p>
        <p>Rotation Speed: ${enemy.rotationSpeed.toFixed(2)}</p>
    `;
    
    enemy.debugElements.container.innerHTML = debugInfo;
    
    // Log to console occasionally
    if (Math.random() < 0.05) { // ~5% chance each update
        debugLog(`[DEBUG] Enemy ${enemyId} - State: ${enemy.state}, ` +
                   `Position: (${enemy.transform.position.x.toFixed(2)}, ${enemy.transform.position.z.toFixed(2)}), ` +
                   `Rotation: ${enemy.root.rotation.y.toFixed(2)}, ` +
                   `Velocity: (${enemy.vehicle?.velocity.x.toFixed(2) || 0}, ${enemy.vehicle?.velocity.z.toFixed(2) || 0})`);
    }
}

// Add debug toggle function
function toggleEnemyDebug(show = true) {
    window.showEnemyDebug = show;
    
    // Update all enemies
    for (const enemyId in loadedEnemies) {
        const enemy = loadedEnemies[enemyId];
        
        if (enemy.debugElements) {
            // Show/hide debug elements
            enemy.debugElements.container.style.display = show ? 'block' : 'none';
            enemy.debugElements.directionArrow.isVisible = show;
            enemy.debugElements.velocityArrow.isVisible = show;
        } else if (show) {
            // Create debug elements if they don't exist
            debugEnemyMovement(enemyId);
        }
    }
}

// Make debug functions globally accessible
window.debugEnemyMovement = debugEnemyMovement;
window.toggleEnemyDebug = toggleEnemyDebug;

// Initialize debug mode with console message
debugLog("Enemy debug functions available. Type 'toggleEnemyDebug(true)' in console to enable debug visualization.");
debugLog("Available debug commands:");
debugLog("- toggleEnemyDebug(true/false) - Enable/disable debug visualization");
debugLog("- debugEnemyMovement('enemy_id') - Debug specific enemy");

// Modify updateEnemyState to include debug calls
const originalUpdateEnemyState = updateEnemyState;
updateEnemyState = function(enemyId) {
    // Call original function
    originalUpdateEnemyState(enemyId);
    
    // Add debug visualization if enabled
    if (window.showEnemyDebug) {
        debugEnemyMovement(enemyId);
    }
};

// Add debug code to updateEnemyPatrol
const originalUpdateEnemyPatrol = updateEnemyPatrol;
updateEnemyPatrol = function(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (enemy && window.showEnemyDebug) {
        // Log before update
        debugLog(`[PATROL-PRE] Enemy ${enemyId} - ` +
                   `Position: (${enemy.transform.position.x.toFixed(2)}, ${enemy.transform.position.z.toFixed(2)}), ` +
                   `Rotation: ${enemy.root.rotation.y.toFixed(2)}, ` +
                   `Waypoint: ${enemy.currentPathIndex}/${enemy.currentPath?.length || 0}`);
    }
    
    // Call original function
    originalUpdateEnemyPatrol(enemyId);
    
    if (enemy && window.showEnemyDebug) {
        // Log after update
        debugLog(`[PATROL-POST] Enemy ${enemyId} - ` +
                   `Position: (${enemy.transform.position.x.toFixed(2)}, ${enemy.transform.position.z.toFixed(2)}), ` +
                   `Rotation: ${enemy.root.rotation.y.toFixed(2)}, ` +
                   `Waypoint: ${enemy.currentPathIndex}/${enemy.currentPath?.length || 0}`);
    }
};

// Add function to check enemy rotation
function checkEnemyRotation(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) return;
    
    // Get current waypoint if in patrol mode
    if (enemy.state === "PATROL" && enemy.currentPath && enemy.currentPath.length > 0) {
        const currentWaypoint = enemy.currentPath[enemy.currentPathIndex];
        
        // Calculate direction to waypoint
        const dx = currentWaypoint.x - enemy.transform.position.x;
        const dz = currentWaypoint.z - enemy.transform.position.z;
        
        // Calculate target angle
        const targetAngle = Math.atan2(dx, dz) + Math.PI;
        
        // Get current rotation
        const currentAngle = enemy.root.rotation.y;
        
        // Calculate angle difference
        let angleDiff = targetAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Log rotation info
        debugLog(`[ROTATION CHECK] Enemy ${enemyId} - ` +
                   `Waypoint: (${currentWaypoint.x.toFixed(2)}, ${currentWaypoint.z.toFixed(2)}), ` +
                   `Position: (${enemy.transform.position.x.toFixed(2)}, ${enemy.transform.position.z.toFixed(2)}), ` +
                   `Direction: (${dx.toFixed(2)}, ${dz.toFixed(2)}), ` +
                   `Target angle: ${targetAngle.toFixed(2)} rad (${(targetAngle * 180 / Math.PI).toFixed(2)}°), ` +
                   `Current angle: ${currentAngle.toFixed(2)} rad (${(currentAngle * 180 / Math.PI).toFixed(2)}°), ` +
                   `Difference: ${angleDiff.toFixed(2)} rad (${(angleDiff * 180 / Math.PI).toFixed(2)}°)`);
        
        // Force set rotation if difference is too large
        if (Math.abs(angleDiff) > 0.5) {
            debugLog(`[ROTATION FIX] Enemy ${enemyId} - Forcing rotation to target angle`);
            enemy.root.rotation.y = targetAngle;
        }
    }
}

// Make the function globally accessible
window.checkEnemyRotation = checkEnemyRotation;

// Add periodic rotation check to updateEnemyPatrol
const originalUpdateEnemyPatrol2 = updateEnemyPatrol;
updateEnemyPatrol = function(enemyId) {
    // Call original function
    originalUpdateEnemyPatrol2(enemyId);
    
    // Periodically check rotation
    if (Math.random() < 0.05) { // ~5% chance each update
        checkEnemyRotation(enemyId);
    }
};

// Force enemy to face current waypoint
function forceEnemyFaceWaypoint(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !enemy.currentPath || enemy.currentPathIndex >= enemy.currentPath.length) return;
    
    const currentWaypoint = enemy.currentPath[enemy.currentPathIndex];
    
    // Calculate direction to waypoint
    const dx = currentWaypoint.x - enemy.transform.position.x;
    const dz = currentWaypoint.z - enemy.transform.position.z;
    
    // Only update rotation if we have a significant direction
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        // Add PI to the angle to rotate the model 180 degrees
        const targetAngle = Math.atan2(dx, dz) + Math.PI;
        const currentAngle = enemy.root.rotation.y;
        
        // Smooth rotation
        let angleDiff = targetAngle - currentAngle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Apply smooth rotation
        const newRotation = currentAngle + angleDiff * enemy.rotationSpeed;
        enemy.root.rotation.y = newRotation;
    }
}

// Make the function globally accessible
window.forceEnemyFaceWaypoint = forceEnemyFaceWaypoint;

// Add function to toggle path visualization
function togglePathVisualization(show) {
    debugLog(`[PATH] Toggling path visualization: ${show}`);
    GameConfig.debug.showWaypoints = show;
    GameConfig.debug.showPathLines = show;
    
    // Update all existing path visualizations
    for (const enemyId in pathVisualization) {
        if (pathVisualization[enemyId]) {
            // Toggle lines visibility
            if (pathVisualization[enemyId].lines) {
                pathVisualization[enemyId].lines.isVisible = show;
            }
            
            // Toggle points visibility
            if (pathVisualization[enemyId].points) {
                pathVisualization[enemyId].points.forEach(point => {
                    point.isVisible = show;
                });
            }
        }
    }
}

// Make the function globally accessible
window.togglePathVisualization = togglePathVisualization;

// Add function to directly manipulate model orientation
function setEnemyModelOrientation(enemyId, direction) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error("Enemy not found for ID:", enemyId);
        return;
    }
    
    // Normalize direction if provided
    const normalizedDirection = direction ? 
        new BABYLON.Vector3(direction.x, 0, direction.z).normalize() : 
        new BABYLON.Vector3(0, 0, 1);
    
    // Log all meshes in the enemy model to help identify the character's body parts
    if (!enemy._meshesLogged) {
        debugLog(`[MODEL] Logging all meshes for enemy ${enemyId}:`);
        if (enemy.root && enemy.root.getChildMeshes) {
            const childMeshes = enemy.root.getChildMeshes();
            childMeshes.forEach((mesh, index) => {
                debugLog(`[MODEL] Mesh ${index}: ${mesh.name}`);
            });
        }
        enemy._meshesLogged = true;
    }
    
    // Try to find the character's armature or main body part
    let characterBody = null;
    
    // First try to find by name patterns
    const bodyNamePatterns = [
        'Armature', 'Character', 'Body', 'Torso', 'Skeleton', 'Root'
    ];
    
    if (enemy.root && enemy.root.getChildMeshes) {
        const childMeshes = enemy.root.getChildMeshes();
        
        // Try to find by name patterns
        for (const pattern of bodyNamePatterns) {
            characterBody = childMeshes.find(mesh => 
                mesh.name.includes(pattern) || 
                (mesh.parent && mesh.parent.name.includes(pattern))
            );
            
            if (characterBody) break;
        }
        
        // If not found by name, try the first mesh with children
        if (!characterBody) {
            characterBody = childMeshes.find(mesh => 
                mesh.getChildMeshes && mesh.getChildMeshes().length > 0
            );
        }
        
        // If still not found, use the root mesh
        if (!characterBody) {
            characterBody = enemy.root;
        }
    } else {
        characterBody = enemy.root;
    }
    
    if (characterBody) {
        // Create a rotation quaternion from the direction
        const rotationQuaternion = BABYLON.Quaternion.FromLookDirectionLH(
            normalizedDirection,
            BABYLON.Vector3.Up()
        );
        
        // Apply the rotation to the character body
        if (!characterBody.rotationQuaternion) {
            characterBody.rotationQuaternion = rotationQuaternion;
        } else {
            characterBody.rotationQuaternion = rotationQuaternion;
        }
        
        debugLog(`[MODEL] Applied orientation to ${characterBody.name} for enemy ${enemyId}`);
        
        // Also apply to root for good measure
        if (!enemy.root.rotationQuaternion) {
            enemy.root.rotationQuaternion = rotationQuaternion;
        } else {
            enemy.root.rotationQuaternion = rotationQuaternion;
        }
    } else {
        console.warn(`[MODEL] Could not find character body for enemy ${enemyId}`);
    }
}

// Make the function globally accessible
window.setEnemyModelOrientation = setEnemyModelOrientation;

// Add function to directly manipulate the transform node
function rotateEnemyTransform(enemyId, direction) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !enemy.transform) {
        console.error(`Enemy ${enemyId} not found or has no transform node`);
        return;
    }
    
    // Normalize direction
    const normalizedDirection = new BABYLON.Vector3(direction.x, 0, direction.z).normalize();
    
    // Calculate angle from direction - add PI to make the model face the direction
    const angle = Math.atan2(normalizedDirection.x, normalizedDirection.z) + Math.PI;
    
    // Set transform rotation
    enemy.transform.rotation = new BABYLON.Vector3(0, angle, 0);
    
    // Log the rotation
    debugLog(`[TRANSFORM] Rotated enemy ${enemyId} transform to angle ${angle.toFixed(2)} rad (${(angle * 180 / Math.PI).toFixed(2)}°)`);
    
    return angle;
}

// Make the function globally accessible
window.rotateEnemyTransform = rotateEnemyTransform;

// Add function to rotate the model's skeleton
function rotateEnemySkeleton(enemyId, direction) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !enemy.skeleton) {
        console.error(`Enemy ${enemyId} not found or has no skeleton`);
        return;
    }
    
    // Normalize direction
    const normalizedDirection = new BABYLON.Vector3(direction.x, 0, direction.z).normalize();
    
    // Calculate angle from direction
    const angle = Math.atan2(normalizedDirection.x, normalizedDirection.z) + Math.PI;
    
    // Try to find the root bone of the skeleton
    const skeleton = enemy.skeleton;
    
    // Log all bones in the skeleton to help identify the root bone
    if (!enemy._bonesLogged) {
        debugLog(`[SKELETON] Logging all bones for enemy ${enemyId}:`);
        for (let i = 0; i < skeleton.bones.length; i++) {
            const bone = skeleton.bones[i];
            debugLog(`[SKELETON] Bone ${i}: ${bone.name}, parent: ${bone.getParent()?.name || 'none'}`);
        }
        enemy._bonesLogged = true;
    }
    
    // Try to find the root bone by name patterns
    const rootBonePatterns = [
        'Root', 'Armature', 'Character', 'Hips', 'Pelvis', 'Spine', 'Torso'
    ];
    
    let rootBone = null;
    
    // Try to find by name patterns
    for (const pattern of rootBonePatterns) {
        rootBone = skeleton.bones.find(bone => 
            bone.name.includes(pattern) && (!bone.getParent() || bone.getParent().name === '')
        );
        
        if (rootBone) break;
    }
    
    // If not found by name, try the first bone without a parent
    if (!rootBone) {
        rootBone = skeleton.bones.find(bone => !bone.getParent() || bone.getParent().name === '');
    }
    
    if (rootBone) {
        // Create a rotation quaternion
        const rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, angle);
        
        // Apply the rotation to the root bone
        rootBone.setRotationQuaternion(rotationQuaternion, BABYLON.Space.WORLD, enemy.root);
        
        debugLog(`[SKELETON] Rotated root bone ${rootBone.name} for enemy ${enemyId} to angle ${angle.toFixed(2)} rad`);
    } else {
        console.warn(`[SKELETON] Could not find root bone for enemy ${enemyId}`);
    }
    
    return angle;
}

// Make the function globally accessible
window.rotateEnemySkeleton = rotateEnemySkeleton;

// Add function to directly set the model's rotation matrix
function setEnemyRotationMatrix(enemyId, direction) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !enemy.root) {
        console.error(`Enemy ${enemyId} not found or has no root mesh`);
        return;
    }
    
    // Normalize direction
    const normalizedDirection = new BABYLON.Vector3(direction.x, 0, direction.z).normalize();
    
    // Calculate angle from direction
    const angle = Math.atan2(normalizedDirection.x, normalizedDirection.z) + Math.PI;
    
    // Create a rotation matrix
    const rotationMatrix = BABYLON.Matrix.RotationY(angle);
    
    // Apply the rotation matrix to the root mesh
    enemy.root.rotationQuaternion = null; // Clear any existing quaternion
    enemy.root.rotation.y = 0; // Reset rotation
    enemy.root.setPivotMatrix(rotationMatrix);
    
    // Also apply to transform node
    enemy.transform.rotationQuaternion = null;
    enemy.transform.rotation.y = angle;
    
    debugLog(`[MATRIX] Applied rotation matrix to enemy ${enemyId} with angle ${angle.toFixed(2)} rad`);
    
    return angle;
}

// Make the function globally accessible
window.setEnemyRotationMatrix = setEnemyRotationMatrix;

// Add function to force animation direction
function forceAnimationDirection(enemyId, direction) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error(`Enemy ${enemyId} not found`);
        return;
    }
    
    // Get current animation
    const currentAnimation = enemy.currentAnim;
    if (!currentAnimation) {
        console.warn(`[ANIMATION] No current animation for enemy ${enemyId}`);
        return;
    }
    
    // Normalize direction
    const normalizedDirection = new BABYLON.Vector3(direction.x, 0, direction.z).normalize();
    
    // Calculate angle from direction
    const angle = Math.atan2(normalizedDirection.x, normalizedDirection.z) + Math.PI;
    
    // Try to find animation target nodes
    const targetNodes = currentAnimation.targetedAnimations.map(ta => ta.target);
    
    // Log animation targets if not already logged
    if (!enemy._animationTargetsLogged) {
        debugLog(`[ANIMATION] Logging animation targets for enemy ${enemyId}:`);
        targetNodes.forEach((node, index) => {
            debugLog(`[ANIMATION] Target ${index}: ${node.name}, type: ${node.constructor.name}`);
        });
        enemy._animationTargetsLogged = true;
    }
    
    // Try to find transform nodes or meshes in the animation targets
    const transformNodes = targetNodes.filter(node => 
        node instanceof BABYLON.TransformNode || 
        node instanceof BABYLON.Mesh
    );
    
    if (transformNodes.length > 0) {
        // Apply rotation to all transform nodes
        transformNodes.forEach(node => {
            // Set rotation
            node.rotation.y = angle;
            
            // Also try quaternion
            const rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, angle);
            if (!node.rotationQuaternion) {
                node.rotationQuaternion = rotationQuaternion;
            } else {
                node.rotationQuaternion = rotationQuaternion;
            }
        });
        
        debugLog(`[ANIMATION] Applied rotation to ${transformNodes.length} animation targets for enemy ${enemyId}`);
    } else {
        console.warn(`[ANIMATION] No transform nodes found in animation targets for enemy ${enemyId}`);
    }
    
    return angle;
}

// Make the function globally accessible
window.forceAnimationDirection = forceAnimationDirection;

// Create damage indicator
function createDamageIndicator(position, damage) {
    if (!scene) return;
    
    // Create a dynamic texture for the text
    const textSize = 512; // Increased from 256 for higher resolution
    const dynamicTexture = new BABYLON.DynamicTexture("damageTexture", textSize, scene, true);
    dynamicTexture.hasAlpha = true;
    
    // Set font and draw text - increased font size
    const fontSize = 160; // Increased from 80
    const font = `bold ${fontSize}px Arial`;
    dynamicTexture.drawText(`${damage}`, null, null, font, "#ff0000", "transparent", true);
    
    // Create a plane to display the texture - increased width and height
    const plane = BABYLON.MeshBuilder.CreatePlane("damageIndicator", { width: 3, height: 1.5 }, scene); // Increased from width: 1, height: 0.5
    plane.position = new BABYLON.Vector3(position.x, position.y + 2.5, position.z); // Positioned slightly higher
    
    // Create material with the dynamic texture
    const material = new BABYLON.StandardMaterial("damageMaterial", scene);
    material.diffuseTexture = dynamicTexture;
    material.specularColor = new BABYLON.Color3(0, 0, 0);
    material.emissiveColor = new BABYLON.Color3(1, 0, 0);
    material.backFaceCulling = false;
    
    // Make it transparent
    material.useAlphaFromDiffuseTexture = true;
    
    // Apply material to plane
    plane.material = material;
    
    // Make the plane always face the camera (billboarding)
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    
    // Animate the indicator
    const startY = position.y + 2.5; // Adjusted to match new position
    const endY = position.y + 5; // Increased end height
    const duration = 1200; // Slightly longer duration for better visibility
    const startTime = Date.now();
    
    // Animation function
    const animateIndicator = () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        
        if (elapsed < duration) {
            // Calculate position based on elapsed time
            const progress = elapsed / duration;
            plane.position.y = startY + (endY - startY) * progress;
            
            // Fade out as it rises, but slower to keep it visible longer
            material.alpha = 1 - (progress * 0.8); // Slower fade out
            
            // Continue animation
            requestAnimationFrame(animateIndicator);
        } else {
            // Animation complete, dispose resources
            plane.dispose();
            material.dispose();
            dynamicTexture.dispose();
        }
    };
    
    // Start animation
    animateIndicator();
}

// Check if player is in sight of the enemy (no obstacles in between)
function isPlayerInSight(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !playerMesh) return false;
    
    // Get positions
    const enemyPos = enemy.transform.position;
    const playerPos = playerMesh.position;
    
    // Calculate direction to player
    const direction = new BABYLON.Vector3(
        playerPos.x - enemyPos.x,
        playerPos.y - enemyPos.y,
        playerPos.z - enemyPos.z
    );
    
    // Calculate distance to player
    const distance = direction.length();
    
    // If player is too far, they're not in sight
    if (distance > 20) { // 20 units max sight distance
        return false;
    }
    
    // Normalize direction
    direction.normalize();
    
    // Create a ray from enemy to player
    const ray = new BABYLON.Ray(
        new BABYLON.Vector3(enemyPos.x, enemyPos.y + 1.5, enemyPos.z), // Start from enemy's head height
        direction,
        distance
    );
    
    // Check for obstacles between enemy and player
    const hit = scene.pickWithRay(ray, mesh => {
        // Ignore player mesh, enemy meshes, and non-collidable objects
        return mesh !== playerMesh && 
               !mesh.name.includes('enemy') && 
               !mesh.name.includes('hitbox') &&
               !mesh.name.includes('projectile') &&
               mesh.checkCollisions;
    });
    
    // If there's a hit before reaching the player, the player is not in sight
    if (hit.hit && hit.distance < distance) {
        return false;
    }
    
    // Player is in sight
    return true;
}

// Generate a search path that leads towards the player's position
function generateSearchPath(startPos, targetPos) {
    // Calculate direction to target
    const dx = targetPos.x - startPos.x;
    const dz = targetPos.z - startPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // Normalize direction
    const dirX = dx / distance;
    const dirZ = dz / distance;
    
    // Create a path with waypoints that lead towards the target
    const path = [];
    
    // Add waypoints along the path to the target
    const numWaypoints = GameConfig.patrolPaths.searchPathMinWaypoints + 
                         Math.floor(Math.random() * (GameConfig.patrolPaths.searchPathMaxWaypoints - 
                                                    GameConfig.patrolPaths.searchPathMinWaypoints + 1));
    
    for (let i = 0; i < numWaypoints; i++) {
        // Calculate progress along the path (0 to 1)
        const progress = (i + 1) / numWaypoints;
        
        // Add some randomness to the waypoints
        const randomOffsetX = (Math.random() - 0.5) * 4; // -2 to 2
        const randomOffsetZ = (Math.random() - 0.5) * 4; // -2 to 2
        
        // Calculate waypoint position
        const waypointX = startPos.x + dirX * distance * progress + randomOffsetX;
        const waypointZ = startPos.z + dirZ * distance * progress + randomOffsetZ;
        
        // Add waypoint to path
        path.push({ x: waypointX, z: waypointZ });
    }
    
    // Add the target position as the final waypoint
    path.push({ x: targetPos.x, z: targetPos.z });
    
    return path;
}

// Start a burst fire sequence
function startBurstFire(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) return;
    
    // Fire first shot immediately
    enemyShootAtPlayer(enemyId);
    
    // Set up remaining shots in the burst
    let shotsRemaining = GameConfig.enemies.burstShotCount - 1;
    
    const burstInterval = setInterval(() => {
        if (shotsRemaining > 0 && enemy && enemy.state === "ATTACK") {
            enemyShootAtPlayer(enemyId);
            shotsRemaining--;
        } else {
            clearInterval(burstInterval);
        }
    }, GameConfig.enemies.burstFireInterval);
}

// Update enemy attack behavior - smarter AI movement
function updateEnemyAttack(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy) return;
    
    // Get player position
    const playerPosition = getPlayerPosition();
    if (!playerPosition) return;
    
    // Calculate direction and distance to player
    const dx = playerPosition.x - enemy.transform.position.x;
    const dz = playerPosition.z - enemy.transform.position.z;
    const distanceToPlayer = Math.sqrt(dx * dx + dz * dz);
    
    // Normalize direction to player
    const dirToPlayer = new YUKA.Vector3(dx, 0, dz).normalize();
    
    // Initialize or update decision time
    if (!enemy.lastAttackDecision) {
        enemy.lastAttackDecision = Date.now();
        enemy.attackStrategy = "approach"; // Default strategy
    }
    
    // Make new decisions periodically
    const currentTime = Date.now();
    if (currentTime - enemy.lastAttackDecision > GameConfig.enemies.attackModeDecisionTime) {
        // Update attack strategy based on distance
        if (distanceToPlayer < GameConfig.enemies.minAttackDistance) {
            // Too close, back up
            enemy.attackStrategy = "retreat";
        } else if (distanceToPlayer > GameConfig.enemies.maxAttackDistance) {
            // Too far, approach
            enemy.attackStrategy = "approach";
        } else {
            // Good distance, choose between strafing or random movement
            enemy.attackStrategy = Math.random() < 0.6 ? "strafe" : "random";
        }
        
        // Occasionally decide to dodge
        if (Math.random() < GameConfig.enemies.dodgeFrequency * 10) { // Higher chance on decision points
            enemy.attackStrategy = "dodge";
            
            // Choose dodge direction (left, right, back)
            const dodgeDirections = ["left", "right", "back"];
            enemy.dodgeDirection = dodgeDirections[Math.floor(Math.random() * dodgeDirections.length)];
        }
        
        // Update decision timestamp
        enemy.lastAttackDecision = currentTime;
        
        debugLog(`Enemy ${enemyId} chose attack strategy: ${enemy.attackStrategy}`);
    }
    
    // Calculate movement direction based on current attack strategy
    let moveDirection = new YUKA.Vector3(0, 0, 0);
    
    switch (enemy.attackStrategy) {
        case "approach":
            // Move toward player but maintain minimum distance
            moveDirection.copy(dirToPlayer);
            break;
            
        case "retreat":
            // Move away from player
            moveDirection.copy(dirToPlayer).multiplyScalar(-1);
            break;
            
        case "strafe":
            // Circle strafe around player
            if (!enemy.strafeDirection) {
                // Randomly choose strafe direction (left or right)
                enemy.strafeDirection = Math.random() < 0.5 ? "left" : "right";
            }
            
            // Create perpendicular vector for strafing
            if (enemy.strafeDirection === "left") {
                moveDirection.set(-dirToPlayer.z, 0, dirToPlayer.x);
            } else {
                moveDirection.set(dirToPlayer.z, 0, -dirToPlayer.x);
            }
            
            // Mix in a bit of approach/retreat to maintain optimal distance
            if (distanceToPlayer > GameConfig.enemies.maxAttackDistance) {
                // Add some approach vector
                moveDirection.add(dirToPlayer.clone().multiplyScalar(0.5));
                moveDirection.normalize();
            } else if (distanceToPlayer < GameConfig.enemies.minAttackDistance) {
                // Add some retreat vector
                moveDirection.add(dirToPlayer.clone().multiplyScalar(-0.5));
                moveDirection.normalize();
            }
            break;
            
        case "dodge":
            // Execute quick dodge movement
            if (enemy.dodgeDirection === "left") {
                moveDirection.set(-dirToPlayer.z, 0, dirToPlayer.x);
            } else if (enemy.dodgeDirection === "right") {
                moveDirection.set(dirToPlayer.z, 0, -dirToPlayer.x);
            } else { // "back"
                moveDirection.copy(dirToPlayer).multiplyScalar(-1);
            }
            
            // Use higher speed for dodging
            moveDirection.multiplyScalar(1.5);
            break;
            
        case "random":
            // Move in a somewhat random direction, but generally keep facing player
            if (!enemy.randomMoveTarget || Math.random() < 0.05) {
                // Create a new random move target periodically
                const angle = Math.random() * Math.PI * 2;
                const distance = GameConfig.enemies.minDodgeDistance + 
                                Math.random() * (GameConfig.enemies.maxDodgeDistance - GameConfig.enemies.minDodgeDistance);
                
                // Calculate random position around player
                enemy.randomMoveTarget = new YUKA.Vector3(
                    playerPosition.x + Math.cos(angle) * distance,
                    0,
                    playerPosition.z + Math.sin(angle) * distance
                );
            }
            
            // Move toward random point
            moveDirection.set(
                enemy.randomMoveTarget.x - enemy.transform.position.x,
                0,
                enemy.randomMoveTarget.z - enemy.transform.position.z
            ).normalize();
            break;
    }
    
    // Get speed based on strategy
    let speed = CharacterEnemyConfig.getSpeedForMode("ATTACK");
    if (enemy.attackStrategy === "dodge") {
        speed *= 1.5; // Faster for dodging
    }
    
    // Set velocity
    const moveStep = speed * engine.getDeltaTime() / 1000;
    
    // Store previous position for collision detection
    const previousPosition = {
        x: enemy.transform.position.x,
        z: enemy.transform.position.z
    };
    
    // Update position
    enemy.vehicle.position.x += moveDirection.x * moveStep;
    enemy.vehicle.position.z += moveDirection.z * moveStep;
    
    // Sync with Babylon mesh
    enemy.transform.position.x = enemy.vehicle.position.x;
    enemy.transform.position.z = enemy.vehicle.position.z;
    
    // Always face the player regardless of movement direction
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        // Calculate angle to face player
        const targetAngle = Math.atan2(dirToPlayer.x, dirToPlayer.z) + Math.PI;
        const currentAngle = enemy.root.rotation.y;
        
        // Smooth rotation
        let angleDiff = targetAngle - currentAngle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Apply smooth rotation - faster rotation in attack mode
        const rotationSpeed = enemy.rotationSpeed * 1.5;
        const newRotation = currentAngle + angleDiff * rotationSpeed;
        enemy.root.rotation.y = newRotation;
    }
    
    // Check for collisions
    if (checkEnemyCollisions(enemy)) {
        // Restore previous position
        enemy.vehicle.position.x = previousPosition.x;
        enemy.vehicle.position.z = previousPosition.z;
        enemy.transform.position.x = previousPosition.x;
        enemy.transform.position.z = previousPosition.z;
        
        // Change strategy if we hit something
        enemy.lastAttackDecision = 0; // Force new decision next frame
    }
}