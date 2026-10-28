// dashboard.js - Dynamic User Dashboard Logic grounded in REAL MySQL APIs & ML Engine

document.addEventListener('DOMContentLoaded', async () => {
    // Purge any legacy Farming Assistant elements from DOM
    document.querySelectorAll('div').forEach(el => {
        if (el.innerText && el.innerText.includes('Farming Assistant') && el.innerText.includes('Start Analysis')) {
            el.remove();
        }
    });

    // 1. Initialize Professional Sidebar Navigation if nav.js is loaded
    if (typeof initCropAINavigation === 'function') {
        initCropAINavigation('dashboard');
    }

    // 2. Auth Session Check & Role Guard
    if (!getToken()) {
        window.location.href = '../login.html';
        return;
    }

    const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (cachedUser.role === 'admin' || cachedUser.role === 'superadmin') {
        window.location.href = '../admin/dashboard.html';
        return;
    }

    // Load User Profile Name
    const greetingEl = document.getElementById('user-greeting');
    if (greetingEl) {
        if (cachedUser.name) {
            greetingEl.textContent = `Welcome back, ${cachedUser.name}!`;
        }
        try {
            const userRes = await AuthAPI.me();
            if (userRes.success && userRes.user && userRes.user.name) {
                greetingEl.textContent = `Welcome back, ${userRes.user.name}!`;
            }
        } catch(e) {}
    }

    // Initial Dashboard Data Fetch
    await refreshAllDashboardData();

    // 3. Real-Time Auto-Refresh Polling Loop (Every 30 Seconds)
    setInterval(() => {
        refreshAllDashboardData();
    }, 30000);
});

async function refreshAllDashboardData() {
    await Promise.all([
        loadSummaryStatsAndFarms(),
        loadRecommendationsAndSHAP(),
        loadWeatherSnapshot(),
        loadMarketSnapshot()
    ]);
}

// ── Summary Stats & Farm Overview ───────────────────────────────────────────
async function loadSummaryStatsAndFarms() {
    const statFarms    = document.getElementById('stat-farms');
    const statFarmsSub = document.getElementById('stat-farms-sub');
    const ovTotalFarms = document.getElementById('ov-total-farms');
    const ovTotalArea  = document.getElementById('ov-total-area');
    const ovMainCrop   = document.getElementById('ov-main-crop');
    const ovSeason     = document.getElementById('ov-season');

    try {
        const farmRes = await FarmAPI.getAll();
        if (farmRes.success && farmRes.farms) {
            const farms = farmRes.farms;
            const count = farms.length;

            if (statFarms)    statFarms.textContent = count;
            if (ovTotalFarms) ovTotalFarms.textContent = count;

            // Calculate total area
            let totalArea = 0;
            farms.forEach(f => {
                const area = parseFloat(f.area || 0);
                totalArea += area;
            });

            if (ovTotalArea) ovTotalArea.textContent = `${totalArea.toFixed(1)} Acres`;
            if (statFarmsSub) statFarmsSub.textContent = `${totalArea.toFixed(1)} total acres registered`;

            // Detect main soil / crop pattern
            if (count > 0 && farms[0].district) {
                if (ovSeason) ovSeason.textContent = 'Kharif / Rabi';
            }
        } else {
            if (statFarms) statFarms.textContent = '0';
            if (ovTotalFarms) ovTotalFarms.textContent = '0';
            if (ovTotalArea) ovTotalArea.textContent = 'Not available';
        }
    } catch (e) {
        if (statFarms) statFarms.textContent = '0';
        if (ovTotalArea) ovTotalArea.textContent = 'Not available';
    }
}

