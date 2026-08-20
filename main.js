const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

let mainWindow;
let closingConfirmed = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false
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

        await mainWindow.webContents.executeJavaScript(
          `
          (async function () {
            if (typeof saveJson === 'function') {
              await saveJson();
            }

            if (typeof markSaved === 'function') {
              markSaved();
            }
          })()
          `,
          true
        );

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
