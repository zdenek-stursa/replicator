# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    # Set path so that commands from venv are found
    PATH="/app/venv/bin:$PATH" \
    # Default Redis URL for Docker environment
    RATELIMIT_STORAGE_URL=redis://localhost:6379/0 \
    # Default Gunicorn settings (can be overridden at runtime)
    GUNICORN_HOST=0.0.0.0 \
    GUNICORN_PORT=5000 \
    GUNICORN_WORKERS=4

# Install system dependencies needed for the app and venv creation
# Install system dependencies including gosu for privilege dropping
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-venv \
    redis-server \
    git \
    build-essential \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user to run the application
RUN useradd --create-home --shell /bin/bash appuser

# Set the working directory in the container
WORKDIR /app

# Clone the repository inside the container
# Ensure git is installed (added in the previous RUN command)
RUN git clone https://github.com/zdenek-stursa/replicator.git . && \
    # Optional: remove .git directory if not needed in the final image
    rm -rf .git

# Now that code is cloned, check for requirements.txt
RUN if [ ! -f "requirements.txt" ]; then \
    echo "Error: requirements.txt not found after cloning repository."; \
    exit 1; \
    fi

# Create virtual environment and install dependencies
RUN python3 -m venv venv && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Virtual environment creation and dependency installation happens after cloning

# Verify key packages are installed correctly within the venv
RUN python3 -c "import flask; import replicate; import litellm; import redis; import gunicorn; print('All key packages verified successfully!')"

# Create necessary directories if they don't exist
RUN mkdir -p /app/images /app/metadata

# Setup .env file from example if .env doesn't exist
# This runs as root during build
RUN if [ ! -f ".env" ]; then \
    if [ -f ".env.example" ]; then \
    cp .env.example .env && \
    SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))') && \
    sed -i "s/your_secret_key_here/$SECRET_KEY/" .env && \
    echo ".env created from example."; \
    else \
    echo "Warning: .env.example not found, .env not created."; \
    fi; \
    else \
    echo ".env already exists."; \
    fi

# Create script to start both redis and the app
# Uses environment variables for Gunicorn settings
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting Redis server as root..."\n\
service redis-server start || { echo >&2 "Failed to start redis-server"; exit 1; }\n\
chown -R appuser:appuser /app\n\
# Drop privileges and execute Gunicorn as appuser\n\
echo "Starting Gunicorn as appuser on ${GUNICORN_HOST}:${GUNICORN_PORT} with ${GUNICORN_WORKERS} workers..."\n\
# Use exec to replace the shell process with gunicorn\n\
# Use gosu to switch to the appuser\n\
exec gosu appuser gunicorn --workers ${GUNICORN_WORKERS} --bind ${GUNICORN_HOST}:${GUNICORN_PORT} app:app' > /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

# Change ownership of the app directory to the non-root user
# Do this AFTER all files are created/copied and modified by root
# Change ownership before the final CMD/ENTRYPOINT
# Ensure entrypoint is executable by root initially
RUN chmod +x /app/docker-entrypoint.sh && \
    chown -R appuser:appuser /app

# Do NOT switch user here; the entrypoint script will use gosu to drop privileges.
# USER appuser

# Expose the port the app runs on
EXPOSE ${GUNICORN_PORT}

# Run the entrypoint script when the container launches
CMD ["/app/docker-entrypoint.sh"]
