from flask import Flask, request, jsonify, send_file, send_from_directory, Response
import os
import sqlite3
from werkzeug.utils import secure_filename
import uuid
import time
import mimetypes
import subprocess

app = Flask(__name__, static_folder='.')

# Application settings
UPLOAD_FOLDER = 'upload'
THUMBNAILS_FOLDER = 'thumbnails'
ALLOWED_EXTENSIONS = {'mp4', 'mp3', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'wav'}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['THUMBNAILS_FOLDER'] = THUMBNAILS_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Create folders if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(THUMBNAILS_FOLDER, exist_ok=True)

def init_database():
    """Initialize SQLite database with required columns"""
    conn = sqlite3.connect('videos.db', check_same_thread=False)
    cursor = conn.cursor()
    
    # Create videos table with all required columns
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        filename TEXT UNIQUE NOT NULL,
        original_filename TEXT NOT NULL,
        file_size INTEGER,
        thumbnail TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Check if thumbnail column exists, if not add it
    cursor.execute("PRAGMA table_info(videos)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'thumbnail' not in columns:
        print("Adding thumbnail column to videos table...")
        cursor.execute('ALTER TABLE videos ADD COLUMN thumbnail TEXT')
    
    conn.commit()
    conn.close()
    print("Database initialized successfully")

def sanitize_filename(filename):
    """Sanitize filename by removing special characters and non-ASCII"""
    # Keep only safe characters
    import unicodedata
    
    # Normalize Unicode
    filename = unicodedata.normalize('NFKD', filename)
    
    # Remove non-ASCII characters
    filename = filename.encode('ascii', 'ignore').decode('ascii')
    
    # Use secure_filename for additional safety
    filename = secure_filename(filename)
    
    # Ensure filename is not empty
    if not filename:
        filename = "unnamed_file"
    
    return filename

def allowed_file(filename):
    """Check file extension"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_unique_filename(filename):
    """Generate unique filename to prevent duplicates"""
    ext = filename.rsplit('.', 1)[1].lower()
    unique_id = str(uuid.uuid4())[:8]
    base_name = secure_filename(filename.rsplit('.', 1)[0])
    
    # Handle empty base name
    if not base_name:
        base_name = "file"
    
    return f"{base_name}_{unique_id}.{ext}"

def generate_video_thumbnail(video_path, output_path, time_in_seconds=10):
    """Generate thumbnail from video at specific time"""
    try:
        # Ensure thumbnails folder exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Check if ffmpeg is available
        try:
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("FFmpeg not found. Thumbnail generation disabled.")
            return False
        
        # Generate thumbnail from video
        command = [
            'ffmpeg',
            '-y',
            '-ss', str(time_in_seconds),
            '-i', video_path,
            '-frames:v', '1',
            '-vf', 'scale=320:-1',
            '-q:v', '2',
            output_path
        ]
        
        # Run ffmpeg command
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0 and os.path.exists(output_path):
            thumb_size = os.path.getsize(output_path)
            print(f"Thumbnail generated: {output_path} ({thumb_size} bytes)")
            return True
        else:
            print(f"Thumbnail generation failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print("Thumbnail generation timed out")
        return False
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return False

@app.route('/')
def index():
    """Home page"""
    try:
        return send_file('index.html')
    except:
        return "index.html not found", 404

@app.route('/video/<filename>')
def serve_video(filename):
    """Serve video file"""
    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    except Exception as e:
        print(f"Video error: {e}")
        return "Video not found", 404

@app.route('/thumb/<filename>')
def serve_thumbnail(filename):
    """Serve thumbnail image"""
    try:
        return send_from_directory(app.config['THUMBNAILS_FOLDER'], filename)
    except Exception as e:
        print(f"Thumbnail error: {e}")
        return "Thumbnail not found", 404

@app.route('/upload', methods=['POST'])
def upload_file():
    """Upload video or audio file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file in request'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Sanitize filename to handle Unicode/emoji issues
        original_filename = sanitize_filename(file.filename)
        
        if not original_filename:
            original_filename = "uploaded_file"
        
        if not allowed_file(original_filename):
            return jsonify({'error': 'File format not supported. Allowed: MP4, MP3, AVI, MOV, MKV, WEBM, WAV, OGG'}), 400
        
        # Create unique filename
        unique_filename = generate_unique_filename(original_filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        # Save file
        file.save(file_path)
        
        # Generate thumbnail for video files
        thumbnail_filename = None
        if original_filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv', '.webm')):
            thumb_name = f"{os.path.splitext(unique_filename)[0]}.jpg"
            thumb_path = os.path.join(app.config['THUMBNAILS_FOLDER'], thumb_name)
            
            if generate_video_thumbnail(file_path, thumb_path):
                thumbnail_filename = thumb_name
            else:
                print(f"Could not generate thumbnail for {unique_filename}")
        
        # Save information to database
        conn = sqlite3.connect('videos.db')
        cursor = conn.cursor()
        
        # Extract video name (without extension)
        video_name = original_filename.rsplit('.', 1)[0]
        file_size = os.path.getsize(file_path)
        
        cursor.execute('''
        INSERT INTO videos (name, filename, original_filename, file_size, thumbnail)
        VALUES (?, ?, ?, ?, ?)
        ''', (video_name, unique_filename, original_filename, file_size, thumbnail_filename))
        
        video_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'File uploaded successfully',
            'id': video_id,
            'filename': unique_filename,
            'name': video_name,
            'size': file_size,
            'thumbnail': thumbnail_filename,
            'url': f"/video/{unique_filename}"
        }), 201
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({'error': f'Error uploading file: {str(e)}'}), 500

