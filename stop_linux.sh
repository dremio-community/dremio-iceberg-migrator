#!/bin/bash
echo "Stopping Dremio Iceberg Migrator..."

# Kill the process listening on port 8771
fuser -k 8771/tcp 2>/dev/null
pkill -f "python3 app.py" 2>/dev/null

echo "Stopped."
