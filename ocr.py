import cv2
import os
import numpy as np
from paddleocr import PaddleOCR
from fpdf import FPDF
from pathlib import Path
import shutil

class VideoOCRPipeline:
    def __init__(self, video_path, sharpness_threshold=100):
        self.video_path = video_path
        self.sharpness_threshold = sharpness_threshold
        self.extracted_folder = Path("Extracted")
        self.extracted_times = []
        self.extracted_frames = []
        
        # Initialize OCR
        print("Initializing OCR model (this may take a moment)...")
        self.ocr = PaddleOCR(use_textline_orientation=True, lang='en')
        
    def calculate_sharpness(self, image):
        """Calculate sharpness using Laplacian variance"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        return laplacian_var
    
    def frames_are_similar(self, frame1, frame2, threshold=0.95):
        """Check if two frames are similar using structural similarity"""
        if frame1 is None or frame2 is None:
            return False
        
        # Resize for faster comparison
        frame1_small = cv2.resize(frame1, (100, 100))
        frame2_small = cv2.resize(frame2, (100, 100))
        
        # Convert to grayscale
        gray1 = cv2.cvtColor(frame1_small, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(frame2_small, cv2.COLOR_BGR2GRAY)
        
        # Calculate correlation
        correlation = np.corrcoef(gray1.flatten(), gray2.flatten())[0, 1]
        return correlation > threshold
    
    def find_sharp_frame(self, cap, target_time):
        """Find a sharp frame around the target time"""
        fps = cap.get(cv2.CAP_PROP_FPS)
        search_range = 0.5  # Search within 0.5 seconds
        step = 0.1  # Check every 0.1 seconds
        
        candidates = []
        
        # Check target time and surrounding times
        times_to_check = [target_time]
        for offset in np.arange(step, search_range + step, step):
            times_to_check.append(target_time - offset)
            times_to_check.append(target_time + offset)
        
        for time in times_to_check:
            if time < 0:
                continue
            
            frame_number = int(time * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            ret, frame = cap.read()
            
            if not ret:
                continue
            
            sharpness = self.calculate_sharpness(frame)
            candidates.append((time, frame, sharpness))
        
        # Sort by sharpness and return the sharpest frame
        candidates.sort(key=lambda x: x[2], reverse=True)
        
        for time, frame, sharpness in candidates:
            if sharpness >= self.sharpness_threshold:
                # Check if it's not a duplicate
                is_duplicate = False
                for prev_frame in self.extracted_frames:
                    if self.frames_are_similar(frame, prev_frame):
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    return time, frame, sharpness
        
        return None, None, 0
    
    def extract_frames(self):
        """Extract frames from video"""
        # Create/clean extraction folder
        if self.extracted_folder.exists():
            shutil.rmtree(self.extracted_folder)
        self.extracted_folder.mkdir()
        
        cap = cv2.VideoCapture(self.video_path)
        
        if not cap.isOpened():
            print(f"Error: Could not open video file {self.video_path}")
            return False
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps
        
        print(f"\nVideo Info:")
        print(f"  FPS: {fps:.2f}")
        print(f"  Duration: {duration:.2f} seconds")
        print(f"  Sharpness threshold: {self.sharpness_threshold}")
        print(f"\nExtracting frames (checking every 2 seconds)...\n")
        
        interval = 2.0  # Check every 2 seconds
        current_time = 0
        frame_count = 0
        
        while current_time < duration:
            actual_time, frame, sharpness = self.find_sharp_frame(cap, current_time)
            
            if frame is not None:
                frame_count += 1
                filename = f"frame_{frame_count:04d}.jpg"
                filepath = self.extracted_folder / filename
                cv2.imwrite(str(filepath), frame)
                
                self.extracted_times.append(actual_time)
                self.extracted_frames.append(frame)
                
                print(f"✓ Extracted frame at {actual_time:.2f}s (sharpness: {sharpness:.2f}) -> {filename}")
            else:
                print(f"✗ No sharp frame found around {current_time:.2f}s")
            
            current_time += interval
        
        cap.release()
        
        print(f"\n{'='*60}")
        print(f"Extraction complete! {frame_count} frames extracted.")
        print(f"Images saved in: {self.extracted_folder.absolute()}")
        print(f"{'='*60}\n")
        
        return frame_count > 0
    
    def sort_text_by_position(self, ocr_result):
        """Sort OCR results by vertical position (top to bottom)"""
        if not ocr_result or not ocr_result[0]:
            return []
        
        lines = []
        for line in ocr_result:
            bbox = line['rec_polys']
            text = line['rec_texts']
            confidence = line['rec_scores']
            print(f"bbox={bbox}\n\ntext={text}\n\nconfidence={confidence}\n\n")
            # Calculate average y-coordinate for sorting
            y_avg = sum([point[1] for point in bbox]) / len(bbox)
            x_avg = sum([point[0] for point in bbox]) / len(bbox)

            #testing converting confidence and text into avg and string respectively
            confidence_avg=np.average(confidence)
            new=""
            for i in text:
                if new=="":
                    new=new+i
                else:
                    new=new+" "+i

            text=new
            lines.append((y_avg, x_avg, text, confidence_avg))    # changed from confidence to confidence_avg

        print(f"converted text={text}\n\nconverted confidence={confidence}")
        # Sort by y (vertical), then by x (horizontal)
        lines.sort(key=lambda x: (x[0], x[1]))
        return lines
    
    def process_ocr(self, output_pdf="output.pdf"):
        """Perform OCR on extracted images and create PDF"""
        print("\nStarting OCR processing...\n")
        
        # Get all images sorted
        images = sorted(self.extracted_folder.glob("*.jpg"))
        
        if not images:
            print("No images found to process!")
            return False
        
        # Create PDF
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        
        for idx, img_path in enumerate(images, 1):
            print(f"Processing {img_path.name} ({idx}/{len(images)})...")
            
            # Read image
            img = cv2.imread(str(img_path))
            
            # Perform OCR
            result = self.ocr.ocr(str(img_path))   # cls=True also as a keyword
            
            # Sort text by position
            sorted_lines = self.sort_text_by_position(result)
            
            # Add page to PDF
            pdf.add_page()
            pdf.set_font("Arial", size=12)
            
            # Add page header
            pdf.set_font("Arial", 'B', 14)
            pdf.cell(0, 10, f"Page {idx} (Video time: {self.extracted_times[idx-1]:.2f}s)", ln=True, align='C')
            pdf.ln(5)
            pdf.set_font("Arial", size=11)
            
            # Add extracted text
            page_text = []
            for y_pos, x_pos, text, confidence in sorted_lines:
                if confidence > 0.5:  # Filter low confidence
                    page_text.append(text)
            
            if page_text:
                full_text = ' '.join(page_text)
                # Handle encoding for PDF
                try:
                    pdf.multi_cell(0, 6, full_text)
                except:
                    # Fallback to ASCII if special characters cause issues
                    pdf.multi_cell(0, 6, full_text.encode('ascii', 'ignore').decode())
            else:
                pdf.cell(0, 10, "[No text detected on this page]", ln=True)
            
            print(f"  ✓ Extracted {len(page_text)} text segments")
        
        # Save PDF
        pdf.output(output_pdf)
        print(f"\n{'='*60}")
        print(f"OCR complete! PDF saved as: {output_pdf}")
        print(f"{'='*60}\n")
        
        return True

def main():
    print("="*60)
    print("Video to PDF OCR Pipeline")
    print("="*60)
    
    # Get video path from user
    video_path = input("\nEnter video file path: ").strip().strip('"').strip("'")
    
    if not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}")
        return
    
    # Initialize pipeline
    pipeline = VideoOCRPipeline(video_path, sharpness_threshold=100)
    
    # Step 1: Extract frames
    success = pipeline.extract_frames()
    
    if not success:
        print("Frame extraction failed!")
        return
    
    # Step 2: Ask user to continue
    user_input = input("\nDo you want to continue with OCR? (y/n): ").strip().lower()
    
    if user_input != 'y':
        print("OCR cancelled. Extracted images are still available in the 'Extracted' folder.")
        return
    
    # Step 3: Perform OCR and create PDF
    output_pdf = input("\nEnter output PDF filename (default: output.pdf): ").strip()
    if not output_pdf:
        output_pdf = "output.pdf"
    
    if not output_pdf.endswith('.pdf'):
        output_pdf += '.pdf'
    
    pipeline.process_ocr(output_pdf)
    print("Process complete!")

if __name__ == "__main__":
    main()