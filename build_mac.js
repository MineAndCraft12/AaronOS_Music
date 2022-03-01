const packager = require('electron-packager');

console.log("initializing bundleElectronApp...");
async function bundleElectronApp(options){
    const appPaths = await packager(options);
    console.log(`Electron app bundles created:\n${appPaths.join("\n")}`);
}

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
    },
    ignore: /release\-builds\//
};

console.log("building for MacOS...");
bundleElectronApp(options_mac);