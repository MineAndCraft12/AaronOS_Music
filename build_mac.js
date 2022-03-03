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

bundleElectronApp(options_mac);
options_mac.arch = "arm64";
bundleElectronApp(options_mac);