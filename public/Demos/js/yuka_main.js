// Yuka + BabylonJS Integration
// Main file for character movement with Yuka AI

// Character AI Modes
const AI_MODES = {
    PATROL: 'PATROL',
    // For now, only PATROL is implemented.
    IDLE: 'IDLE',
    CHASE: 'CHASE',
    FLEE: 'FLEE'
};

// Global BabylonJS Variables
var canvas;
var engine;
var scene;
var dirLight;
var hemisphericLight;
var hudDiv = null; // Add this line to track the HUD element

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
var vehicle = null; // Yuka vehicle for the character
var obstacles = []; // Array to store obstacles (walls)
var path = null; // Path for the character to follow

// AI State Variables
var aiMode = AI_MODES.PATROL;
var aiCurrentPath = null;
var aiCurrentPathIndex = 0;

// Current AI mode
var currentAIMode = AI_MODES.PATROL;

// Store the current character model name (without file extension)
var currentCharacterModel = null;

// Global variables for path visualization
let pathLines = [];
let waypointMarkers = [];
let showWaypoints = true;

// Add these global variables after the other global variables
var projectiles = []; // Array to store active projectiles
var lastShootTime = 0; // For rate limiting shooting
var shootCooldown = 0.5; // Cooldown between shots in seconds

// Add this global variable to store the gun mesh reference
var gunMesh = null;

// Initialize the game after all declarations
function initializeGame() {
    canvas = document.getElementById("renderCanvas");
    engine = new BABYLON.Engine(canvas, true);
    scene = createScene(engine, canvas);
    dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(0,0,0), scene);
    hemisphericLight = new BABYLON.HemisphericLight("hemisphericLight", new BABYLON.Vector3(0, 1, 0), scene);
}

// Call initialization after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    initializeGame();
    startGame();
});

// Create Scene
function createScene(engine, canvas) {
    console.log("Creating scene...");
    
    // Create new scene
    const scene = new BABYLON.Scene(engine);
    console.log("Scene created");
    
    // Enable keyboard controls
    scene.actionManager = new BABYLON.ActionManager(scene);
    console.log("Action manager initialized");
    
    // Create Default Camera
    var camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    console.log("Initial camera setup complete");
    
    // Directional Light
    dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(0, 10, 10), scene);
    dirLight.intensity = 1.0;
    dirLight.position = new BABYLON.Vector3(0, 10, 10);
    dirLight.direction = new BABYLON.Vector3(-2, -4, -5);
    console.log("Directional light setup complete");
    
    // Hemispheric Light for ambient lighting
    hemisphericLight = new BABYLON.HemisphericLight("hemisphericLight", new BABYLON.Vector3(0, 1, 0), scene);
    hemisphericLight.intensity = 0.7;
    console.log("Hemispheric light setup complete");
    
    // Ground
    ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 100, height: 100, subdivisions: 20}, scene);
    ground.isPickable = true;
    groundMat = new BABYLON.StandardMaterial("groundMaterial", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    groundMat.wireframe = true;
    ground.material = groundMat;
    console.log("Ground setup complete");
    
    // Create invisible walls as obstacles for Yuka
    createWallsAsObstacles();
    
    return scene;
}

// Start Game
async function startGame() {
    try {
        console.log("Starting game initialization...");
        
        // Set Canvas & Engine
        canvas = document.getElementById("renderCanvas");
        if (!canvas) {
            throw new Error("Canvas element not found!");
        }
        console.log("Canvas element found");
        
        engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
        console.log("Engine created");
        
        scene = createScene(engine, canvas);
        console.log("Scene created and assigned");
        
        // Set up render loop first
        engine.runRenderLoop(function () {
            if (scene) {
                // Update time and get delta
                const deltaTime = time.update().getDelta();
                
                // Update AI and movement
                if (vehicle && playerTransform) {
                    updateAI(deltaTime);
                    entityManager.update(deltaTime);
                }
                
                // Update projectiles
                updateProjectiles(deltaTime);
                
                scene.render();
            }
        });
        console.log("Render loop started");
        
        // Handle window resize
        window.addEventListener("resize", function () {
            if (engine) {
                engine.resize();
            }
        });
        console.log("Window resize handler added");
        
        // Add stats display
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
            if (engine) {
                statsDiv.innerHTML = "<b>" + Math.round(engine.getFps()) + " FPS</b> ";
            }
        }, 100);
        
        // Import Character - wait for it to complete
        console.log("Starting character import...");
        await importModelAsync("Character_Enemy.glb");
        console.log("Character import completed successfully");
        
        // Remove this line as we'll show the HUD only on character click
        // createSpeedAdjustmentControls();
        
        console.log("Game initialization complete");
    } catch (error) {
        console.error("Error during game initialization:", error);
        // Display error to user
        const errorDiv = document.createElement("div");
        errorDiv.style.position = "absolute";
        errorDiv.style.top = "50%";
        errorDiv.style.left = "50%";
        errorDiv.style.transform = "translate(-50%, -50%)";
        errorDiv.style.color = "white";
        errorDiv.style.backgroundColor = "rgba(255,0,0,0.8)";
        errorDiv.style.padding = "20px";
        errorDiv.style.borderRadius = "5px";
        errorDiv.style.fontFamily = "Arial, sans-serif";
        errorDiv.innerHTML = `Error: ${error.message}`;
        document.body.appendChild(errorDiv);
    }
}

