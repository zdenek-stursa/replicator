from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pythonjsonlogger import jsonlogger
from dotenv import load_dotenv
import logging
import os
import warnings
from functools import wraps
from flask import abort
from logging.handlers import RotatingFileHandler
from werkzeug.exceptions import HTTPException # Import HTTPException

# Suppress Pydantic V2 deprecation warnings from external libraries
warnings.filterwarnings(
    "ignore",
    category=DeprecationWarning,
    module="pydantic._internal._config",
    message="Support for class-based `config` is deprecated.*"
)

# Load environment variables from .env file
load_dotenv()

# Configure logging
logger = logging.getLogger()
log_file = os.getenv('LOG_FILE', 'app.log')
log_level = getattr(logging, os.getenv('LOG_LEVEL', 'INFO'))

# Add file handler with rotation
file_handler = RotatingFileHandler(log_file, maxBytes=1024*1024, backupCount=10)
file_handler.setFormatter(jsonlogger.JsonFormatter())
logger.addHandler(file_handler)

# Add console handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(jsonlogger.JsonFormatter())
logger.addHandler(console_handler)

logger.setLevel(log_level)

# Initialize Flask app
app = Flask(__name__,
    static_folder='static',
    template_folder='templates'
)

# Initialize CORS
CORS(app)

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    storage_uri=os.getenv('RATELIMIT_STORAGE_URL', 'memory://'),
    default_limits=[os.getenv('RATELIMIT_DEFAULT', '30/hour')],
    strategy=os.getenv('RATELIMIT_STRATEGY', 'fixed-window')
)

# Load configuration
app.config.update(
    REPLICATE_API_TOKEN=os.getenv('REPLICATE_API_TOKEN'),
    LLM_API_KEY=os.getenv('OPENAI_API_KEY'),  # Keep OPENAI_API_KEY for backward compatibility
    LLM_MODEL=os.getenv('LLM_MODEL', 'gpt-4'),
    IMAGE_STORAGE_PATH=os.getenv('IMAGE_STORAGE_PATH', os.path.join(os.path.dirname(__file__), 'images')), # Use getenv with default
    METADATA_STORAGE_PATH=os.getenv('METADATA_STORAGE_PATH', os.path.join(os.path.dirname(__file__), 'metadata')), # Use getenv with default
    REPLICATE_MODELS=os.getenv('REPLICATE_MODELS', '').split(',') if os.getenv('REPLICATE_MODELS') else []
)

# Validate required environment variables
if not app.config['REPLICATE_API_TOKEN']:
    raise ValueError("REPLICATE_API_TOKEN environment variable is required")
if not app.config['LLM_API_KEY']:
    raise ValueError("OPENAI_API_KEY environment variable is required (used for LLM operations)")
if not app.config['REPLICATE_MODELS']:
    logger.warning("REPLICATE_MODELS environment variable is not set or empty. Model selection will be unavailable.")

# Import API clients after environment variables are loaded
from api.replicate_client import ReplicateClient
from api.llm_client import LLMClient
from utils.storage import ImageManager, MetadataManager

# Initialize clients and managers
replicate_client = ReplicateClient(app.config['REPLICATE_API_TOKEN'])
llm_client = LLMClient(app.config['LLM_API_KEY'], app.config['LLM_MODEL'])
image_manager = ImageManager(app.config['IMAGE_STORAGE_PATH'])
metadata_manager = MetadataManager(app.config['METADATA_STORAGE_PATH'])

# Ensure storage directories exist
os.makedirs(app.config['IMAGE_STORAGE_PATH'], exist_ok=True)
os.makedirs(app.config['METADATA_STORAGE_PATH'], exist_ok=True)

# --- Model Cache ---
model_cache = {}

