let isZoomMode = false;
let zoomStart = 0; // 0%
let zoomEnd = 100; // 100%
let selectingZoom = false;
let selectionStartY = 0;
const TRACK_PADDING = 5;

const PDF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 10px; vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="12" y2="15"></line><line x1="9" y1="19" x2="15" y2="19"></line><line x1="9" y1="11" x2="11" y2="11"></line></svg>`;
const DOC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 10px; vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
const AI_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="ai-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12L2.69 15.5"></path><path d="M12 12l9.31 3.5"></path><circle cx="12" cy="12" r="3"></circle></svg>`;


const CONFIG = {
    SAMPLE_EVERY: 5,      // Process every 5th frame
    MOTION_HIGH: 25,      // Skip if too much movement (page turning)
    MOTION_LOW: 3,        // Skip if too little movement (static page)
    SHARPNESS_MIN: 300,   // Minimum variance for text clarity
    COOLDOWN_FRAMES: 75,  // Min frames between saves
    THUMB_W: 160,         // Small width for fast math
    THUMB_H: 90
};

const zoomBtn = document.getElementById('zoomBtn');
const resetBtn = document.getElementById('resetZoom');
const zoomSelectionDiv = document.getElementById('zoomSelection');

const video = document.getElementById('Video');
const scrubber = document.getElementById('Scrubber');
const track = scrubber.querySelector('.scrubberTrack');
const frameCountSpan = document.getElementById('frameCount');
const timestampList = document.getElementById('timestampList');
const continueBtn = document.getElementById('continueBtn');
const leftPanel = document.getElementById('leftPanel');
const centerPanel = document.getElementById('centerPanel');
const rightPanel = document.getElementById('rightPanel');
const dragMessage = document.getElementById('dragMessage');

let markers = []; // Array of { element, percentage }
let isDragging = false;
let draggedMarker = null;
let uploadedFile = null; // To store the dropped file for backend upload

// Create a new yellow thumbnail marker
function createMarker(percentage = 0) {
    const marker = document.createElement('div');
    marker.classList.add('thumbnailMarker');

    // Add close button
    const closeBtn = document.createElement('div');
    closeBtn.classList.add('closeBtn');
    closeBtn.textContent = 'x';
    closeBtn.addEventListener('click', (e) => {
        removeMarker(marker);
        e.stopPropagation();
    });
    marker.appendChild(closeBtn);

    // Position it
    updateMarkerPosition(marker, percentage);

    // Events
    marker.addEventListener('mousedown', (e) => {
        if (e.target === closeBtn) return; // Don't drag if clicking close
        e.preventDefault(); // <--- ADD THIS: Stops browser from "ghost dragging"
        isDragging = true;
        draggedMarker = marker;
        e.stopPropagation();
    });

    scrubber.appendChild(marker);
    markers.push({ element: marker, percentage });
    updateUI();
    return marker;
}

function removeMarker(markerElement) {
    markers = markers.filter(m => m.element !== markerElement);
    scrubber.removeChild(markerElement);
    updateUI();
}

function updateMarkerPosition(marker, percentage) {
    percentage = Math.max(0, Math.min(100, percentage));
    const markerData = markers.find(m => m.element === marker);
    if (markerData) markerData.percentage = percentage;

    const usableHeight = scrubber.offsetHeight - (TRACK_PADDING * 2); // account for marker size + padding
    const top = TRACK_PADDING + (percentage / 100) * usableHeight; // Adjust for centering
    marker.style.top = `${top}px`;
}

function updateUI() {
    frameCountSpan.textContent = markers.length;

    // Update timestamp list
    timestampList.innerHTML = '';
    if (markers.length === 0) {
        timestampList.innerHTML = '<p>No frames selected yet.</p>';
        continueBtn.disabled = true;
        return;
    }

    continueBtn.disabled = false;

    const sorted = [...markers].sort((a, b) => a.percentage - b.percentage);
    sorted.forEach(m => {
        const sec = video.duration ? ((m.percentage / 100) * video.duration).toFixed(2) : '?';
        const item = document.createElement('div');
        item.textContent = `→ ${sec}s`;
        timestampList.appendChild(item);
    });
}

