const express = require('express');
const path = require('path');
const app = express();

// Helper function to set GLB MIME type
const setGLBHeaders = (res, filePath) => {
    if (filePath.endsWith('.glb')) {
        res.set('Content-Type', 'model/gltf-binary');
    }
};

// Serve static files from the dist directory with proper MIME types
app.use(express.static('dist', {
    setHeaders: setGLBHeaders
}));

// Serve static files from the public directory with proper MIME types
app.use('/', express.static('public', {
    setHeaders: setGLBHeaders
}));

// For any other route, serve the index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
}); 