// Create speed adjustment controls
function createSpeedAdjustmentControls() {
    // Remove existing HUD if it exists
    if (hudDiv) {
        hudDiv.remove();
    }

    hudDiv = document.createElement("div");
    hudDiv.style.position = "absolute";
    hudDiv.style.top = "60px";
    hudDiv.style.right = "10px";
    hudDiv.style.padding = "10px";
    hudDiv.style.backgroundColor = "rgba(0,0,0,0.7)";
    hudDiv.style.borderRadius = "5px";
    hudDiv.style.color = "white";
    hudDiv.style.width = "300px";
    hudDiv.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    
    // Add close button
    var closeButton = document.createElement("div");
    closeButton.innerHTML = "×";
    closeButton.style.position = "absolute";
    closeButton.style.right = "10px";
    closeButton.style.top = "5px";
    closeButton.style.fontSize = "20px";
    closeButton.style.cursor = "pointer";
    closeButton.style.width = "20px";
    closeButton.style.height = "20px";
    closeButton.style.textAlign = "center";
    closeButton.style.lineHeight = "20px";
    closeButton.style.color = "#fff";
    closeButton.style.borderRadius = "50%";
    closeButton.style.backgroundColor = "rgba(255,255,255,0.2)";
    closeButton.onmouseover = function() {
        this.style.backgroundColor = "rgba(255,255,255,0.3)";
    };
    closeButton.onmouseout = function() {
        this.style.backgroundColor = "rgba(255,255,255,0.2)";
    };
    closeButton.onclick = function() {
        hudDiv.remove();
        hudDiv = null;
    };
    hudDiv.appendChild(closeButton);
    
    // Character name header
    var nameHeader = document.createElement("h2");
    nameHeader.innerHTML = "Gunny";
    nameHeader.style.margin = "0 0 5px 0";
    nameHeader.style.fontSize = "22px";
    nameHeader.style.paddingRight = "20px"; // Make room for close button
    nameHeader.style.color = "#ffcc66"; // Gold color for the name
    nameHeader.style.textShadow = "1px 1px 2px rgba(0,0,0,0.5)";
    hudDiv.appendChild(nameHeader);
    
    // Add shoot button
    var shootButtonContainer = document.createElement("div");
    shootButtonContainer.style.marginBottom = "15px";
    shootButtonContainer.style.textAlign = "center";
    
    var shootButton = document.createElement("button");
    shootButton.innerHTML = "SHOOT";
    shootButton.style.backgroundColor = "#ff6600";
    shootButton.style.color = "white";
    shootButton.style.border = "none";
    shootButton.style.padding = "8px 20px";
    shootButton.style.borderRadius = "4px";
    shootButton.style.fontSize = "16px";
    shootButton.style.fontWeight = "bold";
    shootButton.style.cursor = "pointer";
    shootButton.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
    shootButton.style.transition = "background-color 0.2s";
    
    shootButton.onmouseover = function() {
        this.style.backgroundColor = "#ff8533";
    };
    
    shootButton.onmouseout = function() {
        this.style.backgroundColor = "#ff6600";
    };
    
    shootButton.onmousedown = function() {
        this.style.backgroundColor = "#cc5200";
        this.style.transform = "translateY(2px)";
    };
    
    shootButton.onmouseup = function() {
        this.style.backgroundColor = "#ff6600";
        this.style.transform = "translateY(0)";
    };
    
    shootButton.onclick = function() {
        shootProjectile();
    };
    
    shootButtonContainer.appendChild(shootButton);
    hudDiv.appendChild(shootButtonContainer);
    
    // Character Settings title
    var title = document.createElement("h3");
    title.innerHTML = "Character Settings";
    title.style.margin = "0 0 15px 0";
    title.style.fontSize = "16px";
    title.style.paddingRight = "20px"; // Make room for close button
    title.style.opacity = "0.8";
    hudDiv.appendChild(title);
    
    // Current Mode Display (non-changeable)
    var modeContainer = document.createElement("div");
    modeContainer.style.marginBottom = "15px";
    modeContainer.style.padding = "8px";
    modeContainer.style.backgroundColor = "rgba(255,255,255,0.1)";
    modeContainer.style.borderRadius = "4px";
    modeContainer.style.borderLeft = "3px solid #66aaff";
    
    var modeLabel = document.createElement("div");
    modeLabel.innerHTML = "Current Mode:";
    modeLabel.style.fontSize = "14px";
    modeLabel.style.marginBottom = "5px";
    modeLabel.style.opacity = "0.8";
    modeContainer.appendChild(modeLabel);
    
    var modeValue = document.createElement("div");
    modeValue.innerHTML = `<strong>${currentAIMode}</strong>`;
    modeValue.style.fontSize = "16px";
    modeValue.style.color = "#66aaff"; // Blue color for the mode
    modeContainer.appendChild(modeValue);
    
    // Animation info
    var animLabel = document.createElement("div");
    const animName = characterRegistry.getCharacter("Character_Enemy").getAnimationForMode(currentAIMode);
    animLabel.innerHTML = `Animation: <span style="color:#aaffaa">${animName}</span>`;
    animLabel.style.fontSize = "12px";
    animLabel.style.marginTop = "5px";
    modeContainer.appendChild(animLabel);
    
    hudDiv.appendChild(modeContainer);
    
    // Add waypoint visibility toggle
    var waypointContainer = document.createElement("div");
    waypointContainer.style.marginBottom = "15px";
    waypointContainer.style.padding = "5px";
    waypointContainer.style.borderBottom = "1px solid rgba(255,255,255,0.2)";

    var waypointCheckbox = document.createElement("input");
    waypointCheckbox.type = "checkbox";
    waypointCheckbox.id = "showWaypoints";
    waypointCheckbox.checked = showWaypoints;
    waypointCheckbox.style.marginRight = "10px";

    var waypointLabel = document.createElement("label");
    waypointLabel.htmlFor = "showWaypoints";
    waypointLabel.innerHTML = "Show Waypoints";
    waypointLabel.style.cursor = "pointer";

    waypointCheckbox.onchange = function() {
        showWaypoints = this.checked;
        updateWaypointVisibility();
    };

    waypointContainer.appendChild(waypointCheckbox);
    waypointContainer.appendChild(waypointLabel);
    hudDiv.appendChild(waypointContainer);
    
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
        hudDiv.appendChild(container);
    });
    
    document.body.appendChild(hudDiv);
}

