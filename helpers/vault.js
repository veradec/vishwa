const fs = require('fs');
const path = require('path');
const os = require('os');

const data_path = path.join(os.homedir(), '.noclawd');
const vault_dir = path.join(data_path, 'vault');
const index_path = path.join(vault_dir, 'index.json');

function initVault() {
    if (!fs.existsSync(vault_dir)) {
        fs.mkdirSync(vault_dir, { recursive: true });
    }
    if (!fs.existsSync(index_path)) {
        fs.writeFileSync(index_path, JSON.stringify({}, null, 2));
    }
}

function getVaultIndex() {
    initVault();
    try {
        const data = fs.readFileSync(index_path, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error reading vault index:", e);
        return {};
    }
}

function saveToVaultIndex(index) {
    fs.writeFileSync(index_path, JSON.stringify(index, null, 2));
}

/**
 * Saves an image to the vault with a specific name.
 * @param {string} sourcePath - The current path of the image file.
 * @param {string} name - The user-provided name for the image.
 * @returns {string} - Success message or error.
 */
function saveImageToVault(sourcePath, name) {
    initVault();
    if (!fs.existsSync(sourcePath)) {
        return "Error: Source image not found.";
    }

    try {
        const index = getVaultIndex();
        
        // Sanitize name for filename
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const ext = path.extname(sourcePath) || '.jpg';
        const fileName = `${safeName}_${Date.now()}${ext}`;
        const destPath = path.join(vault_dir, fileName);

        fs.copyFileSync(sourcePath, destPath);

        // Store in index: normalized name -> filename
        index[name.toLowerCase()] = fileName;
        saveToVaultIndex(index);

        return `Saved image as "${name}".`;
    } catch (e) {
        console.error("Error saving to vault:", e);
        return "Failed to save image to vault.";
    }
}

/**
 * Finds an image in the vault by name.
 * @param {string} name 
 * @returns {string|null} - Absolute path to the image or null.
 */
function findImageInVault(name) {
    initVault();
    const index = getVaultIndex();
    const fileName = index[name.toLowerCase()];

    if (!fileName) return null;

    const filePath = path.join(vault_dir, fileName);
    if (fs.existsSync(filePath)) {
        return filePath;
    } else {
        // Cleanup index if file is missing?
        return null;
    }
}

module.exports = {
    saveImageToVault,
    findImageInVault,
    initVault
};
