const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let closingConfirmed = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('close', async (event) => {

    if (closingConfirmed) {
      return;
    }

    event.preventDefault();

    let hasUnsavedChanges = false;

    try {
      hasUnsavedChanges = await mainWindow.webContents.executeJavaScript(
        'window.hasUnsavedChanges === true',
        true
      );
    } catch (error) {
      console.error(
        'Fehler beim Prüfen des Speicherstatus:',
        error
      );
    }

    // Keine Änderungen → direkt schließen
    if (!hasUnsavedChanges) {
      closingConfirmed = true;
      mainWindow.close();
      return;
    }

    // Ungespeicherte Änderungen → Nachfrage
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Ungespeicherte Änderungen',
      message: 'Es gibt ungespeicherte Änderungen.',
      detail: 'Möchtest du die Änderungen vor dem Schließen speichern?',
      buttons: [
        'Speichern',
        'Nicht speichern',
        'Abbrechen'
      ],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    });

    // Abbrechen
    if (result.response === 2) {
      return;
    }

    // Nicht speichern
    if (result.response === 1) {
      closingConfirmed = true;
      mainWindow.close();
      return;
    }

    // Speichern
    if (result.response === 0) {

      try {

        const saved = await mainWindow.webContents.executeJavaScript(
          `
          (async function () {
            if (typeof saveJson === 'function') {
              return await saveJson();
            }

            return false;
          })()
          `,
          true
        );

        // Benutzer hat im Speichern-Dialog auf Abbrechen geklickt
        if (!saved) {
          return;
        }

        closingConfirmed = true;
        mainWindow.close();

      } catch (error) {

        console.error(
          'Fehler beim Speichern:',
          error
        );

        await dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Speichern fehlgeschlagen',
          message: 'Die Änderungen konnten nicht gespeichert werden.',
          detail: String(error),
          buttons: ['OK']
        });
      }
    }
  });
}


// ---------------------------------------------------------
// SPEICHERDIALOG
// ---------------------------------------------------------

ipcMain.handle('save-json', async (event, data) => {

  if (!data || typeof data !== 'object') {
    throw new Error('Ungültige Speicherdaten.');
  }

  const safeName = String(data.name || 'Massnahme')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim() || 'Massnahme';

  const defaultPath = path.join(
    app.getPath('documents'),
    safeName + '.json'
  );

  const result = await dialog.showSaveDialog(mainWindow, {

    title: 'Maßnahme speichern',

    defaultPath: defaultPath,

    filters: [
      {
        name: 'JSON-Datei',
        extensions: ['json']
      },
      {
        name: 'Alle Dateien',
        extensions: ['*']
      }
    ],

    properties: [
      'showOverwriteConfirmation'
    ]
  });

  // Benutzer hat Abbrechen gedrückt
  if (result.canceled || !result.filePath) {
    return {
      saved: false
    };
  }

  await fs.promises.writeFile(
    result.filePath,
    JSON.stringify(data, null, 2),
    'utf8'
  );

  return {
    saved: true,
    filePath: result.filePath
  };
});


// ---------------------------------------------------------
// ELECTRON START
// ---------------------------------------------------------

app.whenReady().then(() => {

  createWindow();

  app.on('activate', () => {

    if (
      BrowserWindow.getAllWindows().length === 0
    ) {
      createWindow();
    }

  });

});


// ---------------------------------------------------------
// WINDOWS SCHLIESSEN
// ---------------------------------------------------------

app.on('window-all-closed', () => {

  if (process.platform !== 'darwin') {
    app.quit();
  }

});