// Load Models Async Function
function importModelAsync(model) {
    console.log("Starting model import for:", model);
    
    // Verify the model parameter
    if (!model) {
        console.error("No model specified for import");
        return Promise.reject(new Error("No model specified"));
    }
    
    // Clear any existing model
    if (player) {
        console.log("Disposing existing player model");
        player.dispose();
        player = null;
    }
    if (playerTransform) {
        console.log("Disposing existing player transform");
        playerTransform.dispose();
        playerTransform = null;
    }
    
    // Ensure scene is ready
    if (!scene) {
        console.error("Scene not initialized");
        return Promise.reject(new Error("Scene not initialized"));
    }
    
    const modelPath = "/models/";
    console.log("Loading model from path:", modelPath + model);
    
    return BABYLON.SceneLoader.ImportMeshAsync("", modelPath, model, scene).then(function (result) {
        console.log("Model loaded successfully:", result);
        console.log("Number of meshes:", result.meshes.length);
        
        if (!result.meshes || result.meshes.length === 0) {
            throw new Error("No meshes found in loaded model");
        }
        
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
        
        // Setup Player - include ALL meshes
        player = result.meshes[0];
        console.log("Player root mesh assigned:", player.name);
        
        // Log all meshes in hierarchy
        result.meshes.forEach((mesh, index) => {
            console.log(`Mesh ${index}:`, mesh.name);
        });
        
        // Make sure all meshes are visible with proper lighting
        result.meshes.forEach((mesh, index) => {
            if (mesh.material) {
                mesh.material.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                mesh.receiveShadows = true;
            }
        });
        
        // Create a Main Player Transform Root
        playerTransform = new BABYLON.TransformNode("Player_Root", scene);    
        player.parent = playerTransform;
        
        // Position the player at origin
        playerTransform.position = new BABYLON.Vector3(0, 0, 0);
        console.log("Player positioned at origin");
        
        // Correct rotation - rotate 180 degrees to face the correct direction
        player.rotation = new BABYLON.Vector3(0, Math.PI, 0);
        console.log("Player rotation corrected");
        
        // Setup character selection with enhanced interaction
        setupCharacterSelection();
        
        // Setup Arc Rotate Camera With Target
        createArcRotateCameraWithTarget(player);
        
        // Initialize patrol path
        aiCurrentPath = getPath("patrol");
        aiCurrentPathIndex = 0;
        console.log("Initialized patrol path:", aiCurrentPath);
        
        // Setup Yuka AI for the character
        setupYukaAI();
        
        // Set initial AI mode (patrol by default)
        setAIMode(AI_MODES.PATROL);
        
        // Find the gun mesh in the hierarchy
        console.log("Searching for gun mesh in model hierarchy...");
        result.meshes.forEach((mesh, index) => {
            // Look for mesh names that might represent a gun
            if (mesh.name.toLowerCase().includes("gun") || 
                mesh.name.toLowerCase().includes("weapon") || 
                mesh.name.toLowerCase().includes("pistol") ||
                mesh.name.toLowerCase().includes("rifle")) {
                console.log(`Found potential gun mesh: ${mesh.name}`);
                gunMesh = mesh;
            }
        });
        
        // If we couldn't find a gun mesh by name, we'll use a child mesh as a fallback
        if (!gunMesh && player.getChildMeshes && player.getChildMeshes().length > 0) {
            // Try to find a mesh that's positioned where a gun would be (right hand area)
            const childMeshes = player.getChildMeshes();
            for (const mesh of childMeshes) {
                // This is a heuristic - we're looking for meshes that might be in the right hand position
                if (mesh.position.y > 0.5 && mesh.position.x > 0) {
                    console.log(`Using mesh as gun reference: ${mesh.name}`);
                    gunMesh = mesh;
                    break;
                }
            }
            
            // If we still don't have a gun mesh, just use the first child mesh
            if (!gunMesh && childMeshes.length > 0) {
                gunMesh = childMeshes[0];
                console.log(`Fallback: Using first child mesh as gun reference: ${gunMesh.name}`);
            }
        }
        
        console.log("Character initialization complete");
        return true;
    }).catch(error => {
        console.error("Error loading model:", error);
        throw error;
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
    aiMode = mode;
    
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
    
    // Add appropriate steering behavior based on mode
    switch(mode) {
        case AI_MODES.PATROL:
            // Initialize patrol path if not already set
            if (!aiCurrentPath || aiCurrentPathIndex === 0) {
                aiCurrentPath = getPath("patrol");
                aiCurrentPathIndex = 0;
                visualizePatrolPath(aiCurrentPath);
                console.log("New patrol path generated:", aiCurrentPath);
            }
            
            // Set initial velocity and direction
            if (aiCurrentPath && aiCurrentPath.length > 0) {
                const target = aiCurrentPath[aiCurrentPathIndex];
                const dx = target.x - vehicle.position.x;
                const dz = target.z - vehicle.position.z;
                vehicle.velocity.x = dx;
                vehicle.velocity.z = dz;
                vehicle.velocity.normalize().multiplyScalar(vehicle.maxSpeed);
                console.log("Initial patrol velocity set:", vehicle.velocity);
            }
            break;
            
        case AI_MODES.CHASE:
            // Chase mode with direct velocity control
            const chaseTarget = new YUKA.Vector3(
                Math.random() * 40 - 20,
                0,
                Math.random() * 40 - 20
            );
            const toChaseTarget = new YUKA.Vector3()
                .subVectors(chaseTarget, vehicle.position)
                .normalize();
            vehicle.velocity.copy(toChaseTarget).multiplyScalar(vehicle.maxSpeed);
            break;
            
        case AI_MODES.FLEE:
            // Flee mode with direct velocity control
            const fromCenter = new YUKA.Vector3()
                .subVectors(vehicle.position, new YUKA.Vector3(0, 0, 0))
                .normalize();
            vehicle.velocity.copy(fromCenter).multiplyScalar(vehicle.maxSpeed);
            break;
            
        case AI_MODES.IDLE:
            // Idle mode - instant stop
            vehicle.velocity.set(0, 0, 0);
            break;
    }
    
    console.log("Current velocity:", vehicle.velocity);
    console.log("Current speed:", vehicle.getSpeed());
    
    vehicle.updateNeeded = true;
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
        0, wallHeight / 2, MAP_BOUNDARIES.maxZ + wallBuffer,
        MAP_BOUNDARIES.maxX - MAP_BOUNDARIES.minX + wallThickness * 2, wallHeight, wallThickness,
        false // Make invisible
    );
    
    // South wall
    createWallObstacle(
        0, wallHeight / 2, MAP_BOUNDARIES.minZ - wallBuffer,
        MAP_BOUNDARIES.maxX - MAP_BOUNDARIES.minX + wallThickness * 2, wallHeight, wallThickness,
        false // Make invisible
    );
    
    // East wall
    createWallObstacle(
        MAP_BOUNDARIES.maxX + wallBuffer, wallHeight / 2, 0,
        wallThickness, wallHeight, MAP_BOUNDARIES.maxZ - MAP_BOUNDARIES.minZ + wallThickness * 2,
        false // Make invisible
    );
    
    // West wall
    createWallObstacle(
        MAP_BOUNDARIES.minX - wallBuffer, wallHeight / 2, 0,
        wallThickness, wallHeight, MAP_BOUNDARIES.maxZ - MAP_BOUNDARIES.minZ + wallThickness * 2,
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
        // Update position directly
        playerTransform.position.x = vehicle.position.x;
        playerTransform.position.y = vehicle.position.y;
        playerTransform.position.z = vehicle.position.z;
        
        // Update rotation based on velocity direction
        if (vehicle.velocity.length() > 0.01) {
            // Get the forward direction of the vehicle
            const direction = vehicle.getDirection(new YUKA.Vector3());
            
            // Calculate the angle and add PI to face the correct direction
            const angle = Math.atan2(direction.x, direction.z) + Math.PI;
            player.rotation.y = angle;
        }
        
        // Clamp position to map boundaries and handle collisions
        if (playerTransform.position.x < MAP_BOUNDARIES.minX) {
            playerTransform.position.x = MAP_BOUNDARIES.minX;
            vehicle.position.x = MAP_BOUNDARIES.minX;
            vehicle.velocity.x = Math.abs(vehicle.velocity.x); // Bounce off wall
        } else if (playerTransform.position.x > MAP_BOUNDARIES.maxX) {
            playerTransform.position.x = MAP_BOUNDARIES.maxX;
            vehicle.position.x = MAP_BOUNDARIES.maxX;
            vehicle.velocity.x = -Math.abs(vehicle.velocity.x); // Bounce off wall
        }
        
        if (playerTransform.position.z < MAP_BOUNDARIES.minZ) {
            playerTransform.position.z = MAP_BOUNDARIES.minZ;
            vehicle.position.z = MAP_BOUNDARIES.minZ;
            vehicle.velocity.z = Math.abs(vehicle.velocity.z); // Bounce off wall
        } else if (playerTransform.position.z > MAP_BOUNDARIES.maxZ) {
            playerTransform.position.z = MAP_BOUNDARIES.maxZ;
            vehicle.position.z = MAP_BOUNDARIES.maxZ;
            vehicle.velocity.z = -Math.abs(vehicle.velocity.z); // Bounce off wall
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

// Create Arc Rotate Camera with Target
function createArcRotateCameraWithTarget(target) {
    console.log("Creating arc rotate camera for target:", target);
    
    if (scene.activeCamera) {
        console.log("Disposing existing camera");
        scene.activeCamera.dispose();
    }
    
    var camera = new BABYLON.ArcRotateCamera("camera", 
        BABYLON.Tools.ToRadians(180), 
        BABYLON.Tools.ToRadians(60), 
        20,
        new BABYLON.Vector3(0, 1.5, 0), 
        scene);
    
    camera.setTarget(target);
    camera.allowUpsideDown = false;
    camera.panningSensibility = 0;
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 40;
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
    
    console.log("Camera setup complete");
    
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
        
        // Configure vehicle properties for direct movement
        vehicle.maxSpeed = getCharacterSpeed(currentCharacterModel, AI_MODES.PATROL);
        vehicle.maxForce = 100; // Reduced from Infinity for smoother movement
        vehicle.mass = 1; // Increased mass for better physics
        vehicle.updateNeeded = true;
        
        // Set the vehicle's forward direction to match the model's forward direction
        vehicle.forward.set(0, 0, -1);
        
        // Add the vehicle to the entity manager
        entityManager.add(vehicle);
        
        // Initialize patrol path and set initial velocity
        aiCurrentPath = getPath("patrol");
        aiCurrentPathIndex = 0;
        
        if (aiCurrentPath && aiCurrentPath.length > 0) {
            const target = aiCurrentPath[aiCurrentPathIndex];
            const dx = target.x - vehicle.position.x;
            const dz = target.z - vehicle.position.z;
            vehicle.velocity.set(dx, 0, dz);
            vehicle.velocity.normalize().multiplyScalar(vehicle.maxSpeed);
            console.log("Initial velocity set:", vehicle.velocity);
            console.log("Initial target:", target);
            console.log("Initial position:", vehicle.position);
        }
        
        // Visualize the initial path
        visualizePatrolPath(aiCurrentPath);
        
        // Start with patrol mode
        setAIMode(AI_MODES.PATROL);
        
        console.log("Yuka AI setup complete");
    } catch (error) {
        console.error("Error setting up Yuka AI:", error);
    }
}

// Resize Window
window.addEventListener("resize", function () {
    engine.resize();
});

// Create a waypoint marker sphere
function createWaypointMarker(position) {
    const markerId = "waypoint_marker_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const sphere = BABYLON.MeshBuilder.CreateSphere(markerId, { diameter: 1 }, scene);
    sphere.position.set(position.x, 0.5, position.z);
    
    // Set a specific instance ID to distinguish from projectiles
    sphere.id = "WAYPOINT_" + markerId;
    
    // Create glowing material with a unique name
    const materialId = "waypoint_material_" + markerId;
    const material = new BABYLON.StandardMaterial(materialId, scene);
    material.emissiveColor = new BABYLON.Color3(0, 1, 0); // Green
    material.diffuseColor = new BABYLON.Color3(0, 1, 0);
    material.alpha = 0.7;
    material.disableLighting = false; // Keep lighting for waypoints
    sphere.material = material;
    
    return sphere;
}

// Create a line between two points
function createPathLine(start, end) {
    const points = [
        new BABYLON.Vector3(start.x, 0.5, start.z),
        new BABYLON.Vector3(end.x, 0.5, end.z)
    ];
    
    // Use a completely different naming convention for waypoint lines
    const lineId = "waypoint_line_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const line = BABYLON.MeshBuilder.CreateLines(lineId, {
        points: points,
        colors: [
            new BABYLON.Color4(0, 1, 0, 1),
            new BABYLON.Color4(0, 1, 0, 1)
        ],
        useVertexAlpha: false // Disable alpha blending for waypoint lines
    }, scene);
    
    // Set a specific instance ID to distinguish from projectiles
    line.id = "WAYPOINT_" + lineId;
    
    return line;
}

// Clear existing path visualization
function clearPathVisualization() {
    // Remove existing markers
    waypointMarkers.forEach(marker => {
        if (marker && marker.dispose) {
            marker.dispose();
        }
    });
    waypointMarkers = [];
    
    // Remove existing lines
    pathLines.forEach(line => {
        if (line && line.dispose) {
            line.dispose();
        }
    });
    pathLines = [];
    
    // Additional cleanup: search for any waypoint-related objects that might have been missed
    if (scene && scene.meshes) {
        const waypointMeshes = scene.meshes.filter(mesh => 
            mesh.name && (mesh.name.startsWith("waypoint_") || (mesh.id && mesh.id.startsWith("WAYPOINT_")))
        );
        
        waypointMeshes.forEach(mesh => {
            if (mesh && mesh.dispose) {
                mesh.dispose();
            }
        });
    }
}

// Update waypoint visibility based on checkbox
function updateWaypointVisibility() {
    waypointMarkers.forEach(marker => {
        marker.setEnabled(showWaypoints);
    });
    pathLines.forEach(line => {
        line.setEnabled(showWaypoints);
    });
}

// Modify visualizePatrolPath to respect visibility setting
function visualizePatrolPath(path) {
    clearPathVisualization();
    
    // Create markers for each waypoint
    path.forEach(point => {
        const marker = createWaypointMarker(point);
        marker.setEnabled(showWaypoints);
        waypointMarkers.push(marker);
    });
    
    // Create lines between waypoints
    for (let i = 0; i < path.length - 1; i++) {
        const line = createPathLine(path[i], path[i + 1]);
        line.setEnabled(showWaypoints);
        pathLines.push(line);
    }
}

// Update the patrol behavior in the update loop
function updateAI(deltaTime) {
    if (!vehicle || !aiCurrentPath || aiCurrentPath.length === 0) {
        console.log("UpdateAI: Missing required components", {
            hasVehicle: !!vehicle,
            hasPath: !!aiCurrentPath,
            pathLength: aiCurrentPath?.length
        });
        return;
    }
    
    if (currentAIMode === AI_MODES.PATROL) {
        const target = aiCurrentPath[aiCurrentPathIndex];
        const dx = target.x - vehicle.position.x;
        const dz = target.z - vehicle.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Log movement data every few frames
        if (Math.random() < 0.05) {
            console.log("Movement update:", {
                position: { x: vehicle.position.x, z: vehicle.position.z },
                target: { x: target.x, z: target.z },
                distance: distance,
                velocity: { x: vehicle.velocity.x, z: vehicle.velocity.z },
                speed: vehicle.getSpeed(),
                waypoint: aiCurrentPathIndex
            });
        }
        
        // Calculate desired velocity
        const desiredVelocity = new YUKA.Vector3(dx, 0, dz).normalize().multiplyScalar(vehicle.maxSpeed);
        
        // Update velocity with smooth acceleration
        vehicle.velocity.x += (desiredVelocity.x - vehicle.velocity.x) * 0.1;
        vehicle.velocity.z += (desiredVelocity.z - vehicle.velocity.z) * 0.1;
        
        // Update position
        vehicle.position.x += vehicle.velocity.x * deltaTime;
        vehicle.position.z += vehicle.velocity.z * deltaTime;
        
        // Update Babylon mesh position
        playerTransform.position.x = vehicle.position.x;
        playerTransform.position.y = vehicle.position.y;
        playerTransform.position.z = vehicle.position.z;
        
        // Update rotation based on velocity
        if (vehicle.velocity.length() > 0.01) {
            const angle = Math.atan2(vehicle.velocity.x, vehicle.velocity.z) + Math.PI;
            player.rotation.y = angle;
        }
        
        // Check if we've reached the current waypoint
        if (distance < 0.5) {
            console.log("Reached waypoint:", aiCurrentPathIndex);
            aiCurrentPathIndex = (aiCurrentPathIndex + 1) % aiCurrentPath.length;
            
            // If we've completed the path (returned to start), generate a new path
            if (aiCurrentPathIndex === 0) {
                console.log("Generating new patrol path");
                aiCurrentPath = getPath("patrol");
                visualizePatrolPath(aiCurrentPath);
                console.log("New path generated:", aiCurrentPath);
            }
        }
    }
}

// Make player mesh pickable and add click handler
function setupCharacterSelection() {
    if (!player) {
        console.error("No player mesh available for character selection setup");
        return;
    }

    console.log("Setting up character selection...");
    
    // Make ALL meshes in the character hierarchy pickable
    player.isPickable = true;
    const allMeshes = player.getChildMeshes ? player.getChildMeshes() : [];
    allMeshes.push(player); // Include the root mesh
    
    allMeshes.forEach(mesh => {
        console.log("Setting up interaction for mesh:", mesh.name);
        mesh.isPickable = true;
        
        // Create action manager if it doesn't exist
        if (!mesh.actionManager) {
            mesh.actionManager = new BABYLON.ActionManager(scene);
        }
        
        // Add debug material to visualize clickable areas
        const debugMaterial = new BABYLON.StandardMaterial("debugMaterial", scene);
        debugMaterial.emissiveColor = mesh.material ? mesh.material.emissiveColor : new BABYLON.Color3(0.1, 0.1, 0.1);
        debugMaterial.alpha = 0.8;
        mesh.material = debugMaterial;
        
        // Hover in - both mouse and touch
        mesh.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPointerOverTrigger,
                function() {
                    console.log("Hover/Touch in on mesh:", mesh.name);
                    debugMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
                    canvas.style.cursor = "pointer";
                }
            )
        );
        
        // Hover out
        mesh.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPointerOutTrigger,
                function() {
                    console.log("Hover/Touch out on mesh:", mesh.name);
                    debugMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                    canvas.style.cursor = "default";
                }
            )
        );
        
        // Click/Touch
        mesh.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPickTrigger,
                function() {
                    console.log("Click/Touch detected on mesh:", mesh.name);
                    createSpeedAdjustmentControls();
                }
            )
        );
    });
    
    // Add direct pointer event listeners to the scene
    scene.onPointerObservable.add((pointerInfo) => {
        switch (pointerInfo.type) {
            case BABYLON.PointerEventTypes.POINTERDOWN:
                if (pointerInfo.pickInfo.hit && allMeshes.includes(pointerInfo.pickInfo.pickedMesh)) {
                    console.log("Direct pointer down on character mesh:", pointerInfo.pickInfo.pickedMesh.name);
                    createSpeedAdjustmentControls();
                }
                break;
        }
    });
    
    // Add direct touch event listener to canvas
    canvas.addEventListener("touchstart", function(event) {
        console.log("Touch event detected");
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit && allMeshes.includes(pickResult.pickedMesh)) {
            console.log("Touch hit on character mesh:", pickResult.pickedMesh.name);
            createSpeedAdjustmentControls();
            event.preventDefault(); // Prevent default touch behavior
        }
    }, { passive: false });
    
    console.log("Character selection setup complete with enhanced interaction handling");
}