// ── Recommendations, Latest SHAP & History ──────────────────────────────────
async function loadRecommendationsAndSHAP() {
    const statRecs     = document.getElementById('stat-recs');
    const statReports  = document.getElementById('stat-reports');
    const statLastDate = document.getElementById('stat-last-date');
    const latestBox    = document.getElementById('latest-rec-box');
    const recentTbody  = document.getElementById('recent-analyses-tbody');
    const ovMainCrop   = document.getElementById('ov-main-crop');

    try {
        const recRes = await RecAPI.getHistory();
        if (recRes.success && recRes.recommendations && recRes.recommendations.length > 0) {
            const recs = recRes.recommendations;
            const totalRecs = recs.length;

            if (statRecs)    statRecs.textContent = totalRecs;
            if (statReports) statReports.textContent = totalRecs;

            // Last analysis date
            const latest = recs[0];
            const latestDate = new Date(latest.created_at);
            const dateStr = latestDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            if (statLastDate) statLastDate.textContent = dateStr;
            if (ovMainCrop)   ovMainCrop.textContent   = capitalize(latest.recommended_crop);

            // Populate Recent Analyses Table
            if (recentTbody) {
                recentTbody.innerHTML = recs.slice(0, 5).map(r => {
                    const scorePct = (parseFloat(r.model_confidence || 0) * (parseFloat(r.model_confidence || 0) <= 1 ? 100 : 1)).toFixed(1);
                    const rDate    = new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    
                    return `
                      <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-4 py-3.5 font-bold text-slate-800">${r.farm_name || 'Primary Farm'}</td>
                        <td class="px-4 py-3.5 font-extrabold text-emerald-700 capitalize">
                          <i class="fas fa-seedling text-emerald-500 mr-1.5"></i>${r.recommended_crop}
                        </td>
                        <td class="px-4 py-3.5 font-bold text-slate-900">${scorePct}%</td>
                        <td class="px-4 py-3.5 text-slate-500 text-xs">${rDate}</td>
                        <td class="px-4 py-3.5 text-right">
                          <a href="result.html?id=${r.id}" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs transition inline-flex items-center">
                            View Report <i class="fas fa-arrow-right ml-1"></i>
                          </a>
                        </td>
                      </tr>`;
                }).join('');
            }

            // Load Full Details for the Latest Recommendation (including SHAP)
            const detailsRes = await RecAPI.getDetails(latest.id);
            if (detailsRes.success && detailsRes.recommendation) {
                renderLatestRecHero(detailsRes.recommendation, detailsRes.alternatives || [], detailsRes.shap_explanations || []);
            } else {
                renderLatestRecFallback(latest);
            }

        } else {
            // Empty State
            if (statRecs)    statRecs.textContent = '0';
            if (statReports) statReports.textContent = '0';
            if (statLastDate) statLastDate.textContent = 'Not available';

            if (latestBox) {
                latestBox.innerHTML = `
                  <div class="text-center py-12 px-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                    <div class="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 font-bold text-xl">
                      <i class="fas fa-seedling"></i>
                    </div>
                    <h4 class="text-base font-extrabold text-slate-900">No AI Recommendations Yet</h4>
                    <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">Run your first AI crop analysis using your farm's soil chemical parameters and weather metrics.</p>
                    <a href="recommendation.html" class="inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-200 transition">
                      <i class="fas fa-wand-magic-sparkles mr-1.5"></i> Run First Analysis
                    </a>
                  </div>`;
            }

            if (recentTbody) {
                recentTbody.innerHTML = `
                  <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-slate-400 text-xs">
                      No analyses recorded. <a href="recommendation.html" class="font-bold text-emerald-700 underline ml-1">Run first analysis</a>
                    </td>
                  </tr>`;
            }
        }
    } catch (e) {
        console.error('Error loading recommendations:', e);
        if (statRecs) statRecs.textContent = '0';
        if (statLastDate) statLastDate.textContent = 'Not available';
    }
}

