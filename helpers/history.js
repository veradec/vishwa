const fs = require('fs');
const path = require('path');
const os = require('os');

const data_path = path.join(os.homedir(), '.noclawd');
const history_path = path.join(data_path, 'chat_history.json');

let chatHistory = {};

function loadHistory() {
    try {
        if (fs.existsSync(history_path)) {
            const data = fs.readFileSync(history_path, 'utf8');
            chatHistory = JSON.parse(data);
            console.log("Chat history loaded.");
        }
    } catch (err) {
        console.error("Error loading history:", err);
    }
}

function saveHistory() {
    try {
        fs.writeFileSync(history_path, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
        console.error("Error saving history:", err);
    }
}

function getChatHistory() {
    return chatHistory;
}

function setChatHistory(newHistory) {
    chatHistory = newHistory;
}

module.exports = {
    loadHistory,
    saveHistory,
    getChatHistory,
    setChatHistory
};
