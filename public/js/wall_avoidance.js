// Wall Avoidance System
// This file contains functions for helping the character avoid and escape from walls

// Safe zone in the center of the map
const SAFE_ZONE = {
    x: 0,
    z: 0,
    radius: 20
};

// Wall avoidance constants
const WALL_BUFFER = 10; // Minimum distance from walls
const ESCAPE_SEGMENTS = 3; // Number of segments in escape path
const SEGMENT_LENGTH_MIN = 8; // Minimum length of each segment
const SEGMENT_LENGTH_MAX = 15; // Maximum length of each segment

// Generate an escape path when the character hits a wall
function generateWallEscapePath(position, hitWallDirection) {
    console.log("Generating wall escape path from position:", position);
    
    // Create an array to hold the escape path points
    const escapePath = [];
    
    // Add the starting position as the first point
    escapePath.push(position.clone());
    
    // Determine the initial escape direction (opposite to the wall hit direction)
    let escapeDirection = hitWallDirection.clone().negate();
    escapeDirection.normalize();
    
    // Generate intermediate points that lead away from the wall and toward the safe zone
    for (let i = 0; i < ESCAPE_SEGMENTS; i++) {
        // For each segment, gradually blend between moving away from wall and moving toward safe zone
        const blendFactor = i / (ESCAPE_SEGMENTS - 1); // 0 at first segment, 1 at last segment
        
        // Direction to safe zone
        const dirToSafeZone = new BABYLON.Vector3(
            SAFE_ZONE.x - position.x,
            0,
            SAFE_ZONE.z - position.z
        ).normalize();
        
        // Blend between escape direction and safe zone direction
        const blendedDirection = new BABYLON.Vector3(
            escapeDirection.x * (1 - blendFactor) + dirToSafeZone.x * blendFactor,
            0,
            escapeDirection.z * (1 - blendFactor) + dirToSafeZone.z * blendFactor
        ).normalize();
        
        // Add some randomness to avoid predictable paths
        const randomAngle = (Math.random() * 0.5 - 0.25) * Math.PI; // -45 to +45 degrees
        const randomizedDirection = new BABYLON.Vector3(
            blendedDirection.x * Math.cos(randomAngle) - blendedDirection.z * Math.sin(randomAngle),
            0,
            blendedDirection.x * Math.sin(randomAngle) + blendedDirection.z * Math.cos(randomAngle)
        );
        
        // Calculate segment length (longer for first segment to get away from wall quickly)
        const segmentLength = SEGMENT_LENGTH_MIN + 
            Math.random() * (SEGMENT_LENGTH_MAX - SEGMENT_LENGTH_MIN) + 
            (i === 0 ? 5 : 0); // First segment is longer
        
        // Calculate new position
        const newPosition = position.clone().add(randomizedDirection.scale(segmentLength));
        
        // Ensure the new position is within map boundaries with buffer
        const clampedPosition = clampPositionWithinBoundaries(newPosition, WALL_BUFFER);
        
        // Add the point to the escape path
        escapePath.push(clampedPosition);
        
        // Update position for next segment
        position = clampedPosition.clone();
    }
    
    // Add the safe zone as the final destination
    const safeZonePosition = new BABYLON.Vector3(
        SAFE_ZONE.x + (Math.random() * 10 - 5), // Add some randomness
        0,
        SAFE_ZONE.z + (Math.random() * 10 - 5)
    );
    escapePath.push(safeZonePosition);
    
    console.log("Generated escape path with", escapePath.length, "points");
    return escapePath;
}

// Helper function to clamp a position within map boundaries
function clampPositionWithinBoundaries(position, buffer) {
    const clampedPos = position.clone();
    clampedPos.x = Math.max(mapBoundaries.minX + buffer, Math.min(mapBoundaries.maxX - buffer, clampedPos.x));
    clampedPos.z = Math.max(mapBoundaries.minZ + buffer, Math.min(mapBoundaries.maxZ - buffer, clampedPos.z));
    return clampedPos;
}

// Check if a position is near a wall
function isNearWall(position, buffer) {
    return position.x <= mapBoundaries.minX + buffer || 
           position.x >= mapBoundaries.maxX - buffer || 
           position.z <= mapBoundaries.minZ + buffer || 
           position.z >= mapBoundaries.maxZ - buffer;
}

// Get the wall normal direction when hitting a wall
function getWallNormal(position) {
    const normal = new BABYLON.Vector3(0, 0, 0);
    
    // Determine which wall was hit based on position
    if (position.x <= mapBoundaries.minX + WALL_BUFFER) {
        normal.x = 1; // Right normal from left wall
    } else if (position.x >= mapBoundaries.maxX - WALL_BUFFER) {
        normal.x = -1; // Left normal from right wall
    }
    
    if (position.z <= mapBoundaries.minZ + WALL_BUFFER) {
        normal.z = 1; // Up normal from bottom wall
    } else if (position.z >= mapBoundaries.maxZ - WALL_BUFFER) {
        normal.z = -1; // Down normal from top wall
    }
    
    // Normalize the normal vector
    if (normal.length() > 0) {
        normal.normalize();
    } else {
        // If we couldn't determine the wall, default to moving toward center
        normal.x = SAFE_ZONE.x - position.x;
        normal.z = SAFE_ZONE.z - position.z;
        normal.normalize();
    }
    
    return normal;
}

// Follow an escape path
function followEscapePath(escapePath, onComplete) {
    console.log("Following escape path");
    
    // Reset any existing path following
    stopFollowingPath();
    
    // Create a function to follow each point in the escape path
    let currentPointIndex = 0;
    
    function followNextPoint() {
        if (currentPointIndex >= escapePath.length) {
            console.log("Escape path complete");
            if (onComplete) onComplete();
            return;
        }
        
        const point = escapePath[currentPointIndex];
        console.log("Moving to escape point", currentPointIndex + 1, "of", escapePath.length);
        
        // Use running animation for first point to get away from wall quickly
        const animation = currentPointIndex === 0 ? runAnim : walkAnim;
        moveToPointWithAnimation(point, animation);
        
        // Increment point index
        currentPointIndex++;
        
        // Schedule next point after a delay
        const delay = 1000 + Math.random() * 500;
        aiPathUpdateInterval = setTimeout(followNextPoint, delay);
    }
    
    // Start following the escape path
    followNextPoint();
} 