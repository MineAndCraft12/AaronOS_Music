console.log("Preparing packager...");

const packager = require('electron-packager');

async function bundleElectronApp(options){
    const appPaths = await packager(options);
    if(appPaths.length > 0){
        console.log(`Electron app package created: ${appPaths.join(", ")}`);
    }else{
        console.log(`Electron app package failed to create.`);
    }
}

var options_win = {
    dir: ".",
    arch: "x64",
    asar: true,
    platform: "win32",
    icon: "win_icon.ico",
    out: "release-builds/win",
    overwrite: "true",
    ignore: /release\-builds\//
};

bundleElectronApp(options_win);
options_win.arch = "ia32";
bundleElectronApp(options_win);
options_win.arch = "arm64";
bundleElectronApp(options_win);