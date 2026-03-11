const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const app = express();
const port = 3000;

const PUBLIC_DIR = path.join(__dirname, 'public');
const DEMOS_DIR = path.join(PUBLIC_DIR, 'Demos');
const MODELS_DIR = path.join(PUBLIC_DIR, 'models');
const MODEL_DATA_PATH = path.join(DEMOS_DIR, 'model_data.json');
const MODEL_THUMBNAILS_DIR = path.join(PUBLIC_DIR, 'img', 'model-thumbnails');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // Allow larger GLB uploads for imported models.
    }
});

// Helper function to set GLB MIME type
function setGLBHeaders(res, path) {
    if (path.endsWith('.glb')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
    }
}

// Parse JSON bodies
app.use(express.json());

function sanitizeUploadFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        return '';
    }

    const normalized = path.basename(filename).trim();
    return normalized.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return false;

    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseJsonField(value, fallback) {
    if (typeof value !== 'string' || value.trim() === '') {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        throw new Error(`Invalid JSON provided: ${error.message}`);
    }
}

function normalizeVector3(value, fallback) {
    const source = value && typeof value === 'object' ? value : {};

    return {
        x: Number.isFinite(Number(source.x)) ? Number(source.x) : fallback.x,
        y: Number.isFinite(Number(source.y)) ? Number(source.y) : fallback.y,
        z: Number.isFinite(Number(source.z)) ? Number(source.z) : fallback.z
    };
}

async function ensureImportDirectories() {
    await fs.mkdir(MODELS_DIR, { recursive: true });
    await fs.mkdir(MODEL_THUMBNAILS_DIR, { recursive: true });
}

