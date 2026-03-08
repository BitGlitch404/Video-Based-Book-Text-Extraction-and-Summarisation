import os, cv2, json, uuid, threading, numpy as np, pytesseract
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from fpdf import FPDF
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
EXTRACTED_FOLDER = 'Extracted'
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

for f in [UPLOAD_FOLDER, EXTRACTED_FOLDER]: os.makedirs(f, exist_ok=True)

# Store job states in memory
jobs = {}

def process_ocr_task(job_id, image_paths, timestamps):
    try:
        pdf = FPDF()
        results = []
        total = len(image_paths)
        
        for idx, img_path in enumerate(image_paths):
            img = cv2.imread(img_path)
            # --- Preprocessing ---
            img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            processed = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 20)
            
            text = pytesseract.image_to_string(processed, config='--oem 1 --psm 3')
            
            # CLEANING STEP: Replace common problematic characters
            clean_text = text.strip()
            clean_text = clean_text.replace('\u2018', "'").replace('\u2019', "'") # Smart quotes
            clean_text = clean_text.replace('\u201c', '"').replace('\u201d', '"') # Smart double quotes
            clean_text = clean_text.replace('\u2013', '-').replace('\u2014', '-') # Dashes

            # FINAL SAFETY: Force to Latin-1, ignoring anything else
            safe_text = clean_text.encode('latin-1', 'ignore').decode('latin-1')
            
            ts = timestamps[idx] if idx < len(timestamps) else idx
            results.append({"timestamp": f"{float(ts):.2f}", "text": safe_text})

            pdf.add_page()
            pdf.set_font("Arial", 'B', 12)
            pdf.cell(0, 10, txt=f"Timestamp: {ts}s", ln=1)
            pdf.set_font("Arial", size=10)
            
            # Use the safe_text here
            pdf.multi_cell(0, 5, txt=safe_text if safe_text else "[No readable text detected]")
            
            # Update Progress
            jobs[job_id]["progress"] = int(((idx + 1) / total) * 100)

        pdf_output = os.path.join(UPLOAD_FOLDER, f"result_{job_id}.pdf")
        pdf.output(pdf_output)
        
        jobs[job_id].update({
            "status": "completed",
            "results": results,
            "pdf_url": f"/api/download-pdf/{job_id}"
        })
    except Exception as e:
        jobs[job_id].update({"status": "error", "error": str(e)})
    
    print(f"--- Job {job_id} Finished. Results: {len(results)} ---")

@app.route('/api/extract-text', methods=['POST'])
def start_ocr():
    if 'images' not in request.files:
        return jsonify({"error": "No images uploaded"}), 400
    
    job_id = str(uuid.uuid4())
    images = request.files.getlist('images')
    timestamps = json.loads(request.form.get('timestamps', '[]'))
    
    saved_paths = []
    for img in images:
        path = os.path.join(EXTRACTED_FOLDER, f"{job_id}_{secure_filename(img.filename)}")
        img.save(path)
        saved_paths.append(path)

    jobs[job_id] = {"status": "processing", "progress": 0}
    
    # Run in background
    thread = threading.Thread(target=process_ocr_task, args=(job_id, saved_paths, timestamps))
    thread.start()

    return jsonify({"job_id": job_id})

@app.route('/api/job-status/<job_id>')
def get_status(job_id):
    status_data = jobs.get(job_id, {"status": "not_found"})
    print(f"[PY LOG] Job {job_id} requested. Current status: {status_data.get('status')} - Progress: {status_data.get('progress')}%")
    return jsonify(status_data)

@app.route('/api/download-pdf/<job_id>')
def download_pdf(job_id):
    return send_file(os.path.join(UPLOAD_FOLDER, f"result_{job_id}.pdf"), as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True, port=5000)