#!/bin/bash
cd "$(dirname "$0")"

echo "Starting Dremio Iceberg Migrator..."
python3 app.py
