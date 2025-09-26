from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
import os
import json
from werkzeug.utils import secure_filename
from yolov8_detector import YOLOv8Detector
from database import Database

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = 'temple-crowd-secret-key'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['OUTPUT_FOLDER'] = 'static/outputs'
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB

# Allowed file extensions
ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'jpg', 'jpeg', 'png'}

# Initialize components
detector = YOLOv8Detector()
db = Database()

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def ensure_directories():
    """Create necessary directories if they don't exist"""
    for folder in [app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER']]:
        if not os.path.exists(folder):
            os.makedirs(folder)

@app.route('/')
def index():
    """Serve the main application page"""
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle video/image upload and processing"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        ensure_directories()
        
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Process based on file type
            if filename.lower().endswith(('.mp4', '.mov', '.avi', '.mkv')):
                result = detector.process_video(filepath)
            else:
                result = detector.process_image(filepath)
            
            if result.get('success'):
                # Save to database
                video_id = db.save_video_analysis(
                    filename=filename,
                    original_path=filepath,
                    processed_path=result.get('processed_path', ''),
                    people_count=result['average_people'],
                    density_level=result['density_level'],
                    analysis_data=result
                )
                
                # Save alert if high density
                if result['density_level'] == 'High':
                    db.save_alert(
                        video_id=video_id,
                        alert_type='High Crowd Density',
                        message=f'High density detected: {result["average_people"]} people average',
                        severity='high'
                    )
                
                result['video_id'] = video_id
                return jsonify(result)
            else:
                return jsonify({'error': result.get('error', 'Processing failed')}), 500
                
        except Exception as e:
            return jsonify({'error': f'Processing error: {str(e)}'}), 500
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/api/analytics')
def get_analytics():
    """Get recent analytics data"""
    try:
        analytics = db.get_recent_analytics(limit=10)
        alerts = db.get_alerts(limit=10)
        temples = db.get_temple_data()
        
        return jsonify({
            'analytics': [
                {
                    'id': row[0],
                    'filename': row[1],
                    'people_count': row[4],
                    'density_level': row[5],
                    'created_at': row[6],
                    'processed_path': row[3]
                }
                for row in analytics
            ],
            'alerts': [
                {
                    'id': row[0],
                    'alert_type': row[2],
                    'message': row[3],
                    'severity': row[4],
                    'created_at': row[5],
                    'filename': row[6] or 'System'
                }
                for row in alerts
            ],
            'temples': [
                {
                    'id': row[0],
                    'name': row[1],
                    'location': row[2],
                    'capacity': row[3],
                    'current_count': row[4],
                    'status': row[5],
                    'last_updated': row[6]
                }
                for row in temples
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/temple/<int:temple_id>', methods=['PUT'])
def update_temple_count(temple_id):
    """Update temple crowd count"""
    try:
        data = request.get_json()
        count = data.get('count', 0)
        
        db.update_temple_count(temple_id, count)
        return jsonify({'success': True, 'message': 'Temple count updated'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/video/<path:filename>')
def serve_video(filename):
    """Serve processed video files"""
    try:
        return send_file(filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'Temple Crowd Management API'})

if __name__ == '__main__':
    ensure_directories()
    print("Starting Temple Crowd Management System...")
    print("Access the application at: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)