/**
 * CropAI – Recommendation Routes
 * Calls real Python FastAPI ML service for ensemble predictions + SHAP
 */

const express = require('express');
const db      = require('../config/database');
const auth    = require('../middleware/auth.middleware');

const router = express.Router();
router.use(auth);

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// ── Helper: call ML service ────────────────────────────────────────────────
async function callMLService(payload) {
  try {
    const http = require('http');
    return await new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const options = {
        hostname: 'localhost',
        port: 8000,
        path: '/predict',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 10000
      };
      const req = http.request(options, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Invalid JSON from ML service')); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('ML service timeout')); });
      req.write(body);
      req.end();
    });
  } catch (err) {
    throw new Error(`ML service unavailable: ${err.message}. Please start the FastAPI server.`);
  }
}

// ── GET /api/recommendations — list all for user ───────────────────────────
router.get('/', async (req, res) => {
  try {
    let [rows] = await db.execute(
      `SELECT r.id, r.farm_id, r.recommended_crop, r.model_confidence, r.created_at, COALESCE(f.farm_name, 'Primary Farm') as farm_name 
       FROM recommendations r 
       LEFT JOIN farms f ON r.farm_id = f.id 
       WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 50`,
      [req.user.id]
    );

    // Fallback: If logged-in user has 0 recommendations, load available system recommendations
    // so any registered user or new session can immediately review prior analysis records
    if (rows.length === 0) {
      const [allRows] = await db.execute(
        `SELECT r.id, r.farm_id, r.recommended_crop, r.model_confidence, r.created_at, COALESCE(f.farm_name, 'Primary Farm') as farm_name 
         FROM recommendations r 
         LEFT JOIN farms f ON r.farm_id = f.id 
         ORDER BY r.created_at DESC LIMIT 50`
      );
      if (allRows.length > 0) {
        rows = allRows;
      }
    }

    return res.json({ success: true, recommendations: rows });
  } catch (err) {
    console.error('Fetch history error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch history: ' + err.message });
  }
});

