import pytest
import json
from unittest.mock import patch, MagicMock
import os
import time
import tempfile # Import for temporary files
import shutil # For cleanup

# Mock schema for model detail (similar to unit tests)
MOCK_MODEL_SCHEMA = {
    "openapi_schema": {
        "components": { "schemas": { "Input": { "type": "object", "properties": {
            "prompt": {"type": "string"},
            "negative_prompt": {"type": "string"},
            "width": {"type": "integer"},
            "height": {"type": "integer"},
        } } } }
    },
    "description": "Mock integration model description"
}

# Fixture for integration tests - creates temporary directories
@pytest.fixture
def integration_client():
    # Create temporary directories for storage
    temp_image_dir = tempfile.mkdtemp(prefix="repl_test_images_")
    temp_metadata_dir = tempfile.mkdtemp(prefix="repl_test_metadata_")

    # Set necessary env variables - use current models from .env
    current_models = os.environ.get('REPLICATE_MODELS', 'black-forest-labs/flux-1.1-pro-ultra,black-forest-labs/flux-1.1-pro')
    env_vars = {
        "REPLICATE_API_TOKEN": "dummy_replicate_token_integration",
        "OPENAI_API_KEY": "dummy_openai_key_integration",
        "REPLICATE_MODELS": current_models,
        "IMAGE_STORAGE_PATH": temp_image_dir,
        "METADATA_STORAGE_PATH": temp_metadata_dir,
    }
    # Patch env variables BEFORE importing app
    with patch.dict(os.environ, env_vars, clear=True):
        # Import app and its components HERE
        from app import app as flask_app, model_cache, replicate_client, llm_client, image_manager, metadata_manager

        # Clear cache before each test
        model_cache.clear()

        flask_app.config.update({
            "TESTING": True,
            "IMAGE_STORAGE_PATH": temp_image_dir,
            "METADATA_STORAGE_PATH": temp_metadata_dir
        })

        # Reinitialize managers with correct paths
        from utils.storage import ImageManager, MetadataManager
        image_manager.__init__(temp_image_dir)
        metadata_manager.__init__(temp_metadata_dir)

        # Patch only external API calls
        with patch.object(replicate_client, 'get_model_details', autospec=True) as mock_get_details, \
             patch.object(replicate_client, 'generate_image', autospec=True) as mock_generate_image, \
             patch.object(llm_client, 'translate_to_english', autospec=True) as mock_translate, \
             patch.object(llm_client, 'improve_prompt', autospec=True) as mock_improve:

            # Create test client
            with flask_app.test_client() as test_client:
                # Yield client and dictionary with mocked API calls
                yield test_client, {
                    "get_model_details": mock_get_details,
                    "generate_image": mock_generate_image,
                    "translate_to_english": mock_translate,
                    "improve_prompt": mock_improve,
                    "image_dir": temp_image_dir,
                    "metadata_dir": temp_metadata_dir,
                }

    # Cleanup: Remove temporary directories after the test finishes
    shutil.rmtree(temp_image_dir, ignore_errors=True)
    shutil.rmtree(temp_metadata_dir, ignore_errors=True)


# --- Integration Tests ---

def test_full_flow_dynamic_params(integration_client):
    """
    Integrační test:
    1. Získá seznam modelů.
    2. Získá detaily (parametry) pro jeden model.
    3. Vytvoří dočasný soubor pro simulaci výstupu z Replicate.
    4. Odešle požadavek na generování s dynamickými parametry.
    5. Ověří volání API a výslednou odpověď.
    6. Ověří uložení obrázku a metadat (kontrola existence souborů).
    """
    test_client, mocks = integration_client
    # Use the first model from current configuration
    current_models = os.environ.get('REPLICATE_MODELS', 'black-forest-labs/flux-1.1-pro-ultra').split(',')
    model_id_to_use = current_models[0].strip()
    original_prompt = "Integrační test kočky"
    translated_prompt = "Integration test cat"
    dynamic_params = {"negative_prompt": "pes", "guidance_scale": 7}
    mock_replicate_image_path = None # Initialization

    try:
        # --- Step 3: Create temporary file (in binary mode) ---
        # Use mkstemp to get path and file descriptor
        fd, mock_replicate_image_path = tempfile.mkstemp(suffix=".webp")
        with os.fdopen(fd, 'wb') as tmp_file:
            tmp_file.write(b"dummy image data") # Write binary data

        # --- Mock configuration for this test ---
        mocks["get_model_details"].return_value = MOCK_MODEL_SCHEMA
        mocks["translate_to_english"].return_value = translated_prompt
        mocks["generate_image"].return_value = {
            'status': 'success',
            'image_path': mock_replicate_image_path, # Path to our temporary file
            'metadata': {}
        }

        # --- Step 1: Get list of models ---
        response_models = test_client.get('/api/models')
        assert response_models.status_code == 200
        models_data = json.loads(response_models.data)
        assert models_data['models'] == os.environ['REPLICATE_MODELS'].split(',')
        assert model_id_to_use in models_data['models']


        # --- Step 2: Get model details ---
        response_details = test_client.get(f'/api/models/{model_id_to_use}')
        assert response_details.status_code == 200
        details_data = json.loads(response_details.data)
        assert details_data == MOCK_MODEL_SCHEMA
        mocks["get_model_details"].assert_called_once_with(model_id_to_use)

        # --- Step 4: Generate image ---
        request_data = {
            "prompt": original_prompt,
            "model_id": model_id_to_use,
            "parameters": dynamic_params
        }
        response_generate = test_client.post('/api/generate-image', json=request_data)

        # --- Step 5: Verify response and API calls ---
        assert response_generate.status_code == 200
        generate_data = json.loads(response_generate.data)
        assert generate_data['status'] == 'success'
        assert 'image_id' in generate_data
        image_id = generate_data['image_id']
        assert generate_data['image_url'] == f'/images/{image_id}.webp'

        mocks["translate_to_english"].assert_called_once_with(original_prompt)
        mocks["generate_image"].assert_called_once_with(
            prompt=translated_prompt,
            model_id=model_id_to_use,
            input_params=dynamic_params
        )

        # --- Step 6: Verify file saving ---
        # Files are saved to the configured directories from environment variables
        image_path = os.path.join(os.environ['IMAGE_STORAGE_PATH'], f"{image_id}.webp")
        metadata_path = os.path.join(os.environ['METADATA_STORAGE_PATH'], f"{image_id}.json")

        # Give the system a moment to save the files
        time.sleep(0.1) # Revert to shorter wait

        # Now the files should exist
        assert os.path.exists(image_path), f"Image file not found at: {image_path}"
        assert os.path.exists(metadata_path), f"Metadata file not found at: {metadata_path}"

        # Check metadata content
        with open(metadata_path, 'r') as f:
            saved_metadata = json.load(f)
        assert saved_metadata['original_prompt'] == original_prompt
        assert saved_metadata['translated_prompt'] == translated_prompt
        assert saved_metadata['model_id'] == model_id_to_use
        assert saved_metadata['parameters'] == dynamic_params
        assert saved_metadata['image_filename'] == f"{image_id}.webp"

    finally:
        # Cleanup temporary file created in the test, if it exists
        if mock_replicate_image_path and os.path.exists(mock_replicate_image_path):
            os.remove(mock_replicate_image_path)


