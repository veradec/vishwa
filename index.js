const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const schedule = require('node-schedule');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode =  require('qrcode-terminal');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Generators
const { createBeamerPresentation } = require('./generators/beamer');
const { imagesToPDF } = require('./generators/pdf');
const { compressImages } = require('./generators/compress');

// Helpers
const { fetchMemories, storeMemory } = require('./helpers/memory');
const { loadHistory, saveHistory, getChatHistory, setChatHistory } = require('./helpers/history');
const { loadBirthdays, storeBirthday, checkBirthdays } = require('./helpers/birthdays'); 
const { loadReminders, saveReminders, scheduleReminder, listReminders, cancelReminder, rescheduleReminders } = require('./helpers/reminders');
const { addImageToBuffer, getImages, clearBuffer, temp_dir } = require('./helpers/images');
const { saveImageToVault, findImageInVault } = require('./helpers/vault');
const { loadTodos, scheduleTodoReminders, addTodo, getTodos, setReminderFrequency, toggleTodo, clearCompleted } = require('./helpers/todo');
const { fetchArxiv } = require('./helpers/arxiv');
const { webSearch } = require('./helpers/websearch');
const { loadScheduledTasks, addScheduledTask, listScheduledTasks, cancelScheduledTask, rescheduleAllTasks } = require('./helpers/scheduler');

const apiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3].filter(Boolean);
const models = ["gemini-3-flash-preview", "gemini-2.5-flash"];

const data_path = path.join(os.homedir(), '.noclawd');
const ppt_dir = path.join(data_path, 'ppts');

if (!fs.existsSync(ppt_dir)){
    fs.mkdirSync(ppt_dir, { recursive: true });
}

