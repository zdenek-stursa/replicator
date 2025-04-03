# Replicate AI Image Generator

Web aplikace pro generování obrázků pomocí AI modelů s automatickým překladem promptů do angličtiny.

## Instalace

1. Naklonujte repozitář:
```bash
git clone https://github.com/pendialek/replicate-ai.git
cd replicate-ai
```

2. Vytvořte a aktivujte virtuální prostředí:
```bash
python3 -m venv venv
source venv/bin/activate  # Na Windows: .\venv\Scripts\activate
```

3. Nainstalujte závislosti:
```bash
pip install -r requirements.txt
```

4. Vytvořte soubor .env podle vzoru .env.example a doplňte potřebné API klíče:
```bash
cp .env.example .env
```
   - **Důležité:** V souboru `.env` nastavte proměnnou `REPLICATE_MODELS` se seznamem modelů z Replicate, které chcete používat. Modely oddělujte čárkou (např. `owner/model-name:version,another/model:version`). Viz `.env.example` pro formát.

## Konfigurace modelů

Aplikace načítá seznam dostupných modelů pro generování z proměnné prostředí `REPLICATE_MODELS` definované v souboru `.env`.

Formát je seznam identifikátorů modelů oddělených čárkou:
```
REPLICATE_MODELS=identifikator_modelu_1,identifikator_modelu_2,...
```
Identifikátor by měl být ve formátu `vlastnik/nazev-modelu:verze` (verze je volitelná, pokud není uvedena, použije se nejnovější).

Uživatelské rozhraní pak dynamicky načte parametry pro každý vybraný model přímo z Replicate API a zobrazí odpovídající formulář.

## Spuštění pro vývoj

```bash
./app.sh --debug # Nebo: FLASK_ENV=development python app.py
```

## Produkční nasazení

1. Nastavte produkční proměnné v .env:
```env
FLASK_ENV=production
SECRET_KEY=your-secure-secret-key
RATELIMIT_STORAGE_URL=redis://localhost:6379/0
```

2. Spusťte aplikaci pomocí Gunicorn:
```bash
gunicorn --bind 0.0.0.0:5000 --workers 4 app:app
```

## Funkce

- Generování obrázků pomocí různých AI modelů (konfigurovatelných přes `.env`)
- Dynamické načítání a zobrazení parametrů pro vybraný model
- Automatický překlad promptů do angličtiny pomocí ChatGPT
- Vylepšování promptů pomocí ChatGPT
- Rate limiting pro ochranu API
- Bezpečnostní hlavičky a CORS ochrana
- Logování do souboru s rotací

## Rate Limity

- Generování obrázků: 5 požadavků/minutu
- Vylepšování promptů: 10 požadavků/minutu
- Listování galerie: 30 požadavků/minutu
- Stahování obrázků: 60 požadavků/minutu

## Zabezpečení

- HTTPS v produkci
- Rate limiting
- Bezpečnostní hlavičky
- CORS ochrana
- Bezpečné cookie nastavení
