// BoomTown - Player Mode
// Main file for player-controlled character

// Global BabylonJS Variables
var canvas;
var engine;
var scene;
var camera;
var dirLight;
var hemisphericLight;

// Debug HUD variables
var debugHUDVisible = false;

// Make scene globally accessible
window.scene = scene;

// Initialize Yuka update flag
window.yukaUpdated = false;

// Player & Navigation
var playerMesh;
var ground;
var groundMat;

// Movement variables - initialized with placeholder values
var moveSpeed = 0.015;  // Default fallback if GameConfig is not available
var runSpeed = 0.03;    // Default fallback if GameConfig is not available
var jumpForce = 0.2;
var gravity = -0.01;
var isJumping = false;
var isFalling = false;
var verticalVelocity = 0;
var isGrounded = true;
var isRunning = false;
var lastWKeyTime = 0;
var doubleTapThreshold = 250; // ms - time window to detect double tap
var wKeyReleased = true; // Track if W key has been released between presses

// Re-initialize from GameConfig when available
document.addEventListener("DOMContentLoaded", function() {
    console.log("DOM loaded, checking for GameConfig availability");
    
    // Function to check GameConfig and initialize values
    function initFromGameConfig() {
        if (window.GameConfig) {
            console.log("GameConfig found:", window.GameConfig);
            
            // Update movement values from GameConfig
            moveSpeed = window.GameConfig.player.moveSpeed;
            runSpeed = window.GameConfig.player.runSpeed;
            jumpForce = window.GameConfig.player.jumpForce;
            gravity = window.GameConfig.player.gravity;
            doubleTapThreshold = window.GameConfig.player.doubleTapThreshold;
            
            console.log("Initialized movement variables from GameConfig:", {
                moveSpeed, 
                runSpeed,
                jumpForce,
                gravity,
                doubleTapThreshold
            });
            
            return true;
        } else {
            console.warn("GameConfig not available yet, will retry");
            return false;
        }
    }
    
    // First attempt immediately
    if (!initFromGameConfig()) {
        // If not available, retry after a short delay
        const checkInterval = setInterval(() => {
            if (initFromGameConfig()) {
                clearInterval(checkInterval);
            }
        }, 100);
        
        // Stop checking after 3 seconds to prevent infinite loops
        setTimeout(() => {
            clearInterval(checkInterval);
            console.warn("GameConfig could not be loaded within timeout, using default values");
        }, 3000);
    }
});

// Key tracking
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false
};

// Mouse control
var mouseSensitivity = GameConfig.player.mouseSensitivity;
var isPointerLocked = false;
var pointerLockPaused = false;

// Shooting variables
var canShoot = true;
var shootCooldown = GameConfig.weapons.shootCooldown; // ms
var projectiles = [];
var lastShootTime = 0;

// Make projectiles array globally accessible
window.projectiles = projectiles;

// Player stats
var playerHealth = GameConfig.player.health;
var playerAmmo = GameConfig.weapons.defaultAmmo;
var maxAmmo = GameConfig.weapons.maxAmmo;
var lastHitTime = 0;
var hitCooldown = GameConfig.player.hitCooldown; // 1 second cooldown between hits

// Enemy variables
var enemies = {};
var maxEnemies = GameConfig.enemies.maxEnemies;
var enemySpawnInterval = GameConfig.enemies.spawnInterval; // ms
var lastEnemySpawnTime = 0;
var enemyModels = GameConfig.enemies.models; // List of available enemy models

// Obstacle tracking
var obstacles = []; // Array to store obstacle meshes

// Game state
var gameStarted = false;
var gamePaused = false;
var gameOver = false;

// Map boundaries - make it global by attaching to window
window.MAP_BOUNDARIES = GameConfig.map.boundaries;

// Ammo pickups
var ammoPickups = [];


// Make debugLog globally accessible
window.debugLog = debugLog;

// Create waypoint HUD
function createWaypointHUD() {
    debugLog("Creating waypoint HUD");
    
    // Remove any existing waypoint HUD
    const existingHUD = document.getElementById('waypointHUD');
    if (existingHUD) {
        existingHUD.remove();
    }
    
    // Create waypoint HUD container
    const waypointHUD = document.createElement('div');
    waypointHUD.id = 'waypointHUD';
    waypointHUD.style.position = 'absolute';
    waypointHUD.style.top = '50px';
    waypointHUD.style.left = '20px';
    waypointHUD.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    waypointHUD.style.color = 'white';
    waypointHUD.style.padding = '15px';
    waypointHUD.style.borderRadius = '5px';
    waypointHUD.style.fontFamily = 'Arial, sans-serif';
    waypointHUD.style.zIndex = '1000';
    waypointHUD.style.display = waypointHUDVisible ? 'block' : 'none';
    waypointHUD.style.minWidth = '200px';
    
    // Create title
    const title = document.createElement('h3');
    title.textContent = 'Waypoint Options';
    title.style.margin = '0 0 10px 0';
    title.style.color = '#ff6600';
    waypointHUD.appendChild(title);
    
    // Create waypoints checkbox
    const waypointsContainer = document.createElement('div');
    waypointsContainer.style.margin = '10px 0';
    
    const waypointsCheckbox = document.createElement('input');
    waypointsCheckbox.type = 'checkbox';
    waypointsCheckbox.id = 'showWaypoints';
    waypointsCheckbox.checked = GameConfig.debug.showWaypoints;
    
    const waypointsLabel = document.createElement('label');
    waypointsLabel.htmlFor = 'showWaypoints';
    waypointsLabel.textContent = 'Show Enemy Waypoints';
    waypointsLabel.style.marginLeft = '5px';
    waypointsLabel.style.cursor = 'pointer';
    
    waypointsContainer.appendChild(waypointsCheckbox);
    waypointsContainer.appendChild(waypointsLabel);
    waypointHUD.appendChild(waypointsContainer);
    
    // Create path lines checkbox
    const pathLinesContainer = document.createElement('div');
    pathLinesContainer.style.margin = '10px 0';
    
    const pathLinesCheckbox = document.createElement('input');
    pathLinesCheckbox.type = 'checkbox';
    pathLinesCheckbox.id = 'showPathLines';
    pathLinesCheckbox.checked = GameConfig.debug.showPathLines;
    
    const pathLinesLabel = document.createElement('label');
    pathLinesLabel.htmlFor = 'showPathLines';
    pathLinesLabel.textContent = 'Show Path Lines';
    pathLinesLabel.style.marginLeft = '5px';
    pathLinesLabel.style.cursor = 'pointer';
    
    pathLinesContainer.appendChild(pathLinesCheckbox);
    pathLinesContainer.appendChild(pathLinesLabel);
    waypointHUD.appendChild(pathLinesContainer);
    
    // Create current waypoint highlight checkbox
    const highlightContainer = document.createElement('div');
    highlightContainer.style.margin = '10px 0';
    
    const highlightCheckbox = document.createElement('input');
    highlightCheckbox.type = 'checkbox';
    highlightCheckbox.id = 'highlightCurrentWaypoint';
    highlightCheckbox.checked = GameConfig.debug.highlightCurrentWaypoint;
    
    const highlightLabel = document.createElement('label');
    highlightLabel.htmlFor = 'highlightCurrentWaypoint';
    highlightLabel.textContent = 'Highlight Current Waypoint';
    highlightLabel.style.marginLeft = '5px';
    highlightLabel.style.cursor = 'pointer';
    
    highlightContainer.appendChild(highlightCheckbox);
    highlightContainer.appendChild(highlightLabel);
    waypointHUD.appendChild(highlightContainer);
    
    // Add event listeners
    waypointsCheckbox.addEventListener('change', function() {
        GameConfig.debug.showWaypoints = this.checked;
        if (window.togglePathVisualization) {
            window.togglePathVisualization(GameConfig.debug.showWaypoints);
        }
    });
    
    pathLinesCheckbox.addEventListener('change', function() {
        GameConfig.debug.showPathLines = this.checked;
        // Toggle only the path lines
        for (const enemyId in window.pathVisualization) {
            const path = window.pathVisualization[enemyId];
            if (path && path.lines) {
                path.lines.isVisible = GameConfig.debug.showPathLines && GameConfig.debug.showWaypoints;
            }
        }
    });
    
    highlightCheckbox.addEventListener('change', function() {
        GameConfig.debug.highlightCurrentWaypoint = this.checked;
        debugLog(`Highlight current waypoint: ${GameConfig.debug.highlightCurrentWaypoint}`);
    });
    
    // Add to document
    document.body.appendChild(waypointHUD);
    
    return waypointHUD;
}

// Toggle waypoint HUD visibility
function toggleWaypointHUD() {
    debugLog("toggleWaypointHUD called");
    
    // Get existing waypoint HUD or create a new one
    let waypointHUD = document.getElementById('waypointHUD');
    if (!waypointHUD) {
        debugLog("Creating new waypoint HUD");
        waypointHUD = createWaypointHUD();
    }
    
    // Toggle visibility
    waypointHUDVisible = !waypointHUDVisible;
    debugLog(`Waypoint HUD is now ${waypointHUDVisible ? 'visible' : 'hidden'}`);
    
    // Update display style
    waypointHUD.style.display = waypointHUDVisible ? 'block' : 'none';
    
    // Force the HUD to be visible if it should be
    if (waypointHUDVisible) {
        waypointHUD.style.display = 'block';
        waypointHUD.style.zIndex = '1000';
        
        // Ensure the HUD is in the DOM
        if (!document.body.contains(waypointHUD)) {
            document.body.appendChild(waypointHUD);
        }
        
        debugLog("Waypoint HUD should now be visible");
        
        // Pause the game when showing the HUD
        if (!gamePaused) {
            pauseGame(false);
        }
    } else {
        // Resume the game when hiding the HUD
        if (gamePaused && !debugHUDVisible) {
            resumeGame();
        }
    }
    
    return waypointHUDVisible;
}

// Initialize the game after all declarations
function initializeGame() {
    debugLog("Initializing game...");
    
    // Get the canvas element
    canvas = document.getElementById("renderCanvas");
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    
    // Create the Babylon engine
    engine = new BABYLON.Engine(canvas, true);
    
    // Create the scene and ensure it's assigned to the global variable
    scene = createScene(engine, canvas);
    
    // Verify scene was created successfully
    if (!scene) {
        console.error("Failed to create scene!");
        return;
    }
    
    debugLog("Scene initialized successfully");
    
    // Start the render loop
    engine.runRenderLoop(function () {
        // Reset Yuka update flag before each frame
        window.yukaUpdated = false;
        
        if (!window.gamePaused) {
            updatePlayer();
            updateProjectiles();
            updateEnemies();
            checkCollisions();
            updateHUD();
            updateDebugInfo();
        }
        
        scene.render();
    });
    
    // Handle window resize
    window.addEventListener("resize", function () {
        if (engine) {
            engine.resize();
        }
    });
    
    // Setup pause functionality
    setupPauseMenu();
    
    debugLog("Game initialization complete");
}

// Start game loop
function startGameLoop() {
    // Run the render loop
    engine.runRenderLoop(function () {
        // Reset Yuka update flag before each frame
        window.yukaUpdated = false;
        
        if (!window.gamePaused) {
            updatePlayer();
            updateProjectiles();
            updateEnemies();
            checkCollisions();
            updateHUD();
            updateDebugInfo();
        }
        
        scene.render();
    });
}

// Start enemy spawning
function startEnemySpawning() {
    debugLog("Starting enemy spawning...");
    // For testing, just spawn one enemy
    spawnEnemy();
}

// Start the game
async function startGame(selectedMapId) {
    try {
        // Update movement speeds from config - ensure we're using the latest values
        if (window.GameConfig) {
            moveSpeed = window.GameConfig.player.moveSpeed;
            runSpeed = window.GameConfig.player.runSpeed;
            jumpForce = window.GameConfig.player.jumpForce;
            gravity = window.GameConfig.player.gravity;
            doubleTapThreshold = window.GameConfig.player.doubleTapThreshold;
            
            console.log("Game starting with movement configuration:", {
                moveSpeed,
                runSpeed,
                jumpForce,
                gravity,
                doubleTapThreshold
            });
        } else {
            console.warn("GameConfig not available at game start, using current values");
        }
        
        // Initialize map engine
        const mapEngine = new MapPlayEngine(scene);
        
        // Load map data
        const mapData = await mapEngine.loadMapData();
        console.log("Loaded map data:", mapData);
        
        // Validate map data
        if (!mapData || !mapData.objects) {
            throw new Error('Invalid map data received');
        }
        
        // Render the map
        await mapEngine.renderMap(mapData);
        
        // Set player starting position
        playerMesh.position = new BABYLON.Vector3(0, 2, 0);
        playerMesh.rotation = new BABYLON.Vector3(0, 0, 0);
        
        // Initialize player state
        playerHealth = 100;
        playerAmmo = 30;
        
        // Update HUD
        updateHUD();
        
        // Start game loop
        startGameLoop();
        
        // Spawn all enemies from map data
        await spawnInitialEnemies();
        
        // Hide menu
        document.getElementById('menu').style.display = 'none';
        
        // Request pointer lock
        canvas.requestPointerLock();
        
        // Set game state
        gameStarted = true;
        gameOver = false;
        gamePaused = false;
        
        // Setup input handlers after everything is initialized
        if (scene) {
            setupInputHandlers(canvas, scene);
        } else {
            console.error('Scene is not initialized when setting up input handlers');
        }
    } catch (error) {
        console.error('Error starting game:', error);
        alert('Failed to start game: ' + error.message);
    }
}

