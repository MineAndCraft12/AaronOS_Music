var webVersion = 0;
var aosToolsConnected = 0;
//let remote, ipcRenderer, desktopCapturer = null;
try{
    var {
        remote,
        ipcRenderer,
        desktopCapturer
    } = require('electron');
}catch(err){
    console.log("Error requiring electron -- assuming web version");
    webVersion = 1;
    var newScriptTag = document.createElement("script");
    newScriptTag.setAttribute("data-light", "true");
    newScriptTag.src = "aosTools.js";
    document.head.appendChild(newScriptTag);
}

window.aosTools_connectListener = function(){
    aosTools.openWindow();
    aosToolsConnected = 1;
    getId("tskbrModeRange").style.display = "none";
    aosTools.getBorders(recieveWindowBorders);
    aosTools.updateStyle = checkDarkTheme;
    checkDarkTheme();
}

// ask for window type
var windowType = "opaque";
if(!webVersion){
    ipcRenderer.on("giveWindowType", function(event, arg){
        windowType = arg.windowType;
        updateWindowType();
        remote.getCurrentWindow().setIgnoreMouseEvents(false);
    });
    function sendTypeRequest(){
        ipcRenderer.send("getWindowType");
    }
    window.requestAnimationFrame(sendTypeRequest);
}

// prevent the display from going to sleep
var preventingSleep = 0;
var sleepID = null;
function blockSleep(){
    if(!preventingSleep){
        if(webVersion){
            if(aosToolsConnected){
                aosTools.blockScreensaver(() => {});
                preventingSleep = 1;
            }
        }else{
            sleepID = remote.powerSaveBlocker.start("prevent-display-sleep");
            preventingSleep = 1;
        }
    }
}
function unblockSleep(){
    if(preventingSleep){
        if(webVersion){
            if(aosToolsConnected){
                aosTools.unblockScreensaver(() => {});
                preventingSleep = 0;
            }
        }else{
            remote.powerSaveBlocker.stop(sleepID);
            sleepID = null;
            preventingSleep = 0;
        }
    }
}

if(webVersion){
    // web version can't be transparent or use system audio
    getId("systemAudioIcon").style.display = "none";
    getId("transparentModeIcon").style.display = "none";
    getId("tskbrModeRange").style.display = "none";
}else{
    // disable system audio icon on mac because it's not allowed
    if(navigator.platform.indexOf("Mac") === 0){
        getId("systemAudioIcon").style.display = "none";
        getId("filesIcon").src = "icons/mac_files.png";
        getId("folderIcon").src = "icons/mac_folder.png";
        getId("microphoneIcon").src = "icons/mac_microphone.png";
    }

    // taskbar mode is designed with windows taskbar
    if(navigator.platform.indexOf("Win") !== 0){
        getId("tskbrModeRange").style.display = "none";
    }
}

window.onerror = function(errorMsg, url, lineNumber){
    console.log("oof, u got a error\n\n" + url + '[' + lineNumber + ']:\n' + errorMsg);
}

function getId(target){
    return document.getElementById(target);
}

var windowBorders = [6, 35, 0];
function recieveWindowBorders(response){
    windowBorders = [
        response.content.left + response.content.right,
        response.content.top + response.content.bottom,
        1
    ];
}

var iframeMode = 1;
if(navigator.platform.indexOf("Win") === 0 && !webVersion){
    getId("tskbrModeRange").style.display = "";
}

function checkDarkTheme(){
    if(webVersion){
        if(aosToolsConnected){
            aosTools.getDarkMode((response) => {
                if(response.content === true){
                    document.body.classList.add("darkMode");
                }else{
                    document.body.classList.remove("darkMode");
                }
            });
        }
    }else{
        if(remote.nativeTheme.shouldUseDarkColors){
            document.body.classList.add("darkMode");
        }else{
            document.body.classList.remove("darkMode");
        }
    }
}
checkDarkTheme();
if(!webVersion){
    remote.nativeTheme.on('updated', checkDarkTheme);
}

var audio = new Audio();
var audioDuration = 1;
function updateProgress(){
    progressBar.style.width = audio.currentTime / audioDuration * 100 + "%";
    progressBar.style.backgroundColor = getColor(audio.currentTime / audioDuration * 255);
    requestAnimationFrame(updateProgress);
}
requestAnimationFrame(updateProgress);

/*global AudioContext*/

var audioContext;
var mediaSource;

var delayNode;
function setDelay(newDelay){
    delayNode.delayTime.value = (newDelay || 0);
}

function setVolume(newVolume){
    audio.volume = newVolume;
}

var analyser;

var visDataBuffer;
var visData;

var microphone;
var systemVideo;
var systemAudio;

var folderInput = getId("folderInput");
var fileInput = getId("fileInput");
var fileWeirdInput = getId("fileWeirdInput");
var songList = getId("songList");
var progressBar = getId("progress");
var currentlyPlaying = getId("currentlyPlaying");

var files = [];
var filesAmount = 0;
var fileNames = [];
var fileInfo = {};
var filesLength = 0;

var supportedFormats = ['aac', 'aiff', 'wav', 'm4a', 'mp3', 'amr', 'au', 'weba', 'oga', 'wma', 'flac', 'ogg', 'opus', 'webm'];

var URL;

function listSongs(){
    var str = "";
    for(var i in fileNames){
        str += '<div id="song' + i + '" onclick="selectSong(' + i + ')">' + fileNames[i][1] + ": " + fileNames[i][3] + fileNames[i][0] + '</div>';
    }
    songList.innerHTML = str;
}

function generateSongInfo(){
    var tempFileInfo = {
        _color_tutorial: {
            colorTypes: ['gradient', 'peak', 'solid'],
            colorTypesExplanations: {
                gradient: 'All colors are evenly distributed.',
                peak: 'Same as gradient, but the last color is used as a peak of sorts, at very high volumes.',
                solid: 'Solid color, no gradient'
            },
            colorFormat: [
                "Each file requires a colorType and list of colors.",
                "The _default_colors are selected when a specific song has no colors.",
                [
                    'Red Channel',
                    'Green Channel',
                    'Blue Channel',
                    'Alpha Channel'
                ],
                [
                    127,
                    255,
                    204,
                    0.8
                ]
            ]
        },
        _default_colors: {
            colorType: 'peak',
            colors: [
                [0, 0, 255, 1],
                [0, 255, 0, 1],
                [255, 0, 0, 1]
            ]
        }
    };
    for(var i in fileNames){
        tempFileInfo[fileNames[i][0]] = {
            colorType: '',
            colors: []
        };
    }
    for(var i in fileInfo){
        tempFileInfo[i] = fileInfo[i];
    }
    getId("songInfoTemplate").value = JSON.stringify(tempFileInfo, null, '\t');
}

var fileInfoError = 0;
function readFileInfo(event){
    try{
        fileInfo = JSON.parse(event.target.result);
    }catch(err){
        console.log("Error parsing file info");
        fileInfoError = 1;
    }
}

function loadFolder(event){
    automaticColorCtx = getId('autoColorCanvas').getContext('2d');
    audio.pause();
    currentSong = -1;
    files = folderInput.files;
    filesAmount = files.length;
    filesLength = 0;
    fileNames = [];
    for(var i = 0; i < filesAmount; i++){
        if(files[i].type.indexOf("audio/") === 0){
            var fileName = files[i].name.split('.');
            if(fileName[fileName.length - 1] !== 'mid' && fileName[fileName.length - 1] !== 'midi'){
                var filePath = '';
                if(files[i].webkitRelativePath){
                    filePath = files[i].webkitRelativePath.split('/');
                    filePath.pop();
                    filePath.shift();
                    if(filePath.length > 0){
                        filePath = filePath.join(": ");
                        filePath += ': ';
                    }else{
                        filePath = '';
                    }
                }
                filesLength++;
                if(supportedFormats.indexOf(fileName[fileName.length - 1]) > -1){
                    fileName.pop();
                }
                fileNames.push([fileName.join('.'), i, URL.createObjectURL(files[i]), filePath]);
            }
        }else if(files[i].webkitRelativePath.split('/').length === 2 && files[i].webkitRelativePath.split('/').pop() === "_songInfo.txt"){
            var reader = new FileReader();
            reader.onload = readFileInfo;
            reader.readAsText(files[i]);
            setTimeout(function(){getId('colorfield').value="autoFileInfo";setColor('autoFileInfo');}, 100);
        }
    }
    listSongs();
    var disabledElements = document.getElementsByClassName('disabled');
    while(disabledElements.length > 0){
        disabledElements[0].classList.remove('disabled');
    }
    if(!smokeEnabled){
        smokeElement.classList.add("disabled");
        smokeScreen1.classList.add("disabled");
        smokeScreen2.classList.add("disabled");
    }
    getId("liveControls").classList.add("disabled");
    
    audioContext = new AudioContext();
    mediaSource = audioContext.createMediaElementSource(audio);
    
    delayNode = audioContext.createDelay();
    delayNode.delayTime.value = 0.25;
    delayNode.connect(audioContext.destination);
    
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 32768;
    analyser.minDecibels = -70;
    analyser.smoothingTimeConstant = 0;
    mediaSource.connect(analyser);
    analyser.connect(delayNode);
    
    visData = new Uint8Array(analyser.frequencyBinCount);
    
    getId("introduction").classList.add('disabled');
    getId("visualizer").classList.add('disabled');
    getId("selectOverlay").classList.add('disabled');
    setVis("none");
    
    winsize = [window.innerWidth, window.innerHeight];
    if(fullscreen){
        size = [window.innerWidth, window.innerHeight];
    }else{
        size = [window.innerWidth - 8, window.innerHeight - 81];
    }
    getId("visCanvas").width = size[0];
    getId("visCanvas").height = size[1];
    
    requestAnimationFrame(globalFrame);
}

function loadFiles(event){
    audio.pause();
    currentSong = -1;
    files = fileInput.files;
    filesAmount = files.length;
    filesLength = 0;
    fileNames = [];
    for(var i = 0; i < filesAmount; i++){
        if(files[i].type.indexOf("audio/") === 0){
            var fileName = files[i].name.split('.');
            if(fileName[fileName.length - 1] !== 'mid' && fileName[fileName.length - 1] !== 'midi'){
                var filePath = '';
                if(files[i].webkitRelativePath){
                    filePath = files[i].webkitRelativePath.split('/');
                    filePath.pop();
                    filePath.shift();
                    filePath.join(": ");
                    filePath += ': ';
                }
                filesLength++;
                if(supportedFormats.indexOf(fileName[fileName.length - 1]) > -1){
                    fileName.pop();
                }
                fileNames.push([fileName.join('.'), i, URL.createObjectURL(files[i]), filePath]);
            }
        }
    }
    listSongs();
    var disabledElements = document.getElementsByClassName('disabled');
    while(disabledElements.length > 0){
        disabledElements[0].classList.remove('disabled');
    }
    if(!smokeEnabled){
        smokeElement.classList.add("disabled");
        smokeScreen1.classList.add("disabled");
        smokeScreen2.classList.add("disabled");
    }
    getId("liveControls").classList.add("disabled");
    
    audioContext = new AudioContext();
    mediaSource = audioContext.createMediaElementSource(audio);
    
    delayNode = audioContext.createDelay();
    delayNode.delayTime.value = 0.25;
    delayNode.connect(audioContext.destination);
    
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 32768;
    analyser.minDecibels = -70;
    analyser.smoothingTimeConstant = 0;
    mediaSource.connect(analyser);
    analyser.connect(delayNode);
    
    visData = new Uint8Array(analyser.frequencyBinCount);
    
    getId("introduction").classList.add('disabled');
    getId("visualizer").classList.add('disabled');
    getId("selectOverlay").classList.add('disabled');
    setVis("none");
    
    winsize = [window.innerWidth, window.innerHeight];
    if(fullscreen){
        size = [window.innerWidth, window.innerHeight];
    }else{
        size = [window.innerWidth - 8, window.innerHeight - 81];
    }
    getId("visCanvas").width = size[0];
    getId("visCanvas").height = size[1];
    
    requestAnimationFrame(globalFrame);
}

function loadWeirdFiles(event){
    audio.pause();
    currentSong = -1;
    files = fileWeirdInput.files;
    filesAmount = files.length;
    filesLength = 0;
    fileNames = [];
    for(var i = 0; i < filesAmount; i++){
        var fileName = files[i].name.split('.');
        var filePath = '';
        if(files[i].webkitRelativePath){
            filePath = files[i].webkitRelativePath.split('/');
            filePath.pop();
            filePath.shift();
            filePath.join(": ");
            filePath += ': ';
        }
        filesLength++;
        if(supportedFormats.indexOf(fileName[fileName.length - 1]) > -1){
            fileName.pop();
        }
        fileNames.push([fileName.join('.'), i, URL.createObjectURL(files[i]), filePath]);
    }
    listSongs();
    var disabledElements = document.getElementsByClassName('disabled');
    while(disabledElements.length > 0){
        disabledElements[0].classList.remove('disabled');
    }
    if(!smokeEnabled){
        smokeElement.classList.add("disabled");
        smokeScreen1.classList.add("disabled");
        smokeScreen2.classList.add("disabled");
    }
    getId("liveControls").classList.add("disabled");
    
    audioContext = new AudioContext();
    mediaSource = audioContext.createMediaElementSource(audio);
    
    delayNode = audioContext.createDelay();
    delayNode.delayTime.value = 0.25;
    delayNode.connect(audioContext.destination);
    
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 32768;
    analyser.minDecibels = -70;
    analyser.smoothingTimeConstant = 0;
    mediaSource.connect(analyser);
    analyser.connect(delayNode);
    
    visData = new Uint8Array(analyser.frequencyBinCount);
    
    getId("introduction").classList.add('disabled');
    getId("visualizer").classList.add('disabled');
    getId("selectOverlay").classList.add('disabled');
    setVis("none");
    
    winsize = [window.innerWidth, window.innerHeight];
    if(fullscreen){
        size = [window.innerWidth, window.innerHeight];
    }else{
        size = [window.innerWidth - 8, window.innerHeight - 81];
    }
    getId("visCanvas").width = size[0];
    getId("visCanvas").height = size[1];
    
    requestAnimationFrame(globalFrame);
}

var microphoneActive = 0;
var systemAudioActive = 0;
var latencyReduction = 0;

function setLatency(newLatency){
    switch(newLatency){
        case 0: // full fftsize
            latencyReduction = 0;
            analyser.fftSize = 32768;
            analyser.smoothingTimeConstant = 0;
            analyser.maxDecibels = -30;
            analyser.minDecibels = -70;
            visData = new Uint8Array(analyser.frequencyBinCount);
            getId("latencyButton0").style.borderColor = "#0A0";
            getId("latencyButton1").style.borderColor = "#C00";
            getId("latencyButton2").style.borderColor = "#C00";
            break;
        case 1:
            latencyReduction = 1;
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8;
            analyser.maxDecibels = -20;
            analyser.minDecibels = -60;
            visData = new Uint8Array(analyser.frequencyBinCount);
            getId("latencyButton0").style.borderColor = "#C00";
            getId("latencyButton1").style.borderColor = "#0A0";
            getId("latencyButton2").style.borderColor = "#C00";
            break;
        case 2:
            latencyReduction = 2;
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.8;
            analyser.maxDecibels = -20;
            analyser.minDecibels = -60;
            visDataBuffer = new Uint8Array(analyser.frequencyBinCount);
            visData = new Uint8Array(analyser.frequencyBinCount * 2);
            getId("latencyButton0").style.borderColor = "#C00";
            getId("latencyButton1").style.borderColor = "#C00";
            getId("latencyButton2").style.borderColor = "#0C0";
            break;
        default:
            // do nothing?
    }
}

function loadMicrophone(event){
    audio.pause();
    currentSong = -1;

    var disabledElements = document.getElementsByClassName('disabled');
    while(disabledElements.length > 0){
        disabledElements[0].classList.remove('disabled');
    }
    if(!smokeEnabled){
        smokeElement.classList.add("disabled");
        smokeScreen1.classList.add("disabled");
        smokeScreen2.classList.add("disabled");
    }
    getId("nonLiveControls").classList.add("disabled");
    getId("ambienceButton").classList.add("disabled");
    getId("ambienceSpacing").classList.add("disabled");
    getId("currentlyPlaying").innerHTML = "Microphone";
    
    audioContext = new AudioContext();
    
    analyser = audioContext.createAnalyser();
    //analyser.fftSize = 32768;
    analyser.fftSize = 2048;
    latencyReduction = 1;
    analyser.maxDecibels = -20;
    analyser.minDecibels = -60;
    //analyser.smoothingTimeConstant = 0;
    
    visData = new Uint8Array(analyser.frequencyBinCount);
    
    getId("introduction").classList.add('disabled');
    getId("visualizer").classList.add('disabled');
    getId("selectOverlay").classList.add('disabled');
    setVis("none");
    
    winsize = [window.innerWidth, window.innerHeight];
    if(fullscreen){
        size = [window.innerWidth, window.innerHeight];
    }else{
        size = [window.innerWidth - 8, window.innerHeight - 81];
    }
    getId("visCanvas").width = size[0];
    getId("visCanvas").height = size[1];

    navigator.webkitGetUserMedia({audio:true}, function(stream){
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
    }, function(){alert('error');});
    
    microphoneActive = 1;
    
    requestAnimationFrame(globalFrame);
    requestAnimationFrame(function(){
        overrideVis("spikes");
        overrideMod("powSin");
        overrideColor("beta");
    })
    blockSleep();
}

function loadSystemAudio(event){
    audio.pause();
    currentSong = -1;
    
    audioContext = new AudioContext();
    
    analyser = audioContext.createAnalyser();
    //analyser.fftSize = 32768;
    analyser.fftSize = 2048;
    latencyReduction = 1;
    analyser.maxDecibels = -20;
    analyser.minDecibels = -60;
    //analyser.smoothingTimeConstant = 0;
    
    visData = new Uint8Array(analyser.frequencyBinCount);
    
    getId("introduction").classList.add('disabled');
    getId("visualizer").classList.add('disabled');
    getId("selectOverlay").classList.add('disabled');
    setVis("none");
    
    winsize = [window.innerWidth, window.innerHeight];
    if(fullscreen){
        size = [window.innerWidth, window.innerHeight];
    }else{
        size = [window.innerWidth - 8, window.innerHeight - 81];
    }
    getId("visCanvas").width = size[0];
    getId("visCanvas").height = size[1];

    desktopCapturer.getSources({types: ['screen']}).then(async sources => {
        for(const source of sources){
            console.log(source);
            if(source.name === "Entire Screen"){
                try{
                    systemVideo = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            mandatory: {
                                chromeMediaSource: "desktop"
                            }
                        },
                        video: {
                            mandatory: {
                                chromeMediaSource: "desktop"
                            }
                        }
                    });
                    console.log(1);

                    systemVideo.getVideoTracks()[0].enabled = false;

                    //systemAudio = new MediaStream(systemVideo.getAudioTracks());
                    systemAudio = audioContext.createMediaStreamSource(systemVideo);

                    systemAudio.connect(analyser);
                    
                    microphoneActive = 1;
                    
                    var disabledElements = document.getElementsByClassName('disabled');
                    while(disabledElements.length > 0){
                        disabledElements[0].classList.remove('disabled');
                    }
                    getId("introduction").classList.add('disabled');
                    getId("visualizer").classList.add('disabled');
                    getId("selectOverlay").classList.add('disabled');
                    if(!smokeEnabled){
                        smokeElement.classList.add("disabled");
                        smokeScreen1.classList.add("disabled");
                        smokeScreen2.classList.add("disabled");
                    }
                    getId("nonLiveControls").classList.add("disabled");
                    getId("ambienceButton").classList.add("disabled");
                    getId("ambienceSpacing").classList.add("disabled");
                    getId("currentlyPlaying").innerHTML = "System Audio";
                    
                    requestAnimationFrame(globalFrame);
                    requestAnimationFrame(function(){
                        overrideVis("spikes");
                        overrideMod("powSin");
                        overrideColor("beta");
                    });
                    blockSleep();
                }catch(e){
                    alert("Error loading system audio.\n" + e);
                }
                return;
            }
        }
    });

    /*
    navigator.webkitGetUserMedia({audio:true}, function(stream){
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
    }, function(){alert('error');});
    
    microphoneActive = 1;
    
    requestAnimationFrame(globalFrame);
    */
}

var currentSong = -1;

function selectSong(id){
    currentSong = id;
    audio.pause();
    audio.currentTime = 0;
    audio.src = fileNames[id][2];
    blockSleep();
    getId("currentlyPlaying").innerHTML = fileNames[id][1] + ": " + fileNames[id][0];
    document.title = fileNames[id][0] + " - AaronOS Music Player";
    if(webVersion && aosToolsConnected){
        aosTools.sendRequest({
            action: "appwindow:set_caption",
            content: "Music Player - " + fileNames[id][0],
            conversation: "set_caption"
        });
    }
    try{
        document.getElementsByClassName("selected")[0].classList.remove("selected");
    }catch(err){
        // no song is selected
    }
    getId("song" + id).classList.add("selected");

    if(automaticColorCtx){
        var autoColorPassed = 0;
        if(fileInfo[fileNames[id][0]]){
            automaticColor = {
                colorType: fileInfo[fileNames[id][0]].colorType,
                colorArr: fileInfo[fileNames[id][0]].colors
            };
            autoColorPassed = 1;
        }else if(fileInfo['_default_colors']){
            automaticColor = {
                colorType: fileInfo['_default_colors'].colorType,
                colorArr: fileInfo['_default_colors'].colors
            }
            autoColorPassed = 1;
        }else{
            automaticColor = {
                colorType: 'gradient',
                colorArr: [
                    [0, 64, 0],
                    [0, 255, 0]
                ]
            };
            autoColorPassed = 1;
        }
        if(automaticColor.colorArr.length === 0){
            if(fileInfo['_default_colors']){
                automaticColor = {
                    colorType: fileInfo['_default_colors'].colorType,
                    colorArr: fileInfo['_default_colors'].colors
                }
                autoColorPassed = 1;
            }else{
                automaticColor = {
                    colorType: 'gradient',
                    colorArr: [
                        [0, 64, 0],
                        [0, 255, 0]
                    ]
                };
                autoColorPassed = 1;
            }
        }
        if(autoColorPassed){
            if(automaticColor.colorArr.length === 1){
                automaticColorCtx.fillColor = 'rgba(' + automaticColor.colorArr[0][0] + ',' + automaticColor.colorArr[0][1] + ',' + automaticColor.colorArr[0][2] + (automaticColor.colorArr[0][3] || 1) + ')';
                automaticColorCtx.fillRect(0, 0, 512, 0);
            }else{
                var newGradient = automaticColorCtx.createLinearGradient(0, 0, 512, 0);
                if(automaticColor.colorType === "gradient"){
                    for(var i = 0; i < automaticColor.colorArr.length; i++){
                        newGradient.addColorStop(
                            i / (automaticColor.colorArr.length - 1),
                            'rgba(' + automaticColor.colorArr[i][0] + ',' + automaticColor.colorArr[i][1] + ',' + automaticColor.colorArr[i][2] + ',' + (automaticColor.colorArr[i][3] || 1) + ')'
                        );
                    }
                }else if(automaticColor.colorType === "peak"){
                    if(automaticColor.colorArr.length === 2){
                        newGradient.addColorStop(
                            0.85,
                            'rgba(' + automaticColor.colorArr[i][0] + ',' + automaticColor.colorArr[i][1] + ',' + automaticColor.colorArr[i][2] + ',' + (automaticColor.colorArr[i][3] || 1) + ')'
                        );
                    }else{
                        for(var i = 0; i < automaticColor.colorArr.length - 1; i++){
                            newGradient.addColorStop(
                                (i / (automaticColor.colorArr.length - 2)) * 0.85,
                                'rgba(' + automaticColor.colorArr[i][0] + ',' + automaticColor.colorArr[i][1] + ',' + automaticColor.colorArr[i][2] + ',' + (automaticColor.colorArr[i][3] || 1) + ')'
                            );
                        }
                    }
                    newGradient.addColorStop(
                        1,
                        'rgba(' + automaticColor.colorArr[i][0] + ',' + automaticColor.colorArr[i][1] + ',' + automaticColor.colorArr[i][2] + ',' + (automaticColor.colorArr[i][3] || 1) + ')'
                    );
                }
                automaticColorCtx.fillStyle = newGradient;
                automaticColorCtx.fillRect(0, 0, 512, 1);
            }
            automaticColor.resultList = [];
            for(var i = 0; i < 512; i++){
                var rgbaResult = automaticColorCtx.getImageData(i, 0, 1, 1).data;
                automaticColor.resultList.push('rgba(' + rgbaResult[0] + ',' + rgbaResult[1] + ',' + rgbaResult[2] + ',' + rgbaResult[3] + ')');
            }
        }
    }
}

