import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';
import TimelinePlugin from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/plugins/timeline.esm.js';
import BeatDetect from './BeatDetect.js';


/////////////////////////////////////////////////////////////////////////////////////////////////
//connection to the USB 


let lastPlayToggle = 0; // Store the last time the button triggered
let filterLeft = null;
let filterRight = null;
let lowFilterLeft = null;
let lowFilterRight = null;
async function handleArduinoData(line) {
    const matches = line.matchAll(/(\w+):(\d+)/g);
    const parsedData = {};

    for (const match of matches) {
        parsedData[match[1]] = parseInt(match[2], 10);
    }

    // Example: Use Potmeter as crossfader
    if (parsedData.Potmeter !== undefined) {
        const potValue = Math.min(Math.max(parsedData.Potmeter, 0), 1023); // clamp between 0-1023
        const crossfaderValue = Math.floor((potValue / 1023) * 100); // scale to 0–100
        updateFader(crossfaderValue);

        const crossfader = document.getElementById("crossfader");
        if (crossfader) {
            crossfader.value = crossfaderValue;
        }
    }

    // Button press detection
    const playCooldown = 800; // Cooldown in milliseconds 

if (parsedData.Left > 850) {
    const now = Date.now();
    if (now - lastPlayToggle > playCooldown) {
        console.log("play button pressed");
        wavesurfer.playPause();
        lastPlayToggle = now;
    }
}
if (parsedData.Right > 950) {
    const now = Date.now();
    if (now - lastPlayToggle > playCooldown) {
        console.log("play button pressed");
        wavesurferTwo.playPause();
        lastPlayToggle = now;
    }
}
if(parsedData.Right > 45 && parsedData.Right < 60){
    syncTrackRight();
}
if(parsedData.Left > 95 && parsedData.Left < 110){
    syncTrackLeft();
}

    if (parsedData.Right === 1) {
        console.log("Right button pressed");
    }

    if (parsedData.Counter === 1) {
        console.log("Counter button pressed");
    }

    if (parsedData.Counter2 === 1) {
        console.log("Counter2 button pressed");
    }
    if (parsedData.FadeL !== undefined) {
        const fadeL = parsedData.FadeL;
        const knobL = document.getElementById("filter-knob-left");
        if (knobL) {
            const minFreq = 20;
            const maxFreq = 5000;
            const scaledFreq = minFreq + (fadeL / 100) * (maxFreq - minFreq);
            knobL.value = scaledFreq;
    
            if (filterLeft && filterLeft.frequency) {
                filterLeft.frequency.setValueAtTime(scaledFreq, audioContext.currentTime);
            } else {
                console.warn("filterLeft not ready yet.");
            }
        }
    }
    
    if (parsedData.FadeR !== undefined) {
        const fadeR = parsedData.FadeR;
        const knobR = document.getElementById("filter-knob-right");
        if (knobR) {
            const minFreq = 20;
            const maxFreq = 5000;
            const scaledFreq = minFreq + (fadeR / 100) * (maxFreq - minFreq);
            knobR.value = scaledFreq;
    
            if (filterRight && filterRight.frequency) {
                filterRight.frequency.setValueAtTime(scaledFreq, audioContext.currentTime);
            } else {
                console.warn("filterRight not ready yet.");
            }
        }
    }
}

document.querySelector("#connectBtn").addEventListener("click", async () => {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();

    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;
        let lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            handleArduinoData(line.trim());
        }
    }

    reader.releaseLock();
});

/////////////////////////////////////////////////////////////////////////////////////////////////

// Select DOM elements
const fileInput = document.querySelector("#fileInput"); 
const playBtn = document.querySelector("#mainPlayBtn");
const volumeSlider = document.querySelector("#vol-slider-one");
const volumeProgress = document.querySelector(".volume-slider .progress");
const volumeIcon = document.querySelector(".volume-icon");


let volumeMuted = false;
let isScrubbing = false;


const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const crossFadeGainLeft = audioContext.createGain();
const crossFadeGainRight = audioContext.createGain();

// Initialize Wavesurfer
const wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: 'rgb(200, 0, 200)',
    progressColor: 'rgb(100, 0, 100)',
    minPxPerSec: 100,
    plugins: [TimelinePlugin.create()],
    webAudio: { audioContext: audioContext },

});


let trackOneCurrBPM = null; 

