# Testing Strategy

## Unit Tests

### ModelManager Tests

```python
def test_model_manager_initialization():
    """Test správného načtení modelů z env proměnné"""
    os.environ["REPLICATE_MODELS"] = "owner/model1:v1,owner/model2:v2"
    manager = ModelManager()
    manager.initialize()
    
    assert len(manager.models) == 2
    assert "owner/model1" in manager.models
    assert "owner/model2" in manager.models

def test_invalid_model_format():
    """Test detekce neplatného formátu modelu"""
    os.environ["REPLICATE_MODELS"] = "invalid-model-format"
    manager = ModelManager()
    
    with pytest.raises(ValidationError):
        manager.initialize()

def test_model_cache():
    """Test cachování parametrů modelu"""
    manager = ModelManager()
    manager._validate_and_cache_model("owner/model:v1")
    
    assert manager.cache.has("owner/model:v1")
    cached_params = manager.cache.get("owner/model:v1")
    assert "parameters" in cached_params
```

### ReplicateClient Tests

```python
def test_parameter_extraction():
    """Test extrakce parametrů z OpenAPI schématu"""
    client = ReplicateClient("test-token")
    schema = {
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
                    }
                }
            }
        }
    }
    
    params = client._extract_parameters(schema)
    assert len(params) == 2
    assert params[0]["name"] == "prompt"
    assert params[1]["name"] == "width"
    assert params[1]["constraints"]["min"] == 64

def test_input_validation():
    """Test validace vstupních parametrů"""
    client = ReplicateClient("test-token")
    model_id = "owner/model:v1"
    
    invalid_inputs = {
        "width": 2048  # Mimo povolený rozsah
    }
    
    with pytest.raises(ValidationError):
        client._validate_inputs(model_id, invalid_inputs)
```

### FormGenerator Tests

```python
def test_form_generation():
    """Test generování HTML formuláře"""
    generator = FormGenerator()
    params = [
        {
            "name": "prompt",
            "type": "string",
            "required": True
        },
        {
            "name": "width",
            "type": "integer",
            "required": False,
            "default": 512,
            "constraints": {
                "min": 64,
                "max": 1024
            }
        }
    ]
    
    form_html = generator.create_form(params)
    assert 'name="prompt"' in form_html
    assert 'required' in form_html
    assert 'min="64"' in form_html
    assert 'value="512"' in form_html
```

## Integration Tests

```python
def test_end_to_end_flow():
    """Test kompletního procesu generování obrázku"""
    client = TestClient(app)
    
    # 1. Získání formuláře pro model
    response = client.get("/models/owner/model:v1")
    assert response.status_code == 200
    assert "form" in response.text
    
    # 2. Generování obrázku
    data = {
        "model_id": "owner/model:v1",
        "prompt": "test prompt",
        "width": 512
    }
    response = client.post("/generate", data=data)
    assert response.status_code == 200
    result = response.json()
    assert "image_path" in result
    
    # 3. Ověření uložení
    image_path = result["image_path"]
    assert os.path.exists(f"images/{image_path}")
    assert os.path.exists(f"metadata/{image_path}.json")

def test_prompt_enhancement_flow():
    """Test vylepšení a překladu promptu"""
    client = TestClient(app)
    
    data = {
        "model_id": "owner/model:v1",
        "prompt": "červené auto na pláži"
    }
    
    with mock.patch("api.openai_client.improve_prompt") as mock_improve:
        with mock.patch("api.translator.translate") as mock_translate:
            mock_improve.return_value = "nové červené sportovní auto na písečné pláži"
            mock_translate.return_value = "new red sports car on sandy beach"
            
            response = client.post("/generate", data=data)
            assert response.status_code == 200
            
            mock_improve.assert_called_once()
            mock_translate.assert_called_once()
```

## Error Handling Tests

```python
def test_invalid_model_handling():
    """Test ošetření neexistujícího modelu"""
    client = TestClient(app)
    response = client.get("/models/invalid-model")
    assert response.status_code == 404

def test_invalid_input_handling():
    """Test ošetření neplatných vstupů"""
    client = TestClient(app)
    data = {
        "model_id": "owner/model:v1",
        "width": "invalid"  # Mělo by být číslo
    }
    response = client.post("/generate", data=data)
    assert response.status_code == 400
    assert "error" in response.json()
```

## Performance Tests

```python
def test_cache_performance():
    """Test výkonu cachování parametrů"""
    manager = ModelManager()
    
    # První načtení - mělo by jít na API
    start = time.time()
    params1 = manager.get_model("owner/model:v1")
    api_time = time.time() - start
    
    # Druhé načtení - mělo by jít z cache
    start = time.time()
    params2 = manager.get_model("owner/model:v1")
    cache_time = time.time() - start
    
    assert cache_time < api_time
    assert cache_time < 0.01  # Cache by měla být velmi rychlá

def test_concurrent_requests():
    """Test zvládání souběžných požadavků"""
    client = TestClient(app)
    
    def make_request():
        return client.post("/generate", data={
            "model_id": "owner/model:v1",
            "prompt": "test"
        })
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(make_request) for _ in range(10)]
        responses = [f.result() for f in futures]
    
    assert all(r.status_code == 200 for r in responses)
```

## Test Data

```python
# fixtures/model_params.json
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
                    "min": 64,
                    "max": 1024
                }
            },
            {
                "name": "height",
                "type": "integer",
                "required": false,
                "default": 512,
                "constraints": {
                    "min": 64,
                    "max": 1024
                }
            }
        ]
    }
}
```

## Test Coverage Goals

1. Unit Tests:
- ModelManager: 95% coverage
- ReplicateClient: 90% coverage
- FormGenerator: 95% coverage

2. Integration Tests:
- API Endpoints: 100% coverage
- Error Handlers: 100% coverage

3. Kritické Cesty:
- Načítání modelů
- Generování formulářů
- Zpracování promptů
- Ukládání výsledků

## Continuous Integration

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov
      - name: Run tests
        run: |
          pytest --cov=./ --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v2