function play(){
    if(!microphoneActive){
        if(currentSong === -1){
            selectSong(0);
        }else{
            audio.play();
            blockSleep();
        }
        if(ambienceWaiting){
            ambienceWaiting = 0;
            clearTimeout(ambienceTimeout);
            getId("currentlyPlaying").innerHTML = fileNames[currentSong][1] + ": " + fileNames[currentSong][0];
        }
        getId("playbutton").innerHTML = "<b>&nbsp;||&nbsp;</b>";
    }
}
function pause(){
    if(!microphoneActive){
        audio.pause();
        unblockSleep();
        getId("playbutton").innerHTML = "&#9658;";
    }
}

function firstPlay(){
    audioDuration = audio.duration;
    play();
}
audio.addEventListener("canplaythrough", firstPlay);

function setProgress(e){
    if(!microphoneActive && currentSong !== -1){
        var timeToSet = e.pageX - 5;
        if(timeToSet < 5){
            timeToSet = 0;
        }
        timeToSet /= size[0];
        timeToSet *= audio.duration;
        audio.currentTime = timeToSet;
        if(ambienceWaiting){
            ambienceWaiting = 0;
            clearTimeout(ambienceTimeout);
            getId("currentlyPlaying").innerHTML = fileNames[currentSong][1] + ": " + fileNames[currentSong][0];
        }
    }
}

function back(){
    if(!microphoneActive){
        if(audio.currentTime < 3){
            currentSong--;
            if(currentSong < 0){
                currentSong = fileNames.length - 1;
            }
            selectSong(currentSong);
        }else{
            audio.currentTime = 0;
            if(ambienceWaiting){
                ambienceWaiting = 0;
                clearTimeout(ambienceTimeout);
                getId("currentlyPlaying").innerHTML = fileNames[currentSong][1] + ": " + fileNames[currentSong][0];
            }
        }
    }
}

var ambienceWaiting = 0;
var ambienceTimeout = null;

function next(){
    if(!microphoneActive){
        if(ambienceMode){
            if(ambienceWaiting){
                ambienceWaiting = 0;
                clearTimeout(ambienceTimeout);
            }
            var nextAmbienceSong = Math.floor(Math.random() * fileNames.length);
            if(fileNames.length !== 1){
                while(nextAmbienceSong === currentSong){
                    nextAmbienceSong = Math.floor(Math.random() * fileNames.length);
                }
            }
            currentSong = nextAmbienceSong;
        }else{
            currentSong++;
            if(currentSong > fileNames.length - 1){
                currentSong = 0;
            }
        }
        selectSong(currentSong);
    }
}

function ambienceNext(){
    if(!microphoneActive){
        if(ambienceWaiting){
            ambienceWaiting = 0;
            clearTimeout(ambienceTimeout);
        }
        var nextAmbienceSong = Math.floor(Math.random() * fileNames.length);
        if(fileNames.length !== 1){
            while(nextAmbienceSong === currentSong){
                nextAmbienceSong = Math.floor(Math.random() * fileNames.length);
            }
        }
        currentSong = nextAmbienceSong;
        selectSong(currentSong);
    }
}

function songEnd(){
    var windowWillClose = checkSelfClose();
    if(!windowWillClose){
        if(ambienceMode){
            var randomTime = Math.floor(Math.random() * 300000) + 1;
            var randomTimeSeconds = Math.floor(randomTime / 1000);
            var randomTimeMinutes = Math.floor(randomTimeSeconds / 60);
            randomTimeSeconds -= randomTimeMinutes * 60;
            getId("currentlyPlaying").innerHTML = "Next song in " + randomTimeMinutes + ":" + randomTimeSeconds;
            ambienceTimeout = setTimeout(ambienceNext, randomTime);
            ambienceWaiting = 1;
            getId("playbutton").innerHTML = "&#9658;";
        }else{
            next();
        }
    }
}

audio.addEventListener("ended", songEnd);

