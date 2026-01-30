#!/usr/bin/env python3
"""
Script to fix database issues
Run this once to update your database schema
"""

import sqlite3
import os

def fix_database():
    """Fix database schema by adding missing columns"""
    
    db_path = 'videos.db'
    
    if not os.path.exists(db_path):
        print(f"Database file {db_path} not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Checking database structure...")
    
    # Get current table structure
    cursor.execute("PRAGMA table_info(videos)")
    columns = cursor.fetchall()
    
    print("Current columns in videos table:")
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
    
    # Check for missing columns
    column_names = [col[1] for col in columns]
    
    # List of required columns
    required_columns = [
        ('thumbnail', 'TEXT'),
    ]
    
    # Add missing columns
    for col_name, col_type in required_columns:
        if col_name not in column_names:
            print(f"Adding missing column: {col_name} {col_type}")
            try:
                cursor.execute(f'ALTER TABLE videos ADD COLUMN {col_name} {col_type}')
                print(f"  ✓ Added {col_name} column")
            except Exception as e:
                print(f"  ✗ Error adding {col_name}: {e}")
    
    # Commit changes
    conn.commit()
    
    # Show updated structure
    cursor.execute("PRAGMA table_info(videos)")
    columns = cursor.fetchall()
    
    print("\nUpdated columns in videos table:")
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
    
    # Count videos
    cursor.execute('SELECT COUNT(*) FROM videos')
    video_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM videos WHERE thumbnail IS NOT NULL')
    thumb_count = cursor.fetchone()[0]
    
    print(f"\nTotal videos: {video_count}")
    print(f"Videos with thumbnails: {thumb_count}")
    
    conn.close()
    print("\nDatabase fixed successfully!")

def cleanup_database():
    """Clean up orphaned records"""
    conn = sqlite3.connect('videos.db')
    cursor = conn.cursor()
    
    print("\nChecking for orphaned records...")
    
    # Get all videos from database
    cursor.execute('SELECT id, filename, thumbnail FROM videos')
    db_videos = cursor.fetchall()
    
    # Check for missing files
    for video_id, filename, thumbnail in db_videos:
        video_path = os.path.join('upload', filename)
        
        if not os.path.exists(video_path):
            print(f"  ✗ Orphaned video record: {filename} (ID: {video_id})")
            # Uncomment to delete orphaned records
            # cursor.execute('DELETE FROM videos WHERE id = ?', (video_id,))
    
    conn.commit()
    conn.close()
    print("Orphaned records check completed")

if __name__ == '__main__':
    print("=" * 50)
    print("Database Fix Script")
    print("=" * 50)
    
    fix_database()
    cleanup_database()
    
    print("\nScript completed successfully!")
    print("=" * 50)