// Spawn initial enemies
async function spawnInitialEnemies() {
    try {
        // Fetch map data
        const mapDataResponse = await fetch('/Demos/map_data.json');
        const mapData = await mapDataResponse.json();

        // Fetch model data
        const modelDataResponse = await fetch('/Demos/model_data.json');
        const modelData = await modelDataResponse.json();

        // Find all enemy objects in the map data
        const enemyObjects = mapData.objects.filter(obj => 
            obj.model.startsWith('Character_') && 
            obj.model.endsWith('.glb')
        );

        console.log(`Spawning ${enemyObjects.length} enemies from map data`);
        
        // First, find and remove any placeholder enemy meshes to prevent duplicates
        const enemyPlaceholders = scene.meshes.filter(mesh => 
            mesh.name && (
                mesh.name.includes("Character_Enemy") || 
                mesh.name.includes("Character_Soldier") ||
                mesh.name.includes("Character_Hazmat") ||
                (mesh.name.includes("enemy") && !mesh.name.includes("enemy_")) || 
                enemyObjects.some(obj => obj.id === mesh.name || obj.id === mesh.id)
            )
        );
        
        // Remove all enemy placeholders to prevent duplicates
        if (enemyPlaceholders.length > 0) {
            console.log(`Found ${enemyPlaceholders.length} enemy placeholders to remove`);
            
            enemyPlaceholders.forEach(mesh => {
                console.log(`Removing enemy placeholder: ${mesh.name}`);
                
                // First, dispose all child meshes
                if (typeof mesh.getChildMeshes === 'function') {
                    const childMeshes = mesh.getChildMeshes();
                    childMeshes.forEach(childMesh => {
                        childMesh.dispose(false, true);
                    });
                }
                
                // Then dispose the root mesh itself
                mesh.dispose(false, true);
            });
        }

        // Create a promise array to handle async enemy spawning
        const enemySpawnPromises = enemyObjects.map(enemyObj => {
            return new Promise((resolve, reject) => {
                // Find corresponding model details
                const modelDetails = modelData.models.find(model => 
                    model.name === enemyObj.model && 
                    model.type === 'character' && 
                    model.sub_type === 'enemy'
                );
                
                console.log(`Spawning enemy model: ${enemyObj.model}`);
                
                // Create merged configuration by combining model details with map-specific overrides
                let mergedConfig = { ...modelDetails };
                
                // Add map-specific properties if they exist in the enemyObj
                if (enemyObj.properties) {
                    console.log(`Applying map-specific properties for enemy at (${enemyObj.position.x}, ${enemyObj.position.z})`, enemyObj.properties);
                    
                    // Merge properties from map data
                    Object.keys(enemyObj.properties).forEach(key => {
                        mergedConfig[key] = enemyObj.properties[key];
                    });
                }

                // Spawn the enemy
                loadEnemyModel(
                    scene,  // Scene parameter
                    new BABYLON.Vector3(
                        enemyObj.position.x, 
                        enemyObj.position.y || 0, 
                        enemyObj.position.z
                    ),
                    enemyObj.model,  // Model path
                    mergedConfig,    // Merged configuration (GameConfig → model_data → map_data)
                    (enemyData) => {
                        // Store enemy in enemies object
                        enemies[enemyData.id] = {
                            id: enemyData.id,
                            mesh: enemyData.mesh,
                            skeleton: enemyData.skeleton,
                            headHitbox: enemyData.headHitbox,
                            bodyHitbox: enemyData.bodyHitbox,
                            health: mergedConfig.health || 100,
                            lastHitTime: 0,
                            hitCooldown: 1000
                        };

                        // Explicitly set enemy to PATROL state
                        setEnemyState(enemyData.id, "PATROL");
                        
                        resolve(enemyData.id);
                    }
                );
            });
        });

        // Wait for all enemies to spawn
        await Promise.all(enemySpawnPromises);

        console.log(`Successfully spawned and set ${enemyObjects.length} enemies to PATROL state`);
    } catch (error) {
        console.error('Error spawning initial enemies:', error);
    }
}

// Setup pause menu
function setupPauseMenu() {
    // Create pause menu
    const pauseMenu = document.createElement("div");
    pauseMenu.id = "pauseMenu";
    pauseMenu.style.position = "absolute";
    pauseMenu.style.top = "0";
    pauseMenu.style.left = "0";
    pauseMenu.style.width = "100%";
    pauseMenu.style.height = "100%";
    pauseMenu.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    pauseMenu.style.display = "none";
    pauseMenu.style.flexDirection = "column";
    pauseMenu.style.justifyContent = "center";
    pauseMenu.style.alignItems = "center";
    pauseMenu.style.zIndex = "100";
    
    // Pause title
    const pauseTitle = document.createElement("h1");
    pauseTitle.innerHTML = "PAUSED";
    pauseTitle.style.color = "#ff6600";
    pauseTitle.style.fontSize = "48px";
    pauseTitle.style.marginBottom = "30px";
    pauseTitle.style.textShadow = "2px 2px 4px #000000";
    pauseMenu.appendChild(pauseTitle);
    
    // Resume button
    const resumeButton = document.createElement("button");
    resumeButton.innerHTML = "Resume";
    resumeButton.className = "menu-button";
    resumeButton.onclick = function() {
        resumeGame();
    };
    pauseMenu.appendChild(resumeButton);
    
    // Restart button
    const restartButton = document.createElement("button");
    restartButton.innerHTML = "Restart";
    restartButton.className = "menu-button";
    restartButton.onclick = function() {
        location.reload();
    };
    pauseMenu.appendChild(restartButton);
    
    document.body.appendChild(pauseMenu);
    
    // Add keyboard event for pause
    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape" && gameStarted && !gameOver) {
            if (gamePaused) {
                resumeGame();
            } else {
                pauseGame(true);
            }
        }
    });
}

// Create debug HUD
function createDebugHUD() {
    let debugHUD = document.getElementById('debugHUD');
    if (!debugHUD) {
        debugHUD = document.createElement('div');
        debugHUD.id = 'debugHUD';
        debugHUD.style.position = 'absolute';
        debugHUD.style.top = '50px';
        debugHUD.style.left = '20px';
        debugHUD.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        debugHUD.style.color = 'white';
        debugHUD.style.padding = '15px';
        debugHUD.style.borderRadius = '5px';
        debugHUD.style.fontFamily = 'Arial, sans-serif';
        debugHUD.style.zIndex = '1000';
        debugHUD.style.display = 'none';
        debugHUD.style.minWidth = '200px';
        document.body.appendChild(debugHUD);
    }

    // Clear existing content
    debugHUD.innerHTML = '';

    // Create title
    const title = document.createElement('h3');
    title.textContent = 'Debug Information';
    title.style.margin = '0 0 10px 0';
    title.style.color = '#ff6600';
    debugHUD.appendChild(title);

    // Create hitbox toggle
    const hitboxContainer = document.createElement('div');
    hitboxContainer.style.margin = '10px 0';

    const hitboxCheckbox = document.createElement('input');
    hitboxCheckbox.type = 'checkbox';
    hitboxCheckbox.id = 'showHitboxes';
    hitboxCheckbox.checked = GameConfig.debug.showHitboxes;

    const hitboxLabel = document.createElement('label');
    hitboxLabel.htmlFor = 'showHitboxes';
    hitboxLabel.textContent = 'Show Hitboxes';
    hitboxLabel.style.marginLeft = '5px';
    hitboxLabel.style.cursor = 'pointer';

    hitboxContainer.appendChild(hitboxCheckbox);
    hitboxContainer.appendChild(hitboxLabel);
    debugHUD.appendChild(hitboxContainer);

    // Create waypoint toggle
    const waypointContainer = document.createElement('div');
    waypointContainer.style.margin = '10px 0';

    const waypointCheckbox = document.createElement('input');
    waypointCheckbox.type = 'checkbox';
    waypointCheckbox.id = 'showWaypoints';
    waypointCheckbox.checked = GameConfig.debug.showWaypoints;

    const waypointLabel = document.createElement('label');
    waypointLabel.htmlFor = 'showWaypoints';
    waypointLabel.textContent = 'Show Waypoints';
    waypointLabel.style.marginLeft = '5px';
    waypointLabel.style.cursor = 'pointer';

    waypointContainer.appendChild(waypointCheckbox);
    waypointContainer.appendChild(waypointLabel);
    debugHUD.appendChild(waypointContainer);

    // Create hit points toggle
    const hitPointsContainer = document.createElement('div');
    hitPointsContainer.style.margin = '10px 0';

    const hitPointsCheckbox = document.createElement('input');
    hitPointsCheckbox.type = 'checkbox';
    hitPointsCheckbox.id = 'showHitPoints';
    hitPointsCheckbox.checked = GameConfig.debug.showHitPoints;

    const hitPointsLabel = document.createElement('label');
    hitPointsLabel.htmlFor = 'showHitPoints';
    hitPointsLabel.textContent = 'Show Hit Points';
    hitPointsLabel.style.marginLeft = '5px';
    hitPointsLabel.style.cursor = 'pointer';

    hitPointsContainer.appendChild(hitPointsCheckbox);
    hitPointsContainer.appendChild(hitPointsLabel);
    debugHUD.appendChild(hitPointsContainer);

    // Create debug info log toggle
    const debugInfoLogContainer = document.createElement('div');
    debugInfoLogContainer.style.margin = '10px 0';

    const debugInfoLogCheckbox = document.createElement('input');
    debugInfoLogCheckbox.type = 'checkbox';
    debugInfoLogCheckbox.id = 'showDebugInfoLog';
    debugInfoLogCheckbox.checked = GameConfig.debug.showDebugInfoLog;

    const debugInfoLogLabel = document.createElement('label');
    debugInfoLogLabel.htmlFor = 'showDebugInfoLog';
    debugInfoLogLabel.textContent = 'Show Debug Console Logs';
    debugInfoLogLabel.style.marginLeft = '5px';
    debugInfoLogLabel.style.cursor = 'pointer';

    debugInfoLogContainer.appendChild(debugInfoLogCheckbox);
    debugInfoLogContainer.appendChild(debugInfoLogLabel);
    debugHUD.appendChild(debugInfoLogContainer);

    // Add event listeners
    hitboxCheckbox.addEventListener('change', function() {
        GameConfig.debug.showHitboxes = this.checked;
        updateHitboxVisibility();
    });

    waypointCheckbox.addEventListener('change', function() {
        GameConfig.debug.showWaypoints = this.checked;
        if (window.togglePathVisualization) {
            window.togglePathVisualization(GameConfig.debug.showWaypoints);
        }
    });

    hitPointsCheckbox.addEventListener('change', function() {
        GameConfig.debug.showHitPoints = this.checked;
        // Add any hit points visualization logic here
    });

    debugInfoLogCheckbox.addEventListener('change', function() {
        GameConfig.debug.showDebugInfoLog = this.checked;
        debugLog(`Debug console logs ${this.checked ? 'enabled' : 'disabled'}`);
    });

    // Add player position info
    const positionInfo = document.createElement('div');
    positionInfo.style.margin = '10px 0';
    positionInfo.style.fontSize = '12px';
    positionInfo.style.color = '#aaa';
    positionInfo.id = 'playerPositionInfo';
    debugHUD.appendChild(positionInfo);

    // Add enemy count info
    const enemyInfo = document.createElement('div');
    enemyInfo.style.margin = '10px 0';
    enemyInfo.style.fontSize = '12px';
    enemyInfo.style.color = '#aaa';
    enemyInfo.id = 'enemyCountInfo';
    debugHUD.appendChild(enemyInfo);

    return debugHUD;
}

