import pytest
import json
from unittest.mock import patch, MagicMock
import os

# Expected REPLICATE_MODELS format in .env
MOCK_REPLICATE_MODELS_ENV = "stability-ai/sdxl:1.0,another/model:2.1,owner/name-only"
# Expected output for /api/models (list of IDs)
EXPECTED_RAW_MODELS_LIST = MOCK_REPLICATE_MODELS_ENV.split(',')

# Mock schema for model detail
MOCK_MODEL_SCHEMA = {
    "openapi_schema": {
        "components": { "schemas": { "Input": { "type": "object", "properties": { "prompt": {"type": "string"} } } } }
    },
    "description": "Mock model description"
}

# Fixture for Flask test client with patching instance methods
@pytest.fixture
def client():
    env_vars = {
        "REPLICATE_API_TOKEN": "dummy_replicate_token",
        "OPENAI_API_KEY": "dummy_openai_key",
        "LLM_MODEL": "gpt-4",
    }
    # Patch env variables BEFORE importing app
    with patch.dict(os.environ, env_vars, clear=True):
        # Import app and its components HERE
        from app import app as flask_app, model_cache, replicate_client, llm_client, image_manager, metadata_manager

        # Override config after app initialization
        flask_app.config['REPLICATE_MODELS'] = EXPECTED_RAW_MODELS_LIST
        flask_app.config['REPLICATE_API_TOKEN'] = "dummy_replicate_token"
        flask_app.config['LLM_API_KEY'] = "dummy_openai_key"
        flask_app.config['LLM_MODEL'] = "gpt-4"
        flask_app.config['IMAGE_STORAGE_PATH'] = '/tmp/test_images'
        flask_app.config['METADATA_STORAGE_PATH'] = '/tmp/test_metadata'

        # Clear cache before each test
        model_cache.clear()

        flask_app.config.update({"TESTING": True})

        # Patch METHODS on imported INSTANCES
        with patch.object(replicate_client, 'get_model_details', autospec=True) as mock_get_details, \
             patch.object(replicate_client, 'generate_image', autospec=True) as mock_generate_image, \
             patch.object(llm_client, 'translate_to_english', autospec=True) as mock_translate, \
             patch.object(llm_client, 'improve_prompt', autospec=True) as mock_improve, \
             patch.object(image_manager, 'save_image_from_file', autospec=True) as mock_save_image, \
             patch.object(metadata_manager, 'save_metadata', autospec=True) as mock_save_meta, \
             patch.object(metadata_manager, 'list_images', autospec=True) as mock_list_images, \
             patch.object(metadata_manager, 'get_metadata', autospec=True) as mock_get_meta, \
             patch.object(image_manager, 'delete_image', autospec=True) as mock_delete_image, \
             patch.object(metadata_manager, 'delete_metadata', autospec=True) as mock_delete_meta:

            # Create test client
            with flask_app.test_client() as test_client:
                # Yield client and dictionary with mocked METHODS
                yield test_client, {
                    "get_model_details": mock_get_details,
                    "generate_image": mock_generate_image,
                    "translate_to_english": mock_translate,
                    "improve_prompt": mock_improve,
                    "save_image_from_file": mock_save_image,
                    "save_metadata": mock_save_meta,
                    "list_images": mock_list_images,
                    "get_metadata": mock_get_meta,
                    "delete_image": mock_delete_image,
                    "delete_metadata": mock_delete_meta,
                }

# --- Tests for /api/models endpoint ---

def test_get_models_success(client):
    """Tests successful retrieval of the model list."""
    test_client, _ = client
    response = test_client.get('/api/models')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert sorted(data['models']) == sorted(EXPECTED_RAW_MODELS_LIST)

# --- Tests for /api/models/{model_id} endpoint ---