// Add this function to calculate the gun tip position
function getGunTipPosition() {
    if (!player || !playerTransform) {
        return new BABYLON.Vector3(0, 1, 0); // Fallback position
    }
    
    // Direction the character is facing
    const direction = new BABYLON.Vector3(
        -Math.sin(player.rotation.y),
        0, 
        -Math.cos(player.rotation.y)
    );
    
    if (gunMesh) {
        // Get the world position of the gun mesh
        const gunWorldPosition = gunMesh.getAbsolutePosition();
        console.log("Gun world position:", gunWorldPosition);
        
        // Calculate the gun tip position by extending from the gun position in the facing direction
        // The 0.5 is an estimate of the gun length from its center to its tip
        const gunTipPosition = new BABYLON.Vector3(
            gunWorldPosition.x + direction.x * 0.5,
            gunWorldPosition.y,
            gunWorldPosition.z + direction.z * 0.5
        );
        
        return gunTipPosition;
    } else {
        // Fallback if we don't have a gun mesh - use the character position with an offset
        console.log("No gun mesh found, using character position with offset");
        return new BABYLON.Vector3(
            playerTransform.position.x + direction.x * 1.5,
            playerTransform.position.y + 1.0, // Approximate gun height
            playerTransform.position.z + direction.z * 1.5
        );
    }
}