// Pause the game
function pauseGame(fromEscKey = false) {
    debugLog("Pausing game" + (fromEscKey ? " from ESC key" : ""));
    gamePaused = true;
    window.gamePaused = true;
    
    // Show debug HUD when pausing
    debugHUDVisible = true;
    GameConfig.debug.showHitboxes = true;
    
    // Create and show debug HUD
    const debugHUD = createDebugHUD();
    debugHUD.style.display = 'block';
    
    // Update hitbox visibility
    updateHitboxVisibility();
    
    // Show pause menu
    const pauseMenu = document.getElementById("pauseMenu");
    if (pauseMenu) {
        pauseMenu.style.display = "flex";
    }
    
    // Exit pointer lock if this was triggered by ESC key
    if (fromEscKey) {
        pointerLockPaused = true;
        document.exitPointerLock();
    }
    
    // Pause all animations
    scene.animationGroups.forEach(animGroup => {
        animGroup.pause();
    });
    
    // Disable controls
    keys.w = false;
    keys.a = false;
    keys.s = false;
    keys.d = false;
    keys.space = false;
    isRunning = false;

    // Update debug information
    updateDebugInfo();
}

// Add function to update debug information
function updateDebugInfo() {
    if (!debugHUDVisible) return;

    // Update player position info
    const positionInfo = document.getElementById('playerPositionInfo');
    if (positionInfo && playerMesh) {
        positionInfo.textContent = `Player Position: X: ${playerMesh.position.x.toFixed(2)}, Y: ${playerMesh.position.y.toFixed(2)}, Z: ${playerMesh.position.z.toFixed(2)}`;
    }

    // Update enemy count info
    const enemyInfo = document.getElementById('enemyCountInfo');
    if (enemyInfo) {
        const enemyCount = Object.keys(enemies).length;
        enemyInfo.textContent = `Active Enemies: ${enemyCount}`;
    }
}

// Resume the game
function resumeGame() {
    debugLog("Resuming game");
    gamePaused = false;
    window.gamePaused = false;
    
    // Hide debug HUD when resuming
    debugHUDVisible = false;
    GameConfig.debug.showHitboxes = false;
    
    // Hide debug HUD
    const debugHUD = document.getElementById('debugHUD');
    if (debugHUD) {
        debugHUD.style.display = 'none';
    }
    
    // Update hitbox visibility
    updateHitboxVisibility();
    
    // Hide pause menu
    const pauseMenu = document.getElementById("pauseMenu");
    if (pauseMenu) {
        pauseMenu.style.display = "none";
    }
    
    // Request pointer lock
    if (canvas.requestPointerLock) {
        canvas.requestPointerLock();
    }
    
    // Resume all animations
    scene.animationGroups.forEach(animGroup => {
        animGroup.play();
    });
}

// Call initialization after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    initializeGame();
});

// Create Scene
function createScene(engine, canvas) {
    debugLog("Creating scene...");
    
    // Create a basic BabylonJS Scene object and assign to global variable
    scene = new BABYLON.Scene(engine);
    debugLog("Scene created");
    
    // Enable collisions for the scene but without physics
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -9.81 / 60, 0);
    debugLog("Scene collisions enabled");
    
    // Make scene globally accessible
    window.scene = scene;
    
    // Create and position a free camera
    camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 1.6, 0), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true); camera.angularSensibility = 2000;
    camera.inertia = 0.5;
    
    // Set up camera collision - use a smaller, more accurate ellipsoid
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(0.25, 0.5, 0.25);  // Even smaller collision box for better movement
    camera.ellipsoidOffset = new BABYLON.Vector3(0, 0.5, 0); // Lower offset to match player height
    camera.applyGravity = true;
    
    // Debug collision settings occasionally
    scene.onBeforeRenderObservable.add(() => {
        if (camera && Math.random() < 0.001) { // Only log very occasionally
            debugLog("Camera position: " + JSON.stringify(camera.position) + ", Ellipsoid: " + JSON.stringify(camera.ellipsoid));
        }
    });
    
    // Disable camera movement with keys (we'll handle this ourselves)
    camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
    
    // Adjust camera settings
    camera.fov = 1.2; // Field of view
    camera.minZ = 0.1; // Near clip plane
    camera.maxZ = 100; // Far clip plane
    
    debugLog("Camera setup complete");
    
    // Create a directional light
    dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-0.5, -1, -0.5), scene);
    dirLight.intensity = 0.7;
    dirLight.diffuse = new BABYLON.Color3(1, 0.9, 0.8); // Warm sunlight color
    dirLight.specular = new BABYLON.Color3(1, 1, 1);
    
    debugLog("Directional light setup complete");
    
    // Create a hemispheric light
    hemisphericLight = new BABYLON.HemisphericLight("hemisphericLight", new BABYLON.Vector3(0, 1, 0), scene);
    hemisphericLight.intensity = 0.5;
    hemisphericLight.diffuse = new BABYLON.Color3(0.8, 0.8, 1); // Slightly blue sky color
    hemisphericLight.groundColor = new BABYLON.Color3(0.3, 0.3, 0.2); // Brown-ish ground color
    
    debugLog("Hemispheric light setup complete");
    
    // Create ground
    ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
    groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.3);
    groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    ground.material = groundMat;

    // Don't check horizontal collisions for ground, only vertical
    ground.checkCollisions = false;  // Disable general collisions for ground
    ground.isPickable = true;  // But keep it pickable

    // Log ground properties for debugging
    console.log("Ground mesh created:", {
        name: ground.name,
        checkCollisions: ground.checkCollisions,
        isPickable: ground.isPickable,
        position: ground.position,
        boundingInfo: ground.getBoundingInfo()
    });
    
    // Create walls
    createWalls();
    
    // Initialize global obstacles array for enemy controller
    window.obstacles = [];
    
    // Create player mesh
    createPlayerMesh();
    
    // Setup input handlers
    setupInputHandlers(canvas, scene);
    
    // Create ammo pickups
    createAmmoPickups();
    
    return scene;
}

// Create walls around the map
function createWalls() {
    // Check if scene is defined
    if (!scene) {
        console.error("Scene is not defined in createWalls");
        return;
    }
    
    console.log("Creating walls with boundaries:", window.MAP_BOUNDARIES);
    
    const wallHeight = 5;
    const wallThickness = 2;
    const wallInset = 2; // Move walls inward by 2 units to prevent collision issues
    
    // North wall
    const northWall = BABYLON.MeshBuilder.CreateBox("northWall", {
        width: window.MAP_BOUNDARIES.maxX - window.MAP_BOUNDARIES.minX - (wallInset * 2),
        height: wallHeight,
        depth: wallThickness
    }, scene);
    northWall.position = new BABYLON.Vector3(0, wallHeight / 2, window.MAP_BOUNDARIES.maxZ - wallInset);
    
    // South wall
    const southWall = BABYLON.MeshBuilder.CreateBox("southWall", {
        width: window.MAP_BOUNDARIES.maxX - window.MAP_BOUNDARIES.minX - (wallInset * 2),
        height: wallHeight,
        depth: wallThickness
    }, scene);
    southWall.position = new BABYLON.Vector3(0, wallHeight / 2, window.MAP_BOUNDARIES.minZ + wallInset);
    
    // East wall
    const eastWall = BABYLON.MeshBuilder.CreateBox("eastWall", {
        width: wallThickness,
        height: wallHeight,
        depth: window.MAP_BOUNDARIES.maxZ - window.MAP_BOUNDARIES.minZ - (wallInset * 2)
    }, scene);
    eastWall.position = new BABYLON.Vector3(window.MAP_BOUNDARIES.maxX - wallInset, wallHeight / 2, 0);
    
    // West wall
    const westWall = BABYLON.MeshBuilder.CreateBox("westWall", {
        width: wallThickness,
        height: wallHeight,
        depth: window.MAP_BOUNDARIES.maxZ - window.MAP_BOUNDARIES.minZ - (wallInset * 2)
    }, scene);
    westWall.position = new BABYLON.Vector3(window.MAP_BOUNDARIES.minX + wallInset, wallHeight / 2, 0);
    
    // Apply material to walls
    const wallMaterial = new BABYLON.StandardMaterial("wallMaterial", scene);
    wallMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    
    northWall.material = wallMaterial;
    southWall.material = wallMaterial;
    eastWall.material = wallMaterial;
    westWall.material = wallMaterial;
    
    // Make walls collidable
    northWall.checkCollisions = true;
    southWall.checkCollisions = true;
    eastWall.checkCollisions = true;
    westWall.checkCollisions = true;
    
    // Log wall info for debugging
    const walls = [northWall, southWall, eastWall, westWall];
    walls.forEach(wall => {
        console.log(`Wall created: ${wall.name}`, {
            position: wall.position,
            dimensions: wall.scaling,
            boundingSphere: wall.getBoundingInfo().boundingSphere,
        });
    });
}

// Create some obstacles for testing
function createObstacles() {
    // Check if scene is defined
    if (!scene) {
        console.error("Scene is not defined in createObstacles");
        return;
    }
    
    // Clear existing obstacles array
    obstacles = [];
    
    // Create a few boxes as obstacles
    for (let i = 0; i < 10; i++) {
        const box = BABYLON.MeshBuilder.CreateBox("obstacle" + i, {
            width: 2 + Math.random() * 3,
            height: 2 + Math.random() * 3,
            depth: 2 + Math.random() * 3
        }, scene);
        
        // Random position within map boundaries
        box.position = new BABYLON.Vector3(
            (Math.random() * (window.MAP_BOUNDARIES.maxX - window.MAP_BOUNDARIES.minX - 10)) + window.MAP_BOUNDARIES.minX + 5,
            (box.scaling.y / 2), // Place on ground
            (Math.random() * (window.MAP_BOUNDARIES.maxZ - window.MAP_BOUNDARIES.minZ - 10)) + window.MAP_BOUNDARIES.minZ + 5
        );
        
        // Random material color
        const boxMat = new BABYLON.StandardMaterial("boxMat" + i, scene);
        boxMat.diffuseColor = new BABYLON.Color3(
            Math.random(),
            Math.random(),
            Math.random()
        );
        box.material = boxMat;
        
        // Make obstacle collidable
        box.checkCollisions = true;
        
        // Add to obstacles array
        obstacles.push(box);
    }
}

// Create player mesh (invisible for first-person view)
function createPlayerMesh() {
    // Check if scene is defined
    if (!scene) {
        console.error("Scene is not defined in createPlayerMesh");
        return;
    }
    
    // Create the main player mesh (invisible)
    playerMesh = BABYLON.MeshBuilder.CreateBox("playerMesh", {
        width: 1,
        height: GameConfig.player.height,
        depth: 1
    }, scene);
    playerMesh.isVisible = false; // Invisible in first-person
    
    // Ensure player starts on the ground
    playerMesh.position = new BABYLON.Vector3(0, GameConfig.player.height / 2, 0);
    debugLog("Player mesh created at position: " + JSON.stringify(playerMesh.position));
    
    // Reset vertical velocity and grounded state
    verticalVelocity = 0;
    isGrounded = true;
    
    // Position camera at player's eye level
    if (camera) {
        camera.position = new BABYLON.Vector3(
            playerMesh.position.x,
            playerMesh.position.y + (GameConfig.player.height / 2) - 0.2,
            playerMesh.position.z
        );
        camera.rotation.x = 0;
        debugLog("Camera positioned at: " + JSON.stringify(camera.position) + " with rotation: " + JSON.stringify(camera.rotation));
    } else {
        console.error("Camera is not defined in createPlayerMesh");
    }
    
    // Set player mesh reference in enemy controller if the function exists
    if (window.setPlayerMeshReference) {
        window.setPlayerMeshReference(playerMesh);
    }
}

