const fs = require('fs');
const path = require('path');
const os = require('os');

const data_path = path.join(os.homedir(), '.noclawd');
const birthdays_path = path.join(data_path, 'birthdays.json');

let birthdays = [];

function loadBirthdays() {
    try {
        if (fs.existsSync(birthdays_path)) {
            const data = fs.readFileSync(birthdays_path, 'utf8');
            birthdays = JSON.parse(data);
            console.log(`Birthdays loaded: ${birthdays.length} records.`);
        }
    } catch (err) {
        console.error("Error loading birthdays:", err);
    }
}

function saveBirthdays() {
    try {
        fs.writeFileSync(birthdays_path, JSON.stringify(birthdays, null, 2));
        console.log("Birthdays saved.");
    } catch (err) {
        console.error("Error saving birthdays:", err);
    }
}

function storeBirthday({ name, date, recipientNumber }) {
    try {
        birthdays.push({ name, date, recipientNumber });
        saveBirthdays();
        console.log(`Birthday stored for ${name} on ${date}, will message ${recipientNumber}`);
        return `Stored birthday for ${name} on ${date}. I will send a wish to ${recipientNumber} at 00:00.`;
    } catch (err) {
        console.error("Error storing birthday:", err);
        return "Error storing birthday.";
    }
}

function checkBirthdays(client) {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDate = today.getDate();
    
    console.log(`Checking birthdays for ${currentDate}/${currentMonth}...`);
    
    birthdays.forEach(b => {
        let match = false;
        const bDate = new Date(b.date);
        
        if (!isNaN(bDate)) {
            if (bDate.getDate() === currentDate && (bDate.getMonth() + 1) === currentMonth) {
                match = true;
            }
        } else {
            const parts = b.date.split('/');
            if (parts.length === 2) {
                if (parseInt(parts[0]) === currentDate && parseInt(parts[1]) === currentMonth) {
                    match = true;
                }
            }
        }

        if (match) {
            console.log(`Sending birthday wish to ${b.name} at ${b.recipientNumber}`);
            client.sendMessage(b.recipientNumber + '@c.us', `🎂 Happy Birthday, ${b.name}! 🎉 Have a wonderful day!`);
        }
    });
}

module.exports = {
    loadBirthdays,
    saveBirthdays,
    storeBirthday,
    checkBirthdays
};