// Modify the shootProjectile function to position the muzzle flash slightly forward
function shootProjectile() {
    if (!player || !playerTransform) return;
    
    const currentTime = time.getElapsed();
    
    // Check cooldown
    if (currentTime - lastShootTime < shootCooldown) {
        console.log("Shooting on cooldown");
        return;
    }
    
    console.log("Shooting projectile");
    lastShootTime = currentTime;
    
    // Create projectile sphere with a unique name
    const projectileId = "projectile_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const projectile = BABYLON.MeshBuilder.CreateSphere(projectileId, { diameter: 0.3 }, scene);
    
    // Calculate the direction vector
    const direction = new BABYLON.Vector3(
        -Math.sin(player.rotation.y),
        0, 
        -Math.cos(player.rotation.y)
    );
    
    // Get the gun tip position
    const gunTipPosition = getGunTipPosition();
    console.log("Gun tip position:", gunTipPosition);
    
    // Set the projectile position to the gun tip
    projectile.position = gunTipPosition.clone();
    
    // Create glowing material for projectile with a unique name
    const projectileMaterialName = "projectileMat_" + projectileId;
    const projectileMaterial = new BABYLON.StandardMaterial(projectileMaterialName, scene);
    projectileMaterial.emissiveColor = new BABYLON.Color3(1, 0.5, 0); // Orange glow
    projectileMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
    projectileMaterial.disableLighting = true;
    projectileMaterial.alpha = 0.9; // Slightly transparent
    projectile.material = projectileMaterial;
    
    // Add a glow layer if it doesn't exist yet
    let glowLayer = scene.getGlowLayerByName("projectileGlow");
    if (!glowLayer) {
        glowLayer = new BABYLON.GlowLayer("projectileGlow", scene);
        glowLayer.intensity = 1.0;
    }
    
    // Add the projectile to the glow layer
    glowLayer.addIncludedOnlyMesh(projectile);
    
    // Create a particle system for the trail instead of using TrailMesh
    const particleSystem = new BABYLON.ParticleSystem("particles_" + projectileId, 200, scene);
    particleSystem.particleTexture = new BABYLON.Texture("/assets/textures/flare_new.png", scene);
    particleSystem.emitter = projectile;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.05, -0.05, -0.05);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.05, 0.05, 0.05);
    
    // Particle properties
    particleSystem.color1 = new BABYLON.Color4(1, 0.7, 0.3, 1.0); // Brighter orange
    particleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1.0);   // Orange
    particleSystem.colorDead = new BABYLON.Color4(0.7, 0.3, 0, 0.0); // Fade to dark orange
    
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.3;
    
    particleSystem.minLifeTime = 0.05;
    particleSystem.maxLifeTime = 0.2;
    
    particleSystem.emitRate = 150;
    
    // Set proper blending mode for transparent textures
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    
    // Add billboarding to ensure particles always face the camera
    particleSystem.billboardMode = BABYLON.ParticleSystem.BILLBOARDMODE_ALL;
    // Set the gravity of the particles
    particleSystem.gravity = new BABYLON.Vector3(0, 0, 0);
    // Set the direction of the particles
    particleSystem.direction1 = new BABYLON.Vector3(-direction.x * 0.05, 0.05, -direction.z * 0.05);
    particleSystem.direction2 = new BABYLON.Vector3(-direction.x * 0.05, -0.05, -direction.z * 0.05);
    
    // Set the minimum and maximum emit powers to control the size of the particles
    particleSystem.minEmitPower = 0.1;
    particleSystem.maxEmitPower = 0.3;
    particleSystem.updateSpeed = 0.01;
    
    // Start the particle system
    particleSystem.start();
    
    // Add muzzle flash effect - position it slightly in front of the gun tip
    const muzzleFlashPosition = new BABYLON.Vector3(
        gunTipPosition.x + direction.x * 1.6,
        gunTipPosition.y,
        gunTipPosition.z + direction.z * 1.6
    );
    
    // Create a particle system for the muzzle flash
    const muzzleFlashId = "muzzleFlash_" + projectileId;
    const muzzleFlash = new BABYLON.ParticleSystem(muzzleFlashId, 50, scene);
    // Set the texture of the muzzle flash
    muzzleFlash.particleTexture = new BABYLON.Texture("/assets/textures/flare_new.png", scene);
    muzzleFlash.emitter = new BABYLON.Vector3(muzzleFlashPosition.x, muzzleFlashPosition.y, muzzleFlashPosition.z);
    // Set the minimum and maximum emit boxes to control the size of the particles
    muzzleFlash.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
    muzzleFlash.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);
    
    // Muzzle flash particle properties
    muzzleFlash.color1 = new BABYLON.Color4(1, 0.9, 0.5, 1.0); // Bright yellow
    muzzleFlash.color2 = new BABYLON.Color4(1, 0.7, 0.3, 1.0); // Orange-yellow
    muzzleFlash.colorDead = new BABYLON.Color4(1, 0.5, 0, 0.0); // Fade to orange
    
    muzzleFlash.minSize = 0.5;
    muzzleFlash.maxSize = 1.0;
    
    muzzleFlash.minLifeTime = 0.03;
    muzzleFlash.maxLifeTime = 0.1;
    
    muzzleFlash.emitRate = 300;
    
    // Set proper blending mode for transparent textures
    muzzleFlash.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    
    // Add billboarding to ensure particles always face the camera
    muzzleFlash.billboardMode = BABYLON.ParticleSystem.BILLBOARDMODE_ALL;
    
    muzzleFlash.direction1 = new BABYLON.Vector3(direction.x, 0.2, direction.z);
    muzzleFlash.direction2 = new BABYLON.Vector3(direction.x, -0.2, direction.z);
    
    muzzleFlash.minEmitPower = 0.5;
    muzzleFlash.maxEmitPower = 1.5;
    
    muzzleFlash.updateSpeed = 0.01;
    
    // Start the muzzle flash particle system
    muzzleFlash.start();
    
    // Stop and dispose the muzzle flash after a short duration
    setTimeout(() => {
        if (muzzleFlash) {
            muzzleFlash.stop();
            setTimeout(() => {
                muzzleFlash.dispose();
            }, 100);
        }
    }, 100);
    
    // Store projectile data
    const projectileData = {
        id: projectileId,
        mesh: projectile,
        particleSystem: particleSystem,
        direction: direction,
        speed: 90, // Speed of projectile (doubled from 20 to 40)
        creationTime: currentTime,
        lifespan: 3 // Lifespan in seconds
    };
    
    projectiles.push(projectileData);
    
    // Play shooting sound if available
    if (scene.getSoundByName) {
        const shootSound = scene.getSoundByName("shootSound");
        if (shootSound) {
            shootSound.play();
        }
    }
    
    // Play shooting animation if in idle mode
    if (currentAIMode === AI_MODES.IDLE) {
        playAnimationByName("Idle_Shoot");
        
        // Return to normal idle after animation
        setTimeout(() => {
            if (currentAIMode === AI_MODES.IDLE) {
                playAnimationByName("Idle");
            }
        }, 500);
    }
    
    return projectileData;
}