// courtesy Stack Overflow
function shuffleArray(array){
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

function shuffle(){
    if(!microphoneActive){
        audio.pause();
        audio.currentTime = 0;
        currentSong = 0;
        shuffleArray(fileNames);
        listSongs();
        selectSong(0);
    }
}

function refresh(){
    unblockSleep();
    window.location = "?refresh=" + (new Date()).getTime();
}

var ambienceMode = 0;
function toggleAmbience(){
    ambienceMode = Math.abs(ambienceMode - 1);
    if(getId("ambienceButton")){
        getId("ambienceButton").style.borderColor = debugColors[ambienceMode];
    }
    if(ambienceMode && currentSong === -1){
        songEnd();
    }
}

var performanceMode = 0;
function togglePerformance(){
    if(performanceMode){
        if(currVis !== "none"){
            size[0] *= 2;
            size[1] *= 2;
            getId("visCanvas").width = size[0];
            getId("visCanvas").height = size[1];
            getId("visCanvas").style.imageRendering = "";
            getId("smokeCanvas").width = size[0];
            getId("smokeCanvas").height = size[1];
            getId("smokeCanvas").style.imageRendering = "";
            if(getId("performanceButton")){
                getId("performanceButton").style.borderColor = "#C00";
            }
        }
    }else{
        if(currVis !== "none"){
            size[0] /= 2;
            size[1] /= 2;
            getId("visCanvas").width = size[0];
            getId("visCanvas").height = size[1];
            getId("visCanvas").style.imageRendering = "pixelated";
            getId("smokeCanvas").width = size[0];
            getId("smokeCanvas").height = size[1];
            getId("smokeCanvas").style.imageRendering = "pixelated";
            if(getId("performanceButton")){
                getId("performanceButton").style.borderColor = "#0A0";
            }
        }
    }
    performanceMode = Math.abs(performanceMode - 1);
    if(vis[currVis].sizechange){
        vis[currVis].sizechange();
    }
}

var winsize = [window.innerWidth, window.innerHeight];
var size = [window.innerWidth - 8, window.innerHeight - 81];
var fullscreen = 0;
function toggleFullscreen(){
    if(getId("introduction").classList.contains("disabled")){
        if(fullscreen){
            size = [window.innerWidth - 8, window.innerHeight - 81];
            if(performanceMode){
                size[0] /= 2;
                size[1] /= 2;
            }
            getId("visualizer").style.border = "";
            getId("visualizer").style.bottom = "";
            getId("visualizer").style.left = "";
            getId("visualizer").style.width = "";
            getId("visualizer").style.height = "";
            getId("visCanvas").width = size[0];
            getId("visCanvas").height = size[1];
            getId("currentlyPlaying").classList.remove("disabled");
            getId("controls").classList.remove("disabled");
            getId("progressContainer").classList.remove("disabled");
            document.body.style.background = '';
            fullscreen = 0;
            if(currVis !== "none"){
                resizeSmoke();
                if(vis[currVis].sizechange){
                    vis[currVis].sizechange();
                }
            }
            if(transparentMode){
                remote.getCurrentWindow().setIgnoreMouseEvents(false);
            }
        }else{
            size = [window.innerWidth, window.innerHeight];
            if(performanceMode){
                size[0] /= 2;
                size[1] /= 2;
            }
            getId("visualizer").style.border = "none";
            getId("visualizer").style.bottom = "0";
            getId("visualizer").style.left = "0";
            getId("visualizer").style.width = "100%";
            getId("visualizer").style.height = "100%";
            getId("visCanvas").width = size[0];
            getId("visCanvas").height = size[1];
            getId("currentlyPlaying").classList.add("disabled");
            getId("controls").classList.add("disabled");
            getId("progressContainer").classList.add("disabled");
            document.body.style.background = '#000';
            fullscreen = 1;
            if(currVis !== "none"){
                resizeSmoke();
                if(vis[currVis].sizechange){
                    vis[currVis].sizechange();
                }
            }
            if(transparentMode){
                remote.getCurrentWindow().setIgnoreMouseEvents(true);
            }
        }
    }
}

var fps = 0;
var currFPS = "0";
var lastSecond = 0;
var fpsEnabled = 0;
var debugForce = 0;
var debugColors = ["#C00", "#0A0"];
function toggleFPS(){
    debugForce = Math.abs(debugForce - 1);
    if(getId("debugButton")){
        getId("debugButton").style.borderColor = debugColors[debugForce];
    }
}

var canvasElement = getId("visCanvas");
var canvas = canvasElement.getContext("2d");

var smokeElement = getId("smokeCanvas");
var smoke = smokeElement.getContext("2d");

var highFreqRange = 0;
var perfLast = performance.now();
var perfCurrent = perfLast;
var perfTime = 0;
var fpsApproximate = 60;
var fpsCompensation = 1;

function globalFrame(){
    requestAnimationFrame(globalFrame);
    /*
    this.lastFrame = this.currFrame;
    this.currFrame = performance.now();
    this.frametime = this.currFrame - this.lastFrame;
    this.fps = 1000 / this.frametime;
    this.fpsMod = 1 / (this.fps / 60);
    if(this.currFrame > this.lastSecond + 1000){
        this.fpsFinal = this.fpsCount;
        this.fpsCount = 0;
        this.lastSecond = this.currFrame;
    }
    this.fpsCount++;
    */
    perfLast = perfCurrent;
    perfCurrent = performance.now();
    perfTime = perfCurrent - perfLast;
    fpsApproximate = 1000 / perfTime;
    fpsCompensation = 1 / (fpsApproximate / 60);

    // fpsCompensation is a helper for adjusting timing based on the FPS
    // multiply a value by fpsCompensation to adjust it to the current performance.
    // 120fps = 0.5
    // 60fps = 1
    // 30fps = 2

    if(winsize[0] !== window.innerWidth || winsize[1] !== window.innerHeight){
        winsize = [window.innerWidth, window.innerHeight];
        if(fullscreen){
            size = [window.innerWidth, window.innerHeight];
        }else{
            size = [window.innerWidth - 8, window.innerHeight - 81];
        }
        if(performanceMode){
            size[0] /= 2;
            size[1] /= 2;
        }
        getId("visCanvas").width = size[0];
        getId("visCanvas").height = size[1];
        if(currVis !== "none"){
            if(smokeEnabled){
                resizeSmoke();
            }
            if(vis[currVis].sizechange){
                vis[currVis].sizechange();
            }
        }
    }
    if(currVis !== "none"){
        if(latencyReduction !== 2){
            analyser.getByteFrequencyData(visData);
        }else{
            analyser.getByteFrequencyData(visDataBuffer);
        }
        if(microphoneActive){
            var tempArr = [];
            if(latencyReduction === 1){
                for(var i = 0; i < 128; i++){
                    tempArr[i] = visData[i];
                }
                if(performanceMode){
                    for(var j = 0; j < visData.length; j++){
                        visData[j] = tempArr[Math.floor(j / 16)];
                    }
                }else{
                    for(var j = 0; j < visData.length; j++){
                        var approx = Math.floor(j / 16);
                        var p1 = tempArr[approx];
                        var p2 = tempArr[approx + 1];
                        //if(p2 === undefined){
                        //    p2 = p1;
                        //}
                        var u = (j % 16) / 16;
                        visData[j] = ((1 - u) * p1) + (u * p2);
                    }
                }
            }else if(latencyReduction === 2){
                for(var i = 0; i < 64; i++){
                    tempArr[i] = visDataBuffer[i];
                }
                if(performanceMode){
                    for(var j = 0; j < visData.length; j++){
                        visData[j] = tempArr[Math.floor(j / 32)];
                    }
                }else{
                    for(var j = 0; j < visData.length; j++){
                        var approx = Math.floor(j / 32);
                        var p1 = tempArr[approx];
                        var p2 = tempArr[approx + 1];
                        //if(p2 === undefined){
                        //    p2 = p1;
                        //}
                        var u = (j % 32) / 32;
                        visData[j] = ((1 - u) * p1) + (u * p2);
                    }
                }
            }
        }else{
            // if the audio's volume is lowered, the visualizer can't hear it
            // attempt to artificially bring the volume back up to full
            // very mixed results
            if(audio.volume < 0.9){
                var gainFactor = 0.9 - audio.volume + 1;
                for(var i = 0; i < visData.length; i++){
                    visData[i] = Math.floor(visData[i] * gainFactor);
                }
            }
        }
        if(highFreqRange){
            var tempsize = size[0];
            for(var i = 0; i < tempsize; i++){
                visData[i] = Math.max(visData[i * 2], visData[i * 2 + 1]);
            }
        }
        if(smokeEnabled){
            smokeFrame();
        }
        // if debug enabled, store current data values
        var debugEnabled = debugForce || (window.location.href.indexOf("debug") > -1);
        
        if(debugEnabled && currMod){
            var oldVisData = [];
            if(latencyReduction === 1){
                for(var i = 0; i < 1024; i++){
                    oldVisData[i] = visData[Math.floor(i / 16) * 16];
                }
            }else if(latencyReduction === 2){
                for(var i = 0; i < 1024; i++){
                    oldVisData[i] = visData[Math.floor(i / 32) * 32];
                }
            }else{
                for(var i = 0; i < 1024; i++){
                    oldVisData[i] = visData[i];
                }
            }
        }
        
        // if mod is selected, modify the data values
        if(currMod){
            mods[currMod].mod();
        }
        
        // do the visualizer
        vis[currVis].frame();
        // fps
        fps++;
        var currSecond = (new Date().getSeconds());
        if(currSecond !== lastSecond){
            currFPS = fps;
            fps = 0;
            lastSecond = currSecond;
        }
        if(debugEnabled || debugForce){
            canvas.font = '12px aosProFont, monospace';
            canvas.fillStyle = 'rgba(0, 0, 0, 0.5)';
            canvas.fillRect(1, 1, 14, 9);
            canvas.fillStyle = '#FFF';
            canvas.fillText(currFPS, 2.5, 9);
            // extra debug drawing
            if(currMod){
                canvas.strokeStyle = "#FFF";
                canvas.lineWidth = 1;
                var debugLeftBound = size[0] - 700;
                canvas.strokeRect(size[0] - 700.5, 10.5, 342, 255);
                // debug is supersampled -- rgb is 1, 2, 3
                canvas.fillStyle = '#000';
                for(var i = 0; i < 1023; i += 3){
                    canvas.fillRect(debugLeftBound + (i / 3), 10 + (255 - Math.max(oldVisData[i], oldVisData[i + 1], oldVisData[i + 2])), 1, Math.max(oldVisData[i], oldVisData[i + 1], oldVisData[i + 2]));
                }
                canvas.globalCompositeOperation = 'screen';
                canvas.fillStyle = '#F00';
                for(var i = 0; i < 1024; i += 3){
                    canvas.fillRect(debugLeftBound + (i / 3), 10 + (255 - oldVisData[i]), 1, oldVisData[i]);
                }
                canvas.fillStyle = '#0F0';
                for(var i = 1; i < 1024; i += 3){
                    canvas.fillRect(debugLeftBound + ((i - 1) / 3), 10 + (255 - oldVisData[i]), 1, oldVisData[i]);
                }
                canvas.fillStyle = '#00F';
                for(var i = 2; i < 1024; i += 3){
                    canvas.fillRect(debugLeftBound + ((i - 2) / 3), 10 + (255 - oldVisData[i]), 1, oldVisData[i]);
                }
                canvas.globalCompositeOperation = 'normal';
            }
            canvas.strokeStyle = "#FFF";
            canvas.lineWidth = 1;
            var debugLeftBound = size[0] - 352;
            canvas.strokeRect(size[0] - 352.5, 10.5, 342, 255);
            // debug is supersampled -- rgb is 1, 2, 3
            canvas.fillStyle = '#000';
            for(var i = 0; i < 1023; i += 3){
                canvas.fillRect(debugLeftBound + (i / 3), 10 + (255 - Math.max(visData[i], visData[i + 1], visData[i + 2])), 1, Math.max(visData[i], visData[i + 1], visData[i + 2]));
            }
            canvas.globalCompositeOperation = 'screen';
            canvas.fillStyle = '#F00';
            for(var i = 0; i < 1024; i += 3){
                canvas.fillRect(debugLeftBound + (i / 3), 10 + (255 - visData[i]), 1, visData[i]);
            }
            canvas.fillStyle = '#0F0';
            for(var i = 1; i < 1024; i += 3){
                canvas.fillRect(debugLeftBound + ((i - 1) / 3), 10 + (255 - visData[i]), 1, visData[i]);
            }
            canvas.fillStyle = '#00F';
            for(var i = 2; i < 1024; i += 3){
                canvas.fillRect(debugLeftBound + ((i - 2) / 3), 10 + (255 - visData[i]), 1, visData[i]);
            }
            canvas.globalCompositeOperation = 'normal';
        }
    }
}

var currMod = null;
var mods = {
    powSin: {
        name: "Power Sine",
        image: 'mods/powSin.png',
        mod: function(){
            for(var i = 0; i < 1024; i++){
                visData[i] = Math.sin((Math.pow(visData[i], 2) / 255) / 255 * (Math.PI / 2)) * 255;
            }
        },
        test: function(input){
            //return Math.sin(input / 255 * Math.PI / 6) * 255;
            return Math.sin((Math.pow(input, 2) / 255) / 255 * (Math.PI / 2)) * 255;
        }
    },
    ogive: {
        name: "Bell",
        image: 'mods/ogive.png',
        mod: function(){
            for(var i = 0; i < 1024; i++){
                visData[i] = visData[i] * ((510 - visData[i]) / 255);
            }
        },
        test: function(input){
            return input * ((510 - input) / 255);
        }
    },
    pow2: {
        name: "Power (2)",
        image: 'mods/pow2.png',
        mod: function(){
            for(var i = 0; i < 1024; i++){
                visData[i] = Math.pow(visData[i], 2) / 255;
            }
        },
        test: function(input){
            return Math.pow(input, 2) / 255;
        }
    },
    sqrt: {
        name: "Square Root",
        image: 'mods/sqrt.png',
        mod: function(){
            for(var i = 0; i < 1024; i++){
                visData[i] = Math.sqrt(visData[i]) * this.sqrt255;
            }
        },
        test: function(input){
            return Math.sqrt(input) * this.sqrt255;
        },
        sqrt255: Math.sqrt(255)
    }
};
function selectMod(newMod){
    if(mods[newMod]){
        currMod = newMod;
    }else{
        currMod = null;
    }
}

var automaticColorCtx = null;
var automaticColor = {
    colorType: 'peak',
    colorArr: ['#005500', '#00FF00', '#FF0000'],
    resultList: new Array(512)
}

var colors = {
    bluegreenred: {
        name: "Default",
        image: "colors/default.png",
        func: function(amount){
            return 'rgba(' +
                ((amount > 200) * ((amount - 200) * 4.6)) + ',' +
                (amount - ((amount > 220) * ((amount - 220) * 7.2))) + ',' +
                (255 - amount) + ',' +
                (amount / 255) + ')';
        }
    },
    beta: {
        name: "Default Solid",
        image: "colors/defaultSolid.png",
        func: function(amount){
            return 'rgb(' +
                ((amount > 200) * ((amount - 200) * 4.6)) + ',' +
                (amount - ((amount > 220) * ((amount - 220) * 7.2))) + ',' +
                (255 - amount) + ')';
        }
    },
    defStatic: {
        name: "Default Static",
        image: "colors/defaultStatic.png",
        func: function(amount, position){
            if(typeof position === "number"){
                return 'rgb(0,' + position + ',' + (255 - position) + ')';
            }else{
                return 'rgb(0,' + amount + ',' + (255 - amount) + ')';
            }
        }
    },
    alpha: {
        name: "Alpha",
        image: "colors/alpha.png",
        func: function(amount){
            return 'rgb(0,' + amount + ',' + (255 - amount) + ')';
        }
    },
    intensityGlow: {
        name: "Intensity",
        image: "colors/intensity.png",
        func: function(amount){
            return 'rgba(' +
                ((amount >= 127) * 255 + (amount < 127) * (amount * 2)) + ',' +
                ((amount < 127) * 255 + (amount >= 127) * ((254.5 - amount) * 2)) + ',' +
                '0,' + (amount / 255) + ')';
        }
    },
    intensity: {
        name: "Intensity Solid",
        image: "colors/intensitySolid.png",
        func: function(amount){
            return 'rgb(' +
                ((amount >= 127) * 255 + (amount < 127) * (amount * 2)) + ',' +
                ((amount < 127) * 255 + (amount >= 127) * ((254.5 - amount) * 2)) + ',' +
                '0)';
        }
    },
    intensityStatic: {
        name: "Intensity Static",
        image: "colors/intensityStatic.png",
        func: function(amount, position){
            if(typeof position === "number"){
                return 'rgb(' +
                    ((position >= 127) * 255 + (position < 127) * (position * 2)) + ',' +
                    ((position < 127) * 255 + (position >= 127) * ((254.5 - position) * 2)) + ',' +
                    '0)';
            }else{
                return 'rgb(' +
                    ((amount >= 127) * 255 + (amount < 127) * (amount * 2)) + ',' +
                    ((amount < 127) * 255 + (amount >= 127) * ((254.5 - amount) * 2)) + ',' +
                    '0)';
            }
        }
    },
    autoFileInfo: {
        name: "Automatic (File Info)",
        image: "colors/triColor.png",
        func: function(amount){
            return automaticColor.resultList[Math.round(amount * 2)];
        }
    },
    'SEPARATOR_THEMES" disabled="': {
        name: "---------------",
        func: function(){
            return '#000';
        }
    },
    fire: {
        name: "Fire",
        image: "colors/fire.png",
        func: function(amount){
            //return 'rgba(' +
            //    amount + ',' +
            //    ((amount > 200) * amount * 0.25 + (amount > 127) * amount * 0.5 + (amount <= 127) * amount * 0.1) + ',0, ' + (amount / 255) + ')';
            return 'rgba(255,' +
                (Math.pow(amount, 2) / 255) + ',0,' +
                (amount / 255) + ')';
        }
    },
    rainbowStatic: {
        name: "Rainbow",
        image: "colors/rainbowStatic.png",
        func: function(amount, position){
            if(typeof position === "number"){
                return 'hsl(' +
                    (position * this.multiplier) +
                    ',100%,50%)';
            }else{
                return 'hsl(' +
                    (amount * this.multiplier) +
                    ',100%,50%)';
            }
        },
        multiplier: 360 / 255
    },
    rainbowActive: {
        name: "Rainbow Active",
        image: "colors/rainbowActive.png",
        func: function(amount, position){
            if(typeof position === "number"){
                return 'hsla(' +
                    (position * this.multiplier) +
                    ',100%,50%,' +
                    (amount / this.alphaDivisor + 0.25) + ')';
            }else{
                return 'hsla(' +
                    (amount * this.multiplier) +
                    ',100%,50%,' +
                    (amount / this.alphaDivisor + 0.25) + ')';
            }
        },
        multiplier: 360 / 255,
        alphaDivisor: 255 * (4/3)
    },
    queen: {
        name: "Queen",
        image: "colors/queen.png",
        func: function(amount){
            return 'rgba(' +
                (amount * amount / 510 + 127) + ',' +
                ((amount > 127) * ((amount - 127) * 1.6)) + ',' +
                (255 - amount) + ',' +
                (amount / 255) + ')';
        }
    },
    queenSolid: {
        name: "Queen Solid",
        image: "colors/queenSolid.png",
        func: function(amount){
            return 'rgb(' +
                (amount * amount / 510 + 127) + ',' +
                ((amount > 127) * ((amount - 127) * 1.6)) + ',' +
                (255 - amount) + ')';
        }
    },
    queenStatic: {
        name: "Queen Static",
        image: "colors/queenStatic.png",
        func: function(amount, position){
            if(typeof position === "number"){
                return 'rgb(' +
                    (position * position / 510 + 127) + ',' +
                    ((position > 127) * ((position - 127) * 1.6)) + ',' +
                    (255 - position) + ')';
            }else{
                return 'rgb(' +
                    (amount * amount / 510 + 127) + ',' +
                    ((amount > 127) * ((amount - 127) * 1.6)) + ',' +
                    (255 - amount) + ')';
            }
        },
        sqrt127: Math.sqrt(127)
    },
    prideGlow: {
        name: "Pride",
        image: "colors/pride.png",
        func: function(amount){
            /*return 'rgba(' +
                (
                    (amount < 95) * 255 +
                    (amount >= 95 && amount < 159) * (159 - amount) * this.divide255by64 +
                    (amount >= 207) * ((207 - amount) * -1) * this.divide255by96
                ) + ',' +
                (
                    (amount < 95) * amount * this.divide255by96 +
                    (amount >= 95 && amount < 159) * 255 +
                    (amount >= 159 && amount < 207) * (207 - amount) * this.divide255by48
                ) + ',' +
                (
                    (amount >= 159 && amount < 207) * ((159 - amount) * -1) * this.divide255by48 +
                    (amount >= 207) * 255
                ) + ',' + (amount / 255) + ')';
            */
        return 'hsla(' + amount + ',100%,50%,' + (amount / 255) + ')';
        },
        divide255by96: 255 / 96,
        divide255by64: 255 / 64,
        divide255by48: 255 / 48
    },
    pride: {
        name: "Pride Solid",
        image: "colors/prideSolid.png",
        func: function(amount){
            /*return 'rgb(' +
                (
                    (amount < 95) * 255 +
                    (amount >= 95 && amount < 159) * (159 - amount) * this.divide255by64 +
                    (amount >= 207) * ((207 - amount) * -1) * this.divide255by96
                ) + ',' +
                (
                    (amount < 95) * amount * this.divide255by96 +
                    (amount >= 95 && amount < 159) * 255 +
                    (amount >= 159 && amount < 207) * (207 - amount) * this.divide255by48
                ) + ',' +
                (
                    (amount >= 159 && amount < 207) * ((159 - amount) * -1) * this.divide255by48 +
                    (amount >= 207) * 255
                ) + ')';*/
            return 'hsl(' + amount + ',100%,50%)';
        },
        divide255by96: 255 / 96,
        divide255by64: 255 / 64,
        divide255by48: 255 / 48
    },
    prideStatic: {
        name: "Pride Static",
        image: "colors/prideStatic.png",
        func: function(amount, position){
            if(typeof position === "number"){
                return 'hsl(' + position + ',100%,50%)';
            }else{
                return 'hsl(' + amount + ',100%,50%)';
            }
        }
    },
    prideBlocky: {
        name: "Pride Blocky",
        image: "colors/prideBlocky.png",
        func: function(amount, position){
            if(typeof position === "number"){
                var numOfCols = this.prideColors.length;
                var selCol = Math.floor(position / 255 * numOfCols);
                if(selCol < 0){ selCol = 0; }
                if(selCol > numOfCols - 1){ selCol = numOfCols; }
                return 'hsl(' + this.prideColors[selCol] + ',100%,50%)';
            }else{
                var numOfCols = this.prideColors.length;
                var selCol = Math.floor(amount/ 255 * numOfCols);
                if(selCol < 0){ selCol = 0; }
                if(selCol > numOfCols - 1){ selCol = numOfCols; }
                return 'hsl(' + this.prideColors[selCol] + ',100%,50%)';
            }
        },
        prideColors: [0, 33, 55, 110, 175, 235, 265]
    },
    'SEPARATOR_GLOWS" disabled="': {
        name: "---------------",
        func: function(){
            return '#000';
        }
    },
    whiteglow: {
        name: "White Glow",
        image: "colors/whiteGlow.png",
        func: function(amount){
            return 'rgba(255, 255, 255, ' + (amount / 255) + ')';
        }
    },
    redglow: {
        name: "Red Glow",
        image: "colors/redGlow.png",
        func: function(amount){
            return 'rgba(255,0,0,' + (amount / 255) + ')';
        }
    },
    greenglow: {
        name: "Green Glow",
        image: "colors/greenGlow.png",
        func: function(amount){
            return 'rgba(0,255,0,' + (amount / 255) + ')';
        }
    },
    blueglow: {
        name: "Blue Glow",
        image: "colors/blueGlow.png",
        func: function(amount){
            return 'rgba(0,0,255,' + (amount / 255) + ')';
        }
    },
    electricglow: {
        name: "Electric Glow",
        image: "colors/electricGlow.png",
        func: function(amount){
            return 'rgba(0,255,255,' + (amount / 255) + ')';
        }
    },
    indigoglow: {
        name: "Indigo Glow",
        image: "colors/indigoGlow.png",
        func: function(amount){
            return 'rgba(75, 0, 130, ' + (amount / 255) + ')';
        }
    },
    'SEPARATOR_SOLID_COLORS" disabled="': {
        name: "---------------",
        func: function(){
            return '#000';
        }
    },
    white: {
        name: "Solid White",
        image: "colors/solidWhite.png",
        func: function(amount){
            return '#FFF';
        }
    },
    red: {
        name: "Solid Red",
        image: "colors/solidRed.png",
        func: function(amount){
            return '#A00';
        }
    },
    green: {
        name: "Solid Green",
        image: "colors/solidGreen.png",
        func: function(amount){
            return '#0A0';
        }
    },
    blue: {
        name: "Solid Blue",
        image: "colors/solidBlue.png",
        func: function(amount){
            return '#00A';
        }
    },
    electric: {
        name: "Solid Electric",
        image: "colors/solidElectric.png",
        func: function(amount){
            return '#0FF';
        }
    },
    indigo: {
        name: "Solid Indigo",
        image: "colors/solidIndigo.png",
        func: function(amount){
            return '#4B0082';
        }
    },
    'SEPARATOR_TECHNICAL_COLORS" disabled="': {
        name: "---------------",
        func: function(){
            return '#000';
        }
    },
    rgbsequence: {
        name: "RGB (Sequence)",
        image: "colors/triColor.png",
        lastPosition: -1,
        sequence: -1,
        func: function(amount, position){
            if(position > this.lastPosition){
                this.lastPosition = position;
                this.sequence++;
            }else{
                this.lastPosition = -1;
                this.sequence = 0;
            }
            return 'hsl(' + (this.sequence % 3 * 120) + ', 100%, ' + (amount / 5.12) + '%)';
        }
    },
    rgbsequencesolid: {
        name: "RGB (Sequence) Solid",
        image: "colors/triColor.png",
        lastPosition: -1,
        sequence: -1,
        func: function(amount, position){
            if(position > this.lastPosition){
                this.lastPosition = position;
                this.sequence++;
            }else{
                this.lastPosition = -1;
                this.sequence = 0;
            }
            return 'hsl(' + (this.sequence % 3 * 120) + ', 100%, 50%)';
        }
    },
    rgbMath: {
        name: 'RGB (Math)',
        image: "colors/tricolor.png",
        func: function(amount, position){
            return 'hsl(' + (position * this.multiplier % 3 * 120) + ', 100%, ' + (amount / 5.12) + '%)';
        },
        multiplier: 1024 / 256
    },
    rgbMathSolid: {
        name: 'RGB (Math) Solid',
        image: "colors/tricolor.png",
        func: function(amount, position){
            return 'hsl(' + (position * this.multiplier % 3 * 120) + ', 100%, 50%)';
        },
        multiplier: 1024 / 256
    }
}

var currColor = "bluegreenred";
function setColor(newcolor){
    //getColor = (colors[newcolor] || colors.bgr).func;
    if(colors[newcolor]){
        currColor = newcolor;
    }else{
        currColor = "redgreenblue";
    }
    progressBar.style.outline = "2px solid " + getColor(255);
}
function getColor(power, position){
    return colors[currColor].func(power, position);
}
progressBar.style.outline = "2px solid " + getColor(255);

function setVis(newvis){
    if(currVis){
        vis[currVis].stop();
    }
    if(vis[newvis]){
        currVis = newvis;
    }else{
        currVis = "none";
    }
    if(smokeEnabled){
        resizeSmoke();
    }
    vis[currVis].start();
}

var currVis = null;
var vis = {
    none: {
        name: "Song List",
        start: function(){
            getId("visualizer").classList.add("disabled");
            getId("songList").classList.remove("disabled");
            //analyser.disconnect(delayNode);
            //mediaSource.disconnect(analyser);
            //mediaSource.connect(delayNode);
        },
        frame: function(){
            
        },
        stop: function(){
            getId("visualizer").classList.remove("disabled");
            getId("songList").classList.add("disabled");
            //mediaSource.disconnect(delayNode);
            //mediaSource.connect(analyser);
            //analyser.connect(delayNode);
        }
    },
    'SEPARATOR_BARS" disabled="': {
        name: 'Bars',
        start: function(){

        },
        frame: function(){

        },
        stop: function(){

        }
    },
    monstercat: {
        name: "Monstercat",
        image: "visualizers/monstercat.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var left = size[0] * 0.1;
            var maxWidth = size[0] * 0.8;
            var barWidth = maxWidth / 96;
            var barSpacing = maxWidth / 64;
            var maxHeight = size[1] * 0.5 - size[1] * 0.2;
            
            var monstercatGradient = canvas.createLinearGradient(0, Math.round(size[1] / 2) + 4, 0, size[1]);
            monstercatGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)'); // 0.8
            monstercatGradient.addColorStop(0.025, 'rgba(0, 0, 0, 0.9)'); // 0.9
            monstercatGradient.addColorStop(0.1, 'rgba(0, 0, 0, 1)');// 1
            
            for(var i = 0; i < 64; i++){
                var strength = 0;
                for(var j = 0; j < 16; j++){
                    //strength = Math.max(visData[i * 16 + j], strength);
                    //strength += visData[i * 16 + j];
                    //strength += Math.pow(visData[i * 16 + j], 2) / 255;
                    strength += Math.sqrt(visData[i * 16 + j]) * this.sqrt255;
                }
                strength = Math.round(strength / 16);
                
                var fillColor = getColor(strength, i * 4);
                canvas.fillStyle = fillColor;
                canvas.fillRect(
                    Math.round(left + i * barSpacing),
                    Math.floor(size[1] / 2) - Math.round(strength / 255 * maxHeight),
                    Math.round(barWidth),
                    Math.round(strength / 255 * maxHeight + 5)
                );
                //canvas.fillStyle = "#000";
                if(strength > 10){
                    canvas.fillRect(
                        Math.round(left + i * barSpacing),
                        Math.floor(size[1] / 2) + 4,
                        Math.round(barWidth),
                        Math.round(10 / 255 * maxHeight + 4)
                    );
                    canvas.fillRect(
                        Math.round(left + i * barSpacing - 1),
                        Math.floor(size[1] / 2) + 4 + (10 / 255 * maxHeight) + 4,
                        Math.round(barWidth + 2),
                        Math.round((strength - 10) / 255 * maxHeight)
                    );
                }else{
                    canvas.fillRect(
                        Math.round(left + i * barSpacing),
                        Math.floor(size[1] / 2) + 4,
                        Math.round(barWidth),
                        Math.round(strength / 255 * maxHeight + 4)
                    );
                }
                if(smokeEnabled){
                    smoke.fillStyle = fillColor;
                    smoke.fillRect(
                        Math.round(left + i * barSpacing),
                        Math.floor(size[1] / 2) - Math.round(strength / 255 * maxHeight),
                        Math.round(barWidth),
                        Math.round((strength / 255 * maxHeight + 5) * 2)
                    );
                }
            }

            canvas.fillStyle = monstercatGradient;
            canvas.fillRect(0, Math.round(size[1] / 2) + 4, size[0], Math.round(size[1] / 2) - 4);

            //updateSmoke(left, size[1] * 0.2, maxWidth, size[1] * 0.3 + 10);
            canvas.fillStyle = '#FFF';
            canvas.font = (size[1] * 0.25) + 'px aosProFont, sans-serif';
            if(!microphoneActive){
                canvas.fillText((fileNames[currentSong] || ["No Song"])[0].toUpperCase(), Math.round(left) + 0.5, size[1] * 0.75, Math.floor(maxWidth));
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    obelisks: {
        name: "Obelisks",
        image: "visualizers/obelisks.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var left = size[0] * 0.1;
            var maxWidth = size[0] * 0.8;
            var barWidth = maxWidth / 96;
            var barSpacing = maxWidth / 64;
            var maxHeight = size[1] * 0.5 - size[1] * 0.2;

            var monstercatGradient = canvas.createLinearGradient(0, Math.round(size[1] / 2) + 4, 0, size[1]);
            monstercatGradient.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
            monstercatGradient.addColorStop(0.1, 'rgba(0, 0, 0, 1)');
            canvas.fillStyle = monstercatGradient;
            canvas.fillRect(0, Math.round(size[1] / 2) + 4, size[0], Math.round(size[1] / 2) - 4);

            for(var i = 0; i < 64; i++){
                var strength = 0;
                for(var j = 0; j < 16; j++){
                    //strength = Math.max(visData[i * 16 + j], strength);
                    //strength += visData[i * 16 + j];
                    //strength += Math.pow(visData[i * 16 + j], 2) / 255;
                    strength += Math.sqrt(visData[i * 16 + j]) * this.sqrt255;
                }
                strength = Math.round(strength / 16);
                
                smoke.fillStyle = getColor(strength, i * 4);
                smoke.fillRect(
                    Math.round(left + i * barSpacing),
                    Math.floor(size[1] / 2) - Math.round(strength / 255 * maxHeight),
                    Math.round(barWidth),
                    Math.round((strength / 255 * maxHeight + 5) * 2)
                );
                canvas.fillStyle = "rgba(0, 0, 0, 0.85)";
                canvas.fillRect(
                    Math.round(left + i * barSpacing),
                    Math.floor(size[1] / 2) - Math.round(strength / 255 * maxHeight),
                    Math.round(barWidth),
                    Math.round((strength / 255 * maxHeight + 5) * 2)
                );
                canvas.fillStyle = "rgba(0, 0, 0, 0.5)";
                canvas.fillRect(
                    Math.round(left + i * barSpacing) + 1,
                    Math.floor(size[1] / 2) - Math.round(strength / 255 * maxHeight) + 1,
                    Math.round(barWidth) - 2,
                    Math.round((strength / 255 * maxHeight + 5) * 2) - 2
                )
                canvas.fillStyle = "#000";
                if(strength > 10){
                    canvas.fillRect(
                        Math.round(left + i * barSpacing),
                        Math.floor(size[1] / 2) + 4,
                        Math.round(barWidth),
                        Math.round(10 / 255 * maxHeight + 4)
                    );
                    canvas.fillRect(
                        Math.round(left + i * barSpacing - 1),
                        Math.floor(size[1] / 2) + 4 + (10 / 255 * maxHeight) + 4,
                        Math.round(barWidth + 2),
                        Math.round((strength - 10) / 255 * maxHeight)
                    );
                }else{
                    canvas.fillRect(
                        Math.round(left + i * barSpacing),
                        Math.floor(size[1] / 2) + 4,
                        Math.round(barWidth),
                        Math.round(strength / 255 * maxHeight + 4)
                    );
                }
            }
            //updateSmoke(left, size[1] * 0.2, maxWidth, size[1] * 0.3 + 10);
            canvas.fillStyle = '#FFF';
            canvas.font = (size[1] * 0.25) + 'px aosProFont, sans-serif';
            if(!microphoneActive){
                canvas.fillText((fileNames[currentSong] || ["No Song"])[0].toUpperCase(), Math.round(left) + 0.5, size[1] * 0.75, Math.floor(maxWidth));
            }
            if(!smokeEnabled){
                canvas.font = "12px aosProFont, Courier, monospace";
                canvas.fillText("Enable Smoke for this visualizer.", Math.round(left) + 0.5, size[1] * 0.25, Math.floor(maxWidth));
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    curvedAudioVision: {
        name: "Curved Lines",
        image: "visualizers/curvedLines_av.png",
        start: function(){

        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            canvas.lineCap = "round";
            canvas.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
            smoke.lineCap = "round";
            smoke.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
            var xdist = size[0] / (this.lineCount + 2) / 2;
            var ydist = size[1] / (this.lineCount + 2) / 2;
            xdist = Math.min(xdist, ydist);
            var datastep = 1024 / this.lineCount;
            var colorstep = 255 / this.lineCount;
            var center = size[1] / 2;
            for(var i = 0; i < this.lineCount; i++){
                var pos = Math.floor((i + 1) * xdist);
                var enddata = (i + 1) * datastep;
                var strength = 0;
                var samples = 0;
                for(var j = Math.round(i * datastep); j < enddata; j++){
                    //if(visData[j] > 127){
                        strength += Math.sqrt(visData[j]) * this.sqrt255;
                        //strength += Math.pow(visData[j], 2) / 255;
                        //strength += visData[j];
                        //strength += Math.pow(visData[j] * 1.5, 2) / 255;
                        //strength = Math.max(strength, visData[j]);
                        samples++;
                    //}else{
                    //    strength += Math.sqrt(visData[j]) * this.sqrt255;
                        //strength += Math.pow(visData[j], 2) / 255;
                        //strength += visData[j];
                        //strength = Math.max(strength, visData[j]);
                    //    samples++;
                    //}
                }
                strength /= samples;
                //if(strength > 255){
                //    strength = 255;
                //}
                canvas.strokeStyle = getColor(strength, i * colorstep);
                smoke.strokeStyle = getColor(strength, i * colorstep);

                var circlePoints = [
                    {x: xdist * this.lineCount, y: 0},
                    {x: xdist * this.lineCount, y: 2 * xdist * this.lineCount},
                    {x: xdist * this.lineCount + (xdist * (i + 1)), y: xdist * this.lineCount}
                ]
                var currCircle = this.circleFromThreePoints(...circlePoints);
                var tri = [
                    Math.sqrt(
                        Math.pow(
                            circlePoints[2].x -
                            circlePoints[0].x
                        , 2) + 
                        Math.pow(
                            circlePoints[2].y - 
                            circlePoints[0].y
                        , 2)
                    ),
                    currCircle.r,
                    currCircle.r
                ];
                // (b2 + c2 − a2) / 2bc
                var angle = Math.acos(this.deg2rad((tri[1]*tri[1] + tri[2]*tri[2] - tri[0]*tri[0]) / (2 * tri[1] * tri[2])));
                canvas.beginPath();
                canvas.arc(
                    currCircle.x + (size[0] - xdist * this.lineCount * 2) / 2,
                    currCircle.y + (size[1] / 2 - xdist * this.lineCount),
                    currCircle.r,
                    ((angle - this.deg2rad(Math.pow((this.lineCount - i - 1) * 1.83, 1.61))) * -1) * (strength / 255),
                    ((angle - this.deg2rad(Math.pow((this.lineCount - i - 1) * 1.83, 1.61)))) * (strength / 255)
                );
                canvas.stroke();
                if(smokeEnabled){
                    smoke.beginPath();
                    smoke.arc(
                        currCircle.x + (size[0] - xdist * this.lineCount * 2) / 2,
                        currCircle.y + (size[1] / 2 - xdist * this.lineCount),
                        currCircle.r,
                        ((angle - this.deg2rad(Math.pow((this.lineCount - i - 1) * 1.83, 1.61))) * -1) * (strength / 255),
                        ((angle - this.deg2rad(Math.pow((this.lineCount - i - 1) * 1.83, 1.61)))) * (strength / 255)
                    );
                    smoke.stroke();
                }

                circlePoints[0].x *= -1;
                circlePoints[1].x *= -1;
                circlePoints[2].x *= -1;
                currCircle = this.circleFromThreePoints(...circlePoints);
                canvas.beginPath();
                canvas.arc(
                    currCircle.x + (size[0] / 2 + xdist * this.lineCount),
                    currCircle.y + (size[1] / 2 - xdist * this.lineCount),
                    currCircle.r,
                    ((angle - this.deg2rad(Math.pow((this.lineCount - i - 1) * 1.83, 1.61))) * -1) * (strength / 255) + this.deg2rad(180),
                    ((angle - this.deg2rad(Math.pow((this.lineCount - i - 1) * 1.83, 1.61)))) * (strength / 255) + this.deg2rad(180)
                );
                canvas.stroke();
                if(smokeEnabled){
                    smoke.beginPath();
                    smoke.arc(
                        currCircle.x + (size[0] / 2 + xdist * this.lineCount),
                        currCircle.y + (size[1] / 2 - xdist * this.lineCount),
                        currCircle.r,
                        ((angle - this.deg2rad(Math.pow((this.lineCount - i - 1) * 1.83, 1.61))) * -1) * (strength / 255) + this.deg2rad(180),
                        ((angle - this.deg2rad(Math.pow((this.lineCount - i - 1) * 1.83, 1.61)))) * (strength / 255) + this.deg2rad(180)
                    );
                    smoke.stroke();
                }
            }
        },
        stop: function(){
            canvas.lineCap = "square";
            canvas.lineWidth = 1;
            smoke.lineCap = "square";
            smoke.lineWidth = 1;
        },
        sizechange: function(){

        },
        lineWidth: 6,
        lineCount: 9,
        sqrt255: Math.sqrt(255),
        deg2rad: function(degrees){
            return degrees * this.piBy180;
        },
        piBy180: Math.PI / 180,
        circleFromThreePoints: function(p1, p2, p3) { // from Circle.js

            var x1 = p1.x;
            var y1 = p1.y;
            var x2 = p2.x;
            var y2 = p2.y;
            var x3 = p3.x;
            var y3 = p3.y;
            
            var a = x1 * (y2 - y3) - y1 * (x2 - x3) + x2 * y3 - x3 * y2;
            
            var b = (x1 * x1 + y1 * y1) * (y3 - y2) 
                    + (x2 * x2 + y2 * y2) * (y1 - y3)
                    + (x3 * x3 + y3 * y3) * (y2 - y1);
            
            var c = (x1 * x1 + y1 * y1) * (x2 - x3) 
                    + (x2 * x2 + y2 * y2) * (x3 - x1) 
                    + (x3 * x3 + y3 * y3) * (x1 - x2);
            
            var x = -b / (2 * a);
            var y = -c / (2 * a);
            
            return {
                x: x,
                y: y,
                r: Math.hypot(x - x1, y - y1)
            };
        }
    },
    centeredAudioVision: {
        name: "Centered Lines",
        image: "visualizers/centeredLines_av.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            canvas.lineCap = "round";
            canvas.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
            smoke.lineCap = "round";
            smoke.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
            var xdist = size[0] / (this.lineCount + 2);
            var datastep = 1024 / this.lineCount;
            var colorstep = 255 / this.lineCount;
            var center = size[1] / 2;
            for(var i = 0; i < this.lineCount; i++){
                var pos = Math.floor((i + 1) * xdist);
                var enddata = (i + 1) * datastep;
                var strength = 0;
                var samples = 0;
                for(var j = Math.round(i * datastep); j < enddata; j++){
                    //if(visData[j] > 127){
                        strength += Math.sqrt(visData[j]) * this.sqrt255;
                        //strength += Math.pow(visData[j], 2) / 255;
                        //strength += visData[j];
                        //strength += Math.pow(visData[j] * 1.5, 2) / 255;
                        //strength = Math.max(strength, visData[j]);
                        samples++;
                    //}else{
                    //    strength += Math.sqrt(visData[j]) * this.sqrt255;
                        //strength += Math.pow(visData[j], 2) / 255;
                        //strength += visData[j];
                        //strength = Math.max(strength, visData[j]);
                    //    samples++;
                    //}
                }
                strength /= samples;
                //if(strength > 255){
                //    strength = 255;
                //}
                canvas.strokeStyle = getColor(strength, i * colorstep);
                smoke.strokeStyle = getColor(strength, i * colorstep);
                
                canvas.beginPath();
                canvas.moveTo(pos, center - (center * (strength / 383)) - 1);
                canvas.lineTo(pos, center + (center * (strength / 383)) + 1);
                canvas.stroke();
                if(smokeEnabled){
                    smoke.beginPath();
                    smoke.moveTo(pos, center - (center * (strength / 383)) - 8);
                    smoke.lineTo(pos, center + (center * (strength / 383)) + 8);
                    smoke.stroke();
                }
            }
        },
        stop: function(){
            canvas.lineCap = "square";
            canvas.lineWidth = 1;
            smoke.lineCap = "square";
            smoke.lineWidth = 1;
        },
        sizechange: function(){

        },
        lineWidth: 6,
        lineCount: 18,
        sqrt255: Math.sqrt(255)
    },
    caveAudioVision: {
        name: "Cave Lines",
        image: "visualizers/caveLines_av.png",
        start: function(){

        },
        frame: function(){
            canvas.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
            smoke.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var xdist = size[0] / (this.lineCount + 2);
            var datastep = 1024 / this.lineCount;
            var colorstep = 255 / this.lineCount;
            var caveCieling = Math.round(size[1] / 18);
            var center = size[1] / 2;
            for(var i = 0; i < this.lineCount; i++){
                var pos = Math.floor((i + 1) * xdist);
                var enddata = (i + 1) * datastep;
                var strength = 0;
                var samples = 0;
                for(var j = Math.round(i * datastep); j < enddata; j++){
                    //if(visData[j] > 127){
                        strength += Math.sqrt(visData[j]) * this.sqrt255;
                        //strength += Math.pow(visData[j], 2) / 255;
                        //strength += visData[j];
                        //strength += Math.pow(visData[j] * 1.5, 2) / 255;
                        //strength = Math.max(strength, visData[j]);
                        samples++;
                    //}else{
                    //    strength += Math.sqrt(visData[j]) * this.sqrt255;
                        //strength += Math.pow(visData[j], 2) / 255;
                        //strength += visData[j];
                        //strength = Math.max(strength, visData[j]);
                    //    samples++;
                    //}
                }
                strength /= samples;
                //if(strength > 255){
                //    strength = 255;
                //}
                canvas.strokeStyle = getColor(strength, i * colorstep);
                smoke.strokeStyle = getColor(strength, i * colorstep);
                
                canvas.beginPath();
                canvas.moveTo(pos, caveCieling);
                canvas.lineTo(pos, (center * (strength / 383)) + caveCieling + 4);
                canvas.moveTo(pos, size[1] - caveCieling);
                canvas.lineTo(pos, size[1] - (center * (strength / 383)) - caveCieling - 4);
                canvas.stroke();
                if(smokeEnabled){
                    smoke.beginPath();
                    smoke.moveTo(pos, 0);
                    smoke.lineTo(pos, (center * (strength / 383)) + caveCieling + 12);
                    smoke.moveTo(pos, size[1]);
                    smoke.lineTo(pos, size[1] - (center * (strength / 383)) - caveCieling - 12);
                    smoke.stroke();
                    canvas.fillStyle = "#000";
                    canvas.fillRect(0, 0, size[0], caveCieling);
                    canvas.fillRect(0, size[1] - caveCieling, size[0], size[1]);
                }
            }
        },
        stop: function(){
            canvas.lineWidth = 1;
            smoke.lineWidth = 1;
        },
        sizechange: function(){

        },
        lineWidth: 6,
        lineCount: 18,
        sqrt255: Math.sqrt(255)
    },
    seismograph: {
        name: "Seismograph",
        image: "visualizers/seismograph.png",
        start: function(){
            this.graph = [];
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var avg = 0;
            for(var i = 0; i < 180; i++){
                avg += visData[i];
            }
            avg /= 180;
            this.graph.push(avg);
            while(this.graph.length > size[0]){
                this.graph.shift();
            }
            var graphLength = this.graph.length;
            var multiplier = size[1] / 255;
            canvas.lineWidth = 2;
            smoke.lineWidth = 2;
            for(var i = 0; i < graphLength; i++){
                canvas.strokeStyle = getColor(this.graph[i], 255 - i / size[0] * 255);
                canvas.beginPath();
                canvas.moveTo(size[0] - i - 1.5, size[1] - (this.graph[i] * multiplier));
                canvas.lineTo(size[0] - i - 0.5, size[1] - ((this.graph[i - 1] || this.graph[i]) * multiplier));
                canvas.stroke();
                //canvas.fillRect(graphLength - i - 1, size[1] - (this.graph[i] * multiplier), 1, 1);
                if(smokeEnabled){
                    smoke.strokeStyle = getColor(this.graph[i], 255 - i / size[0] * 255);
                    smoke.beginPath();
                    smoke.moveTo(size[0] - i - 1.5, size[1] - (this.graph[i] * multiplier));
                    smoke.lineTo(size[0] - i - 1.5, size[1] - ((this.graph[i - 1] || this.graph[i]) * multiplier));
                    smoke.stroke();
                    //smoke.fillRect(graphLength - i - 1, size[1] - (this.graph[i] * multiplier), 1, 1);
                }
            }
        },
        stop: function(){
            this.graph = [];
        },
        graph: []
    },
    barsmograph: {
        name: "Barsmograph",
        image: "visualizers/barsmograph.png",
        start: function(){
            this.graph = [];
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var avg = 0;
            for(var i = 0; i < 180; i++){
                avg += visData[i];
            }
            avg /= 180;
            this.graph.push(avg);
            while(this.graph.length > size[0]){
                this.graph.shift();
            }
            var graphLength = this.graph.length;
            var multiplier = size[1] / 255;
            for(var i = 0; i < graphLength; i++){
                canvas.fillStyle = getColor(this.graph[i], 255 - i / size[0] * 255);
                canvas.fillRect(size[0] - i - 1, size[1] - (this.graph[i] * multiplier), 1, this.graph[i] * multiplier);
                if(smokeEnabled){
                    smoke.fillStyle = getColor(this.graph[i], 255 - i / size[0] * 255);
                    smoke.fillRect(size[0] - i - 1, size[1] - (this.graph[i] * multiplier), 1, this.graph[i] * multiplier);
                }
            }
        },
        stop: function(){
            this.graph = [];
        },
        graph: []
    },
    spikes1to1: {
        name: "Spikes Classic",
        image: "visualizers/spikesClassic.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            canvas.fillStyle = "#000";
            canvas.fillRect(0, size[1] / 2 + 127, size[0], size[1] / 2 - 127);
            smoke.clearRect(0, 0, size[0], size[1]);
            var left = size[0] / 2 - 512;
            var top = size[1] / 2 - 128;
            for(var i = 0; i < 1024; i++){
                this.drawLine(i, visData[i], left, top);
            }
            //updateSmoke();
        },
        stop: function(){
            
        },
        drawLine: function(x, h, l, t){
            var fillColor = getColor(h, x / 4);
            canvas.fillStyle = fillColor;
            canvas.fillRect(l + x, t + (255 - h), 1, h);
            if(smokeEnabled){
                smoke.fillStyle = fillColor;
                smoke.fillRect(l + x, t + (255 - h), 1, h * 2);
            }
        }
    },
    spikes: {
        name: "Spikes Stretch",
        image: "visualizers/spikesStretch.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 1024;
            var last = -1;
            var heightFactor = size[1] / 255;
            var widthFactor = 1024 / size[0];

            if(widthFactor !== 1){
                var tempLines = [];
                var tempMax = 0;
                if(widthFactor < 1){
                    for(var i = 0; i < size[0]; i++){
                        // width is larger than data
                        var pcnt = i / size[0];
                        var closestPoint = visData[Math.floor(pcnt * 1024)];
                        var nextPoint = visData[Math.floor(pcnt * 1024) + 1];
                        if(nextPoint === undefined){
                            nextPoint = closestPoint;
                        }
                        var u = pcnt * 1024 - Math.floor(pcnt * 1024);
                        tempLines[i] = ((1 - u) * closestPoint) + (u * nextPoint);
                    }
                }else{
                    for(var i = 0; i < size[0]; i++){
                        // width is smaller than data
                        var firstPcnt = i / size[0];
                        var lastPcnt = (i + 1) / size[0];
                        var firstPlace = firstPcnt * 1024;
                        var lastPlace = lastPcnt * 1024;
                        var pointRange = [];
                        for(var j = Math.floor(firstPlace); j <= Math.ceil(lastPlace); j++){
                            pointRange.push(j);
                        }
                        var totalAvg = 0;
                        var totalPoints = 0;
                        var firstU = firstPlace - Math.floor(firstPlace);
                        var lastU = lastPlace - Math.floor(lastPlace);
                        var lastValue = visData[pointRange[pointRange.length - 1]];
                        if(lastValue === undefined){
                            lastValue = visData[pointRange[pointRange.length - 2]];
                        }
                        totalAvg += (1 - firstU) * visData[pointRange[0]] + lastU * lastValue;
                        totalPoints += (1 - firstU) + lastU;
                        if(pointRange.length > 2){
                            for(var j = 1; j < pointRange.length - 1; j++){
                                totalAvg += visData[pointRange[j]];
                                totalPoints++;
                            }
                        }
                        tempLines[i] = totalAvg / totalPoints;
                    }
                }
            }
            if(widthFactor === 1){
                for(var curr = 0; curr < size[0]; curr++){
                    var strength = visData[curr];
                    this.drawLine(curr, strength, heightFactor, widthFactor);
                }
            }else{
                for(var curr = 0; curr < size[0]; curr++){
                    var strength = tempLines[curr];
                    this.drawLine(curr, strength, heightFactor, widthFactor);
                }
            }

            /*
            for(var i = 0; i < 1024; i++){
                var strength = 0;
                if(i === 0){
                    strength = visData[i];
                    this.drawLine(0, strength, heightFactor);
                }else{
                    var last = Math.floor(step * (i - 1));
                    var curr = Math.floor(step * i);
                    var next = Math.floor(step * (i + 1));
                    if(last < curr - 1){
                        // stretched
                        for(var j = 0; j < curr - last - 1; j++){
                            //strength = ((j + 1) / (curr - last + 1) * visData[i - 1] + (curr - last - j + 1) / (curr - last + 1) * visData[i]);
                            strength = (visData[i] + visData[i - 1]) / 2;
                            this.drawLine(curr - j - 1, strength, heightFactor, widthFactor);
                        }
                        strength = visData[i];
                        this.drawLine(curr, strength, heightFactor, widthFactor);
                    }else if(curr === last && next > curr){
                        // compressed
                        for(var j = 0; j < (1 / step); j++){
                            strength += visData[i - j];
                        }
                        strength /= Math.floor(1 / step) + 1;
                        this.drawLine(curr, strength, heightFactor, widthFactor);
                    }else if(last === curr - 1){
                        strength = visData[i];
                        this.drawLine(curr, strength, heightFactor, widthFactor);
                    }
                }
            }
            */
            //updateSmoke();
        },
        stop: function(){
            
        },
        drawLine: function(x, h, fact, widthFact){
            var fillColor = getColor(h, x / size[0] * 255);
            canvas.fillStyle = fillColor;
            canvas.fillRect(x, (255 - h)  * fact, 1, size[1] - (255 - h) * fact);
            if(smokeEnabled){
                smoke.fillStyle = fillColor;
                smoke.fillRect(x, (255 - h)  * fact, 1, size[1] - (255 - h) * fact);
            }
        }
    },
    spikesAccumulate: {
        name: "Spikes Accumulate",
        image: "visualizers/spikesAccumulate.png",
        start: function(){
            this.totals = new Array(1024).fill(0);
            this.max = 0;
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var left = size[0] / 2 - 512;
            var top = 0;
            for(var i = 0; i < 1024; i++){
                this.totals[i] += visData[i];
                if(this.totals[i] > this.max){
                    this.max = this.totals[i];
                }
                if(this.max / 255 > size[1]){
                    this.drawLine(i, this.totals[i] / this.max * size[1], left, top, visData[i]);
                }else{
                    this.drawLine(i, this.totals[i] / 255, left, top, visData[i]);
                }
            }
            //updateSmoke();
        },
        stop: function(){
            this.totals = [];
            this.max = 0;
        },
        drawLine: function(x, h, l, t, c){
            var fillColor = getColor(c, x / 4);
            canvas.fillStyle = fillColor;
            canvas.fillRect(l + x, t + (size[1] - h), 1, h);
            if(smokeEnabled){
                smoke.fillStyle = fillColor;
                smoke.fillRect(l + x, t + (size[1] - h), 1, h * 2);
            }
        },
        max: 0,
        totals: []
    },
    'SEPARATOR_CIRCLES" disabled="': {
        name: 'Circles',
        start: function(){

        },
        frame: function(){

        },
        stop: function(){

        }
    },
    rings: {
        name: "Rings",
        image: "visualizers/rings.png",
        start: function(){
            this.ringPositions = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var ringHeight = Math.round(Math.min(size[0], size[1]) * 0.8);
            var ringWidth = Math.round(ringHeight * 0.023);
            canvas.lineWidth = ringWidth;
            canvas.lineCap = "round";
            smoke.lineWidth = ringWidth;
            smoke.lineCap = "round";
            var ringPools = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            //var ringAvgs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            for(var i = 0; i < 1024; i++){
                var currPool = Math.floor(i / 102.4);
                ringPools[currPool] = Math.max(visData[i], ringPools[currPool]);
                //ringPools[currPool] += visData[i];
                //ringAvgs[currPool]++;
            }
            //for(var i in ringPools){
            //    ringPools[i] /= ringAvgs[i];
            //}
            for(var i = 0; i < 10; i++){
                var strength = Math.pow(ringPools[i], 2) / 65025;
                var ringColor = getColor(strength * 255, (9 - i) * 28);
                this.ringPositions[i] += strength * 5 * fpsCompensation;
                if(this.ringPositions[i] >= 360){
                    this.ringPositions[i] -= 360;
                }
                canvas.strokeStyle = ringColor;
                smoke.strokeStyle = ringColor;
                this.degArc(center[0], center[1], ringWidth * 2 * (i + 1), this.ringPositions[i], this.ringPositions[i] + 180);
                if(smokeEnabled){
                    this.degArcSmoke(center[0], center[1], ringWidth * 2 * (i + 1), this.ringPositions[i], this.ringPositions[i] + 180);
                }
            }
            //updateSmoke(size[0] / 2 - ringHeight / 2, size[1] / 2 - ringHeight / 2, ringHeight, ringHeight);
        },
        stop: function(){
            canvas.lineWidth = 1;
            canvas.lineCap = "butt";
            smoke.lineWidth = "1";
            smoke.lineCap = "butt";
        },
        ringPositions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        TAU: Math.PI * 2,
        degArc: function(x, y, r, a, b){
            canvas.beginPath();
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            canvas.stroke();
        },
        degArcSmoke: function(x, y, r, a, b){
            smoke.beginPath();
            smoke.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            smoke.stroke();
        }
    },
    ghostRings: {
        name: "Ghost Rings",
        image: "visualizers/ghostRings.png",
        start: function(){
            this.ringPositions = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var ringHeight = Math.round(Math.min(size[0], size[1]) * 0.8);
            var ringWidth = Math.round(ringHeight * 0.023);
            canvas.lineCap = "round";
            smoke.lineWidth = ringWidth;
            smoke.lineCap = "round";
            var ringPools = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            //var ringAvgs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            for(var i = 0; i < 1024; i++){
                var currPool = Math.floor(i / 102.4);
                ringPools[currPool] = Math.max(visData[i], ringPools[currPool]);
                //ringPools[currPool] += visData[i];
                //ringAvgs[currPool]++;
            }
            //for(var i in ringPools){
            //    ringPools[i] /= ringAvgs[i];
            //}
            for(var i = 0; i < 10; i++){
                var strength = Math.pow(ringPools[i], 2) / 65025;
                var ringColor = getColor(strength * 255, (9 - i) * 28);
                this.ringPositions[i] += strength * 5 * fpsCompensation;
                if(this.ringPositions[i] >= 360){
                    this.ringPositions[i] -= 360;
                }

                smoke.strokeStyle = ringColor;
                this.degArcSmoke(center[0], center[1], ringWidth * 2 * (i + 1), this.ringPositions[i], this.ringPositions[i] + 180);
                /*
                canvas.lineWidth = ringWidth;
                canvas.strokeStyle = 'rgba(0, 0, 0, 0.85)';
                this.degArc(center[0], center[1], ringWidth * 2 * (i + 1), this.ringPositions[i], this.ringPositions[i] + 180);
                canvas.lineWidth = ringWidth - 4;
                canvas.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                this.degArc(center[0], center[1], ringWidth * 2 * (i + 1), this.ringPositions[i], this.ringPositions[i] + 180);
                canvas.lineWidth = ringWidth - 8;
                canvas.strokeStyle = '#000';
                this.degArc(center[0], center[1], ringWidth * 2 * (i + 1), this.ringPositions[i], this.ringPositions[i] + 180);*/
            }
            if(!smokeEnabled){
                canvas.fillStyle = '#FFF';
                canvas.font = '12px aosProFont, Courier, monospace';
                canvas.fillText("Enable Smoke for this visualizer.", center[0] - ringHeight / 2 + 0.5, center[1] - 6, ringHeight);
            }
            //updateSmoke(size[0] / 2 - ringHeight / 2, size[1] / 2 - ringHeight / 2, ringHeight, ringHeight);
        },
        stop: function(){
            canvas.lineWidth = 1;
            canvas.lineCap = "butt";
            smoke.lineWidth = "1";
            smoke.lineCap = "butt";
        },
        ringPositions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        TAU: Math.PI * 2,
        degArc: function(x, y, r, a, b){
            canvas.beginPath();
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            canvas.stroke();
        },
        degArcSmoke: function(x, y, r, a, b){
            smoke.beginPath();
            smoke.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            smoke.stroke();
        }
    },
    circleLines: {
        name: "Circle Lines",
        image: "visualizers/circleLines.png",
        start: function(){
            canvas.lineCap = "round";
            canvas.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
            smoke.lineCap = "round";
            smoke.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var ringHeight = Math.round(Math.min(size[0], size[1]) * 0.6);
            var ringMaxRadius = ringHeight * 0.5;
            var ringMinRadius = ringHeight * 0.25;
            var ringMaxExpand = Math.round(Math.min(size[0], size[1]) * 0.2);
            var drumStrength = 0;
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            for(var i = 0; i < 180; i++){
                drumStrength += Math.pow(visData[i], 2) / 255;
            }
            drumStrength /= 180;

            var randomOffset = [0, 0];

            var lineDist = 360 / this.lineCount;
            var colorDist = 255 / this.lineCount;
            var dataDist = Math.round(1024 / this.lineCount);
            for(var i = 0; i < this.lineCount; i++){
                var strength = 0;
                var dataStop = (i + 1) * dataDist;
                var samples = 0;
                for(var j = i * dataDist; j < dataStop; j++){
                    strength += Math.sqrt(visData[j]) * this.sqrt255;
                    samples++;
                }
                strength /= samples;
                
                var firstPoint = this.findNewPoint(
                    size[0] / 2,
                    size[1] / 2,
                    i * lineDist + 90,
                    ringMinRadius + drumStrength / 255 * ringMaxExpand - 5
                );
                var secondPoint = this.findNewPoint(
                    size[0] / 2,
                    size[1] / 2,
                    i * lineDist + 90,
                    ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand
                )
                canvas.strokeStyle = getColor(strength, i * colorDist);
                canvas.beginPath();
                canvas.moveTo(firstPoint.x, firstPoint.y);
                canvas.lineTo(secondPoint.x, secondPoint.y);
                canvas.stroke();
                if(smokeEnabled){
                    smoke.strokeStyle = getColor(strength, i * colorDist);
                    smoke.beginPath();
                    smoke.moveTo(firstPoint.x, firstPoint.y);
                    smoke.lineTo(secondPoint.x, secondPoint.y);
                    smoke.stroke();
                }
            }

            
            canvas.fillStyle = '#212121';
            this.degArc2(
                size[0] / 2 + randomOffset[0],
                size[1] / 2 + randomOffset[1],
                ringMinRadius * 0.7 + drumStrength / 255 * ringMaxExpand - 5,
                0,
                360
            );
        },
        stop: function(){
            canvas.lineCap = "butt";
            canvas.lineWidth = 1;
            smoke.lineCap = "butt";
            smoke.lineWidth = 1;
        },
        sizechange: function(){
            canvas.lineCap = "round";
            canvas.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
            smoke.lineCap = "round";
            smoke.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
        },
        lineCount: 36,
        lineWidth: 6,
        TAU: Math.PI * 2,
        sqrt255: Math.sqrt(255),
        degArc2: function(x, y, r, a, b){
            canvas.beginPath();
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            canvas.fill();
        },
        findNewPoint: function(x, y, angle, distance) { // from codershop on Stack Overflow
            var result = {};
        
            result.x = /*Math.round*/(Math.cos(angle * Math.PI / 180) * distance + x);
            result.y = /*Math.round*/(Math.sin(angle * Math.PI / 180) * distance + y);
        
            return result;
        }
    },
    circle: {
        name: "Treble Circle",
        image: "visualizers/trebleCircle.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var ringHeight = Math.round(Math.min(size[0], size[1]) * 0.6);
            var ringMaxRadius = ringHeight * 0.5;
            var ringMinRadius = ringHeight * 0.25;
            var ringMaxExpand = Math.round(Math.min(size[0], size[1]) * 0.2);
            var randomShake = Math.round(Math.min(size[0], size[1]) * 0.03);
            var drumStrength = 0; // drums is all under line 150... lmao i didnt even measure that it's just a total guess
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            for(var i = 0; i < 180; i++){
                drumStrength += Math.pow(visData[i], 2) / 255;
            }
            drumStrength /= 180;

            var randomOffset = [(Math.random() - 0.5) * drumStrength / 255 * randomShake, (Math.random() - 0.5) * drumStrength / 255 * randomShake];

            for(var i = 0; i < 844; i += 4){
                var strength = (visData[i + 180] + visData[i + 181] + visData[i + 182] + visData[i + 183]) / 4;
                canvas.fillStyle = getColor(strength, i * 0.3);
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                    i / 844 * 180 + 90,
                    (i + 4.1) / 844 * 180 + 90
                );
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                    90 - (i + 4.1) / 844 * 180,
                    90 - i / 844 * 180
                );
                if(smokeEnabled){
                    smoke.fillStyle = getColor(strength, i * 0.3);
                    this.degArcSmoke(
                        size[0] / 2 + randomOffset[0],
                        size[1] / 2 + randomOffset[1],
                        ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                        i / 844 * 180 + 90,
                        (i + 3.1) / 844 * 180 + 90
                    );
                    this.degArcSmoke(
                        size[0] / 2 + randomOffset[0],
                        size[1] / 2 + randomOffset[1],
                        ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                        90 - (i + 4.1) / 844 * 180,
                        90 - i / 844 * 180
                    );
                }
            }

            canvas.fillStyle = '#000';
            this.degArc2(
                size[0] / 2 + randomOffset[0],
                size[1] / 2 + randomOffset[1],
                ringMinRadius + drumStrength / 255 * ringMaxExpand - 5,
                0,
                360
            );
            if(smokeEnabled){
                smoke.fillStyle = '#000';
                this.degArc2smoke(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + drumStrength / 255 * ringMaxExpand - 5,
                    0,
                    360
                );
            }
            //updateSmoke(size[0] / 2 - ringHeight / 2, size[1] / 2 - ringHeight / 2, ringHeight, ringHeight);
        },
        stop: function(){

        },
        TAU: Math.PI * 2,
        degArc: function(x, y, r, a, b){
            canvas.beginPath();
            canvas.moveTo(size[0] / 2, size[1] / 2);
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            canvas.fill();
        },
        degArc2: function(x, y, r, a, b){
            canvas.beginPath();
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            canvas.fill();
        },
        degArcSmoke: function(x, y, r, a, b){
            smoke.beginPath();
            smoke.moveTo(size[0] / 2, size[1] / 2);
            smoke.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            smoke.fill();
        },
        degArc2smoke: function(x, y, r, a, b){
            smoke.beginPath();
            smoke.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            smoke.fill();
        },
    },
    bassCircle: {
        name: "Bass Circle",
        image: "visualizers/bassCircle.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var ringHeight = Math.round(Math.min(size[0], size[1]) * 0.6);
            var ringMaxRadius = ringHeight * 0.5;
            var ringMinRadius = ringHeight * 0.25;
            var ringMaxExpand = Math.round(Math.min(size[0], size[1]) * 0.2);
            var randomShake = Math.round(Math.min(size[0], size[1]) * 0.03);
            var drumStrength = 0; // drums is all under line 150... lmao i didnt even measure that it's just a total guess
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            for(var i = 0; i < 180; i++){
                drumStrength += Math.pow(visData[i], 2) / 255;
            }
            drumStrength /= 180;

            var randomOffset = [(Math.random() - 0.5) * drumStrength / 255 * randomShake, (Math.random() - 0.5) * drumStrength / 255 * randomShake];

            for(var i = 0; i < 180; i++){
                canvas.fillStyle = getColor(visData[i], i * 1.4);
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + visData[i] / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                    i + 90,
                    (i + 1.1) + 90
                );
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + visData[i] / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                    90 - (i + 1.1),
                    90 - i
                );
                if(smokeEnabled){
                    smoke.fillStyle = getColor(visData[i], i * 1.4);
                    this.degArcSmoke(
                        size[0] / 2 + randomOffset[0],
                        size[1] / 2 + randomOffset[1],
                        ringMinRadius + visData[i] / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                        i + 90,
                        (i + 1.1) + 90
                    );
                    this.degArcSmoke(
                        size[0] / 2 + randomOffset[0],
                        size[1] / 2 + randomOffset[1],
                        ringMinRadius + visData[i] / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                        90 - (i + 1.1),
                        90 - i
                    );
                }
            }

            canvas.fillStyle = '#000';
            this.degArc2(
                size[0] / 2 + randomOffset[0],
                size[1] / 2 + randomOffset[1],
                ringMinRadius + drumStrength / 255 * ringMaxExpand - 5,
                0,
                360
            );
            if(smokeEnabled){
                smoke.fillStyle = '#000';
                this.degArc2smoke(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + drumStrength / 255 * ringMaxExpand - 5,
                    0,
                    360
                );
            }
            //updateSmoke(size[0] / 2 - ringHeight / 2, size[1] / 2 - ringHeight / 2, ringHeight, ringHeight);
        },
        stop: function(){

        },
        TAU: Math.PI * 2,
        degArc: function(x, y, r, a, b){
            canvas.beginPath();
            canvas.moveTo(size[0] / 2, size[1] / 2);
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            canvas.fill();
        },
        degArc2: function(x, y, r, a, b){
            canvas.beginPath();
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            canvas.fill();
        },
        degArcSmoke: function(x, y, r, a, b){
            smoke.beginPath();
            smoke.moveTo(size[0] / 2, size[1] / 2);
            smoke.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            smoke.fill();
        },
        degArc2smoke: function(x, y, r, a, b){
            smoke.beginPath();
            smoke.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            smoke.fill();
        },
    },
    layerCircle: {
        name: "Layered Circle",
        image: "visualizers/layeredCircle.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var ringHeight = Math.round(Math.min(size[0], size[1]) * 0.6);
            var ringMaxRadius = ringHeight * 0.5;
            var ringMinRadius = ringHeight * 0.25;
            var ringMaxExpand = Math.round(Math.min(size[0], size[1]) * 0.2);
            var randomShake = Math.round(Math.min(size[0], size[1]) * 0.03);
            var drumStrength = 0; // drums is all under line 150... lmao i didnt even measure that it's just a total guess
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            for(var i = 0; i < 180; i++){
                drumStrength += Math.pow(visData[i], 2) / 255;
            }
            drumStrength /= 180;

            var randomOffset = [(Math.random() - 0.5) * drumStrength / 255 * randomShake, (Math.random() - 0.5) * drumStrength / 255 * randomShake];

            canvas.fillStyle = getColor(127);
            canvas.beginPath();
            canvas.moveTo(size[0] / 2, size[1] / 2);

            if(smokeEnabled){
                smoke.fillStyle = getColor(127);
                smoke.beginPath();
                smoke.moveTo(size[0] / 2, size[1] / 2);
            }

            for(var i = -180; i < 181; i++){
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + visData[Math.abs(i)] / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                    i + 90,
                    i + 90,
                    //(i + 1.1) + 90
                );
                //this.degArc(
                //    size[0] / 2 + randomOffset[0],
                //    size[1] / 2 + randomOffset[1],
                //    ringMinRadius + visData[i] / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                //    //90 - (i + 1.1),
                //    90 - i,
                //    90 - i
                //);
                if(smokeEnabled){
                    this.degArcSmoke(
                        size[0] / 2 + randomOffset[0],
                        size[1] / 2 + randomOffset[1],
                        ringMinRadius + visData[Math.abs(i)] / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                        i + 90,
                        i + 90,
                        //(i + 1.1) + 90
                    );
                    //this.degArcSmoke(
                    //    size[0] / 2 + randomOffset[0],
                    //    size[1] / 2 + randomOffset[1],
                    //    ringMinRadius + visData[i] / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                    //    //90 - (i + 1.1),
                    //    90 - i,
                    //    90 - i
                    //);
                }
            }

            canvas.fill();
            if(smokeEnabled){
                smoke.fill();
            }

            canvas.fillStyle = getColor(255);
            canvas.beginPath();
            canvas.moveTo(size[0] / 2, size[1] / 2);

            if(smokeEnabled){
                smoke.fillStyle = getColor(255);
                smoke.beginPath();
                smoke.moveTo(size[0] / 2, size[1] / 2);
            }

            for(var i = -844; i < 845; i += 4){
                var strength = (visData[Math.abs(i) + 180] + visData[Math.abs(i) + 181] + visData[Math.abs(i) + 182] + visData[Math.abs(i) + 183]) / 4;
                
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                    i / 844 * 180 + 90,
                    i / 844 * 180 + 90,
                    //(i + 4.1) / 844 * 180 + 90
                );
                //this.degArc(
                //    size[0] / 2 + randomOffset[0],
                //    size[1] / 2 + randomOffset[1],
                //    ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                //    90 - (i + 4.1) / 844 * 180,
                //    90 - i / 844 * 180
                //);
                if(smokeEnabled){
                    this.degArcSmoke(
                        size[0] / 2 + randomOffset[0],
                        size[1] / 2 + randomOffset[1],
                        ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                        i / 844 * 180 + 90,
                        i / 844 * 180 + 90,
                        //(i + 3.1) / 844 * 180 + 90
                    );
                    //this.degArcSmoke(
                    //    size[0] / 2 + randomOffset[0],
                    //    size[1] / 2 + randomOffset[1],
                    //    ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxExpand,
                    //    90 - (i + 4.1) / 844 * 180,
                    //    90 - i / 844 * 180
                    //);
                }
            }

            canvas.fill();
            if(smokeEnabled){
                smoke.fill();
            }

            canvas.fillStyle = '#000';
            this.degArc2(
                size[0] / 2 + randomOffset[0],
                size[1] / 2 + randomOffset[1],
                ringMinRadius + drumStrength / 255 * ringMaxExpand - 5,
                0,
                360
            );
            if(smokeEnabled){
                smoke.fillStyle = '#000';
                this.degArc2smoke(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + drumStrength / 255 * ringMaxExpand - 5,
                    0,
                    360
                );
            }
            //updateSmoke(size[0] / 2 - ringHeight / 2, size[1] / 2 - ringHeight / 2, ringHeight, ringHeight);
        },
        stop: function(){

        },
        TAU: Math.PI * 2,
        degArc: function(x, y, r, a, b){
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
        },
        degArc2: function(x, y, r, a, b){
            canvas.beginPath();
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            canvas.fill();
        },
        degArcSmoke: function(x, y, r, a, b){
            smoke.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
        },
        degArc2smoke: function(x, y, r, a, b){
            smoke.beginPath();
            smoke.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            smoke.fill();
        },
    },
    eclipse: {
        name: "Eclipse",
        image: "visualizers/eclipse.png",
        start: function(){
            
        },
        frame: function(){
            smoke.clearRect(0, 0, size[0], size[1]);
            var ringHeight = Math.round(Math.min(size[0], size[1]) * 0.8);
            var ringWidth = ringHeight * 0.5;
            var strokeWidth = ringWidth * 0.4;
            var strokePosition = ringWidth * 0.8;
            smoke.lineWidth = strokeWidth;
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            for(var i = 510; i > -1; i -= 2){
                var strength = Math.pow(Math.max(visData[i], visData[i + 1]), 2) / 255;
                smoke.strokeStyle = getColor(strength);
                var linePosition = (i * 0.5) * this.ratio_360_1024;
                this.degArcSmoke(center[0], center[1], strokePosition, linePosition + 90, linePosition + 91);
                smoke.stroke();
                linePosition *= -1;
                this.degArcSmoke(center[0], center[1], strokePosition, linePosition + 90, linePosition + 91);
                smoke.stroke();
            }
            for(var i = 512; i < 1024; i += 2){
                var strength = Math.pow(Math.max(visData[i], visData[i + 1]), 2) / 255;
                smoke.strokeStyle = getColor(strength);
                var linePosition = (i * 0.5) * this.ratio_360_1024;
                this.degArcSmoke(center[0], center[1], strokePosition, linePosition + 90, linePosition + 91);
                smoke.stroke();
                linePosition *= -1;
                this.degArcSmoke(center[0], center[1], strokePosition, linePosition + 90, linePosition + 91);
                smoke.stroke();
            }
            //updateSmoke(center[0] - ringWidth - 1, center[1] - ringWidth - 1, ringHeight + 1, ringHeight + 1);
            //smoke.putImageData(smoke.getImageData(center[0], center[1] - ringWidth - 1, -1 * ringWidth - 1, ringHeight), center[0], center[1] - ringWidth - 1);
            var ringGradient = canvas.createRadialGradient(center[0], center[1], (ringWidth) * 0.8, center[0], center[1], ringWidth);
            ringGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            ringGradient.addColorStop(0.95, 'rgba(0, 0, 0, 0.9)');
            ringGradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
            canvas.clearRect(0, 0, size[0], size[1]);
            canvas.fillStyle = ringGradient;
            this.degArc(center[0], center[1], ringWidth, 0, 360);
            canvas.fill();
            if(!smokeEnabled){
                canvas.fillStyle = "#FFF";
                canvas.font = "12px aosProFont, Courier, monospace";
                canvas.fillText("Enable Smoke for this visualizer.", center[0] - ringWidth + 15.5, center[1] - 6, ringWidth - 30);
            }
        },
        stop: function(){
            smoke.lineWidth = 1;
        },
        TAU: Math.PI * 2,
        sqrt255: Math.sqrt(255),
        degArc: function(x, y, r, a, b){
            canvas.beginPath();
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
        },
        degArcSmoke: function(x, y, r, a, b){
            smoke.beginPath();
            smoke.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
        },
        ratio_360_1024: 360 / 1024
    },
    'SEPARATOR_EDGES" disabled="': {
        name: "Edges",
        start: function(){

        },
        frame: function(){

        },
        stop: function(){

        }
    },
    edgeBars: {
        name: "Edge Bars",
        image: "visualizers/edgeBars.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var left = size[1] * 0.1;
            var maxWidth = size[1] * 0.8;
            var barWidth = maxWidth / 96;
            var barSpacing = maxWidth / 64;
            var maxHeight = size[0] * 0.025;
            
            //var monstercatGradient = canvas.createLinearGradient(0, Math.round(size[1] / 2) + 4, 0, size[1]);
            //monstercatGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)'); // 0.8
            //monstercatGradient.addColorStop(0.025, 'rgba(0, 0, 0, 0.9)'); // 0.9
            //monstercatGradient.addColorStop(0.1, 'rgba(0, 0, 0, 1)');// 1
            
            for(var i = 0; i < 64; i++){
                var strength = 0;
                for(var j = 0; j < 16; j++){
                    //strength = Math.max(visData[i * 16 + j], strength);
                    //strength += visData[i * 16 + j];
                    //strength += Math.pow(visData[i * 16 + j], 2) / 255;
                    strength += Math.sqrt(visData[i * 16 + j]) * this.sqrt255;
                }
                strength = Math.round(strength / 16);
                
                var fillColor = getColor(strength, i * 4);
                canvas.fillStyle = fillColor;
                canvas.fillRect(
                    //Math.floor(size[0] / 2) - Math.round(strength / 255 * maxHeight),
                    0,
                    Math.round(size[1] - (left + i * barSpacing)),
                    Math.round(strength / 255 * maxHeight + 3),
                    Math.round(barWidth)
                );
                canvas.fillRect(
                    Math.floor(size[0] - Math.round(strength / 255 * maxHeight) - 3),
                    Math.round(size[1] - (left + i * barSpacing)),
                    Math.round(strength / 255 * maxHeight + 3),
                    Math.round(barWidth)
                );
                if(smokeEnabled){
                    smoke.fillStyle = fillColor;
                    smoke.fillRect(
                        //Math.floor(size[0] / 2) - Math.round(strength / 255 * maxHeight),
                        0,
                        Math.round(size[1] - (left + i * barSpacing)),
                        Math.round(strength / 255 * maxHeight + 3),
                        Math.round(barWidth)
                    );
                    smoke.fillRect(
                        Math.floor(size[0] - Math.round(strength / 255 * maxHeight) - 3),
                        Math.round(size[1] - (left + i * barSpacing)),
                        Math.round(strength / 255 * maxHeight + 3),
                        Math.round(barWidth)
                    );
                }
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    bottomBars: {
        name: "Bottom Bars",
        image: "visualizers/bottomBars.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var left = size[0] * 0.1;
            var maxWidth = size[0] * 0.8;
            var barWidth = maxWidth / 96;
            var barSpacing = maxWidth / 64;
            var maxHeight = size[1] * 0.05;
            
            //var monstercatGradient = canvas.createLinearGradient(0, Math.round(size[1] / 2) + 4, 0, size[1]);
            //monstercatGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)'); // 0.8
            //monstercatGradient.addColorStop(0.025, 'rgba(0, 0, 0, 0.9)'); // 0.9
            //monstercatGradient.addColorStop(0.1, 'rgba(0, 0, 0, 1)');// 1
            
            for(var i = 0; i < 64; i++){
                var strength = 0;
                for(var j = 0; j < 16; j++){
                    //strength = Math.max(visData[i * 16 + j], strength);
                    //strength += visData[i * 16 + j];
                    //strength += Math.pow(visData[i * 16 + j], 2) / 255;
                    strength += Math.sqrt(visData[i * 16 + j]) * this.sqrt255;
                }
                strength = Math.round(strength / 16);
                
                var fillColor = getColor(strength, i * 4);
                canvas.fillStyle = fillColor;
                canvas.fillRect(
                    //Math.floor(size[0] / 2) - Math.round(strength / 255 * maxHeight),
                    Math.round(left + i * barSpacing),
                    size[1] - (strength / 255 * maxHeight + 3),
                    Math.round(barWidth),
                    (strength / 255 * maxHeight + 3)
                );
                if(smokeEnabled){
                    smoke.fillStyle = fillColor;
                    smoke.fillRect(
                        //Math.floor(size[0] / 2) - Math.round(strength / 255 * maxHeight),
                        Math.round(left + i * barSpacing),
                        size[1] - (strength / 255 * maxHeight + 3),
                        Math.round(barWidth),
                        (strength / 255 * maxHeight + 3)
                    );
                }
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    edgeSpectrum: {
        name: "Edge Spectrum",
        image: "visualizers/edgeSpectrum.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[1] / 1024;
            var last = -1;
            for(var i = 0; i < 1025; i++){
                var strength = 0;
                if(i === 0){
                    strength = visData[i];
                    this.drawLine(0, strength);
                }else{
                    var last = Math.floor(step * (i - 1));
                    var curr = Math.floor(step * i);
                    var next = Math.floor(step * (i + 1));
                    if(last < curr - 1){
                        // stretched
                        for(var j = 0; j < curr - last - 1; j++){
                            //strength = ((j + 1) / (curr - last + 1) * visData[i - 1] + (curr - last - j + 1) / (curr - last + 1) * visData[i]);
                            strength = (visData[i] + visData[i - 1]) / 2;
                            this.drawLine(curr - 1, strength);
                        }
                        strength = visData[i];
                        this.drawLine(curr, strength);
                    }else if(curr === last && next > curr){
                        // compressed
                        for(var j = 0; j < (1 / step); j++){
                            strength += visData[i - j];
                        }
                        strength /= Math.floor(1 / step) + 1;
                        this.drawLine(curr, strength);
                    }else if(last === curr - 1){
                        strength = visData[i];
                        this.drawLine(curr, strength);
                    }
                }
            }
        },
        stop: function(){
            
        },
        drawLine: function(x, colorAmount){
            if(smokeEnabled){
                smoke.fillStyle = getColor(colorAmount);
                smoke.fillRect(0, size[1] - x, colorAmount / 16 + 1, 1);
                smoke.fillRect(size[0] - (colorAmount / 16 + 1), size[1] - x, colorAmount / 16 + 1, 1);
            }
            canvas.fillStyle = getColor(colorAmount);
            canvas.fillRect(0, size[1] - x, colorAmount / 16 + 1, 1);
            canvas.fillRect(size[0] - (colorAmount / 16 + 1), size[1] - x, colorAmount / 16 + 1, 1);
        }
    },
    bottomSpectrum: {
        name: "Bottom Spectrum",
        image: "visualizers/bottomSpectrum.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 1024;
            var last = -1;
            for(var i = 0; i < 1025; i++){
                var strength = 0;
                if(i === 0){
                    strength = visData[i];
                    this.drawLine(0, strength);
                }else{
                    var last = Math.floor(step * (i - 1));
                    var curr = Math.floor(step * i);
                    var next = Math.floor(step * (i + 1));
                    if(last < curr - 1){
                        // stretched
                        for(var j = 0; j < curr - last - 1; j++){
                            //strength = ((j + 1) / (curr - last + 1) * visData[i - 1] + (curr - last - j + 1) / (curr - last + 1) * visData[i]);
                            strength = (visData[i] + visData[i - 1]) / 2;
                            this.drawLine(curr - 1, strength);
                        }
                        strength = visData[i];
                        this.drawLine(curr, strength);
                    }else if(curr === last && next > curr){
                        // compressed
                        for(var j = 0; j < (1 / step); j++){
                            strength += visData[i - j];
                        }
                        strength /= Math.floor(1 / step) + 1;
                        this.drawLine(curr, strength);
                    }else if(last === curr - 1){
                        strength = visData[i];
                        this.drawLine(curr, strength);
                    }
                }
            }
        },
        stop: function(){
            
        },
        drawLine: function(x, colorAmount){
            if(smokeEnabled){
                smoke.fillStyle = getColor(colorAmount);
                smoke.fillRect(x, size[1] - (colorAmount / 16 + 1), 1, colorAmount / 16 + 1);
            }
            canvas.fillStyle = getColor(colorAmount);
            canvas.fillRect(x, size[1] - (colorAmount / 16 + 1), 1, colorAmount / 16 + 1);
        }
    },
    bottomBassSpectrum: {
        name: "Bottom Bass Spectrum",
        image: "visualizers/bottomBassSpectrum.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 180;
            var last = -1;
            for(var i = 0; i < 181; i++){
                var strength = 0;
                if(i === 0){
                    strength = visData[i];
                    this.drawLine(0, strength);
                }else{
                    var last = Math.floor(step * (i - 1));
                    var curr = Math.floor(step * i);
                    var next = Math.floor(step * (i + 1));
                    if(last < curr - 1){
                        // stretched
                        for(var j = 0; j < curr - last - 1; j++){
                            //strength = ((j + 1) / (curr - last + 1) * visData[i - 1] + (curr - last - j + 1) / (curr - last + 1) * visData[i]);
                            var pcntBetween = j / (curr - last - 1);
                            strength = visData[i] * pcntBetween + visData[i - 1] * (1 - pcntBetween);
                            this.drawLine(curr - (curr - last - 1 - j), strength);
                        }
                        strength = visData[i];
                        this.drawLine(curr, strength);
                    }else if(curr === last && next > curr){
                        // compressed
                        for(var j = 0; j < (1 / step); j++){
                            strength += visData[i - j];
                        }
                        strength /= Math.floor(1 / step) + 1;
                        this.drawLine(curr, strength);
                    }else if(last === curr - 1){
                        strength = visData[i];
                        this.drawLine(curr, strength);
                    }
                }
            }
        },
        stop: function(){
            
        },
        drawLine: function(x, colorAmount){
            if(smokeEnabled){
                smoke.fillStyle = getColor(colorAmount);
                smoke.fillRect(x, size[1] - (colorAmount / 16 + 1), 1, colorAmount / 16 + 1);
            }
            canvas.fillStyle = getColor(colorAmount);
            canvas.fillRect(x, size[1] - (colorAmount / 16 + 1), 1, colorAmount / 16 + 1);
        }
    },
    fullEdge: {
        name: "Full Edge",
        image: "visualizers/fullEdge.png",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 1024; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            //avg /= 180;
            avg /= 1024;
            //avg *= 255;
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
                smoke.fillStyle = getColor(avg);
                smoke.fillRect(0, 0, size[0], 5);
                smoke.fillRect(0, 0, 5, size[1]);
                smoke.fillRect(0, size[1] - 5, size[0], 5);
                smoke.fillRect(size[0] - 5, 0, 5, size[1]);
            }else{
                canvas.fillStyle = getColor(avg);
                canvas.fillRect(0, 0, size[0], 5);
                canvas.fillRect(0, 0, 5, size[1]);
                canvas.fillRect(0, size[1] - 5, size[0], 5);
                canvas.fillRect(size[0] - 5, 0, 5, size[1]);
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    fullBassEdge: {
        name: "Full Bass Edge",
        image: "visualizers/fullBassEdge.png",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 180; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            avg /= 180;
            //avg /= 1024;
            //avg *= 255;
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
                smoke.fillStyle = getColor(avg);
                smoke.fillRect(0, 0, size[0], 5);
                smoke.fillRect(0, 0, 5, size[1]);
                smoke.fillRect(0, size[1] - 5, size[0], 5);
                smoke.fillRect(size[0] - 5, 0, 5, size[1]);
            }else{
                canvas.fillStyle = getColor(avg);
                canvas.fillRect(0, 0, size[0], 5);
                canvas.fillRect(0, 0, 5, size[1]);
                canvas.fillRect(0, size[1] - 5, size[0], 5);
                canvas.fillRect(size[0] - 5, 0, 5, size[1]);
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    'SEPARATOR_FULL_SCREEN" disabled="': {
        name: 'Full',
        start: function(){

        },
        frame: function(){

        },
        stop: function(){

        }
    },
    spectrum: {
        name: "Spectrum",
        image: "visualizers/spectrum.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 1024;
            var last = -1;
            for(var i = 0; i < 1025; i++){
                var strength = 0;
                if(i === 0){
                    strength = visData[i];
                    this.drawLine(0, strength);
                }else{
                    var last = Math.floor(step * (i - 1));
                    var curr = Math.floor(step * i);
                    var next = Math.floor(step * (i + 1));
                    if(last < curr - 1){
                        // stretched
                        for(var j = 0; j < curr - last - 1; j++){
                            //strength = ((j + 1) / (curr - last + 1) * visData[i - 1] + (curr - last - j + 1) / (curr - last + 1) * visData[i]);
                            strength = (visData[i] + visData[i - 1]) / 2;
                            this.drawLine(curr - 1, strength);
                        }
                        strength = visData[i];
                        this.drawLine(curr, strength);
                    }else if(curr === last && next > curr){
                        // compressed
                        for(var j = 0; j < (1 / step); j++){
                            strength += visData[i - j];
                        }
                        strength /= Math.floor(1 / step) + 1;
                        this.drawLine(curr, strength);
                    }else if(last === curr - 1){
                        strength = visData[i];
                        this.drawLine(curr, strength);
                    }
                }
            }
        },
        stop: function(){
            
        },
        drawLine: function(x, colorAmount){
            if(smokeEnabled){
                smoke.fillStyle = getColor(colorAmount);
                smoke.fillRect(x, 0, 1, size[1]);
            }else{
                canvas.fillStyle = getColor(colorAmount);
                canvas.fillRect(x, 0, 1, size[1]);
            }
        }
    },
    spectrumBass: {
        name: "Bass Spectrum",
        image: "visualizers/spectrumBass.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 180;
            var last = -1;
            for(var i = 0; i < 181; i++){
                var strength = 0;
                if(i === 0){
                    strength = visData[i];
                    this.drawLine(0, strength);
                }else{
                    var last = Math.floor(step * (i - 1));
                    var curr = Math.floor(step * i);
                    var next = Math.floor(step * (i + 1));
                    if(last < curr - 1){
                        // stretched
                        for(var j = 0; j < curr - last - 1; j++){
                            //strength = ((j + 1) / (curr - last + 1) * visData[i - 1] + (curr - last - j + 1) / (curr - last + 1) * visData[i]);
                            var pcntBetween = j / (curr - last - 1);
                            strength = visData[i] * pcntBetween + visData[i - 1] * (1 - pcntBetween);
                            this.drawLine(curr - (curr - last - 1 - j), strength);
                        }
                        strength = visData[i];
                        this.drawLine(curr, strength);
                    }else if(curr === last && next > curr){
                        // compressed
                        for(var j = 0; j < (1 / step); j++){
                            strength += visData[i - j];
                        }
                        strength /= Math.floor(1 / step) + 1;
                        this.drawLine(curr, strength);
                    }else if(last === curr - 1){
                        strength = visData[i];
                        this.drawLine(curr, strength);
                    }
                }
            }
        },
        stop: function(){
            
        },
        drawLine: function(x, colorAmount){
            if(smokeEnabled){
                smoke.fillStyle = getColor(colorAmount);
                smoke.fillRect(x, 0, 1, size[1]);
            }else{
                canvas.fillStyle = getColor(colorAmount);
                canvas.fillRect(x, 0, 1, size[1]);
            }
        }
    },
    tiles: {
        name: "Tiles",
        image: "visualizers/tiles.png",
        start: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var freqs = [];
            for(var i = 0; i < 1024; i++){
                freqs.push(i);
            }
            for (var i = 1024; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = freqs[i];
                freqs[i] = freqs[j];
                freqs[j] = temp;
            }
            tiles = [];
            var index = 0;
            for(var i = 0; i < 32; i++){
                this.tiles.push([]);
                for(var j = 0; j < 32; j++){
                    this.tiles[this.tiles.length - 1].push(freqs[index]);
                    index++;
                }
            }
            this.boxSize = [Math.round(size[0] / 32), Math.round(size[1] / 32)];
        },
        sizechange: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var freqs = [];
            for(var i = 0; i < 1024; i++){
                freqs.push(i);
            }
            for (var i = 1024; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = freqs[i];
                freqs[i] = freqs[j];
                freqs[j] = temp;
            }
            tiles = [];
            var index = 0;
            for(var i = 0; i < 32; i++){
                this.tiles.push([]);
                for(var j = 0; j < 32; j++){
                    this.tiles[this.tiles.length - 1].push(freqs[index]);
                    index++;
                }
            }
            this.boxSize = [Math.round(size[0] / 32), Math.round(size[1] / 32)];
        },
        frame: function(){
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }else{
                canvas.clearRect(0, 0, size[0], size[1]);
            }
            for(var i = 0; i < 32; i++){
                for(var j = 0; j < 32; j++){
                    var strength = visData[this.tiles[i][j]];
                    var color = getColor(strength);
                    if(smokeEnabled){
                        smoke.fillStyle = color;
                        smoke.fillRect(i * this.boxSize[0], j * this.boxSize[1], this.boxSize[0], this.boxSize[1]);
                    }else{
                        canvas.fillStyle = color;
                        canvas.fillRect(i * this.boxSize[0], j * this.boxSize[1], this.boxSize[0], this.boxSize[1]);
                    }
                }
            }
        },
        stop: function(){
            this.tiles = [];
            this.boxSize = [];
        },
        tiles: [],
        boxSize: []
    },
    windowRecolor: {
        name: "Window Color",
        image: "visualizers/windowColor.png",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 1024; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            avg /= 1024;
            //avg /= 1024;
            //avg *= 255;
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
                smoke.fillStyle = getColor(avg);
                smoke.fillRect(0, 0, size[0], size[1]);
            }else{
                canvas.fillStyle = getColor(avg);
                canvas.fillRect(0, 0, size[0], size[1]);
            }
            canvas.fillStyle = "#FFF";
            canvas.font = "12px aosProFont, Courier, monospace";
            canvas.fillText("Load this visualizer in AaronOS and your window borders will color themselves to the beat.", 10.5, 20);
            document.title = "WindowRecolor:" + getColor(avg);
        },
        stop: function(){
            document.title = "AaronOS Music Player";
        },
        sqrt255: Math.sqrt(255)
    },
    bassWindowRecolor: {
        name: "Bass Window Color",
        image: "visualizers/bassWindowColor.png",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 180; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            avg /= 180;
            //avg /= 1024;
            //avg *= 255;
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
                smoke.fillStyle = getColor(avg);
                smoke.fillRect(0, 0, size[0], size[1]);
            }else{
                canvas.fillStyle = getColor(avg);
                canvas.fillRect(0, 0, size[0], size[1]);
            }
            canvas.fillStyle = "#FFF";
            canvas.font = "12px aosProFont, Courier, monospace";
            canvas.fillText("Load this visualizer in AaronOS and your window borders will color themselves to the beat.", 10.5, 20);
            document.title = "WindowRecolor:" + getColor(avg);
        },
        stop: function(){
            document.title = "AaronOS Music Player";
        },
        sqrt255: Math.sqrt(255)
    },
    solidColor: {
        name: "Solid Color",
        image: "visualizers/solidColor.png",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 1024; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            avg /= 1024;
            //avg /= 1024;
            //avg *= 255;
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
                smoke.fillStyle = getColor(avg);
                smoke.fillRect(0, 0, size[0], size[1]);
            }else{
                canvas.fillStyle = getColor(avg);
                canvas.fillRect(0, 0, size[0], size[1]);
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    bassSolidColor: {
        name: "Bass Solid Color",
        image: "visualizers/bassSolidColor.png",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 180; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            avg /= 180;
            //avg /= 1024;
            //avg *= 255;
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
                smoke.fillStyle = getColor(avg);
                smoke.fillRect(0, 0, size[0], size[1]);
            }else{
                canvas.fillStyle = getColor(avg);
                canvas.fillRect(0, 0, size[0], size[1]);
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    'SEPARATOR_PITCH" disabled="': {
        name: 'Pitch',
        start: function(){

        },
        frame: function(){

        },
        stop: function(){

        }
    },
    spectrogramClassic: {
        name: "Spectrogram Classic",
        image: "visualizers/spectrogramClassic.png",
        start: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
        },
        frame: function(){
            var left = size[0] / 2 - 512;
            canvas.putImageData(canvas.getImageData(left, 0, left + 1024, size[1]), left, -1);
            var strength = 0;
            for(var i = 0; i < 1024; i++){
                strength = visData[i];
                canvas.fillStyle = getColor(strength, i / 4);
                canvas.fillRect(left + i, size[1] - 1, 1, 1);
            }
        },
        sizechange: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
        },
        stop: function(){
            
        }
    },
    spectrogram: {
        name: "Spectrogram Stretch",
        image: "visualizers/spectrogramStretch.png",
        start: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
        },
        frame: function(){
            canvas.putImageData(canvas.getImageData(0, 0, size[0], size[1]), 0, -1);
            var step = size[0] / 1024;
            var last = -1;
            var heightFactor = size[1] / 255;
            for(var i = 0; i < 1024; i++){
                var strength = 0;
                if(i === 0){
                    strength = visData[i];
                    canvas.fillStyle = getColor(strength);
                    canvas.fillRect(0, size[1] - 1, 1, 1);
                }else{
                    var last = Math.floor(step * (i - 1));
                    var curr = Math.floor(step * i);
                    var next = Math.floor(step * (i + 1));
                    if(last < curr - 1){
                        // stretched
                        for(var j = 0; j < curr - last - 1; j++){
                            //strength = ((j + 1) / (curr - last + 1) * visData[i - 1] + (curr - last - j + 1) / (curr - last + 1) * visData[i]);
                            strength = (visData[i] + visData[i - 1]) / 2;
                            canvas.fillStyle = getColor(strength);
                            canvas.fillRect(curr - j - 1, size[1] - 1, 1, 1);
                        }
                        strength = visData[i];
                        canvas.fillStyle = getColor(strength);
                        canvas.fillRect(curr, size[1] - 1, 1, 1);
                    }else if(curr === last && next > curr){
                        // compressed
                        for(var j = 0; j < (1 / step); j++){
                            strength += visData[i - j];
                        }
                        strength /= Math.floor(1 / step) + 1;
                        canvas.fillStyle = getColor(strength);
                        canvas.fillRect(curr, size[1] - 1, 1, 1);
                    }else if(last === curr - 1){
                        strength = visData[i];
                        canvas.fillStyle = getColor(strength);
                        canvas.fillRect(curr, size[1] - 1, 1, 1);
                    }
                }
            }
        },
        sizechange: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
        },
        stop: function(){
            
        }
    },
    avgPitch: {
        name: "Average Pitch",
        image: "visualizers/averagePitch.png",
        start: function(){

        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var mult = size[0] / 1024;
            //var roundMult = Math.round(mult);
            //var halfMult = Math.round(mult / 2);
            for(var i = 1; i < 10; i++){
                if(this.history[i].length === 0){
                    continue;
                }
                canvas.globalAlpha = Math.sqrt(i - 1) * 3.16227766 / 10;
                canvas.fillStyle = getColor(this.history[i][1], this.history[i][2] / 4);
                canvas.fillRect(this.history[i - 1][0], 0, this.history[i][0] - this.history[i - 1][0], size[1]);
                if(smokeEnabled){
                    smoke.globalAlpha = Math.sqrt(i - 1) * 3.16227766 / 10;
                    smoke.fillStyle = getColor(this.history[i][1], this.history[i][2] / 4);
                    smoke.fillRect(this.history[i - 1][0], 0, this.history[i][0] - this.history[i - 1][0], size[1]);
                }
            }
            var avgPitch = 0;
            var avgPitchMult = 0;
            var avgVolume = 0;
            for(var i = 0; i < 1024; i++){
                avgVolume += Math.sqrt(visData[i]) * this.sqrt255;
                //avgVolume += visData[i];
                avgPitch += i * visData[i];
                avgPitchMult += visData[i];
            }
            avgVolume /= 1024;
            avgPitch /= avgPitchMult;
            canvas.globalAlpha = 1;
            canvas.fillStyle = getColor(avgVolume, avgPitch / 4);
            canvas.fillRect(this.history[9][0], 0, Math.round(avgPitch * mult) - this.history[9][0], size[1]);
            if(smokeEnabled){
                smoke.globalAlpha = 1;
                smoke.fillStyle = getColor(avgVolume, avgPitch / 4);
                smoke.fillRect(this.history[9][0], 0, Math.round(avgPitch * mult) - this.history[9][0], size[1]);
            }
            this.history.shift();
            this.history[9] = [Math.round(avgPitch * mult), avgVolume, avgPitch];
        },
        stop: function(){
            this.history = [
                [],
                [],
                [],
                [],
                [],
                [],
                [],
                [],
                [],
                []
            ];
        },
        history: [
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            []
        ],
        sqrt255: Math.sqrt(255)
    },
    'SEPARATOR_TESTS" disabled="': {
        name: 'Other',
        start: function(){

        },
        frame: function(){

        },
        stop: function(){

        }
    },
    blast: {
        name: "aOS Blast",
        image: "visualizers/blast.png",
        start: function(){
            this.canvasParent = canvasElement.parentNode;
            this.ships = {};
            this.lasers = {};
            this.spawnShips(this.settings.player);
            canvas.lineCap = "round";
        },
        randomColor: function(){
            return 'rgb(' +
                (Math.floor(Math.random() * 200) + 55) + ', ' +
                (Math.floor(Math.random() * 200) + 55) + ', ' +
                (Math.floor(Math.random() * 200) + 55) + ')';
        },
        spawnShips: function(spawnPlayer){
            this.ships = {};
            this.lasers = {};
            if(spawnPlayer){
                this.createShip(null, null, "Player");
            }
            for(var i = 0; i < this.settings.shipCount; i++){
                this.createShip();
            }
        },
        createShip: function(shipColor, shipSize, shipName, shipHealth){
            if(!shipColor){
                shipColor = this.randomColor(); 
            }
            if(!shipSize){
                shipSize = this.settings.shipSize;
            }
            if(!shipName){
                shipName = "Ship " + (this.totalShips + 1);
            }
            if(!shipHealth){
                shipHealth = this.settings.shipHealth;
            }
            this.ships[shipName] = {
                name: shipName,
                color: shipColor,
                size: shipSize,
                pos: [
                    Math.floor(Math.random() * size[0]),
                    Math.floor(Math.random() * size[1])
                ],
                lastPos: [0, 0],
                vel: [0, 0],
                wanderDirection: Math.floor(Math.random() * 360),
                health: shipHealth,
                alive: 1,
                lastDeath: 0,

                lastFire: 0,
                lastReload: 0,
                shotsFired: 0,

                score: 0
            };
            this.ships[shipName].lastPos[0] = this.ships[shipName].pos[0];
            this.ships[shipName].lastPos[1] = this.ships[shipName].pos[1];
            this.totalShips++;
        },
        createLaser: function(laserOwner, laserPos, laserAngle, laserVel, laserColor, laserSize, laserName){
            if(!laserOwner){
                laserOwner = undefined;
            }
            if(!laserColor){
                laserColor = getColor(255, 255);//this.settings.laserColor;
            }
            if(!laserSize){
                laserSize = this.settings.laserSize;
            }
            if(!laserPos || typeof laserPos !== "object"){
                laserPos = [0, 0];
            }
            if(!laserAngle){
                laserAngle = 0;
            }
            if(!laserVel){
                laserVel = this.settings.laserSpeed;
            }
            if(!laserName){
                laserName = "laser_" + (this.totalLasers + 1) + "_" + (laserOwner || "?")
            }
            this.lasers[laserName] = {
                owner: laserOwner,
                name: laserName,
                pos: laserPos,
                angle: laserAngle,
                color: laserColor,
                vel: laserVel,
                size: laserSize
            }
            this.totalLasers++;
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            
            // get visualizer data
            this.soundShoot = 1;

            this.visBassAvg = 0;
            if(!this.visBassAvgVolume){
                this.visBassAvgElements = [];
                this.visBassAvgTotal = 0;
                this.visBassAvgVolume = 0;
            }
            for(var i = 0; i < 180; i++){

                //this.visBassAvg += visData[i];
                this.visBassAvg += visData[i];
                
                //this.visLast[i] = visData[i];
            }
            this.visBassAvg /= 180;

            this.visBassAvgElements.push(this.visBassAvg);
            this.visBassAvgTotal += this.visBassAvg;
            while(this.visBassAvgElements.length > Math.round(this.settings.soundMemory / 60 * currFPS)){
                this.visBassAvgTotal -= this.visBassAvgElements.shift();
            }

            this.visBassAvgVolume = this.visBassAvgTotal / this.visBassAvgElements.length;

            if(!this.visPastAvgs){
                this.visPastAvgs = [];
            }

            //if(this.visBassAvg < 255 * this.settings.soundSensitivity){
            if(
                this.visBassAvgVolume + this.settings.soundMemoryAdd > this.visBassAvg ||
                this.visBassAvgElements[this.visBassAvgElements.length - 1] <= this.visBassAvgElements[this.visBassAvgElements.length - 3]
            ){
                this.soundShoot = 0;
            }


            // debug drawing
            if(window.location.href.indexOf("debug") !== -1 || debugForce){
                canvas.fillStyle = "#0F0";
                if(this.soundShoot){
                    canvas.fillRect(10, size[1] - 285, 10, 10);
                }
                canvas.fillRect(10, size[1] - 10 - this.visBassAvg, 10, this.visBassAvg);
                canvas.fillRect(30, size[1] - 10 - this.visBassAvgVolume, 10, this.visBassAvgVolume);

                canvas.fillStyle = "#F00";
                //canvas.fillRect(10, size[1] - 10 - (255 * this.settings.soundSensitivity), 10, 1);
                canvas.fillRect(10, size[1] - 10 - (this.visBassAvgVolume + this.settings.soundMemoryAdd), 20, 1);
                canvas.fillRect(30, size[1] - 10 - (this.visBassAvgVolume + this.settings.soundMemoryAdd), 5, this.settings.soundMemoryAdd);

                canvas.strokeStyle = "#FFF";
                canvas.lineWidth = 1;
                canvas.strokeRect(10.5, size[1] - 285.5, 10, 10);
                canvas.strokeRect(10.5, size[1] - 265.5, 10, 255);
                canvas.strokeRect(30.5, size[1] - 265.5 - this.settings.soundMemoryAdd, 10, 255 + this.settings.soundMemoryAdd);

                var adjustedSoundMemory = Math.round(this.settings.soundMemory / 60 * currFPS);

                this.visPastAvgs.push(this.visBassAvgVolume + this.settings.soundMemoryAdd);
                while(this.visPastAvgs.length > adjustedSoundMemory){
                    this.visPastAvgs.shift();
                }

                for(var i = 0; i < this.visBassAvgElements.length; i++){
                    canvas.fillStyle = "#0F0";
                    if(this.visBassAvgElements[i] < this.visBassAvgElements[i - 2]){
                        canvas.fillStyle = "#070";
                    }
                    if(this.visBassAvgElements[i] > this.visPastAvgs[i]){
                        canvas.fillRect(50 + (adjustedSoundMemory - i), size[1] - 285 - this.settings.soundMemoryAdd, 1, 10);
                    }
                    canvas.fillRect(50 + (adjustedSoundMemory - i), size[1] - 10 - this.visBassAvgElements[i], 1, this.visBassAvgElements[i]);
                    canvas.fillStyle = "#F00";
                    canvas.fillRect(50 + (adjustedSoundMemory - i), size[1] - 10 - this.visPastAvgs[i], 1, 1);
                }
                
                canvas.strokeRect(50.5, size[1] - 265.5 - this.settings.soundMemoryAdd, adjustedSoundMemory + 1, 255 + this.settings.soundMemoryAdd);
                canvas.strokeRect(50.5, size[1] - 285.5 - this.settings.soundMemoryAdd, adjustedSoundMemory + 1, 10);
            }


            // do bullet simulation first
            for(var i in this.lasers){
                var destroyLaser = 0;
                for(var j in this.ships){
                    if(this.ships[j].alive){
                        if(
                            Math.sqrt(
                                Math.pow(this.lasers[i].pos[0] - this.ships[j].pos[0], 2) +
                                Math.pow(this.lasers[i].pos[1] - this.ships[j].pos[1], 2)
                            ) < this.ships[j].size * 0.5
                        ){
                            this.ships[j].health--;
                            this.ships[j].dodging = null;
                            if(this.ships[j].health <= 0){
                                this.ships[j].alive = 0;
                                this.ships[j].lastDeath = Date.now();
                            }
                            this.ships[this.lasers[i].owner].score++;
                            destroyLaser = 1;
                        }else if(
                            this.lasers[i].pos[0] < 0 || this.lasers[i].pos[0] > size[0] ||
                            this.lasers[i].pos[1] < 0 || this.lasers[i].pos[1] > size[1]
                        ){
                            destroyLaser = 1;
                        }
                    }
                }
                canvas.lineWidth = this.lasers[i].size;
                canvas.strokeStyle = this.lasers[i].color;
                canvas.beginPath();
                canvas.moveTo(this.lasers[i].pos[0], this.lasers[i].pos[1]);
                var newLaserPos = this.pointFromAngle(
                    this.lasers[i].pos[0],
                    this.lasers[i].pos[1],
                    this.lasers[i].angle,
                    this.lasers[i].vel * fpsCompensation
                );
                canvas.lineTo(newLaserPos[0], newLaserPos[1]);
                canvas.stroke();
                
                if(smokeEnabled){/*
                    smoke.lineWidth = this.lasers[i].size * 4;
                    smoke.strokeStyle = this.lasers[i].color;
                    smoke.beginPath();
                    smoke.moveTo(this.lasers[i].pos[0], this.lasers[i].pos[1]);
                    var newLaserPosSmoke = this.pointFromAngle(
                        this.lasers[i].pos[0],
                        this.lasers[i].pos[1],
                        this.lasers[i].angle,
                        this.lasers[i].vel * 2
                    );
                    smoke.lineTo(newLaserPosSmoke[0], newLaserPosSmoke[1]);
                    smoke.stroke();
                    */
                    smoke.fillStyle = this.lasers[i].color;
                    smoke.beginPath();
                    smoke.arc(this.lasers[i].pos[0], this.lasers[i].pos[1], this.settings.laserLength * 1.5, 0, this.deg2rad(360));
                    smoke.fill();
                }

                if(destroyLaser){
                    delete this.lasers[i];
                }else{
                    this.lasers[i].pos[0] = newLaserPos[0];
                    this.lasers[i].pos[1] = newLaserPos[1];
                }
            }
            for(var ship in this.ships){
                if(this.ships[ship].alive){
                    if(ship.indexOf("Player") !== -1){
                        // do player awareness second (oh wait this isn't AI)

                        // do player movement third
                        if(this.inputs.left){
                            this.ships[ship].pos[0] -= this.settings.shipChase * fpsCompensation;
                        }
                        if(this.inputs.right){
                            this.ships[ship].pos[0] += this.settings.shipChase * fpsCompensation;
                        }
                        if(this.inputs.up){
                            this.ships[ship].pos[1] -= this.settings.shipChase * fpsCompensation;
                        }
                        if(this.inputs.down){
                            this.ships[ship].pos[1] += this.settings.shipChase * fpsCompensation;
                        }
                        // do player firing fourth
                        if(this.inputs.mouse){
                            var ms = Date.now();
                            if(this.ships[ship].shotsFired >= this.settings.gunAmmo){
                                if(ms - this.ships[ship].lastReload > this.settings.gunReload){
                                    this.ships[ship].shotsFired = 0;
                                    shouldShoot = 1;
                                }
                            }else{
                                shouldShoot = 1;
                            }
                            if(ms - this.ships[ship].lastFire > this.settings.gunDelay){
                                if(shouldShoot){
                                    var targetAngle = this.angleFromPoints(
                                        this.ships[ship].pos[0],
                                        this.ships[ship].pos[1],
                                        this.inputs.x,
                                        this.inputs.y
                                    );
                                    var laserSpawnPos = this.pointFromAngle(
                                        this.ships[ship].pos[0],
                                        this.ships[ship].pos[1],
                                        targetAngle,
                                        this.ships[ship].size + 3
                                    );
                                    this.createLaser(
                                        ship,
                                        laserSpawnPos,
                                        targetAngle
                                    );
                                    this.ships[ship].shotsFired++;
                                    this.ships[ship].lastFire = ms;
                                    if(this.ships[ship].shotsFired >= this.settings.gunAmmo){
                                        this.ships[ship].lastReload = ms;
                                    }
                                }
                            }
                        }else if(this.ships[ship].shotsFired >= this.settings.gunAmmo && Date.now() - this.ships[ship].lastReload > this.settings.gunReload){
                            this.ships[ship].shotsFired = 0;
                        }
                    }else{
                        // do ship awareness second
                        var moveMode = "default";
                        var targetShip = null;
                        var targetDist = null;
                        var targetAngle = null;
                        var dodgeAngle = null;
                        for(var otherShip in this.ships){
                            if(this.ships[otherShip].alive){
                                if(this.ships[otherShip] !== this.ships[ship]){
                                    var otherDistance = Math.sqrt(
                                        Math.pow(this.ships[otherShip].pos[0] - this.ships[ship].pos[0], 2) +
                                        Math.pow(this.ships[otherShip].pos[1] - this.ships[ship].pos[1], 2)
                                    );
                                    if(otherDistance < this.settings.shipSightRange){
                                        if(otherDistance < targetDist || targetDist === null){
                                            targetShip = otherShip;
                                            targetDist = otherDistance;
                                            targetAngle = this.angleFromPoints(
                                                this.ships[ship].pos[0],
                                                this.ships[ship].pos[1],
                                                this.ships[otherShip].pos[0],
                                                this.ships[otherShip].pos[1]
                                            );
                                            moveMode = "fight";
                                        }
                                    }
                                }
                            }
                        }
                        var dodging = null;
                        var closestLaser = null;
                        var dodgeAngle = null;
                        for(var j in this.lasers){
                            if(this.lasers[j].owner !== ship){
                                var laserDistance = Math.sqrt(
                                    Math.pow(this.lasers[j].pos[0] - this.ships[ship].pos[0], 2) +
                                    Math.pow(this.lasers[j].pos[1] - this.ships[ship].pos[1], 2)
                                );
                                if(laserDistance < this.settings.shipDodgeRange){
                                    if(laserDistance < closestLaser || closestLaser === null){
                                        dodging = j;
                                        closestLaser = laserDistance;
                                        moveMode = "dodge";
                                    }
                                }
                            }
                        }
                        // do ship movement third
                        this.ships[ship].moveMode = moveMode;
                        this.ships[ship].targetShip = targetShip;
                        this.ships[ship].targetDist = targetDist;
                        this.ships[ship].targetAngle = targetAngle;
                        switch(moveMode){
                            case "fight":
                                this.ships[ship].dodging = null;
                                var moveAngle = targetAngle;
                                if(targetDist < this.settings.shipBattleRange - this.settings.shipBattleComfort){ // target is too close for comfort
                                    moveAngle += 180;
                                    moveAngle += Math.random() * this.settings.shipWander * 2 - this.settings.shipWander;
                                    var moveCoords = this.pointFromAngle(
                                        this.ships[ship].pos[0],
                                        this.ships[ship].pos[1],
                                        moveAngle,
                                        (this.settings.shipChase * (Math.random() * 0.85 + 0.15)) * fpsCompensation
                                    );
                                    this.ships[ship].pos[0] = moveCoords[0];
                                    this.ships[ship].pos[1] = moveCoords[1];
                                }else if(targetDist < this.settings.shipBattleRange + this.settings.shipBattleComfort){ // target is good distance away
                                    if(typeof this.ships[ship].prevActionSide !== "number"){
                                        this.ships[ship].prevActionSide = Math.round(Math.random());
                                    }
                                    if(Math.random() < 0.05 * fpsCompensation){
                                        this.ships[ship].prevActionSide = Math.abs(this.ships[ship].prevActionSide - 1);
                                    }
                                    if(this.ships[ship].prevActionSide){
                                        moveAngle += 90;
                                    }else{
                                        moveAngle -= 90;
                                    }
                                    moveAngle += Math.random() * this.settings.shipWander * 2 - this.settings.shipWander;
                                    var moveCoords = this.pointFromAngle(
                                        this.ships[ship].pos[0],
                                        this.ships[ship].pos[1],
                                        moveAngle,
                                        (this.settings.shipChase * (Math.random() * 0.85 + 0.15)) * fpsCompensation
                                    );
                                    this.ships[ship].pos[0] = moveCoords[0];
                                    this.ships[ship].pos[1] = moveCoords[1];
                                }else{ // target is too far away
                                    moveAngle += Math.random() * this.settings.shipWander * 2 - this.settings.shipWander;
                                    var moveCoords = this.pointFromAngle(
                                        this.ships[ship].pos[0],
                                        this.ships[ship].pos[1],
                                        moveAngle,
                                        (this.settings.shipChase * (Math.random() * 0.85 + 0.15)) * fpsCompensation
                                    );
                                    this.ships[ship].pos[0] = moveCoords[0];
                                    this.ships[ship].pos[1] = moveCoords[1];
                                }
                                break;
                            case "dodge":
                                var ms = Date.now();
                                if(this.ships[ship].dodging === dodging && ms - this.ships[ship].lastDodge < this.settings.dodgeTime){
                                    dodgeAngle = this.ships[ship].dodgeAngle + (Math.random() * this.settings.shipWander * 2 - this.settings.shipWander) * fpsCompensation;
                                    this.ships[ship].dodgeAngle = dodgeAngle;
                                }else{
                                    this.ships[ship].lastDodge = ms;
                                    this.ships[ship].dodging = dodging;
                                    dodgeAngle = Math.round(Math.random() * 360) + (Math.random() * this.settings.shipWander * 2 - this.settings.shipWander) * fpsCompensation;
                                    this.ships[ship].dodgeAngle = dodgeAngle;
                                }
                                var newPos = this.pointFromAngle(
                                    this.ships[ship].pos[0],
                                    this.ships[ship].pos[1],
                                    dodgeAngle,
                                    this.settings.shipChase * fpsCompensation
                                );
                                this.ships[ship].pos[0] = newPos[0];
                                this.ships[ship].pos[1] = newPos[1];
                                break;
                            default:
                                this.ships[ship].dodging = null;
                                this.ships[ship].wanderDirection += (Math.random() * this.settings.shipWander - (this.settings.shipWander / 2)) * fpsCompensation;
                                if(this.ships[ship].wanderDirection > 360){
                                    this.ships[ship].wanderDirection -= 360;
                                }else if(this.ships[ship].wanderDirection < 0){
                                    this.ships[ship].wanderDirection += 360;
                                }
                                this.ships[ship].pos = this.pointFromAngle(
                                    this.ships[ship].pos[0],
                                    this.ships[ship].pos[1],
                                    this.ships[ship].wanderDirection,
                                    this.settings.shipIdle * fpsCompensation
                                )
                        }
                    }
                    // do ship firing fourth
                    if(this.ships[ship].targetShip){
                        var shouldShoot = 0;
                        if(targetDist < this.settings.shipFireRange){
                            var ms = Date.now();
                            if(this.ships[ship].shotsFired >= this.settings.gunAmmo){
                                if(ms - this.ships[ship].lastReload > this.settings.gunReload){
                                    this.ships[ship].shotsFired = 0;
                                    shouldShoot = 1;
                                }
                            }else{
                                shouldShoot = 1;
                            }
                            if(!this.soundShoot){
                                shouldShoot = 0;
                            }
                            if(ms - this.ships[ship].lastFire > this.settings.gunDelay){
                                if(shouldShoot){
                                    var laserSpawnPos = this.pointFromAngle(
                                        this.ships[ship].pos[0],
                                        this.ships[ship].pos[1],
                                        targetAngle,
                                        this.ships[ship].size + 3
                                    );
                                    this.createLaser(
                                        ship,
                                        laserSpawnPos,
                                        targetAngle + Math.random() * this.settings.gunInaccuracy - this.settings.gunInaccuracy * 0.5
                                    );
                                    this.ships[ship].shotsFired++;
                                    this.ships[ship].lastFire = ms;
                                    if(this.ships[ship].shotsFired >= this.settings.gunAmmo){
                                        this.ships[ship].lastReload = ms;
                                    }
                                }
                            }
                        }
                    }
                    if(this.ships[ship].shotsFired >= this.settings.gunAmmo && Date.now() - this.ships[ship].lastReload > this.settings.gunReload){
                        this.ships[ship].shotsFired = 0;
                    }
                    // do ship velocities, lastPos, and wall collision bumping fifth
                    for(var i in this.ships){
                        var xOffset = -1;
                        var yOffset = -1;
                        if(Math.round(Math.random())){
                            xOffset = 1;
                        }
                        if(Math.round(Math.random())){
                            yOffset = 1;
                        }
                        if(this.ships[i].pos[0] < 0){
                            this.ships[i].pos[0] = 0;
                            this.ships[i].wanderDirection += 30 * xOffset;
                        }else if(this.ships[i].pos[0] > size[0]){
                            this.ships[i].pos[0] = size[0];
                            this.ships[i].wanderDirection += 30 * xOffset;
                        }
                        if(this.ships[i].pos[1] < 0){
                            this.ships[i].pos[1] = 0;
                            this.ships[i].wanderDirection += 30 * yOffset;
                        }else if(this.ships[i].pos[1] > size[1]){
                            this.ships[i].pos[1] = size[1];
                            this.ships[i].wanderDirection += 30 * yOffset;
                        }

                        this.ships[i].vel = [
                            this.ships[i].pos[0] - this.ships[i].lastPos[0],
                            this.ships[i].pos[1] - this.ships[i].lastPos[1]
                        ];
                        this.ships[i].lastPos = [
                            this.ships[i].pos[0],
                            this.ships[i].pos[1]
                        ];
                    }

                    // draw ships
                    canvas.fillStyle = this.ships[ship].color;
                    var shipDrawColor = this.visBassAvg / (this.visBassAvgVolume + this.settings.soundMemoryAdd) * 255;
                    shipDrawColor = Math.pow(shipDrawColor, 2) / 255
                    if(shipDrawColor > 255){
                        shipDrawColor = 255;
                    }
                    canvas.strokeStyle = getColor(shipDrawColor);
                    canvas.lineWidth = 2;
                    canvas.beginPath();
                    canvas.arc(
                        this.ships[ship].pos[0],
                        this.ships[ship].pos[1],
                        this.ships[ship].size / 2,
                        0,
                        this.deg2rad(360)
                    );
                    canvas.fill();
                    canvas.stroke();
                    canvas.beginPath();
                    canvas.arc(
                        this.ships[ship].pos[0],
                        this.ships[ship].pos[1],
                        1,
                        0,
                        this.deg2rad(360)
                    );
                    canvas.stroke();

                    if(smokeEnabled){
                        // draw ships
                        smoke.fillStyle = getColor(shipDrawColor);
                        smoke.beginPath();
                        smoke.arc(
                            this.ships[ship].pos[0],
                            this.ships[ship].pos[1],
                            this.ships[ship].size * 0.75,
                            0,
                            this.deg2rad(360)
                        );
                        smoke.fill();
                    }

                    // debug drawing
                    if(this.settings.debug){
                        canvas.lineWidth = 1;
                        // green line if wandering
                        if(this.ships[ship].moveMode === "default"){
                            canvas.strokeStyle = "#00FF00";
                            canvas.beginPath();
                            canvas.moveTo(this.ships[ship].pos[0], this.ships[ship].pos[1]);
                            var drawTarget = this.pointFromAngle(
                                this.ships[ship].pos[0],
                                this.ships[ship].pos[1],
                                this.ships[ship].wanderDirection,
                                70
                            );
                            canvas.lineTo(drawTarget[0], drawTarget[1]);
                            canvas.stroke();
                        }
                        // orange line to lasers being dodged
                        // cyan line is dodging angle
                        if(this.ships[ship].dodging){
                            if(this.lasers[this.ships[ship].dodging]){
                                canvas.strokeStyle = "#FF7F00";
                                canvas.beginPath();
                                canvas.moveTo(this.ships[ship].pos[0], this.ships[ship].pos[1]);
                                canvas.lineTo(
                                    this.lasers[this.ships[ship].dodging].pos[0],
                                    this.lasers[this.ships[ship].dodging].pos[1]
                                );
                                canvas.stroke();
                                    
                                canvas.strokeStyle = "#00FFFF";
                                canvas.beginPath();
                                canvas.moveTo(this.ships[ship].pos[0], this.ships[ship].pos[1]);
                                var drawDodgeTarget = this.pointFromAngle(
                                    this.ships[ship].pos[0],
                                    this.ships[ship].pos[1],
                                    this.ships[ship].dodgeAngle,
                                    70
                                );
                                canvas.lineTo(drawDodgeTarget[0], drawDodgeTarget[1]);
                                canvas.stroke();
                            }
                        }
                        // yellow line points at target
                        // blue arc is comfortable fighting range
                        if(this.ships[ship].targetShip){
                            var targetCoord = this.pointFromAngle(
                                this.ships[ship].pos[0],
                                this.ships[ship].pos[1],
                                this.ships[ship].targetAngle,
                                this.ships[ship].targetDist
                            );
                            canvas.strokeStyle = '#0000FF';
                            canvas.beginPath();
                            canvas.arc(
                                targetCoord[0],
                                targetCoord[1],
                                this.settings.shipBattleRange - this.settings.shipBattleComfort,
                                this.deg2rad(this.ships[ship].targetAngle + 165),
                                this.deg2rad(this.ships[ship].targetAngle + 195)
                            );
                            canvas.stroke();
                            canvas.beginPath();
                            canvas.arc(
                                targetCoord[0],
                                targetCoord[1],
                                this.settings.shipBattleRange + this.settings.shipBattleComfort,
                                this.deg2rad(this.ships[ship].targetAngle + 165),
                                this.deg2rad(this.ships[ship].targetAngle + 195)
                            );
                            canvas.stroke();
                            canvas.beginPath();
                            canvas.moveTo(this.ships[ship].pos[0], this.ships[ship].pos[1]);
                            canvas.arc(
                                targetCoord[0],
                                targetCoord[1],
                                this.settings.shipBattleRange,
                                this.deg2rad(this.ships[ship].targetAngle + 180),
                                this.deg2rad(this.ships[ship].targetAngle + 180)
                            );
                            canvas.stroke();

                            canvas.strokeStyle = '#FFFF00';
                            canvas.beginPath();
                            canvas.moveTo(this.ships[ship].pos[0], this.ships[ship].pos[1]);
                            var drawTarget = this.pointFromAngle(
                                this.ships[ship].pos[0],
                                this.ships[ship].pos[1],
                                this.ships[ship].targetAngle,
                                70
                            );
                            canvas.lineTo(drawTarget[0], drawTarget[1]);
                            canvas.stroke();
                        }
                    }
                    // health and ammo
                    if(this.settings.shipLabels){
                        canvas.fillStyle = "#FFF";
                        canvas.font = "24px Sans-Serif";
                        canvas.fillText(
                            this.ships[ship].health + ", " + (this.settings.gunAmmo - this.ships[ship].shotsFired) + "/" + this.settings.gunAmmo,
                            this.ships[ship].pos[0] - this.ships[ship].size,
                            this.ships[ship].pos[1] - this.ships[ship].size
                        );
                    }
                }else{
                    if(Date.now() - this.ships[ship].lastDeath > this.settings.shipRespawn){
                        this.ships[ship].alive = 1;
                        this.ships[ship].health = this.settings.shipHealth;
                        this.ships[ship].pos = [
                            Math.floor(Math.random() * size[0]),
                            Math.floor(Math.random() * size[1])
                        ];
                        this.ships[ship].lastPos[0] = this.ships[ship].pos[0];
                        this.ships[ship].lastPos[0] = this.ships[ship].pos[1];
                    }
                }
            }
                
            // scoreboard
            if(this.settings.scoreboard){
                canvas.fillStyle = "#FFF";
                canvas.fillText("Score", 10, 40);
                var textPos = 40;
                for(var i in this.ships){
                    canvas.fillStyle = "#FFF";
                    textPos += 30;
                    canvas.fillText(this.ships[i].name + ": " + this.ships[i].score, 10, textPos);
                    canvas.fillStyle = this.ships[i].color;
                    canvas.fillRect(0, textPos - 24, 5, 30);
                }
                canvas.font = "24px Sans-Serif";
            }
        },
        angleFromPoints: function(x1, y1, x2, y2){
            return this.rad2deg(Math.atan2(y2 - y1, x2 - x1));
        },
        pointFromAngle: function(x, y, deg, dist){
            return [
                x + dist * Math.cos(this.deg2rad(deg)),
                y + dist * Math.sin(this.deg2rad(deg))
            ];
        },
        stop: function(){
            this.ships = {};
            this.lasers = {};
            this.visBassChangeMax = 0;
            this.visBassAccelMax = 0;
            this.visTrebAccelMax = 0;
            this.visTrebChangeMax = 0;
        },
        sizechange: function(){
            canvas.lineCap = "round";
        },
        btnDown: function(e){
            switch(e.keyCode){
                case 87: // w
                    blast.inputs.up = 1;
                    break;
                case 65: // a
                    blast.inputs.left = 1;
                    break;
                case 83: // s
                    blast.inputs.down = 1;
                    break;
                case 68: // d
                    blast.inputs.right = 1;
                    break;
                default:

            }
        },
        btnUp: function(e){
            switch(e.keyCode){
                case 87: // w
                    blast.inputs.up = 0;
                    break;
                case 65: // a
                    blast.inputs.left = 0;
                    break;
                case 83: // s
                    blast.inputs.down = 0;
                    break;
                case 68: // d
                    blast.inputs.right = 0;
                    break;
                default:
                    
            }
        },
        mouseDown: function(e){
            blast.inputs.mouse = 1;
        },
        mouseUp: function(e){
            blast.inputs.mouse = 0;
        },
        canvasParent: null,
        mouseMove: function(e){
            blast.inputs.x = e.pageX - blast.canvasParent.offsetLeft;
            blast.inputs.y = e.pageY - blast.canvasParent.offsetTop;
        },
        inputs: {
            left: 0,
            up: 0,
            right: 0,
            down: 0,
            mouse: 0,
            x: 0,
            y: 0
        },
        zoomableSettings: [
            "gunInaccuracy",
            "laserLength",
            "laserSpeed",
            "laserSize",
            "shipSightRange",
            "shipFireRange",
            "shipBattleRange",
            "shipBattleComfort",
            "shipIdle",
            "shipChase",
            "shipDodgeRange",
            "shipSize"
        ],
        settings: {
            // all time-related figures are in ms

            // draws AI debug lines
            debug: false,

            // enable or disable the player
            player: false,

            // false = black background
            // true = transparent background
            noBackground: true,
            zoom: 1,

            // shots before reloading
            gunAmmo: 1000000, // CHANGE ME
            // time between shots
            gunDelay: 300, // CHANGE ME
            // time it takes to reload
            gunReload: 300,
            // the higher this number, the more inaccurate the AI is
            gunInaccuracy: 16,

            // length of the laser (cosmetic)
            laserLength: 10,
            // speed of the laser
            laserSpeed: 10,
            // width of the laser (cosmetic)
            laserSize: 3,
            // color of the laser
            laserColor: "#F00",

            // number of AI ships
            shipCount: 2,
            // how far ships can spot enemies
            shipSightRange: 4000,
            // how far ships can fire at enemies
            shipFireRange: 3500,
            // ships will try to maintain this distance during combat
            shipBattleRange: 300,
            // the shipBattleRange area is this size
            shipBattleComfort: 40,
            // how much damage a ship can withstand
            shipHealth: 1000000,
            // size of ships
            shipSize: 32,
            // random "wiggle" in different AI actions - idle wandering, dodging, battling
            shipWander: 10,
            // speed the AI travels while idle wandering
            shipIdle: 3,
            // speed the AI travels during combat
            shipChase: 6,
            // the AI will dodge lasers that come within this distance
            shipDodgeRange: 100,
            // it takes this long to come back after being killed
            shipRespawn: 100,
            // the AI will change directions if it's been dodging the same direction for this long
            dodgeTime: 1000,

            // label health and ammo above ships
            shipLabels: false,
            scoreboard: true,


            // plain avg formula will trigger if louder than x * 255
            soundSensitivity: 0.35,
            // memory formula will remember this many frames
            soundMemory: 60, // 60 = appx 1 second
            // added to memory value, larger numbers make bots less sound sensitive
            soundMemoryAdd: 6

        },

        /*
        calculate the amount of up / down in the frequencies
            - how extreme are the "mountains"?
            - or perhaps total "accelleration" per zone?

        bass controls lasers - allow firing hopefully to beat of the song
    

        treble controls movement?
        */

        visBassChange: 0,
        visBassChangeMax: 0,
        visTrebChange: 0,
        visTrebChangeMax: 0,
        visBassAccel: 0,
        visBassAccelMax: 0,
        visTrebAccel: 0,
        visTrebAccelMax: 0,

        ships: {},
        totalShips: 0,
        lasers: {},
        totalLasers: 0,

        piBy180: Math.PI / 180,
        _180ByPi: 180 / Math.PI,
        deg2rad: function(deg){
            return deg * this.piBy180;
        },
        rad2deg: function(rad){
            return rad * this._180ByPi;
        }
    },
    piano: {
        name: "Piano Test",
        image: "visualizers/pianoTest.png",
        start: function(){
            /*

            1014 = 739.989 = F5#

            957 = 698.456 = F5
            
            ----
            
            47 = 138.591 = C3#
            
            45 = 130.813 = C3
            
            ----
            
            lowest note line = 45
            
            highest note line = 1014
            
            0.0629514964 notes per line on average
            
            57 lines per note @ high
            
            2 lines per note @ low
            
            ----
            
            61 keys in total
            
            1014-45 = 969 screen lines

            left edge = 40

            45 47 50 53 56 59 63 67 71 75 80 84 89 95 100 106 112 119 126 134 142 150 159 169 179 189 200 212 225 238 253 268 284 301 320 339 359 379 402 426 452 478 507 537 569 603 638 676 717 759 808 855 907 960 1018 1078 1142 1210 1282 1358 1439
            
            */
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var finalKey = this.keys.length - 1;
            var pianoWidth = finalKey * 20 + finalKey + 22;
            var pianoLeft = size[0] / 2 - Math.floor(pianoWidth / 2);
            var pianoTop = size[1] / 2 - 201;
            canvas.fillStyle = "#7F7F7F";
            canvas.fillRect(pianoLeft, pianoTop, pianoWidth, 402);
            for(var i = 0; i <= finalKey; i++){
                if(i === 0){
                    var leftCount = Math.floor(this.keys[i] - (this.keys[i + 1] - this.keys[i]) * 0.25);
                    var rightCount = Math.round(this.keys[i] + (this.keys[i + 1] - this.keys[i]) * 0.25);
                }else if(i === finalKey){
                    var leftCount = Math.floor(this.keys[i] - (this.keys[i] - this.keys[i - 1]) * 0.25);
                    var rightCount = Math.round(this.keys[i] + (this.keys[i] - this.keys[i - 1]) * 0.25);
                }else{
                    var leftCount = Math.floor(this.keys[i] - (this.keys[i] - this.keys[i - 1]) * 0.25);
                    var rightCount = Math.round(this.keys[i] + (this.keys[i + 1] - this.keys[i]) * 0.25);
                }
                var strength = 0;
                for(var j = leftCount; j < rightCount; j++){
                    //strength += Math.sqrt(visData[j]) * this.sqrt255;
                    //strength += Math.pow(visData[j], 2) / 255;
                    strength += visData[j];
                    //strength = Math.max(strength, visData[j]);
                }
                strength /= rightCount - leftCount;
                if(this.blackKeys[i]){
                    canvas.fillStyle = "#000";
                    canvas.fillRect(pianoLeft + i * 20 + i + 1, pianoTop + 1, 20, 200);
                    canvas.fillStyle = getColor(strength);
                    canvas.fillRect(pianoLeft + i * 20 + i + 1, pianoTop + 1, 20, 200);
                    if(smokeEnabled){
                        smoke.fillStyle = getColor(strength);
                        smoke.fillRect(pianoLeft + i * 20 + i + 1, pianoTop + 1, 20, 200);
                    }
                }else{
                    canvas.fillStyle = "#FFF";
                    canvas.fillRect(pianoLeft + i * 20 + i + 1, pianoTop + 1, 20, 400);
                    canvas.fillStyle = getColor(strength);
                    canvas.fillRect(pianoLeft + i * 20 + i + 1, pianoTop + 1, 20, 400);
                    if(smokeEnabled){
                        smoke.fillStyle = getColor(strength);
                        smoke.fillRect(pianoLeft + i * 20 + i + 1, pianoTop + 1, 20, 400);
                    }
                }
            }
        },
        stop: function(){

        },
        sqrt255: Math.sqrt(255),
        keys: [
            45, 47, 50, 53, 56, 59, 63, 67, 71, 75, 80, 84, 89, 95,
            100, 106, 112, 119, 126, 134, 142, 150, 159, 169, 179, 189,
            200, 212, 225, 238, 253, 268, 284, 301, 320, 339, 359, 379,
            402, 426, 452, 478, 507, 537, 569, 603, 638, 676, 717, 759,
            808, 855, 907, 960, 1018, 1078, 1142, 1210, 1282, 1358, 1439
        ],
        blackKeys: [
            0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0,
            0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0,
            0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0,
            0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0,
            0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0
        ]
    },
    bassSplit: {
        name: "Bass Split (&lt;180)",
        image: "visualizers/bassSplit.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            canvas.fillStyle = "#000";
            canvas.fillRect(0, size[1] / 2 + 127, size[0], size[1] / 2 - 127);
            smoke.clearRect(0, 0, size[0], size[1]);
            var left = size[0] / 2 - 512;
            var top = size[1] / 2 - 128;
            for(var i = 0; i < 1024; i++){
                this.drawLine(i, visData[i], left + (i >= 180) * 90 - (i < 180) * 90, top);
            }
            //updateSmoke();
        },
        stop: function(){
            
        },
        drawLine: function(x, h, l, t){
            var fillColor = getColor(h, x / 4);
            canvas.fillStyle = fillColor;
            canvas.fillRect(l + x, t + (255 - h), 1, h);
            if(smokeEnabled){
                smoke.fillStyle = fillColor;
                smoke.fillRect(l + x, t + (255 - h), 1, h * 2);
            }
        }
    },
    colorTest: {
        name: "Color Test",
        image: "visualizers/colorTest.png",
        start: function(){

        },
        frame: function(){
            smoke.clearRect(0, 0, size[0], size[1]);
            smoke.fillStyle = '#111';
            smoke.fillRect(0, 0, size[0], size[1] * 0.15);
            for(var i = 0; i < size[0]; i++){
                smoke.fillStyle = getColor(i / size[0] * 255);
                smoke.fillRect(i, size[1] * 0.75, 1, size[1] * 0.25);
            }
            //updateSmoke();
            canvas.clearRect(0, 0, size[0], size[1]);
            for(var i = 0; i < size[0]; i++){
                canvas.fillStyle = getColor(i / size[0] * 255);
                canvas.fillRect(i, 0, 1, size[1]);
            }
            canvas.clearRect(0, size[1] * 0.5, size[0], size[1] * 0.25);
        },
        stop: function(){

        }
    },
    modTest: {
        name: "Mod Test",
        //image: "visualizers/modTest.png",
        start: function(){

        },
        frame: function(){
            smoke.clearRect(0, 0, size[0], size[1]);
            canvas.clearRect(0, 0, size[0], size[1]);
            canvas.fillStyle = '#FFF';
            var leftEdge = size[0] / 2 - 255;
            var topEdge = size[1] / 2 - 127;
            for(var i = 0; i < 510; i++){
                if(currMod){
                    var value = mods[currMod].test(255 - Math.abs(i - 255));
                }else{
                    var value = 255 - Math.abs(i - 255);
                }
                canvas.fillRect(leftEdge + i, topEdge + 255 - value, 1, value);
            }
            canvas.fillRect(leftEdge - 1, 0, 1, size[1]);
        },
        stop: function(){

        }
    }
};

