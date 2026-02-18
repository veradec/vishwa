const fs = require('fs');
const path = require('path');
const os = require('os');

const data_path = path.join(os.homedir(), '.noclawd');
const memory_path = path.join(data_path, 'memory.md');

async function fetchMemories() {
    try {
        if (!fs.existsSync(memory_path)) {
            return "No memories stored yet.";
        }
        const data = fs.readFileSync(memory_path, 'utf8');
        return data || "No memories stored yet.";
    } catch (err) {
        console.error("Error fetching memories:", err);
        return "Error reading memory file.";
    }
}

async function storeMemory({ memory }) {
    try {
        const d = new Date();
        const timestamp = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
        const entry = `\\n- [${timestamp}] ${memory}`;
        fs.appendFileSync(memory_path, entry);
        console.log("Memory stored:", memory);
        return "Memory stored successfully.";
    } catch (err) {
        console.error("Error storing memory:", err);
        return "Error writing to memory file.";
    }
}

module.exports = {
    fetchMemories,
    storeMemory
};