const tools = [
  {
    functionDeclarations: [
      {
        name: "fetchMemories",
        description: "Retrieve all stored memories about the user and context.",
      },
      {
        name: "storeMemory",
        description: "Store a new memory or important fact for future reference.",
        parameters: {
          type: "OBJECT",
          properties: {
            memory: {
              type: "STRING",
              description: "The content of the memory to store.",
            },
          },
          required: ["memory"],
        },
      },
      {
        name: "setReminder",
        description: "Schedule a reminder.",
        parameters: {
            type: "OBJECT",
            properties: {
                task: { type: "STRING", description: "The content of the task." },
                time: { type: "STRING", description: "ISO 8601 date string or CRON expression (e.g., '0 9 * * *' for daily at 9am)." }
            },
            required: ["task", "time"],
        },
      },
      {
          name: "listReminders",
          description: "List all currently active reminders.",
      },
      {
          name: "cancelReminder",
          description: "Cancel a reminder by its ID.",
          parameters: {
              type: "OBJECT",
              properties: {
                  id: { type: "STRING", description: "The ID of the reminder to cancel." }
              },
              required: ["id"]
          }
      },
      {
        name: "generateBeamer",
        description: "Generate a LaTeX Beamer presentation (PDF).",
        parameters: {
            type: "OBJECT",
            properties: {
                title: { type: "STRING" },
                author: { type: "STRING" },
                slides: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            title: { type: "STRING" },
                            content: { type: "ARRAY", items: { type: "STRING" } }
                        }
                    }
                }
            },
            required: ["title", "slides"]
        }
      },
      {
        name: "storeBirthday",
        description: "Store a birthday and schedule a greeting.",
        parameters: {
            type: "OBJECT",
            properties: {
                name: { type: "STRING" },
                date: { type: "STRING" },
                recipientNumber: { type: "STRING" }
            },
            required: ["name", "date", "recipientNumber"]
        }
      },
      {
        name: "convertToPDF",
        description: "Convert the buffered images into a single PDF file.",
      },
      {
        name: "compressImages",
        description: "Compress the buffered images.",
      },
      {
        name: "saveImage",
        description: "Save the last sent image to a secure vault with a specific name/caption.",
        parameters: {
            type: "OBJECT",
            properties: {
                name: { type: "STRING", description: "The name or caption to save the image under (e.g., 'college id')." }
            },
            required: ["name"]
        }
      },
      {
        name: "retrieveImage",
        description: "Retrieve an image from the vault by its name/caption.",
        parameters: {
            type: "OBJECT",
            properties: {
                name: { type: "STRING", description: "The name or caption of the image to retrieve." }
            },
            required: ["name"]
        }
      },
      {
        name: "addTodo",
        description: "Add an item to the user's todo list.",
        parameters: {
            type: "OBJECT",
            properties: {
                item: { type: "STRING", description: "The todo item to add." }
            },
            required: ["item"]
        }
      },
      {
        name: "listTodos",
        description: "List all items in the user's todo list.",
      },
      {
        name: "setTodoFrequency",
        description: "Set how many times a day to remind the user of their todo list.",
        parameters: {
            type: "OBJECT",
            properties: {
                frequency: { type: "NUMBER", description: "Number of times per day (e.g., 1, 2, 3)." }
            },
            required: ["frequency"]
        }
      },
      {
        name: "toggleTodo",
        description: "Mark a todo item as done or pending by its number.",
        parameters: {
            type: "OBJECT",
            properties: {
                index: { type: "NUMBER", description: "The 1-based number of the todo item to toggle." }
            },
            required: ["index"]
        }
      },
      {
        name: "clearCompletedTodos",
        description: "Remove all completed (done) items from the todo list."
      },
      {
        name: "searchArxiv",
        description: "Search for academic papers on ArXiv by topic or keyword.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING", description: "The search query (e.g. 'quantum computing', 'LLM reasoning')." },
                count: { type: "NUMBER", description: "Number of results to return (default 5, max 10)." }
            },
            required: ["query"]
        }
      },
      {
        name: "webSearch",
        description: "Search the web for current information, news, or general queries.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING", description: "The search query." },
                count: { type: "NUMBER", description: "Number of results (default 5, max 10)." }
            },
            required: ["query"]
        }
      },
      {
        name: "scheduleTask",
        description: "Schedule a recurring task using a CRON expression. The task is a natural language instruction that will be executed automatically (e.g. 'Fetch 3 random research papers and send them to me').",
        parameters: {
            type: "OBJECT",
            properties: {
                instruction: { type: "STRING", description: "The natural language instruction to run (e.g. 'Search arxiv for AI papers and send 3 results')." },
                cron: { type: "STRING", description: "CRON expression for the schedule (e.g. '0 7 * * *' for 7am daily)." },
                label: { type: "STRING", description: "A short human-readable name for this task (e.g. 'Morning papers')." }
            },
            required: ["instruction", "cron", "label"]
        }
      },
      {
        name: "listScheduledTasks",
        description: "List all recurring scheduled tasks."
      },
      {
        name: "cancelScheduledTask",
        description: "Cancel a recurring scheduled task by its ID.",
        parameters: {
            type: "OBJECT",
            properties: {
                id: { type: "STRING", description: "The ID of the task to cancel." }
            },
            required: ["id"]
        }
      }
    ],
  },
];

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function talkGemini(content, chatId) {
  const now = new Date().toISOString();
  const systemPrompt = `
You are vishwa, a concise and professional AI agent. You shouldn't use more than 200 characters at a time.
Current date and time (ISO 8601): ${now}
- If the user asks to remember/recall, use 'storeMemory'/'fetchMemories'.
- Use 'setReminder', 'listReminders', 'cancelReminder' for reminders. Always convert relative times (e.g. "in 2 mins", "tomorrow at 9") to an ISO 8601 string using the current time above.
- Use 'generateBeamer' for presentations.
- Use 'storeBirthday' for birthdays.
- Use 'convertToPDF' or 'compressImages' when images are in buffer and user requests action (1 for PDF, 2 for Compress).
- Use 'saveImage' to save the last sent image. If name is missing, ASK for it.
- Use 'retrieveImage' to find and send a saved image.
- Use 'addTodo', 'listTodos', 'toggleTodo' (to mark done/pending by number), 'clearCompletedTodos', 'setTodoFrequency' for todo list management.
- For reminders, 'setReminder' accepts ISO 8601 dates OR CRON expressions (e.g. '0 9 * * *' for daily 9am).
- Use 'searchArxiv' to search for academic papers on ArXiv by topic.
- Use 'webSearch' to search the web for current events, news, or general information.
- Use 'scheduleTask' to create recurring automated tasks (e.g. 'fetch 3 arxiv papers every morning at 7am'). Convert natural time descriptions to CRON. Use 'listScheduledTasks' and 'cancelScheduledTask' to manage them.
- Creator: "I am made by verade productions".
`;

  let lastError = null;
  const chatHistory = getChatHistory();

  for (const apiKey of apiKeys) {
    const genAI = new GoogleGenerativeAI(apiKey);
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, tools: tools });
        
        // Always refresh the system prompt with the current time so relative times work
        if (!chatHistory[chatId]) {
          chatHistory[chatId] = [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Understood." }] }
          ];
        } else {
          // Update the timestamp in the existing system prompt entry
          chatHistory[chatId][0] = { role: "user", parts: [{ text: systemPrompt }] };
        }

        const chat = model.startChat({ history: chatHistory[chatId] });
        let result = await chat.sendMessage(content);
        let response = result.response;
        let functionCalls = response.functionCalls();

        while (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0];
          const name = call.name;
          const args = call.args;

          let toolResult;
          if (name === "fetchMemories") {
            toolResult = await fetchMemories();
          } else if (name === "storeMemory") {
            toolResult = await storeMemory(args);
          } else if (name === "setReminder") {
            toolResult = await scheduleReminder(chatId, args.task, args.time, client);
          } else if (name === "generateBeamer") {
            const pdfPath = await createBeamerPresentation(args.title, args.slides, args.author);
            if (pdfPath) {
                await client.sendMessage(chatId + '@c.us', MessageMedia.fromFilePath(pdfPath));
                toolResult = "Sent the presentation PDF.";
            } else toolResult = "Failed to generate PDF.";
          } else if (name === "listReminders") {
            toolResult = listReminders();
          } else if (name === "cancelReminder") {
            toolResult = cancelReminder(args.id);
          } else if (name === "storeBirthday") {
            toolResult = storeBirthday(args);
          } else if (name === "convertToPDF") {
            const pdfPath = await imagesToPDF(chatId, { [chatId]: getImages(chatId) });
            if (pdfPath) {
                await client.sendMessage(chatId + '@c.us', MessageMedia.fromFilePath(pdfPath));
                clearBuffer(chatId);
                toolResult = "PDF sent and images cleared.";
            } else toolResult = "Buffer empty or PDF conversion failed.";
          } else if (name === "compressImages") {
            const results = await compressImages(chatId, { [chatId]: getImages(chatId) });
            if (results && results.length > 0) {
                let totalOrig = 0;
                let totalComp = 0;
                for (const res of results) {
                    await client.sendMessage(chatId + '@c.us', MessageMedia.fromFilePath(res.path));
                    fs.unlinkSync(res.path);
                    totalOrig += res.originalSize;
                    totalComp += res.compressedSize;
                }
                clearBuffer(chatId);
                const saved = ((totalOrig - totalComp) / totalOrig * 100).toFixed(1);
                toolResult = `Compressed ${results.length} images.\nTotal size: ${formatBytes(totalOrig)} ➔ ${formatBytes(totalComp)} (${saved}% smaller).`;
            } else toolResult = "Buffer empty or compression failed.";
          } else if (name === "saveImage") {
            const images = getImages(chatId);
            if (images.length > 0) {
                // Save the most recent image
                const latestImage = images[images.length - 1]; 
                toolResult = saveImageToVault(latestImage, args.name);
            } else {
                toolResult = "No images found in current session to save.";
            }
          } else if (name === "retrieveImage") {
             const imagePath = findImageInVault(args.name);
             if (imagePath) {
                 await client.sendMessage(chatId + '@c.us', MessageMedia.fromFilePath(imagePath));
                 toolResult = `Sent image: "${args.name}"`;
             } else {
                 toolResult = `Image "${args.name}" not found in vault.`;
             }
          }

          else if (name === "addTodo") {
             toolResult = addTodo(chatId, args.item);
          } else if (name === "listTodos") {
             toolResult = getTodos(chatId);
          } else if (name === "setTodoFrequency") {
             toolResult = setReminderFrequency(chatId, args.frequency, client);
          } else if (name === "toggleTodo") {
             toolResult = toggleTodo(chatId, args.index);
          } else if (name === "clearCompletedTodos") {
             toolResult = clearCompleted(chatId);
          } else if (name === "searchArxiv") {
             try {
                 const count = Math.min(args.count || 5, 10);
                 toolResult = await fetchArxiv(args.query, count);
             } catch (e) {
                 toolResult = "ArXiv search failed: " + e;
             }
          } else if (name === "webSearch") {
             try {
                 const count = Math.min(args.count || 5, 10);
                 toolResult = await webSearch(args.query, count);
             } catch (e) {
                 toolResult = "Web search failed: " + e;
             }
          } else if (name === "scheduleTask") {
             toolResult = addScheduledTask(chatId, args.instruction, args.cron, args.label, client, talkGemini);
          } else if (name === "listScheduledTasks") {
             toolResult = listScheduledTasks(chatId);
          } else if (name === "cancelScheduledTask") {
             toolResult = cancelScheduledTask(chatId, args.id);
          }


          result = await chat.sendMessage([{ functionResponse: { name, response: { content: toolResult } } }]);
          response = result.response;
          functionCalls = response.functionCalls();
        }

        setChatHistory(chatHistory);
        saveHistory();
        return response.text();
      } catch (error) {
        lastError = error;
        console.warn(`Error with ${modelName} / key ...${apiKey.slice(-4)}:`, error.message);
        // If it's a 429, we might want to log more info, but keep trying other keys
      }
    }
  }
  throw lastError || new Error("Gemini failed");
}

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: data_path }),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        headless: true
    }
});

