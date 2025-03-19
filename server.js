const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const port = 3000;

// Helper function to set GLB MIME type
function setGLBHeaders(res, path) {
    if (path.endsWith('.glb')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
    }
}

// Parse JSON bodies
app.use(express.json());

// Get map data endpoint - needs to be before static file serving
app.get('/map-data', async (req, res) => {
    try {
        const mapData = await fs.readFile(
            path.join(__dirname, 'public', 'Demos', 'map_data.json'),
            'utf8'
        );
        res.setHeader('Content-Type', 'application/json');
        res.send(mapData);
    } catch (error) {
        console.error('Error reading map:', error);
        res.status(500).json({ error: 'Failed to read map' });
    }
});

// Get model data endpoint
app.get('/model-data', async (req, res) => {
    try {
        const modelData = await fs.readFile(
            path.join(__dirname, 'public', 'Demos', 'model_data.json'),
            'utf8'
        );
        res.setHeader('Content-Type', 'application/json');
        res.send(modelData);
    } catch (error) {
        console.error('Error reading model data:', error);
        res.status(500).json({ error: 'Failed to read model data' });
    }
});

// Save map endpoint
app.post('/save-map', async (req, res) => {
    try {
        const mapData = req.body;
        console.log('Received map data to save:', JSON.stringify(mapData, null, 2));
        
        // Validate map data structure
        if (!mapData || typeof mapData !== 'object') {
            throw new Error('Invalid map data: must be an object');
        }
        if (!Array.isArray(mapData.objects)) {
            throw new Error('Invalid map data: objects must be an array');
        }
        if (!mapData.name || typeof mapData.name !== 'string') {
            throw new Error('Invalid map data: name must be a string');
        }

        // Validate each object in the array
        mapData.objects.forEach((obj, index) => {
            if (!obj.id || !obj.model || !obj.position || !obj.rotation || !obj.scale) {
                throw new Error(`Invalid object at index ${index}: missing required properties`);
            }
            ['x', 'y', 'z'].forEach(coord => {
                if (typeof obj.position[coord] !== 'number') {
                    throw new Error(`Invalid position.${coord} for object ${obj.id}`);
                }
                if (typeof obj.rotation[coord] !== 'number') {
                    throw new Error(`Invalid rotation.${coord} for object ${obj.id}`);
                }
                if (typeof obj.scale[coord] !== 'number') {
                    throw new Error(`Invalid scale.${coord} for object ${obj.id}`);
                }
            });
        });

        const filePath = path.join(__dirname, 'public', 'Demos', 'map_data.json');
        const backupPath = path.join(__dirname, 'public', 'Demos', 'map_data.backup.json');

        // Create backup of existing file if it exists
        if (await fs.access(filePath).then(() => true).catch(() => false)) {
            await fs.copyFile(filePath, backupPath);
        }

        // Save the new data
        await fs.writeFile(filePath, JSON.stringify(mapData, null, 2));
        
        // Verify the file was written correctly
        const savedData = await fs.readFile(filePath, 'utf8');
        const parsedSavedData = JSON.parse(savedData);
        
        if (!parsedSavedData.objects || !Array.isArray(parsedSavedData.objects)) {
            // Something went wrong, restore from backup
            if (await fs.access(backupPath).then(() => true).catch(() => false)) {
                await fs.copyFile(backupPath, filePath);
                throw new Error('Save verification failed, restored from backup');
            }
        }
        
        console.log('Map saved successfully. Object count:', mapData.objects.length);
        
        res.json({ 
            success: true, 
            message: 'Map saved successfully',
            objectCount: mapData.objects.length
        });
    } catch (error) {
        console.error('Error in /save-map:', error);
        res.status(500).json({ 
            error: 'Failed to save map',
            details: error.message,
            stack: error.stack
        });
    }
});

// Rename map endpoint
app.post('/rename-map', async (req, res) => {
    try {
        const { mapId, oldName, newName } = req.body;
        
        if (!mapId || !oldName || !newName) {
            return res.status(400).json({ error: 'Missing required parameters: mapId, oldName, newName' });
        }

        const filePath = path.join(__dirname, 'public', 'Demos', 'map_data.json');
        
        // Read and parse the current map data
        const mapData = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
        // Verify this is the correct map by checking both ID and name
        if (mapData.id !== mapId) {
            return res.status(400).json({ error: 'Map ID mismatch' });
        }
        
        if (mapData.name !== oldName) {
            return res.status(400).json({ error: 'Current map name mismatch' });
        }

        // Create backup before making changes
        const backupDir = path.join(__dirname, 'public', 'Demos', 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `map_data_${timestamp}.json`);
        await fs.writeFile(backupPath, JSON.stringify(mapData, null, 2));

        // Update the name
        mapData.name = newName;
        
        // Write the updated data back to the file
        await fs.writeFile(filePath, JSON.stringify(mapData, null, 2));
        
        console.log(`Map renamed successfully from "${oldName}" to "${newName}"`);
        res.json({ 
            success: true,
            message: 'Map renamed successfully',
            newName: newName
        });
    } catch (error) {
        console.error('Error renaming map:', error);
        res.status(500).json({ 
            error: 'Failed to rename map',
            details: error.message
        });
    }
});

// Endpoint to list all models
app.get('/list-models', async (req, res) => {
    try {
        const modelsDir = path.join(__dirname, 'public', 'models');
        const files = await fs.readdir(modelsDir);
        const modelFiles = files.filter(file => 
            file.toLowerCase().endsWith('.glb') || 
            file.toLowerCase().endsWith('.gltf')
        );
        res.json({ models: modelFiles });
    } catch (error) {
        console.error('Error listing models:', error);
        res.status(500).json({ error: 'Failed to list models' });
    }
});

// Serve models from the public/models directory
app.use('/models', express.static(path.join(__dirname, 'public', 'models'), {
    setHeaders: setGLBHeaders
}));

// Serve static files from the public directory
app.use(express.static('public', {
    setHeaders: setGLBHeaders
}));

// For any other route, serve the index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Open your browser and navigate to http://localhost:${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is already in use. The server is likely already running.`);
        console.log(`Open your browser and navigate to http://localhost:${port}`);
    } else {
        console.error('Server error:', err);
    }
}); 