for(var i in colors){
    getId('colorfield').innerHTML += '<option value="' + i + '">' + colors[i].name + '</option>';
}

for(var i in vis){
    getId('visfield').innerHTML += '<option value="' + i + '">' + vis[i].name + '</option>';
}

for(var i in mods){
    getId('modfield').innerHTML += '<option value="' + i + '">' + mods[i].name + '</option>';
}

var smokeEnabled = 0;
var smokePos = [0, 0];
var smokeScreen1 = getId("smokeScreen1");
var smokeScreen2 = getId("smokeScreen2");
function toggleSmoke(){
    if(smokeEnabled){
        smokeElement.style.filter = "";
        smoke.clearRect(0, 0, size[0], size[1]);
        smokeElement.classList.add("disabled");
        smokeScreen1.classList.add("disabled");
        smokeScreen2.classList.add("disabled");
        getId("smokeButton").style.borderColor = "#C00";
        /*
        canvasElement.style.backgroundPosition = "";
        canvasElement.style.backgroundImage = "";
        */
        smokeEnabled = 0;
    }else{
        smokeElement.classList.remove("disabled");
        if(!transparentMode){
            smokeScreen1.classList.remove("disabled");
            smokeScreen2.classList.remove("disabled");
        }
        getId("smokeButton").style.borderColor = "#0A0";
        /*
        canvasElement.style.backgroundPosition = "0px 0px";
        canvasElement.style.backgroundImage = "url(smoke_transparent.png)";
        */
        smokeEnabled = 1;
        resizeSmoke();
        if(vis[currVis].sizechange){
            vis[currVis].sizechange();
        }
    }
}
function resizeSmoke(){
    smokeElement.width = size[0];
    smokeElement.height = size[1];
    if(smokeEnabled){
        if(transparentMode){
            if(performanceMode){
                smokeElement.style.filter = "blur(" + Math.round((size[0] + size[1]) / 50) + "px) brightness(2)";
            }else{
                smokeElement.style.filter = "blur(" + Math.round((size[0] * 0.5 + size[1] * 0.5) / 50) + "px) brightness(2)";
            }
        }else{
            if(performanceMode){
                smokeElement.style.filter = "blur(" + Math.round((size[0] * 2 + size[1] * 2) / 50) + "px) brightness(4)";
            }else{
                smokeElement.style.filter = "blur(" + Math.round((size[0] + size[1]) / 50) + "px) brightness(4)";
            }
        }
    }
}
function updateSmoke(leftpos, toppos, shortwidth, shortheight){
    if(smokeEnabled){
        smoke.clearRect(0, 0, size[0], size[1]);
        smoke.putImageData(canvas.getImageData(leftpos || 0, toppos || 0, shortwidth || size[0], shortheight || size[1]), leftpos || 0, toppos || 0);
    }
}
function smokeFrame(){
    if(!transparentMode){
        smokePos[0] += 2 * fpsCompensation;
        smokePos[1] += fpsCompensation;
        if(smokePos[0] >= 1000){
            smokePos[0] -= 1000;
        }
        if(smokePos[1] >= 1000){
            smokePos[1] -= 1000;
        }
        smokeScreen1.style.backgroundPosition = smokePos[0] + "px " + smokePos[1] + "px";
        smokeScreen2.style.backgroundPosition = (smokePos[1] + 250) + "px " + (smokePos[0] - 175) + "px";
    }
}

