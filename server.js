const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Helper function to set GLB MIME type
function setGLBHeaders(res, path) {
    if (path.endsWith('.glb')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
    }
}

// Serve static files from the public directory
app.use(express.static('public', {
    setHeaders: setGLBHeaders
}));

// Serve models from the public/models directory directly
app.use('/models', express.static(path.join(__dirname, 'public', 'models'), {
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