const {app, BrowserWindow, Menu, dialog, ipcMain, globalShortcut} = require('electron');
const fs = require('fs/promises');
const path = require('path');

const isMac = process.platform === 'darwin';

let mainWindow;
let port;
let dirty = false;
let currentFilename;

async function save() {
  if(!currentFilename) {
    return saveAs();
  }

  return saveAs(currentFilename);
}

async function saveAs(filename) {
  if(!filename) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save File',
      filters: [
        {
          name: 'JSON (.json)',
          extensions: ['json'],
        },
        {
          name: 'All Files',
          extensions: ['*'],
        },
      ],
      properties: ['openFile'],
      defaultPath: currentFilename,
    });

    if(result.canceled) {
      return;
    }

    currentFilename = result.filePath;
  }

  port.postMessage({type: 'export'});
  port.once('message', async event => {
    const json = JSON.stringify(event.data.data);
    await fs.writeFile(currentFilename, json);
    dirty = false;
  });
}

async function confirmChanges() {
  if(!dirty) {
    return true;
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Unsaved changes',
    message: 'Unsaved changes',
    detail: 'Do you want to save your changes?',
    buttons: [
      'Cancel',
      'Don\'t save',
      currentFilename ? 'Save' : 'Save as...',
    ],
    cancelId: 0,
    defaultId: 2,
  });

  switch(result.response) {
    case 0:
      return false;
    case 1:
      return true;
    case 2:
      save();
      return true;
  }
}

const menuTemplate = [
  ...(isMac ? [{
    label: app.name,
    submenu: [
      {role: 'about'},
      {type: 'separator'},
      {role: 'services'},
      {type: 'separator'},
      {role: 'hide'},
      {role: 'hideOthers'},
      {role: 'unhide'},
      {type: 'separator'},
      {role: 'quit'},
    ],
  }] : []),
  {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CommandOrControl+N',
        click: async () => {
          if(!await confirmChanges()) {
            return;
          }

          port.postMessage({type: 'reset'});
          currentFilename = undefined;
          dirty = false;
        },
      },
      {type: 'separator'},
      {
        label: 'Open...',
        accelerator: 'CommandOrControl+O',
        click: async () => {
          if(!await confirmChanges()) {
            return;
          }

          const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Open File',
            filters: [
              {
                name: 'JSON (.json)',
                extensions: ['json'],
              },
              {
                name: 'All Files',
                extensions: ['*'],
              },
            ],
            properties: ['openFile'],
            defaultPath: currentFilename,
          });

          if(result.canceled) {
            return;
          }

          currentFilename = result.filePaths[0];
          const fileContents = await fs.readFile(currentFilename, 'utf8');
          const data = JSON.parse(fileContents);

          port.postMessage({type: 'import', data});
          dirty = false;

          app.addRecentDocument(currentFilename);
        },
      },
      {
        label: 'Save',
        accelerator: 'CommandOrControl+S',
        click: () => save(),
      },
      {
        label: 'Save As...',
        accelerator: 'CommandOrControl+Shift+S',
        click: () => saveAs(),
      },
      {type: 'separator'},
      {
        label: 'Print...',
        accelerator: 'CommandOrControl+P',
        click: async () => {
          mainWindow.webContents.print();
        },
      },
      {type: 'separator'},
      isMac ? {role: 'close'} : {role: 'quit'},
    ],
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        id: 'undo',
        accelerator: 'CommandOrControl+Z',
        enabled: false,
        click: async () => {
          port.postMessage({type: 'undo'});
        },
      },
      {
        label: 'Redo',
        id: 'redo',
        accelerator: isMac ? 'CommandOrControl+Shift+Y' : 'CommandOrControl+Y',
        enabled: false,
        click: async () => {
          port.postMessage({type: 'redo'});
        },
      },
    ],
  },
  {
    label: 'View',
    submenu: [
      ...(app.isPackaged ? [] : [
        {role: 'toggleDevTools'},
        {type: 'separator'},
      ]),
      {role: 'resetZoom'},
      {role: 'zoomIn'},
      {role: 'zoomOut'},
    ],
  },
  ...(isMac ? [] : [{
    role: 'help',
    submenu: [
      {
        label: 'About Urlaubsplaner',
        click: async () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            icon: path.join(app.getAppPath(), 'assets/icons/logo256.png'),
            title: `About ${app.name}`,
            message: `About ${app.name}`,
            detail: `Version: ${app.getVersion()}\nDeveloped by Simon "Tenry" Burchert`,
          });
        },
      },
    ],
  }]),
];

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

async function createMainWindow() {
  ipcMain.on('port', event => {
    port = event.ports[0];

    port.on('message', event => {
      switch(event.data.type) {
        case 'undo':
          Menu.getApplicationMenu().getMenuItemById('undo').enabled = event.data.available;
          break;
        case 'redo':
          Menu.getApplicationMenu().getMenuItemById('redo').enabled = event.data.available;
          break;
        case 'touch':
          dirty = true;
          break;
      }
    });

    port.start();
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(app.getAppPath(), 'assets/icons/logo64.png'),
    title: 'Urlaubsplaner',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // issue: save dialog is not shown on close
  // let isProgrammaticClose = false;
  // mainWindow.on('close', async event => {
  //   if(!isProgrammaticClose) {
  //     event.preventDefault();

  //     if(await confirmChanges()) {
  //       isProgrammaticClose = true;
  //       mainWindow.close();
  //       isProgrammaticClose = false;
  //     }
  //   }
  // });

  await mainWindow.loadFile(path.join(app.getAppPath(), 'frontend/index.html'));
}

app.whenReady().then(async () => {
  createMainWindow();
});

app.on('window-all-closed', () => {
  app.clearRecentDocuments();

  if(!isMac) {
    app.quit();
  }
});

app.on('activate', () => {
  if(BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