// Setup input handlers for keyboard and mouse
function setupInputHandlers(canvas, scene) {
    // Check if scene is defined
    if (!scene) {
        console.error("Scene is not defined in setupInputHandlers");
        return;
    }
    
    // Keyboard event handlers
    scene.onKeyboardObservable.add((kbInfo) => {
        const key = kbInfo.event.key.toLowerCase();
        
        switch (kbInfo.type) {
            case BABYLON.KeyboardEventTypes.KEYDOWN:
                // Handle movement keys
                if (key === 'w' || key === 'a' || key === 's' || key === 'd' || key === ' ') {
                    keys[key === ' ' ? 'space' : key] = true;
                    
                    // Double-tap W detection for running
                    if (key === 'w') {
                        const currentTime = new Date().getTime();
                        
                        // Only consider this a tap if W was released since last press
                        if (wKeyReleased) {
                            // Check if this is a second tap within threshold
                            if (currentTime - lastWKeyTime < doubleTapThreshold) {
                                // Double-tap detected - enable running
                                isRunning = true;
                                
                                // Visual indicator for running
                                const runIndicator = document.createElement('div');
                                runIndicator.id = 'runIndicator';
                                runIndicator.style.position = 'absolute';
                                runIndicator.style.top = '10px';
                                runIndicator.style.left = '50%';
                                runIndicator.style.transform = 'translateX(-50%)';
                                runIndicator.style.background = 'rgba(255,100,0,0.6)';
                                runIndicator.style.color = 'white';
                                runIndicator.style.padding = '5px 10px';
                                runIndicator.style.borderRadius = '5px';
                                runIndicator.style.fontWeight = 'bold';
                                runIndicator.textContent = 'RUNNING';
                                
                                // Remove existing indicator if any
                                const existingIndicator = document.getElementById('runIndicator');
                                if (existingIndicator) {
                                    existingIndicator.remove();
                                }
                                
                                document.body.appendChild(runIndicator);
                                console.log("Double-tap W detected! Running enabled. Time diff: " + (currentTime - lastWKeyTime) + "ms");
                            }
                            
                            // Update last press time
                            lastWKeyTime = currentTime;
                        }
                        
                        // Mark that W key is currently down
                        wKeyReleased = false;
                    }
                }
                // Handle ESC key for pause
                else if (key === 'escape' && gameStarted && !gameOver) {
                    if (gamePaused) {
                        resumeGame();
                    } else {
                        pauseGame(true);
                    }
                }
                break;
                
            case BABYLON.KeyboardEventTypes.KEYUP:
                // Handle movement keys
                if (key === 'w' || key === 'a' || key === 's' || key === 'd' || key === ' ') {
                    keys[key === ' ' ? 'space' : key] = false;
                    
                    // Stop running when W is released
                    if (key === 'w') {
                        // Mark W key as released for double-tap detection
                        wKeyReleased = true;
                        
                        // Always disable running when W is released
                        isRunning = false;
                        
                        // Remove running indicator
                        const runIndicator = document.getElementById('runIndicator');
                        if (runIndicator) {
                            runIndicator.remove();
                        }
                        
                        console.log("W key released. Running stopped.");
                    }
                }
                break;
        }
    });
    
    // Mouse click for shooting and pointer lock
    canvas.addEventListener("mousedown", function(event) {
        // Left click to shoot
        if (event.button === 0) {
            shootProjectile();
        }
        
        // Request pointer lock on first click if game is started
        if (!isPointerLocked && gameStarted && !gamePaused && !gameOver) {
            canvas.requestPointerLock = 
                canvas.requestPointerLock || 
                canvas.msRequestPointerLock || 
                canvas.mozRequestPointerLock || 
                canvas.webkitRequestPointerLock;
            
            if (canvas.requestPointerLock) {
                canvas.requestPointerLock();
            }
        }
    });
    
    // Mouse movement for looking around
    document.addEventListener("mousemove", function(event) {
        if (document.pointerLockElement === canvas || 
            document.mozPointerLockElement === canvas ||
            document.webkitPointerLockElement === canvas) {
            
            isPointerLocked = true;
            
            // Get mouse movement
            const dx = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            const dy = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            
            // Rotate camera based on mouse movement
            camera.rotation.y += dx * mouseSensitivity;
            
            // Limit vertical rotation to prevent flipping
            const nextRotationX = camera.rotation.x + dy * mouseSensitivity;
            if (nextRotationX < Math.PI/2 && nextRotationX > -Math.PI/2) {
                camera.rotation.x = nextRotationX;
            }
        } else {
            isPointerLocked = false;
        }
    });
    
    // Handle pointer lock change
    document.addEventListener('pointerlockchange', lockChangeAlert, false);
    document.addEventListener('mozpointerlockchange', lockChangeAlert, false);
    document.addEventListener('webkitpointerlockchange', lockChangeAlert, false);
    
    function lockChangeAlert() {
        if (document.pointerLockElement === canvas || 
            document.mozPointerLockElement === canvas ||
            document.webkitPointerLockElement === canvas) {
            isPointerLocked = true;
            
            // If game was paused due to pointer lock exit, resume it
            if (gameStarted && gamePaused && !gameOver && pointerLockPaused) {
                resumeGame();
                pointerLockPaused = false;
            }
        } else {
            isPointerLocked = false;
            
            // Only auto-pause if the game is running and not already paused
            if (gameStarted && !gamePaused && !gameOver) {
                debugLog("Pointer lock exited, auto-pausing game");
                pointerLockPaused = true;
                pauseGame();
            }
        }
    }
}

// Update player position and camera based on input
function updatePlayer() {
    if (!playerMesh || !camera) return;
    
    // Get forward and right directions based on camera rotation
    const forward = new BABYLON.Vector3(
        Math.sin(camera.rotation.y),
        0,
        Math.cos(camera.rotation.y)
    );
    
    const right = new BABYLON.Vector3(
        Math.sin(camera.rotation.y + Math.PI/2),
        0,
        Math.cos(camera.rotation.y + Math.PI/2)
    );
    
    // Calculate movement direction
    let moveDirection = BABYLON.Vector3.Zero();
    
    if (keys.w) {
        moveDirection.addInPlace(forward);
    }
    if (keys.s) {
        moveDirection.addInPlace(forward.scale(-1));
    }
    if (keys.a) {
        moveDirection.addInPlace(right.scale(-1));
    }
    if (keys.d) {
        moveDirection.addInPlace(right);
    }
    
    // Only log key states occasionally to avoid console spam
    if (Math.random() < 0.01) {
        console.log("Key states:", {
            w: keys.w,
            a: keys.a, 
            s: keys.s, 
            d: keys.d,
            isRunning: isRunning,
            moveDirection: moveDirection
        });
    }
    
    // Normalize movement direction if not zero
    if (moveDirection.length() > 0) {
        moveDirection.normalize();
    }
    
    // DIRECT SPEED OVERRIDE - Apply extremely slow movement speed
    // Ignore all other speed settings
    const baseSpeed = GameConfig.player.moveSpeed;
    const runningSpeed = GameConfig.player.runSpeed;
    
    // Set final movement speed
    const finalSpeed = (isRunning && keys.w) ? runningSpeed : baseSpeed;
    moveDirection.scaleInPlace(finalSpeed);
    
    // Log speeds occasionally
    if (Math.random() < 0.005) { // Only log in ~0.5% of frames
        console.log("Movement using GameConfig speeds:", {
            isRunning, 
            wPressed: keys.w,
            finalSpeed, 
            configMoveSpeed: GameConfig.player.moveSpeed, 
            configRunSpeed: GameConfig.player.runSpeed
        });
    }
    
    // Apply gravity and jumping
    if (keys.space && isGrounded) {
        verticalVelocity = jumpForce;
        isGrounded = false;
        debugLog("Jump initiated, vertical velocity: " + verticalVelocity);
    }
    
    // Apply gravity
    verticalVelocity += gravity;
    
    // Print the current player position and movement info - but limit frequency
    if (Math.random() < 0.005) { // Only log in ~0.5% of frames
        debugLog("Player movement:", { 
            position: camera.position,
            playerMeshPosition: playerMesh.position,
            moveDirection: moveDirection,
            verticalVelocity: verticalVelocity,
            isGrounded: isGrounded
        });
    }
    
    // Store current position to check for collisions after movement
    const oldPosition = camera.position.clone();
    
    // Apply horizontal movement without collision check against ground
    const newPosition = oldPosition.clone();
    newPosition.x += moveDirection.x;
    newPosition.z += moveDirection.z;
    
    // Only check collisions with non-ground objects
    const hasNonGroundCollision = checkNonGroundCollision(newPosition);
    
    if (!hasNonGroundCollision) {
        // No non-ground collision, apply the movement
        camera.position.x = newPosition.x;
        camera.position.z = newPosition.z;
    } else {
        // Try moving along X and Z separately to slide along walls
        let newPositionX = oldPosition.clone();
        newPositionX.x += moveDirection.x;
        
        let newPositionZ = oldPosition.clone();
        newPositionZ.z += moveDirection.z;
        
        // Try X movement first
        if (!checkNonGroundCollision(newPositionX)) {
            camera.position.x = newPositionX.x;
        }
        
        // Then try Z movement
        if (!checkNonGroundCollision(newPositionZ)) {
            camera.position.z = newPositionZ.z;
        }
    }
    
    // Apply vertical movement separately
    camera.position.y += verticalVelocity;
    
    // Check for ground collision - we consider the player grounded if very close to ground level
    if (camera.position.y <= GameConfig.player.height / 2 + 0.1) {
        camera.position.y = GameConfig.player.height / 2;
        verticalVelocity = 0;
        isGrounded = true;
    }
    
    // Update player mesh position to follow camera
    playerMesh.position.x = camera.position.x;
    playerMesh.position.z = camera.position.z;
    playerMesh.position.y = camera.position.y - GameConfig.player.height / 2;
    
    // Enforce map boundaries
    if (camera.position.x < window.MAP_BOUNDARIES.minX + 1) {
        camera.position.x = window.MAP_BOUNDARIES.minX + 1;
    } else if (camera.position.x > window.MAP_BOUNDARIES.maxX - 1) {
        camera.position.x = window.MAP_BOUNDARIES.maxX - 1;
    }
    
    if (camera.position.z < window.MAP_BOUNDARIES.minZ + 1) {
        camera.position.z = window.MAP_BOUNDARIES.minZ + 1;
    } else if (camera.position.z > window.MAP_BOUNDARIES.maxZ - 1) {
        camera.position.z = window.MAP_BOUNDARIES.maxZ - 1;
    }
    
    // Check for pickups
    checkPickups();
    
    // Update HUD
    updateHUD();
}

// Check for collisions with objects excluding the ground
function checkNonGroundCollision(position) {
    // Create the player's collision sphere
    const playerRadius = Math.max(camera.ellipsoid.x, camera.ellipsoid.z) * 0.5; // Reduced from 0.7 to 0.5
    const playerCenter = position.clone();
    playerCenter.y += camera.ellipsoidOffset.y;
    
    // Maximum collision distance - don't check objects too far away
    const MAX_COLLISION_DISTANCE = 2.5; // Only check collisions within 5 units
    
    // Check all meshes with collisions enabled
    for (const mesh of scene.meshes) {
        if (mesh.checkCollisions && mesh !== playerMesh && mesh !== ground && mesh.isVisible) {
            try {
                // Get bounding sphere of the mesh
                const boundingInfo = mesh.getBoundingInfo();
                
                // Skip if boundingInfo is not available
                if (!boundingInfo || !boundingInfo.boundingSphere) continue;
                
                const center = boundingInfo.boundingSphere.centerWorld;
                const radius = boundingInfo.boundingSphere.radiusWorld;
                
                // Skip objects with too small or too large radius
                if (radius <= 0.01 || radius > 20) continue; // Reduced from 100 to 20
                
                // Quick distance check - if far away, skip detailed collision
                const dx = playerCenter.x - center.x;
                const dz = playerCenter.z - center.z;
                const horizontalDistSq = dx * dx + dz * dz;
                
                // If horizontally far away, skip collision check 
                if (horizontalDistSq > (MAX_COLLISION_DISTANCE * MAX_COLLISION_DISTANCE)) {
                    continue;
                }
                
                // Simple sphere-sphere collision test
                const dy = playerCenter.y - center.y;
                const distance = Math.sqrt(horizontalDistSq + dy * dy);
                
                // Log collisions that are close but not quite colliding
                if (distance < playerRadius + radius + 1 && distance >= playerRadius + radius - 0.1) {
                    debugLog(`Near collision with: ${mesh.name}`, {
                        distance: distance,
                        combinedRadius: playerRadius + radius,
                        hDistance: Math.sqrt(horizontalDistSq)
                    });
                }
                
                if (distance < (playerRadius + radius - 0.1)) {
                    debugLog(`Collision with: ${mesh.name}`, {
                        distance: distance,
                        combinedRadius: playerRadius + radius,
                        hDistance: Math.sqrt(horizontalDistSq)
                    });
                    return true;
                }
            } catch (error) {
                console.error("Error in collision check for mesh: " + mesh.name, error);
                continue;
            }
        }
    }
    
    return false;
}

// Update HUD information
function updateHUD() {
    // Update health display
    const healthDisplay = document.getElementById("healthValue");
    if (healthDisplay) {
        healthDisplay.textContent = playerHealth;
        
        // Change color based on health
        if (playerHealth > 70) {
            healthDisplay.style.color = "#00ff00"; // Green for good health
        } else if (playerHealth > 30) {
            healthDisplay.style.color = "#ffff00"; // Yellow for medium health
        } else {
            healthDisplay.style.color = "#ff0000"; // Red for low health
        }
    }
    
    // Update ammo display
    const ammoDisplay = document.getElementById("ammoValue");
    if (ammoDisplay) {
        ammoDisplay.textContent = playerAmmo;
        
        // Change color based on ammo
        if (playerAmmo > 10) {
            ammoDisplay.style.color = "#ffffff"; // White for sufficient ammo
        } else if (playerAmmo > 0) {
            ammoDisplay.style.color = "#ffff00"; // Yellow for low ammo
        } else {
            ammoDisplay.style.color = "#ff0000"; // Red for no ammo
        }
    }
}

