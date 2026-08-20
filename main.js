const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', async (event) => {
    if (!mainWindow) return;

    // Prüfen, ob die HTML-Anwendung ungespeicherte Änderungen hat.
    const hasUnsavedChanges = await mainWindow.webContents.executeJavaScript(`
      typeof hasUnsavedChanges !== 'undefined' && hasUnsavedChanges === true
    `);

    if (!hasUnsavedChanges) {
      return;
    }

    event.preventDefault();

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Speichern', 'Nicht speichern', 'Abbrechen'],
      defaultId: 0,
      cancelId: 2,
      title: 'Ungespeicherte Änderungen',
      message: 'Es gibt ungespeicherte Änderungen.',
      detail: 'Möchtest du die Änderungen speichern, bevor das Programm geschlossen wird?'
    });

    if (result.response === 0) {
      // Die HTML-Anwendung speichert die aktuelle Maßnahme.
      await mainWindow.webContents.executeJavaScript(`
        if (typeof saveJson === 'function') {
          saveJson();
        }
      `);

      mainWindow.destroy();

    } else if (result.response === 1) {
      mainWindow.destroy();

    } else {
      // Abbrechen: Fenster bleibt geöffnet.
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
