const {
    app,
    BrowserWindow
} = require('electron');

function createWindow() {
    let win = new BrowserWindow({
        width: 1048,
        height: 650,
        webPreferences: {
            nodeIntegration: true
        },
        show: false,
        backgroundColor: "rgb(32, 32, 32)"
    });

    win.once('ready-to-show', () => {
        win.show();
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if(process.platform !== 'darwin'){
        app.quit();
    }
});

app.on('activate', () => {
    if(BrowserWindow.getAllWindows().length === 0){
        createWindow();
    }
});