// Shoot projectile function
function shootProjectile() {
    const currentTime = Date.now();
    
    // Check cooldown
    if (currentTime - lastShootTime < shootCooldown) {
        return;
    }
    
    // Check ammo
    if (playerAmmo <= 0) {
        // Play empty gun sound or show message
        debugLog("Out of ammo!");
        return;
    }
    
    debugLog("Shooting projectile");
    lastShootTime = currentTime;
    playerAmmo--;
    
    // Update HUD to reflect ammo change
    updateHUD();
    
    // Create projectile ID
    const projectileId = "projectile_" + Date.now();
    
    // Create projectile mesh
    const projectile = BABYLON.MeshBuilder.CreateSphere(projectileId, { diameter: 0.2 }, scene);
    
    // Configure projectile for collision detection
    projectile.isPickable = true;
    projectile.checkCollisions = true;
    
    // Position projectile at camera position + forward offset
    const forward = new BABYLON.Vector3(
        Math.sin(camera.rotation.y),
        0,
        Math.cos(camera.rotation.y)
    );
    
    // Adjust for vertical aim
    forward.y = -Math.sin(camera.rotation.x);
    
    // Normalize direction
    forward.normalize();
    
    // Position projectile in front of camera
    projectile.position = new BABYLON.Vector3(
        camera.position.x + forward.x * 0.5,
        camera.position.y + forward.y * 0.5,
        camera.position.z + forward.z * 0.5
    );
    
    // Apply material to projectile
    const projectileMaterial = new BABYLON.StandardMaterial("projectileMaterial_" + projectileId, scene);
    projectileMaterial.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
    projectileMaterial.disableLighting = true;
    projectile.material = projectileMaterial;
    
    // Create particle system for trail
    const particleSystem = new BABYLON.ParticleSystem("particles_" + projectileId, 100, scene);
    
    // Check if we have the flare texture
    let particleTexturePath = "/assets/textures/flare_new.png";
    
    particleSystem.particleTexture = new BABYLON.Texture(particleTexturePath, scene);
    particleSystem.emitter = projectile;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.05, -0.05, -0.05);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.05, 0.05, 0.05);
    
    // Particle colors
    particleSystem.color1 = new BABYLON.Color4(1, 0.6, 0.2, 1.0);
    particleSystem.color2 = new BABYLON.Color4(1, 0.4, 0.1, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0.7, 0.3, 0.1, 0.0);
    
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
    
    // Create muzzle flash
    createMuzzleFlash(camera.position, forward);
    
    // Store projectile data
    const projectileData = {
        id: projectileId,
        mesh: projectile,
        particleSystem: particleSystem,
        direction: forward,
        speed: 1.0, // Projectile speed
        gravity: -0.001, // Add gravity to projectile
        createdTime: currentTime,
        lifespan: 3000 // 3 seconds in ms
    };
    
    projectiles.push(projectileData);
    
    // Play sound effect (to be implemented)
}

// Create muzzle flash effect
function createMuzzleFlash(position, direction) {
    // Create muzzle flash ID
    const muzzleFlashId = "muzzleFlash_" + Date.now();
    
    // Calculate muzzle flash position (in front of camera)
    const muzzleFlashPosition = new BABYLON.Vector3(
        position.x + direction.x * 0.8,
        position.y + direction.y * 0.8,
        position.z + direction.z * 0.8
    );
    
    // Create particle system for muzzle flash
    const muzzleFlash = new BABYLON.ParticleSystem(muzzleFlashId, 50, scene);
    
    // Check if we have the flare texture
    let particleTexturePath = "/assets/textures/flare_new.png";
    
    muzzleFlash.particleTexture = new BABYLON.Texture(particleTexturePath, scene);
    muzzleFlash.emitter = muzzleFlashPosition;
    muzzleFlash.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
    muzzleFlash.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);
    
    // Muzzle flash particle colors
    muzzleFlash.color1 = new BABYLON.Color4(1, 0.9, 0.3, 1.0);
    muzzleFlash.color2 = new BABYLON.Color4(1, 0.7, 0.2, 1.0);
    muzzleFlash.colorDead = new BABYLON.Color4(0.7, 0.5, 0.1, 0.0);
    
    // Muzzle flash particle sizes and lifetime
    muzzleFlash.minSize = 0.3;
    muzzleFlash.maxSize = 0.7;
    muzzleFlash.minLifeTime = 0.02;
    muzzleFlash.maxLifeTime = 0.1;
    
    // Muzzle flash emission rate and power
    muzzleFlash.emitRate = 300;
    muzzleFlash.direction1 = new BABYLON.Vector3(direction.x - 0.2, direction.y - 0.2, direction.z - 0.2);
    muzzleFlash.direction2 = new BABYLON.Vector3(direction.x + 0.2, direction.y + 0.2, direction.z + 0.2);
    muzzleFlash.minEmitPower = 0.5;
    muzzleFlash.maxEmitPower = 1.5;
    muzzleFlash.updateSpeed = 0.005;
    
    // Set proper blending mode for transparent textures
    muzzleFlash.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    
    // Add billboarding to ensure particles always face the camera
    muzzleFlash.billboardMode = BABYLON.ParticleSystem.BILLBOARDMODE_ALL;
    
    // Start the muzzle flash particle system
    muzzleFlash.start();
    
    // Stop and dispose the muzzle flash after a short duration
    setTimeout(() => {
        muzzleFlash.stop();
        setTimeout(() => {
            muzzleFlash.dispose();
        }, 100);
    }, 100);
}

// Update projectiles
function updateProjectiles() {
    const currentTime = Date.now();
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Add debug check for gravity property
        if (projectile.gravity === undefined) {
            console.warn(`Projectile ${projectile.id} has no gravity property, setting default`);
            projectile.gravity = -0.001;
        }
        
        // Apply gravity to projectile
        projectile.direction.y += projectile.gravity;
        
        // Store previous position for collision detection
        const previousPosition = projectile.mesh.position.clone();
        
        // Move projectile
        projectile.mesh.position.addInPlace(
            projectile.direction.scale(projectile.speed)
        );
        
        // Debug log occasionally
        if (Math.random() < 0.01) {
            debugLog(`[PROJECTILE] ${projectile.id} position: (${projectile.mesh.position.x.toFixed(2)}, ${projectile.mesh.position.y.toFixed(2)}, ${projectile.mesh.position.z.toFixed(2)}), direction: (${projectile.direction.x.toFixed(2)}, ${projectile.direction.y.toFixed(2)}, ${projectile.direction.z.toFixed(2)})`);
        }
        
        // Check for collisions with walls
        if (checkCollision(projectile.mesh.position)) {
            createImpactEffect(projectile.mesh.position);
            cleanupProjectile(projectile);
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check for collisions with player (only for enemy projectiles)
        if (projectile.isEnemyProjectile && playerMesh) {
            const dx = projectile.mesh.position.x - playerMesh.position.x;
            const dy = projectile.mesh.position.y - (playerMesh.position.y + GameConfig.player.height/2);
            const dz = projectile.mesh.position.z - playerMesh.position.z;
            const distanceToPlayer = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (distanceToPlayer < 1.0) {
                debugLog("Player hit!");
                playerHealth -= 20; // Fixed damage amount
                createHitEffect(playerMesh.position.clone());
                cleanupProjectile(projectile);
                projectiles.splice(i, 1);
                updateHUD();
                if (playerHealth <= 0) {
                    handlePlayerDeath();
                }
                continue;
            }
        }
        
        // Check for collisions with enemies (only for player projectiles)
        if (!projectile.isEnemyProjectile) {
            // Log occasionally for debugging
            if (Math.random() < 0.01) {
                debugLog(`[PROJECTILE] Player projectile at position: (${projectile.mesh.position.x.toFixed(2)}, ${projectile.mesh.position.y.toFixed(2)}, ${projectile.mesh.position.z.toFixed(2)})`);
                debugLog(`[PROJECTILE] Checking collisions with ${Object.keys(window.loadedEnemies).length} enemies`);
            }
            
            // Create a ray for the projectile's movement path
            const ray = new BABYLON.Ray(
                previousPosition,
                projectile.mesh.position.subtract(previousPosition).normalize(),
                projectile.mesh.position.subtract(previousPosition).length()
            );
            
            // For visualization during debugging (uncomment if needed)
            // const rayHelper = new BABYLON.RayHelper(ray);
            // rayHelper.show(scene, new BABYLON.Color3(1, 0, 0));
            // setTimeout(() => rayHelper.dispose(), 100);
            
            let hitEnemy = false;
            
            for (const enemyId in window.loadedEnemies) {
                const enemy = window.loadedEnemies[enemyId];
                if (!enemy) continue;
                
                // Method 1: Direct mesh intersection check
                if (enemy.headHitbox && projectile.mesh.intersectsMesh(enemy.headHitbox, false)) {
                    debugLog(`Enemy ${enemyId} headshot with intersectsMesh!`);
                    const damage = 50; // More damage for headshots
                    
                    // Call hit reaction
                    if (window.handleEnemyHit) {
                        const hitDirection = projectile.direction.clone();
                        window.handleEnemyHit(enemyId, damage, hitDirection);
                    } else {
                        console.error("window.handleEnemyHit function not found!");
                    }
                    
                    createHitEffect(projectile.mesh.position.clone());
                    cleanupProjectile(projectile);
                    projectiles.splice(i, 1);
                    hitEnemy = true;
                    break;
                }
                
                // Method 2: Direct mesh intersection check for body
                if (!hitEnemy && enemy.bodyHitbox && projectile.mesh.intersectsMesh(enemy.bodyHitbox, false)) {
                    debugLog(`Enemy ${enemyId} body shot with intersectsMesh!`);
                    const damage = 25; // Normal damage for body shots
                    
                    // Call hit reaction
                    if (window.handleEnemyHit) {
                        const hitDirection = projectile.direction.clone();
                        window.handleEnemyHit(enemyId, damage, hitDirection);
                    } else {
                        debugLog("window.handleEnemyHit function not found!", true); // Force show this error
                    }
                    
                    createHitEffect(projectile.mesh.position.clone());
                    cleanupProjectile(projectile);
                    projectiles.splice(i, 1);
                    hitEnemy = true;
                    break;
                }
                
                // Method 3: Bounding box intersection check
                if (!hitEnemy) {
                    try {
                        // Get bounding info for projectile and hitboxes
                        const projectileBoundingInfo = projectile.mesh.getBoundingInfo();
                        const headBoundingInfo = enemy.headHitbox ? enemy.headHitbox.getBoundingInfo() : null;
                        const bodyBoundingInfo = enemy.bodyHitbox ? enemy.bodyHitbox.getBoundingInfo() : null;
                        
                        // Check head hitbox with bounding box - ensure all properties exist
                        if (headBoundingInfo && 
                            headBoundingInfo.boundingSphere && 
                            headBoundingInfo.boundingSphere.centerWorld && 
                            typeof headBoundingInfo.boundingSphere.radiusWorld === 'number' &&
                            projectileBoundingInfo && 
                            projectileBoundingInfo.boundingBox) {
                            
                            // Use a simpler distance check instead of the complex bounding box check
                            const distance = BABYLON.Vector3.Distance(
                                projectile.mesh.position,
                                headBoundingInfo.boundingSphere.centerWorld
                            );
                            
                            if (distance <= headBoundingInfo.boundingSphere.radiusWorld + 0.2) { // Add a small buffer
                                debugLog(`Enemy ${enemyId} headshot with bounding sphere distance! Distance: ${distance.toFixed(2)}`);
                                const damage = 50; // More damage for headshots
                                
                                if (window.handleEnemyHit) {
                                    const hitDirection = projectile.direction.clone();
                                    window.handleEnemyHit(enemyId, damage, hitDirection);
                                }
                                
                                createHitEffect(enemy.headHitbox.getAbsolutePosition());
                                cleanupProjectile(projectile);
                                projectiles.splice(i, 1);
                                hitEnemy = true;
                                break;
                            }
                        }
                        
                        // Check body hitbox with bounding box - ensure all properties exist
                        if (!hitEnemy && 
                            bodyBoundingInfo && 
                            bodyBoundingInfo.boundingSphere && 
                            bodyBoundingInfo.boundingSphere.centerWorld && 
                            typeof bodyBoundingInfo.boundingSphere.radiusWorld === 'number' &&
                            projectileBoundingInfo && 
                            projectileBoundingInfo.boundingBox) {
                            
                            // Use a simpler distance check instead of the complex bounding box check
                            const distance = BABYLON.Vector3.Distance(
                                projectile.mesh.position,
                                bodyBoundingInfo.boundingSphere.centerWorld
                            );
                            
                            if (distance <= bodyBoundingInfo.boundingSphere.radiusWorld + 0.2) { // Add a small buffer
                                debugLog(`Enemy ${enemyId} body shot with bounding sphere distance! Distance: ${distance.toFixed(2)}`);
                                const damage = 25; // Normal damage for body shots
                                
                                if (window.handleEnemyHit) {
                                    const hitDirection = projectile.direction.clone();
                                    window.handleEnemyHit(enemyId, damage, hitDirection);
                                }
                                
                                createHitEffect(enemy.bodyHitbox.getAbsolutePosition());
                                cleanupProjectile(projectile);
                                projectiles.splice(i, 1);
                                hitEnemy = true;
                                break;
                            }
                        }
                    } catch (error) {
                        console.warn(`Error in bounding box collision check: ${error.message}`);
                    }
                }
                
                // Method 4: Ray casting for more precise collision detection
                if (!hitEnemy && enemy.headHitbox) {
                    // Debug ray occasionally
                    const shouldDebugRay = Math.random() < 0.05; // 5% chance to debug
                    
                    if (shouldDebugRay) {
                        debugLog(`[RAY] Casting ray from (${previousPosition.x.toFixed(2)}, ${previousPosition.y.toFixed(2)}, ${previousPosition.z.toFixed(2)}) to (${projectile.mesh.position.x.toFixed(2)}, ${projectile.mesh.position.y.toFixed(2)}, ${projectile.mesh.position.z.toFixed(2)})`);
                        debugLog(`[RAY] Ray direction: (${ray.direction.x.toFixed(2)}, ${ray.direction.y.toFixed(2)}, ${ray.direction.z.toFixed(2)}), length: ${ray.length.toFixed(2)}`);
                        
                        // Visualize ray for debugging
                        const rayHelper = new BABYLON.RayHelper(ray);
                        rayHelper.show(scene, new BABYLON.Color3(1, 0, 0));
                        setTimeout(() => rayHelper.dispose(), 1000); // Show for 1 second
                    }
                    
                    const headHit = scene.pickWithRay(ray, mesh => mesh === enemy.headHitbox);
                    
                    if (shouldDebugRay) {
                        debugLog(`[RAY] Head hit result: ${headHit.hit ? 'HIT' : 'MISS'}`);
                        if (headHit.hit) {
                            debugLog(`[RAY] Hit point: (${headHit.pickedPoint.x.toFixed(2)}, ${headHit.pickedPoint.y.toFixed(2)}, ${headHit.pickedPoint.z.toFixed(2)}), distance: ${headHit.distance.toFixed(2)}`);
                        }
                    }
                    
                    if (headHit && headHit.hit) {
                        debugLog(`Enemy ${enemyId} headshot with ray!`);
                        const damage = 50; // More damage for headshots
                        
                        if (window.handleEnemyHit) {
                            const hitDirection = projectile.direction.clone();
                            window.handleEnemyHit(enemyId, damage, hitDirection);
                        }
                        
                        createHitEffect(headHit.pickedPoint);
                        cleanupProjectile(projectile);
                        projectiles.splice(i, 1);
                        hitEnemy = true;
                        break;
                    }
                }
                
                if (!hitEnemy && enemy.bodyHitbox) {
                    const bodyHit = scene.pickWithRay(ray, mesh => mesh === enemy.bodyHitbox);
                    if (bodyHit && bodyHit.hit) {
                        debugLog(`Enemy ${enemyId} body shot with ray!`);
                        const damage = 25; // Normal damage for body shots
                        
                        if (window.handleEnemyHit) {
                            const hitDirection = projectile.direction.clone();
                            window.handleEnemyHit(enemyId, damage, hitDirection);
                        }
                        
                        createHitEffect(bodyHit.pickedPoint);
                        cleanupProjectile(projectile);
                        projectiles.splice(i, 1);
                        hitEnemy = true;
                        break;
                    }
                }
                
                // Method 5: Simple distance-based collision check (fallback)
                if (!hitEnemy) {
                    // Get positions
                    const projectilePos = projectile.mesh.position;
                    const headPos = enemy.headHitbox ? enemy.headHitbox.getAbsolutePosition() : null;
                    const bodyPos = enemy.bodyHitbox ? enemy.bodyHitbox.getAbsolutePosition() : null;
                    
                    // Check head hitbox with distance
                    if (headPos) {
                        const dx = projectilePos.x - headPos.x;
                        const dy = projectilePos.y - headPos.y;
                        const dz = projectilePos.z - headPos.z;
                        const distanceToHead = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        
                        // Use a generous collision radius (0.8 is the diameter of the head hitbox)
                        if (distanceToHead < 0.8) {
                            debugLog(`Enemy ${enemyId} headshot with distance check! Distance: ${distanceToHead.toFixed(2)}`);
                            const damage = 50; // More damage for headshots
                            
                            if (window.handleEnemyHit) {
                                const hitDirection = projectile.direction.clone();
                                window.handleEnemyHit(enemyId, damage, hitDirection);
                            }
                            
                            createHitEffect(headPos);
                            cleanupProjectile(projectile);
                            projectiles.splice(i, 1);
                            hitEnemy = true;
                            break;
                        }
                    }
                    
                    // Check body hitbox with distance
                    if (!hitEnemy && bodyPos) {
                        const dx = projectilePos.x - bodyPos.x;
                        const dy = projectilePos.y - bodyPos.y;
                        const dz = projectilePos.z - bodyPos.z;
                        const distanceToBody = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        
                        // Use a generous collision radius (1.5 is the diameter of the body hitbox)
                        if (distanceToBody < 1.5) {
                            debugLog(`Enemy ${enemyId} body shot with distance check! Distance: ${distanceToBody.toFixed(2)}`);
                            const damage = 25; // Standard damage for body shots
                            
                            if (window.handleEnemyHit) {
                                const hitDirection = projectile.direction.clone();
                                window.handleEnemyHit(enemyId, damage, hitDirection);
                            }
                            
                            createHitEffect(bodyPos);
                            cleanupProjectile(projectile);
                            projectiles.splice(i, 1);
                            hitEnemy = true;
                            break;
                        }
                    }
                }
            }
            
            if (hitEnemy) continue;
        }
        
        // Remove projectile if it's too old
        if (currentTime - projectile.createdTime > projectile.lifespan) {
            cleanupProjectile(projectile);
            projectiles.splice(i, 1);
        }
    }
}

