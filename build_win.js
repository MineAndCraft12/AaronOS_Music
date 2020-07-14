const packager = require('electron-packager');

console.log("initializing bundleElectronApp...");
async function bundleElectronApp(options){
    const appPaths = await packager(options);
    console.log(`Electron app bundles created:\n${appPaths.join("\n")}`);
}

var options_win = {
    dir: ".",
    arch: "ia32",
    asar: true,
    platform: "win32",
    icon: "win_icon.ico",
    out: "release-builds/win",
    overwrite: "true"
};

/*
var options_mac = {
    dir: ".",
    arch: "x64",
    asar: true,
    platform: "darwin",
    icon: "./mac_icon.icns",
    out: "release-builds/mac",
    overwrite: "true",
    appBundleId: "dev.aaronos.music",
    appCategoryType: "public.app-category.music",
    darwinDarkModeSupport: true,
    usageDescription: {
        Microphone: "Used to visualize microphone input"
    }
};

var options_linux = {
    dir: ".",
    arch: "x64",
    asar: true,
    platform: "linux",
    icon: "./app_icon.png",
    out: "release-builds/linux",
    overwrite: "true"
};
*/

console.log("building for Windows...");
bundleElectronApp(options_win);
//console.log("building for Linux...");
//bundleElectronApp(options_linux);
//console.log("building for MacOS...");
//bundleElectronApp(options_mac);