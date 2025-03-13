// Yuka + BabylonJS Integration
// Main file for character movement with Yuka AI

// Global BabylonJS Variables
var canvas = document.getElementById("renderCanvas");
var engine = new BABYLON.Engine(canvas, true);
var scene = createScene(engine, canvas);
var dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(0,0,0), scene);
var hemisphericLight = new BABYLON.HemisphericLight("hemisphericLight", new BABYLON.Vector3(0, 1, 0), scene);

// Player & Navigation
var playerTransform;
var player;
var ground;
var groundMat;

// Animations
var currentAnim = null;
var idleAnim = null;
var walkAnim = null;
var runAnim = null;
var turnLeftAnim = null;
var turnRightAnim = null;
var lookAroundAnim = null;
var availableAnimations = {};

// Yuka Variables
var time = new YUKA.Time();
var entityManager = new YUKA.EntityManager();
var vehicle; // Yuka vehicle for the character
var obstacles = []; // Array to store obstacles (walls)
var path; // Path for the character to follow

// Character AI Modes
const AI_MODES = {
    PATROL: 'PATROL',
    IDLE: 'IDLE',
    CHASE: 'CHASE',
    FLEE: 'FLEE'
};

// Current AI mode
var currentAIMode = AI_MODES.PATROL;

// Map boundaries - invisible walls
var mapBoundaries = {
    minX: -45,
    maxX: 45,
    minZ: -45,
    maxZ: 45
};

// Store the current character model name (without file extension)
var currentCharacterModel = null;

// Create Scene
function createScene(engine, canvas) {
    canvas = document.getElementById("renderCanvas");
    engine.clear(new BABYLON.Color3(0, 0, 0), true, true);
    scene = new BABYLON.Scene(engine);
    
    // Enable keyboard controls
    scene.actionManager = new BABYLON.ActionManager(scene);
    
    return scene;
}

// Start Game
function startGame() {
    // Set Canvas & Engine
    var toRender = function () {
        // Update Yuka AI system
        const delta = time.update().getDelta();
        
        // Update the entity manager
        entityManager.update(delta);
        
        // Sync Babylon mesh with Yuka entity
        if (vehicle && playerTransform) {
            syncYukaWithBabylon();
        }
        
        scene.render();
    }
    engine.runRenderLoop(toRender);

    // Create Default Camera
    var camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    // Directional Light
    dirLight.intensity = 1.0;
    dirLight.position = new BABYLON.Vector3(0, 10, 10);
    dirLight.direction = new BABYLON.Vector3(-2, -4, -5);
    
    // Hemispheric Light for ambient lighting
    hemisphericLight.intensity = 0.7;

    // Ground
    ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 100, height: 100, subdivisions: 20}, scene);
    ground.isPickable = true;
    groundMat = new BABYLON.StandardMaterial("groundMaterial", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    groundMat.wireframe = true;
    ground.material = groundMat;
    
    // Create invisible walls as obstacles for Yuka
    createWallsAsObstacles();

    // Import Character
    importModelAsync("Character_Enemy.glb");

    // Stats
    var statsDiv = document.createElement("div");
    statsDiv.style.position = "absolute";
    statsDiv.style.top = "10px";
    statsDiv.style.left = "10px";
    statsDiv.style.color = "white";
    statsDiv.style.backgroundColor = "rgba(0,0,0,0.5)";
    statsDiv.style.padding = "5px";
    statsDiv.style.borderRadius = "5px";
    statsDiv.innerHTML = "FPS: 0";
    document.body.appendChild(statsDiv);
    
    setInterval(() => {
        statsDiv.innerHTML = "<b>" + Math.round(engine.getFps()) + " FPS</b> ";
    }, 100);
    
    // Add instructions
    var instructionsDiv = document.createElement("div");
    instructionsDiv.style.position = "absolute";
    instructionsDiv.style.bottom = "10px";
    instructionsDiv.style.left = "10px";
    instructionsDiv.style.color = "white";
    instructionsDiv.style.backgroundColor = "rgba(0,0,0,0.5)";
    instructionsDiv.style.padding = "10px";
    instructionsDiv.style.borderRadius = "5px";
    instructionsDiv.innerHTML = "WASD to move camera<br>Character follows autonomous AI behavior";
    document.body.appendChild(instructionsDiv);
    
    // Add AI mode selection dropdown
    var modeSelectDiv = document.createElement("div");
    modeSelectDiv.style.position = "absolute";
    modeSelectDiv.style.top = "10px";
    modeSelectDiv.style.right = "100px";
    modeSelectDiv.style.padding = "10px";
    modeSelectDiv.style.backgroundColor = "rgba(0,0,0,0.5)";
    modeSelectDiv.style.borderRadius = "5px";
    
    var modeSelectLabel = document.createElement("label");
    modeSelectLabel.style.color = "white";
    modeSelectLabel.style.marginRight = "10px";
    modeSelectLabel.innerHTML = "AI Mode: ";
    
    var modeSelect = document.createElement("select");
    modeSelect.style.padding = "5px";
    modeSelect.style.borderRadius = "3px";
    
    // Add options for each AI mode
    Object.keys(AI_MODES).forEach(mode => {
        var option = document.createElement("option");
        option.value = AI_MODES[mode];
        option.text = mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
        modeSelect.appendChild(option);
    });
    
    // Set default value
    modeSelect.value = currentAIMode;
    
    // Add change event
    modeSelect.onchange = function() {
        console.log("Mode changed to:", this.value);
        setAIMode(this.value);
    };
    
    modeSelectDiv.appendChild(modeSelectLabel);
    modeSelectDiv.appendChild(modeSelect);
    document.body.appendChild(modeSelectDiv);
    
    // Add speed adjustment controls
    createSpeedAdjustmentControls();
}

