const express = require('express');
const db      = require('../config/database');
const auth    = require('../middleware/auth.middleware');

const router = express.Router();
router.use(auth);

// ── GET /api/insights/climate?region=&crop_type=&year_from=&year_to=
router.get('/climate', async (req, res) => {
  try {
    const { region, crop_type, year_from = 2001, year_to = 2024 } = req.query;

    let where = 'WHERE year BETWEEN ? AND ?';
    const params = [parseInt(year_from), parseInt(year_to)];

    if (region)    { where += ' AND region LIKE ?';    params.push(`%${region}%`); }
    if (crop_type) { where += ' AND crop_type LIKE ?'; params.push(`%${crop_type}%`); }

    // Trend: avg temp + yield by year
    const [trend] = await db.execute(
      `SELECT year,
              ROUND(AVG(avg_temperature_c),2)        AS avg_temp,
              ROUND(AVG(total_precipitation_mm),1)   AS avg_rainfall,
              ROUND(AVG(crop_yield_mt_ha),4)         AS avg_yield,
              ROUND(AVG(co2_emissions_mt),2)         AS avg_co2,
              ROUND(AVG(soil_health_index),4)        AS avg_soil_health,
              COUNT(*)                               AS records
         FROM climate_impact
        ${where}
        GROUP BY year
        ORDER BY year`,
      params
    );

    // Top crops by yield
    const [topCrops] = await db.execute(
      `SELECT crop_type,
              ROUND(AVG(crop_yield_mt_ha),4)   AS avg_yield,
              ROUND(AVG(avg_temperature_c),2)  AS avg_temp,
              ROUND(AVG(total_precipitation_mm),1) AS avg_rainfall,
              COUNT(*)                         AS records
         FROM climate_impact
        WHERE year BETWEEN ? AND ?
        GROUP BY crop_type
        ORDER BY avg_yield DESC
        LIMIT 10`,
      [parseInt(year_from), parseInt(year_to)]
    );

    // Available regions and crops
    const [regions] = await db.execute(`SELECT DISTINCT region FROM climate_impact ORDER BY region`);
    const [crops]   = await db.execute(`SELECT DISTINCT crop_type FROM climate_impact ORDER BY crop_type`);

    // Summary stats
    const [summary] = await db.execute(
      `SELECT COUNT(*)                             AS total_records,
              ROUND(AVG(avg_temperature_c),2)      AS overall_avg_temp,
              ROUND(AVG(crop_yield_mt_ha),4)       AS overall_avg_yield,
              ROUND(AVG(total_precipitation_mm),1) AS overall_avg_rainfall,
              MIN(year)                            AS year_from,
              MAX(year)                            AS year_to
         FROM climate_impact ${where}`,
      params
    );

    return res.json({
      success: true,
      summary: summary[0],
      trend,
      topCrops,
      filters: {
        regions: regions.map(r => r.region),
        cropTypes: crops.map(c => c.crop_type)
      }
    });
  } catch (err) {
    console.error('Climate insights error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch climate insights.' });
  }
});

// ── GET /api/insights/soil?district=&soil_type=
router.get('/soil', async (req, res) => {
  try {
    const { district, soil_type } = req.query;

    let where = 'WHERE 1=1';
    const params = [];
    if (district)  { where += ' AND district LIKE ?';  params.push(`%${district}%`); }
    if (soil_type) { where += ' AND soil_type LIKE ?'; params.push(`%${soil_type}%`); }

    const [benchmarks] = await db.execute(
      `SELECT district, soil_type,
              ROUND(AVG(nitrogen_kg_ha),2)      AS avg_nitrogen,
              ROUND(AVG(phosphorus_kg_ha),2)    AS avg_phosphorus,
              ROUND(AVG(potassium_kg_ha),2)     AS avg_potassium,
              ROUND(AVG(ph),2)                  AS avg_ph,
              ROUND(AVG(organic_carbon_pct),3)  AS avg_organic_carbon,
              ROUND(AVG(soil_moisture_pct),2)   AS avg_moisture,
              COUNT(*)                          AS samples
         FROM soil_benchmarks
        ${where}
        GROUP BY district, soil_type
        ORDER BY district, soil_type
        LIMIT 100`,
      params
    );

    const [soilTypes]  = await db.execute(`SELECT DISTINCT soil_type  FROM soil_benchmarks ORDER BY soil_type`);
    const [districts]  = await db.execute(`SELECT DISTINCT district   FROM soil_benchmarks ORDER BY district`);

    return res.json({
      success: true,
      benchmarks,
      filters: {
        soilTypes: soilTypes.map(s => s.soil_type),
        districts: districts.map(d => d.district)
      },
      total: benchmarks.length
    });
  } catch (err) {
    console.error('Soil insights error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch soil insights.' });
  }
});

// ── GET /api/insights/datasets — summary of all loaded datasets
router.get('/datasets', async (req, res) => {
  try {
    const [[market]]  = await db.execute(`SELECT COUNT(*) AS cnt, MIN(arrival_date) AS from_date, MAX(arrival_date) AS to_date FROM market_prices`);
    const [[soil]]    = await db.execute(`SELECT COUNT(*) AS cnt, COUNT(DISTINCT district) AS districts, COUNT(DISTINCT soil_type) AS soil_types FROM soil_benchmarks`);
    const [[rainfall]]= await db.execute(`SELECT COUNT(*) AS cnt, COUNT(DISTINCT state) AS states FROM rainfall_records`);

    let climate = { cnt: 0, year_from: null, year_to: null, crops: 0, regions: 0 };
    try {
      const [[c]] = await db.execute(`SELECT COUNT(*) AS cnt, MIN(year) AS year_from, MAX(year) AS year_to, COUNT(DISTINCT crop_type) AS crops, COUNT(DISTINCT region) AS regions FROM climate_impact`);
      climate = c;
    } catch (_) {}

    return res.json({
      success: true,
      datasets: {
        market_prices:   { rows: market.cnt,   date_range: `${market.from_date} → ${market.to_date}` },
        soil_benchmarks: { rows: soil.cnt,     districts: soil.districts, soil_types: soil.soil_types },
        rainfall_records:{ rows: rainfall.cnt, states: rainfall.states },
        climate_impact:  { rows: climate.cnt,  year_range: `${climate.year_from}–${climate.year_to}`, crops: climate.crops, regions: climate.regions }
      }
    });
  } catch (err) {
    console.error('Datasets summary error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch dataset summaries.' });
  }
});

module.exports = router;
