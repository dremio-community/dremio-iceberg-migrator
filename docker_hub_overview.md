# Dremio Iceberg Migrator 🧊

**A beautiful, standalone application designed to rapidly migrate legacy Parquet, JSON, CSV, Hive, Hudi, and Delta Lake tables into Apache Iceberg format directly within the Dremio ecosystem.**

![Dremio Iceberg Migrator](https://raw.githubusercontent.com/dremio-community/dremio-iceberg-migrator/main/screenshot.png) *(Note: Please add a screenshot link if available)*

---

## 🌟 Key Features

*   **Slick Web Interface**: A premium dark-mode UI with live log streaming, connection diagnostics, and an intuitive point-and-click workflow.
*   **Dual-Engine Architecture**:
    *   **Dremio Engine (Full Copy)**: Utilizes `CREATE TABLE AS SELECT` (CTAS) to execute high-performance full copies. Perfect for converting JSON, CSV, Hive, or Hudi datasets into pristine, optimized Iceberg tables.
    *   **PySpark Engine (Zero-Copy)**: Harnesses native Apache Iceberg stored procedures to perform **Zero-Copy** migrations for Hive Parquet and Delta Lake. The engine simply converts metadata in-place without rewriting multi-terabyte data files. It includes an intelligent bridge that automatically resolves Dremio source catalog paths into physical S3/ADLS URIs.
*   **Interactive Namespace Browser**: No need to memorize complex S3 paths or JDBC strings. The Migrator connects to your Dremio catalog and provides an interactive tree-browser to visually navigate your S3, Hive Metastore, Databricks Unity Catalog, and ADLS data lakes to select source tables.
*   **Bulk Folder Migration**: Select an entire folder or database within your Dremio catalog, and the tool will sequentially migrate every underlying table with real-time progress tracking.
*   **Automated Validation**: Configurable automated data integrity row-count checks immediately post-migration. 
*   **Audit Logging**: A persistent, SQLite-backed history log of every migration job, complete with row counts and execution statuses.

---

## 🚀 Quick Start

Deploy the Migrator instantly with zero dependencies using Docker. This image is fully pre-configured with Python 3.10, the Java Runtime (JRE), and all necessary PySpark libraries.

```bash
# 1. Start the container in the background and mount the data folder for persistent audit logs
docker run -d \
  -p 8771:8771 \
  -v migrator-data:/app/data \
  --name dremio-iceberg-migrator \
  mshainman/dremio-iceberg-migrator:latest

# 2. Access the Web Interface
# Open http://localhost:8771 in your web browser.
```

### Authentication setup
When you first open the application, click on **Settings** in the top right. You will need to provide:
1. **Dremio Configuration**: Input your Dremio URL and PAT (or Username/Password for Dremio Software). *Supports both Dremio Cloud (Project IDs) and Dremio Software environments.*
2. **Polaris Configuration**: Input your Polaris Catalog URI and credentials. *Supports Standard Apache Polaris (OAuth Client ID/Secret) or Dremio Open Catalog (PAT).*

---

## 🛠 Advanced / Docker Compose

If you prefer to deploy using Docker Compose, create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  migrator:
    image: mshainman/dremio-iceberg-migrator:latest
    container_name: dremio-iceberg-migrator
    ports:
      - "8771:8771"
    volumes:
      # Mount the local data folder to preserve the SQLite audit ledger
      - ./data:/app/data
    restart: unless-stopped
```

Then run:
```bash
docker-compose up -d
```

---
**Source Code & Contributions:** [GitHub Repository](https://github.com/dremio-community/dremio-iceberg-migrator)
