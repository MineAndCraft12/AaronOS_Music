window.onerror = (message, source, lineno, colno, error) => {
    console.log(
        "AaronOS Music Player\n" +
        "Error in " + source + '[' + lineno + ', ' + colno + ']:\n\n' +
        message
    );
};

var webVersion = 0;
var aosToolsConnected = 0;
//let remote, ipcRenderer, desktopCapturer = null;
try{
    var {
        // remote,
        ipcRenderer,
        // desktopCapturer
    } = require('electron');
    var remote = require('@electron/remote');
}catch(err){
    console.log("Error requiring electron -- assuming web version");
    console.log(err);
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

var navigatorPlatform = "";
if(navigator.userAgentData){
    if(navigator.userAgentData.platform){
        navigatorPlatform = navigator.userAgentData.platform;
    }else{
        navigatorPlatform = navigator.platform;
    }
}else{
    navigatorPlatform = navigator.platform;
}

var systemAudioStreamType = 'electron';
if(webVersion){
    // mobile devices cannot use system audio
    if(window.matchMedia){
        if(!window.matchMedia("(pointer: fine)").matches){
            getId("systemAudioIcon").style.opacity = "0.25";
            getId("systemAudioIcon").title = "System Audio does not work on most mobile devices. Feel free to try it anyway.";
        }
    }
    // firefox cannot use system audio
    if(navigator.userAgentData){
        for(var i in navigator.userAgentData.brands){
            if(navigator.userAgentData.brands[i].brand.indexOf("Firefox") !== -1){
                getId("systemAudioIcon").style.opacity = "0.25";
                getId("systemAudioIcon").title = "System Audio does not work on Firefox. Feel free to try it anyway.";
                break;
            }
        }
    }else{
        if(navigator.userAgent.indexOf("Firefox") !== -1){
            getId("systemAudioIcon").style.opacity = "0.25";
            getId("systemAudioIcon").title = "System Audio does not work on Firefox. Feel free to try it anyway.";
        }
    }

    // detect incompatible browsers for system audio
    if(typeof navigator.mediaDevices === "object"){
        if(typeof navigator.mediaDevices.getDisplayMedia === "function"){
            systemAudioStreamType = 'navigator';
        }else{
            getId("systemAudioIcon").style.display = "none";
        }
    }else{
        getId("systemAudioIcon").style.display = "none";
    }
    // change icons on Mac
    if(navigatorPlatform.indexOf("Mac") === 0){
        getId("filesIcon").src = "icons/mac_files.png";
        getId("folderIcon").src = "icons/mac_folder.png";
        getId("microphoneIcon").src = "icons/mac_microphone.png";
    }
    // change system audio title on Linux and Mac, they can only use browser tabs
    if(navigatorPlatform.indexOf("Linux") === 0 || navigatorPlatform.indexOf("Mac") === 0){
        getId("systemAudioSpanText").innerHTML = "Browser Tab";
    }

    // web version can't be transparent
    getId("transparentModeIcons").style.display = "none";
    // web version can't resize itself
    getId("tskbrModeRange").style.display = "none";
}else{
    // remove page title since the page needs more room to display disclaimer
    getId("appTitle").style.display = "none";
    getId("selectAudioSourceIcons").style.marginTop = "";

    // disable system audio icon on mac because it's not allowed
    if(navigatorPlatform.indexOf("Mac") === 0){
        getId("systemAudioIcon").style.display = "none";
        getId("filesIcon").src = "icons/mac_files.png";
        getId("folderIcon").src = "icons/mac_folder.png";
        getId("microphoneIcon").src = "icons/mac_microphone.png";
    }

    // hide system audio on linux because it's broken on most systems
    if(navigatorPlatform.indexOf("Linux") === 0){
        getId("systemAudioIcon").style.opacity = "0.25";
        getId("systemAudioIcon").title = "System Audio does not work on most Linux systems. Feel free to try it anyway.";
    }

    // taskbar mode is designed with windows taskbar
    if(navigatorPlatform.indexOf("Win") !== 0){
        getId("tskbrModeRange").style.display = "none";
    }
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
if(navigatorPlatform.indexOf("Win") === 0 && !webVersion){
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
        remote.nativeTheme.removeAllListeners();
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

var audioContext;
var mediaSource;

var delayNode;
function setDelay(newDelay){
    delayNode.delayTime.value = (newDelay || 0);
    localStorage.setItem("AaronOSMusic_Delay", String(newDelay));
}

function setVolume(newVolume){
    audio.volume = newVolume;
}

var analyser;
function setSmoothingTimeConstant(newValue){
    analyser.smoothingTimeConstant = newValue;
    localStorage.setItem("AaronOSMusic_SmoothingTimeConstant", String(newValue));
}

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
var fileInfo = {};
var filesLength = 0;

var tracks = {};

var supportedFormats = ['aac', 'aiff', 'wav', 'm4a', 'mp3', 'amr', 'au', 'weba', 'oga', 'wma', 'flac', 'ogg', 'opus', 'webm'];

var URL;

function printDirToTable(dir){
    var dirstr = '';
    for(var i in dir){
        if(i !== '__isDirectory'){
            if(dir[i]['__isDirectory']){
                dirstr += '<tr class="hasNestedTable"><td colspan="3" class="nestedTableParentCell collapsedNestedTable">' +
                    '<div class="nestedTableToggle" onclick="this.parentNode.classList.toggle(\'collapsedNestedTable\')"><span class="expandTriangle"></span> ' + i + '</div>' +
                    '<table><thead><tr class="tableheader"><th>no.</th><th>Format</th><th width="100%">Title</th></tr></thead><tbody>';
                dirstr += printDirToTable(dir[i]);
                dirstr += '</tbody></table></td></tr>';
            }else{
                dirstr += '<tr id="song' + dir[i].trackID + '" onclick="selectSong(' + dir[i].trackID + ')"><td style="text-align:right">' +
                    dir[i].trackID + '</td><td>' +
                    dir[i].format + '</td><td style="width:100%;">' +
                    dir[i].title + '</td></tr>';
            }
        }
    }
    return dirstr;
}
function listSongs(){
    var str = "";
    str += '<table id="trackTable">';
    if(shuffleMode){
        str += '<thead><tr class="tableheader"><th style="text-align:right;">Folder</th><th>no.</th><th>Format</th><th width="100%">Title</th></tr></thead><tbody>';
        for(var i = 0; i < shuffledTracklist.length; i++){
            str += '<tr id="song' + shuffledTracklist[i] + '" onclick="selectSong(' + shuffledTracklist[i] + ');shufflePosition = ' + i + '"><td style="text-align:right;">' +
                trackListFlat[shuffledTracklist[i]].dirPath.join(' / ') + '</td><td style="text-align:right;">' +
                trackListFlat[shuffledTracklist[i]].trackID + '</td><td>' +
                trackListFlat[shuffledTracklist[i]].format + '</td><td style="width:100%;">' +
                trackListFlat[shuffledTracklist[i]].title + '</td></tr>';
        }
    }else{
        str += '<thead><tr class="tableheader"><th>no.</th><th>Format</th><th width="100%">Title</th></tr></thead><tbody>';
        str += printDirToTable(tracks);
    }
    str += '</tbody></table>';
    songList.innerHTML = str;
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

/*
var customColors = {};
if(localStorage.getItem("AaronOSMusic_customColors")){
    customColors = JSON.parse(localStorage.getItem("AaronOSMusic_customColors"));
}
*/

function openCustomColorMenu(){
    closeMenu();
    getId("selectOverlay").classList.remove("disabled");
    var tempHTML = '<div style="font-size:0.5em;background:transparent">';

    tempHTML += '<p style="font-size:3em">Custom Color Settings</p>';

    if(trackListFlat.length > 0 && folderName.length > 0){
        tempHTML += '<p>This menu allows you to customize color gradients individually for each of your songs.<br>Come back here when you\'re done to save changes.</p>';
        tempHTML += '<button onclick="saveCustomColors()">Save Changes</button> <i>Instructions below!</i>';
        tempHTML += '<p style="margin-left:8px;padding-left:8px;border-left:1px solid #FFF;border-radius:6px;">Navigate to your music folder "' + folderName + '".<br>Save the file as "zzz_aOSmusic_colorInfo.json" alongside your music.</p>';

        var filesSeen = [];
        for(var i in trackListFlat){
            tempHTML += '<div style="background:transparent;height:19px;overflow:hidden;margin-bottom:16px;padding-left:16px;">';
            tempHTML += '<button style="margin-left:-16px;" onclick="if(this.parentNode.style.height === \'\'){this.parentNode.style.height = \'19px\'}else{this.parentNode.style.height = \'\'};">v</button> ';
            if(fileInfo[trackListFlat[i].fullPath]){
                tempHTML += '<span class="customColorPreview" style="background:linear-gradient(90deg';
                for(var j in fileInfo[trackListFlat[i].fullPath]){
                    tempHTML += ', ' + csscolor('rgba',
                        fileInfo[trackListFlat[i].fullPath][j].r,
                        fileInfo[trackListFlat[i].fullPath][j].g,
                        fileInfo[trackListFlat[i].fullPath][j].b,
                        fileInfo[trackListFlat[i].fullPath][j].a,
                    ) + ' ' + fileInfo[trackListFlat[i].fullPath][j].x + '%';
                }
                tempHTML += '); margin-right:0.5px;">&nbsp; &nbsp; &nbsp;</span> ';
            }else{
                tempHTML += '<span class="customColorPreview" style="background:#000;">&nbsp; &nbsp; &nbsp;</span> ';
            }
            tempHTML += trackListFlat[i].trackID + ": " + trackListFlat[i].dirPath.join(' / ') + (trackListFlat[i].dirPath.length > 0 ? ' / ' : '') + trackListFlat[i].title + '.' + trackListFlat[i].format + '<br><br>';
            tempHTML += '<span class="customColorInput" data-songpath="' + trackListFlat[i].fullPath + '"><span class="customColorStops">';

            if(fileInfo[trackListFlat[i].fullPath]){
                for(var j in fileInfo[trackListFlat[i].fullPath]){
                    tempHTML += '<span class="customColorStop" style="margin-left:0.5px;">' +
                        'At <input value="' + fileInfo[trackListFlat[i].fullPath][j].x + '" type="number" placeholder="0-100" min="0" max="100" step="1" style="width:50px"> % | ' +
                        'R: <input value="' + fileInfo[trackListFlat[i].fullPath][j].r + '" type="number" placeholder="0-255" min="0" max="255" step="1" style="width:50px"> ' +
                        'G: <input value="' + fileInfo[trackListFlat[i].fullPath][j].g + '" type="number" placeholder="0-255" min="0" max="255" step="1" style="width:50px"> ' +
                        'B: <input value="' + fileInfo[trackListFlat[i].fullPath][j].b + '" type="number" placeholder="0-255" min="0" max="255" step="1" style="width:50px"> ' +
                        'A: <input value="' + fileInfo[trackListFlat[i].fullPath][j].a + '" type="number" placeholder="0-1" min="0" max="1" step="0.01" value="1" style="width:50px"> ' +
                        '&nbsp; - &nbsp; <button onclick="this.parentNode.parentNode.removeChild(this.parentNode)"><i>Remove</i></button> &nbsp;<br><br></span>';
                }
            }

            tempHTML += '<span></span></span>';
            tempHTML += '<button onclick="addNewColorStop(this.parentNode)">Add New Color Stop</button><br><br>';
            tempHTML += '<button onclick="updateCustomColor(this.parentNode)">Set</button> <i>Remember to save when you\'re done!</i>';

            tempHTML += '</span></div>';
            
            filesSeen.push(trackListFlat[i].fullPath);
        }

        for(var i in fileInfo){
            if(filesSeen.indexOf(i) === -1){
                tempHTML += '<div style="background:transparent;height:19px;overflow:hidden;margin-bottom:16px;padding-left:16px;">';

                tempHTML += '<button style="margin-left:-16px;" onclick="if(this.parentNode.style.height === \'\'){this.parentNode.style.height = \'19px\'}else{this.parentNode.style.height = \'\'};">v</button> <span style="opacity:0.5">' + i + '</span><br><br>';

                tempHTML += '<span class="customColorInput" data-songpath="' + i + '"><span class="customColorStopList">';

                tempHTML += '<span></span>'

                tempHTML += '</span>';
                tempHTML += '<button onclick="addNewColorStop(this.parentNode)">Add New Color Stop</button><br><br>';
                tempHTML += '<button onclick="updateCustomColor(this.parentNode)">Set</button> <i>Remember to save when you\'re done!</i>';

                tempHTML += '</span></div>';
            }
        }
    }else{
        tempHTML += 'You have not loaded any songs. This does not work for System Audio or Microphone.';
    }

    tempHTML += "</div>";
    getId("selectContent").innerHTML = tempHTML;
    getId("selectContent").scrollTop = 0;
}

function addNewColorStop(elem){
    var tempElem = document.createElement("span");
    tempElem.classList.add("customColorStop");

    // without this, all text in the entire menu outside this element is blurry
    tempElem.style.marginLeft = "0.5px";

    tempElem.innerHTML += 'At <input type="number" placeholder="0-100" min="0" max="100" step="1" style="width:50px"> % | ' +
        'R: <input type="number" placeholder="0-255" min="0" max="255" step="1" style="width:50px"> ' +
        'G: <input type="number" placeholder="0-255" min="0" max="255" step="1" style="width:50px"> ' +
        'B: <input type="number" placeholder="0-255" min="0" max="255" step="1" style="width:50px"> ' +
        'A: <input type="number" placeholder="0-1" min="0" max="1" step="0.01" value="1" style="width:50px"> ' +
        '&nbsp; - &nbsp; <button onclick="this.parentNode.parentNode.removeChild(this.parentNode)"><i>Remove</i></button> &nbsp;<br><br>';
    elem.childNodes[0].appendChild(tempElem);
}

function updateCustomColor(elem){
    var elemsToHandle = [];
    if(elem){
        elemsToHandle = [elem];
    }else{
        elemsToHandle = document.getElementsByClassName("customColorInput");
    }

    for(var i = 0; i < elemsToHandle.length; i++){
        var colorStopElems = elemsToHandle[i].getElementsByClassName("customColorStop");

        var songPath = elemsToHandle[i].getAttribute("data-songpath");
        var colorStops = [];

        for(var j = 0; j < colorStopElems.length; j++){
            var inputBoxes = colorStopElems[j].getElementsByTagName("input");
            var x, r, g, b, a = 0;

            x = (inputBoxes[0].value.length > 0) ? parseInt(inputBoxes[0].value) : 0;
            x = (x < 0) ? 0 : ((x > 100) ? 100 : x);

            r = (inputBoxes[1].value.length > 0) ? parseInt(inputBoxes[1].value) : 0;
            r = (r < 0) ? 0 : ((r > 255) ? 255 : r);

            g = (inputBoxes[2].value.length > 0) ? parseInt(inputBoxes[2].value) : 0;
            g = (g < 0) ? 0 : ((g > 255) ? 255 : g);

            b = (inputBoxes[3].value.length > 0) ? parseInt(inputBoxes[3].value) : 0;
            b = (b < 0) ? 0 : ((b > 255) ? 255 : b);

            a = (inputBoxes[4].value.length > 0) ? parseFloat(inputBoxes[4].value) : 0;
            a = (a < 0) ? 0 : ((a > 1) ? 1 : a);

            colorStops.push({x: x, r: r, g: g, b: b, a: a});
        }

        colorStops.sort((a, b) => a.x - b.x);

        fileInfo[songPath] = colorStops;

        var tempCSS = 'linear-gradient(90deg';
        for(var j in colorStops){
            tempCSS += ', ' + csscolor('rgba',
                colorStops[j].r,
                colorStops[j].g,
                colorStops[j].b,
                colorStops[j].a,
            ) + ' ' + colorStops[j].x + '%';
        }
        tempCSS += ')';

        elemsToHandle[i].parentNode.getElementsByClassName("customColorPreview")[0].style.background = tempCSS;
    }
}

// from Kanchu on StackOverflow
function downloadTextFile(data, filename, type) {
    var file = new Blob([data], {type: type});
    var a = document.createElement("a"),
        url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);  
    }, 0);
}

function saveCustomColors(){
    updateCustomColor();
    downloadTextFile(JSON.stringify(fileInfo, null, '\t'), "zzz_aOSmusic_colorInfo.json", "application/json");
}

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
        case 1: // after sep. 22 2021 this is the only option
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

var folderName = "";
var fileSort = [];

// helper func for loading
function setupFiles(fileInput){
    audio.pause();
    currentSong = -1;
    if(fileInput){
        files = fileInput;

        fileSort = [];
        for(var i in files){
            fileSort.push([i, files[i].path || files[i].webkitRelativePath]);
        }
        fileSort.sort((a, b) => ('' + a[1]).localeCompare('' + b[1]));

        filesAmount = files.length;
        filesLength = 0;

        tracks = {};
        trackListFlat = [];
    }
}
// helper func for loading
function setupTracks(loadType){
    for(var i = 0; i < filesAmount; i++){
        if(files[fileSort[i][0]].type.indexOf("audio/") === 0 || loadType === "weirdFiles"){
            var fileName = files[fileSort[i][0]].name.split('.');
            if((fileName[fileName.length - 1] !== 'mid' && fileName[fileName.length - 1] !== 'midi') || loadType === "weirdFiles"){
                var filePath = '';
                if(files[fileSort[i][0]].webkitRelativePath){
                    var trackDir = files[fileSort[i][0]].webkitRelativePath.split('/');
                    trackDir.pop();
                    trackDir.shift();

                    filePath = files[fileSort[i][0]].webkitRelativePath.split('/');
                    filePath.pop();
                    filePath.shift();
                    if(loadType === "folder"){
                        if(filePath.length > 0){
                            filePath = filePath.join(" / ");
                            filePath += ' / ';
                        }else{
                            filePath = '';
                        }
                    }else if(loadType === "files" || loadType === "weirdFiles"){
                        // what did this even do? whot?
                        //filePath.join(" / ");
                        //filePath += ' / ';
                        //break;
                    }
                }
                var trackFormat = '';
                if(supportedFormats.indexOf(fileName[fileName.length - 1]) > -1){
                    trackFormat = fileName.pop();
                }
                var fullPath = files[fileSort[i][0]].webkitRelativePath.split("/");
                folderName = fullPath.shift();
                fullPath = fullPath.join("/");

                var currTrackPointer = tracks;
                for(var dir in trackDir){
                    if(!currTrackPointer[trackDir[dir]]){
                        currTrackPointer[trackDir[dir]] = {};
                        currTrackPointer[trackDir[dir]]['__isDirectory'] = true;
                    }
                    currTrackPointer = currTrackPointer[trackDir[dir]];
                }
                currTrackPointer[fileName.join('.') + '.' + trackFormat] = {
                    title: fileName.join('.'),
                    trackID: filesLength,
                    blob: URL.createObjectURL(files[fileSort[i][0]]),
                    dirPath: trackDir,
                    fullPath: fullPath,
                    format: trackFormat,
                    '__isDirectory': false
                };
                trackListFlat[filesLength] = currTrackPointer[fileName.join('.') + '.' + trackFormat];
                filesLength++;
            }
        }else if(loadType === "folder"){
            if(files[fileSort[i][0]].webkitRelativePath.split('/').length === 2 && files[fileSort[i][0]].webkitRelativePath.split('/').pop() === "zzz_aOSmusic_colorInfo.json"){
                var reader = new FileReader();
                reader.onload = readFileInfo;
                reader.readAsText(files[fileSort[i][0]]);
                setTimeout(function(){getId('colorfield').value="autoFileInfo";setColor('autoFileInfo');}, 100);
            }
        }
    }
    listSongs();
}
// helper func for loading
function setupShowElements(loadType){
    var disabledElements = document.getElementsByClassName('disabled');
    while(disabledElements.length > 0){
        disabledElements[0].classList.remove('disabled');
    }
    if(!smokeEnabled){
        smokeElement.classList.add("disabled");
        smokeScreen1.classList.add("disabled");
        smokeScreen2.classList.add("disabled");
    }
    
    if(loadType === "microphone" || loadType === "systemAudio"){
        getId("nonLiveControls").classList.add("unclickable");
        getId("ambienceButton").classList.add("unclickable");
        getId("ambienceSpacing").classList.add("unclickable");
        if(loadType === "microphone"){
            getId("currentlyPlaying").innerHTML = "Microphone";
        }else if(loadType === "systemAudio"){
            getId("currentlyPlaying").innerHTML = "System Audio";
        }
    }

    if(localStorage.getItem("AaronOSMusic_SmokeBrightness")){
        smokeBrightness = parseFloat(localStorage.getItem("AaronOSMusic_SmokeBrightness"));
    }
}
// helper func for loading
function setupAudio(loadType){
    audioContext = new AudioContext();
    if(loadType !== "microphone" && loadType !== "systemAudio"){
        mediaSource = audioContext.createMediaElementSource(audio);
        
        delayNode = audioContext.createDelay();
        if(localStorage.getItem("AaronOSMusic_Delay")){
            delayNode.delayTime.value = parseFloat(localStorage.getItem("AaronOSMusic_Delay"));
            getId("currentlyPlaying").innerHTML += " | Delay is custom";
        }else{
            delayNode.delayTime.value = 0.07;
        }
        delayNode.connect(audioContext.destination);
    }
    
    analyser = audioContext.createAnalyser();
    //analyser.fftSize = 32768;
    analyser.fftSize = 2048;
    latencyReduction = 1;
    if(loadType === "systemAudio"){
        // system audio seems to be quieter than regular audio files for some reason?
        // Tested with Deezer set to 200% and with YouTube set to 100%. Same issue between both. Hmm...
        analyser.maxDecibels = -30;
        analyser.minDecibels = -70;
    }else{
        analyser.maxDecibels = -20;
        analyser.minDecibels = -60;
    }
    if(localStorage.getItem("AaronOSMusic_SmoothingTimeConstant")){
        analyser.smoothingTimeConstant = parseFloat(localStorage.getItem("AaronOSMusic_SmoothingTimeConstant"));
        getId("currentlyPlaying").innerHTML += " | SmoothingTimeConstant is custom";
    }else{
        analyser.smoothingTimeConstant = 0.8;
    }

    if(loadType === "microphone"){
        navigator.webkitGetUserMedia({audio:true}, function(stream){
            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
        }, function(){alert('error');});
        microphoneActive = 1;
    }else if(loadType !== "systemAudio"){
        mediaSource.connect(analyser);
        analyser.connect(delayNode);
    }
    
    visData = new Uint8Array(analyser.frequencyBinCount);
}
// helper func for loading
function setupCanvas(){
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

function loadFolder(event){
    setupFiles(folderInput.files);
    setupTracks("folder");
    setupShowElements("folder");
    setupAudio("folder");
    setupCanvas();

    requestAnimationFrame(function(){
        overrideMod("sinusoid");
        overrideColor("beta");
    });
}

function loadFiles(event){
    setupFiles(fileInput.files);
    setupTracks("files");
    setupShowElements("files");
    setupAudio("files");
    setupCanvas();

    requestAnimationFrame(function(){
        overrideMod("sinusoid");
        overrideColor("beta");
    });
}

function loadWeirdFiles(event){// fileWeirdInput.files
    setupFiles(fileInput.files);
    setupTracks("weirdFiles");
    setupShowElements("weirdFiles");
    setupAudio("weirdFiles");
    setupCanvas();

    requestAnimationFrame(function(){
        overrideMod("sinusoid");
        overrideColor("beta");
    });
}

var microphoneActive = 0;
var systemAudioActive = 0;

function loadMicrophone(event){
    setupFiles();
    setupTracks("microphone");
    setupShowElements("microphone");
    setupAudio("microphone");
    setupCanvas();

    requestAnimationFrame(function(){
        overrideVis("fubar");
        overrideMod("sinusoid");
        overrideColor("beta");
    });
    blockSleep();
}

function loadSystemAudio(event){
    setupFiles();
    setupTracks("systemAudio");
    setupShowElements("systemAudio");
    setupAudio("systemAudio");

    if(systemAudioStreamType === 'electron'){
        remote.desktopCapturer.getSources({types: ['screen']}).then(async sources => {
            for(const source of sources){
                console.log(source);
                if(source.name === "Entire Screen" || source.name === "Screen 1"){
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

                        systemVideo.getVideoTracks()[0].enabled = false;

                        //systemAudio = new MediaStream(systemVideo.getAudioTracks());
                        systemAudio = audioContext.createMediaStreamSource(systemVideo);

                        systemAudio.connect(analyser);
                        
                        microphoneActive = 1;
                        
                        setupCanvas();
                        
                        requestAnimationFrame(function(){
                            overrideVis("fubar");
                            overrideMod("sinusoid");
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
    }else if(systemAudioStreamType === 'navigator'){
        if(!localStorage.getItem("AaronOSMusic_systemaudioprompt")){
            if(navigatorPlatform.indexOf("Linux") === 0 || navigatorPlatform.indexOf("Mac") === 0){
                if(!confirm("A screen selection window will appear.\n\nSelect the desired tab in the \"Browser Tab\" category.\nSelect \"Share audio\" at the bottom.\n\nPress Cancel to stop showing this message in the future.")){
                    localStorage.setItem("AaronOSMusic_systemaudioprompt", "1");
                }
            }else{
                if(!confirm("A screen selection window will appear.\n\nSelect your Entire Screen or a specific Browser Tab.\nSelect \"Share audio\" at the bottom.\n\nPress Cancel to stop showing this message in the future.")){
                    localStorage.setItem("AaronOSMusic_systemaudioprompt", "1");
                }
            }
        }
        try{
            navigator.mediaDevices.getDisplayMedia({
                audio: true,
                video: true
            }).then((systemVideo) => {
                systemVideo.getVideoTracks()[0].enabled = false;
    
                //systemAudio = new MediaStream(systemVideo.getAudioTracks());
                systemAudio = audioContext.createMediaStreamSource(systemVideo);
    
                systemAudio.connect(analyser);
                
                microphoneActive = 1;
                
                setupCanvas();

                requestAnimationFrame(function(){
                    overrideVis("fubar");
                    overrideMod("sinusoid");
                    overrideColor("beta");
                });
                blockSleep();
            }).catch((err) => {
                alert("Refresh the page to start over.\n\n" + err);
            });
        }catch(e){
            alert("Refresh the page to start over.\n\n" + e);
        }
    }else{
        alert("Unknown error");
    }
}

var currentSong = -1;

function selectSong(id){
    currentSong = id;
    audio.pause();
    audio.currentTime = 0;
    audio.src = trackListFlat[currentSong].blob;
    blockSleep();
    getId("currentlyPlaying").innerHTML = trackListFlat[currentSong].trackID + ": " + trackListFlat[currentSong].title;
    document.title = trackListFlat[currentSong].title + " - AaronOS Music Player";
    if(webVersion && aosToolsConnected){
        aosTools.sendRequest({
            action: "appwindow:set_caption",
            content: "Music Player - " + trackListFlat[currentsong].title,
            conversation: "set_caption"
        });
    }
    try{
        document.getElementsByClassName("selected")[0].classList.remove("selected");
    }catch(err){
        // no song is selected
    }
    getId("song" + id).classList.add("selected");
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
            getId("currentlyPlaying").innerHTML = trackListFlat[0].trackID + ": " + trackListFlat[0].title;
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
        timeToSet /= size[0] * (performanceMode + 1);
        timeToSet *= audio.duration;
        audio.currentTime = timeToSet;
        if(ambienceWaiting){
            ambienceWaiting = 0;
            clearTimeout(ambienceTimeout);
            getId("currentlyPlaying").innerHTML = trackListFlat[currentSong].trackID + ": " + trackListFlat[currentSong].title;
        }
    }
}

function back(){
    if(!microphoneActive){
        if(audio.currentTime < 3){
            if(shuffleMode){
                shufflePosition--;
                if(shufflePosition < 0){
                    shufflePosition = shufflePosition.length - 1;
                }
                currentSong = shuffledTracklist[shufflePosition];
            }else{
                currentSong--;
                if(currentSong < 0){
                    currentSong = trackListFlat.length - 1;
                }
            }
            selectSong(currentSong);
        }else{
            audio.currentTime = 0;
            if(ambienceWaiting){
                ambienceWaiting = 0;
                clearTimeout(ambienceTimeout);
                getId("currentlyPlaying").innerHTML = trackListFlat[currentSong].trackID + ": " + trackListFlat[currentSong].title;
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
            var nextAmbienceSong = Math.floor(Math.random() * trackListFlat.length);
            if(trackListFlat.length !== 1){
                while(nextAmbienceSong === currentSong){
                    nextAmbienceSong = Math.floor(Math.random() * trackListFlat.length);
                }
            }
            currentSong = nextAmbienceSong;
        }else if(shuffleMode){
            shufflePosition++;
            if(shufflePosition > shuffledTracklist.length - 1){
                shufflePosition = 0;
            }
            currentSong = shuffledTracklist[shufflePosition];
        }else{
            currentSong++;
            if(currentSong > trackListFlat.length - 1){
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
        var nextAmbienceSong = Math.floor(Math.random() * trackListFlat.length);
        if(trackListFlat.length !== 1){
            while(nextAmbienceSong === currentSong){
                nextAmbienceSong = Math.floor(Math.random() * trackListFlat.length);
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

var shuffleMode = 0;
var shufflePosition = 0;
var shuffledTracklist = [];
function shuffle(){
    if(!microphoneActive){
        shuffleMode = Math.abs(shuffleMode - 1);
        if(getId("shuffleButton")){
            getId("shuffleButton").style.borderColor = debugColors[shuffleMode];
        }
        shuffledPosition = 0;
        shuffledTracklist = [];
        if(shuffleMode){
            audio.pause();
            audio.currentTime = 0;
            for(var i = 0; i < trackListFlat.length; i++){
                shuffledTracklist.push(i);
            }
            shuffleArray(shuffledTracklist);
        }
        listSongs();
        if(shuffleMode){
            currentSong = shuffledTracklist[0];
            selectSong(currentSong);
        }else{
            getId("song" + currentSong).classList.add('selected');
        }
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

var bestColorsMode = 1;
function toggleBestColors(){
    if(bestColorsMode){
        if(getId("bestColorsButton")){
            getId("bestColorsButton").style.borderColor = "#C00";
        }
    }else{
        if(getId("bestColorsButton")){
            getId("bestColorsButton").style.borderColor = "#0A0";
        }
    }
    bestColorsMode = Math.abs(bestColorsMode - 1);
    localStorage.setItem("AaronOSMusic_BestColors", String(bestColorsMode));
}
if(localStorage.getItem("AaronOSMusic_BestColors")){
    bestColorsMode = parseInt(localStorage.getItem("AaronOSMusic_BestColors"));
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
            getId("visualizer").style.cursor = "";
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
            getId("visualizer").style.cursor = "none";
            getId("visualizer").title = "";
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
var debugFreqs = 0; // sweeps all freqs from 0 to 255 and back again
var debugFreqsValue = 0; // 0 to 255
var debugFreqsDirection = -1; // 1 or -1
var debugFreqsTimer = 0; // debug hangs at 0 and 255 for a while
var debugColors = ["#C00", "#0A0"];
function toggleFPS(){
    debugForce = Math.abs(debugForce - 1);
    if(getId("debugButton")){
        getId("debugButton").style.borderColor = debugColors[debugForce];
    }
}
function toggleFreqs(){
    debugFreqs = Math.abs(debugFreqs - 1);
    if(getId("debugFreqsButton")){
        getId("debugFreqsButton").style.borderColor = debugColors[debugFreqs];
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
        if(debugFreqs){
            var shouldIncrement = 1;
            if(debugFreqsValue <= 0 || debugFreqsValue >= 255){
                if(debugFreqsTimer === 0){ // we just arrived at the end
                    // 5 seconds between switching directions
                    shouldIncrement = 0;
                    debugFreqsTimer = performance.now() + 5000;
                }else if(performance.now() > debugFreqsTimer){
                    debugFreqsDirection *= -1;
                    debugFreqsTimer = 0;
                }else{
                    shouldIncrement = 0;
                }
            }
            if(shouldIncrement){
                debugFreqsValue += debugFreqsDirection;
            }
            visData.fill(debugFreqsValue);
        }
        if(microphoneActive){
            var tempArr = [];
            if(latencyReduction === 2){
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
        if(smokeEnabled){
            smokeFrame();
        }
        // if debug enabled, store current data values
        var debugEnabled = debugForce || (window.location.href.indexOf("debug") > -1);
        
        if(debugEnabled && currMod){
            var oldVisData = [];
            for(var i = 0; i < 64; i++){
                oldVisData[i] = visData[i];
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
                var debugLeftBound = size[0] - 278;
                canvas.strokeRect(size[0] - 278.5, 10.5, 128, 255);
                canvas.fillStyle = '#FFF';
                for(var i = 0; i < 64; i++){
                    canvas.fillRect(debugLeftBound + (i * 2), 10 + (255 - oldVisData[i]), 2, oldVisData[i]);
                }
            }
            canvas.strokeStyle = "#FFF";
            canvas.lineWidth = 1;
            var debugLeftBound = size[0] - 139;
            canvas.strokeRect(size[0] - 139.5, 10.5, 128, 255);
            canvas.fillStyle = '#FFF';
            for(var i = 0; i < 64; i++){
                canvas.fillRect(debugLeftBound + (i * 2), 10 + (255 - visData[i]), 2, visData[i]);
            }
        }
    }
}

var currMod = null;
var mods = {
    sinusoid: {
        name: "Sinusoid", // this is what i was *trying* to accomplish with Power Sine
        image: 'mods/sinusoid.png',
        mod: function(){
            for(var i = 0; i < 128; i++){
                visData[i] = -127.5 * Math.cos(2 * Math.PI * visData[i] / 510) + 127.5;
            }
        },
        test: function(input){
            return -127.5 * Math.cos(2 * Math.PI * input / 510) + 127.5;
        }
    },
    powSin: {
        name: "Power Sine",
        image: 'mods/powSin.png',
        mod: function(){
            for(var i = 0; i < 128; i++){
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
            for(var i = 0; i < 128; i++){
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
            for(var i = 0; i < 128; i++){
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
            for(var i = 0; i < 128; i++){
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

/*
    // a gradient is a set of points from 0 to 255
    // each point has a value (0 - 1, 0 - 255, 0 - 360, etc)
    // one gradient represents one color channel
    grad: {
        r: [],
        g: [],
        b: [],
        a: []
    },

    example:
    r: [[0, 127], [127, 64], [255, 192]]
    [[point, value], [point, value], ...]

    // to calculate a point in the gradient:
    // supply the gradient and the value
    gcalc(this.grad.r, value)

    // if the value is before the first gradient point, first point is used.
    // if the value is after the first gradient point, last point is used.
*/
function gcalc(grad, value){
    for(var point = grad.length - 1; point >= 0; point--){
        if(grad[point][0] <= value){
            if(point === grad.length - 1 || grad[point][0] === value){
                return grad[point][1];
            }
            var weight = (value - grad[point][0]) / (grad[point + 1][0] - grad[point][0]);
            return grad[point][1] * (1 - weight) + grad[point + 1][1] * weight;
        }
    }
    return grad[0][1];
}
function csscolor(colorType, ...values){
    return colorType + "(" + values.join(", ") + ")";
}

var colors = {
    'SEPARATOR_AARONOS" disabled="': {
        name: "AaronOS",
        category: "AaronOS",
        func: function(){
            return '#000';
        }
    },
    autoFileInfo: {
        name: "Custom Colors",
        image: "colors/triColor.png",
        func: function(amount){
            if(currentSong === -1){
                return colors.bluegreenred.func(amount);
            }else{
                var infoObj = trackListFlat[currentSong].fullPath;
                if(fileInfo[infoObj]){
                    if(fileInfo[infoObj].length > 0){
                        for(var i in fileInfo[infoObj]){
                            if(fileInfo[infoObj][i].x * 2.55 >= amount){
                                if(i < 1){
                                    return csscolor("rgba",
                                        fileInfo[infoObj][0].r,
                                        fileInfo[infoObj][0].g,
                                        fileInfo[infoObj][0].b,
                                        fileInfo[infoObj][0].a,
                                    );
                                }else{
                                    return csscolor("rgba",
                                        gcalc([[fileInfo[infoObj][i - 1].x * 2.55, fileInfo[infoObj][i - 1].r], [fileInfo[infoObj][i].x * 2.55, fileInfo[infoObj][i].r]], amount),
                                        gcalc([[fileInfo[infoObj][i - 1].x * 2.55, fileInfo[infoObj][i - 1].g], [fileInfo[infoObj][i].x * 2.55, fileInfo[infoObj][i].g]], amount),
                                        gcalc([[fileInfo[infoObj][i - 1].x * 2.55, fileInfo[infoObj][i - 1].b], [fileInfo[infoObj][i].x * 2.55, fileInfo[infoObj][i].b]], amount),
                                        gcalc([[fileInfo[infoObj][i - 1].x * 2.55, fileInfo[infoObj][i - 1].a], [fileInfo[infoObj][i].x * 2.55, fileInfo[infoObj][i].a]], amount),
                                    );
                                }
                            }
                        }
                        return csscolor("rgba",
                            fileInfo[infoObj][fileInfo[infoObj].length - 1].r,
                            fileInfo[infoObj][fileInfo[infoObj].length - 1].g,
                            fileInfo[infoObj][fileInfo[infoObj].length - 1].b,
                            fileInfo[infoObj][fileInfo[infoObj].length - 1].a,
                        );
                    }else{
                        return colors.bluegreenred.func(amount);
                    }
                }else{
                    return colors.bluegreenred.func(amount);
                }
            }
        }
    },
    bluegreenred: {
        name: "AaronOS",
        image: "colors/default.png",
        grad: {
            r: [                        [200, 0],             [255, 255]],
            g: [[  0,   0],                       [220, 255], [255,   0]],
            b: [            [ 64, 255], [200, 0]                        ],
            a: [[  0,   0],                       [220,   1]            ]
        },
        func: function(amount){
            return csscolor("rgba",
                gcalc(this.grad.r, amount),
                gcalc(this.grad.g, amount),
                gcalc(this.grad.b, amount),
                gcalc(this.grad.a, amount)
            );
        }
    },
    beta: {
        name: "AaronOS Solid",
        image: "colors/defaultSolid.png",
        grad: {
            r: [                        [200, 0],             [255, 255]],
            g: [[  0,   0],                       [220, 255], [255,   0]],
            b: [            [ 64, 255], [200, 0]                        ]
        },
        func: function(amount){
            return csscolor("rgb",
                gcalc(this.grad.r, amount),
                gcalc(this.grad.g, amount),
                gcalc(this.grad.b, amount)
            );
        }
    },
    alphaTransparent: {
        name: "AaronOS Clean",
        image: "colors/alphatransparent.png",
        grad: {
            b: [            [ 64, 255], [255,   0]],
            a: [[  0,   0],             [255,   1]]
        },
        func: function(amount){
            return csscolor("rgba",
                0,
                amount,
                gcalc(this.grad.b, amount),
                gcalc(this.grad.a, amount)
            );
        }
    },
    alpha: {
        name: "AaronOS Clean Solid",
        image: "colors/alpha.png",
        grad: {
            b: [[ 64, 255], [255,   0]]
        },
        func: function(amount){
            return csscolor("rgb",
                0,
                amount,
                gcalc(this.grad.b, amount)
            );
        }
    },
    defStatic: {
        name: "AaronOS Static",
        image: "colors/defaultStatic.png",
        grad: {
            b: [[ 64, 255], [255,   0]]
        },
        func: function(amount, position){
            return csscolor("rgb",
                0,
                (typeof position === "number") ? position : amount,
                gcalc(this.grad.b, (typeof position === "number") ? position : amount)
            );
        }
    },
    capri: {
        name: "Capri Plum",
        image: "colors/capri.png",
        grad: {
            r: [[  0,  52], [220,  20], [255, 255]],
            g: [[  0,   0], [220, 194], [255, 201]],
            b: [[  0, 104], [220, 220], [255, 223]],
            a: [[  0,   0], [220,   1]            ]
        },
        func: function(amount){
            return csscolor('rgba',
                gcalc(this.grad.r, amount),
                gcalc(this.grad.g, amount),
                gcalc(this.grad.b, amount),
                gcalc(this.grad.a, amount)
            );
        }
    },
    caprisolid: {
        name: "Capri Plum Solid",
        image: "colors/capriSolid.png",
        grad: {
            r: [[  0,  52], [220,  20], [255, 255]],
            g: [[  0,   0], [220, 194], [255, 201]],
            b: [[  0, 104], [220, 220], [255, 223]]
        },
        func: function(amount){
            return csscolor('rgb',
                gcalc(this.grad.r, amount),
                gcalc(this.grad.g, amount),
                gcalc(this.grad.b, amount)
            );
        }
    },
    capristatic: {
        name: "Capri Plum Static",
        image: "colors/capriStatic.png",
        grad: {
            r: [[  0,  52], [255,  20]],
            g: [[  0,   0], [255, 194]],
            b: [[  0, 104], [255, 220]]
        },
        func: function(amount, position){
            return csscolor('rgb',
                gcalc(this.grad.r, (typeof position === "number") ? position : amount),
                gcalc(this.grad.g, (typeof position === "number") ? position : amount),
                gcalc(this.grad.b, (typeof position === "number") ? position : amount)
            );
        }
    },
    'SEPARATOR_THEMES" disabled="': {
        name: "Themes",
        category: "Themes",
        func: function(){
            return '#000';
        }
    },
    fire: {
        name: "Fire",
        image: "colors/fire.png",
        func: function(amount){
            return csscolor("rgba",
                255,
                Math.pow(amount, 2) / 255,
                0,
                amount / 255
            );
        }
    },
    refraction: {
        name: "Refraction (White)",
        image: "colors/refraction.png",
        grad: {
            l: [            [127, 100],
                            [127, 100]            ],
            a: [[  0,   1], [127,   0], [255,   1]]
        },
        func: function(amount, position){
            return csscolor("hsla",
                0,
                "0%",
                "100%", //gcalc(this.grad.l, amount) + "%",
                gcalc(this.grad.a, amount)
            );
        }
    },
    refractionrgb: {
        name: "Refraction (RGB)",
        image: "colors/refractionrgb.png",
        grad: {
            s: [            [127,   0],
                            [127, 100]            ],
            l: [            [127, 100],
                            [127,  50]            ],
            a: [[  0,   1], [127,   0], [255,   1]]
        },
        func: function(amount, position){
            return csscolor("hsla",
                (amount >= 127) ? (255 - position) * (300 / 255) : (position) * (300 / 255),
                "100%", //gcalc(this.grad.s, amount) + "%",
                "50%", //gcalc(this.grad.l, amount) + "%",
                gcalc(this.grad.a, amount)
            );
        }
    },
    'SEPARATOR_RAINBOW" disabled="': {
        name: "Rainbow",
        category: "Rainbow",
        func: function(){
            return '#000';
        }
    },
    rainbowActive: {
        name: "Rainbow Static",
        image: "colors/rainbowActive.png",
        func: function(amount, position){
            return csscolor('hsla',
                ((typeof position === "number") ? position : amount) * this.multiplier,
                '100%',
                '50%',
                amount / this.alphaDivisor + 0.25
            );
        },
        multiplier: 360 / 255,
        alphaDivisor: 255 * (4/3)
    },
    rainbowActive2: {
        name: "Rainbow Static 2",
        image: "colors/rainbowActive2.png",
        func: function(amount, position){
            return csscolor('hsla',
                ((typeof position === "number") ? position : amount) * this.multiplier,
                '100%',
                '50%',
                amount / 255
            );
        },
        multiplier: 360 / 255
    },
    rainbowStatic: {
        name: "Rainbow Static Solid",
        image: "colors/rainbowStatic.png",
        func: function(amount, position){
            return csscolor('hsla',
                ((typeof position === "number") ? position : amount) * this.multiplier,
                '100%',
                '50%'
            );
        },
        multiplier: 360 / 255
    },
    'SEPARATOR_PRIDE" disabled="': {
        name: "Pride",
        category: "Pride",
        func: function(){
            return '#000';
        }
    },
    prideGlow: {
        name: "Pride",
        image: "colors/pride.png",
        grad: {
            h: [[  0,   0], [255, 265]],
            a: [[  0, 0.1], [255,   1]]
        },
        func: function(amount){
            return csscolor('hsla',
                gcalc(this.grad.h, amount),
                '100%',
                '50%',
                gcalc(this.grad.a, amount)
            );
        },
        divide255by96: 255 / 96,
        divide255by64: 255 / 64,
        divide255by48: 255 / 48
    },
    pride: {
        name: "Pride Solid",
        image: "colors/prideSolid.png",
        grad: {
            h: [[  0,   0], [255, 265]]
        },
        func: function(amount){
            return csscolor('hsl',
                gcalc(this.grad.h, amount),
                '100%',
                '50%'
            );
        },
        divide255by96: 255 / 96,
        divide255by64: 255 / 64,
        divide255by48: 255 / 48
    },
    prideStatic: {
        name: "Pride Static",
        image: "colors/prideStatic.png",
        grad: {
            h: [[  0,   0], [255, 265]]
        },
        func: function(amount, position){
            return csscolor('hsl',
                gcalc(this.grad.h, (typeof position === "number") ? position : amount),
                '100%',
                '50%'
            );
        }
    },
    prideBlocky: {
        name: "Pride Static Blocky",
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
    'SEPARATOR_UKRAINE" disabled="': {
        name: "Ukraine",
        category: "Ukraine",
        func: function(){
            return '#000';
        }
    },
    ukraineSunrise: {
        name: "Sunrise",
        image: "colors/ukrainesunrise.png",
        grad: {
            r: [[0,   0], [104,  64], [255, 255]],
            g: [[0,  91], [104, 122], [255, 213]],
            b: [[0, 187], [104, 140], [255,   0]],
            a: [[0, .25],             [255,   1]]
        },
        func: function(amount){
            return csscolor("rgba",
                gcalc(this.grad.r, amount),
                gcalc(this.grad.g, amount),
                gcalc(this.grad.b, amount),
                gcalc(this.grad.a, amount)
            );
        }
    },
    ukraineSunriseSolid: {
        name: "Sunrise Solid",
        image: "colors/ukrainesunrisesolid.png",
        grad: {
            r: [[0,   0], [104,  64], [255, 255]],
            g: [[0,  91], [104, 122], [255, 213]],
            b: [[0, 187], [104, 140], [255,   0]]
        },
        func: function(amount){
            return csscolor("rgb",
                gcalc(this.grad.r, amount),
                gcalc(this.grad.g, amount),
                gcalc(this.grad.b, amount)
            );
        }
    },
    ukraineSunriseStatic: {
        name: "Sunrise Static",
        image: "colors/ukrainesunrisestatic.png",
        grad: {
            r: [[0,   0], [104,  64], [255, 255]],
            g: [[0,  91], [104, 122], [255, 213]],
            b: [[0, 187], [104, 140], [255,   0]],
            a: [[0, .25],             [255,   1]]
        },
        func: function(amount, position){
            return csscolor("rgba",
                gcalc(this.grad.r, position),
                gcalc(this.grad.g, position),
                gcalc(this.grad.b, position),
                gcalc(this.grad.a, amount)
            );
        }
    },
    ukraineSunriseStaticSolid: {
        name: "Sunrise Static Solid",
        image: "colors/ukrainesunrisestaticsolid.png",
        grad: {
            r: [[0,   0], [104,  64], [255, 255]],
            g: [[0,  91], [104, 122], [255, 213]],
            b: [[0, 187], [104, 140], [255,   0]]
        },
        func: function(amount, position){
            return csscolor("rgb",
                gcalc(this.grad.r, position),
                gcalc(this.grad.g, position),
                gcalc(this.grad.b, position)
            );
        }
    },
    ukraineSunset: {
        name: "Sunset",
        image: "colors/ukrainesunset.png",
        grad: {
            r: [[0, 255], [152,  64], [255,   0]],
            g: [[0, 213], [152, 122], [255,  91]],
            b: [[0,   0], [152, 140], [255, 187]],
            a: [[0, .25],             [255,   1]]
        },
        func: function(amount){
            return csscolor("rgba",
                gcalc(this.grad.r, amount),
                gcalc(this.grad.g, amount),
                gcalc(this.grad.b, amount),
                gcalc(this.grad.a, amount)
            );
        }
    },
    ukraineSunsetSolid: {
        name: "Sunset Solid",
        image: "colors/ukrainesunsetsolid.png",
        grad: {
            r: [[0, 255], [152,  64], [255,   0]],
            g: [[0, 213], [152, 122], [255,  91]],
            b: [[0,   0], [152, 140], [255, 187]]
        },
        func: function(amount){
            return csscolor("rgba",
                gcalc(this.grad.r, amount),
                gcalc(this.grad.g, amount),
                gcalc(this.grad.b, amount)
            );
        }
    },
    ukraineSunsetStatic: {
        name: "Sunset Static",
        image: "colors/ukrainesunsetstatic.png",
        grad: {
            r: [[0, 255], [152,  64], [255,   0]],
            g: [[0, 213], [152, 122], [255,  91]],
            b: [[0,   0], [152, 140], [255, 187]],
            a: [[0, .25],             [255,   1]]
        },
        func: function(amount, position){
            return csscolor("rgba",
                gcalc(this.grad.r, position),
                gcalc(this.grad.g, position),
                gcalc(this.grad.b, position),
                gcalc(this.grad.a, amount)
            );
        }
    },
    ukraineSunsetStaticSolid: {
        name: "Sunset Static Solid",
        image: "colors/ukrainesunsetstaticsolid.png",
        grad: {
            r: [[0, 255], [152,  64], [255,   0]],
            g: [[0, 213], [152, 122], [255,  91]],
            b: [[0,   0], [152, 140], [255, 187]]
        },
        func: function(amount, position){
            return csscolor("rgb",
                gcalc(this.grad.r, position),
                gcalc(this.grad.g, position),
                gcalc(this.grad.b, position)
            );
        }
    },
    'SEPARATOR_QUEEN" disabled="': {
        name: "Queen",
        category: "Queen",
        func: function(){
            return '#000';
        }
    },
    queen: {
        name: "Queen",
        image: "colors/queen.png",
        grad: {
            r: [[  0, 142],             [255, 255]],
            g: [            [127,  40], [255, 204]],
            b: [[  0, 167],             [255,   3]]
        },
        func: function(amount){
            return csscolor('rgb',
                gcalc(this.grad.r, amount),
                gcalc(this.grad.g, amount),
                gcalc(this.grad.b, amount),
                amount / 255
            );
        }
    },
    queenSolid: {
        name: "Queen Solid",
        image: "colors/queenSolid.png",
        grad: {
            r: [[  0, 142],             [255, 255]],
            g: [            [127,  40], [255, 204]],
            b: [[  0, 167],             [255,   3]]
        },
        func: function(amount){
            return csscolor('rgb',
                gcalc(this.grad.r, amount),
                gcalc(this.grad.g, amount),
                gcalc(this.grad.b, amount)
            );
        }
    },
    queenStatic: {
        name: "Queen Static",
        image: "colors/queenStatic.png",
        grad: {
            r: [[  0, 142],             [255, 255]],
            g: [            [127,  40], [255, 204]],
            b: [[  0, 167],             [255,   3]]
        },
        func: function(amount, position){
            return csscolor('rgb',
                gcalc(this.grad.r, (typeof position === "number") ? position : amount),
                gcalc(this.grad.g, (typeof position === "number") ? position : amount),
                gcalc(this.grad.b, (typeof position === "number") ? position : amount)
            );
        }
    },
    'SEPARATOR_COLORS" disabled="': {
        name: "Colors",
        category: "Colors",
        func: function(){
            return '#000';
        }
    },
    whiteglow: {
        name: "White",
        image: "colors/whiteGlow.png",
        func: function(amount){
            return 'rgba(255, 255, 255, ' + (amount / 255) + ')';
        }
    },
    redglow: {
        name: "Red",
        image: "colors/redGlow.png",
        func: function(amount){
            return 'rgba(255,0,0,' + (amount / 255) + ')';
        }
    },
    greenglow: {
        name: "Green",
        image: "colors/greenGlow.png",
        func: function(amount){
            return 'rgba(0,255,0,' + (amount / 255) + ')';
        }
    },
    blueglow: {
        name: "Blue",
        image: "colors/blueGlow.png",
        func: function(amount){
            return 'rgba(0,0,255,' + (amount / 255) + ')';
        }
    },
    electricglow: {
        name: "Electric",
        image: "colors/electricGlow.png",
        func: function(amount){
            return 'rgba(0,255,255,' + (amount / 255) + ')';
        }
    },
    indigoglow: {
        name: "Indigo",
        image: "colors/indigoGlow.png",
        func: function(amount){
            return 'rgba(75, 0, 130, ' + (amount / 255) + ')';
        }
    },
    'SEPARATOR_COLORS_SOLID" disabled="': {
        name: "Solid Colors",
        category: "Solid Colors",
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
    }
}

var currColor = "bluegreenred";
function setColor(newcolor){
    //getColor = (colors[newcolor] || colors.bgr).func;
    if(colors[newcolor]){
        currColor = newcolor;
    }else{
        currColor = "bluegreenred";
    }
    progressBar.style.outline = "2px solid " + getColor(255);
    if(vis[currVis].sizechange){
        vis[currVis].sizechange();
    }
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
    if(vis[currVis].settings){
        getId("visSettingsButton").style.opacity = "1";
        getId("visSettingsButton").style.pointerEvents = "";
    }else{
        getId("visSettingsButton").style.opacity = "0.25";
        getId("visSettingsButton").style.pointerEvents = "none";
    }
    if(bestColorsMode && vis[currVis].bestColor && currColor !== "autoFileInfo"){
        getId('colorfield').value = vis[currVis].bestColor;
        setColor(vis[currVis].bestColor);
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
        name: 'Bars and Waves',
        start: function(){

        },
        frame: function(){

        },
        stop: function(){

        }
    },
    reflection: {
        name: "Reflection",
        image: "visualizers/reflection.png",
        bestColor: "beta",
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
            monstercatGradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)'); // 0.8
            monstercatGradient.addColorStop(0.1, 'rgba(0, 0, 0, 0.9)'); // 0.9
            monstercatGradient.addColorStop(0.25, 'rgba(0, 0, 0, 0.95)');
            monstercatGradient.addColorStop(0.5, 'rgba(0, 0, 0, 1)');// 1
            
            for(var i = 0; i < 64; i++){
                var strength = visData[i];
                
                var fillColor = getColor(strength, i * 4);
                canvas.fillStyle = fillColor;
                canvas.fillRect(
                    Math.round(left + i * barSpacing),
                    Math.floor(size[1] / 2) - Math.round(strength / 255 * maxHeight),
                    Math.round(barWidth),
                    Math.round(strength / 255 * maxHeight + 5)
                );
                    canvas.fillRect(
                        Math.round(left + i * barSpacing),
                        Math.floor(size[1] / 2) + 4,
                        Math.round(barWidth),
                        Math.round(strength / 255 * maxHeight + 4)
                    );
                //}
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
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    monstercat: {
        name: "Monstercat",
        image: "visualizers/monstercat.png",
        bestColor: "beta",
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
            
            if(this.settings.showReflection.value){
                var monstercatGradient = canvas.createLinearGradient(0, Math.round(size[1] / 2) + 4, 0, size[1]);
                monstercatGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)'); // 0.8
                monstercatGradient.addColorStop(0.025, 'rgba(0, 0, 0, 0.9)'); // 0.9
                monstercatGradient.addColorStop(0.1, 'rgba(0, 0, 0, 1)');// 1
            }
            
            for(var i = 0; i < 64; i++){
                var strength = visData[i];
                
                var fillColor = getColor(strength, i * 4);
                canvas.fillStyle = fillColor;
                canvas.fillRect(
                    Math.round(left + i * barSpacing),
                    Math.floor(size[1] / 2) - Math.round(strength / 255 * maxHeight),
                    Math.round(barWidth),
                    Math.round(strength / 255 * maxHeight + 5)
                );
                //canvas.fillStyle = "#000";
                if(this.settings.showReflection.value){
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

            if(this.settings.showReflection.value){
                canvas.fillStyle = monstercatGradient;
                canvas.fillRect(0, Math.round(size[1] / 2) + 4, size[0], Math.round(size[1] / 2) - 4);
            }

            //updateSmoke(left, size[1] * 0.2, maxWidth, size[1] * 0.3 + 10);
            if(this.settings.songTitle.value){
                canvas.fillStyle = '#FFF';
                canvas.font = (size[1] * 0.25) + 'px aosProFont, sans-serif';
                if(!microphoneActive){
                    canvas.fillText((trackListFlat[currentSong].title || "No Song").toUpperCase(), Math.round(left) + 0.5, size[1] * 0.75, Math.floor(maxWidth));
                }
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255),
        settings: {
            songTitle: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Display Song Title"
            },
            showReflection: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Reflections Under Bars"
            }
        }
    },
    obelisks: {
        name: "Obelisks",
        image: "visualizers/obelisks.png",
        bestColor: "beta",
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
            monstercatGradient.addColorStop(0, 'rgba(0, 0, 0, 0.75)'); // 0.8
            monstercatGradient.addColorStop(0.1, 'rgba(0, 0, 0, 0.85)'); // 0.9
            monstercatGradient.addColorStop(0.25, 'rgba(0, 0, 0, 0.95)');
            monstercatGradient.addColorStop(0.5, 'rgba(0, 0, 0, 1)');// 1
            
            for(var i = 0; i < 64; i++){
                var strength = visData[i];
                
                var fillColor = getColor(strength, i * 4);
                canvas.fillStyle = "#000";
                canvas.fillRect(
                    Math.round(left + i * barSpacing),
                    Math.floor(size[1] / 2) - Math.round(strength / 255 * maxHeight),
                    Math.round(barWidth),
                    Math.round(strength / 255 * maxHeight + 5)
                );
                    canvas.fillRect(
                        Math.round(left + i * barSpacing),
                        Math.floor(size[1] / 2) + 4,
                        Math.round(barWidth),
                        Math.round(strength / 255 * maxHeight + 4)
                    );
                //}
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
            if(!smokeEnabled){
                canvas.fillStyle = '#FFF';
                canvas.font = "12px aosProFont, Courier, monospace";
                canvas.fillText("Enable Smoke for this visualizer.", Math.round(left) + 0.5, size[1] * 0.25, Math.floor(maxWidth));
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    fubar: {
        name: "FUBAR",
        image: "visualizers/fubar.png",
        bestColor: "beta",
        start: function(){
            this.bobbers = new Array(this.settings.bars.value).fill(new Array(2).fill(0));
        },
        settingChange: function(setting, value){
            if(setting === 'bars'){
                this.bobbers = new Array(value).fill(new Array(2).fill(0));
            }
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            if(this.settings.scaling.value){
                var scale = [Math.round(size[0] / 1024) || 1, Math.round(size[1] / 512) || 1];
            }else{
                var scale = [1, 1];
            }
            if(this.settings.baseline.value || this.settings.reflections.value){
                var baseline = Math.round(size[1] * 0.5);
                var maxHeight = Math.round(size[1] * 0.4);
            }else{
                var baseline = size[1] - scale[1];
                maxHeight = Math.round(size[1] * 0.8);
            }
            if(this.settings.padding.value){
                var left = Math.round(size[0] * 0.1);
                var barWidth = Math.round(size[0] * 0.8 / this.settings.bars.value);
            }else{
                var left = 0;
                barWidth = Math.round(size[0] / this.settings.bars.value);
            }
            var bobberDelay = this.settings.bobberDelay.value;
            var bobberSpeed = this.settings.bobberSpeed.value;
            for(var i = 0; i < this.settings.bars.value; i++){
                canvas.fillStyle = getColor(visData[i], i / this.settings.bars.value * 255);
                canvas.fillRect(
                    left + i * barWidth,
                    baseline - visData[i] / 255 * maxHeight,
                    barWidth - 1 * scale[0],
                    visData[i] / 255 * maxHeight
                );
                if(this.settings.reflections.value){
                    canvas.fillRect(
                        left + i * barWidth,
                        baseline,
                        barWidth - 1 * scale[0],
                        visData[i] / 255 * maxHeight
                    );
                }
                if(smokeEnabled){
                    smoke.fillStyle = getColor(visData[i], i / this.settings.bars.value * 255);
                    smoke.fillRect(
                        left + i * barWidth,
                        baseline - visData[i] / 255 * maxHeight,
                        barWidth - 1 * scale[0],
                        visData[i] / 255 * maxHeight
                    );
                    if(this.settings.reflections.value){
                        smoke.fillRect(
                            left + i * barWidth,
                            baseline,
                            barWidth - 1 * scale[0],
                            visData[i] / 255 * maxHeight
                        );
                    }
                }
                if(this.settings.bobbers.value){
                    if(visData[i] > this.bobbers[i][0]){
                        this.bobbers[i] = [visData[i], Date.now()];
                    }else if(this.bobbers[i][0] > 0 && Date.now() - this.bobbers[i][1] > bobberDelay){
                        this.bobbers[i][0] -= bobberSpeed * fpsCompensation;
                        if(this.bobbers[i][0] < 0){
                            this.bobbers[i][0] = 0;
                        }
                    }
                    canvas.fillStyle = getColor(this.bobbers[i][0], i / this.settings.bars.value * 255);
                    canvas.fillRect(
                        left + i * barWidth,
                        baseline - Math.round(this.bobbers[i][0] / 255 * maxHeight),
                        barWidth - 1 * scale[0],
                        scale[1]
                    );
                    if(this.settings.reflections.value){
                        canvas.fillRect(
                            left + i * barWidth,
                            baseline + Math.round(this.bobbers[i][0] / 255 * maxHeight),
                            barWidth - 1 * scale[0],
                            scale[1]
                        );
                    }
                    if(smokeEnabled){
                        smoke.fillStyle = getColor(this.bobbers[i][0], i / this.settings.bars.value * 255);
                        smoke.fillRect(
                            left + i * barWidth,
                            baseline - Math.round(this.bobbers[i][0] / 255 * maxHeight) - scale[1] * 3,
                            barWidth - 1 * scale[0],
                            scale[1] * 6
                        );
                        if(this.settings.reflections.value){
                            smoke.fillRect(
                                left + i * barWidth,
                                baseline + Math.round(this.bobbers[i][0] / 255 * maxHeight) - scale[1] * 3,
                                barWidth - 1 * scale[0],
                                scale[1] * 6
                            );
                        }
                    }
                }
            }
            var gradient = canvas.createLinearGradient(
                0,
                baseline + scale[1],
                0,
                size[1]
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
            gradient.addColorStop(0.5, 'rgba(0, 0, 0, 1)');
            canvas.fillStyle = gradient;
            canvas.fillRect(0, baseline + scale[1], size[0], size[1]);
        },
        stop: function(){

        },
        settings: {
            // bars amount
            bars: {
                type: "number",
                value: 64,
                default: 64,
                range: [12, 1024],
                step: 1,
                title: "Bars Count (experimental)",
                desc: "How many bars do we show? Left is always lowest bass, more bars are added to the right for higher numbers.",

            },
            // scaling toggle
            scaling: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Scaling",
                desc: "The bobbers and spaces get wider if you're viewing at high resolutions."
            },
            // padding toggle
            padding: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Padding",
                desc: "Gives you some extra space at the edges of the screen."
            },
            // reflection toggle
            reflections: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Reflections",
                desc: "A reflection of the bars is present below them. <i>Forces Baseline to Enabled.</i>"
            },
            // baseline toggle
            baseline: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Baseline",
                desc: "Raises the baseline to halfway up the screen. Full screen is used if disabled."
            },
            // bobbers toggle
            bobbers: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Bobbers",
                desc: "The bobbers will linger after the bars push them up, before slowly falling down."
            },
            // bobber delay milliseconds
            bobberDelay: {
                type: "number",
                value: 250,
                default: 250,
                range: [0, 10000],
                step: 50,
                title: "Bobber Fall Delay",
                desc: "How many milliseconds until the bobbers start to fall?"
            },
            // bobber speed multiplier
            bobberSpeed: {
                type: "number",
                value: 2,
                default: 2,
                range: [0, 20],
                step: 0.1,
                title: "Bobber Falling Speed",
                desc: "How quickly do the bobbers fall?"
            }
        },
        bobbers: []
    },
    central: {
        name: "Central",
        image: "visualizers/central.png",
        bestColor: "beta",
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
            var maxHeight = size[1] * 0.5 - size[1] * 0.25;
            
            for(var i = 0; i < 64; i++){
                var strength = visData[i];
                
                var fillColor = getColor(strength, i * 4);
                canvas.fillStyle = fillColor;
                canvas.fillRect(
                    Math.round(left + i * barSpacing),
                    Math.floor(size[1] / 2) - Math.round(strength / 255 * maxHeight) - 5,
                    Math.round(barWidth),
                    Math.round(strength / 255 * maxHeight * 2 + 10)
                );
                if(smokeEnabled){
                    smoke.fillStyle = fillColor;
                    smoke.fillRect(
                        Math.round(left + i * barSpacing),
                        Math.floor(size[1] / 2) - Math.round(strength / 255 * maxHeight) - 5,
                        Math.round(barWidth),
                        Math.round(strength / 255 * maxHeight * 2 + 10)
                    );
                }
            }
        },
        stop: function(){
            
        },
        sqrt255: Math.sqrt(255)
    },
    wave: {
        name: "Wave",
        image: "visualizers/wave.png",
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 64;
            var last = -1;
            var heightFactor = (size[1] / 3) / 255;
            var widthFactor = 64 / size[0] * 2;

                    for(var i = 0; i < size[0] / 2; i++){
                        // width is larger than data
                        var pcnt = i / (size[0] / 2);
                        var closestPoint = visData[Math.floor(pcnt * 64)];
                        var nextPoint = visData[Math.floor(pcnt * 64) + 1];
                        if(nextPoint === undefined){
                            nextPoint = closestPoint;
                        }
                        var u = pcnt * 64 - Math.floor(pcnt * 64);
                        //tempLines[i] = ((1 - u) * closestPoint) + (u * nextPoint);
                        this.drawLine(i, ((1 - u) * closestPoint) + (u * nextPoint), heightFactor, widthFactor);
                    }
        },
        stop: function(){
            
        },
        drawLine: function(x, h, fact, widthFact){
            var fillColor = getColor(h, x / (size[0] / 2) * 255);
            canvas.fillStyle = fillColor;
            canvas.fillRect(x + size[0] / 2, (255 - h)  * fact - 2 + (size[1] / 6), 1, h * fact * 2 + 4);
            if(x !== 0){
                canvas.fillRect(size[0] / 2 - x, (255 - h)  * fact - 2 + (size[1] / 6), 1, h * fact * 2 + 4);
            }
            if(smokeEnabled){
                smoke.fillStyle = fillColor;
                smoke.fillRect(x + size[0] / 2, (255 - h)  * fact + (size[1] / 6), 1, h * fact * 2);
                if(x !== 0){
                    smoke.fillRect(size[0] / 2 - x, (255 - h)  * fact + (size[1] / 6), 1, h * fact * 2);
                }
            }
        }
    },
    bassWave: {
        name: "Bass Wave",
        image: "visualizers/bassWave.png",
        bestColor: "bluegreenred",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 12;
            var last = -1;
            var heightFactor = (size[1] / 3) / 255;
            var widthFactor = 64 / size[0] * 2;
            for(var i = 0; i < size[0] / 2; i++){
                // width is larger than data
                var pcnt = i / (size[0] / 2);
                var closestPoint = visData[Math.floor(pcnt * 12)];
                var nextPoint = visData[Math.floor(pcnt * 12) + 1];
                if(nextPoint === undefined){
                    nextPoint = closestPoint;
                }
                var u = pcnt * 12 - Math.floor(pcnt * 12);
                //tempLines[i] = ((1 - u) * closestPoint) + (u * nextPoint);
                this.drawLine(i, ((1 - u) * closestPoint) + (u * nextPoint), heightFactor, widthFactor);
            }
        },
        stop: function(){
            
        },
        drawLine: function(x, h, fact, widthFact){
            var fillColor = getColor(h, x / (size[0] / 2) * 255);
            canvas.fillStyle = fillColor;
            canvas.fillRect(x + size[0] / 2, (255 - h)  * fact - 2 + (size[1] / 6), 1, h * fact * 2 + 4);
            if(x !== 0){
                canvas.fillRect(size[0] / 2 - x, (255 - h)  * fact - 2 + (size[1] / 6), 1, h * fact * 2 + 4);
            }
            if(smokeEnabled){
                smoke.fillStyle = fillColor;
                smoke.fillRect(x + size[0] / 2, (255 - h)  * fact + (size[1] / 6), 1, h * fact * 2);
                if(x !== 0){
                    smoke.fillRect(size[0] / 2 - x, (255 - h)  * fact + (size[1] / 6), 1, h * fact * 2);
                }
            }
        }
    },
    triWave: {
        name: "Triple Wave",
        image: "visualizers/tripleWave.png",
        bestColor: "bluegreenred",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var heightFactor = (size[1] / 4) / 255;
            var heightFactorTreble = (size[1] / 4) / 255;
            var widthFactor = 64 / size[0] * 2;
            for(var i = 0; i < size[0]; i++){
                // width is larger than data
                var pcntTreble = i / size[0];
                var closestPointTreble = visData[Math.floor(pcntTreble * 52) + 12];
                var nextPointTreble = visData[Math.floor(pcntTreble * 52) + 13];
                if(nextPointTreble === undefined){
                    nextPointTreble = closestPointTreble;
                }
                var uTreble = pcntTreble * 52 - Math.floor(pcntTreble * 52);
                this.drawTrebleLine(i, ((1 - uTreble) * closestPointTreble) + (uTreble * nextPointTreble), heightFactorTreble);
                if(i < size[0] / 2){
                    var pcnt = i / (size[0] / 2);
                    var closestPoint = visData[Math.floor(pcnt * 12)];
                    var nextPoint = visData[Math.floor(pcnt * 12) + 1];
                    if(nextPoint === undefined){
                        nextPoint = closestPoint;
                    }
                    var u = pcnt * 12 - Math.floor(pcnt * 12);
                    //tempLines[i] = ((1 - u) * closestPoint) + (u * nextPoint);
                    this.drawLine(i, ((1 - u) * closestPoint) + (u * nextPoint), heightFactor, widthFactor);
                }
            }
        },
        stop: function(){
            
        },
        drawLine: function(x, h, fact, widthFact){
            var fillColor = getColor(h, x / (size[0] / 2) * 255);
            canvas.fillStyle = fillColor;
            canvas.fillRect(x + size[0] / 2, (255 - h)  * fact - 2 + (size[1] / 4), 1, h * fact * 2 + 4);
            if(x !== 0){
                canvas.fillRect(size[0] / 2 - x, (255 - h)  * fact - 2 + (size[1] / 4), 1, h * fact * 2 + 4);
            }
            if(smokeEnabled){
                smoke.fillStyle = fillColor;
                smoke.fillRect(x + size[0] / 2, (255 - h)  * fact + (size[1] / 4), 1, h * fact * 2 + 4);
                if(x !== 0){
                    smoke.fillRect(size[0] / 2 - x, (255 - h)  * fact + (size[1] / 4), 1, h * fact * 2 + 4);
                }
            }
        },
        drawTrebleLine: function(x, h, fact){
            var fillColor = getColor(h, x / (size[0] / 2) * 255);
            canvas.fillStyle = fillColor;
            canvas.fillRect(x, 0, 1, h * fact + 2);
            canvas.fillRect(x, size[1] - (h * fact + 2), 1, h * fact + 2);
            if(smokeEnabled){
                fillColor = getColor(h, x / size[0] * 255);
                smoke.fillStyle = fillColor;
                smoke.fillRect(x, 0, 1, h * fact + 2);
                smoke.fillRect(x, size[1] - (h * fact + 2), 1, h * fact + 2);
            }
        }
    },
    lasers: {
        name: "Light Show",
        image: "visualizers/lasers.png",
        bestColor: "rainbowActive",
        start: function(){

        },
        frame: function(){
            var spaceBetweenFixtures = size[0] * 0.05859375;
            var fixtureHeight = 30;
            if(this.settings.halfFixtureSize.value){
                spaceBetweenFixtures /= 2;
                fixtureHeight /= 2;
            }

            if(this.settings.separation.value){
                var separationDistance = size[0] / 2 - (spaceBetweenFixtures * 6);
            }else{
                var separationDistance = 0;
            }

            var angleBias = 15;
            if(this.settings.doubleAngleBias.value){
                angleBias *= 2;
            }
            
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }

            // RIGHT SIDE OF LASERS
            for(var i = 0; i < 12; i += 2){
                canvas.globalCompositeOperation = 'screen';

                var laserPos = size[0] / 2 + i * 2 * (spaceBetweenFixtures / 4) + separationDistance + spaceBetweenFixtures / 2;
                if(!separationDistance && this.settings.middleLasers.value){
                    laserPos += spaceBetweenFixtures;
                }

                if(this.settings.dataFilter.value){
                    var laserColor = getColor(mods.pow2.test(visData[i]), i * (255 / 12));
                    var laserAngle = (255 - mods.pow2.test(visData[i])) / 3 - 132 - angleBias;
                    var laserWidth = mods.pow2.test(visData[i]) / 32 + 0.03125;
                }else{
                    var laserColor = getColor(visData[i], i * (255 / 12));
                    var laserAngle = (255 - visData[i]) / 3 - 132 - angleBias;
                    var laserWidth = visData[i] / 32 + 0.03125;
                }
                if(this.settings.fixedLaserWidth.value){
                    laserWidth = 8;
                }
                if(this.settings.halfFixtureSize.value){
                    laserWidth /= 2;
                }

                canvas.strokeStyle = laserColor;
                canvas.lineWidth = laserWidth;
                canvas.beginPath();
                canvas.moveTo(laserPos, size[1] - fixtureHeight);
                var newPoint = this.findNewPoint(
                    laserPos,
                    size[1] - fixtureHeight,
                    laserAngle,
                    size[0] + size[1]
                );
                canvas.lineTo(newPoint.x, newPoint.y);
                canvas.stroke();

                var fixture1 = this.findNewPoint(
                    laserPos, 
                    size[1] - fixtureHeight,
                    laserAngle,
                    10 / (this.settings.halfFixtureSize.value + 1)
                );
                var fixture2 = this.findNewPoint(
                    laserPos, 
                    size[1] - fixtureHeight,
                    laserAngle,
                    -10 / (this.settings.halfFixtureSize.value + 1)
                );

                if(smokeEnabled){
                    smoke.strokeStyle = laserColor;
                    smoke.lineWidth = laserWidth * 2.5;
                    smoke.beginPath();
                    smoke.moveTo(fixture1.x, size[1] - fixtureHeight);
                    smoke.lineTo(newPoint.x, newPoint.y);
                    smoke.stroke();
                }

                canvas.globalCompositeOperation = 'source-over';
                canvas.strokeStyle = "#222";
                canvas.lineWidth = 4 / (this.settings.halfFixtureSize.value + 1);
                canvas.beginPath();
                canvas.moveTo(laserPos, size[1] - fixtureHeight);
                canvas.lineTo(laserPos, size[1]);
                canvas.stroke();
                canvas.strokeStyle = "#333";
                canvas.lineWidth = 10 / (this.settings.halfFixtureSize.value + 1);
                canvas.beginPath();
                canvas.moveTo(fixture1.x, fixture1.y);
                canvas.lineTo(fixture2.x, fixture2.y);
                canvas.stroke();
            }

            // LEFT SIDE OF LASERS
            for(var i = 1; i < 12; i += 2){
                canvas.globalCompositeOperation = 'screen';

                var laserPos = size[0] / 2 - (i * 2 + 2) * (spaceBetweenFixtures / 4) - separationDistance + spaceBetweenFixtures / 2;
                if(!separationDistance && this.settings.middleLasers.value){
                    laserPos -= spaceBetweenFixtures;
                }

                if(this.settings.dataFilter.value){
                    var laserColor = getColor(mods.pow2.test(visData[i]), i * (255 / 12));
                    var laserAngle = mods.pow2.test(visData[i]) / 3 - 132 + angleBias;
                    var laserWidth = mods.pow2.test(visData[i]) / 32 + 0.03125;
                }else{
                    var laserColor = getColor(visData[i], i * (255 / 12));
                    var laserAngle = visData[i] / 3 - 132 + angleBias;
                    var laserWidth = visData[i] / 32 + 0.03125;
                }
                if(this.settings.fixedLaserWidth.value){
                    laserWidth = 8;
                }
                if(this.settings.halfFixtureSize.value){
                    laserWidth /= 2;
                }

                canvas.strokeStyle = laserColor;
                canvas.lineWidth = laserWidth;
                canvas.beginPath();
                canvas.moveTo(laserPos, size[1] - fixtureHeight);
                var newPoint = this.findNewPoint(
                    laserPos,
                    size[1] - fixtureHeight,
                    laserAngle,
                    size[0] + size[1]
                );
                canvas.lineTo(newPoint.x, newPoint.y);
                canvas.stroke();
                
                var fixture1 = this.findNewPoint(
                    laserPos, 
                    size[1] - fixtureHeight,
                    laserAngle,
                    10 / (this.settings.halfFixtureSize.value + 1)
                );
                var fixture2 = this.findNewPoint(
                    laserPos, 
                    size[1] - fixtureHeight,
                    laserAngle,
                    -10 / (this.settings.halfFixtureSize.value + 1)
                );

                if(smokeEnabled){
                    smoke.strokeStyle = laserColor;
                    smoke.lineWidth = laserWidth * 2.5;
                    smoke.beginPath();
                    smoke.moveTo(fixture1.x, size[1] - fixtureHeight);
                    smoke.lineTo(newPoint.x, newPoint.y);
                    smoke.stroke();
                }

                canvas.globalCompositeOperation = 'source-over';
                canvas.strokeStyle = "#222";
                canvas.lineWidth = 4 / (this.settings.halfFixtureSize.value + 1);
                canvas.beginPath();
                canvas.moveTo(laserPos, size[1] - fixtureHeight);
                canvas.lineTo(laserPos, size[1]);
                canvas.stroke();
                canvas.strokeStyle = "#333";
                canvas.lineWidth = 10 / (this.settings.halfFixtureSize.value + 1);
                canvas.beginPath();
                canvas.moveTo(fixture1.x, fixture1.y);
                canvas.lineTo(fixture2.x, fixture2.y);
                canvas.stroke();
            }
            
            // CENTER LASERS
            if(this.settings.middleLasers.value){
                var trebleAmount = 0;
                for(var i = 12; i < 64; i++){
                    trebleAmount = Math.max(trebleAmount, visData[i]);
                }
                // new pitch alg
                if(this.settings.middleType.value === "pitch"){
                    trebleAmount = Math.max(trebleAmount, Math.max(...visData.slice(64, 128)));
                }

                if(this.settings.middleType.value.indexOf("pitch") === 0){
                    var trebleAvg = this.weightedAverage(visData.slice(12, 64), 0.7) / 52;
                    if(isNaN(trebleAvg)){
                        trebleAvg = 0.5;
                    }
                    // new pitch alg
                    if(this.settings.middleType.value === "pitch"){
                        var extraBoost = Math.max(...visData.slice(64, 128)) / 255;
                        var extraFreq = (this.weightedAverage(visData.slice(64, 128), 0.75) / 64) || 0;
                        trebleAvg += (extraBoost * (extraFreq / 2 + 0.5)) * (1 - trebleAvg);
                    }
                    var moveCap = 0.05 * fpsCompensation;
                    if(trebleAvg > this.centerLasers + moveCap){
                        trebleAvg = this.centerLasers + moveCap;
                    }else if(trebleAvg < this.centerLasers - moveCap){
                        trebleAvg = this.centerLasers - moveCap;
                    }
                    this.centerLasers = trebleAvg;
                }

                for(var j = -1; j < 2; j += 2){
                    canvas.globalCompositeOperation = 'screen';

                    var laserPos = size[0] / 2 + j * spaceBetweenFixtures / 2;
                    if(this.settings.dataFilter.value){
                        if(this.settings.middleType.value === "pitch"){
                            var laserColor = getColor(trebleAmount, trebleAvg * 255);
                            if(j === 1){
                                var laserAngle = (255 - trebleAvg * 255) / 3 - 132;
                            }else{
                                var laserAngle = trebleAvg * 255 / 3 - 132;
                            }
                        }else{
                            var laserColor = getColor(mods.pow2.test(trebleAmount), mods.pow2.test(trebleAmount));
                            if(j === 1){
                                var laserAngle = (255 - mods.pow2.test(trebleAmount)) / 3 - 132;
                            }else{
                                var laserAngle = mods.pow2.test(trebleAmount) / 3 - 132;
                            }
                        }
                        var laserWidth = mods.pow2.test(trebleAmount) / 32 + 0.03125;
                    }else{
                        if(this.settings.middleType.value === "pitch"){
                            var laserColor = getColor(trebleAmount, trebleAvg * 255);
                            if(j === 1){
                                var laserAngle = (255 - trebleAvg * 255) / 3 - 132;
                            }else{
                                var laserAngle = trebleAvg * 255 / 3 - 132;
                            }
                        }else{
                            var laserColor = getColor(trebleAmount, trebleAmount);
                            if(j === 1){
                                var laserAngle = (255 - trebleAmount) / 3 - 132;
                            }else{
                                var laserAngle = trebleAmount / 3 - 132;
                            }
                        }
                        var laserWidth = trebleAmount / 32 + 0.03125;
                    }
                    if(this.settings.fixedLaserWidth.value){
                        laserWidth = 8;
                    }
                    if(this.settings.halfFixtureSize.value){
                        laserWidth /= 2;
                    }

                    canvas.strokeStyle = laserColor;
                    canvas.lineWidth = laserWidth;
                    canvas.beginPath();
                    canvas.moveTo(laserPos, size[1] - fixtureHeight);
                    var newPoint = this.findNewPoint(
                        laserPos,
                        size[1] - fixtureHeight,
                        laserAngle,
                        size[0] + size[1]
                    );
                    canvas.lineTo(newPoint.x, newPoint.y);
                    canvas.stroke();

                    var fixture1 = this.findNewPoint(
                        laserPos, 
                        size[1] - fixtureHeight,
                        laserAngle,
                        10 / (this.settings.halfFixtureSize.value + 1)
                    );
                    var fixture2 = this.findNewPoint(
                        laserPos, 
                        size[1] - fixtureHeight,
                        laserAngle,
                        -10 / (this.settings.halfFixtureSize.value + 1)
                    );

                    if(smokeEnabled){
                        smoke.strokeStyle = laserColor;
                        smoke.lineWidth = laserWidth * 2.5;
                        smoke.beginPath();
                        smoke.moveTo(fixture1.x, size[1] - fixtureHeight);
                        smoke.lineTo(newPoint.x, newPoint.y);
                        smoke.stroke();
                    }

                    canvas.globalCompositeOperation = 'source-over';
                    canvas.strokeStyle = "#222";
                    canvas.lineWidth = 4 / (this.settings.halfFixtureSize.value + 1);
                    canvas.beginPath();
                    canvas.moveTo(laserPos, size[1] - fixtureHeight);
                    canvas.lineTo(laserPos, size[1]);
                    canvas.stroke();
                    canvas.strokeStyle = "#333";
                    canvas.lineWidth = 10 / (this.settings.halfFixtureSize.value + 1);
                    canvas.beginPath();
                    canvas.moveTo(fixture1.x, fixture1.y);
                    canvas.lineTo(fixture2.x, fixture2.y);
                    canvas.stroke();
                }
            }
        },
        stop: function(){

        },
        centerLasers: 0.5,
        weightedAverage: function(arr, minPcnt){
            var weight = 0;
            var total = 0;
            var minValue = Math.max(...arr) * minPcnt;
            for(var i in arr){
                weight += ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
                total += i * ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
            }
            return total / weight;
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
        findNewPoint: function(x, y, angle, distance) { // from codershop on Stack Overflow
            var result = {};
        
            result.x = /*Math.round*/(Math.cos(angle * Math.PI / 180) * distance + x);
            result.y = /*Math.round*/(Math.sin(angle * Math.PI / 180) * distance + y);
        
            return result;
        },
        settings: {
            middleLasers: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Treble Lasers",
                desc: "Lasers in the center which are affected by the treble."
            },
            middleType: {
                type: "choice",
                value: "pitch",
                default: "pitch",
                title: "Treble Laser Mode",
                desc: "Select what the Treble lasers react to.",
                choices: {pitch: "Pitch (new)", pitchold: "Pitch (old)", volume: "Volume"}
            },
            separation: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Fixture Separation",
                desc: "Splits laser fixtures into two groups at either edge of the screen."
            },
            halfFixtureSize: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Half Fixture Size",
                desc: "Halves size of the laser fixtures. Laser beams will be thinner too."
            },
            fixedLaserWidth: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Fixed Laser Width",
                desc: "Lasers are always full-width, even with weak frequency amplitudes."
            },
            doubleAngleBias: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Double Angle Bias",
                desc: "Doubles the angle bias, causing laser fixtures to point more sharply towards the center."
            },
            dataFilter: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Data Filter",
                desc: "Filters data to lower the impact of quiet noises. Makes the light show less chaotic."
            }
        }
    },
    lasers2: {
        name: "Light Show 2",
        image: "visualizers/lasers2.png",
        bestColor: "rainbowActive",
        start: function(){

        },
        frame: function(){
            var spaceBetweenFixtures = size[0] * 0.05859375;
            var fixtureHeight = 30;
            if(this.settings.halfFixtureSize.value){
                spaceBetweenFixtures /= 2;
                fixtureHeight /= 2;
            }

            // if(this.settings.separation.value){
            //     var separationDistance = size[0] / 2 - spaceBetweenFixtures;
            // }else{
                var separationDistance = 0;
            // }
            
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }

            var bassAmounts = visData.slice(0, 12);
            bassAmounts.sort((a, b) => a - b);
            var bassAmount = 0;
            for(var i = 0; i < 4; i++){
                bassAmount += bassAmounts[11 - i];
            }
            bassAmount /= 4;

            var trebleAmounts = visData.slice(12, 64);
            trebleAmounts.sort((a, b) => a - b);
            var trebleAmount = 0;
            for(var i = 0; i < 4; i++){
               trebleAmount += trebleAmounts[51 - i];
            }
            trebleAmount /= 4;
            // new pitch alg
            if(this.settings.pitchType.value === "new"){
                trebleAmount = Math.max(trebleAmount, Math.max(...visData.slice(64, 128)));
            }
            //var trebleAmount = 0;
            //for(var i = 12; i < 64; i++){
            //    trebleAmount = Math.max(trebleAmount, visData[i]);
            //}

            var bassAvg = this.weightedAverage(visData.slice(0, 12), 0.3) / 12;
            var trebleAvg = this.weightedAverage(visData.slice(12, 64), 0.7) / 52;
            if(isNaN(bassAvg)){
                bassAvg = 0.5;
            }
            if(isNaN(trebleAvg)){
                trebleAvg = 0.5;
            }
            if(this.settings.pitchType.value === "new"){
                var extraBoost = Math.max(...visData.slice(64, 128)) / 255;
                var extraFreq = (this.weightedAverage(visData.slice(64, 128), 0.75) / 64) || 0;
                var origAvg = trebleAvg;
                trebleAvg += (extraBoost * (extraFreq / 2 + 0.5)) * (1 - trebleAvg);
            }

            var moveCap = 0.05 * fpsCompensation;
            if(bassAvg > this.laserAngles[0] + moveCap){
                bassAvg = this.laserAngles[0] + moveCap;
            }else if(bassAvg < this.laserAngles[0] - moveCap){
                bassAvg = this.laserAngles[0] - moveCap;
            }
            if(trebleAvg > this.laserAngles[1] + moveCap){
                trebleAvg = this.laserAngles[1] + moveCap;
            }else if(trebleAvg < this.laserAngles[1] - moveCap){
                trebleAvg = this.laserAngles[1] - moveCap;
            }

            this.laserAngles = [bassAvg, trebleAvg];

            var laserValues = [[bassAvg, bassAmount], [trebleAvg, trebleAmount]];

            // LASERS
            for(var i = 0; i < 2; i++){
                canvas.globalCompositeOperation = 'screen';

                var laserPos = size[0] / 2;
                // if(this.settings.separation.value){
                //     if(i){
                //         laserPos += separationDistance;
                //     }else{
                //         laserPos -= separationDistance;
                //     }
                // }else{
                    if(i){
                        laserPos += spaceBetweenFixtures;
                    }else{
                        laserPos -= spaceBetweenFixtures;
                    }
                // }

                var laserColor = getColor(laserValues[i][1], laserValues[i][0] * 255);
                var laserAngle = laserValues[i][0] * 135 - 157.5;
                var laserWidth = laserValues[i][1] / 32 + 0.03125;
                if(this.settings.fixedLaserWidth.value){
                    laserWidth = 8;
                }
                if(this.settings.halfFixtureSize.value){
                    laserWidth /= 2;
                }

                canvas.strokeStyle = laserColor;
                canvas.lineWidth = laserWidth;
                canvas.beginPath();
                canvas.moveTo(laserPos, size[1] - fixtureHeight);
                var newPoint = this.findNewPoint(
                    laserPos,
                    size[1] - fixtureHeight,
                    laserAngle,
                    size[0] + size[1]
                );
                canvas.lineTo(newPoint.x, newPoint.y);
                canvas.stroke();

                var fixture1 = this.findNewPoint(
                    laserPos, 
                    size[1] - fixtureHeight,
                    laserAngle,
                    10 / (this.settings.halfFixtureSize.value + 1)
                );
                var fixture2 = this.findNewPoint(
                    laserPos, 
                    size[1] - fixtureHeight,
                    laserAngle,
                    -10 / (this.settings.halfFixtureSize.value + 1)
                );

                if(smokeEnabled){
                    smoke.strokeStyle = laserColor;
                    smoke.lineWidth = laserWidth * 2.5;
                    smoke.beginPath();
                    smoke.moveTo(fixture1.x, size[1] - fixtureHeight);
                    smoke.lineTo(newPoint.x, newPoint.y);
                    smoke.stroke();
                }

                canvas.globalCompositeOperation = 'source-over';
                canvas.strokeStyle = "#222";
                canvas.lineWidth = 4 / (this.settings.halfFixtureSize.value + 1);
                canvas.beginPath();
                canvas.moveTo(laserPos, size[1] - fixtureHeight);
                canvas.lineTo(laserPos, size[1]);
                canvas.stroke();
                canvas.strokeStyle = "#333";
                canvas.lineWidth = 10 / (this.settings.halfFixtureSize.value + 1);
                canvas.beginPath();
                canvas.moveTo(fixture1.x, fixture1.y);
                canvas.lineTo(fixture2.x, fixture2.y);
                canvas.stroke();
            }
        },
        stop: function(){

        },
        laserAngles: [0.5, 0.5],
        weightedAverage: function(arr, minPcnt){
            var weight = 0;
            var total = 0;
            var minValue = Math.max(...arr) * minPcnt;
            for(var i in arr){
                weight += ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
                total += i * ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
            }
            return total / weight;
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
        findNewPoint: function(x, y, angle, distance) { // from codershop on Stack Overflow
            var result = {};
        
            result.x = /*Math.round*/(Math.cos(angle * Math.PI / 180) * distance + x);
            result.y = /*Math.round*/(Math.sin(angle * Math.PI / 180) * distance + y);
        
            return result;
        },
        settings: {
            halfFixtureSize: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Half Fixture Size",
                desc: "Halves size of the laser fixtures. Laser beams will be thinner too."
            },
            // separation: {
            //     type: "toggle",
            //     value: 0,
            //     default: 0,
            //     title: "Fixture Separation",
            //     desc: "Splits laser fixtures into two groups at either edge of the screen."
            // },
            fixedLaserWidth: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Fixed Laser Width",
                desc: "Lasers are always full-width, even with weak frequency amplitudes."
            },
            pitchType: {
                type: "choice",
                value: "new",
                default: "new",
                choices: {new: "New", old: "Old"},
                title: "Pitch Detection",
                desc: "What pitch detection algorithm to use?<br><br>\"New\" responds to higher frequencies than \"Old\"."
            }
            // doubleAngleBias: {
            //     type: "toggle",
            //     value: 0,
            //     default: 0,
            //     title: "Double Angle Bias",
            //     desc: "Doubles the angle bias if fixtures are separated, causing laser fixtures to point more sharply towards the center."
            // },
        }
    },
    spikes1to1: {
        name: "Bars",
        image: "visualizers/spikesClassic.png",
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            canvas.fillStyle = "#000";
            canvas.fillRect(0, size[1] / 2 + 127, size[0], size[1] / 2 - 127);
            smoke.clearRect(0, 0, size[0], size[1]);
            //var left = size[0] / 2 - 512;
            //var top = size[1] / 2 - 128;
            var hfact = size[0] / 64;
            var yfact = size[1] / 255;
            for(var i = 0; i < 64; i++){
                this.drawLine(i, visData[i], hfact, yfact);
            }
            //updateSmoke();
        },
        stop: function(){
            
        },
        drawLine: function(x, h, l, t){
            var fillColor = getColor(h, x * (255 / 64));
            canvas.fillStyle = fillColor;
            var xtimesl = x * l;
            var l2 = Math.floor(l);
            if(xtimesl - Math.floor(xtimesl) >= 0.5){
                l2 += 1;
            }
            canvas.fillRect(Math.floor(xtimesl), size[1] - (h * t), l2, h * t);
            if(smokeEnabled){
                smoke.fillStyle = fillColor;
                canvas.fillRect(Math.floor(xtimesl), size[1] - (h * t), l2, h * t);
            }
        }
    },
    spikes: {
        name: "Spikes",
        image: "visualizers/spikesStretch.png",
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 64;
            var last = -1;
            var heightFactor = size[1] / 255;
            var widthFactor = 64 / size[0];

            if(widthFactor !== 1){
                var tempLines = [];
                var tempMax = 0;
                if(widthFactor < 1){
                    for(var i = 0; i < size[0]; i++){
                        // width is larger than data
                        var pcnt = i / size[0];
                        var closestPoint = visData[Math.floor(pcnt * 64)];
                        var nextPoint = visData[Math.floor(pcnt * 64) + 1];
                        if(nextPoint === undefined){
                            nextPoint = closestPoint;
                        }
                        var u = pcnt * 64 - Math.floor(pcnt * 64);
                        tempLines[i] = ((1 - u) * closestPoint) + (u * nextPoint);
                    }
                }else{
                    for(var i = 0; i < size[0]; i++){
                        // width is smaller than data
                        var firstPcnt = i / size[0];
                        var lastPcnt = (i + 1) / size[0];
                        var firstPlace = firstPcnt * 64;
                        var lastPlace = lastPcnt * 64;
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
    refraction: {
        name: "Refraction",
        image: 'visualizers/refraction.png',
        bestColor: "refractionrgb",
        start: function(){

        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            var center = [Math.floor(size[0] / 2), Math.floor(size[1] / 2)];
            var points = new Array(Math.floor(size[1] / 128) * 64);
            var samples = this.settings.samples.value;
            points.fill(0);
            if(debugForce){
                var debugPoints = new Array(samples);
                for(var i = 0; i < debugPoints.length; i++){
                    debugPoints[i] = new Array(points.length);
                    debugPoints[i].fill(0);
                }
            }
            for(var i = 0; i < samples; i++){
                var frequency = i + 1;
                var step = points.length / frequency * 2;
                var j = this.settings.reverseSampleOrder.value ? points.length - 1 : 0;
                while(
                    (this.settings.reverseSampleOrder.value && j >= 0) ||
                    (!this.settings.reverseSampleOrder.value && j < points.length)
                ){
                    var pointPos = j % step / step;
                    var pointValue = gcalc([[0, -0.5 * visData[i]], [0.5, 0.5 * visData[i]], [1, -0.5 * visData[i]]], pointPos);

                    points[j] = points[j] + pointValue;

                    switch(this.settings.overflowMethod.value){
                        case "limit":
                            if(points[j] > 127.5){
                                points[j] = 127.5;
                            }
                            if(points[j] < -127.5){
                                points[j] = -127.5;
                            }
                            break;
                        case "overflow":
                            break;
                        case "bounce":
                            if(points[j] > 127.5){
                                points[j] = 127.5 - (127.5 - j);
                            }
                            if(points[j] < -127.5){
                                points[j] = -127.5 + (127.5 - (j * -1));
                            }
                            break;
                        case "wrap":
                            if(points[j] > 127.5){
                                points[j] = -127.5 + (127.5 - j);
                            }
                            if(points[j] < -127.5){
                                points[j] = 127.5 - (127.5 - (j * -1));
                            }
                            break;
                        default:

                    }
                    
                    if(debugForce){
                        debugPoints[i][j] = pointValue;
                    }

                    j += this.settings.reverseSampleOrder.value * -2 + 1;
                }
            }
            for(var i = 0; i < points.length; i++){
                // why can't i draw Arcs while this visualizer is selected????
                // no seriously, can someone figure out what's going on?
                // i will be eternally grateful

                //canvas.fillStyle = "#000";
                //this.degArc2(center[0], center[1], points.length - i, 0, 360);
                canvas.fillStyle = getColor(points[i] + 127.5, i / points.length * 255);
                //this.degArc2(center[0], center[1], points.length - i, 0, 360);

                // x+
                canvas.fillRect(center[0] + i, center[1] - i, 1, i * 2);
                // x-
                canvas.fillRect(center[0] - i - 1, center[1] - i, 1, i * 2);
                // y+
                canvas.fillRect(center[0] - i, center[1] + i - 1, i * 2, 1);
                // y-
                canvas.fillRect(center[0] - i, center[1] - i, i * 2, 1);
            }

            if(debugForce){
                for(var j = 0; j < debugPoints.length; j++){
                    for(var k = 0; k < debugPoints[j].length; k++){
                        canvas.fillStyle = getColor(debugPoints[j][k] + 127.5, k / points.length * 255);
                        canvas.fillRect(center[0] - points.length - 4 - (j * 4), center[1] + k - 1, 2, 1);
                    }
                }
            }
        },
        stop: function(){

        },
        settings: {
            samples: {
                type: "number",
                value: 16,
                default: 16,
                range: [1, 64],
                step: 1,
                title: "Frequency Sample Count",
                desc: "How many frequencies are considered in the waves?<br><br>High samples may be too chaotic. Low samples may be too unresponsive.<br><br>" +
                    '<i>12</i> | Normal bass frequencies used by other visualizers.<br><br>' +
                    '<i>16</i> | Extended bass frequencies used by default in this visualizer.'
            },
            overflowMethod: {
                type: "choice",
                value: "limit",
                default: "limit",
                title: "Overflow Method",
                choices: {
                    limit: "Hard Limit",
                    overflow: "Allow Overflow",
                    bounce: "Bounce Back",
                    wrap: "Wrap Around"
                },
                desc: "When waves overlap, how do we handle overflow past maximum intensity?<br><br>" +
                    '<i>125% =&gt; 100% </i>|<i> -25% =&gt; &nbsp; 0%</i> | Hard Limit: Values will be capped to the maximum limit.<br><br>' +
                    '<i>125% =&gt; 125% </i>|<i> -25% =&gt; -25%</i> | Allow Overflow: Values will go beyond the maximum limit.<br><br>' +
                    '<i>125% =&gt; &nbsp;75% </i>|<i> -25% =&gt; &nbsp;25%</i> | Bounce Back: Values will bounce back off the maximum limit.<br><br>' +
                    '<i>125% =&gt; &nbsp;25% </i>|<i> -25% =&gt; &nbsp;75%</i> | Wrap Around: Values will wrap around to the opposite limit.',
            },
            reverseSampleOrder: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Reverse Sample Order",
                desc: "Add samples together counting down from high frequencies, rather than counting up from low frequencies.<br><br>" +
                    'This can make low bass frequencies (wide bands) more prominent, at the cost of snuffing out high frequencies (narrow bands).<br><br>' +
                    'This effect is not noticeable in most songs.'
            }
        },
        findNewPoint: function(x, y, angle, distance) { // from codershop on Stack Overflow
            var result = {};
        
            result.x = /*Math.round*/(Math.cos(angle * Math.PI / 180) * distance + x);
            result.y = /*Math.round*/(Math.sin(angle * Math.PI / 180) * distance + y);
        
            return result;
        },
        degArc2: function(x, y, r, a, b){
            canvas.beginPath();
            canvas.arc(x, y, r, (a / 360) * this.TAU, (b / 360) * this.TAU);
            canvas.fill();
        }
    },
    pitchmograph: {
        name: "Pitchmograph",
        image: "visualizers/pitchmograph.png",
        bestColor: "beta",
        start: function(){
            this.graph = new Array(size[1]);
            this.graph.fill([-1, 0], 0, size[1]);
        },
        frame: function(){
            // PITCH LOGIC FROM AVG PITCH
            var avgVolume = 0;
            for(var i = 0; i < 12; i++){
                avgVolume += Math.sqrt(visData[i]) * this.sqrt255;
                //avgVolume += visData[i];
            }
            avgVolume /= 12;
            if(this.settings.oldPitch.value){
                var avgPitch = 0;
                var avgPitchMult = 0;
                for(var i = 0; i < 64; i++){
                    avgPitch += i * visData[i];
                    avgPitchMult += visData[i];
                }
                avgPitch /= avgPitchMult;
            }else{
                var avgPitch = this.weightedAverage(visData.slice(0, 64));
            }

            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            this.graph.push([avgPitch, avgVolume]);
            while(this.graph.length > size[1]){
                this.graph.shift();
            }
            var graphLength = this.graph.length;
            var multiplier = size[0] / 64;
            canvas.lineWidth = 2;
            smoke.lineWidth = 2;
            for(var i = 0; i < graphLength; i++){
                canvas.strokeStyle = getColor(this.graph[i][1], 255 - i / size[0] * 255);
                canvas.beginPath();
                canvas.moveTo(this.graph[i][0] * multiplier, size[1] - i - 1.5);
                canvas.lineTo(((typeof this.graph[i - 1] === "object") ? this.graph[i - 1] : this.graph[i])[0] * multiplier, size[1] - i - 0.5);
                canvas.stroke();
                //canvas.fillRect(graphLength - i - 1, size[1] - (this.graph[i] * multiplier), 1, 1);
                if(smokeEnabled){
                    smoke.strokeStyle = getColor(this.graph[i][0], 255 - i / size[0] * 255);
                    smoke.beginPath();
                    smoke.moveTo(this.graph[i][0] * multiplier, size[1] - i - 1.5);
                    smoke.lineTo(((typeof this.graph[i - 1] === "object") ? this.graph[i - 1] : this.graph[i])[0] * multiplier, size[1] - i - 0.5);
                    smoke.stroke();
                    //smoke.fillRect(graphLength - i - 1, size[1] - (this.graph[i] * multiplier), 1, 1);
                }
            }
        },
        stop: function(){
            this.graph = [];
        },
        graph: [],
        sqrt255: Math.sqrt(255),
        weightedAverage: function(arr, minPcnt){
            var weight = 0;
            var total = 0;
            var minValue = Math.max(...arr) * minPcnt;
            for(var i in arr){
                weight += ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
                total += i * ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
            }
            return total / weight;
        },
        settings: {
            oldPitch: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Use Old Pitch Algorithm",
                desc: "The old pitch algorithm is squirrelly and does not consider the \"whole picture\"."
            },
        }
    },
    seismograph: {
        name: "Beatmograph 1",
        image: "visualizers/seismograph.png",
        bestColor: "beta",
        start: function(){
            this.graph = new Array(size[0]);
            this.graph.fill(-1, 0, size[0]);
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var avg = 0;
            for(var i = 0; i < 12; i++){
                avg += visData[i];
            }
            avg /= 12;
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
                canvas.lineTo(size[0] - i - 0.5, size[1] - (((typeof this.graph[i - 1] === "number") ? this.graph[i - 1] : this.graph[i]) * multiplier));
                canvas.stroke();
                //canvas.fillRect(graphLength - i - 1, size[1] - (this.graph[i] * multiplier), 1, 1);
                if(smokeEnabled){
                    smoke.strokeStyle = getColor(this.graph[i], 255 - i / size[0] * 255);
                    smoke.beginPath();
                    smoke.moveTo(size[0] - i - 1.5, size[1] - (this.graph[i] * multiplier));
                    smoke.lineTo(size[0] - i - 1.5, size[1] - (((typeof this.graph[i - 1] === "number") ? this.graph[i - 1] : this.graph[i]) * multiplier));
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
        name: "Beatmograph 2",
        image: "visualizers/barsmograph.png",
        bestColor: "beta",
        start: function(){
            this.graph = new Array(size[0]);
            this.graph.fill(-1, 0, size[0]);
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var avg = 0;
            for(var i = 0; i < 12; i++){
                avg += visData[i];
            }
            avg /= 12;
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
    'SEPARATOR_CIRCLES" disabled="': {
        name: 'Circular',
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
        bestColor: "beta",
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
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            var ringPools = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            for(var i = 0; i < 64; i++){
                var currPool = Math.floor(i / 6.4);
                ringPools[currPool] = Math.max(visData[i], ringPools[currPool]);
            }
            for(var i = 0; i < 10; i++){
                if(this.settings.dataFilter.value){
                    var strength = Math.pow(ringPools[i], 2) / 65025;
                }else{
                    var strength = ringPools[i];
                }
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
        },
        settings: {
            dataFilter: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Data Filter",
                desc: "Filters data to get more contrast between highs and lows."
            }
        }
    },
    ghostRings: {
        name: "Ghost Rings",
        image: "visualizers/ghostRings.png",
        bestColor: "beta",
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
            for(var i = 0; i < 64; i++){
                var currPool = Math.floor(i / 6.4);
                ringPools[currPool] = Math.max(visData[i], ringPools[currPool]);
                //ringPools[currPool] += visData[i];
                //ringAvgs[currPool]++;
            }
            //for(var i in ringPools){
            //    ringPools[i] /= ringAvgs[i];
            //}
            for(var i = 0; i < 10; i++){
                if(this.settings.dataFilter.value){
                    var strength = Math.pow(ringPools[i], 2) / 65025;
                }else{
                    var strength = ringPools[i];
                }
                var ringColor = getColor(strength * 255, (9 - i) * 28);
                this.ringPositions[i] += strength * 5 * fpsCompensation;
                if(this.ringPositions[i] >= 360){
                    this.ringPositions[i] -= 360;
                }

                smoke.strokeStyle = ringColor;
                this.degArcSmoke(center[0], center[1], ringWidth * 2 * (i + 1), this.ringPositions[i], this.ringPositions[i] + 180);
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
        },
        settings: {
            dataFilter: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Data Filter",
                desc: "Filters data to get more contrast between highs and lows."
            }
        }
    },
    circle: {
        name: "Circle",
        image: "visualizers/trebleCircle.png",
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var ringHeight = Math.round(Math.min(size[0], size[1]) * 0.6);
            var ringMaxRadius = ringHeight * 0.35;
            var ringMinRadius = ringHeight * 0.25;
            var ringMaxExpand = (ringMaxRadius - ringMinRadius) / 4;
            var randomShake = Math.round(Math.min(size[0], size[1]) * 0.03);
            var drumStrength = 0; // drums is all under line 12
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            for(var i = 0; i < 12; i++){
                drumStrength += Math.pow(visData[i], 2) / 255;
            }
            drumStrength /= 12;

            if(this.settings.rumble.value){
                var randomOffset = [(Math.random() - 0.5) * drumStrength / 255 * randomShake, (Math.random() - 0.5) * drumStrength / 255 * randomShake];
            }else{
                var randomOffset = [0, 0];
            }

            for(var i = 0; i < 64; i += 1){
                var strength = visData[i];
                canvas.fillStyle = getColor(strength, i * 3.9);
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                    (i - 0.01) / 64 * 180 + 90,
                    (i + 1.02) / 64 * 180 + 90
                );
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                    90 - (i + 1.02) / 64 * 180,
                    90 - (i - 0.01) / 64 * 180
                );
                if(smokeEnabled){
                    smoke.fillStyle = getColor(strength, i * 3.9);
                    this.degArcSmoke(
                        size[0] / 2 + randomOffset[0],
                        size[1] / 2 + randomOffset[1],
                        ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                        (i - 0.01) / 64 * 180 + 90,
                        (i + 1.02) / 64 * 180 + 90
                    );
                    this.degArcSmoke(
                        size[0] / 2 + randomOffset[0],
                        size[1] / 2 + randomOffset[1],
                        ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                        90 - (i + 1.02) / 64 * 180,
                        90 - (i - 0.01) / 64 * 180
                    );
                }
            }

            canvas.fillStyle = '#000';
            this.degArc2(
                size[0] / 2 + randomOffset[0],
                size[1] / 2 + randomOffset[1],
                ringMinRadius + drumStrength / 255 * ringMaxRadius - 5,
                0,
                360
            );
            if(smokeEnabled){
                smoke.fillStyle = '#000';
                this.degArc2smoke(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + drumStrength / 255 * ringMaxRadius - 5,
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
        settings: {
            rumble: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Rumble",
                desc: "Shakes the circle like an earthquake from heavy bass."
            }
        }
    },
    bassCircle: {
        name: "Bass Circle",
        image: "visualizers/bassCircle.png",
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var ringHeight = Math.round(Math.min(size[0], size[1]) * 0.6);
            var ringMaxRadius = ringHeight * 0.35;
            var ringMinRadius = ringHeight * 0.25;
            var ringMaxExpand = (ringMaxRadius - ringMinRadius) / 4;
            var randomShake = Math.round(Math.min(size[0], size[1]) * 0.03);
            var drumStrength = 0; // drums is all under line 12
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            for(var i = 0; i < 12; i++){
                drumStrength += Math.pow(visData[i], 2) / 255;
            }
            drumStrength /= 12;

            if(this.settings.rumble.value){
                var randomOffset = [(Math.random() - 0.5) * drumStrength / 255 * randomShake, (Math.random() - 0.5) * drumStrength / 255 * randomShake];
            }else{
                var randomOffset = [0, 0];
            }

            for(var i = 0; i < 12; i++){
                canvas.fillStyle = getColor(visData[i], i * 21.25);
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + visData[i] / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                    (i - 0.01) / 12 * 180 + 90,
                    (i + 1.01) / 12 * 180 + 90
                );
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + visData[i] / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                    90 - (i + 1.01) / 12 * 180,
                    90 - (i - 0.01) / 12 * 180
                );
                if(smokeEnabled){
                    smoke.fillStyle = getColor(visData[i], i * 21.25);
                    this.degArcSmoke(
                        size[0] / 2 + randomOffset[0],
                        size[1] / 2 + randomOffset[1],
                        ringMinRadius + visData[i] / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                        (i - 0.01) / 12 * 180 + 90,
                        (i + 1.01) / 12 * 180 + 90
                    );
                    this.degArcSmoke(
                        size[0] / 2 + randomOffset[0],
                        size[1] / 2 + randomOffset[1],
                        ringMinRadius + visData[i] / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                        90 - (i + 1.01) / 12 * 180,
                        90 - (i - 0.01) / 12 * 180
                    );
                }
            }

            canvas.fillStyle = '#000';
            this.degArc2(
                size[0] / 2 + randomOffset[0],
                size[1] / 2 + randomOffset[1],
                ringMinRadius + drumStrength / 255 * ringMaxRadius - 5,
                0,
                360
            );
            if(smokeEnabled){
                smoke.fillStyle = '#000';
                this.degArc2smoke(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + drumStrength / 255 * ringMaxRadius - 5,
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
        settings: {
            rumble: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Rumble",
                desc: "Shakes the circle like an earthquake from heavy bass."
            }
        }
    },
    layerCircle: {
        name: "Layered Circle",
        image: "visualizers/layeredCircle.png",
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
            var ringHeight = Math.round(Math.min(size[0], size[1]) * 0.6);
            var ringMaxRadius = ringHeight * 0.35;
            var ringMinRadius = ringHeight * 0.25;
            var ringMaxExpand = (ringMaxRadius - ringMinRadius) / 4;
            var randomShake = Math.round(Math.min(size[0], size[1]) * 0.03);
            var drumStrength = 0; // drums is all under line 12
            var center = [Math.round(size[0] / 2), Math.round(size[1] / 2)];
            for(var i = 0; i < 12; i++){
                drumStrength += Math.pow(visData[i], 2) / 255;
            }
            drumStrength /= 12;

            if(this.settings.rumble.value){
                var randomOffset = [(Math.random() - 0.5) * drumStrength / 255 * randomShake, (Math.random() - 0.5) * drumStrength / 255 * randomShake];
            }else{
                var randomOffset = [0, 0];
            }

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
                    ringMinRadius + visData[Math.abs(i)] / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                    i / 12 * 180 + 90,
                    i / 12 * 180 + 90,
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
                        ringMinRadius + visData[Math.abs(i)] / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                        i / 12 * 180 + 90,
                        i / 12 * 180 + 90,
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

            for(var i = -52; i < 53; i++){
                var strength = visData[Math.abs(i) + 12];
                
                this.degArc(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                    i / 52 * 180 + 90,
                    i / 52 * 180 + 90,
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
                        ringMinRadius + strength / 255 * ringMinRadius + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
                        i / 52 * 180 + 90,
                        i / 52 * 180 + 90,
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
                ringMinRadius + drumStrength / 255 * ringMaxRadius - 5,
                0,
                360
            );
            if(smokeEnabled){
                smoke.fillStyle = '#000';
                this.degArc2smoke(
                    size[0] / 2 + randomOffset[0],
                    size[1] / 2 + randomOffset[1],
                    ringMinRadius + drumStrength / 255 * ringMaxRadius - 5,
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
        settings: {
            rumble: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Rumble",
                desc: "Shakes the circle like an earthquake from heavy bass."
            }
        }
    },
    dancer: {
        name: "Dancing Orb",
        image: "visualizers/dancer.png",
        bestColor: "rainbowActive",
        start: function(){

        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);

            var bassAvg = this.weightedAverage(visData.slice(0, 16), 0.6) / 16;
            var trebleAvg = this.weightedAverage(visData.slice(16, 64), 0.75) / 48;
            if(isNaN(bassAvg)){
                bassAvg = 0.5;
            }
            if(isNaN(trebleAvg)){
                trebleAvg = 0.5;
            }

            if(this.settings.pitchType.value === "new"){
                var extraBoost = Math.max(...visData.slice(64, 128)) / 255;
                var extraFreq = (this.weightedAverage(visData.slice(64, 128), 0.75) / 64) || 0;
                var origAvg = trebleAvg;
                trebleAvg += (extraBoost * (extraFreq / 2 + 0.5)) * (1 - trebleAvg);
            }

            var bassAmounts = visData.slice(0, 12);
            bassAmounts.sort((a, b) => a - b);
            var bassAmount = 0;
            for(var i = 0; i < 10; i++){
                bassAmount += bassAmounts[11 - i];
            }
            bassAmount /= 10;

            var trebleAmount = Math.max(...(visData.slice(12, 64)));
            
            var scale = Math.min(size[0], size[1]) / 512;
            var circleSize = 16 * scale;
            var space = [size[0] * 0.8, size[1] * 0.8];
            var bounds = [size[0] * 0.1, size[1] * 0.1];

            var capMultiplier = {
                quarter: 0.25,
                half: 0.5,
                normal: 1,
                double: 2,
                triple: 3,
                max: 0
            }[this.settings.jitter.value];

            if(this.settings.wanderFreq.value === "treble"){
                if(this.settings.riseFreq.value === "bass"){
                    coord = [trebleAvg || 0.5, 1 - (bassAmount || 0) / 255];
                }else{ // treble
                    coord = [trebleAvg || 0.5, 1 - (trebleAmount || 0) / 255];
                }
            }else{ // bass
                if(this.settings.riseFreq.value === "bass"){
                    coord = [bassAvg || 0.5, 1 - (bassAmount || 0) / 255];
                }else{ // treble
                    coord = [bassAvg || 0.5, 1 - (trebleAmount || 0) / 255];
                }
            }
            if(debugForce){
                var target = [coord[0], coord[1]];
            }
            if(capMultiplier > 0){
                var moveCap1 = 0.03 * capMultiplier * fpsCompensation;
                var moveCap2 = 0.1 * capMultiplier * fpsCompensation;
                if(coord[0] > this.pos[0] + moveCap1){
                    coord[0] = this.pos[0] + moveCap1;
                }else if(coord[0] < this.pos[0] - moveCap1){
                    coord[0] = this.pos[0] - moveCap1;
                }
                if(coord[1] > this.pos[1] + moveCap2){
                    coord[1] = this.pos[1] + moveCap2;
                }else if(coord[1] < this.pos[1] - moveCap2){
                    coord[1] = this.pos[1] - moveCap2;
                }
            }
            this.pos = [coord[0], coord[1]];

            canvas.fillStyle = getColor(trebleAmount, bassAvg * 255);
            if(this.settings.growFreq.value === "treble"){
                circleSize *= trebleAmount / 255 * 2 + 1;
            }else{ // bass
                circleSize *= bassAmount / 255 * 2 + 1;
            }

            this.degArc2(
                coord[0] * space[0] + bounds[0],
                coord[1] * space[1] + bounds[1],
                circleSize,
                0, 360
            );
            if(smokeEnabled){
                smoke.fillStyle = getColor(trebleAmount, bassAvg * 255);
                this.degArc2smoke(
                    coord[0] * space[0] + bounds[0],
                    coord[1] * space[1] + bounds[1],
                    circleSize,// + 6 * scale,
                    0, 360
                );
            }

            if(debugForce){
                for(var i = 0; i < 16; i++){
                    canvas.fillStyle = getColor(visData[i], i / 16 * 255);
                    canvas.fillRect(
                        10 + (255 / 16) * i,
                        40 - (visData[i] / 25.5),
                        255 / 16,
                        visData[i] / 25.5
                    );
                }
                for(var i = 0; i < 48; i++){
                    canvas.fillStyle = getColor(visData[i + 16], i / 48 * 255);
                    canvas.fillRect(
                        10 + (255 / 48) * i,
                        90 - (visData[i + 16] / 25.5),
                        255 / 48,
                        visData[i + 16] / 25.5
                    );
                }
                canvas.fillStyle = "#FFF";
                canvas.fillRect(
                    target[0] * space[0] + bounds[0] - 5,
                    target[1] * space[1] + bounds[1] - 5,
                    10, 10
                );
                canvas.fillRect(10, 10, bassAmount, 10);
                canvas.fillRect(bassAvg * 255 + 9 + 255 / 12 / 2, 30, 2, 10);
                canvas.fillRect(10, 60, trebleAmount, 10);
                canvas.fillRect(trebleAvg * 255 + 9 + 255 / 48 / 2, 80, 2, 10);
                if(this.settings.pitchType.value === "new"){
                    canvas.fillRect(origAvg * 255 + 9 + 255 / 48 / 2, 80, 2 + (trebleAvg - origAvg) * 255, 1);
                }
            }
        },
        pos: [0.5, 1],
        stop: function(){

        },
        settings: {
            jitter: {
                type: "choice",
                value: "normal",
                default: "normal",
                choices: {quarter: "Quarter", half: "Half", normal: "Normal", double: "Double", triple: "Triple", max: "Teleport"},
                title: "Jitter",
                desc: "How jittery is the dancer's movement?<br><br>High values make him go very fast. Low values calm him down."
            },
            pitchType: {
                type: "choice",
                value: "new",
                default: "new",
                choices: {new: "New", old: "Old"},
                title: "Pitch Detection",
                desc: "Which pitch detection algorithm to use?<br><br>\"New\" can detect higher notes than \"old\"."
            },
            growFreq: {
                type: "choice",
                value: "treble",
                default: "treble",
                choices: {bass: "Bass Volume", treble: "Treble Volume"},
                title: "Grow Type",
                desc: "What makes the dancer grow larger? Bass volume or Treble volume?"
            },
            riseFreq: {
                type: "choice",
                value: "bass",
                default: "bass",
                choices: {bass: "Bass Volume", treble: "Treble Volume"},
                title: "Rise Type",
                desc: "What makes the dancer rise into the air? Bass volume or Treble volume?"
            },
            wanderFreq: {
                type: "choice",
                value: "treble",
                default: "treble",
                choices: {bass: "Bass Frequency", treble: "Treble Frequency"},
                title: "Wander Type",
                desc: "What makes the dancer wander horizontally about the stage? Bass frequency or Treble frequency?"
            },
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
        findNewPoint: function(x, y, angle, distance) { // from codershop on Stack Overflow
            var result = {};
        
            result.x = /*Math.round*/(Math.cos(angle * Math.PI / 180) * distance + x);
            result.y = /*Math.round*/(Math.sin(angle * Math.PI / 180) * distance + y);
        
            return result;
        },
        weightedAverage: function(arr, minPcnt){
            var weight = 0;
            var total = 0;
            var minValue = Math.max(...arr) * minPcnt;
            for(var i in arr){
                weight += ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
                total += i * ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
            }
            return total / weight;
        },
    },
    orbsAround: {
        name: "Orbs Around",
        image: "visualizers/orbsAround.png",
        bestColor: "beta",
        start: function(){
            this.speed = 1;
            this.angle = 90;
            this.rotation = 0;
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
        },
        frame: function(){
            var bassAmount = 0;
            var bassAmounts = [];
            var trebleAmount = 0;
            var totalAmount = 0;
            var avgPitch = [];
            var extraPitch = 0;
            var extraVolume = 0;
            var originalPitch = 0;
            for(var i = 0; i < 64; i++){
                totalAmount += visData[i];
                if(i < 12){
                    bassAmount += visData[i];
                    bassAmounts.push(visData[i]);
                }else{
                    trebleAmount += visData[i];
                    if(this.settings.pitchType.value === "legacy"){
                        avgPitch.push([i - 12, visData[i]]);
                    }
                }
            }
            bassAmount /= 12;
            trebleAmount /= 52;
            totalAmount /= 64;

            bassAmounts.sort((a, b) => a - b);
            bassAmounts = bassAmounts.slice(-6);
            var bassMax = 0;
            for(var i in bassAmounts){
                bassMax += bassAmounts[i];
            }
            bassMax /= bassAmounts.length;

            if(this.settings.pitchType.value === "legacy"){
                avgPitch.sort((a, b) => a[1] - b[1]);
                avgPitch = avgPitch.slice(-4);
                if(avgPitch[3][1] === 0){
                    avgPitch = [[0, 0], [0, 0], [0, 0], [0, 0]];
                }else{
                    for(var i = 0; i < 3; i++){
                        if(avgPitch[i][1] === 0){
                            avgPitch[i][0] = avgPitch[3][0];
                        }
                    }
                }
                avgPitch = avgPitch[0][0] + avgPitch[1][0] + avgPitch[2][0] + avgPitch[3][0];
                avgPitch /= 4;
            }else{
                avgPitch = this.weightedAverage(visData.slice(12, 64), 0.7);
                if(this.settings.pitchType.value === "new"){
                    originalPitch = (avgPitch || 0) / 52;
                    extraPitch = this.weightedAverage(visData.slice(64, 128), 0.7);
                    extraVolume = Math.max(...visData.slice(64, 128));
                    avgPitch *= 1 + ((extraVolume / 255 * (extraPitch / 64 + 0.5)) || 0);
                }
            }
            avgPitch /= 52;
            if(isNaN(avgPitch)){
                avgPitch = 0;
            }

            this.speed = (1 + totalAmount / 8) * fpsCompensation;
            this.angle -= (trebleAmount / 256) * fpsCompensation;
            if(this.settings.pitchAffectsRotation.value){
                this.rotation += (trebleAmount / 20 * (1 + avgPitch)) * fpsCompensation;
                if(this.settings.pitchType.value === "new"){
                    this.rotation += (extraVolume / 80 * (avgPitch)) * fpsCompensation;
                }
            }else{
                this.rotation += (trebleAmount / 20 * (1.25)) * fpsCompensation;
            }
            if(this.angle < 0){
                this.angle += 360;
            }
            if(this.rotation > 360){
                this.rotation -= 360;
            }

            var resizeScale = (256 - this.speed) / 256;
            var corner = [
                size[0] - size[0] * (512 - this.speed) / 512,
                size[1] - size[1] * (512 - this.speed) / 512
            ];
            corner = this.findNewPoint(corner[0], corner[1], this.angle, this.speed);

            if(this.settings.doubleViewDistance.value){
                canvas.globalAlpha = 0.95 + (1 - fpsCompensation) * 0.05;
            }else{
                canvas.globalAlpha = 0.9 + (1 - fpsCompensation) * 0.1;
            }
            canvas.globalCompositeOperation = 'copy';
            canvas.drawImage(
                canvasElement,
                corner.x,
                corner.y,
                size[0] * resizeScale,
                size[1] * resizeScale
            );
            canvas.globalCompositeOperation = 'source-over';
            canvas.globalAlpha = 1;
            //canvas.fillStyle = "rgba(0, 0, 0, 0.1)";
            //canvas.fillRect(0, 0, size[0], size[1]);

            if(smokeEnabled){
                if(this.settings.doubleViewDistance.value){
                    smoke.globalAlpha = 0.95 + (1 - fpsCompensation) * 0.05;
                }else{
                    smoke.globalAlpha = 0.9 + (1 - fpsCompensation) * 0.1;
                }
                smoke.globalCompositeOperation = 'copy';
                smoke.drawImage(
                    smokeElement,
                    corner.x,
                    corner.y,
                    size[0] * resizeScale,
                    size[1] * resizeScale
                );
                smoke.globalCompositeOperation = 'source-over';
                smoke.globalAlpha = 1;
                //smoke.fillStyle = "rgba(0, 0, 0, 0.1)";
                //smoke.fillRect(0, 0, size[0], size[1]);
            }

            if(this.settings.cameraVelocity.value){
                var centerPoint = this.findNewPoint(size[0] / 2, size[1] / 2, this.angle, this.speed * -10 * (1 / fpsCompensation));
            }else{
                var centerPoint = {x: size[0] / 2, y: size[1] / 2};
            }
            var orb1 = this.findNewPoint(centerPoint.x, centerPoint.y, this.rotation, 64 + bassAmount / 32);
            var orb2 = this.findNewPoint(centerPoint.x, centerPoint.y, (this.rotation + 180) % 360, 64 + bassAmount / 32);

            canvas.fillStyle = '#FFF';
            if(this.settings.starsToggle.value){
                if(this.settings.pitchAffectsStars.value){
                    if(Math.random() * 255 < trebleAmount * (1 + avgPitch * 2) * fpsCompensation){
                        canvas.fillRect(Math.random() * size[0] - 1, Math.random() * size[1] - 1, 3, 3);
                    }
                }else{
                    if(Math.random() * 255 < trebleAmount * 2 * fpsCompensation){
                        canvas.fillRect(Math.random() * size[0] - 1, Math.random() * size[1] - 1, 3, 3);
                    }
                }
            }

            if(debugForce){
                canvas.fillRect(centerPoint.x - 1, centerPoint.y - 1, 2, 2);
                canvas.fillStyle = "#111";
                canvas.fillRect(5, 5, 265, 100);
                canvas.fillStyle = "#FFF";
                canvas.fillRect(10, 10, totalAmount, 10);
                canvas.fillRect(10, 40, trebleAmount, 10);
                canvas.fillRect(10, 70, bassAmount, 10);
                canvas.fillRect(10, 90, bassMax, 10);
                if(this.settings.pitchType.value === "new"){
                    canvas.fillStyle = "#F00";
                    canvas.fillRect(originalPitch * 255 + 10, 44, avgPitch * 255 - originalPitch * 255, 3);
                }
                canvas.fillStyle = "#F00";
                canvas.fillRect(avgPitch * 255 + 10, 40, 1, 10);
            }

            canvas.fillStyle = getColor(bassMax, Math.abs(this.angle / 360 - 0.5) * 255 * 2);

            this.degArc2(orb1.x, orb1.y, 32 + bassAmount / 8, 0, 360);
            this.degArc2(orb2.x, orb2.y, 32 + bassAmount / 8, 0, 360);
            if(smokeEnabled){
                smoke.fillStyle = getColor(bassMax, Math.abs(this.angle / 360 - 0.5) * 255 * 2);
                this.degArc2smoke(orb1.x, orb1.y, 34 + bassAmount / 8, 0, 360);
                this.degArc2smoke(orb2.x, orb2.y, 34 + bassAmount / 8, 0, 360);
            }
        },
        stop: function(){

        },
        speed: 1, // how fast do the circles move? This makes the background shrink faster, and offsets the center point further.
        angle: 90, // what angle are the circles moving? This changes the direction the background fades to, and sets offset angle of center point.
        rotation: 0, // where are the orbs relative to each other? This changes the orbs' position around the center point.
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
        findNewPoint: function(x, y, angle, distance) { // from codershop on Stack Overflow
            var result = {};
        
            result.x = /*Math.round*/(Math.cos(angle * Math.PI / 180) * distance + x);
            result.y = /*Math.round*/(Math.sin(angle * Math.PI / 180) * distance + y);
        
            return result;
        },
        weightedAverage: function(arr, minPcnt){
            var weight = 0;
            var total = 0;
            var minValue = Math.max(...arr) * minPcnt;
            for(var i in arr){
                weight += ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
                total += i * ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
            }
            return total / weight;
        },
        settings: {
            cameraVelocity: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Camera Velocity",
                desc: "The camera falls slightly behind when the orbs are moving very fast."
            },
            pitchType: {
                type: "choice",
                value: "new",
                default: "new",
                choices: {
                    new: "New",
                    old: "Old",
                    legacy: "Legacy"
                },
                title: "Pitch Detection",
                desc: 'Select the pitch detection algorithm.<br><br>"New" can detect higher frequencies than "Old".<br>"Old" may help if the orbs are spinning too fast.<br>"Legacy" is inconsistent and inaccurate.'
            },
            pitchAffectsRotation: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Pitch Affects Rotation",
                desc: "Pitch affects how quickly the orbs rotate around each other."
            },
            starsToggle: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Stars",
                desc: "Stars fly past the orbs in space."
            },
            pitchAffectsStars: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Pitch Affects Stars",
                desc: "Frequency of stars is affected by pitch."
            },
            doubleViewDistance: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Double View Distance",
                desc: "View distance of object trails is double the normal value."
            }
        }
    },
    orbsArise: {
        name: "Orbs Arise",
        image: "visualizers/orbsArise.png",
        bestColor: "beta",
        start: function(){
            this.speed = 1;
            this.angle = 90;
            this.rotation = 0;
            canvas.clearRect(0, 0, size[0], size[1]);
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }
        },
        frame: function(){
            var bassAmount = 0;
            var bassAmounts = [];
            var trebleAmount = 0;
            var totalAmount = 0;
            var avgPitch = [];
            var extraPitch = 0;
            var extraVolume = 0;
            var originalPitch = 0;
            for(var i = 0; i < 64; i++){
                totalAmount += visData[i];
                if(i < 12){
                    bassAmount += visData[i];
                    bassAmounts.push(visData[i]);
                }else{
                    trebleAmount += visData[i];
                    if(this.settings.pitchType.value === "legacy"){
                        avgPitch.push([i - 12, visData[i]]);
                    }
                }
            }
            bassAmount /= 12;
            trebleAmount /= 52;
            totalAmount /= 64;

            bassAmounts.sort((a, b) => a - b);
            bassAmounts = bassAmounts.slice(-6);
            var bassMax = 0;
            for(var i in bassAmounts){
                bassMax += bassAmounts[i];
            }
            bassMax /= bassAmounts.length;

            if(this.settings.pitchType.value === "legacy"){
                avgPitch.sort((a, b) => a[1] - b[1]);
                avgPitch = avgPitch.slice(-4);
                if(avgPitch[3][1] === 0){
                    avgPitch = [[0, 0], [0, 0], [0, 0], [0, 0]];
                }else{
                    for(var i = 0; i < 3; i++){
                        if(avgPitch[i][1] === 0){
                            avgPitch[i][0] = avgPitch[3][0];
                        }
                    }
                }
                avgPitch = avgPitch[0][0] + avgPitch[1][0] + avgPitch[2][0] + avgPitch[3][0];
                avgPitch /= 4;
            }else{
                avgPitch = this.weightedAverage(visData.slice(12, 64), 0.7);
                if(this.settings.pitchType.value === "new"){
                    originalPitch = (avgPitch || 0) / 52;
                    extraPitch = this.weightedAverage(visData.slice(64, 128), 0.7);
                    extraVolume = Math.max(...visData.slice(64, 128));
                    avgPitch *= 1 + ((extraVolume / 255 * (extraPitch / 255 + 0.75)) || 0);
                }
            }
            avgPitch /= 52;
            if(isNaN(avgPitch)){
                avgPitch = 0;
            }

            this.speed = (1 + totalAmount / 8) * fpsCompensation;
            //this.angle -= trebleAmount / 128;
            this.angle = 90;
            if(this.settings.pitchAffectsRotation.value){
                this.rotation += trebleAmount / 20 * (1 + avgPitch) * fpsCompensation;
                if(this.settings.pitchType.value === "new"){
                    this.rotation += (extraVolume / 80 * (avgPitch)) * fpsCompensation;
                }
            }else{
                this.rotation += trebleAmount / 20 * (1.25) * fpsCompensation;
            }
            //if(this.angle < 0){
            //    this.angle += 360;
            //}
            if(this.rotation > 360){
                this.rotation -= 360;
            }

            var resizeScale = (256 - this.speed) / 256;
            var corner = [
                size[0] - size[0] * (512 - this.speed) / 512,
                size[1] - size[1] * (512 - this.speed) / 512
            ];
            corner = this.findNewPoint(corner[0], corner[1], this.angle, this.speed);

            if(this.settings.doubleViewDistance.value){
                canvas.globalAlpha = 0.95 + (1 - fpsCompensation) * 0.05;
            }else{
                canvas.globalAlpha = 0.9 + (1 - fpsCompensation) * 0.1;
            }
            canvas.globalCompositeOperation = 'copy';
            canvas.drawImage(
                canvasElement,
                corner.x,
                corner.y,
                size[0] * resizeScale,
                size[1] * resizeScale
            );
            canvas.globalCompositeOperation = 'source-over';
            canvas.globalAlpha = 1;
            //canvas.fillStyle = "rgba(0, 0, 0, 0.1)";
            //canvas.fillRect(0, 0, size[0], size[1]);

            if(smokeEnabled){
                if(this.settings.doubleViewDistance.value){
                    smoke.globalAlpha = 0.95 + (1 - fpsCompensation) * 0.05;
                }else{
                    smoke.globalAlpha = 0.9 + (1 - fpsCompensation) * 0.1;
                }
                smoke.globalCompositeOperation = 'copy';
                smoke.drawImage(
                    smokeElement,
                    corner.x,
                    corner.y,
                    size[0] * resizeScale,
                    size[1] * resizeScale
                );
                smoke.globalCompositeOperation = 'source-over';
                smoke.globalAlpha = 1;
                //smoke.fillStyle = "rgba(0, 0, 0, 0.1)";
                //smoke.fillRect(0, 0, size[0], size[1]);
            }

            if(this.settings.cameraVelocity.value){
                var centerPoint = this.findNewPoint(size[0] / 2, size[1] / 2, this.angle, this.speed * -10 * (1 / fpsCompensation));
            }else{
                var centerPoint = {x: size[0] / 2, y: size[1] / 2};
            }
            var orb1 = this.findNewPoint(centerPoint.x, centerPoint.y, this.rotation, 64 + bassAmount / 32);
            var orb2 = this.findNewPoint(centerPoint.x, centerPoint.y, (this.rotation + 180) % 360, 64 + bassAmount / 32);
            
            canvas.fillStyle = '#FFF';
            if(this.settings.starsToggle.value){
                if(Math.random() * 255 < trebleAmount * (1 + avgPitch * 2) * fpsCompensation){
                    canvas.fillRect(Math.random() * size[0] - 1, Math.random() * size[1] - 1, 3, 3);
                }
            }

            
            if(debugForce){
                canvas.fillRect(centerPoint.x - 1, centerPoint.y - 1, 2, 2);
                canvas.fillStyle = "#111";
                canvas.fillRect(5, 5, 265, 100);
                canvas.fillStyle = "#FFF";
                canvas.fillRect(10, 10, totalAmount, 10);
                canvas.fillRect(10, 40, trebleAmount, 10);
                canvas.fillRect(10, 70, bassAmount, 10);
                canvas.fillRect(10, 90, bassMax, 10);
                if(this.settings.pitchType.value === "new"){
                    canvas.fillStyle = "#F00";
                    canvas.fillRect(originalPitch * 255 + 10, 44, avgPitch * 255 - originalPitch * 255, 3);
                }
                canvas.fillStyle = "#F00";
                canvas.fillRect(avgPitch * 255 + 10, 40, 1, 10);
            }

            canvas.fillStyle = getColor(bassMax, Math.abs(this.angle / 360 - 0.5) * 255 * 2);

            this.degArc2(orb1.x, orb1.y, 32 + bassAmount / 8, 0, 360);
            this.degArc2(orb2.x, orb2.y, 32 + bassAmount / 8, 0, 360);
            if(smokeEnabled){
                smoke.fillStyle = getColor(bassMax, Math.abs(this.angle / 360 - 0.5) * 255 * 2);
                this.degArc2smoke(orb1.x, orb1.y, 34 + bassAmount / 8, 0, 360);
                this.degArc2smoke(orb2.x, orb2.y, 34 + bassAmount / 8, 0, 360);
            }
        },
        stop: function(){

        },
        speed: 1, // how fast do the circles move? This makes the background shrink faster, and offsets the center point further.
        angle: 90, // what angle are the circles moving? This changes the direction the background fades to, and sets offset angle of center point.
        rotation: 0, // where are the orbs relative to each other? This changes the orbs' position around the center point.
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
        findNewPoint: function(x, y, angle, distance) { // from codershop on Stack Overflow
            var result = {};
        
            result.x = /*Math.round*/(Math.cos(angle * Math.PI / 180) * distance + x);
            result.y = /*Math.round*/(Math.sin(angle * Math.PI / 180) * distance + y);
        
            return result;
        },
        weightedAverage: function(arr, minPcnt){
            var weight = 0;
            var total = 0;
            var minValue = Math.max(...arr) * minPcnt;
            for(var i in arr){
                weight += ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
                total += i * ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
            }
            return total / weight;
        },
        settings: {
            cameraVelocity: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Camera Velocity",
                desc: "The camera falls slightly behind when the orbs are moving very fast."
            },
            pitchType: {
                type: "choice",
                value: "new",
                default: "new",
                choices: {
                    new: "New",
                    old: "Old",
                    legacy: "Legacy"
                },
                title: "Pitch Detection",
                desc: 'Select the pitch detection algorithm.<br><br>"New" can detect higher frequencies than "Old".<br>"Old" may help if the orbs are spinning too fast.<br>"Legacy" is inconsistent and inaccurate.'
            },
            pitchAffectsRotation: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Pitch Affects Rotation",
                desc: "Pitch affects how quickly the orbs rotate around each other."
            },
            starsToggle: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Stars",
                desc: "Stars fly past the orbs in space."
            },
            pitchAffectsStars: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Pitch Affects Stars",
                desc: "Frequency of stars is affected by pitch."
            },
            doubleViewDistance: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Double View Distance",
                desc: "View distance of object trails is double the normal value."
            },
        }
    },
    eclipse: {
        name: "Eclipse",
        image: "visualizers/eclipse.png",
        bestColor: "beta",
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
            for(var i = 31; i > -1; i--){
                var strength = visData[i];
                smoke.strokeStyle = getColor(strength);
                var linePosition = (i * 0.5) * this.ratio_360_64;
                this.degArcSmoke(center[0], center[1], strokePosition, linePosition + 90, linePosition + 91);
                smoke.stroke();
                linePosition *= -1;
                this.degArcSmoke(center[0], center[1], strokePosition, linePosition + 90, linePosition + 91);
                smoke.stroke();
            }
            for(var i = 32; i < 64; i++){
                var strength = visData[i];
                smoke.strokeStyle = getColor(strength);
                var linePosition = (i * 0.5) * this.ratio_360_64;
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
        ratio_360_1024: 360 / 1024,
        ratio_360_64: 360 / 64
    },
    'SEPARATOR_AUDIOVISION" disabled="': {
        name: 'AudioVision',
        start: function(){

        },
        frame: function(){

        },
        stop: function(){

        }
    },
    curvedAudioVision: {
        name: "Curved Lines",
        image: "visualizers/curvedLines_av.png",
        bestColor: "rainbowActive",
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
            var colorstep = 255 / this.lineCount;
            var ringPools = [0, 0, 0, 0, 0, 0, 0, 0, 0];
            for(var i = 0; i < 64; i++){
                var currPool = Math.floor(i / (64 / 9));
                ringPools[currPool] = Math.max(visData[i], ringPools[currPool]);
            }
            for(var i = 0; i < this.lineCount; i++){
                var strength = ringPools[i] * 0.85;
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
        bestColor: "rainbowActive",
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
            var colorstep = 255 / this.lineCount;
            var center = size[1] / 2;
            var ringPools = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            for(var i = 0; i < 64; i++){
                var currPool = Math.floor(i / (64 / 18));
                ringPools[currPool] = Math.max(visData[i], ringPools[currPool]);
            }
            for(var i = 0; i < this.lineCount; i++){
                var pos = Math.floor((i + 1) * xdist);
                var strength = ringPools[i];
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
        bestColor: "rainbowActive",
        start: function(){

        },
        frame: function(){
            canvas.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
            smoke.lineWidth = this.lineWidth - (performanceMode * 0.5 * this.lineWidth);
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var xdist = size[0] / (this.lineCount + 2);
            var colorstep = 255 / this.lineCount;
            var caveCieling = Math.round(size[1] / 18);
            var center = size[1] / 2;
            var ringPools = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            for(var i = 0; i < 64; i++){
                var currPool = Math.floor(i / (64 / 18));
                ringPools[currPool] = Math.max(visData[i], ringPools[currPool]);
            }
            for(var i = 0; i < this.lineCount; i++){
                var pos = Math.floor((i + 1) * xdist);
                var strength = ringPools[i];
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
    circleLines: {
        name: "Circle Lines",
        image: "visualizers/circleLines.png",
        bestColor: "rainbowActive",
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
            var ringMaxRadius = ringHeight * 0.15;
            var ringMinRadius = ringHeight * 0.15;
            var ringMaxExpand = ringHeight * 0.0225;
            var drumStrength = 0;
            var ringPools = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            for(var i = 0; i < 64; i++){
                var currPool = Math.floor(i / (64 / 36));
                ringPools[currPool] = Math.max(visData[i], ringPools[currPool]);
            }
            for(var i = 0; i < 12; i++){
                drumStrength += Math.pow(visData[i], 2) / 255;
            }
            drumStrength /= 12;

            var randomOffset = [0, 0];

            var lineDist = 360 / this.lineCount;
            var colorDist = 255 / this.lineCount;
            for(var i = 0; i < this.lineCount; i++){
                var strength = ringPools[i];
                
                var firstPoint = this.findNewPoint(
                    size[0] / 2,
                    size[1] / 2,
                    i * lineDist + 90,
                    ringMinRadius + drumStrength / 255 * ringMaxRadius - 5
                );
                var secondPoint = this.findNewPoint(
                    size[0] / 2,
                    size[1] / 2,
                    i * lineDist + 90,
                    ringMinRadius + strength / 255 * ringMinRadius * 3 + drumStrength / 255 * ringMaxRadius + drumStrength / 255 * ringMaxExpand,
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
                ringMinRadius * 0.7 + drumStrength / 255 * ringMaxRadius - 5,
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
        bestColor: "beta",
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
                strength = visData[i];
                
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
        bestColor: "beta",
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
                strength = visData[i];
                
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
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[1] / 64;
            var last = -1;
            for(var i = 0; i < 65; i++){
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
                smoke.fillStyle = getColor(colorAmount, x * (255 / size[1]));
                smoke.fillRect(0, size[1] - x, colorAmount / 8 + 1, 1);
                smoke.fillRect(size[0] - (colorAmount / 8 + 1), size[1] - x, colorAmount / 8 + 1, 1);
            }
            canvas.fillStyle = getColor(colorAmount, x * (255 / size[1]));
            canvas.fillRect(0, size[1] - x, colorAmount / 8 + 1, 1);
            canvas.fillRect(size[0] - (colorAmount / 8 + 1), size[1] - x, colorAmount / 8 + 1, 1);
        }
    },
    bottomSpectrum: {
        name: "Bottom Spectrum",
        image: "visualizers/bottomSpectrum.png",
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 64;
            var last = -1;
            for(var i = 0; i < 65; i++){
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
                smoke.fillStyle = getColor(colorAmount, x * (255 / size[0]));
                smoke.fillRect(x, size[1] - (colorAmount / 8 + 1), 1, colorAmount / 8 + 1);
            }
            canvas.fillStyle = getColor(colorAmount, x * (255 / size[0]));
            canvas.fillRect(x, size[1] - (colorAmount / 8 + 1), 1, colorAmount / 8 + 1);
        }
    },
    bottomBassSpectrum: {
        name: "Bottom Bass Spectrum",
        image: "visualizers/bottomBassSpectrum.png",
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 12;
            var last = -1;
            for(var i = 0; i < 13; i++){
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
                smoke.fillStyle = getColor(colorAmount, x * (255 / size[0]));
                smoke.fillRect(x, size[1] - (colorAmount / 16 + 1), 1, colorAmount / 16 + 1);
            }
            canvas.fillStyle = getColor(colorAmount, x * (255 / size[0]));
            canvas.fillRect(x, size[1] - (colorAmount / 16 + 1), 1, colorAmount / 16 + 1);
        }
    },
    fullEdge: {
        name: "Full Edge",
        image: "visualizers/fullEdge.png",
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 64; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            //avg /= 180;
            avg /= 64;
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
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 12; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            avg /= 12;
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
        name: 'Entire Screen',
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
        bestColor: "bluegreenred",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 64;
            var last = -1;
            for(var i = 0; i < 65; i++){
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
                smoke.fillStyle = getColor(colorAmount, x * (255 / size[0]));
                smoke.fillRect(x, 0, 1, size[1]);
            }else{
                canvas.fillStyle = getColor(colorAmount, x * (255 / size[0]));
                canvas.fillRect(x, 0, 1, size[1]);
            }
        }
    },
    spectrumCentered: {
        name: "Centered Spectrum",
        image: "visualizers/spectrumCentered.png",
        bestColor: "bluegreenred",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 2 / 64;
            var last = -1;
            for(var i = 0; i < 65; i++){
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
                smoke.fillStyle = getColor(colorAmount, x * (255 / (size[0] / 2)));
                smoke.fillRect(x + size[0] / 2, 0, 1, size[1]);
                if(x !== 0){
                    smoke.fillRect(size[0] / 2 - x, 0, 1, size[1]);
                }
            }else{
                canvas.fillStyle = getColor(colorAmount, x * (255 / (size[0] / 2)));
                canvas.fillRect(x + size[0] / 2, 0, 1, size[1]);
                if(x !== 0){
                    canvas.fillRect(size[0] / 2 - x, 0, 1, size[1]);
                }
            }
        }
    },
    spectrumBass: {
        name: "Bass Spectrum",
        image: "visualizers/spectrumBass.png",
        bestColor: "bluegreenred",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var step = size[0] / 12;
            var last = -1;
            for(var i = 0; i < 13; i++){
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
                smoke.fillStyle = getColor(colorAmount, x * (255 / size[0]));
                smoke.fillRect(x, 0, 1, size[1]);
            }else{
                canvas.fillStyle = getColor(colorAmount, x * (255 / size[0]));
                canvas.fillRect(x, 0, 1, size[1]);
            }
        }
    },
    tiles: {
        name: "Tiles",
        image: "visualizers/tiles.png",
        bestColor: "bluegreenred",
        start: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var freqs = [];
            for(var i = 0; i < 64; i++){
                freqs.push(i);
            }
            for (var i = 64; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = freqs[i];
                freqs[i] = freqs[j];
                freqs[j] = temp;
            }
            tiles = [];
            var index = 0;
            for(var i = 0; i < 8; i++){
                this.tiles.push([]);
                for(var j = 0; j < 8; j++){
                    this.tiles[this.tiles.length - 1].push(freqs[index]);
                    index++;
                }
            }
            this.boxSize = [Math.round(size[0] / 8), Math.round(size[1] / 8)];
        },
        sizechange: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var freqs = [];
            for(var i = 0; i < 65; i++){
                freqs.push(i);
            }
            for (var i = 64; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = freqs[i];
                freqs[i] = freqs[j];
                freqs[j] = temp;
            }
            tiles = [];
            var index = 0;
            for(var i = 0; i < 8; i++){
                this.tiles.push([]);
                for(var j = 0; j < 8; j++){
                    this.tiles[this.tiles.length - 1].push(freqs[index]);
                    index++;
                }
            }
            this.boxSize = [Math.round(size[0] / 8), Math.round(size[1] / 8)];
        },
        frame: function(){
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }else{
                canvas.clearRect(0, 0, size[0], size[1]);
            }
            for(var i = 0; i < 8; i++){
                for(var j = 0; j < 8; j++){
                    var strength = visData[this.tiles[i][j]];
                    var color = getColor(strength, (i + j) / 14 * 255);
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
    dynamicTiles: {
        name: "Dynamic Tiles",
        image: "visualizers/dynamicTiles.png",
        bestColor: "bluegreenred",
        start: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var freqs = [];
            for(var i = 0; i < 65; i++){
                freqs.push(i);
            }
            for (var i = 64; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = freqs[i];
                freqs[i] = freqs[j];
                freqs[j] = temp;
            }
            tiles = [];
            var index = 0;
            for(var i = 0; i < 8; i++){
                this.tiles.push([]);
                for(var j = 0; j < 8; j++){
                    this.tiles[this.tiles.length - 1].push(freqs[index]);
                    index++;
                }
            }
            this.boxSize = [Math.round(size[0] / 8), Math.round(size[1] / 8)];
        },
        sizechange: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var freqs = [];
            for(var i = 0; i < 64; i++){
                freqs.push(i);
            }
            for (var i = 64; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = freqs[i];
                freqs[i] = freqs[j];
                freqs[j] = temp;
            }
            tiles = [];
            var index = 0;
            for(var i = 0; i < 8; i++){
                this.tiles.push([]);
                for(var j = 0; j < 8; j++){
                    this.tiles[this.tiles.length - 1].push(freqs[index]);
                    index++;
                }
            }
            this.boxSize = [Math.round(size[0] / 8), Math.round(size[1] / 8)];
        },
        frame: function(){
            if(smokeEnabled){
                smoke.clearRect(0, 0, size[0], size[1]);
            }else{
                canvas.clearRect(0, 0, size[0], size[1]);
            }
            for(var i = 0; i < 8; i++){
                for(var j = 0; j < 8; j++){
                    var strength = visData[this.tiles[i][j]];
                    var color = getColor(strength, (i + j) / 14 * 255);
                    if(smokeEnabled){
                        smoke.fillStyle = color;
                        smoke.fillRect(
                            i * this.boxSize[0] + (this.boxSize[0] * 0.3 * ((255 - strength) / 255)),
                            j * this.boxSize[1] + (this.boxSize[1] * 0.3 * ((255 - strength) / 255)),
                            this.boxSize[0] - (this.boxSize[0] * 0.6 * ((255 - strength) / 255)),
                            this.boxSize[1] - (this.boxSize[1] * 0.6 * ((255 - strength) / 255))
                        );
                    }else{
                        canvas.fillStyle = color;
                        canvas.fillRect(
                            i * this.boxSize[0] + (this.boxSize[0] * 0.3 * ((255 - strength) / 255)),
                            j * this.boxSize[1] + (this.boxSize[1] * 0.3 * ((255 - strength) / 255)),
                            this.boxSize[0] - (this.boxSize[0] * 0.6 * ((255 - strength) / 255)),
                            this.boxSize[1] - (this.boxSize[1] * 0.6 * ((255 - strength) / 255))
                        );
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
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 64; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            avg /= 64;
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
        bestColor: "beta",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 12; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            avg /= 12;
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
        bestColor: "bluegreenred",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 64; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            avg /= 64;
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
        bestColor: "bluegreenred",
        start: function(){
            
        },
        frame: function(){
            var avg = 0;
            var avgtotal = 0;
            for(var i = 0; i < 12; i++){
                avg += Math.sqrt(visData[i]) * this.sqrt255;
            }
            avg /= 12;
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
        name: 'Spectrogram',
        start: function(){

        },
        frame: function(){

        },
        stop: function(){

        }
    },
    spectrogramClassic: {
        name: "Spectrogram",
        image: "visualizers/spectrogramClassic.png",
        bestColor: "bluegreenred",
        start: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
        },
        frame: function(){
            var left = size[0] / 2 - 64;
            canvas.putImageData(canvas.getImageData(left, 0, left + 128, size[1]), left, -1);
            var strength = 0;
            canvas.fillStyle = "#000";
            canvas.fillRect(0, size[1] - 1, size[0], 1);
            for(var i = 0; i < 64; i++){
                strength = visData[i];
                canvas.fillStyle = getColor(strength, i * 4);
                canvas.fillRect(left + i * 2, size[1] - 1, 2, 1);
            }
        },
        sizechange: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
        },
        stop: function(){
            
        }
    },
    spectrogramStretched: {
        name: "Spectrogram Stretched",
        image: "visualizers/spectrogramStretched.png",
        bestColor: "bluegreenred",
        start: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
        },
        frame: function(){
            var left = size[0] / 2 - 256;
            canvas.putImageData(canvas.getImageData(left, 0, left + 512, size[1]), left, -1);
            var strength = 0;
            canvas.fillStyle = "#000";
            canvas.fillRect(0, size[1] - 1, size[0], 1);
            for(var i = 0; i < 64; i++){
                strength = visData[i];
                canvas.fillStyle = getColor(strength, i * 4);
                canvas.fillRect(left + i * 8, size[1] - 1, 8, 1);
            }
        },
        sizechange: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
        },
        stop: function(){
            
        }
    },
    spectrogram: {
        name: "Full-Range Spectrogram",
        image: "visualizers/spectrogramStretch.png",
        bestColor: "bluegreenred",
        start: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
        },
        frame: function(){
            var left = size[0] / 2 - 512;
            canvas.putImageData(canvas.getImageData(left, 0, left + 1024, size[1]), left, -1);
            var strength = 0;
            canvas.fillStyle = "#000";
            canvas.fillRect(0, size[1] - 1, size[0], 1);
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
    'SEPARATOR_OTHER" disabled="': {
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
        bestColor: "beta",
        start: function(){
            this.canvasParent = canvasElement.parentNode;
            this.ships = {};
            this.lasers = {};
            this.spawnShips(this.blastSettings.player);
            canvas.lineCap = "round";
        },
        randomColor: function(){
            return 'rgb(' +
                (Math.floor(Math.random() * 200) + 55) + ', ' +
                (Math.floor(Math.random() * 200) + 55) + ', ' +
                (Math.floor(Math.random() * 200) + 55) + ')';
        },
        spawnShips: function(spawnPlayer){
            this.totalShips = 0;
            this.ships = {};
            this.lasers = {};
            if(spawnPlayer){
                this.createShip(null, null, "Player");
            }
            for(var i = 0; i < this.settings.shipCount.value; i++){
                this.createShip();
            }
        },
        createShip: function(shipColor, shipSize, shipName, shipHealth){
            if(!shipColor){
                shipColor = this.randomColor(); 
            }
            if(!shipSize){
                shipSize = this.blastSettings.shipSize;
            }
            if(!shipName){
                shipName = "Ship " + (this.totalShips + 1);
            }
            if(!shipHealth){
                shipHealth = this.blastSettings.shipHealth;
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
                laserColor = getColor(255, 255);//this.blastSettings.laserColor;
            }
            if(!laserSize){
                laserSize = this.blastSettings.laserSize;
            }
            if(!laserPos || typeof laserPos !== "object"){
                laserPos = [0, 0];
            }
            if(!laserAngle){
                laserAngle = 0;
            }
            if(!laserVel){
                laserVel = this.blastSettings.laserSpeed;
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
            for(var i = 0; i < 12; i++){

                //this.visBassAvg += visData[i];
                this.visBassAvg += visData[i];
                
                //this.visLast[i] = visData[i];
            }
            this.visBassAvg /= 12;

            this.visBassAvgElements.push(this.visBassAvg);
            this.visBassAvgTotal += this.visBassAvg;
            while(this.visBassAvgElements.length > Math.round(this.blastSettings.soundMemory / 60 * currFPS)){
                this.visBassAvgTotal -= this.visBassAvgElements.shift();
            }

            this.visBassAvgVolume = this.visBassAvgTotal / this.visBassAvgElements.length;

            if(!this.visPastAvgs){
                this.visPastAvgs = [];
            }

            //if(this.visBassAvg < 255 * this.blastSettings.soundSensitivity){
            if(
                this.visBassAvgVolume + this.blastSettings.soundMemoryAdd > this.visBassAvg ||
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
                //canvas.fillRect(10, size[1] - 10 - (255 * this.blastSettings.soundSensitivity), 10, 1);
                canvas.fillRect(10, size[1] - 10 - (this.visBassAvgVolume + this.blastSettings.soundMemoryAdd), 20, 1);
                canvas.fillRect(30, size[1] - 10 - (this.visBassAvgVolume + this.blastSettings.soundMemoryAdd), 5, this.blastSettings.soundMemoryAdd);

                canvas.strokeStyle = "#FFF";
                canvas.lineWidth = 1;
                canvas.strokeRect(10.5, size[1] - 285.5, 10, 10);
                canvas.strokeRect(10.5, size[1] - 265.5, 10, 255);
                canvas.strokeRect(30.5, size[1] - 265.5 - this.blastSettings.soundMemoryAdd, 10, 255 + this.blastSettings.soundMemoryAdd);

                var adjustedSoundMemory = Math.round(this.blastSettings.soundMemory / 60 * currFPS);

                this.visPastAvgs.push(this.visBassAvgVolume + this.blastSettings.soundMemoryAdd);
                while(this.visPastAvgs.length > adjustedSoundMemory){
                    this.visPastAvgs.shift();
                }

                for(var i = 0; i < this.visBassAvgElements.length; i++){
                    canvas.fillStyle = "#0F0";
                    if(this.visBassAvgElements[i] < this.visBassAvgElements[i - 2]){
                        canvas.fillStyle = "#070";
                    }
                    if(this.visBassAvgElements[i] > this.visPastAvgs[i]){
                        canvas.fillRect(50 + (adjustedSoundMemory - i), size[1] - 285 - this.blastSettings.soundMemoryAdd, 1, 10);
                    }
                    canvas.fillRect(50 + (adjustedSoundMemory - i), size[1] - 10 - this.visBassAvgElements[i], 1, this.visBassAvgElements[i]);
                    canvas.fillStyle = "#F00";
                    canvas.fillRect(50 + (adjustedSoundMemory - i), size[1] - 10 - this.visPastAvgs[i], 1, 1);
                }
                
                canvas.strokeRect(50.5, size[1] - 265.5 - this.blastSettings.soundMemoryAdd, adjustedSoundMemory + 1, 255 + this.blastSettings.soundMemoryAdd);
                canvas.strokeRect(50.5, size[1] - 285.5 - this.blastSettings.soundMemoryAdd, adjustedSoundMemory + 1, 10);
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
                
                if(smokeEnabled){
                    smoke.fillStyle = this.lasers[i].color;
                    smoke.beginPath();
                    smoke.arc(this.lasers[i].pos[0], this.lasers[i].pos[1], this.blastSettings.laserLength * 1.5, 0, this.deg2rad(360));
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
                            this.ships[ship].pos[0] -= this.blastSettings.shipChase * fpsCompensation;
                        }
                        if(this.inputs.right){
                            this.ships[ship].pos[0] += this.blastSettings.shipChase * fpsCompensation;
                        }
                        if(this.inputs.up){
                            this.ships[ship].pos[1] -= this.blastSettings.shipChase * fpsCompensation;
                        }
                        if(this.inputs.down){
                            this.ships[ship].pos[1] += this.blastSettings.shipChase * fpsCompensation;
                        }
                        // do player firing fourth
                        if(this.inputs.mouse){
                            var ms = Date.now();
                            if(this.ships[ship].shotsFired >= this.blastSettings.gunAmmo){
                                if(ms - this.ships[ship].lastReload > this.blastSettings.gunReload){
                                    this.ships[ship].shotsFired = 0;
                                    shouldShoot = 1;
                                }
                            }else{
                                shouldShoot = 1;
                            }
                            if(ms - this.ships[ship].lastFire > this.blastSettings.gunDelay){
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
                                    if(this.ships[ship].shotsFired >= this.blastSettings.gunAmmo){
                                        this.ships[ship].lastReload = ms;
                                    }
                                }
                            }
                        }else if(this.ships[ship].shotsFired >= this.blastSettings.gunAmmo && Date.now() - this.ships[ship].lastReload > this.blastSettings.gunReload){
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
                                    if(otherDistance < this.blastSettings.shipSightRange){
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
                                if(laserDistance < this.blastSettings.shipDodgeRange){
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
                                if(targetDist < this.blastSettings.shipBattleRange - this.blastSettings.shipBattleComfort){ // target is too close for comfort
                                    moveAngle += 180;
                                    moveAngle += Math.random() * this.blastSettings.shipWander * 2 - this.blastSettings.shipWander;
                                    var moveCoords = this.pointFromAngle(
                                        this.ships[ship].pos[0],
                                        this.ships[ship].pos[1],
                                        moveAngle,
                                        (this.blastSettings.shipChase * (Math.random() * 0.85 + 0.15)) * fpsCompensation
                                    );
                                    this.ships[ship].pos[0] = moveCoords[0];
                                    this.ships[ship].pos[1] = moveCoords[1];
                                }else if(targetDist < this.blastSettings.shipBattleRange + this.blastSettings.shipBattleComfort){ // target is good distance away
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
                                    moveAngle += Math.random() * this.blastSettings.shipWander * 2 - this.blastSettings.shipWander;
                                    var moveCoords = this.pointFromAngle(
                                        this.ships[ship].pos[0],
                                        this.ships[ship].pos[1],
                                        moveAngle,
                                        (this.blastSettings.shipChase * (Math.random() * 0.85 + 0.15)) * fpsCompensation
                                    );
                                    this.ships[ship].pos[0] = moveCoords[0];
                                    this.ships[ship].pos[1] = moveCoords[1];
                                }else{ // target is too far away
                                    moveAngle += Math.random() * this.blastSettings.shipWander * 2 - this.blastSettings.shipWander;
                                    var moveCoords = this.pointFromAngle(
                                        this.ships[ship].pos[0],
                                        this.ships[ship].pos[1],
                                        moveAngle,
                                        (this.blastSettings.shipChase * (Math.random() * 0.85 + 0.15)) * fpsCompensation
                                    );
                                    this.ships[ship].pos[0] = moveCoords[0];
                                    this.ships[ship].pos[1] = moveCoords[1];
                                }
                                break;
                            case "dodge":
                                var ms = Date.now();
                                if(this.ships[ship].dodging === dodging && ms - this.ships[ship].lastDodge < this.blastSettings.dodgeTime){
                                    dodgeAngle = this.ships[ship].dodgeAngle + (Math.random() * this.blastSettings.shipWander * 2 - this.blastSettings.shipWander) * fpsCompensation;
                                    this.ships[ship].dodgeAngle = dodgeAngle;
                                }else{
                                    this.ships[ship].lastDodge = ms;
                                    this.ships[ship].dodging = dodging;
                                    dodgeAngle = Math.round(Math.random() * 360) + (Math.random() * this.blastSettings.shipWander * 2 - this.blastSettings.shipWander) * fpsCompensation;
                                    this.ships[ship].dodgeAngle = dodgeAngle;
                                }
                                var newPos = this.pointFromAngle(
                                    this.ships[ship].pos[0],
                                    this.ships[ship].pos[1],
                                    dodgeAngle,
                                    this.blastSettings.shipChase * fpsCompensation
                                );
                                this.ships[ship].pos[0] = newPos[0];
                                this.ships[ship].pos[1] = newPos[1];
                                break;
                            default:
                                this.ships[ship].dodging = null;
                                this.ships[ship].wanderDirection += (Math.random() * this.blastSettings.shipWander - (this.blastSettings.shipWander / 2)) * fpsCompensation;
                                if(this.ships[ship].wanderDirection > 360){
                                    this.ships[ship].wanderDirection -= 360;
                                }else if(this.ships[ship].wanderDirection < 0){
                                    this.ships[ship].wanderDirection += 360;
                                }
                                this.ships[ship].pos = this.pointFromAngle(
                                    this.ships[ship].pos[0],
                                    this.ships[ship].pos[1],
                                    this.ships[ship].wanderDirection,
                                    this.blastSettings.shipIdle * fpsCompensation
                                )
                        }
                    }
                    // do ship firing fourth
                    if(this.ships[ship].targetShip){
                        var shouldShoot = 0;
                        if(targetDist < this.blastSettings.shipFireRange){
                            var ms = Date.now();
                            if(this.ships[ship].shotsFired >= this.blastSettings.gunAmmo){
                                if(ms - this.ships[ship].lastReload > this.blastSettings.gunReload){
                                    this.ships[ship].shotsFired = 0;
                                    shouldShoot = 1;
                                }
                            }else{
                                shouldShoot = 1;
                            }
                            if(!this.soundShoot){
                                shouldShoot = 0;
                            }
                            if(ms - this.ships[ship].lastFire > this.blastSettings.gunDelay){
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
                                        targetAngle + Math.random() * this.blastSettings.gunInaccuracy - this.blastSettings.gunInaccuracy * 0.5
                                    );
                                    this.ships[ship].shotsFired++;
                                    this.ships[ship].lastFire = ms;
                                    if(this.ships[ship].shotsFired >= this.blastSettings.gunAmmo){
                                        this.ships[ship].lastReload = ms;
                                    }
                                }
                            }
                        }
                    }
                    if(this.ships[ship].shotsFired >= this.blastSettings.gunAmmo && Date.now() - this.ships[ship].lastReload > this.blastSettings.gunReload){
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
                    var shipDrawColor = this.visBassAvg / (this.visBassAvgVolume + this.blastSettings.soundMemoryAdd) * 255;
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
                    if(debugForce){
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
                                this.blastSettings.shipBattleRange - this.blastSettings.shipBattleComfort,
                                this.deg2rad(this.ships[ship].targetAngle + 165),
                                this.deg2rad(this.ships[ship].targetAngle + 195)
                            );
                            canvas.stroke();
                            canvas.beginPath();
                            canvas.arc(
                                targetCoord[0],
                                targetCoord[1],
                                this.blastSettings.shipBattleRange + this.blastSettings.shipBattleComfort,
                                this.deg2rad(this.ships[ship].targetAngle + 165),
                                this.deg2rad(this.ships[ship].targetAngle + 195)
                            );
                            canvas.stroke();
                            canvas.beginPath();
                            canvas.moveTo(this.ships[ship].pos[0], this.ships[ship].pos[1]);
                            canvas.arc(
                                targetCoord[0],
                                targetCoord[1],
                                this.blastSettings.shipBattleRange,
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
                    if(this.blastSettings.shipLabels){
                        canvas.fillStyle = "#FFF";
                        canvas.font = "24px Sans-Serif";
                        canvas.fillText(
                            this.ships[ship].health + ", " + (this.blastSettings.gunAmmo - this.ships[ship].shotsFired) + "/" + this.blastSettings.gunAmmo,
                            this.ships[ship].pos[0] - this.ships[ship].size,
                            this.ships[ship].pos[1] - this.ships[ship].size
                        );
                    }
                }else{
                    if(Date.now() - this.ships[ship].lastDeath > this.blastSettings.shipRespawn){
                        this.ships[ship].alive = 1;
                        this.ships[ship].health = this.blastSettings.shipHealth;
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
            if(this.settings.scoreboard.value){
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
            scoreboard: {
                type: "toggle",
                value: 1,
                default: 1,
                title: "Scoreboard",
                desc: "Takes score on how many times each AI scored a hit."
            },
            shipCount: {
                type: "number",
                value: 2,
                default: 2,
                range: [2, 10],
                step: 1,
                title: "Number of Ships",
                desc: "Reset the visualizer to take effect."
            },
            respawnShips: {
                type: "button",
                content: "Reset Visualizer",
                func: function(){
                    vis.blast.spawnShips();
                }
            }
        },
        blastSettings: {
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
    waveform: {
        name: "Waveform",
        image: "visualizers/waveform.png",
        bestColor: "beta",
        start: function(){
            this.waveArray = new Uint8Array(analyser.fftSize);
            this.arrsize = analyser.fftSize;
        },
        frame: function(){
            analyser.getByteTimeDomainData(this.waveArray);
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var avg = 0;
            for(var i = 0; i < 12; i++){
                avg += visData[i];
            }
            avg /= 12;
            var multiplier = size[1] / 255;
            var step = this.arrsize / size[0];
            canvas.lineWidth = 2;
            smoke.lineWidth = 2;
            for(var i = 0; i < size[0]; i++){
                canvas.strokeStyle = getColor(avg, 255 - i / size[0] * 255);
                canvas.beginPath();
                canvas.moveTo(size[0] - i - 1.5, size[1] - (this.waveArray[Math.round(i * step)] / 2 * multiplier) - size[1] / 4);
                canvas.lineTo(size[0] - i - 0.5, size[1] - (((typeof this.waveArray[Math.round((i - 1) * step)] === "number") ? this.waveArray[Math.round((i - 1) * step)] / 2 : this.waveArray[Math.round(i * step)] / 2) * multiplier) - size[1] / 4);
                canvas.stroke();
                //canvas.fillRect(graphLength - i - 1, size[1] - (this.graph[i] * multiplier), 1, 1);
                if(smokeEnabled){
                    smoke.strokeStyle = getColor(this.graph[i], 255 - i / size[0] * 255);
                    smoke.beginPath();
                    smoke.moveTo(size[0] - i - 1.5, size[1] - (this.waveArray[Math.round(i * step)] * multiplier));
                    smoke.lineTo(size[0] - i - 1.5, size[1] - (((typeof this.waveArray[Math.round((i - 1) * step)] === "number") ? this.waveArray[Math.round((i - 1) * step)] : this.waveArray[Math.round(i * step)]) * multiplier));
                    smoke.stroke();
                    //smoke.fillRect(graphLength - i - 1, size[1] - (this.graph[i] * multiplier), 1, 1);
                }
            }
        },
        stop: function(){

        },
        waveArray: new Uint8Array()
    },
    realseismograph: {
        name: "Seismograph",
        image: "visualizers/realseismograph.png",
        bestColor: "beta",
        start: function(){
            this.graph = new Array(Math.floor(size[1] / 2));
            this.graph.fill([-1, 0], 0, Math.floor(size[1] / 2));
            this.waveArray = new Uint8Array(1);
        },
        frame: function(){
            analyser.getByteTimeDomainData(this.waveArray);

            var avgVolume = 0;
            for(var i = 0; i < 12; i++){
                avgVolume += Math.sqrt(visData[i]) * this.sqrt255;
                //avgVolume += visData[i];
            }
            avgVolume /= 12;

            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            this.graph.push([this.waveArray[0], avgVolume]);
            while(this.graph.length > Math.floor(size[1] / 2)){
                this.graph.shift();
            }
            var graphLength = this.graph.length;
            var multiplier = size[0] / 255;
            canvas.lineWidth = 2;
            smoke.lineWidth = 2;
            for(var i = 0; i < graphLength; i++){
                canvas.strokeStyle = getColor(this.graph[i][1], 255 - i / size[0] * 255);
                canvas.beginPath();
                canvas.moveTo(this.graph[i][0] * multiplier, size[1] - i * 2 - 2);
                canvas.lineTo(((typeof this.graph[i - 1] === "object") ? this.graph[i - 1] : this.graph[i])[0] * multiplier, size[1] - i * 2);
                canvas.stroke();
                //canvas.fillRect(graphLength - i - 1, size[1] - (this.graph[i] * multiplier), 1, 1);
                if(smokeEnabled){
                    smoke.strokeStyle = getColor(this.graph[i][0], 255 - i / size[0] * 255);
                    smoke.beginPath();
                    smoke.moveTo(this.graph[i][0] * multiplier, size[1] - i * 2 - 2);
                    smoke.lineTo(((typeof this.graph[i - 1] === "object") ? this.graph[i - 1] : this.graph[i])[0] * multiplier, size[1] - i * 2);
                    smoke.stroke();
                    //smoke.fillRect(graphLength - i - 1, size[1] - (this.graph[i] * multiplier), 1, 1);
                }
            }
        },
        stop: function(){
            this.graph = [];
        },
        graph: [],
        sqrt255: Math.sqrt(255)
    },
    avgPitch: {
        name: "Average Pitch",
        image: "visualizers/averagePitch.png",
        bestColor: "bluegreenred",
        start: function(){

        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var mult = size[0] / 64;
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
            var avgVolume = 0;
            for(var i = 0; i < 12; i++){
                avgVolume += Math.sqrt(visData[i]) * this.sqrt255;
                //avgVolume += visData[i];
            }
            avgVolume /= 12;
            if(this.settings.oldPitch.value){
                var avgPitch = 0;
                var avgPitchMult = 0;
                for(var i = 0; i < 64; i++){
                    avgPitch += i * visData[i];
                    avgPitchMult += visData[i];
                }
                avgPitch /= avgPitchMult;
            }else{
                var avgPitch = this.weightedAverage(visData.slice(0, 64), 0.5);
            }
            canvas.globalAlpha = 1;
            canvas.fillStyle = getColor(avgVolume, avgPitch * 4);
            canvas.fillRect(this.history[9][0], 0, Math.round(avgPitch * mult) - this.history[9][0], size[1]);
            if(smokeEnabled){
                smoke.globalAlpha = 1;
                smoke.fillStyle = getColor(avgVolume, avgPitch * 4);
                smoke.fillRect(this.history[9][0], 0, Math.round(avgPitch * mult) - this.history[9][0], size[1]);
            }
            this.history.shift();
            this.history[9] = [Math.round(avgPitch * mult), avgVolume, avgPitch];
        },
        weightedAverage: function(arr, minPcnt){
            var weight = 0;
            var total = 0;
            var minValue = Math.max(...arr) * minPcnt;
            for(var i in arr){
                weight += ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
                total += i * ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
            }
            return total / weight;
        },
        settings: {
            oldPitch: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Use Old Pitch Algorithm",
                desc: "The old pitch algorithm is squirrelly and does not consider the \"whole picture\"."
            },
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
    'SEPARATOR_DEBUG" disabled="': {
        name: 'Debug',
        start: function(){

        },
        frame: function(){

        },
        stop: function(){

        }
    },
    bassSplit: {
        name: "Method Testing",
        image: "visualizers/bassSplit.png",
        start: function(){
            
        },
        frame: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            smoke.clearRect(0, 0, size[0], size[1]);
            var top = 10;
            var left = size[0] / 2;
            for(var i = 0; i < 128; i++){
                this.drawLine(i, visData[i], left - (i < 12) * 2 + (i > 64) * 2 - 88, top);
            }
            canvas.fillStyle = "#0F0";
            var bassAvg = this.weightedAverage(visData.slice(0, 12), 0.3) * 2;
            var trebleAvg = this.weightedAverage(visData.slice(12, 64), 0.7) * 2;
            canvas.fillRect(left - 90 + bassAvg, top + 255, 2, 2);
            canvas.fillRect(left - 64 + trebleAvg, top + 255, 2, 2);

            canvas.fillStyle = "#FFF";
            canvas.fillRect(left - 86, top + 257, 152, 1);
            canvas.fillRect(left - 66, top + 255, 2, 2);
            canvas.fillRect(left + 42, top + 255, 2, 2);
            canvas.fillText("Bass / Extra Split", left - 300, top + 128);

            top += 260;
            for(var i = 0; i < 64; i++){
                this.drawLine(i, visData[i], left - 64, top);
            }
            canvas.fillStyle = "#0F0";
            var allAvg = this.weightedAverage(visData.slice(0, 64), 0.6) * 2;
            canvas.fillRect(left - 64 + allAvg, top + 255, 2, 2);

            canvas.fillStyle = "#FFF";
            canvas.fillRect(left - 86, top + 257, 152, 1);
            canvas.fillText("Full Graph", left - 300, top + 128);
            //updateSmoke();
        },
        stop: function(){
            
        },
        drawLine: function(x, h, l, t){
            var fillColor = getColor(h, x / 4);
            canvas.fillStyle = fillColor;
            canvas.fillRect(l + x * 2, t + (255 - h), 2, h);
            if(smokeEnabled){
                smoke.fillStyle = fillColor;
                smoke.fillRect(l + x * 2, t + (255 - h), 2, h * 2);
            }
        },
        weightedAverage: function(arr, minPcnt){
            var weight = 0;
            var total = 0;
            var minValue = Math.max(...arr) * minPcnt;
            for(var i in arr){
                weight += ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
                total += i * ((arr[i] >= (minValue || 0)) ? arr[i] : 0);
            }
            return total / weight;
        }
    },
    colorTest: {
        name: "Color Smoke Test",
        image: "visualizers/colorTest.png",
        start: function(){
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
        frame: function(){

        },
        stop: function(){

        },
        sizechange: function(){
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
        }
    },
    colorTest2: {
        name: "2D Color Test",
        image: "visualizers/colorTest2.png",
        start: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            var leftEdge = size[0] / 2 - 128;
            var bottomEdge = size[1] / 2 + 128;
            for(var i = 0; i < 256; i++){
                for(var j = 0; j < 256; j++){
                    canvas.fillStyle = getColor(i, j);
                    canvas.fillRect(leftEdge + j, bottomEdge - i, 1, 1);
                }
            }
        },
        frame: function(){
        },
        stop: function(){

        },
        sizechange: function(){
            canvas.clearRect(0, 0, size[0], size[1]);
            var leftEdge = size[0] / 2 - 128;
            var bottomEdge = size[1] / 2 + 128;
            for(var i = 0; i < 256; i++){
                for(var j = 0; j < 256; j++){
                    canvas.fillStyle = getColor(i, j);
                    canvas.fillRect(leftEdge + j, bottomEdge - i, 1, 1);
                }
            }
        },
        settings: {
            headerFunctional: {
                type: "header",
                content: "Functional Options"
            },
            testNumber: {
                type: "number",
                value: 4,
                default: 4,
                range: [0, 10],
                step: 2,
                title: "Number",
                desc: "Even number from 0 - 10"
            },
            testString: {
                type: "string",
                value: "Type Something",
                default: "Type Something",
                title: "String",
                desc: "Text value."
            },
            testToggle: {
                type: "toggle",
                value: 0,
                default: 0,
                title: "Toggle",
                desc: "Toggles a boolean value (0 / 1)"
            },
            testChoice: {
                type: "choice",
                value: "choice2",
                default: "choice2",
                choices: {choice1: "Apples 1", choice2: "Oranges 2", choice3: "Pears 3"},
                title: "Choice",
                desc: "Choose between options."
            },
            testButton: {
                type: "button",
                content: "Click Me",
                func: function(){alert("It's working.");},
                title: "Button",
                desc: "Runs a function on click.",
            },
            testSeparator: {
                type: "separator"
            },
            headerStatic: {
                type: "header",
                content: "Information UI"
            },
            textStatic: {
                type: "text",
                content: "These options don't have functional actions. This is a paragraph btw"
            },
            testInfo: {
                type: "info",
                title: "Info",
                desc: "Shows return value from a function.",
                func: function(){return performance.now();}
            }
        }
    },
    modTest: {
        name: "Curve Test",
        image: "visualizers/modTest.png",
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
    },
    smokeTest: {
        name: "Smoke Test",
        image: "visualizers/smokeTest.png",
        start: function(){
            smoke.clearRect(0, 0, size[0], size[1]);
            for(var i = 0; i < size[0]; i++){
                smoke.fillStyle = getColor(i / size[0] * 255);
                smoke.fillRect(i, 0, 1, size[1]);
            }
            //updateSmoke();
            canvas.clearRect(0, 0, size[0], size[1]);
        },
        frame: function(){

        },
        stop: function(){

        },
        sizechange: function(){
            smoke.clearRect(0, 0, size[0], size[1]);
            for(var i = 0; i < size[0]; i++){
                smoke.fillStyle = getColor(i / size[0] * 255);
                smoke.fillRect(i, 0, 1, size[1]);
            }
            //updateSmoke();
            canvas.clearRect(0, 0, size[0], size[1]);
        }
    },
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
        smokeEnabled = 0;
    }else{
        smokeElement.classList.remove("disabled");
        if(!transparentMode){
            smokeScreen1.classList.remove("disabled");
            smokeScreen2.classList.remove("disabled");
        }
        getId("smokeButton").style.borderColor = "#0A0";
        smokeEnabled = 1;
        resizeSmoke();
        if(vis[currVis].sizechange){
            vis[currVis].sizechange();
        }
    }
}
var smokeBrightness = 1.5;
function setSmokeBrightness(newValue){
    smokeBrightness = (newValue || 0);
    resizeSmoke();
    localStorage.setItem("AaronOSMusic_SmokeBrightness", String(newValue));
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
                smokeElement.style.filter = "blur(" + Math.round((size[0] * 2 + size[1] * 2) / 50) + "px) brightness(" + smokeBrightness + ")";
            }else{
                smokeElement.style.filter = "blur(" + Math.round((size[0] + size[1]) / 50) + "px) brightness(" + smokeBrightness + ")";
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
    fubar: 1,
    reflection: 1,
    orbsAround: 1,
    bassCircle: 1,
    refraction: 1,
    dancer: 1,
    triWave: 1,
    spectrogramStretched: 1
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
            tempHTML += '<div' + namecolor + ' class="visOption visNone" onclick="overrideVis(\'' + i + '\')"><img src="' + vis.none.image + '" onerror="this.style.opacity=\'0\';this.style.height=\'50%\';this.style.transition=\'0s\'">' + vis.none.name + '</div>';
        }else{
            tempHTML += '<div' + namecolor + ' class="visOption visNone" onclick="overrideVis(\'' + i + '\')"><span></span>' + vis.none.name + '</div>';
        }
        tempHTML += '<div style="height:auto;background:none;"><hr></div>';
        tempHTML += '<div class="visCategory">&nbsp;<button onclick="this.parentElement.classList.toggle(\'hiddenCategory\')">&nbsp; v &nbsp;</button> Featured<br>';
        for(var i in featuredVis){
            var namecolor = "";
            if(i === getId("visfield").value){
                namecolor = ' style="outline:2px solid ' + getColor(255) + ';"';
            }
            if(vis[i].image){
                tempHTML += '<div' + namecolor + ' class="visOption" onclick="overrideVis(\'' + i + '\')"><img src="' + vis[i].image + '" onerror="this.style.opacity=\'0\';this.style.height=\'50%\';this.style.transition=\'0s\'">';
                if(vis[i].settings){
                    tempHTML += '<span style="opacity:1;height:initial;margin-right:initial;line-height:initial;" title="Settings Available">&#9881;</span> ';
                }else{
                    tempHTML += '<span style="opacity:0.25;height:initial;margin-right:initial;line-height:initial;" title="No Settings">&#9881;</span> ';
                }
                tempHTML += vis[i].name + '&nbsp;</div>';
            }else{
                tempHTML += '<div' + namecolor + ' class="visOption" onclick="overrideVis(\'' + i + '\')"><span></span>';
                if(vis[i].settings){
                    tempHTML += '<span style="opacity:1;height:initial;margin-right:initial;line-height:initial;" title="Settings Available">&#9881;</span> ';
                }else{
                    tempHTML += '<span style="opacity:0.25;height:initial;margin-right:initial;line-height:initial;" title="No Settings">&#9881;</span> ';
                }
                tempHTML += vis[i].name + '</div>';
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
                        tempHTML += '<div' + namecolor + ' class="visOption" onclick="overrideVis(\'' + i + '\')"><img src="' + vis[i].image + '" onerror="this.style.opacity=\'0\';this.style.height=\'50%\';this.style.transition=\'0s\'">';
                        if(vis[i].settings){
                            tempHTML += '<span style="opacity:1;height:initial;margin-right:initial;line-height:initial;" title="Settings Available">&#9881;</span> ';
                        }else{
                            tempHTML += '<span style="opacity:0.25;height:initial;margin-right:initial;line-height:initial;" title="No Settings">&#9881;</span> ';
                        }
                        tempHTML += vis[i].name + '&nbsp;</div>';
                    }else{
                        tempHTML += '<div' + namecolor + ' class="visOption" onclick="overrideVis(\'' + i + '\')"><span></span>';
                        if(vis[i].settings){
                            tempHTML += '<span style="opacity:1;height:initial;margin-right:initial;line-height:initial;" title="Settings Available">&#9881;</span> ';
                        }else{
                            tempHTML += '<span style="opacity:0.25;height:initial;margin-right:initial;line-height:initial;" title="No Settings">&#9881;</span> ';
                        }
                        tempHTML += vis[i].name + '</div>';
                    }
                }
            }else{
                tempHTML += '</div><div style="height:auto;background:none;"><br></div>';
                tempHTML += '<div class="visCategory hiddenCategory">&nbsp;<button onclick="this.parentElement.classList.toggle(\'hiddenCategory\')">&nbsp; v &nbsp;</button> ' + vis[i].name + '<br>';
            }
        }
        tempHTML += '</div>';
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
        var tempHTML = '<div style="margin-top:8px;margin-bottom:8px;text-align:center;background:transparent !important;"><button onclick="toggleBestColors()" id="bestColorsButton" style="border-color:' + debugColors[bestColorsMode] + '">Auto-Select When Visualizer Changes</button></div>';
        tempHTML += '<div style="margin-bottom:12px;text-align:center;background:transparent !important;"><button onclick="overrideColor(\'autoFileInfo\');openCustomColorMenu();">Edit Custom Colors</button></div>';
        var firstDiv = 1;
        for(var i in colors){
            if(i.indexOf("SEPARATOR") === -1){
                var namecolor = "";
                if(i === getId("colorfield").value){
                    namecolor = ' style="outline:2px solid ' + getColor(255) + ';"';
                }
                if(colors[i].image){
                    tempHTML += '<div' + namecolor + ' class="colorOption" onclick="overrideColor(\'' + i + '\')">&nbsp;<img src="' + colors[i].image + '">&nbsp;' + colors[i].name + '</div>';
                }else{
                    tempHTML += '<div' + namecolor + ' class="colorOption" onclick="overrideColor(\'' + i + '\')">' + colors[i].name + '</div>';
                }
            }else{
                if(!firstDiv){
                    tempHTML += '</div><div style="height:auto;background:none;"><br></div>';
                }else{
                    firstDiv = 0;
                }
                tempHTML += '<div class="visCategory hiddenCategory">&nbsp;<button onclick="this.parentElement.classList.toggle(\'hiddenCategory\')">&nbsp; v &nbsp;</button> ' + colors[i].category + '<br>';
            }
        }
        tempHTML += '</div>';
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

        tempHTML += '<p style="font-size:3em">AaronOS Music Settings</p>';

        tempHTML += '<span style="font-size:2em">Auto-Select Colors for Visualizer</span><br><br>' +
            '<button onclick="toggleBestColors()" id="bestColorsButton" style="border-color:' + debugColors[bestColorsMode] + '">Toggle</button>' +
            '<p>Automatically selects the recommended color pallette when switching visualizers.</p>';

        tempHTML += "<br><br><span style='font-size:2em'>Fast Mode</span><br><br>" +
            '<button onclick="togglePerformance()" id="performanceButton" style="border-color:' + debugColors[performanceMode] + '">Toggle</button>' +
            "<p>If performance is slow, this option lowers quality to help weaker devices.</p>";

        tempHTML += "<br><br><span style='font-size:2em'>Smoke Glow Brightness</span><br><br>" +
            'Multiplier: <input style="width: 50px" type="number" id="smokeglowinput" min="0.25" max="5" value="' + smokeBrightness + '" step="0.25" onchange="setSmokeBrightness(this.value)"></input>' +
            "<p>Default: 1.5<br>The smoke effect multiplies light by this value to make it more visible. Excessive values may cause color issues.</p>";

        if(!webVersion){
            if(!microphoneActive){
                tempHTML += "<br><br><span style='font-size:2em'>Self-Close</span><br><br>" +
                    'Songs: <input style="width:50px" type="number" id="selfcloseinput" min="1" max="9999" value="' + selfCloseSongs + '" step="1" onchange="selfCloseSongs = this.value;"></input>' +
                    ' <button onclick="toggleSelfClose()" id="selfclosebutton" style="border-color:' + debugColors[selfCloseEnabled] + '">Toggle</button>' +
                    "<p>The music player will close itself after playing a number of songs.</p>";
            }

            tempHTML += '<br><br><span style="font-size:2em">Transparent Mode</span><br><br>' +
            '<button onclick="ipcRenderer.send(\'toggle-transparent\', {x: screen.width, y: screen.height})">Toggle</button><br><br>' +
            'Current Mode: ' + windowType;
        }

        if(!microphoneActive){

            tempHTML += "<br><br><br><span style='font-size:2em'>Audio Delay</span><br><br>" +
                'Seconds: <input style="width: 50px" type="number" id="delayinput" min="0" max="1" value="' + (Math.round(delayNode.delayTime.value * 100) / 100) + '" step="0.01" onchange="setDelay(this.value)"></input>' +
                "<p>Default: 0.07<br>If the visualizer and the music don't line up, try changing this.<br>Larger numbers delay the audible music more.</p>";

            tempHTML += "<br><br><span style='font-size:2em'>Smoothing Time Constant</span><br><br>" +
                'Constant: <input style="width: 50px" type="number" id="delayinput" min="0" max="0.99" value="' + analyser.smoothingTimeConstant + '" step="0.01" onchange="setSmoothingTimeConstant(this.value)"></input>' +
                "<p>Default: 0.8<br>This value changes how smooth frequency response over time is. High values are smoother.<br>Values too high will make the visualizers feel lethargic.<br>Values too low will make the visualizers too hyper or unreadable.</p>";
                
            //tempHTML += '<br><br><span style="font-size:2em">Song Info</span><br><br>' +
            //    'Info detected: ' + (['No', 'Yes'])[0 + (fileInfo.hasOwnProperty('_default_colors'))] + '<br><br>' +
            //    '<button onclick="generateSongInfo()">Generate Info</button><br><br>' +
            //    'Select-All + Copy generated info from below, save to "_songInfo.txt" in your music\'s main folder, modify as you see fit.<br><br>' +
            //    '<textarea id="songInfoTemplate" style="height:64px;"></textarea>';
        }

        tempHTML += "<br><br><br><span style='font-size:2em'>Debug Overlays</span><br><br>" +
            '<button onclick="toggleFPS()" id="debugButton" style="border-color:' + debugColors[debugForce] + '">Toggle</button>' +
            "<p>Intended for developer use. Enables various debug overlays.</p>";

        tempHTML += "<br><br><span style='font-size:2em'>Debug Frequencies</span><br><br>" +
        '<button onclick="toggleFreqs()" id="debugFreqsButton" style="border-color:' + debugColors[debugFreqs] + '">Toggle</button>' +
            "<p>Intended for developer use. Sweeps through all frequencies to test visualizers.</p>";

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

/*
    vis.visualizer.settings: {
        optionNumber: {
            type: "number",
            value: 0,
            default: 0,
            title: "Option Title",
            desc: "Option Description",
            range: [min, max],
            step: 1
        },
        optionChoice: {
            type: "choice",
            value: "something",
            default: "something",
            title: "Option Title",
            desc: "Option Description",
            choices: {something: "Something", other: "Other Thing", else: "Another Thing"}
        },
        optionToggle: {
            type: "toggle",
            value: 1,
            default: 1
            title: "Option Title",
            desc: "Option Description"
        },
        optionButton: {
            type: "button",
            content: "",
            func: function(){},
            title: "Option Title",
            desc: "Option Description"
        },
        optionString: {
            type: "string",
            value: "something",
            default: "something"
            title: "Option Title",
            desc: "Option Description",
        }
        optionHeader: {
            type: "header",
            content: "Header Text"
        },
        optionText: {
            type: "text",
            content: "Paragraph Text"
        },
        optionInfo: {
            type: "info",
            title: "Info Title",
            desc: "Info Description",
            func: function(){return "string"}
        }
        optionSeperator: {
            type: "separator"
        }
    }
*/

function openVisSettingsMenu(){
    if(getId("selectOverlay").classList.contains("disabled")){
        if(vis[currVis].settings){
            getId("selectOverlay").classList.remove("disabled");
            var tempHTML = '';
            tempHTML += '<div style="font-size:0.5em;padding-left:8px;background:transparent !important">';
            tempHTML += '<p style="font-size:3em;">' + vis[currVis].name + ' Settings</p>';
            for(var i in vis[currVis].settings){
                if(vis[currVis].settings[i].title){
                    tempHTML += '<span style="font-size:2em;">' + vis[currVis].settings[i].title + '</span><br><br>';
                }
                switch(vis[currVis].settings[i].type){
                    case "header":
                        tempHTML += '<p style="font-size:2em;">' + vis[currVis].settings[i].content + '</p>';
                        break;
                    case "text":
                        tempHTML += '<p>' + vis[currVis].settings[i].content + '</p>';
                        break;
                    case "separator":
                        tempHTML += '<hr>';
                        break;
                    case "info":
                        tempHTML += '<span style="font-family:monospace;background-color:rgba(127, 127, 127, 0.5);border-radius:3px;">' + vis[currVis].settings[i].func() + '</span>';
                        tempHTML += '<br><br>';
                        break;
                    case "number":
                        tempHTML += '<span><input type="number" class="visSettingsNumber"';
                        if(typeof vis[currVis].settings[i].default !== "undefined"){
                            tempHTML += ' placeholder="' + vis[currVis].settings[i].default + '"';
                        }
                        if(typeof vis[currVis].settings[i].value !== "undefined"){
                            tempHTML += ' value="' + vis[currVis].settings[i].value + '"';
                        }
                        if(vis[currVis].settings[i].range){
                            tempHTML += ' min="' + vis[currVis].settings[i].range[0] +
                                '" max="' + vis[currVis].settings[i].range[1] + '"';
                        }
                        if(vis[currVis].settings[i].step){
                            tempHTML += ' step="' + vis[currVis].settings[i].step + '"';
                        }
                        tempHTML += '> <button onclick="setVisSetting(\'' + currVis + '\', \'' + i + '\', parseFloat(this.parentNode.getElementsByClassName(\'visSettingsNumber\')[0].value))">Set</button></span>';
                        tempHTML += ' <i>Default: ' + vis[currVis].settings[i].default + '</i><br><br>';
                        break;
                    case "string":
                        tempHTML += '<span><input class="visSettingsString"';
                        if(typeof vis[currVis].settings[i].default !== "undefined"){
                            tempHTML += ' placeholder="' + vis[currVis].settings[i].default + '"';
                        }
                        if(typeof vis[currVis].settings[i].value !== "undefined"){
                            tempHTML += ' value="' + vis[currVis].settings[i].value + '"';
                        }
                        tempHTML += '> <button onclick="setVisSetting(\'' + currVis + '\', \'' + i + '\', this.parentNode.getElementsByClassName(\'visSettingsString\')[0].value)">Set</button></span>';
                        tempHTML += '<br><br>';
                        break;
                    case "toggle":
                        tempHTML += '<input type="checkbox"' +
                            ' onchange="setVisSetting(\'' + currVis + '\', \'' + i + '\', this.checked ? 1 : 0)"'
                        if(typeof vis[currVis].settings[i].value !== "undefined"){
                            if(vis[currVis].settings[i].value){
                                tempHTML += ' checked';
                            }
                        }
                        tempHTML += '> <div style="display:inline-block;width:auto;background:transparent !important;">Toggle';
                        if(typeof vis[currVis].settings[i].default !== "undefined"){
                            if(vis[currVis].settings[i].default){
                                tempHTML += ' <i>(default: Enabled)</i>';
                            }else{
                                tempHTML += ' <i>(default: Disabled)</i>';
                            }
                        }
                        tempHTML += '</div><br><br>';
                        break;
                    case "choice":
                        tempHTML += '<select class="visSettingsSelect"' +
                            ' onchange="setVisSetting(\'' + currVis + '\', \'' + i + '\', this.value)">';
                        for(var item in vis[currVis].settings[i].choices){
                            tempHTML += '<option value="' + item + '"';
                            if(vis[currVis].settings[i].value === item){
                                tempHTML += ' selected';
                            }
                            tempHTML += '>' + vis[currVis].settings[i].choices[item] + '</option>';
                        }
                        tempHTML += '</select>';
                        if(typeof vis[currVis].settings[i].default !== "undefined"){
                            tempHTML += ' <i>(default: ' + vis[currVis].settings[i].choices[vis[currVis].settings[i].default] + ')</i>';
                        }
                        tempHTML += '<br><br>';
                        break;
                    case "button":
                        tempHTML += '<button onclick="vis[\'' + currVis + '\'].settings[\'' + i + '\'].func()">' + vis[currVis].settings[i].content + '</button>';
                        tempHTML += '<br><br>';
                        break;
                    default:
                        tempHTML += "Invalid setting type " + vis[currVis].settings[i].type + " of " + currVis + ": " + i;
                        tempHTML += '<br><br>';
                }
                if(vis[currVis].settings[i].desc){
                    tempHTML += vis[currVis].settings[i].desc + '<br><br>';
                }
                tempHTML += '<br>';
            }
            tempHTML += '</div>';
            getId("selectContent").innerHTML = tempHTML;
            getId("selectContent").scrollTop = 0;
        }
    }else{
        closeMenu();
    }
}

function setVisSetting(visualizer, option, value, doNotSave){
    try{
        if(typeof vis[visualizer].settings === "object"){
            if(typeof vis[visualizer].settings[option] !== "undefined"){
                vis[visualizer].settings[option].value = value;
                if(vis[visualizer].settingChange){
                    vis[visualizer].settingChange(option, value);
                }
                if(!doNotSave){
                    if(typeof visSettingsObj[visualizer] !== "object"){
                        visSettingsObj[visualizer] = {};
                    }
                    visSettingsObj[visualizer][option] = value;
                    localStorage.setItem("AaronOSMusic_VisualizerSettings", JSON.stringify(visSettingsObj));
                }
            }
        }
    }catch(err){
        console.log("Error setting " + option + " to " + value + " in " + visualizer + ":");
        console.log(err);
    }
};

var visSettingsObj = {};
if(localStorage.getItem("AaronOSMusic_VisualizerSettings")){
    visSettingsObj = JSON.parse(localStorage.getItem("AaronOSMusic_VisualizerSettings"));
    for(var i in visSettingsObj){
        for(var j in visSettingsObj[i]){
            setVisSetting(i, j, visSettingsObj[i][j], 1);
        }
    }
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
        getId("transparentModeIconText").innerHTML = "Disable Transparency";
        getId("transparentModeIconNoGPU").style.display = "none";
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
        remote.getCurrentWindow().setBounds({
            x: (screen.width - 1048) / 2,
            y: (screen.height - 632) / 2,
            width: 1048,
            height: 650
        });
        taskbarMode = 0;
        getId("taskbarButton").style.borderColor = "#C00";
        if(currVis === "spectrumCentered"){
            overrideVis(previousVis);
        }
    }else{
        remote.getCurrentWindow().setBounds({
            x: -9,
            y: screen.height - 148,
            width: screen.width + 17,
            height: 160
        });
        taskbarMode = 1;
        getId("taskbarButton").style.borderColor = "#0A0";
        previousVis = currVis;
        overrideVis("spectrumCentered");
    }
}
function finishSettingTaskbarMode(res){
    overrideVis("spectrumBass");
}

window.addEventListener("keypress", function(event){
    if(event.key.toLowerCase() === "f"){
        toggleFullscreen();
    }
});

if(!document.fullscreenEnabled){
    getId("fullscreenButton").classList.add("disabled");
}
function exclusiveFullscreen(){
    if(!document.fullscreenElement){
        document.body.parentNode.requestFullscreen();
    }else if(document.exitFullscreen){
        document.exitFullscreen();
    }
}

if(webVersion){
    // hide Folder button on mobile (devies with no mouse connected)
    // this is because mobile does not support Folder upload - only indiv. files
    if(window.matchMedia){
        if(!window.matchMedia("(pointer: fine)").matches){
            getId("folderInput").parentNode.style.opacity = "0.25";
            getId("mobileDeviceText").classList.remove("disabled");
        }
    }
}

if(!webVersion){
    delete vis.windowRecolor;
    delete vis.bassWindowRecolor;
    getId("filesNotUploadedDisclaimer").style.display = "none";
}