// Clean up projectile resources
function cleanupProjectile(projectile) {
    // Stop and dispose particle system
    if (projectile.particleSystem) {
        projectile.particleSystem.stop();
        setTimeout(() => {
            if (projectile.particleSystem) {
                projectile.particleSystem.dispose();
            }
        }, 200); // Give particles time to fade out
    }
    
    // Dispose mesh
    if (projectile.mesh) {
        projectile.mesh.dispose();
    }
}

// Create impact effect
function createImpactEffect(position) {
    // Create impact effect ID
    const impactId = 'impact_' + Date.now();
    
    // Create particle system for impact
    const impactParticles = new BABYLON.ParticleSystem(impactId, 100, scene);
    
    // Check if we have the flare texture
    let particleTexturePath = "/assets/textures/flare_new.png";
    
    impactParticles.particleTexture = new BABYLON.Texture(particleTexturePath, scene);
    impactParticles.emitter = position.clone();
    impactParticles.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
    impactParticles.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);
    
    // Impact particle colors
    impactParticles.color1 = new BABYLON.Color4(1, 0.8, 0.3, 1.0);
    impactParticles.color2 = new BABYLON.Color4(1, 0.5, 0.2, 1.0);
    impactParticles.colorDead = new BABYLON.Color4(0.7, 0.3, 0.1, 0.0);
    
    // Impact particle sizes and lifetime
    impactParticles.minSize = 0.1;
    impactParticles.maxSize = 0.5;
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

// Create hit effect for enemy damage
function createHitEffect(position) {
    // Create particle system for hit effect
    const particleSystem = new BABYLON.ParticleSystem("hitEffect", 50, scene);
    particleSystem.particleTexture = null; // No texture, just colored particles
    
    // Set the position of the emitter
    particleSystem.emitter = position;
    
    // Set particle properties
    particleSystem.color1 = new BABYLON.Color4(1, 0.2, 0.2, 1); // Red
    particleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1); // Orange
    particleSystem.colorDead = new BABYLON.Color4(0.5, 0, 0, 0); // Dark red fading to transparent
    
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.3;
    
    particleSystem.minLifeTime = 0.2;
    particleSystem.maxLifeTime = 0.5;
    
    particleSystem.emitRate = 100;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    
    particleSystem.direction1 = new BABYLON.Vector3(-1, -1, -1);
    particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
    
    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 3;
    
    // Start the particle system
    particleSystem.start();
    
    // Stop and dispose after a short time
    setTimeout(() => {
        particleSystem.stop();
        setTimeout(() => {
            particleSystem.dispose();
        }, 1000); // Wait for particles to fade out
    }, 200);
}

// Update enemies
function updateEnemies() {
    const currentTime = Date.now();
    
    // Update each enemy
    for (const enemyId in enemies) {
        const enemy = enemies[enemyId];
        
        // Skip if enemy is dead
        if (!enemy || enemy.health <= 0) continue;
        
        // Check for ammo pickups
        checkAmmoPickups(enemy);
        
        // Check for direct collision with player (melee attack)
        if (playerMesh) {
            // Get the actual enemy position from the controller
            const enemyController = window.loadedEnemies[enemyId];
            if (!enemyController) {
                console.warn(`Enemy controller not found for ID: ${enemyId}`);
                continue;
            }
            
            // Use the transform position from the controller instead of mesh position
            const enemyPosition = enemyController.transform.position;
            
            // Debug log enemy positions
            if (Math.random() < 0.01) { // Log occasionally
                debugLog(`[POSITION] Enemy ${enemyId} - ` +
                           `Controller pos: (${enemyPosition.x.toFixed(2)}, ${enemyPosition.z.toFixed(2)}), ` +
                           `Mesh pos: (${enemy.mesh.position.x.toFixed(2)}, ${enemy.mesh.position.y.toFixed(2)}, ${enemy.mesh.position.z.toFixed(2)}), ` +
                           `Player pos: (${playerMesh.position.x.toFixed(2)}, ${playerMesh.position.y.toFixed(2)}, ${playerMesh.position.z.toFixed(2)})`);
            }
            
            const distanceToPlayer = BABYLON.Vector3.Distance(
                new BABYLON.Vector3(enemyPosition.x, 0, enemyPosition.z),
                playerMesh.position
            );
            
            // If enemy is very close to player, do melee damage
            // Increased threshold from 2.5 to 3.5 to account for potential position discrepancies
            if (distanceToPlayer < 3.5 && currentTime - lastHitTime > hitCooldown) {
                debugLog(`[MELEE] Enemy ${enemyId} melee attack at distance ${distanceToPlayer.toFixed(2)}!`);
                playerHealth -= 10; // Melee damage
                lastHitTime = currentTime;
                
                // Update HUD
                updateHUD();
                
                // Create hit effect
                createHitEffect(playerMesh.position.clone());
                
                // Check if player is dead
                if (playerHealth <= 0) {
                    handlePlayerDeath();
                }
            }
        }
    }
}

// Check for ammo pickups
function checkAmmoPickups(enemy) {
    // Get the actual enemy position from the controller
    const enemyController = window.loadedEnemies[enemy.id];
    if (!enemyController) {
        return;
    }
    
    // Use the transform position from the controller
    const enemyPosition = enemyController.transform.position;
    
    // Check if enemy is near an ammo pickup
    for (let i = 0; i < ammoPickups.length; i++) {
        const pickup = ammoPickups[i];
        if (!pickup.active) continue;
        
        const distance = BABYLON.Vector3.Distance(
            new BABYLON.Vector3(enemyPosition.x, 0, enemyPosition.z),
            pickup.mesh.position
        );
        
        if (distance < 2) {
            // Enemy "destroys" the pickup
            pickup.active = false;
            pickup.mesh.setEnabled(false);
            
            // Create effect
            createPickupEffect(pickup.mesh.position);
            
            // Log pickup destruction
            debugLog(`[PICKUP] Enemy ${enemy.id} destroyed ammo pickup at distance ${distance.toFixed(2)}`);
            ammoPickups.splice(i, 1);
        }
    }
}

// Handle enemy death
function handleEnemyDeath(enemyId) {
    const enemy = enemies[enemyId];
    if (!enemy) return;
    
    debugLog(`Enemy ${enemyId} death handling in player_main.js`);
    
    // Show a final damage indicator with "KILLED" text if the function exists
    if (window.createKilledIndicator) {
        createKilledIndicator(enemy.mesh.position.clone());
    }
    
    // Remove from our tracking
    delete enemies[enemyId];
    
    // Spawn a new enemy after a random delay
    const respawnDelay = GameConfig.enemies.respawnMinTime + 
                         Math.random() * (GameConfig.enemies.respawnMaxTime - GameConfig.enemies.respawnMinTime);
    debugLog(`Enemy will respawn in ${(respawnDelay/1000).toFixed(1)} seconds`);
    
    setTimeout(() => {
        spawnEnemy();
    }, respawnDelay);
}

