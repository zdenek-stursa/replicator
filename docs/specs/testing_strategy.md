# Testing Strategy

## Unit Tests

### ModelManager Tests

```python
def test_model_manager_initialization():
    """Test correct loading of models from env variable"""
    os.environ["REPLICATE_MODELS"] = "owner/model1:v1,owner/model2:v2"
    manager = ModelManager()
    manager.initialize()

    assert len(manager.models) == 2
    assert "owner/model1" in manager.models
    assert "owner/model2" in manager.models

def test_invalid_model_format():
    """Test detection of invalid model format"""
    os.environ["REPLICATE_MODELS"] = "invalid-model-format"
    manager = ModelManager()

    with pytest.raises(ValidationError):
        manager.initialize()

def test_model_cache():
    """Test caching of model parameters"""
    manager = ModelManager()
    # Assuming _validate_and_cache_model uses a mock or fixture for replicate_client
    manager._validate_and_cache_model("owner/model:v1")

    assert manager.cache.has("owner/model:v1")
    cached_data = manager.cache.get("owner/model:v1") # Assuming cache stores data structure
    assert "parameters" in cached_data # Adjust based on actual cache structure
```

### ReplicateClient Tests

```python
def test_parameter_extraction():
    """Test parameter extraction from OpenAPI schema"""
    client = ReplicateClient("test-token")
    # Mocking the version object or providing a fixture
    mock_version = MagicMock()
    mock_version.openapi_schema = {
        "components": {
            "schemas": {
                "Input": {
                    "type": "object",
                    "properties": {
                        "prompt": {
                            "type": "string",
                            "description": "Text prompt"
                        },
                        "width": {
                            "type": "integer",
                            "minimum": 64,
                            "maximum": 1024
                        }
                    },
                    "required": ["prompt"] # Example required field
                }
            }
        }
    }

    # Assuming _normalize_params is part of the client or tested separately
    params = client._extract_parameters(mock_version)
    assert len(params) == 2
    assert any(p["name"] == "prompt" and p["required"] for p in params)
    assert any(p["name"] == "width" and p["constraints"]["minimum"] == 64 for p in params)


def test_input_validation():
    """Test validation of input parameters"""
    client = ReplicateClient("test-token")
    model_id = "owner/model:v1"
    # Mock get_model_params or provide schema fixture
    client.param_cache[model_id] = [ # Simplified cached params for validation
         {"name": "width", "type": "integer", "constraints": {"minimum": 64, "maximum": 1024}}
    ]

    invalid_inputs = {
        "width": 2048  # Outside allowed range
    }

    with pytest.raises(ValidationError):
        client._validate_inputs(model_id, invalid_inputs) # Assuming _validate_inputs uses cached params
```

### FormGenerator Tests

```python
def test_form_generation():
    """Test HTML form generation"""
    generator = FormGenerator() # Assuming template env is set up
    params = [
        {
            "name": "prompt",
            "type": "string",
            "required": True,
            "description": "Your prompt"
        },
        {
            "name": "width",
            "type": "integer",
            "required": False,
            "default": 512,
            "constraints": {
                "minimum": 64,
                "maximum": 1024
            },
            "description": "Image width"
        }
    ]

    form_html = generator.create_form(params)
    assert 'name="prompt"' in form_html
    assert 'required' in form_html # Check for required attribute on prompt input
    assert 'min="64"' in form_html # Check for min attribute on width input
    assert 'value="512"' in form_html # Check for default value on width input
```

## Integration Tests

```python
# Assuming Flask app and TestClient are set up (e.g., in conftest.py)
# Assuming necessary mocks for external APIs (Replicate, OpenAI)

def test_end_to_end_flow(client, mocker):
    """Test complete image generation process"""
    # Mock external calls
    mocker.patch("api.replicate_client.ReplicateClient.get_model_params", return_value=[...]) # Provide mock params
    mocker.patch("api.replicate_client.ReplicateClient.run_model", return_value={"image": "output_url"})
    mocker.patch("api.llm_client.improve_prompt", return_value="enhanced prompt")
    mocker.patch("api.translator.translate", return_value="translated prompt")
    mocker.patch("utils.storage.save_image", return_value="saved_image.png")
    mocker.patch("utils.storage.save_metadata")
    mocker.patch("os.path.exists", return_value=True) # Mock file existence checks

    # 1. Get form for model (Optional, depends on frontend interaction)
    # response = client.get("/models/owner/model:v1")
    # assert response.status_code == 200
    # assert "form" in response.text # Check if form elements are present

    # 2. Generate image
    data = {
        "model_id": "owner/model:v1", # Use a model configured in tests
        "prompt": "test prompt",
        "width": 512
    }
    response = client.post("/generate", data=data)
    assert response.status_code == 200
    result = response.json()
    assert "image_path" in result
    assert result["image_path"] == "saved_image.png"

    # 3. Verify storage calls (using mocks)
    utils.storage.save_image.assert_called_once_with("output_url")
    utils.storage.save_metadata.assert_called_once()
    # os.path.exists assertions might be redundant if mocks cover storage interaction

def test_prompt_enhancement_flow(client, mocker):
    """Test prompt enhancement and translation"""
    # Mock external calls
    mock_improve = mocker.patch("api.openai_client.improve_prompt", return_value="enhanced prompt")
    mock_translate = mocker.patch("api.translator.translate", return_value="translated prompt")
    mocker.patch("api.replicate_client.ReplicateClient.run_model", return_value={"image": "url"})
    mocker.patch("utils.storage.save_image", return_value="img.png")
    mocker.patch("utils.storage.save_metadata")

    data = {
        "model_id": "owner/model:v1",
        "prompt": "original czech prompt" # Original prompt in Czech
    }

    response = client.post("/generate", data=data)
    assert response.status_code == 200

    mock_improve.assert_called_once_with("original czech prompt")
    mock_translate.assert_called_once_with("enhanced prompt")
    # Check if translated prompt was used in run_model call
    run_call_args = api.replicate_client.ReplicateClient.run_model.call_args
    assert run_call_args[1]['input']['prompt'] == "translated prompt"

```

