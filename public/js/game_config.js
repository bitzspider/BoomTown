/*
 * BoomTown Game Configuration (game_config.js)
 * 
 * PURPOSE:
 * This file serves as the central configuration hub for all default game settings.
 * It defines base values for player stats, enemy behavior, physics, weapons, and debug options.
 * All game mechanics and parameters are initialized here with reasonable defaults.
 * 
 * DEPENDENCIES (files this relies on):
 * - /Demos/model_data.json: Loads enemy model definitions and their properties
 *   This file is used to populate the enemy models array with properly typed enemies.
 * 
 * DEPENDENTS (files that rely on this):
 * - player_main.js: Uses these settings for player movement, physics, weapons, and spawning enemies
 * - character_enemy_controller.js: Uses enemy-specific settings for AI behavior, health, animations
 * - All gameplay mechanics reference these settings for their baseline behavior
 * 
 * DATA HIERARCHY:
 * This file represents the LOWEST level in the configuration hierarchy.
 * 1. game_config.js (default settings - lowest priority)
 * 2. model_data.json (model-specific settings - middle priority)
 * 3. map_data.json (map/instance-specific settings - highest priority)
 * 
 * Settings from higher levels override those from lower levels.
 * 
 * GLOBAL EXPORTS:
 * - window.GameConfig: Exposes all settings to other scripts
 * - window.debugLog: Utility function for conditional logging
 */

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
        respawn: false,
        respawn_time: 3000,
        health: 200,
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
    
   // Default Enemy settings (override in model_data.json)
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
        max_enemies: 10, // Maximum number of enemies that can be present simultaneously on the map
        spawn_interval: 10000, // ms between enemy spawns
        
        // Damage settings
        projectile_damage: 5, // Damage from enemy projectiles (ranged attacks)
        melee_damage: 40, // Damage from enemy melee attacks
        damage_multiplier: 1.0, // Global multiplier for all enemy damage (adjust for difficulty)
        
        // Movement settings
        idle_duration: 3000, // ms
        move_speed: 0.8,
        chase_speed: 1.0, // Faster when chasing
        rotation_speed: 0.15,
        
        // Attack mode settings
        attack_range: 10, // Distance at which enemy transitions from CHASE to ATTACK
        dodge_frequency: 0.03, // Probability to dodge per frame in ATTACK mode
        min_dodge_distance: 3, // Minimum distance to dodge
        max_dodge_distance: 7, // Maximum distance to dodge
        circle_strafing: true, // Whether enemy strafes around player in ATTACK mode
        min_attack_distance: 5, // Min distance enemy tries to maintain in ATTACK mode
        max_attack_distance: 8, // Max distance enemy tries to maintain in ATTACK mode
        attack_mode_decision_time: 1000, // ms between attack mode decision updates
        
        // Shooting settings
        shoot_probability: 0.01, // 1% chance per frame to shoot when in chase mode
        attack_shoot_probability: 0.03, // 3% chance per frame to shoot when in attack mode
        burst_fire_enabled: false, // Whether enemy can fire in bursts
        burst_shot_count: 3, // Number of shots in a burst
        burst_fire_interval: 500, // ms between burst shots
        
        // Hitbox dimensions
        head_hitbox: {
            width: 0.7,
            height: 0.7,
            depth: 0.7,
            y_position: 1.7 // Position at head height
        },
        body_hitbox: {
            width: 0.8,
            height: 1.0,
            depth: 0.8,
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
        // No fallback to hardcoded models - if no enemies are in model_data.json, there are no enemies
        console.warn("No enemy models available: map may not have enemies");
    }); 