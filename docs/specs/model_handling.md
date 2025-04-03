# Model Handling Specification

## Overview
Specifikace definuje způsob načítání a správy Replicate modelů v aplikaci.

## Components

### ModelManager
Třída zodpovědná za:
- Načítání modelů z REPLICATE_MODELS
- Validaci modelů
- Poskytování informací o modelech ostatním komponentám

### ReplicateClient
Rozšířená verze klienta pro:
- Získávání parametrů modelů
- Cachování parametrů pro optimalizaci
- Validaci vstupů podle schématu modelu

### FormGenerator 
Komponenta pro:
- Dynamické generování HTML formulářů
- Validaci vstupů na frontendu
- Zobrazování nápovědy a omezení parametrů

## Data Flow

1. Startup Flow:
```
ModelManager.initialize():
    models = parse_env_models(REPLICATE_MODELS)
    for model in models:
        validate_model_format(model)
        cache_model_params(model)
    return validated_models

ReplicateClient.get_model_params(model_id):
    if params in cache:
        return cached_params
    params = fetch_from_api(model_id)
    validate_params(params)
    cache_params(model_id, params)
    return params

FormGenerator.create_form(model_params):
    validate_param_schema(model_params)
    generate_html_elements()
    attach_validators()
    return form_html
```

2. Runtime Flow:
```
handle_model_selection(model_id):
    model = model_manager.get_model(model_id)
    params = replicate_client.get_model_params(model_id)
    form = form_generator.create_form(params)
    return form

handle_model_execution(model_id, user_inputs):
    validate_inputs(model_id, user_inputs)
    enhanced_prompt = prompt_enhancer.improve(user_inputs.prompt)
    translated_prompt = translator.to_english(enhanced_prompt)
    result = replicate_client.run_model(model_id, {
        ...user_inputs,
        prompt: translated_prompt
    })
    store_results(result)
    return result
```

## Error Handling

1. Model Loading Errors:
- Invalid model format in REPLICATE_MODELS
- Nedostupné API
- Neplatná odpověď z API

2. Runtime Errors:
- Neplatné vstupy od uživatele
- Selhání modelu
- Chyby při ukládání

## Validation

1. Model Validation:
- Formát: "owner/model:version"
- Existence modelu v Replicate
- Dostupnost verze

2. Parameter Validation:
- Typy parametrů
- Rozsahy hodnot
- Povinné vs. volitelné parametry

## Storage

1. Cache:
```
{
    "model_id": {
        "params": {...},
        "fetched_at": timestamp,
        "version": "v1.2.3"
    }
}
```

2. Model Metadata:
```
{
    "id": "model_id",
    "name": "Model Name",
    "version": "v1.2.3",
    "description": "...",
    "parameters": {...}
}
```

## Integration Points

1. Frontend:
- Dynamické formuláře (/templates/index.html)
- JavaScript validace (static/js/main.js)
- API endpointy pro metadata modelů

2. Backend:
- ModelManager napojený na app.py
- ReplicateClient rozšíření v api/replicate_client.py
- Integrace s existující funkcionalitou ukládání a vylepšování promptů