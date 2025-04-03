# Implementation Flow

## Core Classes and Methods

### 1. ModelManager (api/model_manager.py)

```python
class ModelManager:
    def __init__(self):
        self.models = {}
        self.cache = ModelCache()
    
    def initialize(self):
        """Načte modely z REPLICATE_MODELS a inicializuje cache"""
        models = self._parse_env_models()
        for model in models:
            self._validate_and_cache_model(model)
    
    def get_model(self, model_id):
        """Vrátí metadata modelu včetně parametrů"""
        if model_id not in self.models:
            raise ModelNotFoundError(f"Model {model_id} not found")
        return self.models[model_id]
    
    def _parse_env_models(self):
        """Parsuje REPLICATE_MODELS proměnnou"""
        models_str = os.getenv("REPLICATE_MODELS", "")
        if not models_str:
            raise ConfigError("REPLICATE_MODELS not configured")
        return [m.strip() for m in models_str.split(",")]
    
    def _validate_and_cache_model(self, model_id):
        """Validuje model a ukládá jeho parametry do cache"""
        if not self._is_valid_model_format(model_id):
            raise ValidationError(f"Invalid model format: {model_id}")
        
        params = replicate_client.get_model_params(model_id)
        self.cache.store(model_id, params)
        self.models[model_id] = {
            "id": model_id,
            "parameters": params,
            "cached_at": datetime.now()
        }
```

### 2. ReplicateClient (api/replicate_client.py)

```python
class ReplicateClient:
    def __init__(self, api_token):
        self.client = replicate.Client(api_token)
        self.param_cache = {}
    
    def get_model_params(self, model_id):
        """Získá parametry modelu z API nebo cache"""
        if model_id in self.param_cache:
            return self._get_from_cache(model_id)
        
        model = self.client.models.get(model_id)
        version = model.latest_version()
        params = self._extract_parameters(version)
        
        self._cache_parameters(model_id, params)
        return params
    
    def run_model(self, model_id, inputs):
        """Spustí model s validovanými vstupy"""
        self._validate_inputs(model_id, inputs)
        return self.client.run(model_id, input=inputs)
    
    def _extract_parameters(self, version):
        """Extrahuje a normalizuje parametry z verze modelu"""
        schema = version.openapi_schema
        return self._normalize_params(schema["components"]["schemas"]["Input"])
```

### 3. FormGenerator (api/form_generator.py)

```python
class FormGenerator:
    def __init__(self):
        self.template_env = Environment(
            loader=FileSystemLoader("templates")
        )
    
    def create_form(self, model_params):
        """Generuje HTML formulář z parametrů modelu"""
        elements = []
        for param in model_params:
            element = self._create_form_element(param)
            elements.append(element)
        
        return self.template_env.get_template("model_form.html").render(
            elements=elements
        )
    
    def _create_form_element(self, param):
        """Vytváří HTML element podle typu parametru"""
        element_type = self._get_element_type(param)
        return {
            "name": param["name"],
            "type": element_type,
            "required": param.get("required", False),
            "default": param.get("default"),
            "description": param.get("description", ""),
            "constraints": self._get_constraints(param)
        }
```

## Integration Flow

### 1. Application Startup

```python
def initialize_app():
    # Inicializace komponent
    model_manager = ModelManager()
    model_manager.initialize()
    
    form_generator = FormGenerator()
    
    app.config["model_manager"] = model_manager
    app.config["form_generator"] = form_generator
```

### 2. Request Handling

```python
@app.route("/models/<model_id>", methods=["GET"])
def get_model_form(model_id):
    model_manager = app.config["model_manager"]
    form_generator = app.config["form_generator"]
    
    try:
        model = model_manager.get_model(model_id)
        form_html = form_generator.create_form(model["parameters"])
        return render_template(
            "model_page.html",
            form=form_html,
            model=model
        )
    except ModelNotFoundError:
        return {"error": "Model not found"}, 404

@app.route("/generate", methods=["POST"])
def generate_image():
    model_id = request.form["model_id"]
    inputs = request.form.to_dict()
    
    try:
        # Vylepšení promptu
        enhanced_prompt = prompt_enhancer.improve(inputs["prompt"])
        
        # Překlad do angličtiny
        translated_prompt = translator.to_english(enhanced_prompt)
        inputs["prompt"] = translated_prompt
        
        # Spuštění modelu
        result = replicate_client.run_model(model_id, inputs)
        
        # Uložení výsledku
        image_path = storage.save_image(result["image"])
        metadata = {
            "model_id": model_id,
            "inputs": inputs,
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        storage.save_metadata(image_path, metadata)
        
        return {"success": True, "image_path": image_path}
    except Exception as e:
        return {"error": str(e)}, 400
```

## Error Handling

```python
class ModelError(Exception):
    """Základní třída pro chyby související s modely"""
    pass

class ModelNotFoundError(ModelError):
    """Model nebyl nalezen"""
    pass

class ValidationError(ModelError):
    """Neplatný vstup nebo formát"""
    pass

class ConfigError(ModelError):
    """Chyba v konfiguraci"""
    pass

def handle_model_error(error):
    """Globální handler pro chyby modelů"""
    return {
        "error": str(error),
        "type": error.__class__.__name__
    }, 400
```

## Frontend Integration

```javascript
// static/js/main.js

class ModelForm {
    constructor(formElement) {
        this.form = formElement;
        this.bindEvents();
    }
    
    bindEvents() {
        this.form.addEventListener("submit", this.handleSubmit.bind(this));
        this.form.addEventListener("change", this.validateField.bind(this));
    }
    
    async handleSubmit(event) {
        event.preventDefault();
        
        if (!this.validateAll()) {
            return;
        }
        
        const formData = new FormData(this.form);
        try {
            const response = await fetch("/generate", {
                method: "POST",
                body: formData
            });
            
            const result = await response.json();
            if (result.error) {
                this.showError(result.error);
            } else {
                this.showResult(result.image_path);
            }
        } catch (error) {
            this.showError("Failed to generate image");
        }
    }
    
    validateField(event) {
        const field = event.target;
        const constraints = JSON.parse(field.dataset.constraints || "{}");
        const isValid = this.checkConstraints(field.value, constraints);
        
        field.setCustomValidity(isValid ? "" : "Invalid value");
        field.reportValidity();
    }
}