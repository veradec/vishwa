const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const data_path = path.join(os.homedir(), '.noclawd');
const ppt_dir = path.join(data_path, 'ppts');
const temp_dir = path.join(data_path, 'temp_media');

async function compileLaTeX(texPath) {
    return new Promise((resolve, reject) => {
        const outputDir = path.dirname(texPath);
        const baseName = path.basename(texPath, '.tex');
        
        exec(`pdflatex -output-directory="${outputDir}" -interaction=nonstopmode "${texPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error("pdflatex error:", error);
                console.error("stdout:", stdout);
                console.error("stderr:", stderr);
                return reject(error);
            }
            
            const pdfPath = path.join(outputDir, `${baseName}.pdf`);
            
            if (fs.existsSync(pdfPath)) {
                // Cleanup auxiliary files
                ['.aux', '.log', '.nav', '.out', '.snm', '.toc', '.tex'].forEach(ext => {
                    const auxFile = path.join(outputDir, `${baseName}${ext}`);
                    if (fs.existsSync(auxFile)) {
                        try { fs.unlinkSync(auxFile); } catch(e) {}
                    }
                });
                
                resolve(pdfPath);
            } else {
                reject(new Error("PDF not generated"));
            }
        });
    });
}

function escapeLatex(str) {
    if (!str) return "";
    return String(str)
              .replace(/\\/g, '\\textbackslash{}')
              .replace(/[&%$#_{}]/g, '\\$&')
              .replace(/~/g, '\\textasciitilde{}')
              .replace(/\^/g, '\\textasciicircum{}');
}

async function createBeamerPresentation(title, slides, author = "Anonymous") {
    try {
        const timestamp = Date.now();
        const fileName = `${title.replace(/\s+/g, '_')}_${timestamp}.tex`;
        const filePath = path.join(ppt_dir, fileName);

        let latexContent = `
\\documentclass{beamer}
\\usetheme{Madrid}
\\usecolortheme{whale}
\\title{${escapeLatex(title)}}
\\author{${escapeLatex(author)}}
\\date{\\today}

\\begin{document}

\\frame{\\titlepage}

`;

        slides.forEach(slide => {
            latexContent += `\\begin{frame}{${escapeLatex(slide.title)}}\n`;
            latexContent += `\\begin{itemize}\n`;
            slide.content.forEach(item => {
                latexContent += `  \\item ${escapeLatex(item)}\n`;
            });
            latexContent += `\\end{itemize}\n`;
            latexContent += `\\end{frame}\n\n`;
        });

        latexContent += `\\end{document}`;

        fs.writeFileSync(filePath, latexContent);
        console.log(`Beamer file created: ${filePath}`);

        const pdfPath = await compileLaTeX(filePath);
        console.log(`PDF compiled: ${pdfPath}`);
        
        return pdfPath;
    } catch (e) {
        console.error("Error creating Beamer presentation:", e);
        return null;
    }
}

module.exports = {
    createBeamerPresentation,
    compileLaTeX
};