async function readModelDataFile() {
    const raw = await fs.readFile(MODEL_DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    if (!parsed || !Array.isArray(parsed.models)) {
        throw new Error('Invalid model_data.json structure: missing models array');
    }

    return parsed;
}

async function writeModelDataFile(modelData) {
    const tempPath = `${MODEL_DATA_PATH}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(modelData, null, 2));
    await fs.rename(tempPath, MODEL_DATA_PATH);
}

function buildModelMetadata({
    existingEntry = {},
    modelName,
    displayName,
    category,
    description,
    type,
    subType,
    thumbnailPath,
    defaultTransform,
    defaultAttributes,
    builtInActions
}) {
    const nextEntry = {
        ...existingEntry,
        name: modelName,
        display_name: typeof displayName === 'string' && displayName.trim()
            ? displayName.trim()
            : stripExtension(modelName),
        description: typeof description === 'string' ? description.trim() : '',
        toolbox_category: typeof category === 'string' && category.trim()
            ? category.trim()
            : (existingEntry.toolbox_category || 'Other'),
        default_transform: defaultTransform,
        default_attributes: defaultAttributes,
        built_in_actions: builtInActions
    };

    if (thumbnailPath) {
        nextEntry.thumbnail = thumbnailPath;
    } else if (!nextEntry.thumbnail) {
        delete nextEntry.thumbnail;
    }

    if (typeof type === 'string' && type.trim()) {
        nextEntry.type = type.trim();
    } else if (!nextEntry.type) {
        nextEntry.type = 'object';
    }

    if (typeof subType === 'string' && subType.trim()) {
        nextEntry.sub_type = subType.trim();
    } else if (!nextEntry.sub_type) {
        nextEntry.sub_type = 'decoration';
    }

    return nextEntry;
}

function stripExtension(filename) {
    return filename.replace(/\.[^.]+$/, '');
}

async function fileExists(targetPath) {
    return fs.access(targetPath).then(() => true).catch(() => false);
}

async function maybeDeleteFile(targetPath) {
    if (!targetPath) return;
    if (!(await fileExists(targetPath))) return;
    await fs.unlink(targetPath);
}

async function maybeDeleteUnusedThumbnail(thumbnailPath, modelData, preservedModelName = null) {
    if (
        !thumbnailPath ||
        !thumbnailPath.startsWith('/img/model-thumbnails/')
    ) {
        return;
    }

    const isStillReferenced = modelData.models.some(model =>
        model.name !== preservedModelName && model.thumbnail === thumbnailPath
    );

    if (isStillReferenced) {
        return;
    }

    const thumbnailName = sanitizeUploadFilename(path.basename(thumbnailPath));
    if (!thumbnailName) {
        return;
    }

    await maybeDeleteFile(path.join(MODEL_THUMBNAILS_DIR, thumbnailName));
}

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
        console.log('Received request for model data');
        console.log('Reading model data from:', MODEL_DATA_PATH);
        
        const modelData = await fs.readFile(MODEL_DATA_PATH, 'utf8');
        console.log('Model data loaded successfully, size:', modelData.length, 'bytes');
        
        // Parse and log the structure to confirm it's valid
        try {
            const parsedData = JSON.parse(modelData);
            console.log('Model data parsed successfully. Contains', 
                parsedData.models ? parsedData.models.length : 0, 'models');
                
            // Log a few model names for debugging
            if (parsedData.models && parsedData.models.length > 0) {
                console.log('Sample model names:',
                    parsedData.models.slice(0, 3).map(m => m.name).join(', '), '...');
            }
        } catch (parseError) {
            console.error('Warning: Model data is not valid JSON:', parseError);
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.send(modelData);
    } catch (error) {
        console.error('Error reading model data:', error);
        res.status(500).json({ error: 'Failed to read model data' });
    }
});

app.post(
    '/import-model',
    upload.fields([
        { name: 'modelFile', maxCount: 1 },
        { name: 'thumbnailFile', maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            await ensureImportDirectories();

            const modelFile = req.files?.modelFile?.[0];
            const thumbnailFile = req.files?.thumbnailFile?.[0];

            if (!modelFile) {
                return res.status(400).json({ error: 'A model file is required.' });
            }

            const replaceExisting = parseBoolean(req.body.replaceExisting);
            const sanitizedModelName = sanitizeUploadFilename(modelFile.originalname);
            const modelExtension = path.extname(sanitizedModelName).toLowerCase();

            if (!['.glb', '.gltf'].includes(modelExtension)) {
                return res.status(400).json({ error: 'Model file must be a .glb or .gltf file.' });
            }

            if (!sanitizedModelName) {
                return res.status(400).json({ error: 'The uploaded model file name is invalid.' });
            }

            let sanitizedThumbnailName = '';
            let thumbnailPath = req.body.thumbnailPath || '';

            if (thumbnailFile) {
                sanitizedThumbnailName = sanitizeUploadFilename(thumbnailFile.originalname);
                const thumbnailExtension = path.extname(sanitizedThumbnailName).toLowerCase();

                if (!['.png', '.jpg', '.jpeg', '.webp'].includes(thumbnailExtension)) {
                    return res.status(400).json({
                        error: 'Thumbnail file must be a .png, .jpg, .jpeg, or .webp image.'
                    });
                }

                if (!sanitizedThumbnailName) {
                    return res.status(400).json({ error: 'The uploaded thumbnail file name is invalid.' });
                }

                thumbnailPath = `/img/model-thumbnails/${sanitizedThumbnailName}`;
            }

            const modelOutputPath = path.join(MODELS_DIR, sanitizedModelName);
            const thumbnailOutputPath = sanitizedThumbnailName
                ? path.join(MODEL_THUMBNAILS_DIR, sanitizedThumbnailName)
                : null;

            const existingModelFile = await fileExists(modelOutputPath);
            if (existingModelFile && !replaceExisting) {
                return res.status(409).json({
                    error: `Model "${sanitizedModelName}" already exists. Enable replace to overwrite it.`
                });
            }

            if (thumbnailOutputPath) {
                const existingThumbnailFile = await fileExists(thumbnailOutputPath);
                if (existingThumbnailFile && !replaceExisting) {
                    return res.status(409).json({
                        error: `Thumbnail "${sanitizedThumbnailName}" already exists. Enable replace to overwrite it.`
                    });
                }
            }

            const modelData = await readModelDataFile();
            const existingEntryIndex = modelData.models.findIndex(model => model.name === sanitizedModelName);

            if (existingEntryIndex !== -1 && !replaceExisting) {
                return res.status(409).json({
                    error: `A model_data.json entry for "${sanitizedModelName}" already exists. Enable replace to overwrite it.`
                });
            }

            const defaultTransform = {
                position: normalizeVector3(parseJsonField(req.body.defaultPosition, null), { x: 0, y: 0, z: 0 }),
                rotation: normalizeVector3(parseJsonField(req.body.defaultRotation, null), { x: 0, y: 0, z: 0 }),
                scale: normalizeVector3(parseJsonField(req.body.defaultScale, null), { x: 1, y: 1, z: 1 })
            };

            const defaultAttributes = parseJsonField(req.body.defaultAttributes, {});
            if (!defaultAttributes || typeof defaultAttributes !== 'object' || Array.isArray(defaultAttributes)) {
                return res.status(400).json({ error: 'Default settings must be a JSON object.' });
            }

            const builtInActions = parseJsonField(req.body.builtInActions, []);
            if (!Array.isArray(builtInActions)) {
                return res.status(400).json({ error: 'Built-in actions must be a JSON array.' });
            }

            const displayName = typeof req.body.displayName === 'string' && req.body.displayName.trim()
                ? req.body.displayName.trim()
                : sanitizedModelName.replace(modelExtension, '');

            const category = typeof req.body.category === 'string' && req.body.category.trim()
                ? req.body.category.trim()
                : 'Other';

            const description = typeof req.body.description === 'string'
                ? req.body.description.trim()
                : '';

            const type = typeof req.body.type === 'string' ? req.body.type.trim() : '';
            const subType = typeof req.body.subType === 'string' ? req.body.subType.trim() : '';

            await fs.writeFile(modelOutputPath, modelFile.buffer);

            if (thumbnailOutputPath) {
                await fs.writeFile(thumbnailOutputPath, thumbnailFile.buffer);
            }

            const existingEntry = existingEntryIndex !== -1 ? modelData.models[existingEntryIndex] : {};
            const nextEntry = buildModelMetadata({
                existingEntry,
                modelName: sanitizedModelName,
                displayName,
                category,
                description,
                type,
                subType,
                thumbnailPath,
                defaultTransform,
                defaultAttributes,
                builtInActions
            });

            if (existingEntryIndex !== -1) {
                modelData.models[existingEntryIndex] = nextEntry;
            } else {
                modelData.models.push(nextEntry);
            }

            modelData.models.sort((a, b) => a.name.localeCompare(b.name));
            await writeModelDataFile(modelData);

            res.json({
                success: true,
                message: `Imported "${sanitizedModelName}" successfully.`,
                model: nextEntry
            });
        } catch (error) {
            console.error('Error importing model:', error);
            res.status(500).json({
                error: 'Failed to import model',
                details: error.message
            });
        }
    }
);

app.put(
    '/model-data/:modelName',
    upload.fields([
        { name: 'modelFile', maxCount: 1 },
        { name: 'thumbnailFile', maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            await ensureImportDirectories();

            const modelName = sanitizeUploadFilename(req.params.modelName);
            if (!modelName) {
                return res.status(400).json({ error: 'Invalid model name.' });
            }

            const modelData = await readModelDataFile();
            const existingEntryIndex = modelData.models.findIndex(model => model.name === modelName);
            if (existingEntryIndex === -1) {
                return res.status(404).json({ error: `Model "${modelName}" was not found.` });
            }

            const existingEntry = modelData.models[existingEntryIndex];
            const modelFile = req.files?.modelFile?.[0];
            const thumbnailFile = req.files?.thumbnailFile?.[0];
            let nextModelName = modelName;
            let nextThumbnailPath = existingEntry.thumbnail || '';

            if (modelFile) {
                const uploadedModelName = sanitizeUploadFilename(modelFile.originalname);
                if (!uploadedModelName) {
                    return res.status(400).json({ error: 'The uploaded model file name is invalid.' });
                }

                if (uploadedModelName !== modelName) {
                    return res.status(400).json({
                        error: `Replacement model file must keep the existing name "${modelName}".`
                    });
                }

                const extension = path.extname(uploadedModelName).toLowerCase();
                if (!['.glb', '.gltf'].includes(extension)) {
                    return res.status(400).json({ error: 'Model file must be a .glb or .gltf file.' });
                }

                await fs.writeFile(path.join(MODELS_DIR, uploadedModelName), modelFile.buffer);
                nextModelName = uploadedModelName;
            }

            if (thumbnailFile) {
                const uploadedThumbnailName = sanitizeUploadFilename(thumbnailFile.originalname);
                const thumbnailExtension = path.extname(uploadedThumbnailName).toLowerCase();

                if (!['.png', '.jpg', '.jpeg', '.webp'].includes(thumbnailExtension)) {
                    return res.status(400).json({
                        error: 'Thumbnail file must be a .png, .jpg, .jpeg, or .webp image.'
                    });
                }

                nextThumbnailPath = `/img/model-thumbnails/${uploadedThumbnailName}`;
                await fs.writeFile(path.join(MODEL_THUMBNAILS_DIR, uploadedThumbnailName), thumbnailFile.buffer);
            }

            const defaultTransform = {
                position: normalizeVector3(parseJsonField(req.body.defaultPosition, existingEntry.default_transform?.position), { x: 0, y: 0, z: 0 }),
                rotation: normalizeVector3(parseJsonField(req.body.defaultRotation, existingEntry.default_transform?.rotation), { x: 0, y: 0, z: 0 }),
                scale: normalizeVector3(parseJsonField(req.body.defaultScale, existingEntry.default_transform?.scale), { x: 1, y: 1, z: 1 })
            };

            const defaultAttributes = parseJsonField(
                req.body.defaultAttributes,
                existingEntry.default_attributes && typeof existingEntry.default_attributes === 'object'
                    ? existingEntry.default_attributes
                    : {}
            );
            if (!defaultAttributes || typeof defaultAttributes !== 'object' || Array.isArray(defaultAttributes)) {
                return res.status(400).json({ error: 'Default settings must be a JSON object.' });
            }

            const builtInActions = parseJsonField(
                req.body.builtInActions,
                Array.isArray(existingEntry.built_in_actions) ? existingEntry.built_in_actions : []
            );
            if (!Array.isArray(builtInActions)) {
                return res.status(400).json({ error: 'Built-in actions must be a JSON array.' });
            }

            const nextEntry = buildModelMetadata({
                existingEntry,
                modelName: nextModelName,
                displayName: req.body.displayName ?? existingEntry.display_name,
                category: req.body.category ?? existingEntry.toolbox_category,
                description: req.body.description ?? existingEntry.description,
                type: req.body.type ?? existingEntry.type,
                subType: req.body.subType ?? existingEntry.sub_type,
                thumbnailPath: nextThumbnailPath,
                defaultTransform,
                defaultAttributes,
                builtInActions
            });

            modelData.models[existingEntryIndex] = nextEntry;
            modelData.models.sort((a, b) => a.name.localeCompare(b.name));
            await writeModelDataFile(modelData);

            if (thumbnailFile && existingEntry.thumbnail && existingEntry.thumbnail !== nextThumbnailPath) {
                await maybeDeleteUnusedThumbnail(existingEntry.thumbnail, modelData, nextEntry.name);
            }

            res.json({
                success: true,
                message: `Updated "${nextEntry.name}" successfully.`,
                model: nextEntry
            });
        } catch (error) {
            console.error('Error updating model metadata:', error);
            res.status(500).json({
                error: 'Failed to update model metadata',
                details: error.message
            });
        }
    }
);

app.delete('/model-data/:modelName', async (req, res) => {
    try {
        const modelName = sanitizeUploadFilename(req.params.modelName);
        if (!modelName) {
            return res.status(400).json({ error: 'Invalid model name.' });
        }

        const modelData = await readModelDataFile();
        const existingEntryIndex = modelData.models.findIndex(model => model.name === modelName);
        if (existingEntryIndex === -1) {
            return res.status(404).json({ error: `Model "${modelName}" was not found.` });
        }

        const [removedEntry] = modelData.models.splice(existingEntryIndex, 1);
        await writeModelDataFile(modelData);

        await maybeDeleteFile(path.join(MODELS_DIR, modelName));
        await maybeDeleteUnusedThumbnail(removedEntry.thumbnail, modelData);

        res.json({
            success: true,
            message: `Deleted "${modelName}" successfully.`
        });
    } catch (error) {
        console.error('Error deleting model metadata:', error);
        res.status(500).json({
            error: 'Failed to delete model metadata',
            details: error.message
        });
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
        const files = await fs.readdir(MODELS_DIR);
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