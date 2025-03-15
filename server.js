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

// Save map endpoint
app.post('/save-map', async (req, res) => {
    try {
        const mapData = req.body;
        console.log('Received map data to save:', JSON.stringify(mapData, null, 2));
        
        if (!mapData || !mapData.objects) {
            throw new Error('Invalid map data: missing objects array');
        }

        const filePath = path.join(__dirname, 'public', 'Demos', 'map_data.json');
        console.log('Saving to file:', filePath);
        
        await fs.writeFile(
            filePath,
            JSON.stringify(mapData, null, 2)
        );
        
        // Verify the file was written
        const savedData = await fs.readFile(filePath, 'utf8');
        console.log('File written successfully. Content length:', savedData.length);
        
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