// Toggle Zoom Tool
zoomBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isZoomMode = !isZoomMode;
    zoomBtn.style.background = isZoomMode ? "#00aaff" : "#333";
    zoomBtn.textContent = isZoomMode ? "Cancel Zoom" : "🔍 Zoom Tool";
});

// Reset Zoom to Full Video
resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomStart = 0;
    zoomEnd = 100;
    resetBtn.style.display = 'none';
    refreshAllMarkers();
});

function refreshAllMarkers() {
    markers.forEach(m => {
        // Calculate position relative to current zoom window
        const relativePos = ((m.percentage - zoomStart) / (zoomEnd - zoomStart)) * 100;
        
        // Hide if outside zoom range, show if inside
        if (relativePos < 0 || relativePos > 100) {
            m.element.style.display = 'none';
        } else {
            m.element.style.display = 'flex';
            updateMarkerPosition(m.element, m.percentage);
        }
    });
}

// Updated Position Logic (Modified to handle Zoom)
function updateMarkerPosition(marker, globalPercentage) {
    const relativePercentage = ((globalPercentage - zoomStart) / (zoomEnd - zoomStart)) * 100;
    const usableHeight = scrubber.offsetHeight - (TRACK_PADDING * 2);
    const y = globalPercentToY(globalPercentage);
    marker.style.top = `${y}px`;
    // Hide marker if it's outside the zoomed range
    marker.style.display = (y < 0 || y > scrubber.offsetHeight) ? 'none' : 'flex';
}

// Get all selected timestamps in seconds (sorted)
function getSelectedTimestamps() {
    if (!video.duration) return [];
    return markers
        .map(m => (m.percentage / 100) * video.duration)
        .sort((a, b) => a - b);
}

// Dragging logic
let wasDragging = false; // Flag to prevent click event after drag

document.addEventListener('mousemove', (e) => {
    if (!isDragging || !draggedMarker) return;
    wasDragging = true;

    const rect = scrubber.getBoundingClientRect();

    let y = e.clientY - rect.top;
    y = Math.max(0, Math.min(rect.height, y));
    const globalP = yToGlobalPercent(y);

    const markerData = markers.find(m => m.element === draggedMarker);
    if (markerData) {
        markerData.percentage = globalP;
    }

    updateMarkerPosition(draggedMarker, globalP);
    updateUI();

     // --- NEW: Live sync video while dragging ---
    if (video.duration) {
        video.currentTime = (globalP / 100) * video.duration;
    }
});

document.addEventListener('mouseup', (e) => {

    if (isDragging) {
    isDragging = false;
    draggedMarker = null;
    
    // Use a tiny timeout to reset wasDragging 
    // This ensures the 'click' event fires and sees 'wasDragging = true' before it resets
    setTimeout(() => { wasDragging = false; }, 50); 
    }
    
    
    if (selectingZoom) {
        selectingZoom = false;
        zoomSelectionDiv.style.display = 'none';
        
        const rect = scrubber.getBoundingClientRect();
        const endY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        
        const p1 = (Math.min(selectionStartY, endY) / rect.height) * 100;
        const p2 = (Math.max(selectionStartY, endY) / rect.height) * 100;

        if (Math.abs(p2 - p1) > 2) { // Minimum 2% drag to zoom
            const globalStart = zoomStart + (p1 / 100) * (zoomEnd - zoomStart);
            const globalEnd = zoomStart + (p2 / 100) * (zoomEnd - zoomStart);
            
            zoomStart = globalStart;
            zoomEnd = globalEnd;

            generateFilmstrip(); // Refresh background to match new zoom
            refreshAllMarkers(); // Reposition existing markers

            resetBtn.style.display = 'block';
            isZoomMode = false;
            zoomBtn.style.background = "#333";
            zoomBtn.textContent = "Zoom Tool";
            refreshAllMarkers();
        }
    }
     if (isDragging) {
        isDragging = false;
        draggedMarker = null;
        console.log('Current selected timestamps:', getSelectedTimestamps());
    }
});

