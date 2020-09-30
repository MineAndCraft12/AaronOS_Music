const {
    app,
    BrowserWindow,
    ipcMain,
    screen
} = require('electron');

let windowType = "opaque";
let win = null;
let win2 = null;
let screenDims = {
    width: 1280,
    height: 720
}

if(app.commandLine.hasSwitch('enable-transparent-visuals')){
    app.disableHardwareAcceleration();
}

function createWindow() {
    win = new BrowserWindow({
        width: 1048,
        height: 632,
        webPreferences: {
            nodeIntegration: true
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

    //win.setMenu(null);
    win.setMenuBarVisibility(false);

    win.loadFile('index.html');
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
            nodeIntegration: true
        },
        show: false,
        backgroundColor: "#00ffffff",
        icon: "app_icon.png",
        frame: false,
        transparent: true
    });

    win2.once('ready-to-show', () => {
        win2.show();
        if(windowType === "opaque"){
            windowType = "transparent";
            win.close();
        }
    });

    //win.setMenu(null);
    win2.setMenuBarVisibility(false);

    win2.loadFile('index.html');
}

function appLaunch(){
    screenWorkArea = screen.getPrimaryDisplay().workAreaSize;
    screenDims = {
        width: screenWorkArea.width,
        height: screenWorkArea.height
    }
    console.log(app.commandLine.hasSwitch('enable-transparent-visuals'));
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
        //createWindowTransparent();
        app.relaunch({ args: process.argv.slice(1).concat(['--enable-transparent-visuals']) });
        app.quit();
    }else if(windowType === "transparent"){
        //screenDims = {width: args.x, height: args.y};
        //createWindow();
        app.relaunch({ args: process.argv.slice(1, 2) });
        app.quit();
    }
});

ipcMain.on('getWindowType', function(event){
    event.sender.send('giveWindowType', {windowType: windowType});
})