def test_get_model_details_endpoint_success(client):
    """Tests successful retrieval of model details."""
    test_client, mocks = client
    model_id_to_test = EXPECTED_RAW_MODELS_LIST[0]
    mocks["get_model_details"].return_value = MOCK_MODEL_SCHEMA
    response = test_client.get(f'/api/models/{model_id_to_test}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data == MOCK_MODEL_SCHEMA
    mocks["get_model_details"].assert_called_once_with(model_id_to_test)

def test_get_model_details_endpoint_not_found_in_config(client):
    """Tests the case where model_id is not in REPLICATE_MODELS."""
    test_client, mocks = client
    invalid_model_id = "non/existent-model"
    response = test_client.get(f'/api/models/{invalid_model_id}')
    assert response.status_code == 404
    data = json.loads(response.data)
    assert 'error' in data
    assert 'not found or not configured' in data['message'] # Check message
    mocks["get_model_details"].assert_not_called()

def test_get_model_details_endpoint_api_failure(client):
    """Tests the case where replicate_client.get_model_details returns None."""
    test_client, mocks = client
    model_id_to_test = EXPECTED_RAW_MODELS_LIST[1]
    mocks["get_model_details"].return_value = None
    response = test_client.get(f'/api/models/{model_id_to_test}')
    assert response.status_code == 502 # Expect 502 according to app.py
    data = json.loads(response.data)
    assert 'error' in data
    assert 'Failed to fetch model details' in data['message'] # Check message
    mocks["get_model_details"].assert_called_once_with(model_id_to_test)

def test_get_model_details_endpoint_caching(client):
     """Tests if the result is cached."""
     test_client, mocks = client
     model_id_to_test = EXPECTED_RAW_MODELS_LIST[2]
     mocks["get_model_details"].return_value = MOCK_MODEL_SCHEMA
     response1 = test_client.get(f'/api/models/{model_id_to_test}')
     assert response1.status_code == 200
     mocks["get_model_details"].assert_called_once_with(model_id_to_test)
     data1 = json.loads(response1.data)
     assert data1 == MOCK_MODEL_SCHEMA
     call_count_before = mocks["get_model_details"].call_count
     response2 = test_client.get(f'/api/models/{model_id_to_test}')
     assert response2.status_code == 200
     data2 = json.loads(response2.data)
     assert data2 == MOCK_MODEL_SCHEMA
     assert mocks["get_model_details"].call_count == call_count_before

# --- Tests for /api/generate-image endpoint ---

def test_generate_image_endpoint_success(client):
    """Tests successful image generation with dynamic parameters."""
    test_client, mocks = client
    model_id_to_test = EXPECTED_RAW_MODELS_LIST[0]
    original_prompt = "Cat on the roof"
    translated_prompt = "Cat on the roof"
    input_parameters = {"negative_prompt": "dog", "width": 1024, "height": 768}
    # Use the path returned from ImageManager (which is mocked)
    mock_image_full_path = "/tmp/test_images/mock_image.webp"
    mock_image_filename = "mock_image.webp"
    mock_metadata_filename = "mock_image.json"

    mocks["translate_to_english"].return_value = translated_prompt
    mocks["generate_image"].return_value = {
        'status': 'success', 'image_path': "/tmp/some_temp_replicate_file.webp", 'metadata': {}
    }
    # Mock save_image_from_file returns the full path
    mocks["save_image_from_file"].return_value = mock_image_full_path
    mocks["save_metadata"].return_value = mock_metadata_filename

    request_data = {
        "prompt": original_prompt, "model_id": model_id_to_test, "parameters": input_parameters
    }
    response = test_client.post('/api/generate-image', json=request_data)

    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'success'
    assert data['image_id'] == 'mock_image'
    assert data['image_url'] == f'/images/{mock_image_filename}'

    mocks["translate_to_english"].assert_called_once_with(original_prompt)
    mocks["generate_image"].assert_called_once_with(
        prompt=translated_prompt, model_id=model_id_to_test, input_params=input_parameters
    )
    # Verify that save_image received the path from generate_image
    mocks["save_image_from_file"].assert_called_once_with("/tmp/some_temp_replicate_file.webp")
    # Verify that save_metadata received the correct filename and metadata
    mocks["save_metadata"].assert_called_once()
    saved_meta_call_args = mocks["save_metadata"].call_args[0]
    assert saved_meta_call_args[0] == mock_image_filename # First argument is image_filename
    saved_metadata = saved_meta_call_args[1] # Second argument is metadata
    assert saved_metadata['original_prompt'] == original_prompt
    assert saved_metadata['translated_prompt'] == translated_prompt
    assert saved_metadata['model_id'] == model_id_to_test
    assert saved_metadata['parameters'] == input_parameters

def test_generate_image_endpoint_missing_prompt(client):
    """Tests for 400 error if 'prompt' is missing."""
    test_client, mocks = client
    model_id_to_test = EXPECTED_RAW_MODELS_LIST[0]
    request_data = {
        # "prompt": "missing",
        "model_id": model_id_to_test,
        "parameters": {}
    }
    response = test_client.post('/api/generate-image', json=request_data)
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data
    assert data['error'] == 'Bad request' # Check general error
    assert 'Prompt is required' in data['message'] # Check message
    mocks["translate_to_english"].assert_not_called()
    mocks["generate_image"].assert_not_called()

def test_generate_image_endpoint_missing_model_id(client):
    """Tests for 400 error if 'model_id' is missing."""
    test_client, mocks = client
    request_data = {
        "prompt": "Some prompt",
        # "model_id": "missing",
        "parameters": {}
    }
    response = test_client.post('/api/generate-image', json=request_data)
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data
    assert data['error'] == 'Bad request' # Check general error
    assert 'Model ID is required' in data['message'] # Check message
    mocks["translate_to_english"].assert_not_called()
    mocks["generate_image"].assert_not_called()

def test_generate_image_endpoint_invalid_model_id(client):
    """Tests for 400 error if 'model_id' is not in configuration."""
    test_client, mocks = client
    invalid_model_id = "invalid/model"
    request_data = {
        "prompt": "Some prompt",
        "model_id": invalid_model_id,
        "parameters": {}
    }
    response = test_client.post('/api/generate-image', json=request_data)
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data
    assert data['error'] == 'Bad request' # Check general error
    assert 'not found or not configured' in data['message'] # Check message
    mocks["translate_to_english"].assert_not_called()
    mocks["generate_image"].assert_not_called()


# --- Tests for parsing REPLICATE_MODELS (covered by /api/models test) ---