// Click on scrubber to add new marker
scrubber.addEventListener('click', (e) => {

    if (wasDragging) return;

    const rect = scrubber.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    if (isZoomMode) {
        selectingZoom = true;
        selectionStartY = clickY;
        zoomSelectionDiv.style.display = 'block';
        zoomSelectionDiv.style.top = `${clickY}px`;
        zoomSelectionDiv.style.height = '0px';
    } else {

        //if (e.target !== scrubber && e.target !== track) return;      before part
        if (!scrubber.contains(e.target)) return;
        
        const usableHeight = rect.height - (TRACK_PADDING * 2);
        const offsetY = e.clientY - rect.top - TRACK_PADDING;

        let percentage = (offsetY / usableHeight) * 100;
        percentage = Math.max(0, Math.min(100, percentage));

        const p = yToGlobalPercent(clickY);
        createMarker(p);

        // --- NEW: Sync video time on click ---
        if (video.duration) {
            video.currentTime = (percentage / 100) * video.duration;
        }
    }
});

// Helper to capture a frame from the video as a Blob
function captureFrameAsBlob(videoElement, time) {
    return new Promise((resolve) => {
        const originalTime = videoElement.currentTime;
        videoElement.currentTime = time;

        videoElement.addEventListener('seeked', () => {
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.95);
        }, { once: true });
    });
}

// Polling function to check status
// script.js

async function pollJobStatus(jobId) {
    console.log(`[LOG 3] Starting Poll Loop for Job: ${jobId}`);
    
    const interval = setInterval(async () => {
        try {
            console.log(`[LOG 4] Fetching status for ${jobId}...`);
            const response = await fetch(`http://127.0.0.1:5000/api/job-status/${jobId}`);
            
            if (!response.ok) {
                console.error(`[LOG 4.1] Server returned error: ${response.status}`);
                return;
            }

            const data = await response.json();
            console.log(`[LOG 5] Status Received:`, data);

            if (data.status === "completed") {
                console.log("[LOG 6] Job Complete! Calling finishOCRUI...");
                clearInterval(interval);
                finishOCRUI(data);
            } else if (data.status === "processing") {
                continueBtn.textContent = `OCR Progress: ${data.progress}%`;
            } else if (data.status === "error") {
                console.error("[LOG 7] Backend reported error:", data.error);
                clearInterval(interval);
                alert("Backend Error: " + data.error);
                resetContinueBtn();
            }
        } catch (err) {
            console.error("[LOG 8] Polling fetch failed (Network issue?):", err);
        }
    }, 2000); 
}

function finishOCRUI(data) {

    continueBtn.disabled = false;
    continueBtn.textContent = "OCR Complete (Do Again?)";
    timestampList.innerHTML = "<h3>Analysis Complete</h3>";
    
    // Add Download Button with a little icon
    const dlPdfBtn = document.createElement('button');
    dlPdfBtn.innerHTML = `${PDF_SVG} Download Result PDF`; // Added an icon
    dlPdfBtn.className = "download-style pdf-btn";
    dlPdfBtn.style.marginBottom = "10px";
    dlPdfBtn.onclick = () => window.open(`http://127.0.0.1:5000${data.pdf_url}`);
    timestampList.appendChild(dlPdfBtn);

    // Add Download Button for DOCX
    const dlDocBtn = document.createElement('button');
    dlDocBtn.innerHTML = `${DOC_SVG} Download Result DOCX`; // Added an icon
    dlDocBtn.className = "download-style doc-btn";
    dlDocBtn.style.marginBottom = "10px";
    dlDocBtn.onclick = () => window.open(`http://127.0.0.1:5000${data.doc_url}`);
    timestampList.appendChild(dlDocBtn);

    const card = document.createElement('div');
    card.className = "ai-summary-card";
    card.innerHTML = `
        <div class="ai-label">
            ${AI_ICON}
            AI Document Insight
        </div>
        <div class="ai-text">
            ${data.summary || "Summary could not be generated."}
        </div>
    `;
    
    timestampList.appendChild(card);
}

