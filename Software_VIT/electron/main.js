const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const kill = require('tree-kill');

const OLLAMA_PORT = 11434;
let mainWindow;
let ollamaProcess;

async function startOllama() {
  return new Promise((resolve, reject) => {
    // Check if Ollama is already running
    exec(`curl -m 2 http://127.0.0.1:11434/api/tags`, (error) => {
      if (!error) return resolve(); // Already running

      // Start Ollama if not running
      ollamaProcess = exec('ollama serve', { windowsHide: true });
      
      // Verify startup
      const maxAttempts = 10;
      let attempts = 0;
      
      const checkReady = setInterval(() => {
        attempts++;
        exec(`curl -m 2 http://127.0.0.1:11434/api/tags`, (err) => {
          if (!err) {
            clearInterval(checkReady);
            resolve();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkReady);
            reject(new Error('Ollama failed to start'));
          }
        });
      }, 1000);
    });
  });
}

async function correctWord(word, context) {
  try {
    const response = await axios.post(`http://127.0.0.1:11434/api/generate`, {
      model: 'mistral',
      prompt: `Correct this word: "${word}" in context: "${context}". Reply only with the corrected word.`,
      options: { temperature: 0.1 },
      stream: false
    }, { timeout: 30000 });

    return response.data.response.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('LLM Error:', error.message);
    throw error;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    }
  });

  ipcMain.handle('correct-word', async (_, { word, context }) => {
    try {
      return await correctWord(word, context);
    } catch (error) {
      throw new Error('Word correction failed. Ensure Ollama is running.');
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(async () => {
  try {
    await startOllama();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('Ollama Error', error.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (ollamaProcess?.pid) kill(ollamaProcess.pid);
  app.quit();
});

process.on('SIGTERM', () => {
  if (ollamaProcess?.pid) kill(ollamaProcess.pid);
});