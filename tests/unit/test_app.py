import pytest
import json
from unittest.mock import patch, MagicMock
import os

# Předpokládaný formát REPLICATE_MODELS v .env
MOCK_REPLICATE_MODELS_ENV = "stability-ai/sdxl:1.0,another/model:2.1,owner/name-only"
# Očekávaný výstup pro /api/models (seznam ID)
EXPECTED_RAW_MODELS_LIST = MOCK_REPLICATE_MODELS_ENV.split(',')

# Mock schéma pro detail modelu
MOCK_MODEL_SCHEMA = {
    "openapi_schema": {
        "components": { "schemas": { "Input": { "type": "object", "properties": { "prompt": {"type": "string"} } } } }
    },
    "description": "Mock model description"
}

# Fixture pro Flask test klienta s patchováním metod instancí
@pytest.fixture
def client():
    env_vars = {
        "REPLICATE_API_TOKEN": "dummy_replicate_token",
        "OPENAI_API_KEY": "dummy_openai_key",
    }
    # Patchujeme env proměnné PŘED importem app
    with patch.dict(os.environ, env_vars, clear=True):
        # Importujeme app a jeho komponenty ZDE
        from app import app as flask_app, model_cache, replicate_client, openai_client, image_manager, metadata_manager

        # Přepíšeme config po inicializaci app
        flask_app.config['REPLICATE_MODELS'] = EXPECTED_RAW_MODELS_LIST
        flask_app.config['REPLICATE_API_TOKEN'] = "dummy_replicate_token"
        flask_app.config['OPENAI_API_KEY'] = "dummy_openai_key"
        flask_app.config['IMAGE_STORAGE_PATH'] = '/tmp/test_images'
        flask_app.config['METADATA_STORAGE_PATH'] = '/tmp/test_metadata'

        # Vyčistíme cache před každým testem
        model_cache.clear()

        flask_app.config.update({"TESTING": True})

        # Patchujeme METODY na importovaných INSTANCÍCH
        with patch.object(replicate_client, 'get_model_details', autospec=True) as mock_get_details, \
             patch.object(replicate_client, 'generate_image', autospec=True) as mock_generate_image, \
             patch.object(openai_client, 'translate_to_english', autospec=True) as mock_translate, \
             patch.object(openai_client, 'improve_prompt', autospec=True) as mock_improve, \
             patch.object(image_manager, 'save_image_from_file', autospec=True) as mock_save_image, \
             patch.object(metadata_manager, 'save_metadata', autospec=True) as mock_save_meta, \
             patch.object(metadata_manager, 'list_images', autospec=True) as mock_list_images, \
             patch.object(metadata_manager, 'get_metadata', autospec=True) as mock_get_meta, \
             patch.object(image_manager, 'delete_image', autospec=True) as mock_delete_image, \
             patch.object(metadata_manager, 'delete_metadata', autospec=True) as mock_delete_meta:

            # Vytvoříme test klienta
            with flask_app.test_client() as test_client:
                # Yield klienta a slovník s mockovanými METODAMI
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

# --- Testy pro endpoint /api/models ---

def test_get_models_success(client):
    """Testuje úspěšné získání seznamu modelů."""
    test_client, _ = client
    response = test_client.get('/api/models')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert sorted(data['models']) == sorted(EXPECTED_RAW_MODELS_LIST)

# --- Testy pro endpoint /api/models/{model_id} ---

