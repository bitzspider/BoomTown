// On Document Loaded - Start Game
document.addEventListener("DOMContentLoaded", startGame);

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

// AI Variables
var aiEnabled = true;
var aiIdleTime = 0;
var aiMaxIdleTime = 3000; // Longer idle time (3 seconds)
var aiMinIdleTime = 1000; // Minimum idle time (1 second)
var aiState = "idle";
var aiCurrentPath = null;
var aiCurrentPathIndex = 0;
var aiPathUpdateInterval = null;
var aiPathTypes = ["patrol", "figure8", "diamond", "spiral", "random"];
var aiCurrentPathType = "patrol"; // Start with patrol path

// Map boundaries - invisible walls
var mapBoundaries = {
    minX: -45,
    maxX: 45,
    minZ: -45,
    maxZ: 45
};

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
        // Update movement on each frame
        if (isMoving && playerTransform && targetPosition) {
            updatePlayerMovement();
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
    
    // Create invisible walls
    createInvisibleWalls();

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
    instructionsDiv.innerHTML = "WASD to move camera<br>Character follows predefined paths";
    document.body.appendChild(instructionsDiv);
    
    // Add AI toggle button
    var aiToggleButton = document.createElement("button");
    aiToggleButton.style.position = "absolute";
    aiToggleButton.style.top = "10px";
    aiToggleButton.style.right = "10px";
    aiToggleButton.style.padding = "10px";
    aiToggleButton.style.borderRadius = "5px";
    aiToggleButton.style.backgroundColor = "#4CAF50";
    aiToggleButton.style.color = "white";
    aiToggleButton.style.border = "none";
    aiToggleButton.style.cursor = "pointer";
    aiToggleButton.innerHTML = "AI: ON";
    aiToggleButton.onclick = function() {
        aiEnabled = !aiEnabled;
        aiToggleButton.innerHTML = aiEnabled ? "AI: ON" : "AI: OFF";
        aiToggleButton.style.backgroundColor = aiEnabled ? "#4CAF50" : "#f44336";
        
        if (aiEnabled) {
            // If we're turning AI back on, start following the path
            startFollowingPath(aiCurrentPathType);
        } else {
            // If we're turning AI off, stop following the path
            stopFollowingPath();
            
            // Stop movement
            if (isMoving) {
                isMoving = false;
                playAnimation(idleAnim);
                aiState = "idle";
            }
        }
    };
    document.body.appendChild(aiToggleButton);
    
    // Add path selection dropdown
    var pathSelectDiv = document.createElement("div");
    pathSelectDiv.style.position = "absolute";
    pathSelectDiv.style.top = "10px";
    pathSelectDiv.style.right = "100px";
    pathSelectDiv.style.padding = "10px";
    pathSelectDiv.style.backgroundColor = "rgba(0,0,0,0.5)";
    pathSelectDiv.style.borderRadius = "5px";
    
    var pathSelectLabel = document.createElement("label");
    pathSelectLabel.style.color = "white";
    pathSelectLabel.style.marginRight = "10px";
    pathSelectLabel.innerHTML = "Path: ";
    
    var pathSelect = document.createElement("select");
    pathSelect.style.padding = "5px";
    pathSelect.style.borderRadius = "3px";
    
    // Add options for each path type
    aiPathTypes.forEach(pathType => {
        var option = document.createElement("option");
        option.value = pathType;
        option.text = pathType.charAt(0).toUpperCase() + pathType.slice(1);
        pathSelect.appendChild(option);
    });
    
    // Set default value
    pathSelect.value = aiCurrentPathType;
    
    // Add change event
    pathSelect.onchange = function() {
        aiCurrentPathType = this.value;
        if (aiEnabled) {
            startFollowingPath(aiCurrentPathType);
        }
    };
    
    pathSelectDiv.appendChild(pathSelectLabel);
    pathSelectDiv.appendChild(pathSelect);
    document.body.appendChild(pathSelectDiv);
}