## Error Handling Tests

```python
def test_invalid_model_handling(client, mocker):
    """Test handling of non-existent model"""
    # Mock ModelManager to raise error
    mocker.patch("api.model_manager.ModelManager.get_model", side_effect=ModelNotFoundError)

    # Test endpoint that uses get_model, e.g., fetching form
    response = client.get("/models/invalid-model") # Or trigger via /generate if needed
    assert response.status_code == 404
    assert "error" in response.json()
    assert "Model not found" in response.json()["error"]


def test_invalid_input_handling(client, mocker):
    """Test handling of invalid inputs"""
     # Mock param validation within run_model or a dedicated validation step
    mocker.patch("api.replicate_client.ReplicateClient._validate_inputs", side_effect=ValidationError("Invalid width"))

    data = {
        "model_id": "owner/model:v1",
        "prompt": "test",
        "width": "invalid"  # Should be a number, triggers validation error
    }
    response = client.post("/generate", data=data)
    assert response.status_code == 400 # Expecting Bad Request
    assert "error" in response.json()
    assert "Invalid width" in response.json()["error"] # Check specific error
```

## Performance Tests

```python
# These might require more setup, potentially mocking time or external calls

def test_cache_performance(mocker):
    """Test parameter caching performance"""
    # Mock Replicate API call
    mock_fetch = mocker.patch("api.replicate_client.ReplicateClient._fetch_from_api", return_value={"params": [...]})
    manager = ModelManager() # Assuming ModelManager uses ReplicateClient

    # First load - should hit the API mock
    start = time.time()
    params1 = manager.get_model_params("owner/model:v1") # Method might differ
    api_time = time.time() - start
    mock_fetch.assert_called_once()

    # Second load - should come from cache
    start = time.time()
    params2 = manager.get_model_params("owner/model:v1")
    cache_time = time.time() - start

    # Assert fetch was not called again
    mock_fetch.assert_called_once() # Still called only once
    assert cache_time < api_time
    assert cache_time < 0.01  # Cache should be very fast

def test_concurrent_requests(client, mocker):
    """Test handling of concurrent requests"""
    # Mock potentially slow operations like Replicate API call
    mocker.patch("api.replicate_client.ReplicateClient.run_model", return_value={"image": "url"}, side_effect=lambda *args, **kwargs: time.sleep(0.1)) # Simulate delay
    mocker.patch("utils.storage.save_image", return_value="img.png")
    mocker.patch("utils.storage.save_metadata")

    def make_request():
        # Use a unique prompt per request if needed, or ensure idempotency
        return client.post("/generate", data={
            "model_id": "owner/model:v1",
            "prompt": f"test_{random.random()}"
        })

    num_requests = 10
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_requests) as executor:
        futures = [executor.submit(make_request) for _ in range(num_requests)]
        responses = [f.result() for f in concurrent.futures.wait(futures)[0]] # Get results

    assert len(responses) == num_requests
    assert all(r.status_code == 200 for r in responses)
    # Add checks for rate limiting if applicable
```

## Test Data

```json
// fixtures/model_params.json
{
    "owner/model:v1": {
        "parameters": [
            {
                "name": "prompt",
                "type": "string",
                "required": true,
                "description": "Text prompt for image generation"
            },
            {
                "name": "width",
                "type": "integer",
                "required": false,
                "default": 512,
                "constraints": {
                    "minimum": 64,
                    "maximum": 1024
                },
                 "description": "Width of the image"
            },
            {
                "name": "height",
                "type": "integer",
                "required": false,
                "default": 512,
                "constraints": {
                    "minimum": 64,
                    "maximum": 1024
                },
                "description": "Height of the image"
            }
        ],
        "description": "A sample model for testing"
    }
}
```

## Test Coverage Goals

1. Unit Tests:
- ModelManager: 95% coverage
- ReplicateClient: 90% coverage (excluding direct API calls, focus on logic)
- FormGenerator: 95% coverage

2. Integration Tests:
- API Endpoints: 100% coverage (ensure all routes are hit)
- Error Handlers: 100% coverage (ensure error paths are tested)

3. Critical Paths:
- Model Loading
- Form Generation
- Prompt Processing (Enhancement & Translation)
- Result Storage

## Continuous Integration

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3 # Use newer version
      - name: Set up Python
        uses: actions/setup-python@v4 # Use newer version
        with:
          python-version: '3.9' # Or your target version
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-mock # Add mock if needed
      - name: Run tests
        run: |
          pytest --cov=./ --cov-report=xml --cov-fail-under=90 # Example coverage threshold
      - name: Upload coverage reports to Codecov
        uses: codecov/codecov-action@v3 # Use newer version
        with:
          token: ${{ secrets.CODECOV_TOKEN }} # Optional: if private repo
          fail_ci_if_error: true # Optional: fail CI if upload fails