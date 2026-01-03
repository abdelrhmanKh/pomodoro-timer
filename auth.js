// ============ AUTH PAGE LOGIC ============

document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase auth state to be determined
    let authChecked = false;

    // Listen for auth state - this will fire when Firebase is ready
    window.addEventListener('authStateChanged', (e) => {
        if (e.detail.user && !authChecked) {
            authChecked = true;
            window.location.href = 'index.html';
        }
    });

    // If Firebase already initialized and user exists, redirect
    if (window.firebaseApp && window.firebaseApp.currentUser) {
        window.location.href = 'index.html';
        return;
    }

    // DOM Elements
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const closeForgotPasswordModal = document.getElementById('closeForgotPasswordModal');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const passwordToggles = document.querySelectorAll('.password-toggle');

    // Tab switching
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            authForms.forEach(form => {
                form.classList.remove('active');
                if (form.dataset.form === targetTab) {
                    form.classList.add('active');
                }
            });

            // Clear errors
            hideAllErrors();
        });
    });

    // Password toggle
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.dataset.target;
            const input = document.getElementById(targetId);
            if (input.type === 'password') {
                input.type = 'text';
                toggle.textContent = '🙈';
            } else {
                input.type = 'password';
                toggle.textContent = '👁️';
            }
        });
    });

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAllErrors();

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            showError('loginError', 'Please fill in all fields');
            return;
        }

        showLoading();

        try {
            const result = await window.firebaseApp.signIn(email, password);
            hideLoading();

            if (result.success) {
                window.location.href = 'index.html';
            } else {
                showError('loginError', getErrorMessage(result.error));
            }
        } catch (error) {
            hideLoading();
            showError('loginError', 'An error occurred. Please try again.');
            console.error('Login error:', error);
        }
    });

    // Signup form submission
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAllErrors();

        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        if (!name || !email || !password || !confirmPassword) {
            showError('signupError', 'Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            showError('signupError', 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            showError('signupError', 'Password must be at least 6 characters');
            return;
        }

        showLoading();

        try {
            const result = await window.firebaseApp.signUp(email, password, name);
            hideLoading();

            if (result.success) {
                window.location.href = 'index.html';
            } else {
                showError('signupError', getErrorMessage(result.error));
            }
        } catch (error) {
            hideLoading();
            showError('signupError', 'An error occurred. Please try again.');
            console.error('Signup error:', error);
        }
    });

    // Google sign in
    googleSignInBtn.addEventListener('click', async () => {
        showLoading();

        try {
            const result = await window.firebaseApp.signInWithGoogle();
            hideLoading();

            if (result.success) {
                window.location.href = 'index.html';
            } else {
                showError('loginError', getErrorMessage(result.error));
            }
        } catch (error) {
            hideLoading();
            showError('loginError', 'Google sign in failed. Please try again.');
            console.error('Google sign in error:', error);
        }
    });

    // Forgot password
    forgotPasswordBtn.addEventListener('click', () => {
        forgotPasswordModal.classList.remove('hidden');
        document.getElementById('resetEmail').value = document.getElementById('loginEmail').value;
    });

    closeForgotPasswordModal.addEventListener('click', () => {
        forgotPasswordModal.classList.add('hidden');
    });

    forgotPasswordModal.addEventListener('click', (e) => {
        if (e.target === forgotPasswordModal) {
            forgotPasswordModal.classList.add('hidden');
        }
    });

    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('resetEmail').value.trim();
        const errorEl = document.getElementById('resetError');
        const successEl = document.getElementById('resetSuccess');

        errorEl.classList.add('hidden');
        successEl.classList.add('hidden');

        if (!email) {
            errorEl.textContent = 'Please enter your email';
            errorEl.classList.remove('hidden');
            return;
        }

        showLoading();

        try {
            const result = await window.firebaseApp.resetPassword(email);
            hideLoading();

            if (result.success) {
                successEl.textContent = 'Password reset email sent! Check your inbox.';
                successEl.classList.remove('hidden');
                setTimeout(() => {
                    forgotPasswordModal.classList.add('hidden');
                }, 3000);
            } else {
                errorEl.textContent = getErrorMessage(result.error);
                errorEl.classList.remove('hidden');
            }
        } catch (error) {
            hideLoading();
            errorEl.textContent = 'An error occurred. Please try again.';
            errorEl.classList.remove('hidden');
            console.error('Reset password error:', error);
        }
    });

    // Helper functions
    function showError(elementId, message) {
        const errorEl = document.getElementById(elementId);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    function hideAllErrors() {
        document.querySelectorAll('.auth-error, .auth-success').forEach(el => {
            el.classList.add('hidden');
        });
    }

    function showLoading() {
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    function getErrorMessage(error) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered',
            'auth/invalid-email': 'Invalid email address',
            'auth/operation-not-allowed': 'Operation not allowed',
            'auth/weak-password': 'Password is too weak',
            'auth/user-disabled': 'This account has been disabled',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-login-credentials': 'Invalid Password or Email ',
            'auth/popup-closed-by-user': 'Sign in was cancelled',
            'auth/network-request-failed': 'Network error. Please check your connection',
            'auth/too-many-requests': 'Too many attempts. Please try again later'
        };

        for (const [code, message] of Object.entries(errorMessages)) {
            if (error.includes(code)) {
                return message;
            }
        }

        return error || 'An error occurred. Please try again.';
    }
});
