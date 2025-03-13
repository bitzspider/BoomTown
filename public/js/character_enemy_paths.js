// Character Paths
// This file contains predefined paths for character movement

// Safe buffer from map edges (in units)
const PATH_EDGE_BUFFER = 25;

// Patrol path - follows the perimeter of the map at a safe distance from edges
const PATROL_PATH = [
    // Start at top-left corner and move clockwise
    { x: -45 + PATH_EDGE_BUFFER, z: -45 + PATH_EDGE_BUFFER }, // Top-left
    { x: 0, z: -45 + PATH_EDGE_BUFFER }, // Top-middle
    { x: 45 - PATH_EDGE_BUFFER, z: -45 + PATH_EDGE_BUFFER },  // Top-right
    { x: 45 - PATH_EDGE_BUFFER, z: 0 }, // Right-middle
    { x: 45 - PATH_EDGE_BUFFER, z: 45 - PATH_EDGE_BUFFER },   // Bottom-right
    { x: 0, z: 45 - PATH_EDGE_BUFFER }, // Bottom-middle
    { x: -45 + PATH_EDGE_BUFFER, z: 45 - PATH_EDGE_BUFFER },  // Bottom-left
    { x: -45 + PATH_EDGE_BUFFER, z: 0 }, // Left-middle
    { x: -45 + PATH_EDGE_BUFFER, z: -45 + PATH_EDGE_BUFFER }  // Back to start (top-left)
];

// Figure-8 path - crosses the center of the map
const FIGURE_EIGHT_PATH = [
    { x: 0, z: -30 },                // Top
    { x: 30, z: 0 },                 // Right
    { x: 0, z: 30 },                 // Bottom
    { x: -30, z: 0 },                // Left
    { x: 0, z: -30 },                // Back to top
    { x: -30, z: 0 },                // Left
    { x: 0, z: 30 },                 // Bottom
    { x: 30, z: 0 },                 // Right
    { x: 0, z: -30 }                 // Back to top
];

// Diamond path - diagonal movements
const DIAMOND_PATH = [
    { x: 0, z: -35 },                // Top
    { x: 35, z: 0 },                 // Right
    { x: 0, z: 35 },                 // Bottom
    { x: -35, z: 0 },                // Left
    { x: 0, z: -35 }                 // Back to top
];

// Spiral path - starts from outside and moves inward
const SPIRAL_PATH = [
    { x: -30, z: -30 },              // Start at outer edge
    { x: 30, z: -30 },
    { x: 30, z: 30 },
    { x: -25, z: 30 },
    { x: -25, z: -25 },
    { x: 20, z: -25 },
    { x: 20, z: 20 },
    { x: -15, z: 20 },
    { x: -15, z: -15 },
    { x: 10, z: -15 },
    { x: 10, z: 10 },
    { x: -5, z: 10 },
    { x: -5, z: -5 },
    { x: 0, z: 0 }                   // End at center
];

// Random safe points throughout the map
const SAFE_POINTS = [
    { x: 0, z: 0 },                  // Center
    { x: 20, z: 20 },                // Northeast
    { x: -20, z: 20 },               // Northwest
    { x: -20, z: -20 },              // Southwest
    { x: 20, z: -20 },               // Southeast
    { x: 0, z: 30 },                 // North
    { x: 30, z: 0 },                 // East
    { x: 0, z: -30 },                // South
    { x: -30, z: 0 }                 // West
];

// Path types enum
const PathTypes = {
    PATROL: 'patrol',
    FIGURE_EIGHT: 'figure8',
    DIAMOND: 'diamond',
    SPIRAL: 'spiral',
    RANDOM: 'random'
};

// Get a path by type
function getPath(pathType) {
    console.log("getPath called with:", pathType);
    
    switch(pathType) {
        case PathTypes.PATROL:
            return PATROL_PATH;
        case PathTypes.FIGURE_EIGHT:
            return FIGURE_EIGHT_PATH;
        case PathTypes.DIAMOND:
            return DIAMOND_PATH;
        case PathTypes.SPIRAL:
            return SPIRAL_PATH;
        case PathTypes.RANDOM:
            return getRandomPath();
        default:
            return PATROL_PATH;
    }
}

// Generate a random path using safe points
function getRandomPath() {
    const path = [];
    const numPoints = 3 + Math.floor(Math.random() * 4); // 3-6 points
    
    // Always start with the center point
    path.push(SAFE_POINTS[0]);
    
    // Add random points from SAFE_POINTS, avoiding duplicates
    const usedIndices = [0]; // Center already used
    
    for (let i = 1; i < numPoints; i++) {
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * SAFE_POINTS.length);
        } while (usedIndices.includes(randomIndex));
        
        usedIndices.push(randomIndex);
        path.push(SAFE_POINTS[randomIndex]);
    }
    
    // Return to the first point to complete the loop
    path.push(path[0]);
    
    return path;
}

// Convert a path to waypoints with proper Vector3 objects
function pathToWaypoints(path) {
    return path.map(point => new BABYLON.Vector3(point.x, 0, point.z));
}

// Make sure getPath is globally accessible
window.getPath = getPath; 