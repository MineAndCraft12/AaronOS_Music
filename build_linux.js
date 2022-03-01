const packager = require('electron-packager');

console.log("initializing bundleElectronApp...");
async function bundleElectronApp(options){
    const appPaths = await packager(options);
    console.log(`Electron app bundles created:\n${appPaths.join("\n")}`);
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

console.log("building for Linux...");
bundleElectronApp(options_linux);