resizeSmoke();

var featuredVis = {
    monstercat: 1,
    spikes: 1,
    circle: 1,
    bassCircle: 1
};

function openVisualizerMenu(){
    if(getId("selectOverlay").classList.contains("disabled")){
        getId("selectOverlay").classList.remove("disabled");
        var tempHTML = '';
        var namecolor = "";
        if('none' === getId("visfield").value){
            namecolor = ' style="outline:2px solid ' + getColor(255) + ';"';
        }
        if(vis.none.image){
            tempHTML += '<div' + namecolor + ' class="visOption" onclick="overrideVis(\'' + i + '\')"><img src="' + vis.none.image + '">' + vis.none.name + '</div>';
        }else{
            tempHTML += '<div' + namecolor + ' class="visOption" onclick="overrideVis(\'' + i + '\')"><span></span>' + vis.none.name + '</div>';
        }
        tempHTML += '<div style="height:auto;background:none;"><hr></div>';
        tempHTML += '&nbsp; Featured:<br>';
        for(var i in featuredVis){
            var namecolor = "";
            if(i === getId("visfield").value){
                namecolor = ' style="outline:2px solid ' + getColor(255) + ';"';
            }
            if(vis[i].image){
                tempHTML += '<div' + namecolor + ' class="visOption" onclick="overrideVis(\'' + i + '\')"><img src="' + vis[i].image + '">' + vis[i].name + '</div>';
            }else{
                tempHTML += '<div' + namecolor + ' class="visOption" onclick="overrideVis(\'' + i + '\')"><span></span>' + vis[i].name + '</div>';
            }
        }
        for(var i in vis){
            if(i.indexOf("SEPARATOR") === -1){
                if(i !== 'none'){
                    var namecolor = "";
                    if(i === getId("visfield").value){
                        namecolor = ' style="outline:2px solid ' + getColor(255) + ';"';
                    }
                    if(vis[i].image){
                        tempHTML += '<div' + namecolor + ' class="visOption" onclick="overrideVis(\'' + i + '\')"><img src="' + vis[i].image + '">' + vis[i].name + '</div>';
                    }else{
                        tempHTML += '<div' + namecolor + ' class="visOption" onclick="overrideVis(\'' + i + '\')"><span></span>' + vis[i].name + '</div>';
                    }
                }
            }else{
                tempHTML += '<div style="height:auto;background:none;"><hr></div>';
                tempHTML += '&nbsp; ' + vis[i].name + ":<br>";
            }
        }
        getId("selectContent").innerHTML = tempHTML;
        getId("selectContent").scrollTop = 0;
    }else{
        closeMenu();
    }
}

