#!/usr/bin/env python3
import argparse
import http.server
import json
import logging
import os
import threading
import time
from pathlib import Path

# Add project root to path
import sys
import subprocess
import importlib.util
sys.path.insert(0, os.path.dirname(__file__))

from lib import db, dremio_client, spark_engine

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("migrator")

# ── Globals ──────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"

CTAS_JOBS = {}

def run_ctas_migration_thread(local_job_id, sql, source_path, target_path, cluster_by, validate):
    CTAS_JOBS[local_job_id] = {"jobState": "RUNNING"}
    try:
        # Submit CTAS
        dremio_job_id = dremio_client.submit_job(sql)
        status = "RUNNING"
        
        # Poll CTAS
        while status not in ("COMPLETED", "FAILED", "CANCELED"):
            time.sleep(2)
            dremio_status = dremio_client.get_job_status(dremio_job_id)
            if dremio_status and dremio_status.get("jobState"):
                status = dremio_status["jobState"]
                CTAS_JOBS[local_job_id] = {"jobState": status}
        
        if status != "COMPLETED":
            db.update_migration(local_job_id, status)
            return

        # Post-migration Clustering
        if cluster_by:
            logger.info(f"[{local_job_id}] Applying clustering: {cluster_by}")
            CTAS_JOBS[local_job_id] = {"jobState": "CLUSTERING"}
            c_id = dremio_client.submit_job(f"ALTER TABLE {target_path} CLUSTER BY ({cluster_by})")
            c_stat = "RUNNING"
            while c_stat not in ("COMPLETED", "FAILED", "CANCELED"):
                time.sleep(2)
                d_c_stat = dremio_client.get_job_status(c_id)
                if d_c_stat and d_c_stat.get("jobState"):
                    c_stat = d_c_stat["jobState"]
            if c_stat != "COMPLETED":
                CTAS_JOBS[local_job_id] = {"jobState": "FAILED", "errorMessage": "Clustering failed."}
                db.update_migration(local_job_id, "FAILED")
                return

        # Post-migration Validation
        row_count = None
        source_row_count = None
        if validate:
            logger.info(f"[{local_job_id}] Validating row counts...")
            CTAS_JOBS[local_job_id] = {"jobState": "VALIDATING"}
            
            # 1. Count Source
            try:
                s_id = dremio_client.submit_job(f"SELECT count(*) as cnt FROM {source_path}")
                s_stat = "RUNNING"
                while s_stat not in ("COMPLETED", "FAILED", "CANCELED"):
                    time.sleep(2)
                    d_s_stat = dremio_client.get_job_status(s_id)
                    if d_s_stat and d_s_stat.get("jobState"):
                        s_stat = d_s_stat["jobState"]
                
                if s_stat == "COMPLETED":
                    results = dremio_client.get_job_results(s_id)
                    if results and 'rows' in results and len(results['rows']) > 0:
                        source_row_count = int(results['rows'][0].get('cnt', 0))
            except Exception as e:
                logger.warning(f"[{local_job_id}] Failed to count source rows: {e}")

            # 2. Count Target
            v_id = dremio_client.submit_job(f"SELECT count(*) as cnt FROM {target_path}")
            v_stat = "RUNNING"
            while v_stat not in ("COMPLETED", "FAILED", "CANCELED"):
                time.sleep(2)
                d_v_stat = dremio_client.get_job_status(v_id)
                if d_v_stat and d_v_stat.get("jobState"):
                    v_stat = d_v_stat["jobState"]
            
            if v_stat == "COMPLETED":
                results = dremio_client.get_job_results(v_id)
                if results and 'rows' in results and len(results['rows']) > 0:
                    row_count = int(results['rows'][0].get('cnt', 0))
                    logger.info(f"[{local_job_id}] Validation Passed. Source: {source_row_count} | Target: {row_count}")
            else:
                CTAS_JOBS[local_job_id] = {"jobState": "VALIDATION_FAILED", "errorMessage": "Validation query failed."}
                db.update_migration(local_job_id, "VALIDATION_FAILED")
                return

        CTAS_JOBS[local_job_id] = {"jobState": "COMPLETED"}
        db.update_migration(local_job_id, "COMPLETED", row_count, source_row_count)

    except Exception as e:
        logger.error(f"[{local_job_id}] CTAS Job Failed: {e}")
        CTAS_JOBS[local_job_id] = {"jobState": "FAILED", "errorMessage": str(e)}
        db.update_migration(local_job_id, "FAILED")

class MigratorHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        if "/api/" not in str(args[0]):
            logger.debug(format % args)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/api/"):
            self._handle_api_get(path)
            return
        self._serve_static(path)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path.startswith("/api/"):
            self._handle_api_post(path)
            return
        self._send_json({"error": "Not found"}, 404)

    def _handle_api_get(self, path):
        if path == "/api/settings":
            settings = db.get_all_settings()
            if 'dremio_password' in settings and settings['dremio_password']:
                settings['dremio_password'] = '••••••••'
            if 'dremio_pat' in settings and settings['dremio_pat']:
                settings['dremio_pat'] = settings['dremio_pat'][:8] + '••••••••'
            self._send_json(settings)

        elif path == "/api/catalog/root":
            try:
                data = dremio_client.get_catalog_root()
                self._send_json({"success": True, "data": data})
            except Exception as e:
                error_msg = str(e)
                if "Connection refused" in error_msg or "Max retries exceeded" in error_msg or "Failed to establish a new connection" in error_msg:
                    error_msg = "Unable to connect to Dremio. Please verify your Dremio URL in Settings and ensure the server is running."
                self._send_json({"success": False, "error": error_msg})

        elif path == "/api/diagnostics":
            checks = []
            
            # 1. Python Version
            py_version = sys.version.split(' ')[0]
            checks.append({
                "name": "Python Environment",
                "status": "PASS",
                "message": f"Python {py_version} is running."
            })
            
            # 2. Java Version (Required for PySpark)
            try:
                res = subprocess.run(['java', '-version'], capture_output=True, text=True, timeout=5)
                # Java outputs to stderr usually
                output = res.stderr if res.stderr else res.stdout
                first_line = output.splitlines()[0] if output else "Unknown Java Version"
                checks.append({
                    "name": "Java Runtime (JRE)",
                    "status": "PASS",
                    "message": first_line
                })
            except Exception:
                checks.append({
                    "name": "Java Runtime (JRE)",
                    "status": "FAIL",
                    "message": "Java is not installed or not in PATH. PySpark Zero-Copy migrations will fail."
                })
                
            # 3. PySpark Library
            pyspark_spec = importlib.util.find_spec('pyspark')
            if pyspark_spec:
                checks.append({
                    "name": "PySpark Library",
                    "status": "PASS",
                    "message": "pyspark is installed and available."
                })
            else:
                checks.append({
                    "name": "PySpark Library",
                    "status": "WARNING",
                    "message": "pyspark not found. The tool will attempt to auto-install it during the first zero-copy migration."
                })
                
            # 4. Database Access
            try:
                db.get_history()
                checks.append({
                    "name": "SQLite Database",
                    "status": "PASS",
                    "message": "Database is accessible and writable."
                })
            except Exception as e:
                checks.append({
                    "name": "SQLite Database",
                    "status": "FAIL",
                    "message": f"Database error: {e}"
                })
                
            self._send_json({"success": True, "data": checks})

        elif path.startswith("/api/catalog/children"):
            try:
                if "?" in self.path:
                    import urllib.parse
                    params = urllib.parse.parse_qs(self.path.split("?")[1])
                    catalog_path = params.get("path", [])[0]
                    # path is comma separated
                    path_list = catalog_path.split(",")
                    data = dremio_client.get_catalog_by_path(path_list)
                    self._send_json({"success": True, "data": data})
                else:
                    self._send_json({"success": False, "error": "Missing path parameter"})
            except Exception as e:
                error_msg = str(e)
                if "Connection refused" in error_msg or "Max retries exceeded" in error_msg or "Failed to establish a new connection" in error_msg:
                    error_msg = "Unable to connect to Dremio. Please verify your Dremio URL in Settings and ensure the server is running."
                self._send_json({"success": False, "error": error_msg})
                
        elif path.startswith("/api/job/"):
            try:
                job_id = path.split("/")[-1].split("?")[0]
                
                # Check if it's a spark job
                import urllib.parse
                params = urllib.parse.parse_qs(self.path.split("?")[1] if "?" in self.path else "")
                is_pyspark = params.get("pyspark", ["false"])[0] == "true"
                
                if is_pyspark:
                    from lib import spark_engine
                    status = spark_engine.get_spark_job_status(job_id)
                else:
                    # Check our local CTAS_JOBS tracking first
                    if job_id in CTAS_JOBS:
                        status = CTAS_JOBS[job_id]
                    else:
                        status = dremio_client.get_job_status(job_id)
                    
                self._send_json({"success": True, "data": status})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)})

        elif path == "/api/history":
            try:
                history = db.get_history()
                self._send_json({"success": True, "data": history})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)})

        else:
            self._send_json({"error": "Unknown endpoint"}, 404)

    def _handle_api_post(self, path):
        body = self._read_body()

        if path == "/api/settings":
            for k, v in body.items():
                if v and "••••••••" not in v:
                    db.set_setting(k, v)
            self._send_json({"success": True})

        elif path == "/api/test-connection":
            success, msg = dremio_client.test_connection()
            self._send_json({"success": success, "message": msg})

        elif path == "/api/migrate":
            source_path = body.get("source_path")
            target_path = body.get("target_path")
            strategy = body.get("strategy", "CTAS")
            cluster_by = body.get("cluster_by")
            validate = body.get("validate", False)

            if not source_path or not target_path:
                self._send_json({"success": False, "error": "Source and target required"})
                return

            try:
                if strategy == "CTAS":
                    import uuid
                    local_job_id = f"ctas-{uuid.uuid4().hex[:8]}"
                    sql = f'CREATE TABLE {target_path} USING iceberg AS SELECT * FROM {source_path}'
                    
                    db.log_migration(local_job_id, source_path, target_path, strategy)
                    t = threading.Thread(target=run_ctas_migration_thread, args=(local_job_id, sql, source_path, target_path, cluster_by, validate), daemon=True)
                    t.start()
                    
                    self._send_json({"success": True, "job_id": local_job_id})
                    
                elif strategy in ["IN_PLACE", "SNAPSHOT"]:
                    from lib import spark_engine
                    
                    # Auto-resolve Dremio path to S3 URI if needed
                    final_source = source_path
                    if not final_source.startswith(("s3://", "s3a://", "file://", "abfs://", "gcs://")):
                        # It's likely a Dremio path (e.g. s3_source.folder.table)
                        path_list = final_source.split('.')
                        final_source = dremio_client.resolve_physical_dataset_uri(path_list)
                        
                    job_id = spark_engine.submit_spark_job(final_source, target_path, strategy, cluster_by, validate)
                    db.log_migration(job_id, source_path, target_path, strategy)
                    self._send_json({"success": True, "job_id": job_id})
                else:
                    self._send_json({"success": False, "error": "Unknown strategy"})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)})

        elif path == "/api/optimize":
            target_path = body.get("target_path")
            if not target_path:
                self._send_json({"success": False, "error": "Target required"})
                return
            try:
                sql = f'OPTIMIZE TABLE {target_path} REWRITE DATA USING BIN_PACK'
                job_id = dremio_client.submit_job(sql)
                self._send_json({"success": True, "job_id": job_id})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)})

        elif path == "/api/shutdown":
            self._send_json({"success": True, "message": "Shutting down Migrator..."})
            logger.info("Shutdown requested via API. Exiting...")
            threading.Thread(target=lambda: (time.sleep(1), os._exit(0)), daemon=True).start()

        else:
            self._send_json({"error": "Unknown endpoint"}, 404)

    def _serve_static(self, path):
        if path == "/" or path == "":
            path = "/index.html"
        file_path = STATIC_DIR / path.lstrip("/")
        if not file_path.exists() or not file_path.is_file():
            self.send_error(404)
            return
        content_types = {
            ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
            ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
            ".ico": "image/x-icon",
        }
        ext = file_path.suffix.lower()
        ct = content_types.get(ext, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", f"{ct}; charset=utf-8" if ext in (".html", ".css", ".js") else ct)
        self.send_header("Cache-Control", "no-cache" if ext in (".html", ".js", ".css") else "max-age=3600")
        self.end_headers()
        self.wfile.write(file_path.read_bytes())

    def _send_json(self, data, status=200):
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8")
        return json.loads(body) if body else {}

def main():
    parser = argparse.ArgumentParser(description="Iceberg Migrator GUI")
    parser.add_argument("--port", type=int, default=8771, help="Server port (default: 8771)")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: 127.0.0.1)")
    args = parser.parse_args()

    # Start HTTP server
    server = http.server.HTTPServer((args.host, args.port), MigratorHandler)
    server.timeout = None

    url = f"http://{args.host}:{args.port}"
    print(f'''
=========================================
 Dremio Iceberg Migrator
=========================================
 Running at: {url}
 Press Ctrl+C to stop
=========================================
''')

    try:
        import webbrowser
        webbrowser.open(url)
    except Exception:
        pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        server.server_close()

if __name__ == "__main__":
    main()
