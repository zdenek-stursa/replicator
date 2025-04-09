# Specifikace: Výběr poměru stran na frontendu

**Autor:** Roo (Architect Mode)
**Datum:** 2025-04-09
**Stav:** Schváleno k implementaci

## Cíl

Umožnit uživateli vybrat předdefinovaný poměr stran (včetně "custom") pro modely, které podporují parametry `width` a `height`. Frontend automaticky vypočítá `width` a `height` na základě maximální povolené šířky modelu, nebo umožní manuální nastavení. Hodnota poměru stran se neposílá do API, pouze vypočítané `width` a `height`.

## Kroky implementace

1.  **Detekce podpory W/H a vložení UI:**
    *   V `generateFormFields`, pokud model podporuje `width` i `height`:
        *   Vložit `<select id="aspectRatioSelect">` s definovanými `<option>` hodnotami (21:9, 16:9, ..., custom).
        *   Přidat popisky k relevantním `<option>` (např. `1:1 (Square)`, `9:16 (Portrait/Story)`).
        *   Původní `div`y obsahující formulářové prvky (slidery/inputy) pro `width` a `height` budou standardně skryté (`display: none;`), ale zůstanou v DOMu.

2.  **Logika výpočtu a aktualizace (event listener na `change` u `#aspectRatioSelect`):**
    *   **Pokud je vybrána hodnota `"custom"`:**
        *   Zobrazit skryté `div`y s ovládacími prvky pro `width` a `height`.
    *   **Pokud je vybrán konkrétní poměr stran (např. `"16:9"`):**
        *   Zajistit, že `div`y s ovládacími prvky pro `width` a `height` jsou skryté.
        *   **Získat základní rozměr:** Z parametrů modelu získat maximální povolenou šířku (`schema.properties.width.maximum`). Fallback: 1024 nebo výchozí hodnota `width`.
        *   **Vypočítat `width` a `height`:** Na základě poměru a maximální šířky.
        *   **Ověřit omezení modelu:** Zkontrolovat `minimum`, `maximum` a `multipleOf` pro `width` i `height`. Hodnoty případně upravit (oříznout, zaokrouhlit na násobek).
        *   **Aktualizovat skryté inputy:** Nastavit finální, ověřené hodnoty do `#param-width` a `#param-height`.

3.  **Odeslání dat:**
    *   Funkce `generateImage` sesbírá hodnoty z inputů `#param-width` a `#param-height`. Hodnota z `#aspectRatioSelect` se **nebude** posílat do API.

4.  **Styling a UX:**
    *   Zajistit přehlednost `<select>` menu a popisků.
    *   Zajistit plynulé zobrazení/skrytí sliderů při přepínání na/z "custom".

## Diagram toku

```mermaid
graph TD
    subgraph Frontend
        A[Uživatel vybere model] --> B{Model podporuje W/H?};
        B -- Ano --> C[Zobraz <select id="aspectRatioSelect">, skryj W/H prvky];
        B -- Ne --> D[Zobraz standardní parametry];
        C --> E{Uživatel změní <select>};
        E -- Vybráno "custom" --> F[Zobraz W/H prvky];
        E -- Vybrán poměr X:Y --> G[JS: Získat max W z schématu];
        G --> H[JS: Vypočítat W/H dle poměru a max W];
        H --> I[JS: Ověřit omezení modelu (min/max/multipleOf) pro W i H];
        I --> J[JS: Aktualizovat skryté inputy #param-width, #param-height];
        J --> K[Skryj W/H prvky];
        F --> L[Uživatel nastaví W/H manuálně];
        L --> M[Uživatel klikne Generovat];
        K --> M;
        J --> M;
        D --> M;
        M --> N[JS: Sesbírat všechny .model-param (včetně W/H)];
        N --> O[Odeslat /api/generate-image];
    end
    subgraph Backend
        O --> P[Přijmout request s parametry];
        P --> Q[Použít W/H k volání Replicate API];
    end
```

## Požadované poměry stran

```html
<option value="21:9">21:9 (Cinematic)</option>
<option value="16:9">16:9 (Widescreen)</option>
<option value="3:2">3:2</option>
<option value="4:3">4:3</option>
<option value="5:4">5:4</option>
<option value="1:1" selected>1:1 (Square)</option> <!-- Default selected -->
<option value="4:5">4:5 (Portrait)</option>
<option value="3:4">3:4 (Portrait)</option>
<option value="2:3">2:3 (Portrait)</option>
<option value="9:16">9:16 (Tall/Story)</option>
<option value="9:21">9:21 (Tall Cinematic)</option>
<option value="custom">Vlastní (Custom)</option>