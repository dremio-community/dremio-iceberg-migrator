# Dremio Iceberg Migrator 🧊

A beautiful, standalone application designed to rapidly migrate legacy Parquet, JSON, CSV, Hive, Hudi, and Delta Lake tables into Apache Iceberg format within the Dremio ecosystem. 

## Features
- **Slick Web Interface**: Premium dark mode design with real-time log streaming.
- **Dual Engine Architecture**:
  - **Dremio Engine**: Uses `CREATE TABLE AS SELECT` (CTAS) to perform full copies. Perfect for converting JSON, CSV, Hive, or Hudi datasets into pristine Iceberg tables.
  - **PySpark Engine**: Performs **Zero-Copy** migrations for Parquet and Delta Lake. Instead of rewriting your multi-terabyte files, it simply converts the metadata in-place. Includes an intelligent "bridge" that auto-resolves your Dremio source paths into physical S3/ADLS URIs.
- **Bulk Folder Migration**: Select an entire folder or database from your catalog, and the tool will sequentially migrate every table inside it with live progress tracking.
- **Automated Validation & Clustering**: Configure Iceberg sort orders (`CLUSTER BY`) and perform automated data integrity row-count checks immediately post-migration.
- **Interactive Namespace Browser**: Visually navigate your S3, Hive Metastore, Unity Catalog, and ADLS data lakes to select tables without memorizing SQL paths.
- **Audit Logging**: A persistent SQLite history log of every migration job, complete with row counts and execution statuses.

## Installation & Usage

### Option 1: Docker (Recommended)
You can deploy the Migrator instantly with zero dependencies using Docker. This ensures Java, Python, and PySpark are perfectly configured out of the box.

```bash
# 1. Start the container in the background
docker run -d -p 8771:8771 -v migrator-data:/app/data --name dremio-iceberg-migrator mshainman/dremio-iceberg-migrator:latest

# 2. Access the UI
# Open http://localhost:8771 in your web browser.
```
**Docker Hub Repository:** [https://hub.docker.com/r/mshainman/dremio-iceberg-migrator](https://hub.docker.com/r/mshainman/dremio-iceberg-migrator)
*(Note: Your migration history is persisted in the `./data` folder on your host machine).*

### Option 2: Local Script (Linux/Mac)
Requires Python 3. (PySpark will automatically install itself just-in-time on first run if you choose a zero-copy strategy).

1. Make the launch scripts executable (if they aren't already):
```bash
chmod +x launch_linux.sh launch_mac.command
```

2. Run the launcher for your OS:
- **Linux**: `./launch_linux.sh`
- **Mac**: Double-click `launch_mac.command`

3. The application will start and automatically open your default web browser to `http://127.0.0.1:8771`.

## Authentication
When you first open the app, click **Settings**. You will need to configure both Dremio and Polaris:
- **Dremio Configuration**: Input your Dremio URL and PAT (or Username/Password for Software). Supports both Dremio Cloud and Software.
- **Polaris Configuration**: Input your Polaris Catalog URI and credentials (Supports standard OAuth or Dremio Open Catalog PATs).