function overrideVis(selectedVisualizer){
    getId("visfield").value = selectedVisualizer;
    closeMenu();
    getId("visfield").onchange();
}

function openColorMenu(){
    if(getId("selectOverlay").classList.contains("disabled")){
        getId("selectOverlay").classList.remove("disabled");
        var tempHTML = '';
        for(var i in colors){
            if(i.indexOf("SEPARATOR") === -1){
                var namecolor = "";
                if(i === getId("colorfield").value){
                    namecolor = ' style="outline:2px solid ' + getColor(255) + ';"';
                }
                if(colors[i].image){
                    tempHTML += '<div' + namecolor + ' class="colorOption" onclick="overrideColor(\'' + i + '\')">' + colors[i].name + '<br><img src="' + colors[i].image + '"></div>';
                }else{
                    tempHTML += '<div' + namecolor + ' class="colorOption" onclick="overrideColor(\'' + i + '\')">' + colors[i].name + '</div>';
                }
            }else{
                tempHTML += '<div style="height:auto;background:none;"><hr></div>';
            }
        }
        getId("selectContent").innerHTML = tempHTML;
        getId("selectContent").scrollTop = 0;
    }else{
        closeMenu();
    }
}

function overrideColor(selectedColor){
    getId("colorfield").value = selectedColor;
    closeMenu();
    getId("colorfield").onchange();
}

