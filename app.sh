#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Helper Functions ---
check_venv() {
    if [ ! -d "venv" ]; then
        echo "Error: Virtual environment 'venv' not found."
        echo "Please run '$0 --install' first."
        exit 1
    fi
    # Check if essential files exist (using -f instead of -x due to persistent permission/executability issues)
    if [ ! -f "venv/bin/python3" ] || [ ! -f "venv/bin/pip" ]; then
        echo "Error: Virtual environment 'venv' seems incomplete (missing python3 or pip)."
        echo "Consider removing the 'venv' directory and running '$0 --install' again."
        exit 1
    fi
}

check_app_py() {
    if [ ! -f "app.py" ]; then
        echo "Error: Main application file 'app.py' not found in the current directory."
        exit 1
    fi
}

# --- Main Script Logic ---

# Check the first argument passed to the script
case "$1" in
  --production)
    echo "--- Running app.py in PRODUCTION mode using Gunicorn ---"
    check_venv
    check_app_py

    # Check if gunicorn is installed and executable
    if [ ! -f "venv/bin/gunicorn" ]; then # Check existence (-f) instead of executability (-x)
        echo "Error: Gunicorn not found or not executable in venv."
        echo "Ensure 'gunicorn' is listed in requirements.txt and run '$0 --install'."
        exit 1
    fi

    # Define default host and port
    DEFAULT_HOST="0.0.0.0"
    DEFAULT_PORT="8000"
    HOST=$DEFAULT_HOST
    PORT=$DEFAULT_PORT

    # Check if .env file exists and source it to load variables
    if [ -f ".env" ]; then
        echo "Loading environment variables from .env file..."
        # Source the .env file - use '.' for POSIX compatibility
        # Use set -a/+a to export variables for the gunicorn process
        set -a
        . ./.env
        set +a

        # Override defaults if variables are set in .env
        HOST="${GUNICORN_HOST:-$DEFAULT_HOST}"
        PORT="${GUNICORN_PORT:-$DEFAULT_PORT}"
    else
        echo "No .env file found, using default host ($DEFAULT_HOST) and port ($DEFAULT_PORT)."
    fi

    BIND_ADDRESS="${HOST}:${PORT}"
    echo "Starting Gunicorn on $BIND_ADDRESS..."

    # Run Gunicorn from the virtual environment
    # Assumes Flask app object is named 'app' in 'app.py'
    venv/bin/python3 -m gunicorn --bind "$BIND_ADDRESS" app:app
    ;;

  --debug)
    echo "--- Running app.py in DEBUG mode using Flask development server ---"
    check_venv
    check_app_py

    # Check if flask is installed and executable
    if [ ! -f "venv/bin/flask" ]; then # Check existence (-f) instead of executability (-x)
        echo "Error: Flask CLI not found or not executable in venv."
        echo "Ensure 'Flask' is listed in requirements.txt and run '$0 --install'."
        exit 1
    fi

    # Set Flask environment to development for debug mode
    export FLASK_ENV=development
    export FLASK_DEBUG=1 # Can be enabled if needed

    echo "Starting Flask development server (typically on http://127.0.0.1:5000)..."
    # Run Flask development server from the virtual environment
    venv/bin/python3 -m flask run
    ;;

  --install)
    echo "--- Starting Installation Process ---"
    # Check if script is run as root
    if [ "$(id -u)" -ne 0 ]; then
        echo "Error: This installation script must be run as root (use sudo)."
        exit 1
    fi

    # Ensure SUDO_USER is set (should be when using sudo)
    if [ -z "$SUDO_USER" ]; then
        echo "Error: Could not determine the original user. Please run using 'sudo $0 --install'."
        exit 1
    fi

    echo "Updating package lists..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq || { echo "Error: Failed to update package lists."; exit 1; }

    echo "Installing system dependencies (python3, pip, venv, redis, git, build-essential)..."
    apt-get install -y -qq python3 python3-pip python3-venv redis-server git build-essential || {
        echo "Error: Failed to install system dependencies."
        exit 1
    }
    echo "System dependencies installed successfully."

    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment 'venv'..."
        # Run as the original user to avoid permission issues later
        sudo -u "$SUDO_USER" python3 -m venv venv || { echo "Error: Failed to create virtual environment."; exit 1; }
        # Ensure the created venv belongs to the original user
        chown -R "$SUDO_USER:$SUDO_USER" venv || { echo "Error: Failed to change venv ownership."; exit 1; }
        echo "Virtual environment created and ownership set."
    else
        echo "Virtual environment 'venv' already exists."
    fi

    # Check requirements file
    if [ ! -f "requirements.txt" ]; then
        echo "Error: requirements.txt not found."
        exit 1
    fi

    echo "Upgrading pip and installing Python requirements from requirements.txt..."
    # Run pip install as the original user using python -m pip to bypass potential noexec
    sudo -u "$SUDO_USER" venv/bin/python3 -m pip install --upgrade pip -q || { echo "Error: Failed to upgrade pip."; exit 1; }
    sudo -u "$SUDO_USER" venv/bin/python3 -m pip install -r requirements.txt -q || {
        echo "Error: Failed to install Python requirements from requirements.txt."
        exit 1
    }
    echo "Python requirements installed successfully."

    echo "Ensuring venv ownership..."
    # Ensure venv still belongs to the user after pip install
    chown -R "$SUDO_USER:$SUDO_USER" venv || { echo "Error: Failed to change venv ownership after pip install."; exit 1; }
    # Removed chmod attempts as they failed due to likely 'noexec' mount option

    echo "Verifying key Python package installations..."
    sudo -u "$SUDO_USER" venv/bin/python3 -c "
