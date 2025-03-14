import { Scene, SceneLoader, AbstractMesh, AnimationGroup } from "@babylonjs/core";

export class Enemy {
    private static loadedModel: { meshes: AbstractMesh[], animationGroups: AnimationGroup[] } | null = null;

    // Static method to preload the model
    public static async preloadModel(scene: Scene): Promise<void> {
        try {
            console.log("Starting model preload...");
            
            // Configure scene loader
            SceneLoader.ShowLoadingScreen = false;
            
            // Use paths relative to the static directory
            const rootUrl = "/static/models/";
            const filename = "Character_Enemy.glb";
            console.log("Loading model:", { rootUrl, filename });
            
            const result = await SceneLoader.ImportMeshAsync(
                "",     // meshNames: load all meshes
                rootUrl,
                filename,
                scene
            );

            console.log("Model loaded successfully. Details:", {
                meshCount: result.meshes.length,
                meshNames: result.meshes.map((mesh: AbstractMesh) => mesh.name),
                animationGroups: result.animationGroups.map((anim: AnimationGroup) => anim.name)
            });

            this.loadedModel = {
                meshes: result.meshes,
                animationGroups: result.animationGroups
            };

        } catch (error) {
            console.error("Error during model preload:", error);
            
            // Additional error information
            if (error instanceof Error) {
                console.error("Error details:", {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
            }
            
            // Try to fetch the file directly to check its availability
            const fullUrl = "/static/models/Character_Enemy.glb";
            try {
                const response = await fetch(fullUrl);
                console.log("Direct fetch response:", {
                    url: fullUrl,
                    status: response.status,
                    statusText: response.statusText,
                    contentType: response.headers.get("content-type"),
                    contentLength: response.headers.get("content-length")
                });
                
                const buffer = await response.arrayBuffer();
                const firstBytes = new Uint8Array(buffer.slice(0, 4));
                console.log("File content info:", {
                    byteLength: buffer.byteLength,
                    firstBytes: Array.from(firstBytes),
                    firstBytesHex: Array.from(firstBytes).map(b => ('0' + b.toString(16)).slice(-2)).join(' '),
                    firstBytesAscii: String.fromCharCode(...firstBytes)
                });
            } catch (fetchError) {
                console.error("Direct fetch failed:", fetchError);
            }
            
            throw error;
        }
    }
}