function openModMenu(){
    if(getId("selectOverlay").classList.contains("disabled")){
        getId("selectOverlay").classList.remove("disabled");
        var tempHTML = '';
        if(!currMod){
            tempHTML += '<div style="outline:2px solid ' + getColor(255) + ';" class="modOption" onclick="overrideMod(\'null\')"><img src="mods/null.png">None</div>';
        }else{
            tempHTML += '<div class="modOption" onclick="overrideMod(\'null\')"><img src="mods/null.png">None</div>';
        }
        tempHTML += '<div style="height:auto;background:none;"><hr></div>';
        for(var i in mods){
            if(i.indexOf("SEPARATOR") === -1){
                var namecolor = "";
                if(i === getId("modfield").value){
                    namecolor = ' style="outline:2px solid ' + getColor(255) + ';"';
                }
                if(mods[i].image){
                    tempHTML += '<div' + namecolor + ' class="modOption" onclick="overrideMod(\'' + i + '\')"><img src="' + mods[i].image + '">' + mods[i].name + '</div>';
                }else{
                    tempHTML += '<div' + namecolor + ' class="modOption" onclick="overrideMod(\'' + i + '\')"><span></span>' + mods[i].name + '</div>';
                }
            }else{
                tempHTML += '<div style="height:auto;background:none;"><hr></div>';
            }
        }
        getId("selectContent").innerHTML = tempHTML;
        getId("selectContent").scrollTop = 0;
    }else{
        closeMenu();
    }
}

