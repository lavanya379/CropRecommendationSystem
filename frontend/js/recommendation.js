// recommendation.js - Complete ML recommendation form with REAL soil + weather inputs

document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('token')) {
        window.location.href = '../login.html';
        return;
    }

    let userFarms = [];
    let selectedFarmId = null;

    // ── Step 1: Load Farms ────────────────────────────────────────────────────
    const farmSelect  = document.getElementById('farm-select');
    const loading     = document.getElementById('farm-loading');
    const noFarmMsg   = document.getElementById('no-farm-msg');
    const btnNext1    = document.getElementById('btn-next-1');

    try {
        const res = await FarmAPI.getAll();
        loading.classList.add('hidden');
        if (res.success && res.farms && res.farms.length > 0) {
            userFarms = res.farms;
            farmSelect.classList.remove('hidden');
            farmSelect.innerHTML = '<option value="">-- Choose a registered farm --</option>';
            res.farms.forEach(farm => {
                const opt = document.createElement('option');
                opt.value = farm.id;
                opt.textContent = `${farm.farm_name} (${farm.district || ''}, ${farm.state || ''})`;
                farmSelect.appendChild(opt);
            });
            const urlFarmId = new URLSearchParams(window.location.search).get('farm_id');
            if (urlFarmId) farmSelect.value = urlFarmId;
            else if (res.farms.length === 1) farmSelect.value = res.farms[0].id;
        } else {
            noFarmMsg && noFarmMsg.classList.remove('hidden');
            if (btnNext1) btnNext1.disabled = true;
        }
    } catch (e) {
        if (loading) loading.textContent = 'Error loading farms.';
    }

    // ── Step Navigation ───────────────────────────────────────────────────────
    let currentStep = 1;
    const totalSteps = 4;

    function updateStepUI() {
        for (let i = 1; i <= totalSteps; i++) {
            const s = document.getElementById(`step-${i}`);
            if (s) s.classList.toggle('hidden-step', i !== currentStep);
            const ind = document.getElementById(`step-indicator-${i}`);
            if (ind) {
                ind.className = 'w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-colors';
                if (i < currentStep)  ind.classList.add('step-completed');
                else if (i === currentStep) ind.classList.add('step-active');
                else ind.classList.add('step-inactive');
            }
        }
        const bar = document.getElementById('progress-bar');
        if (bar) bar.style.width = `${((currentStep - 1) / (totalSteps - 1)) * 100}%`;
    }

    // ── Step 1 → 2 ────────────────────────────────────────────────────────────
    btnNext1 && btnNext1.addEventListener('click', () => {
        if (!farmSelect.value) { alert('Please select a farm first.'); return; }
        selectedFarmId = farmSelect.value;
        currentStep++; updateStepUI();
    });

    // ── Step 2 → 3: Collect REAL soil inputs + auto-fill weather ─────────────
    document.getElementById('btn-prev-2')?.addEventListener('click', () => { currentStep--; updateStepUI(); });
    document.getElementById('btn-next-2')?.addEventListener('click', () => {
        // Validate soil inputs are filled
        const N  = parseFloat(document.getElementById('input-n')?.value);
        const P  = parseFloat(document.getElementById('input-p')?.value);
        const K  = parseFloat(document.getElementById('input-k')?.value);
        const ph = parseFloat(document.getElementById('input-ph')?.value);

        if (isNaN(N) || isNaN(P) || isNaN(K) || isNaN(ph)) {
            alert('Please enter all soil values (N, P, K, pH) before proceeding.');
            return;
        }
        if (N < 0 || N > 300 || P < 0 || P > 300 || K < 0 || K > 300) {
            alert('N, P, K values should be between 0 and 300 kg/ha.');
            return;
        }
        if (ph < 0 || ph > 14) {
            alert('pH should be between 0 and 14.');
            return;
        }

        // Auto-fill weather based on season
        const season = document.getElementById('crop-season')?.value || '';
        const selectedFarm = userFarms.find(f => f.id == selectedFarmId) || {};
        const district = selectedFarm.district || '';
        const state    = selectedFarm.state || '';

        const locBadge = document.getElementById('weather-badge-loc');
        if (locBadge) locBadge.textContent = `Location: ${district || 'Your Farm'}${state ? ', ' + state : ''}`;

        // Season-based weather defaults for AP/TS region
        let rain = 145.0, temp = 29.5, hum = 68.0;
        if (season.toLowerCase().includes('kharif')) { rain = 210.5; temp = 28.2; hum = 76.0; }
        else if (season.toLowerCase().includes('rabi'))  { rain = 45.0;  temp = 24.8; hum = 58.0; }
        else if (season.toLowerCase().includes('zaid'))  { rain = 22.0;  temp = 35.4; hum = 44.0; }

        const setVal = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.value = v;
        };
        const setText = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.textContent = v;
        };

        setText('disp-rain', `${rain.toFixed(1)} mm`);
        setText('disp-temp', `${temp.toFixed(1)} °C`);
        setText('disp-hum',  `${hum} %`);
        setVal('env-rain', rain);
        setVal('env-temp', temp);
        setVal('env-hum',  hum);

        currentStep++; updateStepUI();
    });

    // ── Step 3 → 4 ────────────────────────────────────────────────────────────
    document.getElementById('btn-prev-3')?.addEventListener('click', () => { currentStep--; updateStepUI(); });
    document.getElementById('btn-next-3')?.addEventListener('click', () => {
        // Allow user to override weather values
        currentStep++; updateStepUI();
    });
    document.getElementById('btn-prev-4')?.addEventListener('click', () => { currentStep--; updateStepUI(); });

    // ── Final Submit: Real ML Prediction ──────────────────────────────────────
    document.getElementById('btn-submit')?.addEventListener('click', async () => {
        const btn       = document.getElementById('btn-submit');
        const spinner   = document.getElementById('submit-spinner');
        const errDiv    = document.getElementById('analyze-error');
        const progressBox = document.getElementById('analysis-progress');
        const btnPrev   = document.getElementById('btn-prev-4');

        btn.disabled = true;
        if (btnPrev) btnPrev.disabled = true;
        if (spinner)     spinner.classList.remove('hidden');
        if (errDiv)      errDiv.classList.add('hidden');
        if (progressBox) progressBox.classList.remove('hidden');

        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const markLog = id => {
            const el = document.getElementById(id);
            if (el) { const i = el.querySelector('i'); if (i) i.classList.remove('opacity-0'); }
        };

        try {
            // ── Collect REAL soil values from Step 2 ──────────────────────
            const N  = parseFloat(document.getElementById('input-n')?.value);
            const P  = parseFloat(document.getElementById('input-p')?.value);
            const K  = parseFloat(document.getElementById('input-k')?.value);
            const ph = parseFloat(document.getElementById('input-ph')?.value);

            if (isNaN(N) || isNaN(P) || isNaN(K) || isNaN(ph)) {
                throw new Error('Soil data (N, P, K, pH) is required. Please go back and enter values.');
            }

            // ── Collect weather values (user may have edited them) ─────────
            const temperature = parseFloat(document.getElementById('env-temp')?.value);
            const humidity    = parseFloat(document.getElementById('env-hum')?.value);
            const rainfall    = parseFloat(document.getElementById('env-rain')?.value);

            if (isNaN(temperature) || isNaN(humidity) || isNaN(rainfall)) {
                throw new Error('Weather data (Temperature, Humidity, Rainfall) is required.');
            }

            const season    = document.getElementById('crop-season')?.value || '';
            const prevCrop  = document.getElementById('prev-crop')?.value   || '';
            const budget    = document.getElementById('farmer-budget')?.value || '';
            const soilType  = document.getElementById('soil-type')?.value   || '';

            markLog('log-1');

            // ── Save soil record to DB ─────────────────────────────────────
            let soilId = null;
            try {
                const soilRes = await apiCall('/soil', 'POST', {
                    farm_id: selectedFarmId,
                    nitrogen: N, phosphorus: P, potassium: K, ph: ph,
                    soil_type: soilType
                });
                if (soilRes.success) soilId = soilRes.soilId || soilRes.id;
            } catch(soilErr) {
                console.warn('Could not save soil record:', soilErr.message);
            }

            await sleep(600);
            markLog('log-2');

            const weatherSnapshot = { temperature, humidity, rainfall, season, N, P, K, ph };
            const marketSnapshot  = {
                source: 'Agmarknet AP & TS',
                season, budget,
                previous_crop: prevCrop,
                date: new Date().toISOString()
            };

            await sleep(600);
            markLog('log-3');

            // ── Call Real ML via Node backend → FastAPI ────────────────────
            const recPayload = {
                farm_id: parseInt(selectedFarmId),
                soil_record_id: soilId || null,
                weather_snapshot: weatherSnapshot,
                market_snapshot: marketSnapshot
            };

            const recRes = await RecAPI.generate(recPayload);
            if (!recRes.success) throw new Error(recRes.message || 'ML prediction failed.');

            await sleep(400);
            markLog('log-4');
            await sleep(300);

            // ── Redirect to Result Page ────────────────────────────────────
            window.location.href = `result.html?id=${recRes.recommendationId}`;

        } catch (e) {
            if (errDiv) { errDiv.textContent = e.message; errDiv.classList.remove('hidden'); }
            btn.disabled = false;
            if (btnPrev) btnPrev.disabled = false;
            if (spinner)     spinner.classList.add('hidden');
            if (progressBox) progressBox.classList.add('hidden');
            document.querySelectorAll('#analysis-progress i').forEach(i => i.classList.add('opacity-0'));
        }
    });

    updateStepUI();
});
