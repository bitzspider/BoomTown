import { Scene, Vector3 } from "@babylonjs/core";
import { Enemy } from "../entities/Enemy";

interface EnemyManagerConfig {
    maxEnemies: number;
    spawnInterval: number;
    boundaryLimit: number;
}

export class EnemyManager {
    private enemies: Enemy[] = [];
    private scene: Scene;
    private maxEnemies: number;
    private spawnInterval: number;
    private boundaryLimit: number;

    constructor(scene: Scene, config: EnemyManagerConfig) {
        console.log("EnemyManager constructor called with config:", config);
        this.scene = scene;
        this.maxEnemies = config.maxEnemies;
        this.spawnInterval = config.spawnInterval;
        this.boundaryLimit = config.boundaryLimit;

        // Start spawning enemies
        this.startSpawning();
    }

    private startSpawning(): void {
        console.log("Starting enemy spawning process...");
        // Spawn one enemy immediately
        this.spawnEnemy();

        // Set up interval for spawning
        setInterval(() => {
            this.spawnEnemy();
        }, this.spawnInterval);
    }

    private spawnEnemy(): void {
        // Only spawn if we haven't reached max enemies
        const activeEnemies = this.getActiveEnemies().length;
        console.log(`Current active enemies: ${activeEnemies}, Max enemies: ${this.maxEnemies}`);
        
        if (activeEnemies >= this.maxEnemies) {
            console.log("Maximum enemies reached, skipping spawn");
            return;
        }

        // Generate random position within bounds
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * this.boundaryLimit;
        const position = new Vector3(
            Math.cos(angle) * distance,
            0,
            Math.sin(angle) * distance
        );

        console.log("Spawning new enemy at position:", position);
        
        // Create new enemy
        const enemy = new Enemy(this.scene, position);
        this.enemies.push(enemy);
    }

    public getActiveEnemies(): Enemy[] {
        // Filter out any inactive/dead enemies and clean up the array
        this.enemies = this.enemies.filter(enemy => enemy.isActive());
        return this.enemies;
    }

    public update(): void {
        // Update active enemies list
        this.getActiveEnemies();
    }
} 