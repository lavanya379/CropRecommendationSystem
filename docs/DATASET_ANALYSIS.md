# COMPREHENSIVE DATASET ANALYSIS REPORT
**System:** An Explainable Climate-Aware Crop Recommendation System with Market Intelligence  
**Document Code:** DOC-DS-2026-V1  
**Generated:** October 2026  

---

## 1. PRIMARY TRAINING DATASET: `Crop_recommendation.csv`
* **File Location:** `data/extracted/crop_recommendation/Crop_recommendation.csv`
* **Total Rows:** 2,200
* **Total Columns:** 8
* **Missing Values:** 0 (0.00%)
* **Duplicate Rows:** 0 (0.00%)
* **Target Column:** `label` (Multi-class Classification)
* **Classes (22 Crops):** `rice`, `maize`, `chickpea`, `kidneybeans`, `pigeonpeas`, `mothbeans`, `mungbean`, `blackgram`, `lentil`, `pomegranate`, `banana`, `mango`, `grapes`, `watermelon`, `muskmelon`, `apple`, `orange`, `papaya`, `coconut`, `cotton`, `jute`, `coffee` (Exactly 100 samples per crop, perfectly balanced).

### Feature Inventory & Statistical Summary:
| Feature | Data Type | Min | Mean | Max | Unit | Description |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`N`** | Integer | 0 | 50.55 | 140 | kg/ha | Nitrogen content ratio in soil |
| **`P`** | Integer | 5 | 53.36 | 145 | kg/ha | Phosphorus content ratio in soil |
| **`K`** | Integer | 5 | 48.15 | 205 | kg/ha | Potassium content ratio in soil |
| **`temperature`** | Float | 8.83 | 25.62 | 43.68 | °C | Ambient atmospheric temperature |
| **`humidity`** | Float | 14.26 | 71.48 | 99.98 | % | Relative humidity percentage |
| **`ph`** | Float | 3.50 | 6.47 | 9.94 | - | Soil pH balance (acidity/alkalinity) |
| **`rainfall`** | Float | 20.21 | 103.46 | 298.56 | mm | Seasonal precipitation |
| **`label`** | String | - | - | - | - | Recommended agricultural crop name |

---

## 2. MARKET INTELLIGENCE DATASET: `Price_Agriculture_commodities_Week.csv`
* **File Location:** `data/extracted/market_prices/Price_Agriculture_commodities_Week.csv`
* **Total Rows:** 2,120
* **Total Columns:** 10
* **Missing Values:** 0 (0.00%)
* **Duplicate Rows:** 0 (0.00%)
* **Geographical Scope:** Andhra Pradesh (1,116 records) & Telangana (1,004 records)
* **Commodities Represented (82 Types):** Green Chilli, Groundnut, Turmeric, Paddy(Dhan)(Common), Black Gram, Lemon, Jowar, Maize, Bengal Gram, Gur/Jaggery, Cotton, Red Gram, Tomato, Onion, etc.

### Column Definitions & Target Mapping:
| Column | Type | Target Database Mapping | Description |
| :--- | :---: | :--- | :--- |
| `State` | String | `market_prices.state` | Indian State (AP / TS) |
| `District` | String | `market_prices.district` | District Name (e.g. Nandyal, Kurnool, Guntur) |
| `Market` | String | `market_prices.market` | Agricultural Produce Market Committee (APMC) |
| `Commodity` | String | `market_prices.commodity` | Crop / Commodity Name |
| `Variety` | String | `market_prices.variety` | Crop cultivar / variety specification |
| `Grade` | String | `market_prices.grade` | Quality classification (e.g. FAQ) |
| `Arrival_Date` | Date | `market_prices.arrival_date` | Mandi transaction arrival date |
| `Min Price` | Float | `market_prices.min_price` | Minimum price (₹ / Quintal) |
| `Max Price` | Float | `market_prices.max_price` | Maximum price (₹ / Quintal) |
| `Modal Price` | Float | `market_prices.modal_price` | Most frequent market benchmark price (₹ / Quintal) |

---

## 3. SOIL CHEMISTRY DATASET: `soil_properties_AP_TS.csv`
* **File Location:** `data/extracted/soil/soil_properties_AP_TS.csv`
* **Total Rows:** 1,992 (996 Andhra Pradesh + 996 Telangana)
* **Total Columns:** 11
* **Missing Values:** 0 (0.00%)
* **Districts Covered:** 50 districts across AP & TS (Nandyal, Kurnool, Kadapa, Anantapur, Guntur, Warangal, Nizamabad, etc.)

### Column Definitions:
* `Soil_Type`: Black Cotton Soil, Red Sandy Loam, Alluvial Soil, Clayey Loam, Laterite Soil.
* `Nitrogen_kg_ha`, `Phosphorus_kg_ha`, `Potassium_kg_ha`: Lab-tested macronutrient ranges.
* `pH`: Soil acidity balance (range 5.8 - 8.4).
* `Organic_Carbon_percent`: Organic matter indicator (0.25% - 0.95%).
* `Soil_Moisture_percent`: Moisture holding capacity (12.0% - 38.0%).
* `EC_dS_m`: Electrical Conductivity (salinity level).

---

## 4. RAINFALL & WEATHER DATASET: `daily-rainfall-at-state-level.csv`
* **File Location:** `data/extracted/weather/daily-rainfall-at-state-level.csv`
* **Total Rows:** 2,000
* **Total Columns:** 8
* **Missing Values:** `actual` (82 missing), `deviation` (83 missing). Cleaned using state-level normal benchmarks (`normal` & `rfs`).
* **Attributes:** `date`, `state_code`, `state_name`, `actual`, `rfs`, `normal`, `deviation`. Used for regional drought-risk and precipitation suitability scoring.

---

## 5. FEATURE MAPPING ARCHITECTURE

```
[Raw Dataset]                    [MySQL Storage]               [ML Inference Engine]             [Farmer Application Feature]
Crop_recommendation.csv (N)    → soil_records.nitrogen       → X_input['N']                    → Soil Chemical Balance
Crop_recommendation.csv (P)    → soil_records.phosphorus     → X_input['P']                    → Soil Fertility Profiling
Crop_recommendation.csv (K)    → soil_records.potassium      → X_input['K']                    → Potassium Nutrient Index
Crop_recommendation.csv (ph)   → soil_records.ph             → X_input['ph']                   → Soil pH Optimization
Crop_recommendation.csv (temp) → weather_records.temperature → X_input['temperature']          → Live Climate Adaptation
Crop_recommendation.csv (hum)  → weather_records.humidity    → X_input['humidity']             → Moisture/Humidity Index
Crop_recommendation.csv (rain) → weather_records.rainfall    → X_input['rainfall']             → Drought & Water Planning
Price_Agri_commodities (Modal) → market_prices.modal_price   → Post-Inference Economic Filter  → Real-Time Mandi Pricing (₹/Q)
soil_properties_AP_TS          → benchmarks.soil_lookup      → Fallback Imputation             → Regional Soil Matching
```