// Load Models Async Function
function importModelAsync(model) {
    BABYLON.SceneLoader.ImportMeshAsync(null, "/models/", model, scene).then(function (result) {
        console.log("Model loaded successfully:", result);
        
        // Setup Animations
        scene.animationGroups.forEach(animGroup => {
            console.log("Animation found:", animGroup.name);
            availableAnimations[animGroup.name] = animGroup;
            
            // Store common animations in variables for easy access
            if (animGroup.name.toLowerCase().includes("idle")) {
                idleAnim = animGroup;
            } else if (animGroup.name.toLowerCase().includes("walk")) {
                walkAnim = animGroup;
            } else if (animGroup.name.toLowerCase().includes("run")) {
                runAnim = animGroup;
            } else if (animGroup.name.toLowerCase().includes("turn") && animGroup.name.toLowerCase().includes("left")) {
                turnLeftAnim = animGroup;
            } else if (animGroup.name.toLowerCase().includes("turn") && animGroup.name.toLowerCase().includes("right")) {
                turnRightAnim = animGroup;
            } else if (animGroup.name.toLowerCase().includes("look") || 
                      (animGroup.name.toLowerCase().includes("head") && animGroup.name.toLowerCase().includes("move"))) {
                lookAroundAnim = animGroup;
            }
        });
        
        console.log("Available animations:", Object.keys(availableAnimations));
        
        // Setup Player
        player = result.meshes[0];
        player.isPickable = false;
        
        // Make sure the model is visible with proper lighting
        result.meshes.forEach(mesh => {
            if (mesh.material) {
                mesh.material.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
                mesh.material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                mesh.material.diffuseColor = new BABYLON.Color3(1, 1, 1);
                mesh.material.alpha = 1.0;
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
        
        // Start with idle animation
        if (idleAnim) {
            idleAnim.start(true);
            currentAnim = idleAnim;
        }

        // Setup Navigation
        setupNavigation();

        // Setup Arc Rotate Camera With Target
        createArcRotateCameraWithTarget(player);
        
        // Start following the patrol path after a short delay
        setTimeout(() => {
            startFollowingPath(aiCurrentPathType);
        }, 1000);
    }).catch(error => {
        console.error("Error loading model:", error);
    });
}

// Start following a path
function startFollowingPath(pathType) {
    // Stop any existing path following
    stopFollowingPath();
    
    console.log("Starting to follow path:", pathType);
    
    // Get the path
    aiCurrentPath = getPath(pathType);
    aiCurrentPathIndex = 0;
    
    // Convert path to waypoints
    const waypoints = pathToWaypoints(aiCurrentPath);
    
    // First, check if we're too close to a wall
    const currentPosition = playerTransform.position;
    const tooCloseToWall = 
        currentPosition.x < mapBoundaries.minX + 5 || 
        currentPosition.x > mapBoundaries.maxX - 5 || 
        currentPosition.z < mapBoundaries.minZ + 5 || 
        currentPosition.z > mapBoundaries.maxZ - 5;
    
    if (tooCloseToWall) {
        console.log("Too close to wall, moving to center first");
        // Move to center of map first
        const centerPosition = new BABYLON.Vector3(0, 0, 0);
        moveToPointWithAnimation(centerPosition, runAnim);
        
        // After reaching center, start following the path
        setTimeout(() => {
            startFollowingPath(pathType);
        }, 3000);
        return;
    }
    
    // Calculate distance to each waypoint to find the closest one
    let closestIndex = 0;
    let closestDistance = Number.MAX_VALUE;
    waypoints.forEach((waypoint, index) => {
        const distance = BABYLON.Vector3.Distance(playerTransform.position, waypoint);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
        }
    });
    
    // Start from the closest waypoint
    aiCurrentPathIndex = closestIndex;
    
    // Begin following the path
    followPathPoint();
}

// Stop following the current path
function stopFollowingPath() {
    if (aiPathUpdateInterval) {
        clearTimeout(aiPathUpdateInterval);
        aiPathUpdateInterval = null;
    }
}

// Follow the next point in the path
function followPathPoint() {
    if (!aiEnabled || !aiCurrentPath) return;
    
    // Get the current waypoint
    const waypoints = pathToWaypoints(aiCurrentPath);
    const currentWaypoint = waypoints[aiCurrentPathIndex];
    
    console.log("Following path point", aiCurrentPathIndex, "of", aiCurrentPath.length);
    
    // Move to the waypoint
    moveToPointWithAnimation(currentWaypoint, walkAnim);
    
    // Calculate distance to current waypoint
    const distanceToWaypoint = BABYLON.Vector3.Distance(playerTransform.position, currentWaypoint);
    
    // If we're close enough to the current waypoint, move to the next one
    if (distanceToWaypoint < 2) {
        // Increment the path index
        aiCurrentPathIndex = (aiCurrentPathIndex + 1) % aiCurrentPath.length;
        
        // Add some randomization to the timing to make movement more natural
        const delay = 500 + Math.random() * 300; // 500-800ms delay
        aiPathUpdateInterval = setTimeout(followPathPoint, delay);
    } else {
        // If we're not close enough yet, check again soon
        aiPathUpdateInterval = setTimeout(followPathPoint, 200);
    }
}

// Move to a point with a specific animation
function moveToPointWithAnimation(point, animation) {
    if (!playerTransform || !point) return;
    
    // Set target position
    targetPosition = point.clone();
    targetPosition.y = playerTransform.position.y;
    
    // Calculate direction to target
    const direction = targetPosition.subtract(playerTransform.position);
    const distance = direction.length();
    
    // Only start moving if we're not too close
    if (distance > 0.5) {
        // Start moving - immediate state change
        isMoving = true;
        lastUpdateTime = performance.now();
        
        // Instant animation change
        playAnimation(animation);
        
        // Set speed immediately - no acceleration
        if (animation === runAnim) {
            currentSpeed = runSpeed;
            aiState = "running";
        } else {
            currentSpeed = moveSpeed;
            aiState = "walking";
        }
        
        // Calculate and apply initial rotation immediately
        const targetAngle = Math.atan2(direction.x, direction.z);
        player.rotation.y = targetAngle;
    }
}

// Create invisible walls to keep the character within the map boundaries
function createInvisibleWalls() {
    // Create invisible walls at the map boundaries
    const wallHeight = 10;
    const wallThickness = 1;
    
    // North wall
    const northWall = BABYLON.MeshBuilder.CreateBox("northWall", {
        width: mapBoundaries.maxX - mapBoundaries.minX + wallThickness * 2,
        height: wallHeight,
        depth: wallThickness
    }, scene);
    northWall.position = new BABYLON.Vector3(0, wallHeight / 2, mapBoundaries.maxZ + wallThickness / 2);
    northWall.isVisible = false;
    northWall.checkCollisions = true;
    
    // South wall
    const southWall = BABYLON.MeshBuilder.CreateBox("southWall", {
        width: mapBoundaries.maxX - mapBoundaries.minX + wallThickness * 2,
        height: wallHeight,
        depth: wallThickness
    }, scene);
    southWall.position = new BABYLON.Vector3(0, wallHeight / 2, mapBoundaries.minZ - wallThickness / 2);
    southWall.isVisible = false;
    southWall.checkCollisions = true;
    
    // East wall
    const eastWall = BABYLON.MeshBuilder.CreateBox("eastWall", {
        width: wallThickness,
        height: wallHeight,
        depth: mapBoundaries.maxZ - mapBoundaries.minZ + wallThickness * 2
    }, scene);
    eastWall.position = new BABYLON.Vector3(mapBoundaries.maxX + wallThickness / 2, wallHeight / 2, 0);
    eastWall.isVisible = false;
    eastWall.checkCollisions = true;
    
    // West wall
    const westWall = BABYLON.MeshBuilder.CreateBox("westWall", {
        width: wallThickness,
        height: wallHeight,
        depth: mapBoundaries.maxZ - mapBoundaries.minZ + wallThickness * 2
    }, scene);
    westWall.position = new BABYLON.Vector3(mapBoundaries.minX - wallThickness / 2, wallHeight / 2, 0);
    westWall.isVisible = false;
    westWall.checkCollisions = true;
}

// Setup Navigation
function setupNavigation() {
    // No click-to-move functionality - character follows predefined paths
    console.log("Navigation setup - character follows predefined paths");
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

// Variables for movement
var isMoving = false;
var targetPosition = null;
var moveSpeed = 0.1;
var runSpeed = 0.2;
var turnSpeed = 0.1;
var lastUpdateTime = 0;
var currentSpeed = 0;

// Update player movement
function updatePlayerMovement() {
    if (!isMoving || !playerTransform || !targetPosition) {
        return;
    }
    
    var currentTime = performance.now();
    var deltaTime = (currentTime - lastUpdateTime) / 1000;
    lastUpdateTime = currentTime;
    
    // Calculate direction to target
    var direction = targetPosition.subtract(playerTransform.position);
    direction.y = 0; // Keep movement on the ground plane
    var distance = direction.length();
    
    // If we've reached the target (within a small threshold), stop immediately
    if (distance < 0.5) {
        isMoving = false;
        playAnimation(idleAnim);
        return;
    }
    
    // Normalize direction and apply full speed immediately
    direction.normalize();
    
    // Calculate target angle for instant rotation
    var targetAngle = Math.atan2(direction.x, direction.z);
    
    // Instant rotation - no interpolation
    player.rotation.y = targetAngle;
    
    // Move at full speed - no acceleration
    var movement = direction.scale(currentSpeed);
    var newPosition = playerTransform.position.add(movement);
    
    // Clamp to map boundaries
    newPosition.x = Math.max(mapBoundaries.minX + 2, Math.min(mapBoundaries.maxX - 2, newPosition.x));
    newPosition.z = Math.max(mapBoundaries.minZ + 2, Math.min(mapBoundaries.maxZ - 2, newPosition.z));
    
    // Apply new position immediately
    playerTransform.position = newPosition;
}

// Rotate the character to face a specific angle
function rotateTo(targetAngle) {
    if (!player) return;
    
    // Use turn animations if available
    const currentAngle = player.rotation.y;
    let normalizedDiff = targetAngle - currentAngle;
    
    // Normalize to [-PI, PI]
    while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
    while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;
    
    // Determine if we should use turn animations
    if (Math.abs(normalizedDiff) > 0.3) { // Only use turn animations for significant turns
        if (normalizedDiff > 0 && turnRightAnim) {
            // Turn right
            playAnimation(turnRightAnim);
            setTimeout(() => {
                // After animation completes, set the final rotation
                player.rotation.y = targetAngle;
                // Return to idle
                if (!isMoving) {
                    playAnimation(idleAnim);
                }
            }, turnRightAnim.to / 30 * 1000); // Convert animation frames to milliseconds
            return;
        } else if (normalizedDiff < 0 && turnLeftAnim) {
            // Turn left
            playAnimation(turnLeftAnim);
            setTimeout(() => {
                // After animation completes, set the final rotation
                player.rotation.y = targetAngle;
                // Return to idle
                if (!isMoving) {
                    playAnimation(idleAnim);
                }
            }, turnLeftAnim.to / 30 * 1000); // Convert animation frames to milliseconds
            return;
        }
    }
    
    // If we don't have turn animations or the turn is small, use the default rotation
    // Set up a rotation animation
    const duration = 0.5 + Math.abs(normalizedDiff) / Math.PI;
    
    // Create animation
    const rotationAnimation = new BABYLON.Animation(
        "rotationAnimation",
        "rotation.y",
        30,
        BABYLON.Animation.ANIMATIONTYPE_FLOAT,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    // Animation keys
    const keys = [
        { frame: 0, value: currentAngle },
        { frame: 30 * duration, value: currentAngle + normalizedDiff }
    ];
    
    rotationAnimation.setKeys(keys);
    
    // Stop any existing animations
    player.animations = [];
    
    // Start the animation
    scene.beginDirectAnimation(
        player,
        [rotationAnimation],
        0,
        30 * duration,
        false,
        1,
        function() {
            // Animation complete callback
            if (!isMoving && lookAroundAnim) {
                // 30% chance to look around after turning
                if (Math.random() < 0.3) {
                    playAnimation(lookAroundAnim);
                    setTimeout(() => {
                        if (!isMoving) {
                            playAnimation(idleAnim);
                        }
                    }, lookAroundAnim.to / 30 * 1000);
                }
            }
        }
    );
}

// Play animation
function playAnimation(animation) {
    if (!animation) return;
    if (currentAnim === animation) return;
    
    if (currentAnim) {
        currentAnim.stop();
    }
    
    animation.start(true);
    currentAnim = animation;
}

// Resize Window
window.addEventListener("resize", function () {
    engine.resize();
}); 