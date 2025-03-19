// Character Enemy Configuration System for Play.html
// Defines the configuration for enemy characters

class CharacterEnemyConfig {
    static MODES = {
        IDLE: "IDLE",
        PATROL: "PATROL",
        CHASE: "CHASE",
        ATTACK: "ATTACK",
        DEATH: "DEATH",
        HIT_REACT: "HIT_REACT"
    };

    constructor() {
        this.name = "Character_Enemy";
        
        // Character-specific mode configuration
        this.modeConfig = {
            IDLE: {
                animation: "CharacterArmature|Idle",
                speed: 0.0
            },
            PATROL: {
                animation: "CharacterArmature|Walk",
                speed: 2.0
            },
            CHASE: {
                animation: "CharacterArmature|Run",
                speed: 4.0
            },
            ATTACK: {
                animation: "CharacterArmature|Run",
                speed: 2.0
            },
            DEATH: {
                animation: "CharacterArmature|Death",
                speed: 0.0
            },
            HIT_REACT: {
                animation: "CharacterArmature|HitReact",
                speed: 0.0
            }
        };
        
        // All available animations for this character
        this.availableAnimations = [
            "CharacterArmature|Idle", 
            "CharacterArmature|Death", 
            "CharacterArmature|Run", 
            "CharacterArmature|Walk",
            "CharacterArmature|HitReact"
        ];
    }

    static getAnimationForMode(mode, modelType = "Character_Enemy") {
        // First, try model-specific animation name mapping
        const modelSpecificAnimation = this.getModelSpecificAnimation(mode, modelType);
        if (modelSpecificAnimation) {
            console.log(`Using model-specific animation for ${modelType} in mode ${mode}: ${modelSpecificAnimation}`);
            return modelSpecificAnimation;
        }

        // Fall back to standard animations
        switch (mode) {
            case this.MODES.IDLE:
                return "Idle";
            case this.MODES.PATROL:
                return "Walk";
            case this.MODES.CHASE:
                return "Run";
            case this.MODES.ATTACK:
                return "Run";
            case this.MODES.DEATH:
                return "Death";
            case this.MODES.HIT_REACT:
                return "HitReact";
            default:
                return "Idle";
        }
    }

    // Helper method to get model-specific animation names
    static getModelSpecificAnimation(mode, modelType) {
        // Model-specific animation mappings
        const animationMappings = {
            "Character_Enemy": {
                "IDLE": "CharacterArmature|Idle",
                "PATROL": "CharacterArmature|Walk",
                "CHASE": "CharacterArmature|Run",
                "ATTACK": "CharacterArmature|Run",
                "DEATH": "CharacterArmature|Death",
                "HIT_REACT": "CharacterArmature|HitReact"
            },
            "Character_Soldier": {
                "IDLE": "Idle",
                "PATROL": "Walk_Shoot",
                "CHASE": "Run_Shoot",
                "ATTACK": "Run_Gun",
                "DEATH": "Death",
                "HIT_REACT": "HitReact"
            },
            "Character_Hazmat": {
                "IDLE": "Idle",
                "PATROL": "Walk",
                "CHASE": "Run",
                "ATTACK": "Run",
                "DEATH": "Death",
                "HIT_REACT": "HitReact"
            }
        };

        // Check if we have mappings for this model type
        if (animationMappings[modelType] && animationMappings[modelType][mode]) {
            return animationMappings[modelType][mode];
        }

        // No model-specific mapping found
        return null;
    }

    static getSpeedForMode(mode) {
        switch (mode) {
            case this.MODES.IDLE:
                return 0;
            case this.MODES.PATROL:
                return 2;
            case this.MODES.CHASE:
                return 2.5;
            case this.MODES.ATTACK:
                return 2;
            case this.MODES.DEATH:
                return 0;
            case this.MODES.HIT_REACT:
                return 0;
            default:
                return 0;
        }
    }

    // Instance methods for getting animation and speed
    getSpeed(mode) {
        return this.modeConfig[mode]?.speed || 0;
    }

    setSpeed(mode, speed) {
        if (this.modeConfig[mode]) {
            this.modeConfig[mode].speed = speed;
            console.log(`Set ${this.name} ${mode} speed to ${speed}`);
            return true;
        }
        return false;
    }

    getAnimationForMode(mode) {
        return this.modeConfig[mode]?.animation || this.modeConfig.IDLE.animation;
    }
}

// Create a global instance
window.characterEnemyConfig = new CharacterEnemyConfig();
// Make the class available globally
window.CharacterEnemyConfig = CharacterEnemyConfig;