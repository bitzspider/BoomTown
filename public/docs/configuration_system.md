# BoomTown Configuration System Documentation

This document describes the configuration system used in BoomTown, explaining how different configuration files interact and their hierarchy.

## Configuration Hierarchy

BoomTown uses a three-tiered configuration hierarchy for game entities:

1. **game_config.js** (base settings - lowest priority)
2. **model_data.json** (model-specific settings - middle priority)
3. **map_data.json** (instance-specific settings - highest priority)

Settings from higher levels override those from lower levels. This allows for great flexibility in designing maps and customizing gameplay.

## Configuration Files

### 1. game_config.js

**Location:** `public/js/game_config.js`

**Purpose:** 
- Provides base default settings for all game mechanics
- Initializes gameplay parameters with reasonable defaults
- Defines shared behavior for all entities of the same type

**Key Settings:**
- Player movement, health, physics
- Enemy default AI behavior and stats
- Weapon parameters
- Game physics constants
- Debug options

**Example:**
```javascript
GameConfig.enemies = {
    health: 100,
    moveSpeed: 0.8,
    chaseSpeed: 1.0,
    // ... other default settings
};
```

### 2. model_data.json

**Location:** `public/Demos/model_data.json`

**Purpose:**
- Defines properties for specific model types
- Categorizes models by type/sub_type
- Provides model-specific defaults that override game_config.js

**Structure:**
```json
{
    "models": [
        {
            "name": "Character_Enemy.glb",
            "type": "character",
            "sub_type": "enemy",
            "health": 100,
            "moveSpeed": 0.8,
            // ... model-specific settings
        },
        // ... other models
    ]
}
```

**Key Concepts:**
- Each model has a type (character, loot, trap, object, etc.)
- Sub-types further categorize (enemy, ammo, health, etc.)
- Enemy models must have type="character" and sub_type="enemy"
- Settings here override the defaults from game_config.js

### 3. map_data.json

**Location:** `public/Demos/map_data.json`

**Purpose:**
- Defines the actual level layout and object placement
- Stores instance-specific properties for each placed object
- Provides the highest priority overrides for object behavior

**Structure:**
```json
{
    "name": "Level Name",
    "version": "1.0",
    "objects": [
        {
            "id": "unique_id",
            "model": "Character_Enemy.glb",
            "type": "character",
            "sub_type": "enemy",
            "position": { "x": 10, "y": 0, "z": 15 },
            "rotation": { "x": 0, "y": 45, "z": 0 },
            "scale": { "x": 1, "y": 1, "z": 1 },
            "attributes": {
                "health": 150,
                "moveSpeed": 1.2
                // ... instance-specific overrides
            }
        },
        // ... other objects
    ]
}
```

**Key Concepts:**
- Created and edited by the Map Designer tool
- Each object has unique ID and model reference
- Position, rotation, and scale define placement
- Attributes can override both game_config.js and model_data.json

## Workflow and Data Flow

### Map Creation
1. Designer places objects in Map Designer
2. Models get type/sub_type based on model_data.json or hardcoded for common types
3. Map is saved to map_data.json with all objects and their attributes

### Game Loading
1. Game loads default settings from game_config.js
2. Enemy models are loaded from model_data.json based on type/sub_type
3. Map is loaded from map_data.json
4. Each enemy is instantiated with merged configuration:
   - Base settings from game_config.js
   - Model-specific overrides from model_data.json
   - Instance-specific overrides from map_data.json

### Enemy Spawning Logic
- Enemies are loaded exclusively from map_data.json
- Only objects with type="character" and sub_type="enemy" are spawned as enemies
- No hardcoded enemy models - everything comes from the map designer
- If no enemies are defined in the map, none will spawn

## Core Components Interaction

### Map Designer Engine (map_designer_engine.js)
- Assigns type="character" and sub_type="enemy" to character models
- Loads model_data.json for model properties
- Produces map_data.json with positions and attributes

### Game Config (game_config.js)
- Provides default settings for all aspects of gameplay
- Loads enemy models from model_data.json

### Enemy Controller (character_enemy_controller.js)
- Uses the merged configuration hierarchy for enemy behavior
- Applies specific model properties and animations
- Handles enemy AI based on configuration parameters

### Player Main (player_main.js)
- Spawns enemies from map data
- Manages gameplay mechanics
- Controls player-enemy interactions

## Important Notes

1. **No Hardcoded Fallbacks**: There are no hardcoded model fallbacks in the system. If no enemies are defined in the map data, no enemies should spawn.

2. **Type & Sub_type**: The type/sub_type classification is crucial - it's how the game identifies which objects should be spawned as enemies.

3. **Configuration Priority**: Always remember the priority order: map_data.json > model_data.json > game_config.js 