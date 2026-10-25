import { signup, login, getCurrentUser, setToken } from './api.js';
import { showToast, initTheme, toggleTheme } from './utils.js';

// Initialize Theme
initTheme();

// Make toggleTheme available to window
window.toggleTheme = toggleTheme;

// Tab switching
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

if (tabLogin && tabSignup) {
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    });

    tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });
}

// Visual Role Cards Selection
const roleCards = document.querySelectorAll('.role-card');
const roleInput = document.getElementById('signupRole');
const ngoFields = document.getElementById('ngoFields');

roleCards.forEach(card => {
    card.addEventListener('click', () => {
        roleCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const role = card.dataset.role;
        if (roleInput) roleInput.value = role;
        if (ngoFields) {
            ngoFields.classList.toggle('hidden', role !== 'ngo');
        }
    });
});

// Password Show/Hide Toggle
const toggleLoginPass = document.getElementById('toggleLoginPassword');
const loginPassInput = document.getElementById('loginPassword');
if (toggleLoginPass && loginPassInput) {
    toggleLoginPass.addEventListener('click', () => {
        const isPass = loginPassInput.type === 'password';
        loginPassInput.type = isPass ? 'text' : 'password';
        toggleLoginPass.textContent = isPass ? 'Hide' : 'Show';
    });
}

// Quick Demo Credentials Autofill
document.querySelectorAll('.demo-fill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const email = btn.dataset.email;
        const pass = btn.dataset.pass;
        const emailInput = document.getElementById('loginEmail');
        const passInput = document.getElementById('loginPassword');
        if (emailInput) emailInput.value = email;
        if (passInput) passInput.value = pass;
        showToast(`Filled ${btn.textContent.trim()} demo credentials`, 'info', 1500);
    });
});

const toggleSignupPass = document.getElementById('toggleSignupPassword');
const signupPassInput = document.getElementById('signupPassword');
const strengthMeter = document.getElementById('passwordStrength');

if (toggleSignupPass && signupPassInput) {
    toggleSignupPass.addEventListener('click', () => {
        const isPass = signupPassInput.type === 'password';
        signupPassInput.type = isPass ? 'text' : 'password';
        toggleSignupPass.textContent = isPass ? 'Hide' : 'Show';
    });

    signupPassInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (!strengthMeter) return;
        if (val.length === 0) {
            strengthMeter.style.width = '0';
            strengthMeter.style.background = 'var(--border-color)';
        } else if (val.length < 6) {
            strengthMeter.style.width = '33%';
            strengthMeter.style.background = 'var(--danger-500)';
        } else if (val.length < 10) {
            strengthMeter.style.width = '66%';
            strengthMeter.style.background = 'var(--warning-500)';
        } else {
            strengthMeter.style.width = '100%';
            strengthMeter.style.background = 'var(--primary-500)';
        }
    });
}

// Auto-Detect Location Coordinates
const detectBtn = document.getElementById('detectLocationBtn');
if (detectBtn) {
    detectBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser', 'warning');
            return;
        }

        detectBtn.textContent = '⏳ Locating...';
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                document.getElementById('signupLat').value = pos.coords.latitude.toFixed(6);
                document.getElementById('signupLng').value = pos.coords.longitude.toFixed(6);
                detectBtn.textContent = '✓ Location Set';
                showToast('Coordinates populated from GPS!', 'success');
            },
            (err) => {
                detectBtn.textContent = '📍 Auto-Detect Location';
                showToast('Could not fetch GPS location. Please enter manually.', 'warning');
            }
        );
    });
}

// Submit Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('loginSubmitBtn');
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';
            }
            const response = await login(email, password);
            setToken(response.token);
            showToast(`Welcome back, ${response.user.name}!`, 'success');
            setTimeout(() => {
                window.location.href = `${response.user.role}.html`;
            }, 500);
        } catch (error) {
            showToast(error.message || 'Login failed. Please check credentials.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In to Dashboard';
            }
        }
    });
}

// Submit Signup
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('signupSubmitBtn');
        
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const name = document.getElementById('signupName').value.trim();
        const phone = document.getElementById('signupPhone').value.trim();
        const role = roleInput ? roleInput.value : 'donor';
        const address = document.getElementById('signupAddress').value.trim();
        const lat = parseFloat(document.getElementById('signupLat').value);
        const lng = parseFloat(document.getElementById('signupLng').value);
        const capacityVal = document.getElementById('signupCapacity')?.value;
        const capacity = role === 'ngo' ? (parseInt(capacityVal, 10) || 50) : undefined;

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating account...';
            }
            const response = await signup({
                email,
                password,
                name,
                phone,
                role,
                address,
                lat,
                lng,
                capacity
            });
            setToken(response.token);
            showToast('Account created successfully!', 'success');
            setTimeout(() => {
                window.location.href = `${response.user.role}.html`;
            }, 500);
        } catch (error) {
            showToast(error.message || 'Registration failed. Please check details.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Complete Registration';
            }
        }
    });
}

async function initAuth() {
    try {
        const response = await getCurrentUser();
        if (response?.user?.role) {
            window.location.href = `${response.user.role}.html`;
        }
    } catch (error) {
        // Not logged in; allow user to login/signup
    }
}

initAuth();