// Create speed adjustment controls
function createSpeedAdjustmentControls() {
    var speedControlsDiv = document.createElement("div");
    speedControlsDiv.style.position = "absolute";
    speedControlsDiv.style.top = "60px";
    speedControlsDiv.style.right = "10px";
    speedControlsDiv.style.padding = "10px";
    speedControlsDiv.style.backgroundColor = "rgba(0,0,0,0.5)";
    speedControlsDiv.style.borderRadius = "5px";
    speedControlsDiv.style.color = "white";
    speedControlsDiv.style.width = "300px";
    
    var title = document.createElement("h3");
    title.innerHTML = "Character Mode Settings";
    title.style.margin = "0 0 10px 0";
    title.style.fontSize = "14px";
    speedControlsDiv.appendChild(title);
    
    // Create controls for each mode
    const modes = ["PATROL", "CHASE", "FLEE", "IDLE"];
    
    modes.forEach(mode => {
        var container = document.createElement("div");
        container.style.marginBottom = "15px";
        container.style.padding = "5px";
        container.style.borderBottom = "1px solid rgba(255,255,255,0.2)";
        
        // Mode label
        var modeLabel = document.createElement("div");
        modeLabel.innerHTML = `<strong>${mode}</strong>`;
        modeLabel.style.marginBottom = "5px";
        container.appendChild(modeLabel);
        
        // Animation info
        var animLabel = document.createElement("div");
        const animName = characterRegistry.getCharacter("Character_Enemy").getAnimationForMode(mode);
        animLabel.innerHTML = `Animation: <span style="color:#aaffaa">${animName}</span>`;
        animLabel.style.fontSize = "12px";
        animLabel.style.marginBottom = "5px";
        container.appendChild(animLabel);
        
        // Speed slider
        var speedContainer = document.createElement("div");
        speedContainer.style.display = "flex";
        speedContainer.style.alignItems = "center";
        
        var speedLabel = document.createElement("label");
        speedLabel.innerHTML = `Speed: `;
        speedLabel.style.width = "50px";
        
        var slider = document.createElement("input");
        slider.type = "range";
        
        // Set appropriate min/max values based on mode
        if (mode === "IDLE") {
            slider.min = "0.0";  // IDLE should be completely stationary
            slider.max = "0.5";  // Very limited movement for IDLE if needed
            slider.step = "0.01"; // Finer control for IDLE
        } else {
            slider.min = "0.1";
            slider.max = "10.0";  // Allow higher speeds
            slider.step = "0.1";
        }
        
        slider.value = characterRegistry.getCharacter("Character_Enemy").getSpeed(mode);
        slider.style.flex = "1";
        slider.style.marginRight = "5px";
        
        var valueDisplay = document.createElement("span");
        valueDisplay.innerHTML = slider.value;
        valueDisplay.style.width = "30px";
        
        // Update value when slider changes
        slider.oninput = function() {
            valueDisplay.innerHTML = this.value;
            
            // Update the character's speed for this mode
            characterRegistry.getCharacter("Character_Enemy").setSpeed(mode, parseFloat(this.value));
            
            // If this is the current mode, update the vehicle speed immediately
            if (currentAIMode === mode) {
                vehicle.maxSpeed = parseFloat(this.value);
                
                // Force immediate velocity change to match the new speed
                if (vehicle.velocity.length() > 0) {
                    // For IDLE mode, completely stop the character if speed is 0
                    if (mode === "IDLE" && parseFloat(this.value) === 0) {
                        vehicle.velocity.set(0, 0, 0);
                    } else {
                        // For other modes, normalize and scale to the new max speed
                        vehicle.velocity.normalize().multiplyScalar(parseFloat(this.value));
                    }
                }
            }
        };
        
        speedContainer.appendChild(speedLabel);
        speedContainer.appendChild(slider);
        speedContainer.appendChild(valueDisplay);
        
        container.appendChild(speedContainer);
        speedControlsDiv.appendChild(container);
    });
    
    document.body.appendChild(speedControlsDiv);
}