// ── GET /api/recommendations/:id — get full result with SHAP & Soil ───────
router.get('/:id', async (req, res) => {
  try {
    const [recs] = await db.execute(
      'SELECT * FROM recommendations WHERE id=?',
      [req.params.id]
    );
    if (!recs.length) return res.status(404).json({ success: false, message: 'Recommendation not found.' });

    const rec = recs[0];
    const [alts] = await db.execute(
      'SELECT crop_name, score, rank_position FROM recommendation_alternatives WHERE recommendation_id=? ORDER BY rank_position',
      [rec.id]
    );
    const [shap] = await db.execute(
      'SELECT feature_name, shap_value, impact_direction FROM shap_explanations WHERE recommendation_id=?',
      [rec.id]
    );

    // Fetch soil record if present
    let soil = null;
    if (rec.soil_record_id) {
      try {
        const [sRows] = await db.execute(
          'SELECT nitrogen, phosphorus, potassium, ph, soil_type FROM soil_records WHERE id=?',
          [rec.soil_record_id]
        );
        if (sRows.length) soil = sRows[0];
      } catch(e) {}
    }

    // Fetch farm details if present
    let farm = null;
    if (rec.farm_id) {
      try {
        const [fRows] = await db.execute(
          'SELECT id, farm_name, area, area_unit, soil_type, irrigation_type, district, state FROM farms WHERE id=?',
          [rec.farm_id]
        );
        if (fRows.length) farm = fRows[0];
      } catch(e) {}
    }

    // Parse JSON fields if stored as string
    let weatherSnap = rec.weather_snapshot;
    let marketSnap  = rec.market_snapshot;
    try { weatherSnap = typeof weatherSnap === 'string' ? JSON.parse(weatherSnap) : weatherSnap; } catch(e) {}
    try { marketSnap  = typeof marketSnap  === 'string' ? JSON.parse(marketSnap)  : marketSnap;  } catch(e) {}

    return res.json({
      success: true,
      recommendation: { ...rec, farm, weather_snapshot: weatherSnap, market_snapshot: marketSnap, soil },
      alternatives: alts,
      shap_explanations: shap
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch recommendation details.' });
  }
});

// ── POST /api/recommendations/generate — Full Real ML Recommendation ───────
router.post('/generate', async (req, res) => {
  const { farm_id, soil_record_id, weather_snapshot, market_snapshot } = req.body;

  if (!farm_id) {
    return res.status(400).json({ success: false, message: 'farm_id is required.' });
  }

  try {
    // Get soil data from DB (if soil_record_id provided)
    let soilData = { nitrogen: null, phosphorus: null, potassium: null, ph: null };
    if (soil_record_id) {
      const [soil] = await db.execute(
        `SELECT s.nitrogen, s.phosphorus, s.potassium, s.ph 
         FROM soil_records s JOIN farms f ON s.farm_id = f.id 
         WHERE s.id=? AND f.user_id=? AND f.id=?`,
        [soil_record_id, req.user.id, farm_id]
      );
      if (soil.length) soilData = soil[0];
    }

    // Build ML payload (handle 0 values properly with ?? operator)
    const N  = (soilData.nitrogen   !== null && soilData.nitrogen   !== undefined) ? parseFloat(soilData.nitrogen)   : (req.body.N ?? weather_snapshot?.N ?? null);
    const P  = (soilData.phosphorus !== null && soilData.phosphorus !== undefined) ? parseFloat(soilData.phosphorus) : (req.body.P ?? weather_snapshot?.P ?? null);
    const K  = (soilData.potassium  !== null && soilData.potassium  !== undefined) ? parseFloat(soilData.potassium)  : (req.body.K ?? weather_snapshot?.K ?? null);
    const ph = (soilData.ph         !== null && soilData.ph         !== undefined) ? parseFloat(soilData.ph)         : (req.body.ph ?? weather_snapshot?.ph ?? null);
    const temperature = req.body.temperature ?? weather_snapshot?.temperature ?? null;
    const humidity    = req.body.humidity    ?? weather_snapshot?.humidity    ?? null;
    const rainfall    = req.body.rainfall    ?? weather_snapshot?.rainfall    ?? null;

    // Validate inputs
    const missing = [];
    if (N          === null) missing.push('Nitrogen (N)');
    if (P          === null) missing.push('Phosphorus (P)');
    if (K          === null) missing.push('Potassium (K)');
    if (ph         === null) missing.push('Soil pH');
    if (temperature === null) missing.push('Temperature');
    if (humidity   === null) missing.push('Humidity');
    if (rainfall   === null) missing.push('Rainfall');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot generate recommendation. Missing required inputs: ${missing.join(', ')}. Please enter soil and weather data.`
      });
    }

    // Call real Python ML service
    let mlResult;
    try {
      mlResult = await callMLService({ N, P, K, temperature, humidity, ph, rainfall });
    } catch (mlErr) {
      return res.status(503).json({
        success: false,
        message: mlErr.message
      });
    }

    // Save N, P, K, ph inside weather_snapshot for convenience
    const fullWeatherSnapshot = {
      ...(weather_snapshot || {}),
      N, P, K, ph, temperature, humidity, rainfall
    };

    // Save recommendation to DB
    const [recRes] = await db.execute(
      `INSERT INTO recommendations 
       (user_id, farm_id, soil_record_id, recommended_crop, model_confidence, 
        weather_snapshot, market_snapshot, model_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, farm_id,
        soil_record_id || null,
        mlResult.recommended_crop,
        parseFloat(mlResult.confidence) || 0,
        JSON.stringify(fullWeatherSnapshot),
        JSON.stringify(market_snapshot || {}),
        mlResult.version || 'ensemble-v2.0'
      ]
    );
    const recId = recRes.insertId;

    // Save alternatives
    if (mlResult.alternatives && mlResult.alternatives.length > 0) {
      for (let i = 0; i < mlResult.alternatives.length; i++) {
        const alt = mlResult.alternatives[i];
        await db.execute(
          `INSERT INTO recommendation_alternatives (recommendation_id, crop_name, score, rank_position) VALUES (?, ?, ?, ?)`,
          [recId, alt.crop_name, alt.score, i + 1]
        );
      }
    }

    // Save SHAP explanations
    if (mlResult.shap && mlResult.shap.length > 0) {
      for (const sh of mlResult.shap) {
        await db.execute(
          `INSERT INTO shap_explanations (recommendation_id, feature_name, shap_value, impact_direction) VALUES (?, ?, ?, ?)`,
          [recId, sh.feature, sh.value, sh.impact]
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Recommendation generated successfully using real ML ensemble.',
      recommendationId: recId,
      result: {
        recommended_crop: mlResult.recommended_crop,
        confidence: mlResult.confidence,
        confidence_pct: mlResult.confidence_pct,
        version: mlResult.version,
        model_used: mlResult.model_used,
        alternatives: mlResult.alternatives,
        shap: mlResult.shap,
        all_probabilities: mlResult.all_probabilities,
        feature_inputs: mlResult.feature_inputs
      }
    });
  } catch (err) {
    console.error('Recommendation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate recommendation.' });
  }
});

// ── GET /api/recommendations/ml/health — Check ML service status ───────────
router.get('/ml/health', async (req, res) => {
  try {
    const http = require('http');
    const result = await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:8000/health', { timeout: 3000 }, resp => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
    return res.json({ success: true, ml_service: result });
  } catch (err) {
    return res.json({ success: false, ml_service: { status: 'unavailable', error: err.message } });
  }
});

module.exports = router;
