// nav.js - Standardized Professional Sidebar & Navigation Component for CropAI

function initCropAINavigation(activePageKey) {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    // Inject sidebar CSS — Tailwind CDN JIT cannot scan JS-generated innerHTML,
    // so responsive classes like lg:translate-x-0 would never be generated.
    // We use a <style> block with plain CSS to guarantee correct rendering.
    if (!document.getElementById('cropai-nav-styles')) {
        const style = document.createElement('style');
        style.id = 'cropai-nav-styles';
        style.textContent = `
            #sidebar {
                position: fixed;
                top: 0; left: 0;
                width: 18rem;
                height: 100vh;
                background: #ffffff;
                border-right: 1px solid rgba(226,232,240,0.8);
                display: flex;
                flex-direction: column;
                z-index: 50;
                transform: translateX(-100%);
                transition: transform 0.3s ease-in-out;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);
            }
            @media (min-width: 1024px) {
                #sidebar {
                    transform: translateX(0) !important;
                    box-shadow: none;
                }
            }
            #mobile-backdrop {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(15,23,42,0.5);
                backdrop-filter: blur(4px);
                z-index: 40;
            }
            #mobile-backdrop.open { display: block; }
            #sidebar.open { transform: translateX(0); }
            .cropai-mobile-header { display: flex; }
            @media (min-width: 1024px) {
                .cropai-mobile-header { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    const navItems = [
        { section: 'MAIN' },
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-table-columns', href: 'dashboard.html' },
        
        { section: 'FARMING' },
        { key: 'farms', label: 'My Farms', icon: 'fa-seedling', href: 'farm.html' },
        { key: 'analysis', label: 'New AI Analysis', icon: 'fa-wand-magic-sparkles', href: 'recommendation.html' },
        { key: 'history', label: 'Analysis History', icon: 'fa-clock-rotate-left', href: 'history.html' },
        
        { section: 'INTELLIGENCE' },
        { key: 'weather', label: 'Weather', icon: 'fa-cloud-sun-rain', href: 'weather.html' },
        { key: 'market', label: 'Market Intelligence', icon: 'fa-chart-line', href: 'market.html' },
        { key: 'insights', label: 'Crop Insights', icon: 'fa-lightbulb', href: 'insights.html' },
        
        { section: 'REPORTS' },
        { key: 'reports', label: 'My Reports', icon: 'fa-file-contract', href: 'reports.html' },
        
        { section: 'ACCOUNT' },
        { key: 'profile', label: 'Profile', icon: 'fa-user-gear', href: 'profile.html' },
        { key: 'settings', label: 'Settings', icon: 'fa-sliders', href: 'settings.html' }
    ];

    let navHTML = `
      <!-- Mobile Backdrop -->
      <div id="mobile-backdrop"></div>

      <!-- Mobile Top Header Bar -->
      <div class="cropai-mobile-header" style="position:fixed;top:0;left:0;right:0;height:4rem;background:#fff;border-bottom:1px solid #e2e8f0;z-index:30;align-items:center;justify-content:space-between;padding:0 1rem;">
        <div style="display:flex;align-items:center;gap:0.625rem;">
          <div style="width:2.25rem;height:2.25rem;background:#059669;border-radius:0.75rem;display:flex;align-items:center;justify-content:center;color:#fff;">
            <i class="fas fa-leaf" style="font-size:0.875rem;"></i>
          </div>
          <div>
            <span style="font-weight:800;font-size:1.125rem;color:#0f172a;display:block;line-height:1.2;">CropAI</span>
            <span style="font-size:0.625rem;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:0.1em;display:block;">Smart Farming</span>
          </div>
        </div>
        <button id="mobile-menu-btn" style="width:2.5rem;height:2.5rem;border-radius:0.75rem;background:#f1f5f9;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#334155;">
          <i class="fas fa-bars" style="font-size:1.125rem;"></i>
        </button>
      </div>

      <!-- Sidebar Element — styled via #cropai-nav-styles injected CSS -->
      <aside id="sidebar">
        
        <!-- Sidebar Brand Header -->
        <div style="height:5rem;display:flex;align-items:center;padding:0 1.5rem;border-bottom:1px solid #f1f5f9;justify-content:space-between;flex-shrink:0;">
          <a href="dashboard.html" style="display:flex;align-items:center;gap:0.75rem;text-decoration:none;">
            <div style="width:2.5rem;height:2.5rem;background:linear-gradient(135deg,#10b981,#047857);border-radius:1rem;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 6px -1px rgba(16,185,129,0.3);">
              <i class="fas fa-leaf" style="font-size:1.125rem;"></i>
            </div>
            <div>
              <span style="font-weight:800;font-size:1.25rem;color:#0f172a;display:block;line-height:1.2;">CropAI</span>
              <span style="font-size:0.625rem;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.1em;display:block;">Smart Farming Intelligence</span>
            </div>
          </a>
          <button id="sidebar-close-btn" style="display:none;background:none;border:none;cursor:pointer;color:#94a3b8;padding:0.25rem;" class="cropai-close-btn">
            <i class="fas fa-xmark" style="font-size:1.125rem;"></i>
          </button>
        </div>

        <!-- Scrollable Navigation Area -->
        <div style="flex:1;overflow-y:auto;padding:1.5rem 1rem;display:flex;flex-direction:column;gap:1.25rem;">
    `;

    let sectionOpen = false;
    navItems.forEach(item => {
        if (item.section) {
            if (sectionOpen) navHTML += `</div>`;
            navHTML += `
              <div style="padding:0.5rem 0.75rem 0;font-size:0.65rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;">${item.section}</div>
              <div style="display:flex;flex-direction:column;gap:2px;margin-top:2px;">
            `;
            sectionOpen = true;
        } else {
            const isActive = item.key === activePageKey;
            const linkStyle = isActive
                ? `display:flex;align-items:center;padding:0.625rem 0.875rem;border-radius:0.75rem;font-size:0.875rem;font-weight:700;color:#065f46;background:#ecfdf5;border-right:4px solid #059669;text-decoration:none;transition:background 0.15s;`
                : `display:flex;align-items:center;padding:0.625rem 0.875rem;border-radius:0.75rem;font-size:0.875rem;font-weight:600;color:#475569;text-decoration:none;transition:background 0.15s;`;
            const iconStyle = isActive
                ? `width:1.25rem;margin-right:0.75rem;text-align:center;color:#059669;font-size:0.9rem;`
                : `width:1.25rem;margin-right:0.75rem;text-align:center;color:#94a3b8;font-size:0.9rem;`;

            navHTML += `
              <a href="${item.href}" style="${linkStyle}" onmouseover="if(!this.classList.contains('active-nav'))this.style.background='#f8fafc'" onmouseout="if(!this.classList.contains('active-nav'))this.style.background=''" ${isActive ? 'class="active-nav"' : ''}>
                <i class="fas ${item.icon}" style="${iconStyle}"></i>
                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.label}</span>
              </a>
            `;
        }
    });
    if (sectionOpen) navHTML += `</div>`;

    navHTML += `
        </div><!-- end scroll area -->

        <!-- Sidebar Footer & Logout -->
        <div style="padding:1rem;border-top:1px solid #f1f5f9;background:#f8fafc;flex-shrink:0;">
          <!-- Logout Button -->
          <button id="nav-logout-btn" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:0.625rem 0.875rem;margin-top:0.75rem;font-size:0.75rem;font-weight:700;color:#e11d48;background:none;border:none;border-radius:0.75rem;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='#fff1f2'" onmouseout="this.style.background=''">
            <span style="display:flex;align-items:center;"><i class="fas fa-arrow-right-from-bracket" style="width:1.25rem;margin-right:0.5rem;text-align:center;font-size:0.875rem;"></i> Logout</span>
            <i class="fas fa-chevron-right" style="font-size:0.625rem;color:#fda4af;"></i>
          </button>
        </div>

      </aside>
    `;

    sidebarContainer.innerHTML = navHTML;

    // Purge any remaining Farming Assistant card elements from DOM
    setTimeout(() => {
        document.querySelectorAll('aside div').forEach(el => {
            if (el.innerText && el.innerText.includes('Farming Assistant') && el.innerText.includes('Start Analysis')) {
                el.remove();
            }
        });
    }, 50);

    // Mobile Toggle Bindings
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const closeBtn = document.getElementById('sidebar-close-btn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-backdrop');

    function openSidebar() {
        if (sidebar && backdrop) {
            sidebar.classList.add('open');
            backdrop.classList.add('open');
            const closeBtn2 = document.getElementById('sidebar-close-btn');
            if (closeBtn2) closeBtn2.style.display = 'block';
        }
    }

    function closeSidebar() {
        if (sidebar && backdrop) {
            sidebar.classList.remove('open');
            backdrop.classList.remove('open');
            const closeBtn2 = document.getElementById('sidebar-close-btn');
            if (closeBtn2) closeBtn2.style.display = 'none';
        }
    }

    if (mobileBtn) mobileBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

    // Logout Action
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to log out of CropAI?')) {
                AuthAPI.logout();
            }
        });
    }
}
