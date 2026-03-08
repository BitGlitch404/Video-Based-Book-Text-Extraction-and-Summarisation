let isZoomMode = false;
let zoomStart = 0; // 0%
let zoomEnd = 100; // 100%
let selectingZoom = false;
let selectionStartY = 0;
const TRACK_PADDING = 5;

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
    const top = TRACK_PADDING + (relativePercentage / 100) * usableHeight;
    marker.style.top = `${top}px`;
}






// Get all selected timestamps in seconds (sorted)
function getSelectedTimestamps() {
    if (!video.duration) return [];
    return markers
        .map(m => (m.percentage / 100) * video.duration)
        .sort((a, b) => a - b);
}

// Dragging logic
document.addEventListener('mousemove', (e) => {
    if (!isDragging || !draggedMarker) return;

    const rect = scrubber.getBoundingClientRect();
    const usableHeight = rect.height - (TRACK_PADDING * 2);
    const offsetY = e.clientY - rect.top - TRACK_PADDING; // center marker

    let percentage = (offsetY / usableHeight) * 100;
    percentage = Math.max(0, Math.min(100, percentage));

    updateMarkerPosition(draggedMarker, percentage);
    updateUI();

     // --- NEW: Live sync video while dragging ---
    if (video.duration) {
        video.currentTime = (percentage / 100) * video.duration;
    }
});

document.addEventListener('mouseup', (e) => {

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
            
            resetBtn.style.display = 'block';
            isZoomMode = false;
            zoomBtn.style.background = "#333";
            zoomBtn.textContent = "🔍 Zoom Tool";
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

    const rect = scrubber.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    if (isZoomMode) {
        selectingZoom = true;
        selectionStartY = clickY;
        zoomSelectionDiv.style.display = 'block';
        zoomSelectionDiv.style.top = `${clickY}px`;
        zoomSelectionDiv.style.height = '0px';
    } else {

        if (e.target !== scrubber && e.target !== track) return;

        const usableHeight = rect.height - (TRACK_PADDING * 2);
        const offsetY = e.clientY - rect.top - TRACK_PADDING;

        let percentage = (offsetY / usableHeight) * 100;
        percentage = Math.max(0, Math.min(100, percentage));

        createMarker(percentage);

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
    continueBtn.textContent = "OCR Complete ✓";
    timestampList.innerHTML = "<h3>Analysis Complete</h3>";
    
    // Add Download Button with a little icon
    const dlBtn = document.createElement('button');
    dlBtn.innerHTML = "<span>📄</span> Download Result PDF"; // Added an icon
    dlBtn.className = "download-style"; 
    dlBtn.onclick = () => window.open(`http://127.0.0.1:5000${data.pdf_url}`);
    
    timestampList.appendChild(dlBtn);

    data.results.forEach(item => {
        const div = document.createElement('div');
        div.className = "result-item"; // Add CSS for this
        div.innerHTML = `<strong>${item.timestamp}s:</strong> <p>${item.text}</p>`;
        timestampList.appendChild(div);
    });
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

// Drag & Drop video
const app = document.querySelector('.app');

app.addEventListener('dragover', (e) => {
    e.preventDefault();
    app.style.background = 'rgba(0, 170, 255, 0.1)';
});

app.addEventListener('dragleave', () => {
    app.style.background = '';
});



// --- SHARPNESS CALCULATION HELPERS ---

/**
 * Calculates Laplacian Variance of a frame to determine sharpness.
 * Higher value = sharper image.
 */
async function getFrameSharpness(videoElement, time) {
    return new Promise((resolve) => {
        videoElement.currentTime = time;
        
        // Wait for frame to seek
        videoElement.addEventListener('seeked', () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = videoElement.videoWidth / 4; // Downscale for speed
            canvas.height = videoElement.videoHeight / 4;
            
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const width = imageData.width;
            const height = imageData.height;

            // Simple Laplacian Kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
            let laplacianSum = 0;
            let laplacianSqSum = 0;
            const pixelCount = width * height;

            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    // Greyscale conversion (standard weights)
                    const val = data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114;
                    
                    // Neighbors
                    const up = (data[((y-1)*width + x)*4]) * 0.299;
                    const down = (data[((y+1)*width + x)*4]) * 0.299;
                    const left = (data[(y*width + (x-1))*4]) * 0.299;
                    const right = (data[(y*width + (x+1))*4]) * 0.299;

                    const lap = up + down + left + right - (4 * val);
                    laplacianSum += lap;
                    laplacianSqSum += (lap * lap);
                }
            }

            // Variance = E[X^2] - (E[X])^2
            const variance = (laplacianSqSum / pixelCount) - Math.pow(laplacianSum / pixelCount, 2);
            resolve(variance);
        }, { once: true });
    });
}

/**
 * Auto-selects sharp frames every 2 seconds
 */
async function autoSelectSharpFrames(threshold = 50) {
    const duration = video.duration;
    const interval = 2.0;
    
    // Clear existing markers
    markers.forEach(m => scrubber.removeChild(m.element));
    markers = [];

    for (let t = 0; t < duration; t += interval) {
        let bestTime = t;
        let maxSharpness = await getFrameSharpness(video, t);

        // If below threshold, check +/- 0.1s, then +/- 0.2s, up to +/- 0.5s
        if (maxSharpness < threshold) {
            console.log(`Frame at ${t}s blurry (${maxSharpness.toFixed(2)}). Searching...`);
            const offsets = [0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.4, -0.4, 0.5, -0.5];
            
            for (let offset of offsets) {
                let checkTime = Math.max(0, Math.min(duration, t + offset));
                let s = await getFrameSharpness(video, checkTime);
                if (s > maxSharpness) {
                    maxSharpness = s;
                    bestTime = checkTime;
                }
                if (maxSharpness >= threshold) break; // Found a "good enough" frame
            }
        }

        // Add marker at the best time found
        const percentage = (bestTime / duration) * 100;
        createMarker(percentage);
    }
}

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
    
            await autoSelectSharpFrames(60); 
    
            dragMessage.style.display = 'none';
    }, { once: true });
    }
});
