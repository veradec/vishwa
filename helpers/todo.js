const fs = require('fs');
const path = require('path');
const os = require('os');
const schedule = require('node-schedule');

const data_path = path.join(os.homedir(), '.noclawd');
const todos_path = path.join(data_path, 'todos.json');

let todos = {};

function loadTodos() {
    try {
        if (fs.existsSync(todos_path)) {
            const data = fs.readFileSync(todos_path, 'utf8');
            todos = JSON.parse(data);
            
            // Migration: Convert string items to objects if necessary
            let migrated = false;
            for (const chatId in todos) {
                if (todos[chatId].items && todos[chatId].items.length > 0) {
                    if (typeof todos[chatId].items[0] === 'string') {
                        todos[chatId].items = todos[chatId].items.map(item => ({
                            id: Date.now() + Math.random().toString(36).substr(2, 5),
                            text: item,
                            completed: false
                        }));
                        migrated = true;
                    }
                }
            }
            if (migrated) saveTodos();

            console.log(`Loaded todos for ${Object.keys(todos).length} users.`);
        } else {
            console.log("Loaded 0 todos.");
        }
    } catch (err) {
        console.error("Error loading todos:", err);
    }
}

function saveTodos() {
    try {
        const dataToSave = {};
        for (const chatId in todos) {
            dataToSave[chatId] = {
                items: todos[chatId].items,
                frequency: todos[chatId].frequency
            };
        }
        fs.writeFileSync(todos_path, JSON.stringify(dataToSave, null, 2));
    } catch (err) {
        console.error("Error saving todos:", err);
    }
}

function addTodo(chatId, item) {
    if (!todos[chatId]) {
        todos[chatId] = { items: [], frequency: 0, jobs: [] };
    }
    const newItem = {
        id: Date.now().toString(),
        text: item,
        completed: false
    };
    todos[chatId].items.push(newItem);
    saveTodos();
    return `Added "${item}" to your todo list.`;
}

function removeTodo(chatId, index) {
    // Index is 1-based from user input
    const idx = index - 1;
    if (!todos[chatId] || !todos[chatId].items[idx]) {
        return "Invalid todo number.";
    }
    const item = todos[chatId].items.splice(idx, 1)[0];
    saveTodos();
    return `Removed "${item.text}" from your todo list.`;
}

function toggleTodo(chatId, index) {
    const idx = index - 1;
    if (!todos[chatId] || !todos[chatId].items[idx]) {
        return "Invalid todo number.";
    }
    const item = todos[chatId].items[idx];
    item.completed = !item.completed;
    saveTodos();
    return marked = item.completed ? "Marked as done" : "Marked as pending";
}

function clearCompleted(chatId) {
    if (!todos[chatId]) return "No todos to clear.";
    const originalLength = todos[chatId].items.length;
    todos[chatId].items = todos[chatId].items.filter(item => !item.completed);
    const clearedCount = originalLength - todos[chatId].items.length;
    saveTodos();
    return `Cleared ${clearedCount} completed items.`;
}

function getTodos(chatId) {
    if (!todos[chatId] || todos[chatId].items.length === 0) {
        return "Your todo list is empty.";
    }
    return todos[chatId].items.map((item, i) => {
        const checkbox = item.completed ? "[x]" : "[ ]";
        return `${i + 1}. ${checkbox} ${item.text}`;
    }).join('\n');
}

function clearjobs(chatId) { 
    if (todos[chatId] && todos[chatId].jobs) {
        todos[chatId].jobs.forEach(job => job.cancel());
        todos[chatId].jobs = [];
    }
}

function setReminderFrequency(chatId, timesPerDay, client) {
    if (!todos[chatId]) {
        todos[chatId] = { items: [], frequency: 0, jobs: [] };
    }
    todos[chatId].frequency = timesPerDay;
    
    // Clear existing jobs
    clearjobs(chatId);

    if (timesPerDay > 0) {
        const times = calculateTimes(timesPerDay);
        todos[chatId].jobs = times.map(timeStr => {
             const [hour, minute] = timeStr.split(':');
             const rule = new schedule.RecurrenceRule();
             rule.hour = parseInt(hour, 10);
             rule.minute = parseInt(minute, 10);
            
             return schedule.scheduleJob(rule, function() {
                 const currentTodos = getTodos(chatId);
                 if (currentTodos !== "Your todo list is empty.") {
                     client.sendMessage(chatId + '@c.us', `📝 User Todo Reminder:\n${currentTodos}`);
                 }
             });
        });
        saveTodos(); // Note: jobs are not serializable, but frequency is.
        // We need to re-schedule on load.
        return `Reminder frequency set to ${timesPerDay} times a day.`;
    } else {
        saveTodos();
        return "Reminders disabled.";
    }
}

function calculateTimes(n) {
    // Simple logic to distribute times between 8:00 and 21:00
    if (n === 1) return ['09:00'];
    if (n === 2) return ['09:00', '18:00'];
    if (n === 3) return ['09:00', '14:00', '19:00'];
    
    const times = [];
    const startHour = 8;
    const endHour = 21;
    const step = (endHour - startHour) / (n - 1);
    
    for (let i = 0; i < n; i++) {
        const hour = Math.floor(startHour + (i * step));
        const minute = Math.floor((startHour + (i * step) - hour) * 60);
        times.push(`${hour}:${minute < 10 ? '0' + minute : minute}`);
    }
    return times;
}

function scheduleTodoReminders(client) {
    // Called on startup
    for (const chatId in todos) {
        const data = todos[chatId];
        if (data.frequency > 0) {
            setReminderFrequency(chatId, data.frequency, client);
        }
    }
}

module.exports = {
    loadTodos,
    saveTodos,
    addTodo,
    removeTodo,
    getTodos,
    setReminderFrequency,
    scheduleTodoReminders,
    toggleTodo,
    clearCompleted
};