function overrideMod(selectedMod){
    getId("modfield").value = selectedMod;
    closeMenu();
    getId("modfield").onchange();
}

function openSettingsMenu(){
    if(getId("selectOverlay").classList.contains("disabled")){
        getId("selectOverlay").classList.remove("disabled");
        var tempHTML = '<div style="font-size:0.5em;background:transparent">';

        if(!microphoneActive){
            if(!webVersion){
                tempHTML += "<p style='font-size:2em'>Self-Close</p>" +
                    'Songs: <input style="width:50px" type="number" id="selfcloseinput" min="1" max="9999" value="' + selfCloseSongs + '" step="1" onchange="selfCloseSongs = this.value;"></input>' +
                    ' <button onclick="toggleSelfClose()" id="selfclosebutton" style="border-color:' + debugColors[selfCloseEnabled] + '">Toggle</button>' +
                    "<p>The music player will close itself after playing a number of songs.</p>";
            }

            tempHTML += "<br><br><p style='font-size:2em'>Audio Delay</p>" +
                'Seconds: <input style="width: 50px" type="number" id="delayinput" min="0" max="1" value="' + delayNode.delayTime.value + '" step="0.01" onchange="setDelay(this.value)"></input>' +
                "<p>If the visualizer and the music don't line up, try changing this.<br>Larger numbers delay the audible music more.</p>";

            tempHTML += '<br><br><p style="font-size:2em">Song Info</p>' +
                'Info detected: ' + (['No', 'Yes'])[0 + (fileInfo.hasOwnProperty('_default_colors'))] + '<br>' +
                '<button onclick="generateSongInfo()">Generate Info</button><br>' +
                'Select-All + Copy generated info from below, save to "_songInfo.txt" in your music\'s main folder, modify as you see fit.<br>' +
                '<textarea id="songInfoTemplate" style="height:64px;"></textarea>'
        }
        tempHTML += '<br><br><p style="font-size:2em">Transparent Mode</p>' +
        'Current Mode: ' + windowType + '<br>' +
        '<button onclick="ipcRenderer.send(\'toggle-transparent\', {x: screen.width, y: screen.height})">Toggle</button>';

        tempHTML += "<br><br><p style='font-size:2em'>Fast Mode</p>" +
        '<button onclick="togglePerformance()" id="performanceButton" style="border-color:' + debugColors[performanceMode] + '">Toggle</button>' +
            "<p>If performance is slow, this option lowers quality to help weaker devices.</p>";

        tempHTML += "<br><br><p style='font-size:2em'>Debug Mode</p>" +
        '<button onclick="toggleFPS()" id="debugButton" style="border-color:' + debugColors[debugForce] + '">Toggle</button>' +
            "<p>Intended for developer use. Enables various debug overlays.</p>";

        tempHTML += "</div>";
        getId("selectContent").innerHTML = tempHTML;
        getId("selectContent").scrollTop = 0;
    }else{
        closeMenu();
    }
}

function closeMenu(){
    getId("selectContent").innerHTML = "";
    getId("selectOverlay").classList.add("disabled");
}

var selfCloseEnabled = 0;
var selfCloseSongs = 10;
function toggleSelfClose(){
    selfCloseEnabled = Math.abs(selfCloseEnabled - 1);
    if(getId("selfclosebutton")){
        getId("selfclosebutton").style.borderColor = debugColors[selfCloseEnabled];
    }
}
function checkSelfClose(){
    if(selfCloseEnabled){
        selfCloseSongs--;
        if(selfCloseSongs <= 0){
            getId("currentlyPlaying").innerHTML = "Window will close in 5 seconds."
            setTimeout(() => {
                remote.getCurrentWindow().close();
            }, 5000);
            return 1;
        }else{
            return 0;
        }
    }else{
        return 0;
    }
}

var transparentMode = 0;
function updateWindowType(){
    /*if(windowType === "opaque"){
        transparentMode = 0;
        document.body.classList.remove("transparent");
        document.body.parentNode.classList.remove("transparent");
        document.getElementsByClassName("winHTML")[0].classList.remove("transparent");
    }else */
    if(windowType === "transparent"){
        transparentMode = 1;
        document.body.classList.add("transparent");
        document.body.parentNode.classList.add("transparent");
        document.getElementsByClassName("winHTML")[0].classList.add("transparent");
        getId("introduction").classList.add("transparentPlatform");
        getId("currentlyPlaying").classList.add("transparentPlatform");
        getId("controls").classList.add("transparentPlatform");
        getId("songList").classList.add("transparentPlatform");
        getId("visualizer").classList.add("transparent");
        getId("smokeButton").innerHTML = "Glow";
        remote.getCurrentWindow().setIgnoreMouseEvents(false);

        featuredVis = {
            edgeSpectrum: 1,
            bottomSpectrum: 1,
            fullBassEdge: 1,
            edgeBars: 1,
            bottomBars: 1,
            fullEdge: 1
        }
        setVis("edgeSpectrum");
    }
}

var taskbarMode = 0;
var previousVis = "";
function toggleTaskbarMode(){
    if(taskbarMode){
        /*
        aosTools.setDims({
            x: "auto",
            y: "auto",
            width: 1038,
            height: 626
        });
        */
        remote.getCurrentWindow().setBounds({
            x: (screen.width - 1048) / 2,
            y: (screen.height - 632) / 2,
            width: 1048,
            height: 650
        });
        taskbarMode = 0;
        getId("taskbarButton").style.borderColor = "#C00";
        if(currVis === "spectrumBass"){
            overrideVis(previousVis);
        }
    }else{
        /*
        aosTools.getScreenDims(finishSettingTaskbarMode);
        */
        remote.getCurrentWindow().setBounds({
            x: -9,
            y: screen.height - 148,
            width: screen.width + 17,
            height: 160
        });
        taskbarMode = 1;
        getId("taskbarButton").style.borderColor = "#0A0";
        previousVis = currVis;
        overrideVis("spectrumBass");
    }
}
function finishSettingTaskbarMode(res){
    /*
    aosTools.setDims({
        x: -0.5 * windowBorders[0] - 4,
        y: res.content.height - 109 - windowBorders[1] + windowBorders[0] * 0.5,
        width: res.content.width + 8 + windowBorders[0],
        height: 113 + windowBorders[1],
    });
    */
    overrideVis("spectrumBass");
}

window.addEventListener("keypress", function(event){
    if(event.key.toLowerCase() === "f"){
        toggleFullscreen();
    }
});

if(!webVersion){
    delete vis.windowRecolor;
    delete vis.bassWindowRecolor;
    getId("filesNotUploadedDisclaimer").style.display = "none";
}