// farm.js - My Farms Page Logic with Real Database CRUD Operations

document.addEventListener('DOMContentLoaded', () => {
    initCropAINavigation('farms');
    if (!getToken()) { window.location.href = '../login.html'; return; }

    loadFarms();

    // Modal bindings
    const modal = document.getElementById('farm-modal');
    const openBtn = document.getElementById('open-add-farm-modal');
    const closeBtn = document.getElementById('close-farm-modal');
    const cancelBtn = document.getElementById('cancel-farm-btn');
    const form = document.getElementById('farm-form');

    function openModal(isEdit = false, farm = null) {
        if (!modal) return;
        document.getElementById('modal-title').textContent = isEdit ? 'Edit Farm Details' : 'Register New Farm';
        document.getElementById('farm-id').value = isEdit && farm ? farm.id : '';
        document.getElementById('farm-name').value = isEdit && farm ? farm.farm_name || '' : '';
        document.getElementById('farm-state').value = isEdit && farm ? farm.state || '' : 'Andhra Pradesh';
        document.getElementById('farm-district').value = isEdit && farm ? farm.district || '' : 'Nandyal';
        document.getElementById('farm-area').value = isEdit && farm ? farm.area || '' : '5';
        document.getElementById('farm-irrigation').value = isEdit && farm ? farm.irrigation_type || 'Borewell' : 'Borewell';
        document.getElementById('farm-soil').value = isEdit && farm ? farm.soil_type || 'Red Sandy Loam' : 'Red Sandy Loam';

        modal.classList.remove('hidden');
    }

    function closeModal() {
        if (modal) modal.classList.add('hidden');
    }

    if (openBtn) openBtn.addEventListener('click', () => openModal(false));
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const farmId = document.getElementById('farm-id').value;
            const data = {
                farm_name: document.getElementById('farm-name').value,
                state: document.getElementById('farm-state').value,
                district: document.getElementById('farm-district').value,
                area: parseFloat(document.getElementById('farm-area').value) || 0,
                area_unit: 'acres',
                irrigation_type: document.getElementById('farm-irrigation').value,
                soil_type: document.getElementById('farm-soil').value
            };

            try {
                let res;
                if (farmId) {
                    res = await FarmAPI.update(farmId, data);
                } else {
                    res = await FarmAPI.create(data);
                }

                if (res.success) {
                    closeModal();
                    loadFarms();
                } else {
                    alert(res.message || 'Operation failed.');
                }
            } catch (err) {
                alert('Server error saving farm.');
            }
        });
    }

    // Attach global edit/delete handlers
    window.editFarm = async function(id) {
        const res = await FarmAPI.getOne(id);
        if (res.success && res.farm) {
            openModal(true, res.farm);
        }
    };

    window.deleteFarm = async function(id) {
        if (confirm('Are you sure you want to delete this farm? Existing recommendation history will be preserved.')) {
            const res = await FarmAPI.delete(id);
            if (res.success) {
                loadFarms();
            } else {
                alert(res.message || 'Could not delete farm.');
            }
        }
    };
});

async function loadFarms() {
    const grid = document.getElementById('farms-grid');
    if (!grid) return;

    try {
        const res = await FarmAPI.getAll();
        if (res.success && res.farms && res.farms.length > 0) {
            grid.innerHTML = res.farms.map(f => `
              <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
                <div>
                  <div class="flex items-start justify-between">
                    <div>
                      <span class="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">Registered Field</span>
                      <h3 class="text-xl font-extrabold text-slate-900 capitalize mt-1">${f.farm_name}</h3>
                      <p class="text-xs text-slate-400 font-medium"><i class="fas fa-location-dot text-rose-500 mr-1"></i>${f.district || 'AP'}, ${f.state || 'Andhra Pradesh'}</p>
                    </div>
                    <div class="w-10 h-10 bg-slate-50 text-slate-700 rounded-2xl flex items-center justify-center font-bold">
                      <i class="fas fa-wheat-field"></i>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span class="text-[10px] text-slate-400 font-bold uppercase">Area</span>
                      <p class="font-extrabold text-slate-900 mt-0.5">${f.area || '0'} Acres</p>
                    </div>
                    <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span class="text-[10px] text-slate-400 font-bold uppercase">Soil Type</span>
                      <p class="font-extrabold text-slate-900 mt-0.5 truncate">${f.soil_type || 'Red Sandy Loam'}</p>
                    </div>
                    <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span class="text-[10px] text-slate-400 font-bold uppercase">Irrigation</span>
                      <p class="font-extrabold text-slate-900 mt-0.5 truncate">${f.irrigation_type || 'Borewell'}</p>
                    </div>
                    <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span class="text-[10px] text-slate-400 font-bold uppercase">Status</span>
                      <p class="font-extrabold text-emerald-700 mt-0.5">Active</p>
                    </div>
                  </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div class="flex space-x-2">
                    <button onclick="editFarm(${f.id})" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
                      <i class="fas fa-pen"></i> Edit
                    </button>
                    <button onclick="deleteFarm(${f.id})" class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                  <a href="recommendation.html?farm_id=${f.id}" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center">
                    <i class="fas fa-wand-magic-sparkles mr-1.5"></i> Analyze
                  </a>
                </div>
              </div>`).join('');
        } else {
            grid.innerHTML = `
              <div class="col-span-full text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
                <div class="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 font-bold text-2xl">
                  <i class="fas fa-wheat-field"></i>
                </div>
                <h3 class="text-lg font-extrabold text-slate-900">No Farms Added Yet</h3>
                <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">Register your first farm plot to receive AI-powered crop recommendations.</p>
                <button onclick="document.getElementById('open-add-farm-modal').click()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md transition">
                  <i class="fas fa-plus mr-1"></i> Add Your First Farm
                </button>
              </div>`;
        }
    } catch (e) {
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-rose-500 text-sm">Failed to load farms.</div>`;
    }
}