// Create a "KILLED" indicator
function createKilledIndicator(position) {
    if (!scene) return;
    
    // Create a dynamic texture for the text
    const textSize = 256;
    const dynamicTexture = new BABYLON.DynamicTexture("killedTexture", textSize, scene, true);
    dynamicTexture.hasAlpha = true;
    
    // Set font and draw text
    const fontSize = 60;
    const font = `bold ${fontSize}px Arial`;
    dynamicTexture.drawText("KILLED", null, null, font, "#ff0000", "transparent", true);
    
    // Create a plane to display the texture
    const plane = BABYLON.MeshBuilder.CreatePlane("killedIndicator", { width: 2, height: 0.7 }, scene);
    plane.position = new BABYLON.Vector3(position.x, position.y + 2, position.z); // Position above enemy
    
    // Create material with the dynamic texture
    const material = new BABYLON.StandardMaterial("killedMaterial", scene);
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
    const duration = 1500; // ms
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

// Make createKilledIndicator globally accessible
window.createKilledIndicator = createKilledIndicator;

// Create death effect
function createDeathEffect(position) {
    // Create death effect ID
    const deathEffectId = 'deathEffect_' + Date.now();
    
    // Create particle system for death effect
    const deathParticles = new BABYLON.ParticleSystem(deathEffectId, 200, scene);
    
    // Check if we have the flare texture
    let particleTexturePath = "/assets/textures/flare_new.png";
    
    deathParticles.particleTexture = new BABYLON.Texture(particleTexturePath, scene);
    deathParticles.emitter = position.clone();
    deathParticles.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
    deathParticles.maxEmitBox = new BABYLON.Vector3(0.5, 2, 0.5);
    
    // Death particle colors
    deathParticles.color1 = new BABYLON.Color4(0.7, 0.1, 0.1, 1.0); // Red
    deathParticles.color2 = new BABYLON.Color4(0.5, 0.1, 0.1, 1.0); // Dark red
    deathParticles.colorDead = new BABYLON.Color4(0.3, 0.1, 0.1, 0.0); // Fade to transparent
    
    // Death particle sizes and lifetime
    deathParticles.minSize = 0.3;
    deathParticles.maxSize = 0.8;
    deathParticles.minLifeTime = 0.5;
    deathParticles.maxLifeTime = 1.5;
    
    // Death emission rate and power
    deathParticles.emitRate = 300;
    deathParticles.direction1 = new BABYLON.Vector3(-1, 1, -1);
    deathParticles.direction2 = new BABYLON.Vector3(1, 3, 1);
    deathParticles.minEmitPower = 1;
    deathParticles.maxEmitPower = 3;
    deathParticles.updateSpeed = 0.01;
    deathParticles.gravity = new BABYLON.Vector3(0, -1, 0);
    
    // Set proper blending mode for transparent textures
    deathParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    
    // Add billboarding to ensure particles always face the camera
    deathParticles.billboardMode = BABYLON.ParticleSystem.BILLBOARDMODE_ALL;
    
    // Start the death particle system
    deathParticles.start();
    
    // Dispose the particle system after particles have died
    setTimeout(() => {
        deathParticles.dispose();
    }, 2000);
}

// Enemy attacks player (melee)
function attackPlayer(enemy, damage) {
    debugLog(`Enemy ${enemy.id} attacks player for ${damage} damage`);
    
    // Apply damage to player
    playerHealth -= damage;
    
    // Update HUD
    updateHUD();
    
    // Check if player is dead
    if (playerHealth <= 0) {
        handlePlayerDeath();
    }
    
    // Create attack effect
    createAttackEffect(playerMesh.position);
}

// Create attack effect
function createAttackEffect(position) {
    // Create particle system for attack effect
    const attackEffect = new BABYLON.ParticleSystem("attackEffect", 50, scene);
    attackEffect.emitter = position.clone();
    attackEffect.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
    attackEffect.maxEmitBox = new BABYLON.Vector3(0.5, 2, 0.5);
    
    // Set colors for attack effect (red for damage)
    attackEffect.color1 = new BABYLON.Color4(1, 0, 0, 1.0);
    attackEffect.color2 = new BABYLON.Color4(0.8, 0, 0, 1.0);
    attackEffect.colorDead = new BABYLON.Color4(0.5, 0, 0, 0.0);
    
    // Set particle properties
    attackEffect.minSize = 0.1;
    attackEffect.maxSize = 0.3;
    attackEffect.minLifeTime = 0.2;
    attackEffect.maxLifeTime = 0.4;
    
    // Set emission properties
    attackEffect.emitRate = 100;
    attackEffect.minEmitPower = 1;
    attackEffect.maxEmitPower = 2;
    attackEffect.updateSpeed = 0.01;
    
    // Start the effect
    attackEffect.start();
    
    // Stop and dispose after a short duration
    setTimeout(() => {
        attackEffect.stop();
        setTimeout(() => {
            attackEffect.dispose();
        }, 500);
    }, 200);
}

// Handle player death
function handlePlayerDeath() {
    // Set game over state
    gameOver = true;
    
    debugLog("Player has died!");
    
    // Show game over screen
    showGameOverScreen();
}

// Show game over screen
function showGameOverScreen() {
    // Create fullscreen UI
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("gameOverUI");
    
    // Create background
    const background = new BABYLON.GUI.Rectangle();
    background.width = 1;
    background.height = 1;
    background.color = "black";
    background.alpha = 0.5;
    background.thickness = 0;
    advancedTexture.addControl(background);
    
    // Create game over text
    const gameOverText = new BABYLON.GUI.TextBlock();
    gameOverText.text = "GAME OVER";
    gameOverText.color = "red";
    gameOverText.fontSize = 60;
    gameOverText.fontFamily = "Impact";
    gameOverText.top = "-100px";
    advancedTexture.addControl(gameOverText);
    
    // Create restart button
    const restartButton = BABYLON.GUI.Button.CreateSimpleButton("restartButton", "RESTART");
    restartButton.width = "200px";
    restartButton.height = "60px";
    restartButton.color = "white";
    restartButton.background = "red";
    restartButton.fontSize = 24;
    restartButton.fontFamily = "Impact";
    restartButton.top = "50px";
    restartButton.onPointerUpObservable.add(() => {
        // Reload the page to restart
        location.reload();
    });
    advancedTexture.addControl(restartButton);
    
    // Create menu button
    const menuButton = BABYLON.GUI.Button.CreateSimpleButton("menuButton", "MAIN MENU");
    menuButton.width = "200px";
    menuButton.height = "60px";
    menuButton.color = "white";
    menuButton.background = "red";
    menuButton.fontSize = 24;
    menuButton.fontFamily = "Impact";
    menuButton.top = "150px";
    menuButton.onPointerUpObservable.add(() => {
        // Go back to main menu
        window.location.href = "/";
    });
    advancedTexture.addControl(menuButton);
}

// Create ammo pickups in the game - No longer needed as we use model-based pickups from map data
function createAmmoPickups() {
    // This function is now a no-op as ammo pickups come from map data with model_data.json attributes
    debugLog("createAmmoPickups is deprecated - ammo pickups now come from map data");
    // No need to create random ammo boxes anymore
}

// Check for pickups
function checkPickups() {
    if (!playerMesh) return;
    
    // Get all pickups in the scene (both direct and child pickups)
    const pickups = scene.meshes.filter(mesh => 
        (mesh.isPickup && mesh.isVisible) || 
        (mesh.metadata && mesh.metadata.parentId && 
         scene.getMeshById(mesh.metadata.parentId) && 
         scene.getMeshById(mesh.metadata.parentId).isPickup && 
         scene.getMeshById(mesh.metadata.parentId).isVisible)
    );
    
    // Debug pickup detection occasionally
    if (Math.random() < 0.01) { // 1% chance each frame
        debugLog(`Found ${pickups.length} visible pickups in scene`);
    }
    
    // Check distance to each pickup
    for (let i = 0; i < pickups.length; i++) {
        const pickup = pickups[i];
        
        // If this is part of a parent, use parent's position
        let checkPosition = pickup.position;
        if (pickup.metadata && pickup.metadata.parentId) {
            const parent = scene.getMeshById(pickup.metadata.parentId);
            if (parent && parent.position) {
                checkPosition = parent.position;
            }
        }
        
        const distance = BABYLON.Vector3.Distance(
            playerMesh.position,
            checkPosition
        );
        
        // If player is close enough, collect the pickup
        // Use a slightly larger detection radius to make pickups easier to collect
        if (distance < 2.5) {
            collectPickup(pickup);
            // Break after collecting one pickup to prevent multiple collections
            break;
        }
    }
}

// Collect pickup
function collectPickup(pickup) {
    // Determine if this is a child mesh and get the parent if needed
    let parentMesh = pickup;
    if (pickup.metadata && pickup.metadata.parentId) {
        const parent = scene.getMeshById(pickup.metadata.parentId);
        if (parent) {
            parentMesh = parent;
            debugLog(`Found parent mesh ${parent.id} for pickup ${pickup.id}`);
        }
    }
    
    if (pickup.pickupType === "ammo" || (parentMesh.pickupType === "ammo")) {
        // Use ammo amount from the mesh that has it
        const ammoAmount = pickup.ammoAmount || parentMesh.ammoAmount || 10;
        
        // Add ammo to player
        playerAmmo = Math.min(playerAmmo + ammoAmount, maxAmmo);
        debugLog(`Picked up ${ammoAmount} ammo. Total: ${playerAmmo}`);
        
        // Update HUD
        updateHUD();
        
        // Create pickup effect
        createPickupEffect(pickup.position);
        
        // Determine if this pickup should respawn
        const shouldRespawn = pickup.respawn || parentMesh.respawn || false;
        const respawnTime = pickup.respawnTime || parentMesh.respawnTime || 10000;
        const respawnDelay = pickup.respawnDelay || parentMesh.respawnDelay || 0;
        
        // Check if pickup should respawn
        if (shouldRespawn) {
            // Hide the pickup and all its child meshes
            if (parentMesh.getChildMeshes) {
                const allMeshes = [parentMesh, ...parentMesh.getChildMeshes()];
                allMeshes.forEach(mesh => {
                    mesh.isVisible = false;
                });
            } else {
                parentMesh.isVisible = false;
            }
            
            // Schedule respawn after respawn time
            debugLog(`Ammo pickup will respawn in ${respawnTime}ms with ${respawnDelay}ms delay`);
            
            setTimeout(() => {
                // Apply respawn delay if specified
                if (respawnDelay > 0) {
                    setTimeout(() => {
                        // Make all meshes visible again
                        if (parentMesh.getChildMeshes) {
                            const allMeshes = [parentMesh, ...parentMesh.getChildMeshes()];
                            allMeshes.forEach(mesh => {
                                mesh.isVisible = true;
                            });
                        } else {
                            parentMesh.isVisible = true;
                        }
                        debugLog("Ammo pickup respawned");
                    }, respawnDelay);
                } else {
                    // Make all meshes visible immediately
                    if (parentMesh.getChildMeshes) {
                        const allMeshes = [parentMesh, ...parentMesh.getChildMeshes()];
                        allMeshes.forEach(mesh => {
                            mesh.isVisible = true;
                        });
                    } else {
                        parentMesh.isVisible = true;
                    }
                    debugLog("Ammo pickup respawned");
                }
            }, respawnTime);
        } else {
            // Remove pickup from scene if not respawning
            if (parentMesh.getChildMeshes) {
                const allMeshes = [parentMesh, ...parentMesh.getChildMeshes()];
                allMeshes.forEach(mesh => {
                    mesh.dispose();
                });
            } else {
                parentMesh.dispose();
            }
        }
    }
}

// Create pickup effect
function createPickupEffect(position) {
    // Create particle system for pickup effect
    const pickupEffect = new BABYLON.ParticleSystem("pickupEffect", 50, scene);
    pickupEffect.particleTexture = new BABYLON.Texture("/assets/textures/flare.png", scene);
    
    // Set the position of the emitter
    pickupEffect.emitter = position;
    
    // Set particle colors
    pickupEffect.color1 = new BABYLON.Color4(0.1, 0.1, 1.0, 1.0);
    pickupEffect.color2 = new BABYLON.Color4(0.2, 0.2, 1.0, 1.0);
    pickupEffect.colorDead = new BABYLON.Color4(0, 0, 0.5, 0);
    
    // Set particle sizes
    pickupEffect.minSize = 0.1;
    pickupEffect.maxSize = 0.3;
    
    // Set particle lifetime
    pickupEffect.minLifeTime = 0.3;
    pickupEffect.maxLifeTime = 0.5;
    
    // Set emission rate and power
    pickupEffect.emitRate = 100;
    pickupEffect.direction1 = new BABYLON.Vector3(-1, 1, -1);
    pickupEffect.direction2 = new BABYLON.Vector3(1, 1, 1);
    pickupEffect.minEmitPower = 1;
    pickupEffect.maxEmitPower = 2;
    
    // Set proper blending mode for transparent textures
    pickupEffect.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    
    // Start the particle system
    pickupEffect.start();
    
    // Dispose the particle system after particles have died
    setTimeout(() => {
        pickupEffect.dispose();
    }, 500);
}

// Function to spawn a single enemy
function spawnEnemy() {
    debugLog("Spawning enemy...");
    
    // Check if scene is defined
    if (!scene) {
        debugLog("Scene is not defined in spawnEnemy", true); // Force show this error
        return;
    }
    
    // Load and check for enemy characters from map data
    let mapEngine = new MapPlayEngine(scene);
    mapEngine.loadMapData().then(mapData => {
        if (!mapData || !mapData.objects) {
            debugLog("Invalid map data in spawnEnemy", true);
            return;
        }
        
        // Filter for enemy characters in the map
        const enemyObjects = mapData.objects.filter(obj => obj.model === "Character_Enemy.glb");
        
        if (enemyObjects.length === 0) {
            // No enemies in map, fall back to random spawn point
            debugLog("No enemies found in map data, using random spawn point");
            const spawnPoint = getRandomSpawnPoint();
            spawnEnemyAtPosition(spawnPoint, null);
        } else {
            // Spawn enemies at the positions defined in the map
            debugLog(`Found ${enemyObjects.length} enemies in map data`);
            
            // Find all map placeholders for enemies (including ones that might have different IDs)
            const enemyPlaceholders = scene.meshes.filter(mesh => 
                mesh.name && (
                    mesh.name.includes("Character_Enemy") || 
                    (mesh.name.includes("enemy") && !mesh.name.includes("enemy_")) || 
                    enemyObjects.some(obj => obj.id === mesh.name || obj.id === mesh.id)
                )
            );
            
            // Remove all enemy placeholders to prevent duplicates
            if (enemyPlaceholders.length > 0) {
                debugLog(`Found ${enemyPlaceholders.length} enemy placeholders to remove`);
                
                enemyPlaceholders.forEach(mesh => {
                    debugLog(`Removing enemy placeholder: ${mesh.name}`);
                    
                    // First, dispose all child meshes
                    if (typeof mesh.getChildMeshes === 'function') {
                        const childMeshes = mesh.getChildMeshes();
                        childMeshes.forEach(childMesh => {
                            childMesh.dispose(false, true);
                        });
                    }
                    
                    // Then dispose the root mesh itself
                    mesh.dispose(false, true);
                });
            }
            
            // Now spawn new enemies at the positions from map data
            enemyObjects.forEach(enemyObj => {
                const position = {
                    x: enemyObj.position.x,
                    y: enemyObj.position.y || 0,
                    z: enemyObj.position.z
                };
                
                debugLog(`Spawning enemy from map at position: ${JSON.stringify(position)}`);
                // Pass map-specific properties if they exist
                spawnEnemyAtPosition(position, enemyObj.properties);
            });
        }
    }).catch(error => {
        debugLog(`Error loading map data for enemies: ${error}`, true);
        // Fall back to random spawn as a backup
        const spawnPoint = getRandomSpawnPoint();
        spawnEnemyAtPosition(spawnPoint, null);
    });
}

// Helper function to spawn an enemy at a specific position
function spawnEnemyAtPosition(position, mapProperties = null) {
    // Generate a unique ID for this enemy
    const enemyId = 'enemy_' + Date.now();
    
    // Select a random enemy model from the available models in GameConfig
    const enemyModels = GameConfig.enemies.models;
    const randomModel = enemyModels[Math.floor(Math.random() * enemyModels.length)];
    
    // Load model data to get model-specific properties
    fetch('/Demos/model_data.json')
        .then(response => response.json())
        .then(modelData => {
            // Find model details for the selected model
            const modelDetails = modelData.models.find(model => 
                model.name === randomModel && 
                model.type === 'character' && 
                model.sub_type === 'enemy'
            );
            
            // Create merged configuration
            let mergedConfig = { ...modelDetails };
            
            // Add map-specific properties if provided
            if (mapProperties) {
                Object.keys(mapProperties).forEach(key => {
                    mergedConfig[key] = mapProperties[key];
                });
            }
            
            // Load the enemy model using the controller with proper config hierarchy
            loadEnemyModel(scene, new BABYLON.Vector3(position.x, 0, position.z), randomModel, mergedConfig, (enemyData) => {
                // Store the enemy data with the controller's ID
                const enemyId = enemyData.id;
                enemies[enemyId] = {
                    id: enemyId,
                    mesh: enemyData.mesh,
                    skeleton: enemyData.skeleton,
                    headHitbox: enemyData.headHitbox,
                    bodyHitbox: enemyData.bodyHitbox,
                    health: mergedConfig ? mergedConfig.health : 100,
                    lastHitTime: 0,
                    hitCooldown: 1000
                };
                
                debugLog("Enemy spawned successfully with ID: " + enemyId);
                
                // Set the enemy to patrol state using the controller
                setEnemyState(enemyId, "PATROL");
            });
        })
        .catch(error => {
            debugLog(`Error loading model data for spawning enemy: ${error}`, true);
            
            // Fall back to default spawning without model data
            loadEnemyModel(scene, new BABYLON.Vector3(position.x, 0, position.z), randomModel, null, (enemyData) => {
                const enemyId = enemyData.id;
                enemies[enemyId] = {
                    id: enemyId,
                    mesh: enemyData.mesh,
                    skeleton: enemyData.skeleton,
                    headHitbox: enemyData.headHitbox,
                    bodyHitbox: enemyData.bodyHitbox,
                    health: 100,
                    lastHitTime: 0,
                    hitCooldown: 1000
                };
                
                setEnemyState(enemyId, "PATROL");
            });
        });
}

// Function to get a random spawn point
function getRandomSpawnPoint() {
    const margin = 5;
    const x = window.MAP_BOUNDARIES.minX + margin + Math.random() * (window.MAP_BOUNDARIES.maxX - window.MAP_BOUNDARIES.minX - 2 * margin);
    const z = window.MAP_BOUNDARIES.minZ + margin + Math.random() * (window.MAP_BOUNDARIES.maxZ - window.MAP_BOUNDARIES.minZ - 2 * margin);
    return { x, y: 0, z };
}

// Check for collisions with obstacles and walls
function checkCollision(position) {
    // Check if scene is defined
    if (!scene) {
        console.error("Scene is not defined in checkCollision");
        return false;
    }
    
    // Check collision with obstacles
    for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        const distance = BABYLON.Vector3.Distance(position, obstacle.position);
        
        // Use the obstacle's bounding box for collision detection
        const boundingInfo = obstacle.getBoundingInfo();
        const boundingBox = boundingInfo.boundingBox;
        const extendSize = Math.max(
            boundingBox.extendSize.x,
            boundingBox.extendSize.y,
            boundingBox.extendSize.z
        );
        
        if (distance < extendSize + 0.5) { // Add a small buffer
            return true;
        }
    }
    
    // Check collision with map boundaries
    if (position.x < window.MAP_BOUNDARIES.minX + 1 ||
        position.x > window.MAP_BOUNDARIES.maxX - 1 ||
        position.z < window.MAP_BOUNDARIES.minZ + 1 ||
        position.z > window.MAP_BOUNDARIES.maxZ - 1) {
        return true;
    }
    
    // No collision detected
    return false;
}

