const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  correctWord: (word) => ipcRenderer.invoke('correctword', { word })
});