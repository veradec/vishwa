const fs = require('fs');
const path = require('path');
const os = require('os');
const { compileLaTeX } = require('./beamer');

const data_path = path.join(os.homedir(), '.noclawd');
const temp_dir = path.join(data_path, 'temp_media');

async function imagesToPDF(chatId, mediaBuffer) {
    try {
        const images = mediaBuffer[chatId];
        if (!images || images.length === 0) return null;

        const timestamp = Date.now();
        const fileName = `Images_${timestamp}.tex`;
        const filePath = path.join(temp_dir, fileName);

        let simplifiedLatex = `
\\documentclass{article}
\\usepackage[margin=0in]{geometry}
\\usepackage{graphicx}
\\begin{document}
\\centering
`;
        images.forEach(img => {
            simplifiedLatex += `
\\newpage
\\noindent\\includegraphics[width=\\textwidth,height=\\textheight,keepaspectratio]{${img}}
`;
        });
        simplifiedLatex += `\\end{document}`;
        fs.writeFileSync(filePath, simplifiedLatex);

        const pdfPath = await compileLaTeX(filePath);
        
        // Cleanup images
        images.forEach(img => {
            try { fs.unlinkSync(img); } catch(e) {}
        });
        delete mediaBuffer[chatId];
        
        return pdfPath;

    } catch (e) {
        console.error("Error creating Image PDF:", e);
        return null;
    }
}

module.exports = {
    imagesToPDF
};
