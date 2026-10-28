// auth.js - Handles Login and Registration logic

document.addEventListener('DOMContentLoaded', () => {
    
    // ----- LOGIN LOGIC -----
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // Check for URL params (like expired session)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('expired')) {
            const urlMsg = document.getElementById('url-msg');
            urlMsg.textContent = "Your session expired. Please log in again.";
            urlMsg.classList.remove('hidden');
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const btn = document.getElementById('login-btn');
            const spinner = document.getElementById('login-spinner');
            const errorBox = document.getElementById('error-msg');
            const errorText = document.getElementById('error-text');

            // UI feedback
            errorBox.classList.add('hidden');
            btn.disabled = true;
            spinner.classList.remove('hidden');

            const res = await AuthAPI.login(email, password);

            btn.disabled = false;
            spinner.classList.add('hidden');

            if (res.success) {
                // Save token and user info
                localStorage.setItem('token', res.token);
                localStorage.setItem('user', JSON.stringify(res.user));
                
                // Redirect to appropriate dashboard
                const role = res.user && res.user.role;
                if (role === 'admin' || role === 'superadmin') {
                    window.location.href = 'admin/dashboard.html';
                } else {
                    window.location.href = 'user/dashboard.html';
                }
            } else {
                errorText.textContent = res.message || 'Login failed.';
                errorBox.classList.remove('hidden');
            }
        });
    }

    // ----- REGISTRATION LOGIC -----
    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const state = document.getElementById('reg-state').value;
            const district = document.getElementById('reg-district').value.trim();
            const lang = document.getElementById('reg-lang').value;
            const password = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-confirm').value;
            
            const btn = document.getElementById('reg-btn');
            const spinner = document.getElementById('reg-spinner');
            const errorBox = document.getElementById('reg-error');
            const errorText = document.getElementById('reg-error-text');

            errorBox.classList.add('hidden');

            // Client-side validation
            if (password !== confirm) {
                errorText.textContent = "Passwords do not match.";
                errorBox.classList.remove('hidden');
                return;
            }

            const pwdRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
            if (!pwdRegex.test(password)) {
                errorText.textContent = "Password must be at least 8 chars, contain 1 uppercase letter and 1 number.";
                errorBox.classList.remove('hidden');
                return;
            }

            // Prepare payload
            const userData = {
                name, email, password, confirm_password: confirm,
                phone, state, district, preferred_language: lang
            };

            // UI feedback
            btn.disabled = true;
            spinner.classList.remove('hidden');

            const res = await AuthAPI.register(userData);

            btn.disabled = false;
            spinner.classList.add('hidden');

            if (res.success) {
                alert('Registration successful! Please log in.');
                window.location.href = 'login.html';
            } else {
                if (res.errors && res.errors.length > 0) {
                    errorText.textContent = res.errors[0].msg;
                } else {
                    errorText.textContent = res.message || 'Registration failed.';
                }
                errorBox.classList.remove('hidden');
            }
        });
    }

});
