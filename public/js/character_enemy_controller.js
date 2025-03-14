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
    console.log("Player mesh reference set in enemy controller");
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
async function loadEnemyModel(sceneParam, position, param1 = null, param2 = null, callback = null) {
    // Set the global scene reference
    scene = sceneParam;
    
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
        
        // Create transform node for positioning
        const enemyTransform = new BABYLON.TransformNode(`enemy_${enemyId}_root`, scene);
        enemyRoot.parent = enemyTransform;
        
        // Position enemy at spawn point
        enemyTransform.position = position;

        // Create head hitbox with enemy ID
        const headHitbox = BABYLON.MeshBuilder.CreateBox(`hitbox_head_${enemyId}`, {
            width: 0.8,
            height: 0.8,
            depth: 0.8
        }, scene);
        
        // Create body hitbox with enemy ID
        const bodyHitbox = BABYLON.MeshBuilder.CreateBox(`hitbox_body_${enemyId}`, {
            width: 1.0,
            height: 1.5,
            depth: 1.0
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
        headHitbox.position.y = 1.7; // Position at head height
        bodyHitbox.position.y = 0.9; // Position at body height
        
        // Set initial hitbox visibility based on global setting
        headHitbox.isVisible = window.showHitboxes || false;
        bodyHitbox.isVisible = window.showHitboxes || false;
        
        // Store enemy in global map with hitbox references
        loadedEnemies[enemyId] = {
            id: enemyId,
            root: enemyRoot,
            transform: enemyTransform,
            skeleton: result.skeletons[0],
            state: "IDLE",
            stateStartTime: Date.now(),
            idleDuration: 3000,
            currentPath: null,
            currentPathIndex: 0,
            moveSpeed: 2.0,
            rotationSpeed: 0.15, // Increased for smoother rotation
            headHitbox: headHitbox,
            bodyHitbox: bodyHitbox,
            health: 100
        };
        
        // Generate unique patrol path starting from spawn position
        const patrolPath = getUniquePatrolPath(position);
        loadedEnemies[enemyId].currentPath = patrolPath;
        
        // Create Yuka Vehicle for movement
        const vehicle = new YUKA.Vehicle();
        vehicle.position.set(position.x, 0, position.z);
        vehicle.maxSpeed = 2.0;
        vehicle.maxForce = 50;
        vehicle.updateNeeded = true;
        loadedEnemies[enemyId].vehicle = vehicle;
        
        // Add vehicle to entity manager
        entityManager.add(vehicle);
        
        // Initialize rotation speed
        loadedEnemies[enemyId].rotationSpeed = 0.15; // Increased for smoother rotation
        
        // Play initial idle animation
        playEnemyAnimation(enemyId, "Idle");
        
        // Set up state transition observer and Yuka update
        scene.onBeforeRenderObservable.add(() => {
            if (window.gamePaused) return;
            
            const deltaTime = engine.getDeltaTime() / 1000;
            time.update();
            entityManager.update(deltaTime);
            updateEnemyState(enemyId);
            
            // Add explicit call to syncEnemyWithYuka
            syncEnemyWithYuka(enemyId);
            
            // Update hitbox visibility whenever it changes
            headHitbox.isVisible = window.showHitboxes || false;
            bodyHitbox.isVisible = window.showHitboxes || false;
        });
        
        // Create visualization for initial path
        createPathVisualization(enemyId, patrolPath);
        
        if (callback && typeof callback === 'function') {
            callback({
                id: enemyId,
                mesh: enemyRoot,
                skeleton: result.skeletons[0],
                headHitbox: headHitbox,
                bodyHitbox: bodyHitbox
            });
        }
        
        return enemyId;
    } catch (error) {
        console.error("Error loading enemy model:", error);
        throw error;
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
    const isPlayerInRange = checkPlayerInRange(enemyId, 12); // 12 blocks detection range
    
    switch (enemy.state) {
        case "IDLE":
            if (isPlayerInRange) {
                setEnemyState(enemyId, "CHASE");
            } else if (timeInState >= enemy.idleDuration) {
                setEnemyState(enemyId, "PATROL");
            }
            break;
        case "PATROL":
            if (isPlayerInRange) {
                setEnemyState(enemyId, "CHASE");
            } else {
                updateEnemyPatrol(enemyId);
            }
            break;
        case "CHASE":
            if (!isPlayerInRange) {
                setEnemyState(enemyId, "PATROL");
            } else {
                updateEnemyChase(enemyId);
                
                // Occasionally shoot at player when in chase mode
                if (Math.random() < 0.01) { // 1% chance per frame to shoot
                    enemyShootAtPlayer(enemyId);
                }
            }
            break;
        case "DEATH":
            // Do nothing, enemy is dead
            break;
        default:
            console.warn(`Unknown enemy state: ${enemy.state}`);
            setEnemyState(enemyId, "IDLE");
            break;
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
        console.log(`[PATROL] Generated new path for enemy ${enemyId} with ${newPath.length} waypoints`);
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
    
    // Log waypoint info occasionally
    if (Math.random() < 0.01) {
        console.log(`[WAYPOINT] Enemy ${enemyId} at waypoint ${enemy.currentPathIndex}/${enemy.currentPath.length-1}, ` +
                   `distance: ${distanceToWaypoint.toFixed(2)}, ` +
                   `direction: (${dx.toFixed(2)}, ${dz.toFixed(2)})`);
    }
    
    // If we've reached the waypoint
    if (distanceToWaypoint < 0.5) {
        console.log(`[WAYPOINT] Enemy ${enemyId} reached waypoint ${enemy.currentPathIndex}`);
        enemy.currentPathIndex++;
        
        // If we've completed the path, generate a new one
        if (enemy.currentPathIndex >= enemy.currentPath.length) {
            console.log(`[WAYPOINT] Enemy ${enemyId} completed path, generating new one`);
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
        console.log(`[COLLISION] Enemy ${enemyId} collision detected, restoring position`);
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
        console.log(`[CHASE] Enemy ${enemyId} lost sight of player, returning to patrol`);
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
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !playerMesh) return;
    
    console.log(`Enemy ${enemyId} shooting at player`);
    
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
    console.log(`Attempting to play animation for enemy ${enemyId}: "${animationName}"`);
    
    if (!availableAnimations) {
        console.warn("No animations available");
        return;
    }
    
    // Special case for hit reaction - try to play a hit animation if available
    if (animationName.toLowerCase() === "idle" && loadedEnemies[enemyId]?.state === "HIT_REACT") {
        // Try to find a hit reaction animation
        const hitAnimationVariants = [
            "Hit", "HitReact", "TakeHit", "Damage", "Hurt",
            "CharacterArmature|Hit", "CharacterArmature|HitReact", 
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
    
    // Special case: When transitioning from CHASE to PATROL, always create a new path
    if (enemy.state === "CHASE" && state === "PATROL") {
        console.log(`Enemy ${enemyId} stopped chasing, creating new patrol path from current position`);
        
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
    
    // Dispose collision box
    if (enemy.collisionBox) {
        enemy.collisionBox.dispose();
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

    // Check global settings
    const showLines = window.showPathLines !== undefined ? window.showPathLines : false;
    const showPoints = window.showWaypoints !== undefined ? window.showWaypoints : false;
    
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
    
    console.log(`[PATH] Created path visualization for enemy ${enemyId} with ${path.length} waypoints. Visibility: ${showPoints}`);
}

// Add this function to update current waypoint visualization
function updateWaypointVisualization(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !pathVisualization[enemyId]) return;
    
    // Check if waypoints are visible
    const showPoints = window.showWaypoints !== undefined ? window.showWaypoints : false;
    
    // Update waypoint colors and visibility
    pathVisualization[enemyId].points.forEach((sphere, index) => {
        // Update visibility first
        sphere.isVisible = showPoints;
        
        // Only update colors if visible
        if (showPoints) {
            const material = sphere.material;
            // Check if highlighting is enabled
            const shouldHighlight = window.highlightCurrentWaypoint !== undefined ? 
                                   window.highlightCurrentWaypoint : true;
            
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
        const showLines = window.showPathLines !== undefined ? window.showPathLines : false;
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
    
    console.log(`Enemy ${enemyId} hit for ${damage} damage at position: x=${enemy.transform.position.x.toFixed(2)}, y=${enemy.transform.position.y.toFixed(2)}, z=${enemy.transform.position.z.toFixed(2)}`);
    
    // Reduce enemy health
    if (!enemy.health) enemy.health = 100; // Initialize health if not set
    enemy.health -= damage;
    console.log(`Enemy ${enemyId} health reduced to ${enemy.health}`);
    
    // Check if enemy should die
    if (enemy.health <= 0) {
        console.log(`Enemy ${enemyId} has died!`);
        setEnemyState(enemyId, "DEATH");
        
        // Create death effect if available
        if (window.createDeathEffect) {
            window.createDeathEffect(enemy.transform.position.clone());
        }
        
        // Remove enemy after a short delay
        setTimeout(() => {
            disposeEnemy(enemyId);
        }, 2000);
        
        return;
    }
    
    // Set enemy to hit react state
    setEnemyState(enemyId, "HIT_REACT");
    
    // Push enemy back in the direction of the hit
    if (hitDirection) {
        console.log(`Hit direction: x=${hitDirection.x.toFixed(2)}, y=${hitDirection.y.toFixed(2)}, z=${hitDirection.z.toFixed(2)}`);
        
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
            const isPlayerInRange = checkPlayerInRange(enemyId, 12);
            setEnemyState(enemyId, isPlayerInRange ? "CHASE" : "PATROL");
        }
    }, 500); // Duration of hit reaction
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
        console.log(`[DEBUG] Enemy ${enemyId} - State: ${enemy.state}, ` +
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
console.log("Enemy debug functions available. Type 'toggleEnemyDebug(true)' in console to enable debug visualization.");
console.log("Available debug commands:");
console.log("- toggleEnemyDebug(true/false) - Enable/disable debug visualization");
console.log("- debugEnemyMovement('enemy_id') - Debug specific enemy");

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
        console.log(`[PATROL-PRE] Enemy ${enemyId} - ` +
                   `Position: (${enemy.transform.position.x.toFixed(2)}, ${enemy.transform.position.z.toFixed(2)}), ` +
                   `Rotation: ${enemy.root.rotation.y.toFixed(2)}, ` +
                   `Waypoint: ${enemy.currentPathIndex}/${enemy.currentPath?.length || 0}`);
    }
    
    // Call original function
    originalUpdateEnemyPatrol(enemyId);
    
    if (enemy && window.showEnemyDebug) {
        // Log after update
        console.log(`[PATROL-POST] Enemy ${enemyId} - ` +
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
        console.log(`[ROTATION CHECK] Enemy ${enemyId} - ` +
                   `Waypoint: (${currentWaypoint.x.toFixed(2)}, ${currentWaypoint.z.toFixed(2)}), ` +
                   `Position: (${enemy.transform.position.x.toFixed(2)}, ${enemy.transform.position.z.toFixed(2)}), ` +
                   `Direction: (${dx.toFixed(2)}, ${dz.toFixed(2)}), ` +
                   `Target angle: ${targetAngle.toFixed(2)} rad (${(targetAngle * 180 / Math.PI).toFixed(2)}°), ` +
                   `Current angle: ${currentAngle.toFixed(2)} rad (${(currentAngle * 180 / Math.PI).toFixed(2)}°), ` +
                   `Difference: ${angleDiff.toFixed(2)} rad (${(angleDiff * 180 / Math.PI).toFixed(2)}°)`);
        
        // Force set rotation if difference is too large
        if (Math.abs(angleDiff) > 0.5) {
            console.log(`[ROTATION FIX] Enemy ${enemyId} - Forcing rotation to target angle`);
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
    console.log(`[PATH] Toggling path visualization: ${show}`);
    window.showWaypoints = show;
    window.showPathLines = show;
    
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
        console.log(`[MODEL] Logging all meshes for enemy ${enemyId}:`);
        if (enemy.root && enemy.root.getChildMeshes) {
            const childMeshes = enemy.root.getChildMeshes();
            childMeshes.forEach((mesh, index) => {
                console.log(`[MODEL] Mesh ${index}: ${mesh.name}`);
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
        
        console.log(`[MODEL] Applied orientation to ${characterBody.name} for enemy ${enemyId}`);
        
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
    console.log(`[TRANSFORM] Rotated enemy ${enemyId} transform to angle ${angle.toFixed(2)} rad (${(angle * 180 / Math.PI).toFixed(2)}°)`);
    
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
        console.log(`[SKELETON] Logging all bones for enemy ${enemyId}:`);
        for (let i = 0; i < skeleton.bones.length; i++) {
            const bone = skeleton.bones[i];
            console.log(`[SKELETON] Bone ${i}: ${bone.name}, parent: ${bone.getParent()?.name || 'none'}`);
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
        
        console.log(`[SKELETON] Rotated root bone ${rootBone.name} for enemy ${enemyId} to angle ${angle.toFixed(2)} rad`);
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
    
    console.log(`[MATRIX] Applied rotation matrix to enemy ${enemyId} with angle ${angle.toFixed(2)} rad`);
    
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
    const currentAnimation = currentAnim;
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
        console.log(`[ANIMATION] Logging animation targets for enemy ${enemyId}:`);
        targetNodes.forEach((node, index) => {
            console.log(`[ANIMATION] Target ${index}: ${node.name}, type: ${node.constructor.name}`);
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
        
        console.log(`[ANIMATION] Applied rotation to ${transformNodes.length} animation targets for enemy ${enemyId}`);
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
    const textSize = 256;
    const dynamicTexture = new BABYLON.DynamicTexture("damageTexture", textSize, scene, true);
    dynamicTexture.hasAlpha = true;
    
    // Set font and draw text
    const fontSize = 80;
    const font = `bold ${fontSize}px Arial`;
    dynamicTexture.drawText(`${damage}`, null, null, font, "#ff0000", "transparent", true);
    
    // Create a plane to display the texture
    const plane = BABYLON.MeshBuilder.CreatePlane("damageIndicator", { width: 1, height: 0.5 }, scene);
    plane.position = new BABYLON.Vector3(position.x, position.y + 2, position.z); // Position above enemy
    
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
    const startY = position.y + 2;
    const endY = position.y + 4;
    const duration = 1000; // ms
    const startTime = Date.now();
    
    // Animation function
    const animateIndicator = () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        
        if (elapsed < duration) {
            // Calculate position based on elapsed time
            const progress = elapsed / duration;
            plane.position.y = startY + (endY - startY) * progress;
            
            // Fade out as it rises
            material.alpha = 1 - progress;
            
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