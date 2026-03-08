import cv2
import os
import numpy as np
import pytesseract
from fpdf import FPDF
from pathlib import Path
import shutil

class VideoOCRPipeline:
    def __init__(self, video_path, tesseract_path, sharpness_threshold=100):
        self.video_path = video_path
        self.sharpness_threshold = sharpness_threshold
        self.extracted_folder = Path("Extracted")
        self.extracted_times = []
        self.extracted_frames = []
        
        # Initialize Tesseract
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
        self.tess_config = r'--oem 1 --psm 3 -c tessedit_char_whitelist=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-—"\' '

    def calculate_sharpness(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return cv2.Laplacian(gray, cv2.CV_64F).var()
    
    def frames_are_similar(self, frame1, frame2, threshold=0.95):
        if frame1 is None or frame2 is None: return False
        f1 = cv2.resize(cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY), (100, 100))
        f2 = cv2.resize(cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY), (100, 100))
        correlation = np.corrcoef(f1.flatten(), f2.flatten())[0, 1]
        return correlation > threshold

    def find_sharp_frame(self, cap, target_time):
        fps = cap.get(cv2.CAP_PROP_FPS)
        search_range, step = 0.5, 0.1
        candidates = []
        
        times_to_check = [target_time]
        for offset in np.arange(step, search_range + step, step):
            times_to_check.extend([target_time - offset, target_time + offset])
        
        for time in times_to_check:
            if time < 0: continue
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(time * fps))
            ret, frame = cap.read()
            if ret:
                sharpness = self.calculate_sharpness(frame)
                candidates.append((time, frame, sharpness))
        
        candidates.sort(key=lambda x: x[2], reverse=True)
        
        for time, frame, sharpness in candidates:
            if sharpness >= self.sharpness_threshold:
                if not any(self.frames_are_similar(frame, prev) for prev in self.extracted_frames):
                    return time, frame, sharpness
        return None, None, 0

    def extract_frames(self):
        if self.extracted_folder.exists():
            shutil.rmtree(self.extracted_folder)
        self.extracted_folder.mkdir()
        
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened(): return False
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps
        
        interval, current_time, frame_count = 2.0, 0, 0
        
        while current_time < duration:
            actual_time, frame, sharpness = self.find_sharp_frame(cap, current_time)
            if frame is not None:
                frame_count += 1
                filepath = self.extracted_folder / f"frame_{frame_count:04d}.jpg"
                cv2.imwrite(str(filepath), frame)
                self.extracted_times.append(actual_time)
                self.extracted_frames.append(frame)
                print(f"✓ Extracted frame {frame_count} at {actual_time:.2f}s")
            current_time += interval
            
        cap.release()
        return frame_count > 0

    def preprocess_for_tesseract(self, img):
        """Your high-accuracy preprocessing logic"""
        # 1. Upscale
        img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        # 2. Sharpen
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
        img = cv2.filter2D(img, -1, kernel)
        # 3. Threshold
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                       cv2.THRESH_BINARY, 31, 20)
        return thresh

    def process_ocr(self, output_pdf="output.pdf"):
        images = sorted(self.extracted_folder.glob("*.jpg"))
        if not images: return False
        
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        
        for idx, img_path in enumerate(images):
            print(f"OCR Processing {img_path.name}...")
            img = cv2.imread(str(img_path))
            
            # Apply your custom preprocessing
            processed_img = self.preprocess_for_tesseract(img)
            
            # Extract text using Tesseract
            text = pytesseract.image_to_string(processed_img, config=self.tess_config)
            
            pdf.add_page()
            # Header
            pdf.set_font("Arial", 'B', 14)
            pdf.cell(0, 10, f"Page {idx+1} (Video time: {self.extracted_times[idx]:.2f}s)", ln=True, align='C')
            pdf.ln(5)
            
            # Body
            pdf.set_font("Arial", size=11)
            if text.strip():
                try:
                    pdf.multi_cell(0, 6, text)
                except:
                    pdf.multi_cell(0, 6, text.encode('ascii', 'ignore').decode())
            else:
                pdf.cell(0, 10, "[No text detected]", ln=True)
                
        pdf.output(output_pdf)
        return True

def main():
    video_path = input("Enter video file path: ").strip().strip('"').strip("'")
    tess_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe' # Update if needed
    
    pipeline = VideoOCRPipeline(video_path, tess_path)
    
    if pipeline.extract_frames():
        if input("\nContinue to OCR? (y/n): ").lower() == 'y':
            out = input("Output filename (output.pdf): ") or "output.pdf"
            pipeline.process_ocr(out)
            print("Done!")

if __name__ == "__main__":
    main()