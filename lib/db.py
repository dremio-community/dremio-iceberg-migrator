import sqlite3
import os

DB_PATH = os.environ.get('DB_PATH', 'migrator.db')

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS migration_history (
            job_id TEXT PRIMARY KEY,
            source_path TEXT,
            target_path TEXT,
            strategy TEXT,
            status TEXT,
            row_count INTEGER,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    ''')
    try:
        c.execute('ALTER TABLE migration_history ADD COLUMN source_row_count INTEGER')
    except sqlite3.OperationalError:
        pass # Column already exists
    conn.commit()
    conn.close()

def get_setting(key, default=None):
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT value FROM settings WHERE key = ?', (key,))
    row = c.fetchone()
    conn.close()
    if row:
        return row['value']
    return default

def set_setting(key, value):
    conn = get_connection()
    c = conn.cursor()
    c.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, value))
    conn.commit()
    conn.close()

def get_all_settings():
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT key, value FROM settings')
    rows = c.fetchall()
    conn.close()
    return {row['key']: row['value'] for row in rows}

def log_migration(job_id, source_path, target_path, strategy):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        INSERT INTO migration_history (job_id, source_path, target_path, strategy, status)
        VALUES (?, ?, ?, ?, ?)
    ''', (job_id, source_path, target_path, strategy, 'RUNNING'))
    conn.commit()
    conn.close()

def update_migration(job_id, status, row_count=None, source_row_count=None):
    conn = get_connection()
    c = conn.cursor()
    if status in ('COMPLETED', 'FAILED', 'VALIDATION_FAILED'):
        c.execute('''
            UPDATE migration_history
            SET status = ?, row_count = ?, source_row_count = ?, completed_at = CURRENT_TIMESTAMP
            WHERE job_id = ?
        ''', (status, row_count, source_row_count, job_id))
    else:
        c.execute('''
            UPDATE migration_history
            SET status = ?, row_count = ?, source_row_count = ?
            WHERE job_id = ?
        ''', (status, row_count, source_row_count, job_id))
    conn.commit()
    conn.close()

def get_history():
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM migration_history ORDER BY started_at DESC LIMIT 100')
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# Initialize database on module import
init_db()
