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

    static getAnimationForMode(mode) {
        switch (mode) {
            case this.MODES.IDLE:
                return "CharacterArmature|Idle";
            case this.MODES.PATROL:
                return "CharacterArmature|Walk";
            case this.MODES.CHASE:
            case this.MODES.ATTACK:
                return "CharacterArmature|Run";
            case this.MODES.DEATH:
                return "CharacterArmature|Death";
            case this.MODES.HIT_REACT:
                return "CharacterArmature|HitReact";
            default:
                return "CharacterArmature|Idle";
        }
    }

    static getSpeedForMode(mode) {
        switch (mode) {
            case this.MODES.IDLE:
                return 0;
            case this.MODES.PATROL:
                return 2;
            case this.MODES.CHASE:
                return 4;
            case this.MODES.ATTACK:
                return 3;
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