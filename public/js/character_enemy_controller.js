// Enemy Controller for BoomTown
// Handles loading and animating the Character_Enemy model

// Global variables for enemy model
var enemyModels = {}; // Store loaded enemy models by ID
var enemySkeletons = {}; // Store skeletons for animations
var enemyAnimations = {}; // Store animation ranges by enemy ID
var loadedEnemies = {}; // Store loaded enemy instances
var pathVisualization = {}; // Store path visualization meshes by enemy ID
var existingPaths = []; // Store all active patrol paths to avoid overlap

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
        
        // Create a collision box for the enemy
        const collisionBox = BABYLON.MeshBuilder.CreateBox(`enemy_${enemyId}_collision`, {
            width: 1.5,
            height: 2.0,
            depth: 1.5
        }, scene);
        
        // Make the collision box invisible
        collisionBox.isVisible = false;
        
        // Make the collision box a child of the transform node
        collisionBox.parent = enemyTransform;
        
        // Position the collision box to match the character's center
        collisionBox.position.y = 1.0; // Adjust based on character height
        
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
            vehicle: vehicle,
            collisionBox: collisionBox // Store reference to collision box
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
                skeleton: result.skeletons[0],
                collisionBox: collisionBox // Include collision box in callback data
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

// Update enemy chase behavior - make enemy move towards player
function updateEnemyChase(enemyId) {
    const enemy = loadedEnemies[enemyId];
    if (!enemy || !playerMesh) return;
    
    // Calculate direction to player
    const dx = playerMesh.position.x - enemy.transform.position.x;
    const dz = playerMesh.position.z - enemy.transform.position.z;
    const distanceToPlayer = Math.sqrt(dx * dx + dz * dz);
    
    // Normalize direction
    const direction = new YUKA.Vector3(dx, 0, dz).normalize();
    
    // Update vehicle velocity towards player
    enemy.vehicle.velocity.copy(direction).multiplyScalar(enemy.vehicle.maxSpeed);
    
    // Update vehicle position with smooth movement
    const deltaTime = engine.getDeltaTime() / 1000;
    const moveStep = enemy.vehicle.maxSpeed * deltaTime;
    
    // Update vehicle position
    const previousPosition = {
        x: enemy.vehicle.position.x,
        z: enemy.vehicle.position.z
    };
    
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
        enemy.root.rotation.y += angleDiff * enemy.rotationSpeed;
    }
    
    // Check for collisions
    if (checkEnemyCollisions(enemy)) {
        // Restore previous position
        enemy.vehicle.position.x = previousPosition.x;
        enemy.vehicle.position.z = previousPosition.z;
        enemy.transform.position.x = previousPosition.x;
        enemy.transform.position.z = previousPosition.z;
    }
    
    // Ensure chase animation is playing
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
    
    // The collision box will automatically follow since it's parented to the transform
}

// Function to handle enemy hit reaction
function handleEnemyHit(enemyId, damage, hitDirection) {
    console.log(`handleEnemyHit called for enemy ${enemyId} with damage ${damage}`);
    
    const enemy = loadedEnemies[enemyId];
    if (!enemy) {
        console.error(`Enemy ${enemyId} not found in loadedEnemies!`);
        return;
    }
    
    console.log(`Enemy ${enemyId} hit for ${damage} damage at position: x=${enemy.transform.position.x.toFixed(2)}, y=${enemy.transform.position.y.toFixed(2)}, z=${enemy.transform.position.z.toFixed(2)}`);
    
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
        
        console.log(`Enemy pushed to position: x=${enemy.transform.position.x.toFixed(2)}, y=${enemy.transform.position.y.toFixed(2)}, z=${enemy.transform.position.z.toFixed(2)}`);
    }
    
    // Create damage indicator
    console.log("Creating damage indicator...");
    createDamageIndicator(enemy.transform.position, damage);
    
    // Return to previous state after hit reaction duration
    setTimeout(() => {
        // Only change state if still in HIT_REACT (might have died or changed state otherwise)
        if (enemy && enemy.state === "HIT_REACT") {
            // Return to patrol or chase state based on player proximity
            const isPlayerInRange = checkPlayerInRange(enemyId, 12);
            setEnemyState(enemyId, isPlayerInRange ? "CHASE" : "PATROL");
            console.log(`Enemy ${enemyId} returned to ${isPlayerInRange ? "CHASE" : "PATROL"} state after hit reaction`);
        }
    }, 500); // Duration of hit reaction
}

