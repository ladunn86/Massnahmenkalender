const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  saveJson: (data) => {
    return ipcRenderer.invoke('save-json', data);
  }

});
