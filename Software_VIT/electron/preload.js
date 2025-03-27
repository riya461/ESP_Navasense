const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  correctWord: (word, context) => ipcRenderer.invoke('correct-word', { word, context })
});