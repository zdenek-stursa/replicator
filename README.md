# Replicate AI Image Generator

Web application for generating images using AI models with automatic translation of prompts into English.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/pendialek/replicate-ai.git
cd replicate-ai
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

## Production Deployment

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

- Image generation using various AI models (configurable via `.env`)
- Dynamic loading and display of parameters for the selected model
- Automatic translation of prompts into English using ChatGPT
- Prompt enhancement using ChatGPT
- Rate limiting for API protection
- Security headers and CORS protection
- File logging with rotation

## Rate Limits

- Image generation: 5 requests/minute
- Prompt enhancement: 10 requests/minute
- Gallery listing: 30 requests/minute
- Image download: 60 requests/minute

## Security

- HTTPS in production
- Rate limiting
- Security headers
- CORS protection
- Secure cookie settings
