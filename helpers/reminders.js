const fs = require('fs');
const path = require('path');
const os = require('os');
const schedule = require('node-schedule');

const data_path = path.join(os.homedir(), '.noclawd');
const reminders_path = path.join(data_path, 'reminders.json');

let reminders = [];

function loadReminders() {
    try {
        if (fs.existsSync(reminders_path)) {
            const data = fs.readFileSync(reminders_path, 'utf8');
            reminders = JSON.parse(data);
            console.log(`Loaded ${reminders.length} reminders.`);
        } else {
            console.log("Loaded 0 reminders.");
        }
    } catch (err) {
        console.error("Error loading reminders:", err);
    }
}

function saveReminders() {
    try {
        fs.writeFileSync(reminders_path, JSON.stringify(reminders, null, 2));
        console.log("Reminders saved.");
    } catch (err) {
        console.error("Error saving reminders:", err);
    }
}

async function scheduleReminder(chatId, task, time, client) {
    try {
        let job;
        let isRefurring = false;
        let scheduleTime;
        const reminderId = Date.now().toString();

        // Check if time is a CRON expression (simple check: includes spaces or stars)
        if (time.includes(' ') || time.includes('*')) {
             try {
                 // Try scheduling as CRON
                 job = schedule.scheduleJob(time, function() {
                     console.log(`Sending recurring reminder: ${task} to ${chatId}`);
                     client.sendMessage(chatId + '@c.us', `⏰ Reminder: ${task}`);
                 });
                 if (!job) throw new Error("Invalid CRON");
                 isRefurring = true;
                 scheduleTime = time;
             } catch (e) {
                 return "Invalid CRON expression or date format. Use ISO date or CRON (e.g. '0 9 * * *').";
             }
        } else {
            // Try scheduling as Date
            scheduleTime = new Date(time);
            if (isNaN(scheduleTime)) {
                return "Invalid date format. Please use ISO format like '2024-12-31T10:00:00' or CRON.";
            }
            
            job = schedule.scheduleJob(scheduleTime, function() {
                console.log(`Sending reminder: ${task} to ${chatId}`);
                client.sendMessage(chatId + '@c.us', `⏰ Reminder: ${task}`);
                
                // One-time reminder, so remove it after firing
                const index = reminders.findIndex(r => r.id === reminderId);
                if (index !== -1) {
                    reminders.splice(index, 1);
                    saveReminders();
                }
            });
        }

        if (!job) return "Failed to schedule reminder.";

        reminders.push({
            id: reminderId,
            chatId: chatId,
            task: task,
            time: time,
            isRecurring: isRefurring
        });
        
        saveReminders();
        return `Reminder set for ${isRefurring ? time : scheduleTime.toLocaleString()}. ID: ${reminderId}`;
    } catch (err) {
        console.error("Error scheduling reminder:", err);
        return "Error setting reminder.";
    }
}

function listReminders() {
    if (reminders.length === 0) {
        return "No active reminders.";
    }
    
    let list = "Active Reminders:\n";
    reminders.forEach(r => {
        const type = r.isRecurring ? "[recurring]" : "[one-time]";
        list += `ID: ${r.id} ${type} - ${r.task} at ${r.time}\n`;
    });
    return list;
}

function cancelReminder(id) {
    const index = reminders.findIndex(r => r.id === id);
    if (index === -1) {
        return `Reminder with ID ${id} not found.`;
    }
    
    const reminder = reminders[index];
    // job is an in-memory reference; may not exist after restart
    if (reminder.job && typeof reminder.job.cancel === 'function') {
        reminder.job.cancel();
    }
    
    reminders.splice(index, 1);
    saveReminders();
    
    return `Reminder "${reminder.task}" cancelled.`;
}

function rescheduleReminders(client) {
    reminders.forEach(r => {
        let job;
        if (r.isRecurring) {
            job = schedule.scheduleJob(r.time, function() {
                console.log(`Sending recurring reminder: ${r.task} to ${r.chatId}`);
                client.sendMessage(r.chatId + '@c.us', `⏰ Reminder: ${r.task}`);
            });
        } else {
            const reminderDate = new Date(r.time);
            if (reminderDate > new Date()) {
                job = schedule.scheduleJob(reminderDate, function() {
                    console.log(`Sending reminder: ${r.task} to ${r.chatId}`);
                    client.sendMessage(r.chatId + '@c.us', `⏰ Reminder: ${r.task}`);
                    
                    const index = reminders.findIndex(rem => rem.id === r.id);
                    if (index !== -1) {
                        reminders.splice(index, 1);
                        saveReminders();
                    }
                });
            }
        }
        // Store job reference in memory (not persisted) for cancellation
        r.job = job;
    });
}

module.exports = {
    loadReminders,
    saveReminders,
    scheduleReminder,
    listReminders,
    cancelReminder,
    rescheduleReminders
};