// Update the projectiles function to handle the new particle system approach
function updateProjectiles(deltaTime) {
    const currentTime = time.getElapsed();
    
    // Update each projectile
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Move projectile
        projectile.mesh.position.x += projectile.direction.x * projectile.speed * deltaTime;
        projectile.mesh.position.z += projectile.direction.z * projectile.speed * deltaTime;
        
        // Check if projectile has expired
        if (currentTime - projectile.creationTime > projectile.lifespan) {
            // Create impact effect
            createImpactEffect(projectile.mesh.position);
            
            // Stop and dispose the particle system
            if (projectile.particleSystem) {
                projectile.particleSystem.stop();
                setTimeout(() => {
                    if (projectile.particleSystem) {
                        projectile.particleSystem.dispose();
                    }
                }, 200); // Give particles time to fade out
            }
            
            // Remove projectile
            if (projectile.mesh) {
                projectile.mesh.dispose();
            }
            
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check for collisions with walls
        if (projectile.mesh.position.x < MAP_BOUNDARIES.minX || 
            projectile.mesh.position.x > MAP_BOUNDARIES.maxX ||
            projectile.mesh.position.z < MAP_BOUNDARIES.minZ || 
            projectile.mesh.position.z > MAP_BOUNDARIES.maxZ) {
            
            // Create impact effect
            createImpactEffect(projectile.mesh.position);
            
            // Stop and dispose the particle system
            if (projectile.particleSystem) {
                projectile.particleSystem.stop();
                setTimeout(() => {
                    if (projectile.particleSystem) {
                        projectile.particleSystem.dispose();
                    }
                }, 200); // Give particles time to fade out
            }
            
            // Remove projectile
            if (projectile.mesh) {
                projectile.mesh.dispose();
            }
            
            projectiles.splice(i, 1);
        }
    }
}