// Handle file selection
fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0]; 
    if (file && file.type.startsWith("audio/")) {
        const objectURL = URL.createObjectURL(file); 
        wavesurfer.load(objectURL); 


        const beatDetect = new BeatDetect({
            sampleRate: 44100, // Most track are using this sample rate
            log: false, // Debug BeatDetect execution with logs
            perf: false, // Attach elapsed time to result object
            round: false, // To have an integer result for the BPM
            float: 4, // The floating precision in [1, Infinity]
            lowPassFreq: 150, // Low pass filter cut frequency
            highPassFreq: 100, // High pass filter cut frequency
            bpmRange: [90, 180], // The BPM range to output
            timeSignature: 4 // The number of beat in a measure
          });

          const bpm = document.getElementById("bpm-one");
          beatDetect.getBeatInfo({
            url: objectURL,
          }).then(info => {
            console.log(info.bpm); // 140
            console.log(info.offset); // 0.1542
            console.log(info.firstBar); // 0.1.8722
            bpm.innerHTML = "BPM: " + info.bpm;
            trackOneCurrBPM = info.bpm; 
          }).catch(error => {
            // The error string
          });
    }
});

// Play/Pause Button Logic
playBtn.addEventListener("click", () => {
    wavesurfer.playPause();
});

// Update button state when playback starts or stops
wavesurfer.on("play", () => {
    playBtn.innerHTML = `<span class="material-symbols-outlined">pause</span>`;
});

wavesurfer.on("pause", () => {
    playBtn.innerHTML = `<span class="material-symbols-outlined">play_arrow</span>`;
});

// Reset track position when finished
wavesurfer.on("finish", () => {
    wavesurfer.setTime(0);
    playBtn.innerHTML = `<span class="material-symbols-outlined">play_arrow</span>`;
});



  volumeSlider.addEventListener("input", (event) => {
    const volume = event.target.value / 100; // Convert to range 0.0 - 1.0
    wavesurfer.setVolume(volume);
    volumeProgress.style.width = `${event.target.value}%`; // Update progress bar
});

// Mute/Unmute Logic
volumeIcon.addEventListener("click", () => {
    if (!volumeMuted) {
        wavesurfer.setVolume(0);
        volumeProgress.style.width = "0%";
        volumeIcon.innerHTML = `<span class="material-symbols-outlined">volume_off</span>`;
        volumeMuted = true;
    } else {
        wavesurfer.setVolume(0.5);
        volumeProgress.style.width = "50%";
        volumeIcon.innerHTML = `<span class="material-symbols-outlined">volume_down</span>`;
        volumeMuted = false;
    }
});




// Select DOM elements
const fileInputTwo = document.querySelector("#fileInput-two"); 
const playBtnTwo = document.querySelector("#mainPlayBtn-two");
const volumeSliderTwo = document.querySelector("#vol-slider-two");
const volumeProgressTwo = document.querySelector(".volume-slider-two .progress-two");
const volumeIconTwo = document.querySelector(".volume-icon-two");


let volumeMutedTwo = false;
//let isScrubbing = false;


// Initialize Wavesurfer
const wavesurferTwo = WaveSurfer.create({
    container: '#waveform-two',
    waveColor: 'rgb(200, 0, 200)',
    progressColor: 'rgb(100, 0, 100)',
    minPxPerSec: 100,
    plugins: [TimelinePlugin.create()],
    webAudio: { audioContext: audioContext },

});

let trackTwoCurrBPM = null; 

// Handle file selection
fileInputTwo.addEventListener("change", (event) => {
    const file = event.target.files[0]; 
    if (file && file.type.startsWith("audio/")) {
        const objectURL = URL.createObjectURL(file); 
        wavesurferTwo.load(objectURL); 


        const beatDetect = new BeatDetect({
            sampleRate: 44100, // Most track are using this sample rate
            log: false, // Debug BeatDetect execution with logs
            perf: false, // Attach elapsed time to result object
            round: false, // To have an integer result for the BPM
            float: 4, // The floating precision in [1, Infinity]
            lowPassFreq: 150, // Low pass filter cut frequency
            highPassFreq: 100, // High pass filter cut frequency
            bpmRange: [90, 180], // The BPM range to output
            timeSignature: 4 // The number of beat in a measure
          });

          const bpm = document.getElementById("bpm-two");
          beatDetect.getBeatInfo({
            url: objectURL,
          }).then(info => {
            console.log(info.bpm); 
            console.log(info.offset); 
            console.log(info.firstBar); // 0.1.8722
            bpm.innerHTML = "BPM: " + info.bpm;
            trackTwoCurrBPM = info.bpm;
            wavesurfer.options.metadata = { firstBar: info.firstBar }; // for left
            wavesurferTwo.options.metadata = { firstBar: info.firstBar }; // for right

          }).catch(error => {
          });
    }
});

