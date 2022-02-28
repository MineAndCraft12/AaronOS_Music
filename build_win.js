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
    overwrite: "true",
    ignore: /(?:release\-builds|node_modules)\//
};

console.log("building for Windows...");
bundleElectronApp(options_win);