def test_get_model_details_endpoint_success(client):
    """Testuje úspěšné získání detailů modelu."""
    test_client, mocks = client
    model_id_to_test = EXPECTED_RAW_MODELS_LIST[0]
    mocks["get_model_details"].return_value = MOCK_MODEL_SCHEMA
    response = test_client.get(f'/api/models/{model_id_to_test}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data == MOCK_MODEL_SCHEMA
    mocks["get_model_details"].assert_called_once_with(model_id_to_test)

def test_get_model_details_endpoint_not_found_in_config(client):
    """Testuje případ, kdy model_id není v REPLICATE_MODELS."""
    test_client, mocks = client
    invalid_model_id = "non/existent-model"
    response = test_client.get(f'/api/models/{invalid_model_id}')
    assert response.status_code == 404
    data = json.loads(response.data)
    assert 'error' in data
    assert 'not found or not configured' in data['message'] # Kontrolujeme message
    mocks["get_model_details"].assert_not_called()

def test_get_model_details_endpoint_api_failure(client):
    """Testuje případ, kdy replicate_client.get_model_details vrátí None."""
    test_client, mocks = client
    model_id_to_test = EXPECTED_RAW_MODELS_LIST[1]
    mocks["get_model_details"].return_value = None
    response = test_client.get(f'/api/models/{model_id_to_test}')
    assert response.status_code == 502 # Očekáváme 502 dle app.py
    data = json.loads(response.data)
    assert 'error' in data
    assert 'Failed to fetch model details' in data['message'] # Kontrolujeme message
    mocks["get_model_details"].assert_called_once_with(model_id_to_test)

def test_get_model_details_endpoint_caching(client):
     """Testuje, zda se výsledek cachuje."""
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

# --- Testy pro endpoint /api/generate-image ---

def test_generate_image_endpoint_success(client):
    """Testuje úspěšné generování obrázku s dynamickými parametry."""
    test_client, mocks = client
    model_id_to_test = EXPECTED_RAW_MODELS_LIST[0]
    original_prompt = "Kočka na střeše"
    translated_prompt = "Cat on the roof"
    input_parameters = {"negative_prompt": "dog", "width": 1024, "height": 768}
    # Použijeme cestu vrácenou z ImageManager (která je mockovaná)
    mock_image_full_path = "/tmp/test_images/mock_image.webp"
    mock_image_filename = "mock_image.webp"
    mock_metadata_filename = "mock_image.json"

    mocks["translate_to_english"].return_value = translated_prompt
    mocks["generate_image"].return_value = {
        'status': 'success', 'image_path': "/tmp/some_temp_replicate_file.webp", 'metadata': {}
    }
    # Mock save_image_from_file vrací celou cestu
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
    # Ověříme, že save_image dostal cestu z generate_image
    mocks["save_image_from_file"].assert_called_once_with("/tmp/some_temp_replicate_file.webp")
    # Ověříme, že save_metadata dostal správný filename a metadata
    mocks["save_metadata"].assert_called_once()
    saved_meta_call_args = mocks["save_metadata"].call_args[0]
    assert saved_meta_call_args[0] == mock_image_filename # První argument je image_filename
    saved_metadata = saved_meta_call_args[1] # Druhý argument jsou metadata
    assert saved_metadata['original_prompt'] == original_prompt
    assert saved_metadata['translated_prompt'] == translated_prompt
    assert saved_metadata['model_id'] == model_id_to_test
    assert saved_metadata['parameters'] == input_parameters

def test_generate_image_endpoint_missing_prompt(client):
    """Testuje chybu 400, pokud chybí 'prompt'."""
    test_client, mocks = client
    model_id_to_test = EXPECTED_RAW_MODELS_LIST[0]
    request_data = {
        # "prompt": "chybí",
        "model_id": model_id_to_test,
        "parameters": {}
    }
    response = test_client.post('/api/generate-image', json=request_data)
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data
    assert data['error'] == 'Bad request' # Kontrolujeme obecný error
    assert 'Prompt is required' in data['message'] # Kontrolujeme message
    mocks["translate_to_english"].assert_not_called()
    mocks["generate_image"].assert_not_called()

def test_generate_image_endpoint_missing_model_id(client):
    """Testuje chybu 400, pokud chybí 'model_id'."""
    test_client, mocks = client
    request_data = {
        "prompt": "Nějaký prompt",
        # "model_id": "chybí",
        "parameters": {}
    }
    response = test_client.post('/api/generate-image', json=request_data)
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data
    assert data['error'] == 'Bad request' # Kontrolujeme obecný error
    assert 'Model ID is required' in data['message'] # Kontrolujeme message
    mocks["translate_to_english"].assert_not_called()
    mocks["generate_image"].assert_not_called()

def test_generate_image_endpoint_invalid_model_id(client):
    """Testuje chybu 400, pokud 'model_id' není v konfiguraci."""
    test_client, mocks = client
    invalid_model_id = "neplatny/model"
    request_data = {
        "prompt": "Nějaký prompt",
        "model_id": invalid_model_id,
        "parameters": {}
    }
    response = test_client.post('/api/generate-image', json=request_data)
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data
    assert data['error'] == 'Bad request' # Kontrolujeme obecný error
    assert 'not found or not configured' in data['message'] # Kontrolujeme message
    mocks["translate_to_english"].assert_not_called()
    mocks["generate_image"].assert_not_called()


# --- Testy pro parsování REPLICATE_MODELS (pokryto testem /api/models) ---