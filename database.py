import sqlite3
import json
from datetime import datetime

class Database:
    def __init__(self, db_path='crowd_data.db'):
        self.db_path = db_path
        self.init_db()
    
    def init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Video analytics table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS video_analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                original_path TEXT,
                processed_path TEXT,
                people_count INTEGER,
                density_level TEXT,
                analysis_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Alerts table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS crowd_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id INTEGER,
                alert_type TEXT,
                message TEXT,
                severity TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (video_id) REFERENCES video_analytics (id)
            )
        ''')
        
        # Temple data table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS temple_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                location TEXT,
                capacity INTEGER,
                current_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'Normal',
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Insert sample temple data
        temples = [
            ('Somnath Temple', 'Gujarat', 1000, 0),
            ('Dwarka Temple', 'Gujarat', 800, 0),
            ('Ambaji Temple', 'Gujarat', 600, 0),
            ('Pavagadh Temple', 'Gujarat', 700, 0)
        ]
        
        cursor.execute('SELECT COUNT(*) FROM temple_data')
        if cursor.fetchone()[0] == 0:
            cursor.executemany('''
                INSERT INTO temple_data (name, location, capacity, current_count)
                VALUES (?, ?, ?, ?)
            ''', temples)
        
        conn.commit()
        conn.close()
    
    def save_video_analysis(self, filename, original_path, processed_path, people_count, density_level, analysis_data):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO video_analytics (filename, original_path, processed_path, people_count, density_level, analysis_data)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (filename, original_path, processed_path, people_count, density_level, json.dumps(analysis_data)))
        
        video_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return video_id
    
    def save_alert(self, video_id, alert_type, message, severity="medium"):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO crowd_alerts (video_id, alert_type, message, severity)
            VALUES (?, ?, ?, ?)
        ''', (video_id, alert_type, message, severity))
        
        conn.commit()
        conn.close()
    
    def update_temple_count(self, temple_id, count):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Determine status based on capacity
        cursor.execute('SELECT capacity FROM temple_data WHERE id = ?', (temple_id,))
        capacity = cursor.fetchone()[0]
        
        status = "Normal"
        if count > capacity * 0.8:
            status = "High"
        elif count > capacity * 0.5:
            status = "Medium"
        
        cursor.execute('''
            UPDATE temple_data 
            SET current_count = ?, status = ?, last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (count, status, temple_id))
        
        conn.commit()
        conn.close()
    
    def get_temple_data(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM temple_data ORDER BY name')
        temples = cursor.fetchall()
        
        conn.close()
        return temples
    
    def get_recent_analytics(self, limit=5):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM video_analytics 
            ORDER BY created_at DESC 
            LIMIT ?
        ''', (limit,))
        
        results = cursor.fetchall()
        conn.close()
        return results
    
    def get_alerts(self, limit=10):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT ca.*, va.filename 
            FROM crowd_alerts ca
            LEFT JOIN video_analytics va ON ca.video_id = va.id
            ORDER BY ca.created_at DESC 
            LIMIT ?
        ''', (limit,))
        
        results = cursor.fetchall()
        conn.close()
        return results