// Function to update hitbox visibility
function updateHitboxVisibility() {
    // Update player hitboxes
    if (playerMesh) {
        if (playerMesh.headHitbox) {
            playerMesh.headHitbox.isVisible = GameConfig.debug.showHitboxes;
        }
        if (playerMesh.bodyHitbox) {
            playerMesh.bodyHitbox.isVisible = GameConfig.debug.showHitboxes;
        }
    }
    
    // Update enemy hitboxes
    if (window.loadedEnemies) {
        for (const enemyId in window.loadedEnemies) {
            const enemy = window.loadedEnemies[enemyId];
            if (enemy) {
                // Update collision box visibility
                if (enemy.collisionBox) {
                    enemy.collisionBox.isVisible = GameConfig.debug.showHitboxes;
                }
                
                // Update head and body hitboxes if they exist
                if (enemy.headHitbox) {
                    enemy.headHitbox.isVisible = GameConfig.debug.showHitboxes;
                }
                if (enemy.bodyHitbox) {
                    enemy.bodyHitbox.isVisible = GameConfig.debug.showHitboxes;
                }
            }
        }
    }
    
    // Remove the connection between hitboxes and path visualization
    // If you want to toggle path visualization, use the dedicated waypoints checkbox instead
}

// Add new function to check hitbox collisions
function checkHitboxCollision(projectilePosition, hitbox) {
    if (!hitbox) {
        console.warn("Hitbox is null or undefined");
        return false;
    }
    
    // Get hitbox world position
    const hitboxWorldPos = hitbox.getAbsolutePosition();
    
    // Get hitbox dimensions from its scaling
    const hitboxScale = hitbox.scaling;
    
    // Get the original hitbox dimensions from when it was created
    let hitboxWidth, hitboxHeight, hitboxDepth;
    
    // Check if this is a head or body hitbox based on the mesh name
    if (hitbox.name.includes("head")) {
        hitboxWidth = 0.4 * hitboxScale.x;  // Half of 0.8
        hitboxHeight = 0.4 * hitboxScale.y; // Half of 0.8
        hitboxDepth = 0.4 * hitboxScale.z;  // Half of 0.8
    } else if (hitbox.name.includes("body")) {
        hitboxWidth = 0.5 * hitboxScale.x;  // Half of 1.0
        hitboxHeight = 0.75 * hitboxScale.y; // Half of 1.5
        hitboxDepth = 0.5 * hitboxScale.z;  // Half of 1.0
    } else {
        // Default to a reasonable size if we can't determine the type
        hitboxWidth = 0.5 * hitboxScale.x;
        hitboxHeight = 0.75 * hitboxScale.y;
        hitboxDepth = 0.5 * hitboxScale.z;
    }
    
    // Calculate distances
    const dx = Math.abs(projectilePosition.x - hitboxWorldPos.x);
    const dy = Math.abs(projectilePosition.y - hitboxWorldPos.y);
    const dz = Math.abs(projectilePosition.z - hitboxWorldPos.z);
    
    // Check if projectile is within hitbox bounds
    const isHit = (
        dx <= hitboxWidth &&
        dy <= hitboxHeight &&
        dz <= hitboxDepth
    );
    
    // Log collision check occasionally (to avoid console spam)
    if (Math.random() < 0.01 || isHit) {
        debugLog(`[HITBOX] Checking collision with ${hitbox.name}: ` +
                   `Distance: (${dx.toFixed(2)}, ${dy.toFixed(2)}, ${dz.toFixed(2)}), ` +
                   `Bounds: (${hitboxWidth.toFixed(2)}, ${hitboxHeight.toFixed(2)}, ${hitboxDepth.toFixed(2)}), ` +
                   `Result: ${isHit ? 'HIT' : 'MISS'}`);
    }
    
    return isHit;
}

// Make handleEnemyDeath globally accessible
window.handleEnemyDeath = handleEnemyDeath;

// Check for collisions
function checkCollisions() {
    // Check projectile collisions with obstacles and enemies
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Check collision with obstacles
        if (checkCollision(projectile.mesh.position)) {
            createImpactEffect(projectile.mesh.position);
            cleanupProjectile(projectile);
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check collision with enemies (only for player projectiles)
        if (!projectile.isEnemyProjectile) {
            for (const enemyId in enemies) {
                const enemy = enemies[enemyId];
                if (!enemy || enemy.health <= 0) continue;
                
                // Check collision with enemy hitboxes
                if (enemy.headHitbox && checkHitboxCollision(projectile.mesh.position, enemy.headHitbox)) {
                    debugLog(`Enemy ${enemyId} headshot!`);
                    enemy.health -= 50;
                    createHitEffect(projectile.mesh.position);
                    cleanupProjectile(projectile);
                    projectiles.splice(i, 1);
                    
                    if (enemy.health <= 0) {
                        handleEnemyDeath(enemyId);
                    }
                    break;
                }
                
                if (enemy.bodyHitbox && checkHitboxCollision(projectile.mesh.position, enemy.bodyHitbox)) {
                    debugLog(`Enemy ${enemyId} body shot!`);
                    enemy.health -= 25;
                    createHitEffect(projectile.mesh.position);
                    cleanupProjectile(projectile);
                    projectiles.splice(i, 1);
                    
                    if (enemy.health <= 0) {
                        handleEnemyDeath(enemyId);
                    }
                    break;
                }
            }
        }
    }
} 