// Character Configuration System
// Allows for character-specific movement speeds without affecting animation speeds

// Base Character class
class CharacterConfig {
    constructor(name) {
        this.name = name;
        
        // Mode configuration: maps each mode to an animation and movement speed
        this.modeConfig = {
            IDLE: {
                animation: "Idle",
                speed: 0.0
            },
            PATROL: {
                animation: "Walk",
                speed: 1.0
            },
            CHASE: {
                animation: "Run",
                speed: 2.0
            },
            FLEE: {
                animation: "Run",
                speed: 3.0
            }
        };
    }
    
    // Get movement speed for a specific mode
    getSpeed(mode) {
        return this.modeConfig[mode]?.speed || this.modeConfig.PATROL.speed;
    }
    
    // Set movement speed for a specific mode
    setSpeed(mode, speed) {
        if (this.modeConfig[mode]) {
            this.modeConfig[mode].speed = speed;
            console.log(`Set ${this.name} ${mode} speed to ${speed}`);
            return true;
        }
        return false;
    }
    
    // Get animation name for a specific mode
    getAnimationForMode(mode) {
        return this.modeConfig[mode]?.animation || this.modeConfig.IDLE.animation;
    }
}

// Character_Enemy specific configuration
class CharacterEnemy extends CharacterConfig {
    constructor() {
        super("Character_Enemy");
        
        // Character-specific mode configuration
        this.modeConfig = {
            IDLE: {
                animation: "Idle",
                speed: 0.0
            },
            PATROL: {
                animation: "Walk_Shoot",
                speed: 1.0
            },
            CHASE: {
                animation: "Run_Shoot",
                speed: 4.0
            },
            FLEE: {
                animation: "Run",
                speed: 5.5
            }
        };
        
        // All available animations for this character (for reference)
        this.availableAnimations = [
            "Idle", "Death", "Duck", "HitReact", "Idle_Shoot", 
            "Jump", "Jump_Idle", "Jump_Land", "No", "Punch", 
            "Run", "Run_Gun", "Run_Shoot", "Walk", "Walk_Shoot", 
            "Wave", "Yes"
        ];
    }
}

// Character registry to store and retrieve character configurations
class CharacterRegistry {
    constructor() {
        this.characters = {};
        this.registerDefaultCharacters();
    }
    
    registerDefaultCharacters() {
        // Register Character_Enemy
        this.register(new CharacterEnemy());
        
        // Register a default character configuration
        this.register(new CharacterConfig("DEFAULT"));
    }
    
    register(characterConfig) {
        this.characters[characterConfig.name] = characterConfig;
        console.log(`Registered character config for ${characterConfig.name}`);
    }
    
    getCharacter(name) {
        return this.characters[name] || this.characters.DEFAULT;
    }
}

// Create and export the character registry
const characterRegistry = new CharacterRegistry();

// Helper function to get character speed
function getCharacterSpeed(characterName, mode) {
    const character = characterRegistry.getCharacter(characterName);
    return character.getSpeed(mode);
}

// Helper function to get animation for mode
function getCharacterAnimationForMode(characterName, mode) {
    const character = characterRegistry.getCharacter(characterName);
    return character.getAnimationForMode(mode);
} 