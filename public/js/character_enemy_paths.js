// Character Paths
// This file contains predefined paths for character movement

// Safe buffer from map edges (in units)
const PATH_EDGE_BUFFER = 10;

// Map boundaries reference
const MAP_BOUNDARIES = {
    minX: -45,
    maxX: 45,
    minZ: -45,
    maxZ: 45
};

// Function to get a random spawn point within map boundaries
function getRandomSpawnPoint() {
    const margin = PATH_EDGE_BUFFER;
    const x = MAP_BOUNDARIES.minX + margin + Math.random() * (MAP_BOUNDARIES.maxX - MAP_BOUNDARIES.minX - 2 * margin);
    const z = MAP_BOUNDARIES.minZ + margin + Math.random() * (MAP_BOUNDARIES.maxZ - MAP_BOUNDARIES.minZ - 2 * margin);
    return { x: x, y: 0, z: z };
}

// Function to get a random patrol path
function getRandomPatrolPath(startPosition = null) {
    // If no start position provided, generate a random one
    if (!startPosition) {
        startPosition = getRandomSpawnPoint();
    }
    
    // Ensure startPosition has y=0
    if (startPosition.y === undefined) {
        startPosition.y = 0;
    }
    
    // Generate a patrol path starting from this position
    return generatePolygonWaypoints(startPosition);
}

// Path types enum
const PathTypes = {
    PATROL: 'patrol'
};

// Function to check if two line segments intersect
function doLinesIntersect(p1, p2, p3, p4) {
    // Convert points to line segments
    const a = ((p4.z - p3.z) * (p1.x - p3.x) + (p3.x - p4.x) * (p1.z - p3.z)) /
             ((p3.x - p4.x) * (p1.z - p2.z) - (p1.x - p2.x) * (p3.z - p4.z));
    const b = ((p1.z - p2.z) * (p1.x - p3.x) + (p2.x - p1.x) * (p1.z - p3.z)) /
             ((p3.x - p4.x) * (p1.z - p2.z) - (p1.x - p2.x) * (p3.z - p4.z));
    
    // Check if lines intersect within their segments
    return a >= 0 && a <= 1 && b >= 0 && b <= 1;
}

// Function to check if a new line would intersect with existing lines
function wouldCreateIntersection(points, newPoint) {
    if (points.length < 2) return false;
    
    // Get the last point to create the new line segment
    const lastPoint = points[points.length - 1];
    
    // Check against all existing line segments except the last one
    for (let i = 0; i < points.length - 2; i++) {
        if (doLinesIntersect(lastPoint, newPoint, points[i], points[i + 1])) {
            return true;
        }
    }
    
    return false;
}

// Function to generate random polygon waypoints
function generatePolygonWaypoints(startPoint) {
    const numPoints = 3 + Math.floor(Math.random() * 3); // 3 to 5 points
    const points = [startPoint];
    const safetyMargin = PATH_EDGE_BUFFER;
    const minDistance = 5; // Minimum distance between points
    const maxDistance = 15; // Maximum distance between points
    const maxAttempts = 100; // Maximum attempts to find a valid point
    
    while (points.length < numPoints) {
        let validPoint = null;
        let attempts = 0;
        
        while (!validPoint && attempts < maxAttempts) {
            // Get the last point
            const lastPoint = points[points.length - 1];
            
            // Generate a random angle and distance
            const angle = Math.random() * Math.PI * 2;
            const distance = minDistance + Math.random() * (maxDistance - minDistance);
            
            // Calculate new point position
            const candidatePoint = {
                x: lastPoint.x + Math.cos(angle) * distance,
                y: 0,
                z: lastPoint.z + Math.sin(angle) * distance
            };
            
            // Clamp to map boundaries
            candidatePoint.x = Math.max(MAP_BOUNDARIES.minX + safetyMargin, 
                                      Math.min(MAP_BOUNDARIES.maxX - safetyMargin, candidatePoint.x));
            candidatePoint.z = Math.max(MAP_BOUNDARIES.minZ + safetyMargin, 
                                      Math.min(MAP_BOUNDARIES.maxZ - safetyMargin, candidatePoint.z));
            
            // Check if this point would create intersecting lines
            if (!wouldCreateIntersection(points, candidatePoint)) {
                validPoint = candidatePoint;
            }
            
            attempts++;
        }
        
        if (validPoint) {
            points.push(validPoint);
        } else {
            // If we can't find a valid point, break the loop but ensure we have at least 3 points
            if (points.length >= 3) {
                break;
            }
            // If we don't have enough points, try with a different starting configuration
            points.length = 1; // Keep only the start point
            continue;
        }
    }
    
    // Add the start point again to close the loop
    points.push({...startPoint});
    
    return points;
}

// Get path points based on type
function getPath(type, position = { x: 0, z: 0 }) {
    console.log("getPath called with:", type, "at position:", position);
    
    switch(type) {
        case PathTypes.PATROL:
            // For patrol, generate a new polygon path starting from the provided position
            return generatePolygonWaypoints(position);
            
        default:
            console.warn("Unknown path type:", type);
            return generatePolygonWaypoints(position);
    }
}

// Function to ensure a point is within map boundaries
function clampToMapBoundaries(point) {
    const safetyMargin = PATH_EDGE_BUFFER;
    return {
        x: Math.max(MAP_BOUNDARIES.minX + safetyMargin, 
           Math.min(MAP_BOUNDARIES.maxX - safetyMargin, point.x)),
        z: Math.max(MAP_BOUNDARIES.minZ + safetyMargin, 
           Math.min(MAP_BOUNDARIES.maxZ - safetyMargin, point.z))
    };
}

// Make sure getPath is globally accessible
window.getPath = getPath; 
window.getRandomSpawnPoint = getRandomSpawnPoint;
window.getRandomPatrolPath = getRandomPatrolPath; 