@app.route('/videos', methods=['GET'])
def get_videos():
    """Get list of videos"""
    try:
        conn = sqlite3.connect('videos.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT id, name, filename, original_filename, file_size, thumbnail,
               strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at
        FROM videos 
        ORDER BY created_at DESC
        ''')
        
        videos = []
        for row in cursor.fetchall():
            video = dict(row)
            video['url'] = f"/video/{video['filename']}"
            if video['thumbnail']:
                video['thumbnail_url'] = f"/thumb/{video['thumbnail']}"
            videos.append(video)
        
        conn.close()
        return jsonify(videos)
        
    except Exception as e:
        print(f"Get videos error: {str(e)}")
        return jsonify({'error': f'Error fetching videos: {str(e)}'}), 500

@app.route('/video/<int:video_id>', methods=['DELETE'])
def delete_video(video_id):
    """Delete video"""
    try:
        conn = sqlite3.connect('videos.db')
        cursor = conn.cursor()
        
        # Get video info before deletion
        cursor.execute('SELECT filename, thumbnail FROM videos WHERE id = ?', (video_id,))
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return jsonify({'error': 'Video not found'}), 404
        
        filename, thumbnail = result
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Delete file from system
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Delete thumbnail if exists
        if thumbnail:
            thumb_path = os.path.join(app.config['THUMBNAILS_FOLDER'], thumbnail)
            if os.path.exists(thumb_path):
                os.remove(thumb_path)
        
        # Delete record from database
        cursor.execute('DELETE FROM videos WHERE id = ?', (video_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Video deleted successfully'}), 200
        
    except Exception as e:
        print(f"Delete error: {str(e)}")
        return jsonify({'error': f'Error deleting video: {str(e)}'}), 500

@app.route('/health')
def health_check():
    """Health check endpoint"""
    try:
        db_exists = os.path.exists('videos.db')
        upload_exists = os.path.exists(app.config['UPLOAD_FOLDER'])
        thumbs_exists = os.path.exists(app.config['THUMBNAILS_FOLDER'])
        
        # Count videos in database
        conn = sqlite3.connect('videos.db')
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM videos')
        video_count = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM videos WHERE thumbnail IS NOT NULL')
        thumb_count = cursor.fetchone()[0]
        
        conn.close()
        
        # Count files
        upload_count = len(os.listdir(app.config['UPLOAD_FOLDER'])) if upload_exists else 0
        thumb_count_files = len(os.listdir(app.config['THUMBNAILS_FOLDER'])) if thumbs_exists else 0
        
        return jsonify({
            'status': 'ok',
            'timestamp': time.time(),
            'database': db_exists,
            'upload_folder': upload_exists,
            'thumbnails_folder': thumbs_exists,
            'video_count': video_count,
            'thumbnail_count': thumb_count,
            'upload_files': upload_count,
            'thumb_files': thumb_count_files
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cleanup', methods=['POST'])
def cleanup_orphaned_files():
    """Clean up orphaned files"""
    try:
        conn = sqlite3.connect('videos.db')
        cursor = conn.cursor()
        
        # Get all registered files
        cursor.execute('SELECT id, filename, thumbnail FROM videos')
        database_files = cursor.fetchall()
        
        orphaned_count = 0
        
        for video_id, filename, thumbnail in database_files:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            # If file doesn't exist on system
            if not os.path.exists(file_path):
                cursor.execute('DELETE FROM videos WHERE id = ?', (video_id,))
                orphaned_count += 1
                print(f"Deleted missing video record: {filename}")
                
                # Also delete thumbnail if exists
                if thumbnail:
                    thumb_path = os.path.join(app.config['THUMBNAILS_FOLDER'], thumbnail)
                    if os.path.exists(thumb_path):
                        os.remove(thumb_path)
        
        conn.commit()
        
        # Check for files without records
        for folder_name, folder_path in [('upload', UPLOAD_FOLDER), ('thumbnails', THUMBNAILS_FOLDER)]:
            if os.path.exists(folder_path):
                files = os.listdir(folder_path)
                if folder_name == 'upload':
                    database_filenames = [f for _, f, _ in database_files]
                else:
                    database_filenames = [t for _, _, t in database_files if t]
                
                for file in files:
                    if file not in database_filenames:
                        file_path = os.path.join(folder_path, file)
                        os.remove(file_path)
                        orphaned_count += 1
                        print(f"Deleted orphaned {folder_name} file: {file}")
        
        conn.close()
        
        return jsonify({
            'message': f'Cleanup completed successfully, deleted {orphaned_count} files'
        }), 200
        
    except Exception as e:
        print(f"Cleanup error: {str(e)}")
        return jsonify({'error': f'Error during cleanup: {str(e)}'}), 500

@app.route('/generate-thumbnails', methods=['POST'])
def generate_missing_thumbnails():
    """Generate thumbnails for videos that don't have them"""
    try:
        conn = sqlite3.connect('videos.db')
        cursor = conn.cursor()
        
        # Get videos without thumbnails
        cursor.execute('SELECT id, filename FROM videos WHERE thumbnail IS NULL')
        videos_without_thumbs = cursor.fetchall()
        
        generated_count = 0
        failed_count = 0
        
        for video_id, filename in videos_without_thumbs:
            video_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            if os.path.exists(video_path) and filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv', '.webm')):
                thumb_name = f"{os.path.splitext(filename)[0]}.jpg"
                thumb_path = os.path.join(app.config['THUMBNAILS_FOLDER'], thumb_name)
                
                if generate_video_thumbnail(video_path, thumb_path):
                    cursor.execute('UPDATE videos SET thumbnail = ? WHERE id = ?', (thumb_name, video_id))
                    generated_count += 1
                    print(f"Generated thumbnail for {filename}")
                else:
                    failed_count += 1
                    print(f"Failed to generate thumbnail for {filename}")
            else:
                failed_count += 1
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': f'Thumbnail generation completed: {generated_count} generated, {failed_count} failed',
            'generated': generated_count,
            'failed': failed_count
        }), 200
        
    except Exception as e:
        print(f"Thumbnail generation error: {str(e)}")
        return jsonify({'error': f'Error generating thumbnails: {str(e)}'}), 500

# Static file routes
@app.route('/css/<path:filename>')
def serve_css(filename):
    try:
        return send_from_directory('css', filename)
    except:
        return "CSS file not found", 404

@app.route('/js/<path:filename>')
def serve_js(filename):
    try:
        return send_from_directory('js', filename)
    except:
        return "JS file not found", 404

@app.route('/icon/<path:filename>')
def serve_icon(filename):
    try:
        return send_from_directory('icon', filename)
    except:
        return "Icon file not found", 404

if __name__ == '__main__':
    # Initialize database on startup
    init_database()
    
    print("=" * 60)
    print("Video Streaming Server - Professional Version")
    print("=" * 60)
    print(f"Upload folder: {os.path.abspath(UPLOAD_FOLDER)}")
    print(f"Thumbnails folder: {os.path.abspath(THUMBNAILS_FOLDER)}")
    print(f"Database: {os.path.abspath('videos.db')}")
    print(f"Server URL: http://localhost:5000")
    print("=" * 60)
    print("Professional features:")
    print("   • Automatic thumbnail generation")
    print("   • Lightweight frontend")
    print("   • Fast page loading")
    print("   • YouTube-like design")
    print("=" * 60)
    
    # Check for ffmpeg
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        print("FFmpeg is available for thumbnail generation")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("FFmpeg not found. Thumbnail generation will be disabled.")
        print("To enable thumbnails, install FFmpeg from: https://ffmpeg.org/download.html")
    
    print("=" * 60)
    
    # Run the app
    app.run(debug=True, host='0.0.0.0', port=5000)