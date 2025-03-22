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
        
        // Character-specific mode configuration - default values
        this.modeConfig = {
            IDLE: {
                animation: null, // Will be populated dynamically
                speed: 0.0
            },
            PATROL: {
                animation: null, // Will be populated dynamically
                speed: 2.0
            },
            CHASE: {
                animation: null, // Will be populated dynamically
                speed: 4.0
            },
            ATTACK: {
                animation: null, // Will be populated dynamically
                speed: 2.0
            },
            DEATH: {
                animation: null, // Will be populated dynamically
                speed: 0.0
            },
            HIT_REACT: {
                animation: null, // Will be populated dynamically
                speed: 0.0
            }
        };
        
        // Animation mappings will be populated dynamically
        this.availableAnimations = [];
        
        // Animation keywords for different modes
        this.animationKeywords = {
            IDLE: ["idle", "stand"],
            PATROL: ["walk", "patrol"],
            CHASE: ["run", "chase"],
            ATTACK: ["attack", "shoot", "fire"],
            DEATH: ["death", "die", "dead"],
            HIT_REACT: ["hit", "react", "pain", "hurt"]
        };
    }

    // Update configuration with dynamically enumerated animations
    updateWithAnimations(animationList) {
        if (!animationList || !Array.isArray(animationList) || animationList.length === 0) {
            console.warn("[ANIM CONFIG] No animations provided for model");
            return;
        }
        
        // Store available animations
        this.availableAnimations = [...animationList];
        
        // Map animations to appropriate modes based on keywords
        this.mapAnimationsToModes(animationList);
        
        console.log("[ANIM CONFIG] Updated configuration with animations:", this.availableAnimations);
        console.log("[ANIM CONFIG] Mode mappings:", this.modeConfig);
    }
    
    // Map animations to modes based on name patterns
    mapAnimationsToModes(animationList) {
        // First pass: Try to find exact matches for each mode
        for (const mode in this.MODES) {
            const keywords = this.animationKeywords[mode];
            if (!keywords) continue;
            
            // Find the best matching animation for this mode
            const bestMatch = this.findBestAnimationMatch(animationList, keywords);
            
            if (bestMatch) {
                this.modeConfig[mode].animation = bestMatch;
                console.log(`[ANIM CONFIG] Mapped ${mode} to animation: ${bestMatch}`);
            }
        }
        
        // Second pass: Fill in any missing animations with reasonable defaults
        this.fillMissingAnimations();
    }
    
    // Find the best animation match based on keywords
    findBestAnimationMatch(animationList, keywords) {
        // First try to find exact matches (case-insensitive)
        for (const keyword of keywords) {
            const exactMatches = animationList.filter(anim => 
                anim.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (exactMatches.length > 0) {
                // If multiple matches, prefer the one with the most specific name
                // (i.e., the shortest one that still contains the keyword)
                return exactMatches.sort((a, b) => a.length - b.length)[0];
            }
        }
        
        // No exact matches found
        return null;
    }
    
    // Fill in any missing animation mappings with reasonable defaults
    fillMissingAnimations() {
        // If we have an idle animation, use it as default for any unmapped modes
        const idleAnim = this.modeConfig.IDLE.animation;
        
        // If we have a run animation but no attack animation, use run for attack
        if (this.modeConfig.CHASE.animation && !this.modeConfig.ATTACK.animation) {
            this.modeConfig.ATTACK.animation = this.modeConfig.CHASE.animation;
            console.log(`[ANIM CONFIG] Using chase animation for attack: ${this.modeConfig.ATTACK.animation}`);
        }
        
        // For any missing animations, try to use reasonable defaults
        for (const mode in this.MODES) {
            if (!this.modeConfig[mode].animation) {
                // If we have any animation at all, use the first one as fallback
                if (this.availableAnimations.length > 0) {
                    this.modeConfig[mode].animation = idleAnim || this.availableAnimations[0];
                    console.log(`[ANIM CONFIG] No specific animation for ${mode}, using fallback: ${this.modeConfig[mode].animation}`);
                } else {
                    // No animations available, set to null
                    this.modeConfig[mode].animation = null;
                    console.warn(`[ANIM CONFIG] No animations available for ${mode}`);
                }
            }
        }
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
            const animation = animationMappings[modelType][mode];
            console.log(`[ANIM CONFIG] Found specific mapping for ${modelType} in mode ${mode}: "${animation}"`);
            return animation;
        }

        // Try fallback to generic model if no specific mapping found
        if (mode && animationMappings["Character_Enemy"][mode]) {
            const fallbackAnimation = animationMappings["Character_Enemy"][mode];
            console.log(`[ANIM CONFIG] No specific mapping for ${modelType} in mode ${mode}, using fallback: "${fallbackAnimation}"`);
            return fallbackAnimation;
        }

        // No mapping found
        console.log(`[ANIM CONFIG] No animation mapping found for ${modelType} in mode ${mode}`);
        return null;
    }

    static getSpeedForMode(mode) {
        // Get speeds from GameConfig if available
        if (window.GameConfig && window.GameConfig.enemies) {
            switch (mode) {
                case this.MODES.IDLE:
                    return 0; // Idle is always 0
                case this.MODES.PATROL:
                    // Patrol speed is move_speed
                    return window.GameConfig.enemies.move_speed || 1.5;
                case this.MODES.CHASE:
                    // Chase speed is chase_speed
                    return window.GameConfig.enemies.chase_speed || 2.5;
                case this.MODES.ATTACK:
                    // Use move_speed for attack mode   
                    return window.GameConfig.enemies.move_speed || 1.5;
                case this.MODES.DEATH:
                    return 0; // Death is always 0
                case this.MODES.HIT_REACT:
                    return 0; // Hit reaction is always 0
                default:
                    return 0;
            }
        }
        
        // Fallback to defaults if GameConfig is not available
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

// Listen for the BabylonJS scene's animation groups to be loaded
window.addEventListener('DOMContentLoaded', () => {
    // This will allow us to hook into Model_Viewer.html's animation loading
    // We'll hook into the scene after models are loaded
    if (typeof BABYLON !== 'undefined') {
        console.log("[ANIM CONFIG] BABYLON found, will attempt to hook into scene events");
        
        // Function to try to hook into the scene
        const tryToHookIntoScene = () => {
            if (window.scene && window.scene.animationGroups) {
                console.log("[ANIM CONFIG] Found scene with animations, hooking in...");
                
                // Extract animation names from the scene
                const animationNames = window.scene.animationGroups.map(group => group.name);
                console.log("[ANIM CONFIG] Found animations:", animationNames);
                
                // Update our configuration with these animations
                window.characterEnemyConfig.updateWithAnimations(animationNames);
            } else {
                console.log("[ANIM CONFIG] Scene or animations not found yet, waiting...");
                setTimeout(tryToHookIntoScene, 500);
            }
        };
        
        // Start trying to hook in after a short delay
        setTimeout(tryToHookIntoScene, 500);
    }
});