// Load Models Async Function
function importModelAsync(model) {
    BABYLON.SceneLoader.ImportMeshAsync(null, "/models/", model, scene).then(function (result) {
        console.log("Model loaded successfully:", result);
        
        // Store the current character model name (without file extension)
        currentCharacterModel = model.split('.')[0];
        console.log("Current character model:", currentCharacterModel);
        
        // Setup Animations
        console.log("=== AVAILABLE ANIMATIONS ===");
        scene.animationGroups.forEach(animGroup => {
            console.log(`Animation found: "${animGroup.name}"`);
            availableAnimations[animGroup.name] = animGroup;
        });
        
        console.log("Available animation keys:", Object.keys(availableAnimations));
        
        // Debug: Check animation mapping for each mode
        console.log("=== ANIMATION MAPPING ===");
        Object.keys(AI_MODES).forEach(mode => {
            const animName = getCharacterAnimationForMode(currentCharacterModel, mode);
            console.log(`Mode ${mode} maps to animation "${animName}"`);
        });
        
        // Setup Player
        player = result.meshes[0];
        player.isPickable = false;
        
        // Make sure the model is visible with proper lighting
        result.meshes.forEach(mesh => {
            if (mesh.material) {
                mesh.material.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                mesh.receiveShadows = true;
            }
        });
        
        // Create a Main Player Transform Root
        playerTransform = new BABYLON.TransformNode("Player_Root", scene);    
        player.parent = playerTransform;
        
        // Position the player away from origin to start
        playerTransform.position = new BABYLON.Vector3(0, 0, 0);
        
        // Correct rotation - rotate 180 degrees to face the correct direction
        player.rotation = new BABYLON.Vector3(0, 0, 0);
        
        // Setup Arc Rotate Camera With Target
        createArcRotateCameraWithTarget(player);
        
        // Setup Yuka AI for the character
        setupYukaAI();
        
        // Set initial AI mode (patrol by default)
        // This will also set the correct animation for patrol mode
        setAIMode(AI_MODES.PATROL);
        
        // Debug: Check what animation is playing after initialization
        console.log("Current animation after initialization:", currentAnim ? currentAnim.name : "None");
    }).catch(error => {
        console.error("Error loading model:", error);
    });
}

