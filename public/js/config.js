// Game Configuration
const GameConfig = {
    player: {
        height: 2,
        moveSpeed: 0.1,
        runSpeed: 0.2,
        jumpForce: 0.3,
        gravity: -0.01,
        health: 100,
        hitCooldown: 1000,
        mouseSensitivity: 0.002,
        doubleTapThreshold: 300 // ms
    },
    weapons: {
        shootCooldown: 250, // ms
        defaultAmmo: 30,
        maxAmmo: 100
    },
    enemies: {
        maxEnemies: 10,
        spawnInterval: 5000, // ms
        respawnMinTime: 3000, // ms
        respawnMaxTime: 8000, // ms
        models: [
            'Enemy.glb'
        ]
    },
    map: {
        boundaries: {
            minX: -50,
            maxX: 50,
            minZ: -50,
            maxZ: 50
        }
    },
    debug: {
        showHitboxes: false,
        showWaypoints: false,
        showPathLines: false,
        highlightCurrentWaypoint: false,
        showDebugInfoLog: false
    }
};

// Make config globally accessible
window.GameConfig = GameConfig; 