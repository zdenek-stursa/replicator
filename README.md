# Replicate AI Image Generator

Web application for generating images using AI models with automatic translation of prompts into English.

## Automatic installation

1. Clone the repository:
```bash
git clone https://github.com/zdenek-stursa/replicator.git
cd replicator
```

2. Create and activate a virtual environment:
```bash
sudo ./app.sh --install
```

3. Create a .env file based on the .env.example template and fill in the necessary API keys:
```bash
cp .env.example .env
```
   - **Important:** In the `.env` file, set the `REPLICATE_MODELS` variable with a list of models from Replicate that you want to use. Separate models with a comma (e.g., `owner/model-name:version,another/model:version`). See `.env.example` for the format.
   - **Note:** The application uses liteLLM for flexible LLM provider support. Configure your API key for your preferred provider (OpenAI, Anthropic, xAI, etc.) and set the `LLM_MODEL` variable accordingly.

## Manual installation

1. Clone the repository:
```bash
git clone https://github.com/zdenek-stursa/replicator.git
cd replicator
```

2. Create and activate a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a .env file based on the .env.example template and fill in the necessary API keys:
```bash
cp .env.example .env
```
   - **Important:** In the `.env` file, set the `REPLICATE_MODELS` variable with a list of models from Replicate that you want to use. Separate models with a comma (e.g., `owner/model-name:version,another/model:version`). See `.env.example` for the format.
   - **Note:** The application uses liteLLM for flexible LLM provider support. Configure your API key for your preferred provider (OpenAI, Anthropic, xAI, etc.) and set the `LLM_MODEL` variable accordingly.

## Model Configuration

The application loads the list of available models for generation from the `REPLICATE_MODELS` environment variable defined in the `.env` file.

The format is a comma-separated list of model identifiers:
```
REPLICATE_MODELS=model_identifier_1,model_identifier_2,...
```
The identifier should be in the format `owner/model-name:version` (the version is optional; if not provided, the latest version will be used).

The user interface then dynamically loads the parameters for each selected model directly from the Replicate API and displays the corresponding form.

## Running for Development

```bash
./app.sh --debug # Or: FLASK_ENV=development python app.py
```

## Automatic Production Deployment

1. Run the application using Gunicorn:
```bash
./app.sh --production
```

## Manual Production Deployment

1. Set production variables in .env:
```env
FLASK_ENV=production
SECRET_KEY=your-secure-secret-key
RATELIMIT_STORAGE_URL=redis://localhost:6379/0
```

2. Run the application using Gunicorn:
```bash
gunicorn --bind 0.0.0.0:5000 --workers 4 app:app
```

## Features

- **Image Generation**: Generate images using various AI models from Replicate (configurable via `.env`)
- **Model Selection**: Choose from multiple pre-configured models with dynamic parameter loading
- **Multi-LLM Support**: Flexible LLM integration via liteLLM library
  - Automatic translation of prompts into English
  - Prompt enhancement for better image generation
  - Support for multiple providers: OpenAI, Anthropic, xAI, Groq, Mistral, and more
  - Easy model switching via environment configuration
- **Image Gallery**: View previously generated images with metadata and PhotoSwipe lightbox
- **Aspect Ratio Support**: Select from predefined aspect ratios or set custom dimensions
- **Rate Limiting**: Built-in API protection with configurable limits
- **Security**: Security headers, CORS protection, and secure cookie settings
- **Responsive Design**: Works on desktop and mobile devices
- **Comprehensive Logging**: File logging with rotation for debugging and monitoring
- **Modular Frontend Architecture**: ES6 modules for better code organization and maintainability

## LLM Configuration

The application uses liteLLM for flexible LLM provider support. Configure your preferred model via the `LLM_MODEL` environment variable:

```bash
# OpenAI models (default)
LLM_MODEL=gpt-4
LLM_MODEL=gpt-4.1
LLM_MODEL=gpt-4.1-mini
LLM_MODEL=gpt-4.1-nano
LLM_MODEL=gpt-4-turbo
LLM_MODEL=gpt-4o
LLM_MODEL=gpt-4o-mini
LLM_MODEL=gpt-3.5-turbo
LLM_MODEL=o3
LLM_MODEL=o3-mini
LLM_MODEL=o4-mini
LLM_MODEL=o1-mini
LLM_MODEL=o1-preview

# Anthropic Claude
LLM_MODEL=claude-3-opus-20240229
LLM_MODEL=claude-3-sonnet-20240229

# xAI Grok
LLM_MODEL=xai/grok-beta

# Groq
LLM_MODEL=groq/llama3-8b-8192

# Mistral
LLM_MODEL=mistral/mistral-7b-instruct
```

**Note**: Special model versions (e.g., `gpt-4-1-2025-04-14`) are automatically mapped to standard names for compatibility.

## Image Gallery with PhotoSwipe

The application uses PhotoSwipe v5.4.4 for professional image viewing experience:

### Features
- **Keyboard Navigation**: Arrow keys for navigation, Escape to close
- **Touch/Swipe Support**: Full touch gesture support on mobile devices
- **Zoom Functionality**: Zoom up to 3x including 1:1 pixel viewing
- **Proper Aspect Ratios**: Automatic detection of image dimensions to prevent distortion
- **Responsive Design**: Optimized for both desktop and mobile viewing
- **Smooth Animations**: Professional fade transitions and zoom effects

### Technical Implementation
- Uses PhotoSwipe UMD version loaded from CDN
- Automatic image dimension detection using `Image` objects
- Asynchronous loading for optimal performance
- Fallback to new tab if PhotoSwipe fails to load

## Rate Limits

- Image generation: 5 requests/minute
- Prompt enhancement: 10 requests/minute
- Gallery listing: 30 requests/minute
- Image download: 60 requests/minute

## Frontend Architecture

The frontend uses a modular ES6 architecture for better maintainability and code organization:

### JavaScript Modules

- **`constants.js`** - Application constants and configuration
- **`storage.js`** - localStorage management and form state persistence
- **`ui.js`** - UI utilities (error handling, loading states, notifications)
- **`gallery.js`** - Image gallery management and pagination
- **`form-generator.js`** - Dynamic form generation and aspect ratio handling
- **`api-client.js`** - API communication and data fetching
- **`photoswipe-gallery.js`** - PhotoSwipe lightbox integration with automatic image dimension detection
- **`main.js`** - Application initialization and event handling

### Benefits

- **Separation of Concerns**: Each module has a specific responsibility
- **Maintainability**: Smaller, focused files are easier to understand and modify
- **Reusability**: Modules can be imported and used independently
- **Testing**: Individual modules can be tested in isolation
- **Modern Standards**: Uses ES6 import/export syntax

## Security

- Rate limiting
- Security headers
- CORS protection
- Secure cookie settings