function resetContinueBtn() {
    continueBtn.disabled = false;
    continueBtn.textContent = "Continue → OCR";
}

// Main Button Logic
continueBtn.addEventListener('click', async (e) => {
    if (e) e.preventDefault();
    console.log("[LOG 1] Continue Button Clicked");

    const timestamps = getSelectedTimestamps();
    if (timestamps.length === 0) return alert("Select frames first.");

    continueBtn.disabled = true;
    continueBtn.textContent = "Capturing...";

    showAISummaryPlaceholder();
    const formData = new FormData();
    
    try {
        for (let i = 0; i < timestamps.length; i++) {
            const blob = await captureFrameAsBlob(video, timestamps[i]);
            formData.append('images', blob, `frame_${i}.jpg`);
        }
        formData.append('timestamps', JSON.stringify(timestamps));
        
        console.log("[LOG 2] Sending POST request to /api/extract-text");
        const response = await fetch('http://127.0.0.1:5000/api/extract-text', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log("[LOG 2.1] Backend Response for POST:", result);

        if (result.job_id) {
            pollJobStatus(result.job_id);
        } else {
            console.error("[LOG 2.2] No Job ID returned!");
        }
    } catch (err) {
        console.error("[LOG 9] Global Catch Error:", err);
        resetContinueBtn();
    }
});

async function runSmartSelector() {
    const v = document.getElementById('Video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    canvas.width = CONFIG.THUMB_W;
    canvas.height = CONFIG.THUMB_H;

    let prevThumb = null;
    let lastSavedIdx = -CONFIG.COOLDOWN_FRAMES;
    let frameIdx = 0;
    
    const totalFrames = Math.floor(v.duration * 25); // Estimate or use precise metadata
    const frameStep = 1 / 25; // Assuming 25fps video

    // Clear UI
    markers = [];
    scrubber.querySelectorAll('.thumbnailMarker').forEach(m => m.remove());

    // Main Loop: Stepping through video precisely
    while (frameIdx < totalFrames) {
        
        // Gate 0: Sampling skip
        if (frameIdx % CONFIG.SAMPLE_EVERY !== 0) {
            frameIdx++;
            continue;
        }

        // Seek and wait for the frame to be ready
        v.currentTime = frameIdx * frameStep;
        await new Promise(r => v.onseeked = r);

        // 1. Downsample to Thumbnail
        ctx.drawImage(v, 0, 0, CONFIG.THUMB_W, CONFIG.THUMB_H);
        const imageData = ctx.getImageData(0, 0, CONFIG.THUMB_W, CONFIG.THUMB_H);
        const data = imageData.data;
        
        // 2. Single-pass calculation (Grayscale + Variance)
        let sum = 0, sumSq = 0, diffSum = 0;
        const currentThumb = new Uint8Array(CONFIG.THUMB_W * CONFIG.THUMB_H);

        for (let i = 0; i < data.length; i += 4) {
            // Fast grayscale: (R+G+B)/3
            const g = (data[i] + data[i+1] + data[i+2]) / 3;
            const pixelIdx = i / 4;
            currentThumb[pixelIdx] = g;
            
            sum += g;
            sumSq += g * g;

            if (prevThumb) {
                diffSum += Math.abs(g - prevThumb[pixelIdx]);
            }
        }

        const n = currentThumb.length;
        const variance = (sumSq / n) - Math.pow(sum / n, 2);
        const frameDiff = prevThumb ? (diffSum / n) : 999;

        // --- THE GATES (Python Logic) ---
        
        // Gate 1: Motion (Too high = turning, Too low = duplicate)
        if (prevThumb && (frameDiff > CONFIG.MOTION_HIGH || frameDiff < CONFIG.MOTION_LOW)) {
            prevThumb = currentThumb; // Update prev even if skipped to track motion
            frameIdx++;
            continue;
        }

        // Gate 2: Sharpness (Variance)
        if (variance < CONFIG.SHARPNESS_MIN) {
            frameIdx++;
            continue;
        }

        // Gate 3: Cooldown
        if (frameIdx - lastSavedIdx < CONFIG.COOLDOWN_FRAMES) {
            frameIdx++;
            continue;
        }

        // ALL GATES PASSED -> Save Marker
        const percentage = (v.currentTime / v.duration) * 100;
        createMarker(percentage);
        
        lastSavedIdx = frameIdx;
        prevThumb = currentThumb;
        frameIdx++;

        // Update UI progress
        dragMessage.textContent = `Analyzing: ${Math.round((frameIdx/totalFrames)*100)}%`;
    }
}
// Drag & Drop video
const app = document.querySelector('.app');

app.addEventListener('dragover', (e) => {
    e.preventDefault();
    app.style.background = 'rgba(0, 170, 255, 0.1)';
});

app.addEventListener('dragleave', () => {
    app.style.background = '';
});


// --- UPDATED DROP EVENT ---

app.addEventListener('drop', async (e) => {
    e.preventDefault();
    app.style.background = '';

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
        uploadedFile = file;
        const url = URL.createObjectURL(file);
        video.src = url;

        dragMessage.style.display = 'none';
        video.style.display = 'block';
        leftPanel.style.display = 'flex';
        rightPanel.style.display = 'flex';

        video.addEventListener('loadedmetadata', async () => {
            // Reset zoom state for the new video
            zoomStart = 0;
            zoomEnd = 100;
            isZoomMode = false;
            if(resetBtn) resetBtn.style.display = 'none';
    
            updateUI();
    
            dragMessage.textContent = "Analyzing video for sharp frames...";
            dragMessage.style.display = 'block';
    
            await runSmartSelector();
    
            dragMessage.style.display = 'none';

            generateFilmstrip();
    }, { once: true });
    }
});

// Translates a click (Y pixel) to a global video percentage (0-100)
function yToGlobalPercent(y) {
    const rect = scrubber.getBoundingClientRect();
    const localPercent = (y / rect.height) * 100;
    return zoomStart + (localPercent / 100) * (zoomEnd - zoomStart);
}

// Translates a video percentage to a Y pixel coordinate for marker placement
function globalPercentToY(globalP) {
    const rect = scrubber.getBoundingClientRect();
    const relativeP = ((globalP - zoomStart) / (zoomEnd - zoomStart)) * 100;
    return (relativeP / 100) * rect.height;
}

async function generateFilmstrip() {
    if (!video.duration) return;
    track.innerHTML = ''; // Clear the old track line/images
    
    const L = scrubber.offsetHeight;
    const d = 60; // Height of each frame slice in pixels
    const numFrames = Math.ceil(L / d);
    
    // Set track to fill the scrubber
    track.style.width = '100%';
    track.style.left = '0';
    track.style.transform = 'none';
    track.style.display = 'flex';
    track.style.flexDirection = 'column';

    for (let i = 0; i < numFrames; i++) {
        const yTop = i * d;
        const globalP = yToGlobalPercent(yTop);
        const time = (globalP / 100) * video.duration;
        
        // Capture a tiny low-res version for performance
        const imgBlob = await captureFrameAsBlob(video, time); 
        const img = document.createElement('img');
        img.src = URL.createObjectURL(imgBlob);

        img.draggable = false; // <--- ADD THIS LINE
        img.style.userSelect = 'none'; // Prevents highlighting/selecting

        img.style.height = `${d}px`;
        img.style.width = '100%';
        img.style.objectFit = 'cover';
        track.appendChild(img);
    }
}

function updateMarkerPosition(marker, globalPercentage) {
    const y = globalPercentToY(globalPercentage);
    marker.style.top = `${y}px`;
    // Hide marker if it's outside the zoomed range
    marker.style.display = (y < 0 || y > scrubber.offsetHeight) ? 'none' : 'flex';
}

function showAISummaryPlaceholder() {
    timestampList.innerHTML = `
        <div class="ai-summary-container">
            ${AI_ICON}
            <p><strong>AI Document Assistant</strong></p>
            <p class="ai-description">Upload complete. I will summarize your document as soon as OCR is finished.</p>
        </div>
    `;
}