// Play/Pause Button Logic
playBtnTwo.addEventListener("click", () => {
    wavesurferTwo.playPause();
});

// Update button state when playback starts or stops
wavesurferTwo.on("play", () => {
    playBtnTwo.innerHTML = `<span class="material-symbols-outlined">pause</span>`;
});

wavesurferTwo.on("pause", () => {
    playBtnTwo.innerHTML = `<span class="material-symbols-outlined">play_arrow</span>`;
});

wavesurferTwo.on("finish", () => {
    wavesurferTwo.setTime(0);
    playBtnTwo.innerHTML = `<span class="material-symbols-outlined">play_arrow</span>`;
});


  
    

  volumeSliderTwo.addEventListener("input", (event) => {
    const volume = event.target.value / 100; 
    wavesurferTwo.setVolume(volume);
});

volumeIconTwo.addEventListener("click", () => {
    if (!volumeMutedTwo) {
        wavesurferTwo.setVolume(0);
        volumeProgressTwo.style.width = "0%";
        volumeIconTwo.innerHTML = `<span class="material-symbols-outlined">volume_off</span>`;
        volumeMutedTwo = true;
    } else {
        wavesurferTwo.setVolume(0.5);
        volumeProgressTwo.style.width = "50%";
        volumeIconTwo.innerHTML = `<span class="material-symbols-outlined">volume_down</span>`;
        volumeMutedTwo = false;
    }
});


function updateFader(value) {
    const leftGain = (100 - value) / 100;  // 0 when fader is 100, 1 when fader is 0
    const rightGain = value / 100;         // 1 when fader is 100, 0 when fader is 0

    crossFadeGainLeft.gain.setValueAtTime(leftGain, audioContext.currentTime);
    crossFadeGainRight.gain.setValueAtTime(rightGain, audioContext.currentTime);
}

function setupTrack(mediaElement, gainNode, defaultHigh = 20, defaultLow = 5000) {
    const source = audioContext.createMediaElementSource(mediaElement);

    // High-pass filter
    const highPass = audioContext.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.setValueAtTime(defaultHigh, audioContext.currentTime);

    // Low-pass filter
    const lowPass = audioContext.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(defaultLow, audioContext.currentTime);

    // Connect filters in series: source → highPass → lowPass → gain → destination
    source.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(gainNode);
    gainNode.connect(audioContext.destination);

    return { source, highPass, lowPass };
}

// Initialize tracks once both are ready
Promise.all([
    new Promise(resolve => wavesurfer.on('ready', resolve)),
    new Promise(resolve => wavesurferTwo.on('ready', resolve))
]).then(() => {
    console.log("AudioContext initialized:", audioContext);

    const mediaNodeLeft = wavesurfer.getMediaElement();
    const mediaNodeRight = wavesurferTwo.getMediaElement();

    if (mediaNodeLeft && mediaNodeRight) {
        // Setup both tracks with filters + gain nodes
        ({ highPass: filterLeft, lowPass: lowFilterLeft } = setupTrack(mediaNodeLeft, crossFadeGainLeft));
        ({ highPass: filterRight, lowPass: lowFilterRight } = setupTrack(mediaNodeRight, crossFadeGainRight));
        // Crossfader logic
        updateFader(50); // Default to center

        const crossfader = document.getElementById("crossfader");
        if (crossfader) {
            crossfader.addEventListener("input", (event) => {
                updateFader(event.target.value);
            });
        } else {
            console.error("Error: Crossfader element not found.");
        }
// High-pass knobs (normal)
const filterKnobLeft = document.getElementById('filter-knob-left');
if (filterKnobLeft) {
    filterKnobLeft.addEventListener("input", () => {
        const freq = parseFloat(filterKnobLeft.value);
        filterLeft.frequency.setValueAtTime(freq, audioContext.currentTime);
    });
}

const filterKnobRight = document.getElementById('filter-knob-right');
if (filterKnobRight) {
    filterKnobRight.addEventListener("input", () => {
        const freq = parseFloat(filterKnobRight.value);
        filterRight.frequency.setValueAtTime(freq, audioContext.currentTime);
    });
}

// Low-pass knobs (FLIPPED)
const lowKnobLeft = document.getElementById('low-knob-left');
if (lowKnobLeft) {
    lowKnobLeft.addEventListener("input", () => {
        const minFreq = 20;
        const maxFreq = 5000;
        const rawValue = parseFloat(lowKnobLeft.value);
        const invertedValue = maxFreq - (rawValue - minFreq);
        lowFilterLeft.frequency.setValueAtTime(invertedValue, audioContext.currentTime);
    });
}

const lowKnobRight = document.getElementById('low-knob-right');
if (lowKnobRight) {
    lowKnobRight.addEventListener("input", () => {
        const minFreq = 20;
        const maxFreq = 5000;
        const rawValue = parseFloat(lowKnobRight.value);
        const invertedValue = maxFreq - (rawValue - minFreq);
        lowFilterRight.frequency.setValueAtTime(invertedValue, audioContext.currentTime);
    });
}
    } else {
        console.error("Error: Could not get media elements.");
    }
});