// Render Hero & SHAP Breakdown for Latest Recommendation
function renderLatestRecHero(rec, alts, shap) {
    const latestBox = document.getElementById('latest-rec-box');
    if (!latestBox) return;

    const confVal = parseFloat(rec.model_confidence || 0);
    const confPct = (confVal <= 1 ? (confVal * 100).toFixed(1) : confVal.toFixed(1)) + '%';
    const recDate = new Date(rec.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    let shapHTML = '';
    if (shap.length > 0) {
        const maxAbs = Math.max(...shap.map(s => Math.abs(parseFloat(s.shap_value || 0)))) || 1;
        shapHTML = shap.map(s => {
            const val = parseFloat(s.shap_value || 0);
            const pct = Math.min(100, Math.max(10, (Math.abs(val) / maxAbs) * 100));
            const isPos = s.impact_direction === 'positive' || val >= 0;
            const barColor = isPos ? 'bg-emerald-500' : 'bg-rose-400';
            const textColor = isPos ? 'text-emerald-700' : 'text-rose-600';

            return `
              <div class="space-y-1">
                <div class="flex justify-between items-center text-xs">
                  <span class="font-bold text-slate-700">${s.feature_name}</span>
                  <span class="font-extrabold ${textColor}">${isPos ? '+' : ''}${val.toFixed(4)}</span>
                </div>
                <div class="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                  <div class="${barColor} h-full rounded-full transition-all" style="width: ${pct.toFixed(1)}%"></div>
                </div>
              </div>`;
        }).join('');
    } else {
        shapHTML = `<p class="text-xs text-slate-400 italic">Explanation available after AI analysis.</p>`;
    }

    let altsHTML = '';
    if (alts.length > 0) {
        altsHTML = alts.map((a, i) => `
          <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <div class="flex items-center space-x-2">
              <span class="w-5 h-5 bg-emerald-100 text-emerald-800 rounded-md flex items-center justify-center text-[10px] font-bold">${i + 2}</span>
              <span class="font-bold text-slate-800 capitalize">${a.crop_name}</span>
            </div>
            <span class="font-extrabold text-slate-700">${a.confidence_pct || (parseFloat(a.score || 0) * 100).toFixed(1) + '%'}</span>
          </div>`).join('');
    } else {
        altsHTML = `<p class="text-xs text-slate-400 italic">No alternative options recorded.</p>`;
    }

    latestBox.innerHTML = `
      <div class="space-y-6">
        <div class="p-6 bg-gradient-to-br from-slate-900 to-emerald-950 rounded-2xl text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
          <div class="flex items-center space-x-5">
            <div class="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
              <i class="fas fa-seedling text-emerald-400 text-3xl"></i>
            </div>
            <div>
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full">Top Recommendation</span>
              <h4 class="text-3xl font-extrabold capitalize mt-1 text-white">${rec.recommended_crop}</h4>
              <p class="text-xs text-slate-300 mt-0.5">Farm: <strong class="text-white">${rec.farm_name || 'Primary Plot'}</strong> • Analyzed: ${recDate}</p>
            </div>
          </div>
          <div class="text-center bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/15 min-w-[140px]">
            <span class="text-[10px] font-bold uppercase text-emerald-300 tracking-wider">Prediction Score</span>
            <p class="text-3xl font-extrabold text-white mt-0.5">${confPct}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <!-- Why this crop SHAP breakdown -->
          <div class="p-5 bg-slate-50/80 rounded-2xl border border-slate-100">
            <h5 class="text-sm font-extrabold text-slate-900 mb-1 flex items-center">
              <i class="fas fa-brain text-purple-600 mr-2"></i> Why was this crop recommended?
            </h5>
            <p class="text-[11px] text-slate-400 mb-4">Top decision factors computed by SHAP explainability model</p>
            <div class="space-y-3">${shapHTML}</div>
          </div>

          <!-- Alternative Options -->
          <div class="p-5 bg-slate-50/80 rounded-2xl border border-slate-100">
            <h5 class="text-sm font-extrabold text-slate-900 mb-1 flex items-center">
              <i class="fas fa-layer-group text-blue-600 mr-2"></i> Alternative Options
            </h5>
            <p class="text-[11px] text-slate-400 mb-4">Top secondary crops ranked by probability score</p>
            <div class="space-y-2.5">${altsHTML}</div>
          </div>
        </div>
      </div>`;
}

function renderLatestRecFallback(rec) {
    const latestBox = document.getElementById('latest-rec-box');
    if (!latestBox) return;
    const scorePct = (parseFloat(rec.model_confidence || 0) * (parseFloat(rec.model_confidence || 0) <= 1 ? 100 : 1)).toFixed(1) + '%';
    latestBox.innerHTML = `
      <div class="p-6 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
        <div>
          <span class="text-[10px] font-extrabold uppercase text-emerald-400">Latest Recommendation</span>
          <h4 class="text-2xl font-extrabold capitalize text-white mt-1">${rec.recommended_crop}</h4>
        </div>
        <div class="text-right">
          <span class="text-xs text-slate-400">Prediction Score</span>
          <p class="text-2xl font-extrabold text-emerald-400">${scorePct}</p>
        </div>
      </div>`;
}

async function searchDashWeather() {
    const input = document.getElementById('dash-weather-input');
    const loc = input ? input.value.trim() : 'Guntur';
    if (!loc) return;

    const btn = document.getElementById('btn-dash-search-weather');
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>';

    await loadWeatherSnapshot(loc);

    if (btn) btn.innerHTML = '<i class="fas fa-search mr-1"></i> Search';
}

// ── Weather Intelligence Snapshot ──────────────────────────────────────────
async function loadWeatherSnapshot(location = null, customLat = null, customLon = null) {
    const box = document.getElementById('dash-weather-box');
    if (!box) return;

    // If no location or lat/lon provided, attempt browser GPS geolocation first
    if (!location && !customLat && !customLon && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                loadWeatherSnapshot(null, pos.coords.latitude, pos.coords.longitude);
            },
            () => {
                loadWeatherSnapshot('Guntur');
            },
            { timeout: 6000 }
        );
        return;
    }

    try {
        let wRes;
        if (location) {
            wRes = await WeatherAPI.getCurrent(null, null, location);
        } else {
            const lat = customLat || 16.30;
            const lon = customLon || 80.44;
            wRes = await WeatherAPI.getCurrent(lat, lon);
        }

        if (wRes.success && wRes.weather) {
            const w = wRes.weather;
            const temp = parseFloat(w.temperature).toFixed(1);
            box.innerHTML = `
              <div class="grid grid-cols-2 gap-3">
                <div class="p-3 bg-blue-50/80 rounded-2xl border border-blue-100">
                  <span class="text-[10px] font-bold text-blue-700 uppercase">Temperature</span>
                  <p class="text-xl font-extrabold text-blue-950 mt-0.5">${temp}°C</p>
                  <p class="text-[10px] text-blue-600 capitalize truncate">${w.description || 'Clear Sky'}</p>
                </div>
                <div class="p-3 bg-amber-50/80 rounded-2xl border border-amber-100">
                  <span class="text-[10px] font-bold text-amber-700 uppercase">Humidity</span>
                  <p class="text-xl font-extrabold text-amber-950 mt-0.5">${w.humidity}%</p>
                  <p class="text-[10px] text-amber-600">Relative Level</p>
                </div>
                <div class="p-3 bg-teal-50/80 rounded-2xl border border-teal-100">
                  <span class="text-[10px] font-bold text-teal-700 uppercase">Rainfall</span>
                  <p class="text-xl font-extrabold text-teal-950 mt-0.5">${w.rainfall} mm</p>
                  <p class="text-[10px] text-teal-600">Hourly Rate</p>
                </div>
                <div class="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-100">
                  <span class="text-[10px] font-bold text-emerald-700 uppercase">Location</span>
                  <p class="text-xl font-extrabold text-emerald-950 mt-0.5 truncate">${w.city || location || 'GPS Position'}</p>
                  <p class="text-[10px] text-emerald-600">Wind: ${w.wind_speed} m/s</p>
                </div>
              </div>`;
        } else {
            box.innerHTML = `<p class="text-xs text-slate-400 italic py-4 text-center">Weather data unavailable for ${location || 'selected area'}</p>`;
        }
    } catch (e) {
        box.innerHTML = `<p class="text-xs text-slate-400 italic py-4 text-center">Weather data unavailable</p>`;
    }
}