# --- Helper Decorator for Model Validation ---
def require_model_id(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        model_id = kwargs.get('model_id')
        # Check against the potentially updated list in app.config
        if model_id not in app.config.get('REPLICATE_MODELS', []):
            logger.warning(f"Attempted to access invalid or non-configured model: {model_id}")
            abort(404, description=f"Model '{model_id}' not found or not configured.")
        return f(*args, **kwargs)
    return decorated_function

# Custom error handlers
@app.errorhandler(400)
def bad_request_error(error):
    """Bad request error handler"""
    logger.warning(f"Bad request: {str(error)}")
    return jsonify({
        'error': 'Bad request',
        'message': str(error.description if hasattr(error, 'description') else error),
        'type': 'BadRequestError'
    }), 400

@app.errorhandler(404)
def not_found_error(error):
    """Not found error handler"""
    logger.warning(f"Not found: {str(error)}")
    return jsonify({
        'error': 'Not found',
        'message': str(error.description if hasattr(error, 'description') else error),
        'type': 'NotFoundError'
    }), 404

@app.errorhandler(429)
def ratelimit_error(error):
    """Rate limit exceeded error handler"""
    logger.warning(f"Rate limit exceeded: {str(error)}")
    return jsonify({
        'error': 'Too many requests',
        'message': 'Rate limit exceeded. Please try again later.',
        'type': 'RateLimitError'
    }), 429

# Change: Error handler for 502
@app.errorhandler(502)
def bad_gateway_error(error):
    """Bad gateway error handler"""
    logger.error(f"Bad gateway: {str(error)}")
    return jsonify({
        'error': 'Bad gateway',
        'message': str(error.description if hasattr(error, 'description') else error),
        'type': 'BadGatewayError'
    }), 502

@app.errorhandler(500)
def internal_error(error):
    """Internal server error handler"""
    logger.error(f"Internal server error: {str(error)}", exc_info=True)
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred',
        'type': 'InternalServerError'
    }), 500

@app.errorhandler(Exception)
def handle_error(error):
    """Global error handler for unhandled exceptions"""
    if isinstance(error, HTTPException):
        return error # Let specific HTTP exceptions pass through

    logger.error(f"Unhandled error occurred: {str(error)}", exc_info=True)
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred',
        'type': error.__class__.__name__
    }), 500

@app.route('/')
def index():
    """Render main page"""
    return render_template('index.html')

@app.route('/health', methods=['GET'])
@limiter.limit("60/minute")
def health_check():
    """Basic health check endpoint"""
    return jsonify({'status': 'healthy'})

@app.route('/api/models', methods=['GET'])
@limiter.limit("60/minute")
def get_models():
    """Return the list of configured Replicate models"""
    logger.info("Fetching list of configured models.")
    return jsonify({'models': app.config.get('REPLICATE_MODELS', [])})

@app.route('/api/models/<path:model_id>', methods=['GET'])
@limiter.limit("30/minute")
@require_model_id
def get_model_details_route(model_id):
    """Get details (parameters) for a specific Replicate model"""
    logger.info(f"Fetching details for model: {model_id}")

    if model_id in model_cache:
        logger.debug(f"Returning cached details for model: {model_id}")
        return jsonify(model_cache[model_id])

    try:
        model_details = replicate_client.get_model_details(model_id)
        if model_details:
            model_cache[model_id] = model_details
            logger.info(f"Successfully fetched and cached details for model: {model_id}")
            return jsonify(model_details)
        else:
            logger.error(f"Could not fetch details for model: {model_id}")
            abort(502, description='Failed to fetch model details from Replicate')

    # Change: Catch only general Exception, HTTPException passes through
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e # Let 502 from the block above pass through
        logger.error(f"Unexpected error fetching model details for {model_id}: {str(e)}", exc_info=True)
        abort(500, description=f'Unexpected error fetching details for model {model_id}')


