const {
    app,
    BrowserWindow,
    ipcMain,
    screen,
} = require('electron');

require('@electron/remote/main').initialize();

let windowType = "opaque";
let win = null;
let win2 = null;
let screenDims = {
    width: 1280,
    height: 720
}

function createWindow() {
    win = new BrowserWindow({
        width: 1048,
        height: 632,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        backgroundColor: "rgb(32, 32, 32)",
        icon: "app_icon.png"
    });

    win.once('ready-to-show', () => {
        win.show();
        if(windowType === "transparent"){
            windowType = "opaque";
            win2.close();
        }
    });

    win.setMenuBarVisibility(false);

    require("@electron/remote/main").enable(win.webContents);

    win.loadFile('index.html');
}

if(app.commandLine.hasSwitch('disable-hardware-acceleration')){
    app.disableHardwareAcceleration();
}

function createWindowTransparent() {
    win2 = new BrowserWindow({
        width: screenDims.width,
        height: screenDims.height,
        x: 0,
        y: 0,
        useContentSize: true,
        movable: false,
        resizable: false,
        alwaysOnTop: true,
        fullscreen: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        backgroundColor: "#00ffffff",
        icon: "app_icon.png",
        frame: false,
        transparent: true
    });

    console.log("creating transparent window...");

    win2.once('ready-to-show', () => {
        console.log("ready to show transparent window");
        win2.show();
        
        if(windowType === "opaque"){
            windowType = "transparent";
            win.close();
        }
    });

    win2.setMenuBarVisibility(false);

    require("@electron/remote/main").enable(win2.webContents);

    win2.loadFile('index.html');
}

function appLaunch(){
    screenWorkArea = screen.getPrimaryDisplay().workAreaSize;
    screenDims = {
        width: screenWorkArea.width,
        height: screenWorkArea.height
    }
    if(app.commandLine.hasSwitch('enable-transparent-visuals')){
        windowType = "transparent";
        createWindowTransparent();
    }else{
        windowType = "opaque";
        createWindow();
    }
}

app.whenReady().then(() => {appLaunch()});

app.on('window-all-closed', () => {
    if(process.platform !== 'darwin'){
        app.quit();
    }
});

app.on('activate', () => {
    if(BrowserWindow.getAllWindows().length === 0){
        if(app.commandLine.hasSwitch('enable-transparent-visuals')){
            windowType = "transparent";
            createWindowTransparent();
        }else{
            windowType = "opaque";
            createWindow();
        }
    }
});

ipcMain.on('toggle-transparent', function(event, args){
    if(windowType === "opaque"){
        if(process.argv[1] === "."){
            app.relaunch({ args: process.argv.slice(1).concat(['--enable-transparent-visuals']) });
        }else{
            app.relaunch({args: process.argv.slice(0).concat(['--enable-transparent-visuals'])});
        }
        app.quit();
    }else if(windowType === "transparent"){
        if(process.argv[1] === "."){
            app.relaunch({ args: process.argv.slice(1, 2) });
        }else{
            app.relaunch({ args: process.argv.slice(0, 1) });
        }
        app.quit();
    }
});

ipcMain.on('toggle-transparent-no-gpu', function(event, args){
    if(process.argv[1] === "."){
        app.relaunch({ args: process.argv.slice(1).concat(['--enable-transparent-visuals', '--disable-hardware-acceleration']) });
    }else{
        app.relaunch({args: process.argv.slice(0).concat(['--enable-transparent-visuals', '--disable-hardware-acceleration'])});
    }
    app.quit();
});

ipcMain.on('getWindowType', function(event){
    event.sender.send('giveWindowType', {windowType: windowType});
});