//matching BPMS via sync button 
const syncOne = document.querySelector(".sync-button-one");
const syncTwo = document.querySelector(".sync-button-two");

async function syncTrackLeft() {
    console.log(`Track 1 BPM: ${trackOneCurrBPM}, Track 2 BPM: ${trackTwoCurrBPM}`);

    if (!trackOneCurrBPM || !trackTwoCurrBPM) {
        console.error("BPM not available for both tracks.");
        return;
    }

    // Match tempo
    const playbackRate = trackTwoCurrBPM / trackOneCurrBPM;
    wavesurfer.setPlaybackRate(playbackRate);
    trackOneCurrBPM = trackTwoCurrBPM;

    // Align beats
    const barOffset1 = parseFloat(wavesurfer.options.metadata?.firstBar || 0);
    const barOffset2 = parseFloat(wavesurferTwo.options.metadata?.firstBar || 0);
    const currentTime = wavesurferTwo.getCurrentTime();
    const timeDiff = barOffset2 - barOffset1;

    // Adjust first track to match second track’s current beat
    wavesurfer.setTime(currentTime + timeDiff);

    // Update BPM label
    bpmLabelL.innerHTML = "BPM: " + trackTwoCurrBPM;
}

async function syncTrackRight() {
    console.log(`Track 1 BPM: ${trackOneCurrBPM}, Track 2 BPM: ${trackTwoCurrBPM}`);

    if (!trackOneCurrBPM || !trackTwoCurrBPM) {
        console.error("BPM not available for both tracks.");
        return;
    }

    // Tempo sync
    const rate = trackOneCurrBPM / trackTwoCurrBPM;
    wavesurferTwo.setPlaybackRate(rate);
    trackTwoCurrBPM = trackOneCurrBPM;

    // Beat alignment
    const offset1 = wavesurfer.getCurrentTime(); // Assume already playing from beat
    const offset2 = wavesurferTwo.getCurrentTime(); // Get current position of track 2

    const beatOffset1 = parseFloat(wavesurfer.options.metadata?.firstBar || 0); // Add this metadata
    const beatOffset2 = parseFloat(wavesurferTwo.options.metadata?.firstBar || 0); // Add this metadata

    const delta = (beatOffset1 - beatOffset2); // how much to shift track 2

    const newStart = offset1 + delta;
    wavesurferTwo.setTime(newStart);

    bpmLabelR.innerHTML = "BPM: " + trackOneCurrBPM;
}

 const bpmLabelL = document.querySelector("#bpm-one");
 const bpmLabelR = document.querySelector("#bpm-two");



syncOne.addEventListener("click", () => {
    syncTrackRight();
    
    // Delay updating the BPM label (e.g 500ms = 0.5s)
    setTimeout(() => {
        bpmLabelR.innerHTML = "BPM: " + trackOneCurrBPM;
    }, 1000);
});

syncTwo.addEventListener("click", () => {
    syncTrackLeft();
    
    // Delay updating the BPM label (e.g 500ms = 0.5s)
    setTimeout(() => {
        console.log("set BPM Left")
        bpmLabelL.innerHTML = "BPM: " + trackTwoCurrBPM;
    }, 1000);
});

let loopActiveLeft = false;
let loopActiveRight = false;
let loopIntervalLeft;
let loopIntervalRight;
let loopStartTimeLeft = 0;
let loopStartTimeRight = 0;

