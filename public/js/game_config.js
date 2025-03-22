// Custom debug logging function that respects the showDebugInfoLog setting
function debugLog(message, forceShow = false) {
    // Always show errors and forced messages regardless of setting
    if (forceShow || message.includes('ERROR') || message.includes('Error') || message.includes('error')) {
        console.log(message);
        return;
    }
    
    // Only show informational logs if enabled - check if GameConfig exists first
    if (window.GameConfig && window.GameConfig.debug && window.GameConfig.debug.showDebugInfoLog) {
        console.log(message);
    }
}

// Make debugLog globally accessible
window.debugLog = debugLog;

// BoomTown Game Configuration
// This file contains all game variables and settings that control gameplay mechanics

// Initialize enemy_models as empty array
let enemy_models = [];

// Define GameConfig first with empty models array
const GameConfig = {
    // Player settings
    player: {
        health: 100,
        heal_rate: 10, // 4 healing pointss heal time
        heal_time: 1000, // 1 second healing time (multiplied by heal_rate for actual healing time)
        heal_cooldown: 2500, // 2.5 seconds before healing can start
        height: 1.8, // Player height in units
        moveSpeed: 0.1,
        runSpeed: 0.16,
        jumpForce: 0.3,
        gravity: -0.01,
        hitCooldown: 600, // 1 second cooldown between hits
        mouseSensitivity: 0.002,
        doubleTapThreshold: 300, // ms for double tap to run
    },
    
    // Player Weapon settings
    weapons: {
        shootCooldown: 500, // ms
        maxAmmo: 100,
        defaultAmmo: 30,
    },
    
   // Enemy settings
    enemies: {
        // DEFAULT Enemy settings
        type: "character",
        sub_type: "enemy",
        health: 100,
        destructible: true,
        respawn: true,
        respawn_time: 10000, // ms - matches model_data.json
        respawn_delay: 5000, // ms - matches model_data.json
        respawn_min_time: 5000, // 5 seconds minimum respawn time 
        respawn_max_time: 10000, // 10 seconds maximum respawn time
        detection_range: 12, // Units for player detection
        aggro_time: 10000, // 10 seconds of aggro after being hit
        death_anim_duration: 500, // ms
        hit_reaction_duration: 500, // ms
        search_duration: 5000, // ms - how long enemy searches for player
        models: [], // Initialize as empty, will be populated from fetch
        max_enemies: 10, // Maximum number of enemies that can be spawned
        spawn_interval: 10000, // ms between enemy spawns
        
        // Movement settings
        idle_duration: 3000, // ms
        move_speed: 1.5,
        chase_speed: 2.0, // Faster when chasing
        rotation_speed: 0.15,
        
        // Attack mode settings
        attack_range: 10, // Distance at which enemy transitions from CHASE to ATTACK
        dodge_frequency: 0.03, // Probability to dodge per frame in ATTACK mode
        min_dodge_distance: 3, // Minimum distance to dodge
        max_dodge_distance: 6, // Maximum distance to dodge
        circle_strafing: true, // Whether enemy strafes around player in ATTACK mode
        min_attack_distance: 5, // Min distance enemy tries to maintain in ATTACK mode
        max_attack_distance: 8, // Max distance enemy tries to maintain in ATTACK mode
        attack_mode_decision_time: 1000, // ms between attack mode decision updates
        
        // Shooting settings
        shoot_probability: 0.01, // 1% chance per frame to shoot when in chase mode
        attack_shoot_probability: 0.03, // 3% chance per frame to shoot when in attack mode
        burst_fire_enabled: true, // Whether enemy can fire in bursts
        burst_shot_count: 3, // Number of shots in a burst
        burst_fire_interval: 150, // ms between burst shots
        
        // Hitbox dimensions
        head_hitbox: {
            width: 0.6,
            height: 0.6,
            depth: 0.6,
            y_position: 1.7 // Position at head height
        },
        body_hitbox: {
            width: 0.9,
            height: 1.4,
            depth: 1.0,
            y_position: 0.9 // Position at body height
        }
    },
    
    // Patrol path settings
    patrolPaths: {
        minWaypoints: 6,
        maxWaypoints: 13,
        minRadius: 10,
        maxRadius: 25,
        minDistance: 5, // Minimum distance between paths
        maxAttempts: 10, // Max attempts to generate a unique path
        waypointReachedThreshold: 0.5, // Distance to consider waypoint reached
        
        // Search path settings
        searchPathMinWaypoints: 3,
        searchPathMaxWaypoints: 5
    }
    ,
    
    // Map settings
    map: {
        boundaries: {
            minX: -50,
            maxX: 50,
            minZ: -50,
            maxZ: 50
        },
        boundaryMargin: 5 // Margin from map edge for spawning
    },
    
    // Debug settings
    debug: {
        showHitboxes: false,
        showWaypoints: false,
        showPathLines: false,
        highlightCurrentWaypoint: true,
        showHitPoints: true,
        showDebugInfoLog: false,
    }
};

// Make GameConfig globally accessible
window.GameConfig = GameConfig;

// Load enemy models from model_data.json
fetch('/Demos/model_data.json')
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to load model_data.json: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        // Filter models where type is character and sub_type is enemy
        if (data && data.models && Array.isArray(data.models)) {
            enemy_models = data.models
                .filter(model => model.type === "character" && model.sub_type === "enemy")
                .map(model => model.name);
            
            // Update GameConfig with the loaded models
            GameConfig.enemies.models = enemy_models;
            console.log("Successfully loaded enemy models:", enemy_models);
            
            // Dispatch an event to notify that models are loaded
            const event = new CustomEvent('enemyModelsLoaded', { detail: enemy_models });
            window.dispatchEvent(event);
        } else {
            throw new Error('Invalid model data structure');
        }
    })
    .catch(error => {
        console.error('Error loading model data:', error);
        // Fallback to default models if fetch fails
        enemy_models = [
            "Character_Enemy.glb",
            "Character_Hazmat.glb",
            "Character_Soldier.glb"
        ];
        GameConfig.enemies.models = enemy_models;
        console.warn("Using default enemy models due to fetch error");
    }); 