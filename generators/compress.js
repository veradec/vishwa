const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const data_path = path.join(os.homedir(), '.noclawd');
const temp_dir = path.join(data_path, 'temp_media');

async function compressImages(chatId, mediaBuffer) {
    try {
        const images = mediaBuffer[chatId];
        if (!images || images.length === 0) return null;

        const results = [];
        const totalOriginal = images.reduce((acc, img) => acc + fs.statSync(img).size, 0);

        for (const img of images) {
            const originalSize = fs.statSync(img).size;
            const timestamp = Date.now();
            const baseName = path.basename(img, path.extname(img));
            const outputPath = path.join(temp_dir, `compressed_${baseName}_${timestamp}.jpg`);
            
            await new Promise((resolve, reject) => {
                exec(`convert "${img}" -quality 50 -resize 50% "${outputPath}"`, (error) => {
                    if (error) {
                        console.error(`Error compressing ${img}:`, error);
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            const compressedSize = fs.statSync(outputPath).size;
            results.push({
                path: outputPath,
                originalSize,
                compressedSize
            });

            // Delete original
            try { fs.unlinkSync(img); } catch(e) {}
        }

        delete mediaBuffer[chatId];
        return results;

    } catch (e) {
        console.error("Error compressing images:", e);
        return null;
    }
}

module.exports = {
    compressImages
};