# Rate-limited endpoints
@app.route('/api/generate-image', methods=['POST'])
@limiter.limit("5/minute")
def generate_image():
    """Generate image endpoint with rate limiting"""
    try:
        data = request.get_json()
        if not data:
             abort(400, description="Invalid JSON payload")

        prompt = data.get('prompt')
        model_id = data.get('model_id')
        parameters = data.get('parameters', {})

        if not prompt:
            logger.warning("Generate image request missing prompt.")
            abort(400, description="Prompt is required")
        if not model_id:
            logger.warning("Generate image request missing model_id.")
            abort(400, description="Model ID is required")
        if model_id not in app.config.get('REPLICATE_MODELS', []):
            logger.warning(f"Generate image request for invalid model: {model_id}")
            abort(400, description=f"Model '{model_id}' not found or not configured.")

        translated_prompt = llm_client.translate_to_english(prompt)

        logger.info(f"Generating image with model '{model_id}' and parameters: {parameters}")
        result = replicate_client.generate_image(
            prompt=translated_prompt,
            model_id=model_id,
            input_params=parameters
        )

        if 'metadata' not in result or not isinstance(result['metadata'], dict):
             result['metadata'] = {}
        result['metadata']['original_prompt'] = prompt
        result['metadata']['translated_prompt'] = translated_prompt
        result['metadata']['model_id'] = model_id
        result['metadata']['parameters'] = parameters

        image_full_path = image_manager.save_image_from_file(result['image_path'])
        image_filename = os.path.basename(image_full_path)
        metadata_filename = metadata_manager.save_metadata(image_filename, result['metadata'])

        return jsonify({
            'status': 'success',
            'image_id': os.path.splitext(image_filename)[0],
            'image_url': f'/images/{image_filename}'
        })

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Unexpected error generating image: {str(e)}", exc_info=True)
        abort(500, description='Unexpected error generating image')


@app.route('/api/improve-prompt', methods=['POST'])
@limiter.limit("10/minute")
def improve_prompt():
    """Improve prompt endpoint with rate limiting"""
    try:
        data = request.get_json()
        if not data:
             abort(400, description="Invalid JSON payload")
        prompt = data.get('prompt')

        if not prompt:
             abort(400, description="Prompt is required")

        improved_prompt = llm_client.improve_prompt(prompt)
        return jsonify({'improved_prompt': improved_prompt})

    except ValueError as e:
        # Handle authentication errors and other validation errors
        logger.error(f"API key or validation error: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Configuration error',
            'message': str(e),
            'type': 'ConfigurationError'
        }), 401  # Use 401 for authentication errors

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error improving prompt: {str(e)}", exc_info=True)
        abort(500, description='Error improving prompt')

@app.route('/api/images', methods=['GET'])
@limiter.limit("30/minute")
def list_images():
    """List images with pagination and rate limiting"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 12))

        result = metadata_manager.list_images(page, per_page)
        return jsonify(result)

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error listing images: {str(e)}", exc_info=True)
        abort(500, description='Error listing images')

@app.route('/api/metadata/<image_id>', methods=['GET'])
@limiter.limit("30/minute")
def get_metadata(image_id):
    """Get metadata for an image with rate limiting"""
    try:
        metadata = metadata_manager.get_metadata(f"{image_id}.json")
        if metadata is None:
            abort(404, description='Metadata not found')
        return jsonify(metadata)

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error getting metadata: {str(e)}", exc_info=True)
        abort(500, description='Error getting metadata')

@app.route('/api/image/<image_id>', methods=['DELETE'])
@limiter.limit("10/minute")
def delete_image(image_id):
    """Delete image and its metadata with rate limiting"""
    try:
        image_filename = f"{image_id}.webp"
        metadata_filename = f"{image_id}.json"

        image_manager.delete_image(image_filename)
        metadata_manager.delete_metadata(metadata_filename)

        return jsonify({'status': 'success'})

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error deleting image: {str(e)}", exc_info=True)
        abort(500, description='Error deleting image')

@app.route('/images/<filename>')
@limiter.limit("60/minute")
def serve_image(filename):
    """Serve image files with rate limiting"""
    safe_path = os.path.join(app.config['IMAGE_STORAGE_PATH'], filename)
    if not os.path.isfile(safe_path):
        abort(404, description="Image not found")
    return send_from_directory(app.config['IMAGE_STORAGE_PATH'], filename)

if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'

    app.run(
        host=host,
        port=port,
        debug=debug
    )