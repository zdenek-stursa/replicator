# Specification: Aspect Ratio Selection on Frontend

**Author:** Roo (Architect Mode)
**Date:** 2025-04-09
**Status:** Approved for Implementation

## Goal

Allow the user to select a predefined aspect ratio (including "custom") for models that support `width` and `height` parameters. The frontend will automatically calculate `width` and `height` based on the model's maximum allowed width, or allow manual setting. The aspect ratio value itself is not sent to the API, only the calculated `width` and `height`.

## Implementation Steps

1.  **Detect W/H Support and Insert UI:**
    *   In `generateFormFields`, if the model supports both `width` and `height`:
        *   Insert `<select id="aspectRatioSelect">` with defined `<option>` values (21:9, 16:9, ..., custom).
        *   Add descriptive labels to relevant `<option>`s (e.g., `1:1 (Square)`, `9:16 (Portrait/Story)`).
        *   The original `div`s containing the form elements (sliders/inputs) for `width` and `height` will be hidden by default (`display: none;`), but remain in the DOM.

2.  **Calculation and Update Logic (event listener on `change` for `#aspectRatioSelect`):**
    *   **If the value `"custom"` is selected:**
        *   Show the hidden `div`s with the controls for `width` and `height`.
    *   **If a specific aspect ratio is selected (e.g., `"16:9"`):**
        *   Ensure the `div`s with the controls for `width` and `height` are hidden.
        *   **Get the base dimension:** Retrieve the maximum allowed width from the model parameters (`schema.properties.width.maximum`). Fallback: 1024 or the default `width` value.
        *   **Calculate `width` and `height`:** Based on the ratio and maximum width.
        *   **Verify model constraints:** Check `minimum`, `maximum`, and `multipleOf` for both `width` and `height`. Adjust values if necessary (clamp, round to multiple).
        *   **Update hidden inputs:** Set the final, validated values into `#param-width` and `#param-height`.

3.  **Data Submission:**
    *   The `generateImage` function will collect the values from the `#param-width` and `#param-height` inputs. The value from `#aspectRatioSelect` **will not** be sent to the API.

4.  **Styling and UX:**
    *   Ensure clarity of the `<select>` menu and labels.
    *   Ensure smooth showing/hiding of sliders when switching to/from "custom".

## Flow Diagram

```mermaid
graph TD
    subgraph Frontend
        A[User selects model] --> B{Model supports W/H?};
        B -- Yes --> C[Show <select id="aspectRatioSelect">, hide W/H elements];
        B -- No --> D[Show standard parameters];
        C --> E{User changes <select>};
        E -- Selected "custom" --> F[Show W/H elements];
        E -- Selected ratio X:Y --> G[JS: Get max W from schema];
        G --> H[JS: Calculate W/H based on ratio and max W];
        H --> I[JS: Verify model constraints (min/max/multipleOf) for W & H];
        I --> J[JS: Update hidden inputs #param-width, #param-height];
        J --> K[Hide W/H elements];
        F --> L[User sets W/H manually];
        L --> M[User clicks Generate];
        K --> M;
        J --> M;
        D --> M;
        M --> N[JS: Collect all .model-param (including W/H)];
        N --> O[Send /api/generate-image];
    end
    subgraph Backend
        O --> P[Receive request with parameters];
        P --> Q[Use W/H to call Replicate API];
    end
```

## Required Aspect Ratios

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
<option value="custom">Custom</option>