// Play animation by name
function playAnimationByName(animationName) {
    if (!availableAnimations) return;
    
    console.log(`Attempting to play animation: "${animationName}"`);
    
    // Try different variations of the animation name
    let animation = null;
    
    // Try exact match first
    if (availableAnimations[animationName]) {
        animation = availableAnimations[animationName];
        console.log(`Found exact match for "${animationName}"`);
    } 
    // Try with CharacterArmature prefix
    else if (availableAnimations["CharacterArmature|" + animationName]) {
        animation = availableAnimations["CharacterArmature|" + animationName];
        console.log(`Found with CharacterArmature prefix: "CharacterArmature|${animationName}"`);
    }
    // Try case-insensitive search
    else {
        const lowerName = animationName.toLowerCase();
        for (const key in availableAnimations) {
            if (key.toLowerCase().includes(lowerName)) {
                animation = availableAnimations[key];
                console.log(`Found via case-insensitive search: "${key}" for "${animationName}"`);
                break;
            }
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
        console.log(`Successfully playing animation: "${animation.name}" for requested "${animationName}"`);
    } else {
        console.warn(`Animation not found: "${animationName}". Available animations:`, Object.keys(availableAnimations));
    }
}

// Set AI mode
function setAIMode(mode) {
    if (!vehicle) return;
    
    console.log("Setting AI mode to:", mode);
    currentAIMode = mode;
    
    // Clear all existing behaviors
    vehicle.steering.clear();
    
    // Get the character-specific animation for this mode
    const animationName = getCharacterAnimationForMode(currentCharacterModel, mode);
    console.log(`Using animation ${animationName} for mode ${mode}`);
    
    // Play the appropriate animation immediately
    playAnimationByName(animationName);
    
    // Get the character-specific speed for this mode
    const movementSpeed = getCharacterSpeed(currentCharacterModel, mode);
    console.log(`Setting ${currentCharacterModel} speed for ${mode} mode to ${movementSpeed}`);
    
    // Set the vehicle speed based on character config - IMMEDIATE CHANGE
    vehicle.maxSpeed = movementSpeed;
    
    // Force immediate velocity change to match the new speed
    if (vehicle.velocity.length() > 0) {
        // For IDLE mode, completely stop the character
        if (mode === AI_MODES.IDLE) {
            vehicle.velocity.set(0, 0, 0);
        } else {
            // For other modes, normalize and scale to the new max speed
            vehicle.velocity.normalize().multiplyScalar(movementSpeed);
        }
    }
    
    // Add appropriate steering behavior based on mode
    switch(mode) {
        case AI_MODES.PATROL:
            // IMPROVED PATROL BEHAVIOR TO PREVENT CIRCULAR PATTERNS
            
            // Store previous targets to avoid revisiting the same areas
            const previousTargets = [];
            const maxPreviousTargets = 5; // Remember the last 5 targets
            
            // Create a random target point that avoids previous locations
            const createRandomTarget = () => {
                // Create a random point within the map boundaries (with some margin)
                const margin = 10;
                let attempts = 0;
                let newTarget;
                let isFarEnough = true;
                
                do {
                    // On first attempt, try to create a target far from current position
                    if (attempts === 0 && vehicle.position) {
                        // Choose a quadrant opposite to current position
                        const quadrantX = vehicle.position.x > 0 ? -1 : 1;
                        const quadrantZ = vehicle.position.z > 0 ? -1 : 1;
                        
                        // Create a target in the opposite quadrant
                        const minX = quadrantX === -1 ? mapBoundaries.minX + margin : 0;
                        const maxX = quadrantX === -1 ? 0 : mapBoundaries.maxX - margin;
                        const minZ = quadrantZ === -1 ? mapBoundaries.minZ + margin : 0;
                        const maxZ = quadrantZ === -1 ? 0 : mapBoundaries.maxZ - margin;
                        
                        newTarget = new YUKA.Vector3(
                            Math.random() * (maxX - minX) + minX,
                            0,
                            Math.random() * (maxZ - minZ) + minZ
                        );
                    } else {
                        // Regular random target
                        newTarget = new YUKA.Vector3(
                            Math.random() * (mapBoundaries.maxX - mapBoundaries.minX - 2 * margin) + mapBoundaries.minX + margin,
                            0,
                            Math.random() * (mapBoundaries.maxZ - mapBoundaries.minZ - 2 * margin) + mapBoundaries.minZ + margin
                        );
                    }
                    
                    // Check if the new target is far enough from previous targets
                    isFarEnough = true; // Reset for each new target
                    if (previousTargets.length > 0) {
                        isFarEnough = previousTargets.every(target => {
                            return newTarget.distanceTo(target) > 15; // Minimum distance between targets
                        });
                    }
                    
                    attempts++;
                    
                    // If we've tried too many times, just accept the current target
                    if (attempts > 10) break;
                    
                } while (!isFarEnough);
                
                // Add to previous targets and remove oldest if needed
                previousTargets.push(newTarget);
                if (previousTargets.length > maxPreviousTargets) {
                    previousTargets.shift();
                }
                
                return newTarget;
            };
            
            // Create initial random target
            const initialTarget = createRandomTarget();
            console.log(`Initial patrol target: (${initialTarget.x.toFixed(2)}, ${initialTarget.z.toFixed(2)})`);
            
            // Add seek behavior to move toward the random target
            const seekBehavior = new YUKA.SeekBehavior(initialTarget);
            seekBehavior.weight = 1.0;
            vehicle.steering.add(seekBehavior);
            
            // Add obstacle avoidance with high priority
            const obstacleAvoidance = new YUKA.ObstacleAvoidanceBehavior(obstacles);
            obstacleAvoidance.weight = 3.0;
            vehicle.steering.add(obstacleAvoidance);
            
            // Add a small amount of wander to make movement less robotic
            const wanderBehavior = new YUKA.WanderBehavior();
            wanderBehavior.jitter = 0.2;  // Reduced jitter for more predictable movement
            wanderBehavior.radius = 2;
            wanderBehavior.distance = 5;
            wanderBehavior.weight = 0.3;  // Lower weight to reduce influence
            vehicle.steering.add(wanderBehavior);
            
            // Create a custom behavior to periodically change the target
            const targetChangeBehavior = {
                lastChangeTime: time.getElapsed(),
                changeInterval: 7 + Math.random() * 5, // 7-12 seconds between changes
                arrivalThreshold: 5, // Distance at which we consider target reached
                
                calculate: function(vehicle, force) {
                    const currentTime = time.getElapsed();
                    const distanceToTarget = vehicle.position.distanceTo(seekBehavior.target);
                    
                    // Change target if enough time has passed OR we've reached the current target
                    if ((currentTime - this.lastChangeTime > this.changeInterval) || 
                        (distanceToTarget < this.arrivalThreshold)) {
                        
                        // Create a new random target
                        const newTarget = createRandomTarget();
                        console.log(`New patrol target: (${newTarget.x.toFixed(2)}, ${newTarget.z.toFixed(2)}), distance from current: ${vehicle.position.distanceTo(newTarget).toFixed(2)}`);
                        
                        // Update the seek behavior's target
                        seekBehavior.target.copy(newTarget);
                        
                        // Reset the timer and set a new random interval
                        this.lastChangeTime = currentTime;
                        this.changeInterval = 7 + Math.random() * 5;
                        
                        // Add a stronger random impulse to break any patterns
                        const impulse = new YUKA.Vector3(
                            (Math.random() - 0.5) * 2,
                            0,
                            (Math.random() - 0.5) * 2
                        );
                        
                        impulse.normalize().multiplyScalar(vehicle.maxSpeed * 0.5);
                        force.add(impulse);
                    }
                    
                    return force;
                }
            };
            
            vehicle.steering.add(targetChangeBehavior);
            break;
            
        case AI_MODES.CHASE:
            // Chase mode - pursue a target (for now, just move faster in a direction)
            const chaseSeekBehavior = new YUKA.SeekBehavior(new YUKA.Vector3(
                Math.random() * 40 - 20, // Random X position
                0,
                Math.random() * 40 - 20  // Random Z position
            ));
            chaseSeekBehavior.weight = 1.0;
            vehicle.steering.add(chaseSeekBehavior);
            
            // Add obstacle avoidance with lower priority than seeking
            const chaseObstacleAvoidance = new YUKA.ObstacleAvoidanceBehavior(obstacles);
            chaseObstacleAvoidance.weight = 1.5;
            vehicle.steering.add(chaseObstacleAvoidance);
            break;
            
        case AI_MODES.FLEE:
            // Flee mode - run away from a point (opposite of seek)
            const fleeBehavior = new YUKA.FleeBehavior(new YUKA.Vector3(0, 0, 0)); // Flee from center
            fleeBehavior.weight = 1.5;
            fleeBehavior.panicDistance = 30; // Flee when within this distance
            vehicle.steering.add(fleeBehavior);
            
            // Add obstacle avoidance with lower priority than fleeing
            const fleeObstacleAvoidance = new YUKA.ObstacleAvoidanceBehavior(obstacles);
            fleeObstacleAvoidance.weight = 1.0;
            vehicle.steering.add(fleeObstacleAvoidance);
            break;
            
        case AI_MODES.IDLE:
            // Idle mode - completely stationary
            // No steering behaviors needed - the character should not move at all
            // We've already set velocity to zero above
            break;
    }
    
    console.log(`Set AI mode to ${mode} with appropriate behaviors`);
}

// Update animation based on the current AI mode (not speed)
function updateAnimationBasedOnSpeed() {
    if (!playerTransform) return;
    
    // We're not changing animation based on speed anymore
    // Just ensure the correct animation is playing for the current mode
    
    // If no animation is playing, start the appropriate one
    if (!currentAnim || !currentAnim.isPlaying) {
        const animationName = getCharacterAnimationForMode(currentCharacterModel, currentAIMode);
        playAnimationByName(animationName);
    }
}

// Create walls as obstacles for Yuka
function createWallsAsObstacles() {
    // Create invisible walls at the map boundaries
    const wallHeight = 10;
    const wallThickness = 5; 
    const wallBuffer = 5; // Buffer to position walls outside visible boundaries
    
    // Create obstacles for Yuka - just 4 walls, no corners
    // North wall
    createWallObstacle(
        0, wallHeight / 2, mapBoundaries.maxZ + wallBuffer,
        mapBoundaries.maxX - mapBoundaries.minX + wallThickness * 2, wallHeight, wallThickness,
        false // Make invisible
    );
    
    // South wall
    createWallObstacle(
        0, wallHeight / 2, mapBoundaries.minZ - wallBuffer,
        mapBoundaries.maxX - mapBoundaries.minX + wallThickness * 2, wallHeight, wallThickness,
        false // Make invisible
    );
    
    // East wall
    createWallObstacle(
        mapBoundaries.maxX + wallBuffer, wallHeight / 2, 0,
        wallThickness, wallHeight, mapBoundaries.maxZ - mapBoundaries.minZ + wallThickness * 2,
        false // Make invisible
    );
    
    // West wall
    createWallObstacle(
        mapBoundaries.minX - wallBuffer, wallHeight / 2, 0,
        wallThickness, wallHeight, mapBoundaries.maxZ - mapBoundaries.minZ + wallThickness * 2,
        false // Make invisible
    );
    
    console.log("Created 4 perimeter walls for Yuka");
}

// Create a wall obstacle for Yuka
function createWallObstacle(x, y, z, width, height, depth, visible = true) {
    try {
        let wallMesh;
        
        if (visible) {
            // Create a visible wall for debugging
            wallMesh = BABYLON.MeshBuilder.CreateBox("wall", {
                width: width,
                height: height,
                depth: depth
            }, scene);
            wallMesh.position = new BABYLON.Vector3(x, y, z);
            
            // Make the wall semi-transparent for visualization
            const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
            wallMat.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red color
            wallMat.alpha = 0.1; // Very transparent
            wallMesh.material = wallMat;
        }
        
        // Create a Yuka obstacle
        const obstacle = new YUKA.GameEntity();
        obstacle.position.set(x, y, z);
        
        // Set the obstacle's bounding radius to encompass the wall
        const radius = Math.max(width, depth) / 2;
        obstacle.boundingRadius = radius;
        
        // Add the obstacle to the obstacles array
        obstacles.push(obstacle);
        
        // Add the obstacle to the entity manager
        entityManager.add(obstacle);
        
        return { mesh: wallMesh, obstacle: obstacle };
    } catch (error) {
        console.error("Error creating wall obstacle:", error);
        return null;
    }
}

// Sync Babylon mesh with Yuka entity
function syncYukaWithBabylon() {
    if (!vehicle || !playerTransform || !player) return;
    
    try {
        // Update position
        playerTransform.position.x = vehicle.position.x;
        playerTransform.position.y = vehicle.position.y;
        playerTransform.position.z = vehicle.position.z;
        
        // Update rotation (Yuka uses a different coordinate system)
        const direction = vehicle.getDirection(new YUKA.Vector3());
        
        // Fix for backwards walking - rotate 180 degrees
        const angle = Math.atan2(direction.x, direction.z) + Math.PI;
        
        // Apply smoothing to rotation using vehicle's smoothingFactor
        if (player.rotation.y === undefined) {
            player.rotation.y = angle;
        } else {
            // Interpolate between current rotation and target rotation
            player.rotation.y = BABYLON.Scalar.Lerp(
                player.rotation.y,
                angle,
                vehicle.smoothingFactor
            );
        }
        
        // Only check for stuck in extreme cases
        if (Math.random() < 0.01) { // Only check 1% of the time
            checkAndRecoverIfStuck();
        }
    } catch (error) {
        console.error("Error syncing Babylon with Yuka:", error);
    }
}

// Variables to track if the character is stuck
var lastPosition = new YUKA.Vector3();
var stuckTime = 0;
var stuckThreshold = 3; // Increased to 3 seconds
var stuckDistance = 0.02; // Reduced for more accurate detection
var lastStuckTime = 0; // Track when we last applied a recovery force
var stuckCooldown = 10; // Increased cooldown period

// Check if the character is stuck and help it recover
function checkAndRecoverIfStuck() {
    if (!vehicle || currentAIMode !== AI_MODES.PATROL) return;
    
    const currentTime = time.getElapsed();
    const currentPosition = new YUKA.Vector3().copy(vehicle.position);
    const distance = currentPosition.distanceTo(lastPosition);
    
    // Only check for stuck if we're not in cooldown period
    if (currentTime - lastStuckTime > stuckCooldown) {
        if (distance < stuckDistance && vehicle.getSpeed() < 0.1) {
            stuckTime += time.getDelta();
            
            if (stuckTime > stuckThreshold) {
                console.log("Character appears to be stuck, applying recovery force");
                
                // Apply a stronger force toward the center of the map
                const toCenter = new YUKA.Vector3(-vehicle.position.x, 0, -vehicle.position.z).normalize();
                
                // Apply a strong impulse toward the center
                vehicle.velocity.add(toCenter.multiplyScalar(vehicle.maxSpeed * 5));
                
                // Reset stuck timer and set cooldown
                stuckTime = 0;
                lastStuckTime = currentTime;
            }
        } else {
            // Reset stuck timer if moving normally
            stuckTime = 0;
        }
    }
    
    // Update last position
    lastPosition.copy(currentPosition);
}

// Arc Rotate Camera with Target
function createArcRotateCameraWithTarget(target) {
    scene.activeCamera.dispose();
    var camera = new BABYLON.ArcRotateCamera("camera", 
        BABYLON.Tools.ToRadians(180), 
        BABYLON.Tools.ToRadians(60), 
        20, // Increased distance to see more of the scene
        new BABYLON.Vector3(0, 1.5, 0), 
        scene);
    camera.setTarget(target);
    camera.allowUpsideDown = false;
    camera.panningSensibility = 0;
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 40; // Increased max distance
    camera.upperBetaLimit = Math.PI / 2.2;
    camera.lowerBetaLimit = 0.1;
    camera.cameraAcceleration = .1;
    camera.maxCameraSpeed = 2;
    camera.pinchDeltaPercentage = 0.00060;
    camera.wheelPrecision = 20;
    scene.activeCamera = camera;
    camera.useBouncingBehavior = false;
    camera.useAutoRotationBehavior = false;
    camera.attachControl(canvas, true);
    
    // Add keyboard controls for camera
    setupKeyboardControls(camera);
}

// Setup keyboard controls for camera
function setupKeyboardControls(camera) {
    var keysDown = {};
    var moveSpeed = 0.1;
    
    scene.onKeyboardObservable.add((kbInfo) => {
        switch (kbInfo.type) {
            case BABYLON.KeyboardEventTypes.KEYDOWN:
                keysDown[kbInfo.event.key.toLowerCase()] = true;
                break;
            case BABYLON.KeyboardEventTypes.KEYUP:
                keysDown[kbInfo.event.key.toLowerCase()] = false;
                break;
        }
    });
    
    scene.onBeforeRenderObservable.add(() => {
        if (keysDown['w']) {
            camera.radius -= moveSpeed;
        }
        if (keysDown['s']) {
            camera.radius += moveSpeed;
        }
        if (keysDown['a']) {
            camera.alpha += moveSpeed;
        }
        if (keysDown['d']) {
            camera.alpha -= moveSpeed;
        }
    });
}

// Setup Yuka AI for the character
function setupYukaAI() {
    try {
        // Create a Yuka Vehicle for the character
        vehicle = new YUKA.Vehicle();
        
        // Set initial position to match the Babylon mesh
        vehicle.position.set(
            playerTransform.position.x,
            playerTransform.position.y,
            playerTransform.position.z
        );
        
        // Configure vehicle properties for extremely smooth movement
        // Initial speed will be set by setAIMode based on character config
        vehicle.maxSpeed = getCharacterSpeed(currentCharacterModel, AI_MODES.PATROL);
        vehicle.maxForce = 2.0; // Increased force for more immediate response
        vehicle.mass = 1.0; // Reduced mass for quicker acceleration
        vehicle.boundingRadius = 1; // Set bounding radius for collision detection
        
        // Extremely smooth turning
        vehicle.smoothingFactor = 0.95; // Very high smoothing factor
        
        // Add the vehicle to the entity manager
        entityManager.add(vehicle);
        
        console.log("Yuka AI setup complete");
    } catch (error) {
        console.error("Error setting up Yuka AI:", error);
    }
}

// On Document Loaded - Start Game
document.addEventListener("DOMContentLoaded", startGame);

// Resize Window
window.addEventListener("resize", function () {
    engine.resize();
}); 