function startLoop(wavesurferInstance, bpm, bars, side) {
    if (!bpm) {
        console.error("BPM is not detected!");
        return;
    }

    const beatDuration = 60 / bpm;
    const beatsPerBar = 4;
    const loopDuration = beatDuration * beatsPerBar * bars;
    const startTime = wavesurferInstance.getCurrentTime();

    console.log(`Looping ${bars} bars from ${startTime}s to ${startTime + loopDuration}s`);

    const interval = setInterval(() => {
        if (wavesurferInstance.getCurrentTime() >= startTime + loopDuration) {
            wavesurferInstance.setTime(startTime);
        }
    }, 100);

    if (side === "left") {
        loopActiveLeft = true;
        loopStartTimeLeft = startTime;
        loopIntervalLeft = interval;
    } else if (side === "right") {
        loopActiveRight = true;
        loopStartTimeRight = startTime;
        loopIntervalRight = interval;
    }
}

function stopLoop(side) {
    if (side === "left") {
        clearInterval(loopIntervalLeft);
        loopActiveLeft = false;
        console.log("Stopped left loop.");
    } else if (side === "right") {
        clearInterval(loopIntervalRight);
        loopActiveRight = false;
        console.log("Stopped right loop.");
    }
}

const loopDurations = {
    "1/4": 0.25,
    "1/2": 0.5,
    "1": 1,
    "4": 4,
    "8": 8,
    "16": 16
};

document.querySelectorAll(".left-control .music-control").forEach(btn => {
    const label = btn.innerText.trim();
    btn.addEventListener("click", () => {
        if (!loopActiveLeft) {
            startLoop(wavesurfer, trackOneCurrBPM, loopDurations[label], "left");
        } else {
            stopLoop("left");
        }
    });
});

document.querySelectorAll(".right-control .music-control").forEach(btn => {
    const label = btn.innerText.trim();
    btn.addEventListener("click", () => {
        if (!loopActiveRight) {
            startLoop(wavesurferTwo, trackTwoCurrBPM, loopDurations[label], "right");
        } else {
            stopLoop("right");
        }
    });
});



//This coe is more recent, I was looking into how I can implement a record scratch....

function setupScratchDisk(diskId, wavesurferInstance) {
    const disk = document.getElementById(diskId);
    let isScratching = false;
    let lastAngle = 0;

    function getAngleFromCenter(x, y, element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return Math.atan2(y - centerY, x - centerX); //obvi need this
    }

    function startScratch(e) {
        isScratching = true;
        lastAngle = getAngleFromCenter(
            e.clientX || e.touches[0].clientX,
            e.clientY || e.touches[0].clientY,  //this logic confused me at first, but these are event classes 
            disk
        );
        e.preventDefault();
        disk.style.cursor = "grabbing";
    }

    function doScratch(e) {
        if (!isScratching) return;
    
        const angle = getAngleFromCenter(
            e.clientX || e.touches[0].clientX,
            e.clientY || e.touches[0].clientY,
            disk
        );
    
        const angleDiff = angle - lastAngle;
        lastAngle = angle;
    
        const maxRate = 3;
        const minRate = -3;
        let rate = 1 + angleDiff * 8; // base around 1, not 0
        rate = Math.max(0.1, Math.min(4, rate)); // legal range
        console.log(`Applying rate: ${rate.toFixed(2)}`);
        wavesurferInstance.setPlaybackRate(rate);
    
        // Force play for effect to be audible
        if (!wavesurferInstance.isPlaying()) {
            wavesurferInstance.play();
        }
    
        clearTimeout(wavesurferInstance._scratchTimeout);
        wavesurferInstance._scratchTimeout = setTimeout(() => {
            wavesurferInstance.setPlaybackRate(1.0);
            //wavesurferInstance.pause();
        }, 300);
    
        // Visual spin
        const degrees = angle * (180 / Math.PI);
        disk.style.transform = `rotate(${degrees}deg)`;
    
        e.preventDefault();
    }

    function stopScratch() {
        isScratching = false;
        disk.style.cursor = "grab";
    }

    disk.addEventListener("mousedown", startScratch);
    document.addEventListener("mousemove", doScratch);
    document.addEventListener("mouseup", stopScratch);

    disk.addEventListener("touchstart", startScratch, { passive: false });
    document.addEventListener("touchmove", doScratch, { passive: false });
    document.addEventListener("touchend", stopScratch);
}

window.addEventListener("DOMContentLoaded", () => {
    setupScratchDisk("scratch-disk-left", wavesurfer);
    setupScratchDisk("scratch-disk-right", wavesurferTwo);
});