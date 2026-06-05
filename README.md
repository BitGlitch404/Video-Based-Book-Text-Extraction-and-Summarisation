# Video-Based Text Extraction & Document Synthesis System

An intelligent desktop multimedia analysis suite designed to automatically process instructional videos (e.g., recorded slideshow presentation lectures, tutorials) and extract structured textual assets. 

The application utilizes a lightweight frontend computer vision pipeline via the browser canvas API to identify layout state changes, delivers frame arrays asynchronously to a Python Flask API, and translates graphical text data into downloadable, structured document formats paired with an NLP-driven summarization brief.

> **Academic Project Note:** This software suite was developed as an academic engineering prototype. It serves to explore the intersections of client-side video frame metrics, local Optical Character Recognition (OCR), layout-aware document modeling, and localized text summarization.

---

## System Architecture & Pipeline

The execution pipeline operates across a divided architectural topology:
1. **Frontend Computer Vision Filtering:** To preserve memory bandwidth, the video stream is downsampled directly onto an HTML5 Canvas workspace environment. Frames are run through single-pass calculations mapping inter-frame spatial differences (motion) and pixel matrix value variations (sharpness) before being compiled into marker arrays.
2. **Backend Document Extraction Engine:** The backend receives structural image payloads alongside targeted timestamps. It processes the raw pixels using adaptive binarization thresholding algorithms before extracting data streams using Tesseract cluster distributions.

---

##  Interactive Timeline Zoom Control Logic

To maximize temporal selection accuracy, the application features a non-destructive multi-scale scrubbing timeline. The zoom framework uses a dual-point boundary selection workflow:

1. **Activation:** The user toggles the **Zoom Tool** button to switch the mouse pointer context from marker generation into range selection mode.
2. **Dual-Point Definition:** The user performs a click-and-drag action across the vertical scrubber track. 
   * **Point A (First Contact):** Defines the upper temporal ceiling boundary matrix position ($Y_1$).
   * **Point B (Release Position):** Defines the lower temporal floor boundary matrix position ($Y_2$).
3. **Execution:** The layout algorithm captures the geometric region between these two specific coordinates, scales the timeline tracking space, and dynamically regenerates the background thumbnail filmstrip to display only the slice of time contained within that range.
4. **Reset:** Clicking the **Back** action button restores the tracking layout window to the absolute boundary constraints ($0\%$ to $100\%$) of the complete video file.

---

##  Installation & Local Environment Setup

### 1. Prerequisites
* **Python:** Version 3.10 or greater.
* **Tesseract OCR Engine:** Installed locally on the host machine.
* **Web Browser:** Modern browser environment supporting advanced HTML5 Canvas and structural element processing (Chrome, Edge, Firefox, or Safari).

### 2. Dependency Resolution
Install the required system Python libraries using `pip`:
```bash
pip install flask flask-cors opencv-python numpy pytesseract fpdf python-docx sumy nltk
```
## Tesseract Directory Path Assignment

The core API communicates with Tesseract via an explicit file path link inside app.py. Ensure the pointer maps correctly to your platform's executable location:

Windows (Default): ```C:\Program Files\Tesseract-OCR\tesseract.exe```

Linux/macOS: Update the path value configuration programmatically:
```
pytesseract.pytesseract.tesseract_cmd = r'/usr/bin/tesseract'
```

## Running the Project
Run the backend API layer server instance to open a listening channel on localhost:5000:

```Bash
python app.py
```
Open the UI platform layer directly by executing index.html via a browser engine or through any local server development extension.

## Known Issues & Current Project Constraints
This implementation is an academic engineering prototype designed to evaluate structural methodologies. In its current phase, it exhibits the following known operational boundaries and technical challenges:

### 1. OCR Accuracy Limitations
Text components extracted via Tesseract can show character dropping, random symbol injections, or misread text layers. Image preprocessing needs more fixes for better performance.

### 2. Document Layout & Sentence Formatting Errors
Generated .pdf and .docx target files occasionally present erratic word breaks, sentence fragmentation, clipped strings, or messy structural indentations.

### 3. Frame Selection Flaws (Smart Selector Drift)
The automated algorithmic selection engine may miss key presentation transitions or capture blurry, half-rendered slide change movements.

### 4. Deployment Constraints (Localhost Sandbox)
The application can only be accessed locally within a single machine sandbox environment and is not ready for external cloud deployment.

### 5. Media Asset Constraints (Text-Only Format Restrictions)
 The pipeline encounters processing failures or generates corrupted/nonsensical outputs when processing materials containing diagrams, illustrations, charts, or mathematical equations. It is currently optimized exclusively for text-only layouts (similar to standard novels or raw prose documents).
