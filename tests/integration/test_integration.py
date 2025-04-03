import pytest
import json
from unittest.mock import patch, MagicMock
import os
import time
import tempfile # Import pro dočasné soubory
import shutil # Pro cleanup

# Mock schéma pro detail modelu (podobné jako v unit testech)
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

# Fixture pro integrační testy - vytváří dočasné adresáře
@pytest.fixture
def integration_client():
    # Vytvoříme dočasné adresáře pro storage
    temp_image_dir = tempfile.mkdtemp(prefix="repl_test_images_")
    temp_metadata_dir = tempfile.mkdtemp(prefix="repl_test_metadata_")

    # Nastavíme potřebné env proměnné
    mock_models_env = "stability-ai/sdxl:1.0,another/model:2.1"
    env_vars = {
        "REPLICATE_API_TOKEN": "dummy_replicate_token_integration",
        "OPENAI_API_KEY": "dummy_openai_key_integration",
        "REPLICATE_MODELS": mock_models_env,
        "IMAGE_STORAGE_PATH": temp_image_dir,
        "METADATA_STORAGE_PATH": temp_metadata_dir,
    }
    # Patchujeme env proměnné PŘED importem app
    with patch.dict(os.environ, env_vars, clear=True):
        # Importujeme app a jeho komponenty ZDE
        from app import app as flask_app, model_cache, replicate_client, openai_client, image_manager, metadata_manager

        # Vyčistíme cache před každým testem
        model_cache.clear()

        flask_app.config.update({"TESTING": True})

        # Patchujeme pouze externí volání API
        with patch.object(replicate_client, 'get_model_details', autospec=True) as mock_get_details, \
             patch.object(replicate_client, 'generate_image', autospec=True) as mock_generate_image, \
             patch.object(openai_client, 'translate_to_english', autospec=True) as mock_translate, \
             patch.object(openai_client, 'improve_prompt', autospec=True) as mock_improve:

            # Vytvoříme test klienta
            with flask_app.test_client() as test_client:
                # Yield klienta a slovník s mockovanými API voláními
                yield test_client, {
                    "get_model_details": mock_get_details,
                    "generate_image": mock_generate_image,
                    "translate_to_english": mock_translate,
                    "improve_prompt": mock_improve,
                    "image_dir": temp_image_dir,
                    "metadata_dir": temp_metadata_dir,
                }

    # Cleanup: Odstraníme dočasné adresáře po skončení testu
    shutil.rmtree(temp_image_dir, ignore_errors=True)
    shutil.rmtree(temp_metadata_dir, ignore_errors=True)


# --- Integrační testy ---

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
    model_id_to_use = "stability-ai/sdxl:1.0"
    original_prompt = "Integrační test kočky"
    translated_prompt = "Integration test cat"
    dynamic_params = {"negative_prompt": "pes", "guidance_scale": 7}
    mock_replicate_image_path = None # Inicializace

    try:
        # --- Krok 3: Vytvoření dočasného souboru (v binárním režimu) ---
        # Použijeme mkstemp pro získání cesty a file descriptoru
        fd, mock_replicate_image_path = tempfile.mkstemp(suffix=".webp")
        with os.fdopen(fd, 'wb') as tmp_file:
            tmp_file.write(b"dummy image data") # Zapíšeme binární data

        # --- Konfigurace mocků pro tento test ---
        mocks["get_model_details"].return_value = MOCK_MODEL_SCHEMA
        mocks["translate_to_english"].return_value = translated_prompt
        mocks["generate_image"].return_value = {
            'status': 'success',
            'image_path': mock_replicate_image_path, # Cesta k našemu dočasnému souboru
            'metadata': {}
        }

        # --- Krok 1: Získání seznamu modelů ---
        response_models = test_client.get('/api/models')
        assert response_models.status_code == 200
        models_data = json.loads(response_models.data)
        assert models_data['models'] == os.environ['REPLICATE_MODELS'].split(',')
        assert model_id_to_use in models_data['models']


        # --- Krok 2: Získání detailů modelu ---
        response_details = test_client.get(f'/api/models/{model_id_to_use}')
        assert response_details.status_code == 200
        details_data = json.loads(response_details.data)
        assert details_data == MOCK_MODEL_SCHEMA
        mocks["get_model_details"].assert_called_once_with(model_id_to_use)

        # --- Krok 4: Generování obrázku ---
        request_data = {
            "prompt": original_prompt,
            "model_id": model_id_to_use,
            "parameters": dynamic_params
        }
        response_generate = test_client.post('/api/generate-image', json=request_data)

        # --- Krok 5: Ověření odpovědi a volání API ---
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

        # --- Krok 6: Ověření uložení souborů ---
        image_path = os.path.join(mocks['image_dir'], f"{image_id}.webp")
        metadata_path = os.path.join(mocks['metadata_dir'], f"{image_id}.json")

        # Dáme systému chvilku na uložení souborů
        time.sleep(0.1) # Vrátíme zpět kratší čekání

        # Nyní by soubory měly existovat
        assert os.path.exists(image_path), f"Image file not found at: {image_path}"
        assert os.path.exists(metadata_path), f"Metadata file not found at: {metadata_path}"

        # Kontrola obsahu metadat
        with open(metadata_path, 'r') as f:
            saved_metadata = json.load(f)
        assert saved_metadata['original_prompt'] == original_prompt
        assert saved_metadata['translated_prompt'] == translated_prompt
        assert saved_metadata['model_id'] == model_id_to_use
        assert saved_metadata['parameters'] == dynamic_params
        assert saved_metadata['image_filename'] == f"{image_id}.webp"

    finally:
        # Cleanup dočasného souboru vytvořeného v testu, pokud existuje
        if mock_replicate_image_path and os.path.exists(mock_replicate_image_path):
            os.remove(mock_replicate_image_path)


# TODO: Přidat integrační test pro ověření původní funkcionality (improve prompt, atd.)
# def test_original_functionality(integration_client):
#    pass