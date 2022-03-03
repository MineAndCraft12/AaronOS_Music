console.log("Preparing packager...");

const packager = require('electron-packager');

async function bundleElectronApp(options){
    const appPaths = await packager(options);
    if(appPaths.length > 0){
        console.log(`Electron app package created: ${appPaths.join(", ")}`);
    }else{
        console.log(`Electron app package failed to create.`)
    }
}

var options_linux = {
    dir: ".",
    arch: "x64",
    asar: true,
    platform: "linux",
    icon: "./app_icon.png",
    out: "release-builds/linux",
    overwrite: "true",
    ignore: /release\-builds\//
};

bundleElectronApp(options_linux);
options_linux.arch = "ia32";
bundleElectronApp(options_linux);
options_linux.arch = "arm64";
bundleElectronApp(options_linux);
options_linux.arch = "armv7l";
bundleElectronApp(options_linux);