// Create impact effect function
function createImpactEffect(position) {
    // Create impact effect ID
    const impactId = 'impact_' + Date.now();
    
    // Create particle system for impact
    const impactParticles = new BABYLON.ParticleSystem(impactId, 100, scene);
    impactParticles.particleTexture = new BABYLON.Texture("/assets/textures/flare_new.png", scene);
    impactParticles.emitter = position.clone();
    impactParticles.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
    impactParticles.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);
    
    // Impact particle colors
    impactParticles.color1 = new BABYLON.Color4(1, 0.8, 0.3, 1.0);
    impactParticles.color2 = new BABYLON.Color4(1, 0.5, 0.2, 1.0);
    impactParticles.colorDead = new BABYLON.Color4(0.7, 0.3, 0.1, 0.0);
    
    // Impact particle sizes and lifetime
    impactParticles.minSize = 0.2;
    impactParticles.maxSize = 0.7;
    impactParticles.minLifeTime = 0.1;
    impactParticles.maxLifeTime = 0.3;
    
    // Impact emission rate and power
    impactParticles.emitRate = 300;
    impactParticles.direction1 = new BABYLON.Vector3(-1, -1, -1);
    impactParticles.direction2 = new BABYLON.Vector3(1, 1, 1);
    impactParticles.minEmitPower = 1;
    impactParticles.maxEmitPower = 3;
    impactParticles.updateSpeed = 0.01;
    impactParticles.gravity = new BABYLON.Vector3(0, -9.81, 0);
    
    // Set proper blending mode for transparent textures
    impactParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    
    // Add billboarding to ensure particles always face the camera
    impactParticles.billboardMode = BABYLON.ParticleSystem.BILLBOARDMODE_ALL;
    
    // Set a limited number of particles to emit
    impactParticles.manualEmitCount = 50;
    impactParticles.targetStopDuration = 0.2;
    
    // Start the impact particle system
    impactParticles.start();
    
    // Dispose the particle system after particles have died
    setTimeout(() => {
        impactParticles.dispose();
    }, 500);
} 