import sys
try:
    import flask
    import replicate
    import litellm
    import redis
    import gunicorn
    print('All key packages verified successfully!')
except ImportError as e:
    print(f'Error: Verification failed. Missing package: {e.name}', file=sys.stderr)
    sys.exit(1)
" || {
        echo "Error: Some required Python packages seem to be missing after installation."
        exit 1
    }

    echo "Creating necessary directories (images, metadata)..."
    # Create directories as the original user
    sudo -u "$SUDO_USER" mkdir -p images
    sudo -u "$SUDO_USER" mkdir -p metadata

    # Setup .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            echo "Creating .env file from .env.example..."
            sudo -u "$SUDO_USER" cp .env.example .env
            # Generate random secret key
            SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
            # Replace placeholder with generated secret key using sudo with the user's context
            sudo -u "$SUDO_USER" sed -i "s/your_secret_key_here/$SECRET_KEY/" .env
            echo "Created .env file. Please update API keys (REPLICATE_API_TOKEN, OPENAI_API_KEY) in .env."
        else
            echo "Warning: .env.example not found. Cannot create .env automatically."
            echo "Please create a .env file manually with necessary configurations."
        fi
    else
        echo ".env file already exists."
    fi

    echo "Setting correct file permissions..."
    # Change ownership recursively first
    chown -R "$SUDO_USER:$SUDO_USER" .
    # Set directory permissions (owner rwx, group rx, others rx)
    find . -type d -exec chmod 755 {} \;
    # Set file permissions (owner rw, group r, others r)
    find . -type f -exec chmod 644 {} \;
    # Specific permissions for sensitive files/scripts
    chmod 755 ./app.sh # Ensure script is executable
    if [ -f ".env" ]; then
        chmod 600 .env # Restrict access to .env
    fi
    echo "File permissions set."

    echo "Configuring and starting Redis server..."
    systemctl enable redis-server || echo "Warning: Failed to enable Redis on boot."
    systemctl start redis-server || { echo "Error: Failed to start Redis server."; exit 1; }
    # Check Redis status briefly
    if ! systemctl is-active --quiet redis-server; then
        echo "Error: Redis server failed to start or is not active."
        exit 1
    fi
    echo "Redis server started and enabled."

    echo ""
    echo "--- Installation completed successfully! ---"
    echo "Please review and configure your API keys in the .env file if needed."
    echo "You can start the application in debug mode using: ./app.sh --debug"
    echo "Or in production mode using: ./app.sh --production"
    ;;

  *)
    echo "Usage: $0 {--production|--debug|--install}"
    echo "  --production : Run the application using Gunicorn (for production)."
    echo "  --debug      : Run the application using Flask's development server (for debugging)."
    echo "  --install    : Install system dependencies, Python packages, and setup environment (requires sudo)."
    exit 1
    ;;
esac

exit 0
