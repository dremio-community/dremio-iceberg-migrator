#!/bin/bash
echo "Stopping Dremio Iceberg Migrator..."

# Kill the process listening on port 8771
lsof -ti :8771 | xargs kill -9 2>/dev/null
pkill -f "python3 app.py" 2>/dev/null

echo "Stopped."