// Function to create floating damage indicator
function createDamageIndicator(position, damage) {
    // Make sure we have access to the scene
    if (!scene && window.scene) {
        scene = window.scene;
    }
    
    if (!scene) {
        console.error("Scene is not defined in createDamageIndicator");
        return;
    }
    
    console.log(`Creating damage indicator at position ${position.x}, ${position.y}, ${position.z} with damage ${damage}`);
    
    try {
        // Create a dynamic texture for the damage text
        const textSize = 512; // Larger texture for better quality
        const dynamicTexture = new BABYLON.DynamicTexture("damageTexture_" + Date.now(), textSize, scene, true);
        dynamicTexture.hasAlpha = true;
        
        // Set font and draw text
        const fontSize = 200; // Larger font size
        const font = `bold ${fontSize}px Arial`;
        
        // Clear the texture first
        const ctx = dynamicTexture.getContext();
        ctx.clearRect(0, 0, textSize, textSize);
        
        // Draw text with outline for better visibility
        dynamicTexture.drawText(damage.toString(), null, null, font, "#ff0000", "transparent", true, true);
        
        // Create a larger plane to display the texture
        const plane = BABYLON.MeshBuilder.CreatePlane("damageIndicator_" + Date.now(), { 
            width: 2.0,  // Larger width
            height: 1.0  // Larger height
        }, scene);
        
        // Position it higher above the enemy
        plane.position = new BABYLON.Vector3(position.x, position.y + 3.0, position.z);
        
        // Create material with the dynamic texture
        const material = new BABYLON.StandardMaterial("damageMaterial_" + Date.now(), scene);
        material.diffuseTexture = dynamicTexture;
        material.specularColor = new BABYLON.Color3(0, 0, 0);
        material.emissiveColor = new BABYLON.Color3(1, 0, 0); // Bright red
        material.backFaceCulling = false;
        
        // Make it transparent
        material.useAlphaFromDiffuseTexture = true;
        
        // Apply material to plane
        plane.material = material;
        
        // Make the plane always face the camera (billboarding)
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        
        // Make sure it's rendered on top of other objects
        plane.renderingGroupId = 1;
        
        // Animate the damage indicator
        const startY = position.y + 3.0;
        const endY = position.y + 5.0; // Higher end position
        const duration = 2000; // Longer duration (2 seconds)
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
                
                // Scale up slightly as it rises
                const scale = 1 + progress * 0.5;
                plane.scaling.x = scale;
                plane.scaling.y = scale;
                
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
        
        // Also create a simple particle effect for additional visibility
        const particleSystem = new BABYLON.ParticleSystem("damageParticles_" + Date.now(), 20, scene);
        particleSystem.particleTexture = new BABYLON.Texture("/assets/textures/flare_new.png", scene);
        particleSystem.emitter = new BABYLON.Vector3(position.x, position.y + 2.0, position.z);
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.2, 0, -0.2);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.2, 0.4, 0.2);
        particleSystem.color1 = new BABYLON.Color4(1, 0, 0, 1);
        particleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
        particleSystem.minSize = 0.3;
        particleSystem.maxSize = 0.5;
        particleSystem.minLifeTime = 0.5;
        particleSystem.maxLifeTime = 1.5;
        particleSystem.emitRate = 20;
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        particleSystem.gravity = new BABYLON.Vector3(0, 1, 0);
        particleSystem.direction1 = new BABYLON.Vector3(-1, 2, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, 2, 1);
        particleSystem.minAngularSpeed = 0;
        particleSystem.maxAngularSpeed = Math.PI;
        particleSystem.minEmitPower = 0.5;
        particleSystem.maxEmitPower = 1.5;
        particleSystem.updateSpeed = 0.01;
        
        // Start the particle system
        particleSystem.start();
        
        // Stop and dispose after animation duration
        setTimeout(() => {
            particleSystem.stop();
            setTimeout(() => {
                particleSystem.dispose();
            }, 1000); // Wait for particles to finish
        }, duration);
        
    } catch (error) {
        console.error("Error creating damage indicator:", error);
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
window.handleEnemyHit = handleEnemyHit;
window.createDamageIndicator = createDamageIndicator; 