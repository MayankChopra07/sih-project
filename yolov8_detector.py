from ultralytics import YOLO
import cv2
import json
import os
from collections import deque

class YOLOv8Detector:
    def __init__(self, model_path="yolov8n.pt"):
        self.model = YOLO(model_path)
        print("YOLOv8 model loaded successfully")
    
    def process_video(self, video_path, output_dir="static/outputs"):
        """
        Process video with YOLOv8 for people detection and counting
        """
        if not os.path.exists(video_path):
            return {"error": "Video file not found"}
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # Extract filename and create output path
        filename = os.path.basename(video_path)
        output_filename = f"processed_{filename}"
        output_path = os.path.join(output_dir, output_filename)
        
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            return {"error": "Could not open video file"}
        
        # Video properties
        DENSITY_THRESHOLD = 15  # Alert threshold
        people_counts = deque(maxlen=30)  # Keep last 30 frames for average
        frame_data = []
        
        # Get video properties
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Video writer setup
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (frame_width, frame_height))
        
        frame_count = 0
        alert_frames = 0
        
        print(f"Processing video: {filename}")
        print(f"Resolution: {frame_width}x{frame_height}, FPS: {fps}, Total frames: {total_frames}")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Run YOLOv8 inference
            results = self.model(frame, classes=[0], verbose=False)  # class 0 is 'person'
            
            # Count people in current frame
            current_count = len(results[0].boxes)
            people_counts.append(current_count)
            avg_count = round(sum(people_counts) / len(people_counts))
            
            # Classify density
            density_level, color = self.classify_density(avg_count)
            
            # Check for high density alert
            if avg_count > DENSITY_THRESHOLD:
                alert_frames += 1
            
            # Annotate frame
            annotated_frame = results[0].plot()
            
            # Add information overlay
            cv2.putText(annotated_frame, f"People: {avg_count}", (20, 50),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.putText(annotated_frame, f"Density: {density_level}", (20, 90),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, 
                       (0, 0, 255) if density_level == "High" else 
                       (0, 165, 255) if density_level == "Medium" else 
                       (0, 255, 0), 2)
            
            # Add alert border if high density
            if density_level == "High":
                cv2.rectangle(annotated_frame, (0, 0), (frame_width-1, frame_height-1), (0, 0, 255), 10)
                cv2.putText(annotated_frame, "HIGH DENSITY ALERT!", (frame_width//2 - 150, 130),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)
            
            # Write frame to output video
            out.write(annotated_frame)
            
            # Store frame data
            frame_data.append({
                "frame": frame_count,
                "people_count": current_count,
                "avg_count": avg_count,
                "density": density_level
            })
            
            frame_count += 1
            
            # Progress update
            if frame_count % 30 == 0:
                progress = (frame_count / total_frames) * 100
                print(f"Processing: {progress:.1f}% complete")
        
        cap.release()
        out.release()
        
        # Calculate final statistics
        final_avg = sum([f["avg_count"] for f in frame_data]) // len(frame_data) if frame_data else 0
        final_density, _ = self.classify_density(final_avg)
        
        alert_percentage = (alert_frames / frame_count) * 100 if frame_count > 0 else 0
        
        result = {
            "success": True,
            "filename": filename,
            "original_path": video_path,
            "processed_path": output_path,
            "web_video_url": f"/video/{output_filename}",  # ADDED: Web-accessible URL
            "average_people": final_avg,
            "density_level": final_density,
            "total_frames": frame_count,
            "alert_frames": alert_frames,
            "alert_percentage": round(alert_percentage, 1),
            "frame_data": frame_data,
            "video_properties": {
                "width": frame_width,
                "height": frame_height,
                "fps": fps,
                "duration_seconds": round(frame_count / fps, 1)
            }
        }
        
        print(f"Processing complete: {final_avg} people average, {final_density} density")
        print(f"Processed video available at: {output_path}")
        return result
    
    def classify_density(self, count):
        if count < 5:
            return "Low", "green"
        elif count < 15:
            return "Medium", "orange"
        else:
            return "High", "red"
    
    def process_image(self, image_path):
        """Process single image for people detection"""
        if not os.path.exists(image_path):
            return {"error": "Image file not found"}
        
        image = cv2.imread(image_path)
        results = self.model(image, classes=[0], verbose=False)
        
        people_count = len(results[0].boxes)
        density_level, _ = self.classify_density(people_count)
        
        # Annotate image
        annotated_image = results[0].plot()
        output_path = f"static/outputs/processed_{os.path.basename(image_path)}"
        cv2.imwrite(output_path, annotated_image)
        
        return {
            "success": True,
            "people_count": people_count,
            "density_level": density_level,
            "processed_path": output_path,
            "web_image_url": f"/outputs/processed_{os.path.basename(image_path)}"  # ADDED: Web-accessible URL
        }