// ── Market Intelligence Snapshot ────────────────────────────────────────────
async function loadMarketSnapshot() {
    const box = document.getElementById('dash-market-box');
    if (!box) return;

    try {
        const mRes = await MarketAPI.getPrices(null, null, null, 5);
        if (mRes.success && mRes.prices && mRes.prices.length > 0) {
            const p = mRes.prices[0];
            const pDate = p.arrival_date ? new Date(p.arrival_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recent';

            box.innerHTML = `
              <div class="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-100 space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-[10px] font-extrabold uppercase text-emerald-700">Featured Commodity</span>
                    <h4 class="text-lg font-extrabold text-slate-900 capitalize mt-0.5">${p.commodity}</h4>
                  </div>
                  <div class="text-right">
                    <span class="text-xs font-extrabold text-emerald-800 bg-white px-2.5 py-1 rounded-xl border border-emerald-200">Agmarknet</span>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div class="p-2.5 bg-white rounded-xl border border-emerald-100">
                    <span class="text-[10px] text-slate-400 font-bold uppercase">Latest Price</span>
                    <p class="text-base font-extrabold text-emerald-700 mt-0.5">₹${Number(p.modal_price).toLocaleString('en-IN')}</p>
                    <span class="text-[9px] text-slate-400">/ Quintal</span>
                  </div>
                  <div class="p-2.5 bg-white rounded-xl border border-emerald-100">
                    <span class="text-[10px] text-slate-400 font-bold uppercase">Mandi Market</span>
                    <p class="font-bold text-slate-800 mt-0.5 truncate">${p.market || p.district || 'Mandi Yard'}</p>
                    <span class="text-[9px] text-slate-400">Date: ${pDate}</span>
                  </div>
                </div>
              </div>`;
        } else {
            box.innerHTML = `<p class="text-xs text-slate-400 italic py-4">Market price data unavailable</p>`;
        }
    } catch (e) {
        box.innerHTML = `<p class="text-xs text-slate-400 italic py-4">Market price data unavailable</p>`;
    }
}

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
