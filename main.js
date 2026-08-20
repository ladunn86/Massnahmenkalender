const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

let mainWindow;
let isHandlingClose = false;

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
    if (isHandlingClose) return;

    event.preventDefault();

    let hasUnsavedChanges = false;

    try {
      hasUnsavedChanges = await mainWindow.webContents.executeJavaScript(`
        (typeof window.__massnahmenHasUnsavedChanges === 'function')
          ? window.__massnahmenHasUnsavedChanges()
          : false
      `, true);
    } catch (error) {
      console.error(
        'Speicherstatus konnte nicht abgefragt werden:',
        error
      );
    }

    // Keine Änderungen → direkt schließen.
    if (!hasUnsavedChanges) {
      isHandlingClose = true;
      mainWindow.destroy();
      return;
    }

    // Es gibt ungespeicherte Änderungen.
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: [
        'Speichern',
        'Nicht speichern',
        'Abbrechen'
      ],
      defaultId: 0,
      cancelId: 2,
      title: 'Ungespeicherte Änderungen',
      message: 'Es gibt ungespeicherte Änderungen.',
      detail:
        'Möchtest du die Änderungen vor dem Schließen speichern?'
    });

    // SPEICHERN
    if (result.response === 0) {
      try {
        await mainWindow.webContents.executeJavaScript(`
          (function() {
            if (typeof saveJson === 'function') {
              saveJson();

              if (typeof markSaved === 'function') {
                markSaved();
              }
            }
          })()
        `, true);

        isHandlingClose = true;
        mainWindow.destroy();

      } catch (error) {
        console.error(
          'Speichern vor dem Schließen fehlgeschlagen:',
          error
        );

        await dialog.showMessageBox(mainWindow, {
          type: 'error',
          buttons: ['OK'],
          title: 'Speichern fehlgeschlagen',
          message:
            'Die Änderungen konnten nicht gespeichert werden.',
          detail: String(error)
        });
      }

    // NICHT SPEICHERN
    } else if (result.response === 1) {

      isHandlingClose = true;
      mainWindow.destroy();

    // ABBRECHEN
    } else {
      // Fenster bleibt geöffnet.
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
