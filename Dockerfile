FROM python:3.10-slim

# Install Java Runtime (required by PySpark) and clean up apt cache
RUN apt-get update && \
    apt-get install -y default-jre procps && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Install Python dependencies natively
RUN pip install --no-cache-dir requests pyspark

# Copy application source code
COPY app.py .
COPY lib/ ./lib/
COPY static/ ./static/

# Environment variable to direct SQLite database to the mountable data folder
ENV DB_PATH=/app/data/migrator.db

# Expose the API and UI port
EXPOSE 8771

# Run the backend server
CMD ["python3", "app.py"]