client.on('ready', () => {
    console.log('Bot is ready');
    loadReminders();
    loadBirthdays();
    loadHistory();
    loadTodos();
    loadScheduledTasks();
    rescheduleReminders(client);
    scheduleTodoReminders(client);
    rescheduleAllTasks(client, talkGemini);
    schedule.scheduleJob('0 0 * * *', () => checkBirthdays(client));
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('message_create', async message => {
    const cont = await message.getContact();
    const chatId = cont.number;

    if (message.hasMedia && message.type === 'image') {
        try {
            const media = await message.downloadMedia();
            if (media) {
                const ext = media.mimetype.split('/')[1] || 'jpg';
                const filePath = path.join(temp_dir, `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`);
                fs.writeFileSync(filePath, media.data, 'base64');
                addImageToBuffer(chatId, filePath);
                const count = getImages(chatId).length;
                await client.sendMessage(chatId + '@c.us', `Received image (${count} total).\n1. Generate PDF\n2. Reduce size\n(Clears in 5m if no action)`);
            }
        } catch (e) {
            console.error("Media download error:", e);
        }
        return;
    }

    if (!message.body || message.body.trim() === "") return;

    let allowed = [];
    try {
        const allowedPath = path.join(__dirname, 'helpers', 'allowed_contacts.json');
        if (fs.existsSync(allowedPath)) {
            allowed = JSON.parse(fs.readFileSync(allowedPath, 'utf8'));
        }
    } catch (e) {
        console.error("Error loading allowed contacts:", e);
    }
    if (allowed.includes(chatId)) {
        try {
            const reply = await talkGemini(message.body, chatId);
            message.reply('[vishwa] ' + reply);
        } catch (e) {
            console.error('talkGemini error:', e.message);
            if (e.status === 429) {
                // Try to extract retry time from error message or meta
                let retryMsg = "⚠️ API quota exceeded. Please try again in about a minute.";
                const match = e.message.match(/retry in ([\d\.]+s)/);
                if (match) {
                    retryMsg = `⚠️ API quota exceeded. Please try again in ${match[1]}.`;
                }
                message.reply('[vishwa] ' + retryMsg);
            } else {
                message.reply('[vishwa] ⚠️ Sorry, I encountered an error processing your request.');
            }
        }
    }
});

client.initialize();
