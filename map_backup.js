const fs = require('fs').promises;
const path = require('path');

const MAP_DIR = path.join(__dirname, 'public', 'Demos');
const MAP_FILE = 'map_data.json';
const BACKUP_DIR = path.join(MAP_DIR, 'backups');

async function createBackup() {
    try {
        // Create backup directory if it doesn't exist
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        // Read current map data
        const mapData = await fs.readFile(path.join(MAP_DIR, MAP_FILE), 'utf8');
        
        // Create backup filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = `map_data_${timestamp}.json`;
        
        // Save backup
        await fs.writeFile(path.join(BACKUP_DIR, backupFile), mapData);
        console.log(`Backup created: ${backupFile}`);
    } catch (error) {
        console.error('Error creating backup:', error);
    }
}

async function listBackups() {
    try {
        const files = await fs.readdir(BACKUP_DIR);
        const backups = files.filter(f => f.startsWith('map_data_') && f.endsWith('.json'));
        backups.forEach(file => {
            console.log(file);
        });
    } catch (error) {
        console.error('Error listing backups:', error);
    }
}

async function restoreBackup(backupFile) {
    try {
        // Read backup file
        const backupData = await fs.readFile(path.join(BACKUP_DIR, backupFile), 'utf8');
        
        // Create a backup of current state before restoring
        await createBackup();
        
        // Restore the backup
        await fs.writeFile(path.join(MAP_DIR, MAP_FILE), backupData);
        console.log(`Restored from backup: ${backupFile}`);
    } catch (error) {
        console.error('Error restoring backup:', error);
    }
}

// Command line interface
const command = process.argv[2];
const backupFile = process.argv[3];

switch (command) {
    case 'create':
        createBackup();
        break;
    case 'list':
        listBackups();
        break;
    case 'restore':
        if (!backupFile) {
            console.error('Please specify a backup file to restore');
            break;
        }
        restoreBackup(backupFile);
        break;
    default:
        console.log(`
Usage:
  node map_backup.js create         Create a new backup
  node map_backup.js list          List all backups
  node map_backup.js restore FILE  Restore from specified backup
        `);
} 