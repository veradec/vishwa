const fs = require('fs');
const path = require('path');
const os = require('os');

const data_path = path.join(os.homedir(), '.noclawd');
const temp_dir = path.join(data_path, 'temp_media');

let mediaBuffer = {}; // chatId -> { images: [], timeout: timer }

if (!fs.existsSync(temp_dir)) {
    fs.mkdirSync(temp_dir, { recursive: true });
}

/**
 * Deletes all images associated with a chatId and clears the buffer.
 */
function clearBuffer(chatId) {
    if (mediaBuffer[chatId]) {
        console.log(`Cleaning up images for ${chatId}...`);
        if (mediaBuffer[chatId].timeout) {
            clearTimeout(mediaBuffer[chatId].timeout);
        }
        mediaBuffer[chatId].images.forEach(img => {
            try {
                if (fs.existsSync(img)) {
                    fs.unlinkSync(img);
                    console.log(`Deleted: ${img}`);
                }
            } catch (e) {
                console.error(`Error deleting image ${img}:`, e);
            }
        });
        delete mediaBuffer[chatId];
    }
}

/**
 * Adds an image path to the buffer and sets/resets a cleanup timer.
 */
function addImageToBuffer(chatId, filePath) {
    if (!mediaBuffer[chatId]) {
        mediaBuffer[chatId] = { images: [], timeout: null };
    }
    
    // Clear existing timeout
    if (mediaBuffer[chatId].timeout) {
        clearTimeout(mediaBuffer[chatId].timeout);
    }
    
    mediaBuffer[chatId].images.push(filePath);
    
    // Auto-delete after 5 minutes of inactivity if the user doesn't ask for a task
    mediaBuffer[chatId].timeout = setTimeout(() => {
        console.log(`User didn't request a task for images. Auto-cleaning buffer for ${chatId}.`);
        clearBuffer(chatId);
    }, 5 * 60 * 1000); 
}

function getImages(chatId) {
    return mediaBuffer[chatId] ? mediaBuffer[chatId].images : [];
}

module.exports = {
    addImageToBuffer,
    getImages,
    clearBuffer,
    temp_dir
};
