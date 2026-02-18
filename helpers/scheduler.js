const fs = require('fs');
const path = require('path');
const os = require('os');
const schedule = require('node-schedule');

const data_path = path.join(os.homedir(), '.noclawd');
const tasks_path = path.join(data_path, 'scheduled_tasks.json');

// In-memory store: { taskId: { ...taskData, job } }
let tasks = {};

function loadScheduledTasks() {
    try {
        if (fs.existsSync(tasks_path)) {
            const data = JSON.parse(fs.readFileSync(tasks_path, 'utf8'));
            tasks = data;
            console.log(`Loaded ${Object.keys(tasks).length} scheduled tasks.`);
        } else {
            console.log('Loaded 0 scheduled tasks.');
        }
    } catch (err) {
        console.error('Error loading scheduled tasks:', err);
    }
}

function saveScheduledTasks() {
    try {
        // Strip non-serializable job references before saving
        const toSave = {};
        for (const id in tasks) {
            const { job, ...rest } = tasks[id];
            toSave[id] = rest;
        }
        fs.writeFileSync(tasks_path, JSON.stringify(toSave, null, 2));
    } catch (err) {
        console.error('Error saving scheduled tasks:', err);
    }
}

/**
 * Add a new scheduled task.
 * @param {string} chatId - The user's chat ID
 * @param {string} instruction - Natural language instruction (e.g. "Fetch 3 random research papers")
 * @param {string} cron - CRON expression (e.g. "0 7 * * *" for 7am daily)
 * @param {string} label - Human-readable label (e.g. "Morning papers")
 * @param {object} client - WhatsApp client
 * @param {function} talkGeminiFn - The talkGemini function to execute the instruction
 * @returns {string} Confirmation message
 */
function addScheduledTask(chatId, instruction, cron, label, client, talkGeminiFn) {
    const id = Date.now().toString();

    const job = schedule.scheduleJob(cron, async () => {
        console.log(`[scheduler] Running task "${label}" for ${chatId}`);
        try {
            const result = await talkGeminiFn(instruction, chatId);
            if (result) {
                await client.sendMessage(chatId + '@c.us', `⚙️ [${label}]\n${result}`);
            }
        } catch (err) {
            console.error(`[scheduler] Task "${label}" failed:`, err.message);
            await client.sendMessage(chatId + '@c.us', `⚙️ [${label}] ⚠️ Task failed: ${err.message}`);
        }
    });

    if (!job) {
        return `Invalid CRON expression: "${cron}". Example: "0 7 * * *" for 7am daily.`;
    }

    tasks[id] = { id, chatId, instruction, cron, label };
    tasks[id].job = job; // in-memory only
    saveScheduledTasks();

    return `Scheduled task "${label}" created (ID: ${id}).\nRuns: ${cron}\nInstruction: ${instruction}`;
}

/**
 * List all scheduled tasks for a user.
 */
function listScheduledTasks(chatId) {
    const userTasks = Object.values(tasks).filter(t => t.chatId === chatId);
    if (userTasks.length === 0) return 'No scheduled tasks.';

    return userTasks.map((t, i) =>
        `${i + 1}. [${t.id}] *${t.label}*\n   CRON: ${t.cron}\n   Task: ${t.instruction}`
    ).join('\n\n');
}

/**
 * Cancel a scheduled task by ID.
 */
function cancelScheduledTask(chatId, id) {
    const task = tasks[id];
    if (!task) return `Task ID "${id}" not found.`;
    if (task.chatId !== chatId) return `Task ID "${id}" not found.`;

    if (task.job && typeof task.job.cancel === 'function') {
        task.job.cancel();
    }
    delete tasks[id];
    saveScheduledTasks();
    return `Task "${task.label}" (ID: ${id}) cancelled.`;
}

/**
 * Re-register all persisted tasks on bot startup.
 * Must be called after talkGemini is defined.
 */
function rescheduleAllTasks(client, talkGeminiFn) {
    for (const id in tasks) {
        const task = tasks[id];
        const job = schedule.scheduleJob(task.cron, async () => {
            console.log(`[scheduler] Running task "${task.label}" for ${task.chatId}`);
            try {
                const result = await talkGeminiFn(task.instruction, task.chatId);
                if (result) {
                    await client.sendMessage(task.chatId + '@c.us', `⚙️ [${task.label}]\n${result}`);
                }
            } catch (err) {
                console.error(`[scheduler] Task "${task.label}" failed:`, err.message);
                await client.sendMessage(task.chatId + '@c.us', `⚙️ [${task.label}] ⚠️ Task failed: ${err.message}`);
            }
        });
        tasks[id].job = job;
    }
    console.log(`Rescheduled ${Object.keys(tasks).length} tasks.`);
}

module.exports = {
    loadScheduledTasks,
    addScheduledTask,
    listScheduledTasks,
    cancelScheduledTask,
    rescheduleAllTasks,
};
