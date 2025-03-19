// Custom debug logging function that respects the showDebugInfoLog setting
function debugLog(message, forceShow = false) {
    // Always show errors and forced messages regardless of setting
    if (forceShow || message.includes('ERROR') || message.includes('Error') || message.includes('error')) {
        console.log(message);
        return;
    }
    
    // Only show informational logs if enabled
    if (GameConfig.debug.showDebugInfoLog) {
        console.log(message);
    }
}

// Make debugLog globally accessible
window.debugLog = debugLog;

// BoomTown Game Configuration
// This file contains all game variables and settings that control gameplay mechanics

const GameConfig = {
    // Player settings
    player: {
        health: 100,
        height: 1.8, // Player height in units
        moveSpeed: 0.1,
        runSpeed: 0.16,
        jumpForce: 0.3,
        gravity: -0.01,
        hitCooldown: 600, // 1 second cooldown between hits
        mouseSensitivity: 0.002,
        doubleTapThreshold: 300, // ms for double tap to run
    },
    
    // Weapon settings
    weapons: {
        shootCooldown: 500, // ms
        maxAmmo: 100,
        defaultAmmo: 30,
    },
    
    // Enemy settings
    enemies: {
        maxEnemies: 5,
        spawnInterval: 10000, // ms
        respawnMinTime: 5000, // 5 seconds minimum respawn time
        respawnMaxTime: 10000, // 10 seconds maximum respawn time
        health: 100,
        detectionRange: 12, // Units for player detection
        aggroTime: 10000, // 10 seconds of aggro after being hit
        deathAnimDuration: 500, // ms
        hitReactionDuration: 500, // ms
        searchDuration: 5000, // ms - how long enemy searches for player
        models: ["Character_Enemy.glb", "Character_Hazmat.glb", "Character_Soldier.glb"],
        
        // Movement settings
        idleDuration: 3000, // ms
        moveSpeed: 2.0,
        chaseSpeed: 4.0, // Faster when chasing
        rotationSpeed: 0.15,
        
        // Attack mode settings
        attackRange: 10, // Distance at which enemy transitions from CHASE to ATTACK
        dodgeFrequency: 0.03, // Probability to dodge per frame in ATTACK mode
        minDodgeDistance: 3, // Minimum distance to dodge
        maxDodgeDistance: 6, // Maximum distance to dodge
        circleStrafing: true, // Whether enemy strafes around player in ATTACK mode
        minAttackDistance: 5, // Min distance enemy tries to maintain in ATTACK mode
        maxAttackDistance: 8, // Max distance enemy tries to maintain in ATTACK mode
        attackModeDecisionTime: 1000, // ms between attack mode decision updates
        
        // Shooting settings
        shootProbability: 0.01, // 1% chance per frame to shoot when in chase mode
        attackShootProbability: 0.03, // 3% chance per frame to shoot when in attack mode
        burstFireEnabled: true, // Whether enemy can fire in bursts
        burstShotCount: 3, // Number of shots in a burst
        burstFireInterval: 150, // ms between burst shots
        
        // Hitbox dimensions
        headHitbox: {
            width: 0.6,
            height: 0.6,
            depth: 0.6,
            yPosition: 1.7 // Position at head height
        },
        bodyHitbox: {
            width: 0.9,
            height: 1.4,
            depth: 1.0,
            yPosition: 0.9 // Position at body height
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