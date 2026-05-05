export function setupAuth() {
        /* ====================================================================
           4. ACCOUNT SYSTEM LOGIC
        ==================================================================== */
        window.openAccountModal = function() {
            window.triggerTutAction('open_account');
            document.getElementById('account-modal').style.display = 'flex';
            const statusText = document.getElementById('account-status-text');
            const authForms = document.getElementById('auth-forms');
            const logoutForm = document.getElementById('auth-logout-form');
            document.getElementById('auth-error').innerText = '';
            
            if (window.currentUser && !window.currentUser.isAnonymous) {
                statusText.innerHTML = `
                    <div style="text-align: center; padding: 10px 0;">
                        <div style="font-size: 3.5rem; margin-bottom: 15px;">🛡️</div>
                        <h3 style="color: var(--text-color); margin: 0 0 10px 0; font-size: 1.4rem;">Securely Connected</h3>
                        <p style="margin: 0;">Logged in as: <strong>${window.currentUser.email || 'Authenticated User'}</strong></p>
                        <p style="margin: 15px 0 0 0; font-size: 1rem; color: var(--grammar-border); font-weight: 600;">✅ Cloud Sync is Active</p>
                    </div>`;
                authForms.style.display = 'none';
                logoutForm.style.display = 'block';
            } else {
                statusText.innerHTML = `
                    <div style="text-align: center; padding: 10px 0;">
                        <div style="font-size: 3.5rem; margin-bottom: 15px;">👻</div>
                        <h3 style="color: var(--text-color); margin: 0 0 10px 0; font-size: 1.4rem;">Guest Session</h3>
                        <p style="margin: 0;">Sign in below to securely sync your projects across devices.</p>
                    </div>`;
                authForms.style.display = 'flex';
                logoutForm.style.display = 'none';
            }
        }

        window.registerAccount = async function(e) {
            if (e) e.preventDefault();
            const btn = e.currentTarget; 
            const span = btn ? btn.querySelector('span') : null;
            const origText = span ? span.innerText : btn.innerText;
            if (span) span.innerText = "⏳..."; else btn.innerText = "⏳...";

            const email = document.getElementById('auth-email').value.trim().toLowerCase();
            const pass = document.getElementById('auth-password').value;
            const errEl = document.getElementById('auth-error');
            errEl.innerText = '';

            if (!email || !pass) {
                errEl.innerText = "Please enter both email and password.";
                if (span) span.innerText = origText; else btn.innerText = origText;
                return;
            }

            try {
                const authPromise = window.firebaseCreateUser(window.auth, email, pass);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Registration timed out. Check connection.")), 15000));
                await Promise.race([authPromise, timeoutPromise]);

                if (span) span.innerText = "✅ Registered"; else btn.innerText = "✅ Registered";
                setTimeout(() => { if (span) span.innerText = origText; else btn.innerText = origText; window.openAccountModal(); }, 1500);
            } catch(err) { 
                if (err.code === 'auth/operation-not-allowed') {
                    errEl.innerText = "Setup Required: Enable 'Email/Password' in Firebase Console > Authentication > Sign-in method.";
                } else if (err.code === 'auth/configuration-not-found') {
                    errEl.innerText = "Setup Required: Click 'Get Started' in Firebase Console > Authentication.";
                } else {
                    errEl.innerText = err.message; 
                }
                if (span) span.innerText = "❌ Error"; else btn.innerText = "❌ Error";
                setTimeout(() => { if (span) span.innerText = origText; else btn.innerText = origText; }, 2500); 
            }
        }

        window.loginAccount = async function(e) {
            if (e) e.preventDefault();
            const btn = e.currentTarget; 
            const span = btn ? btn.querySelector('span') : null;
            const origText = span ? span.innerText : btn.innerText;
            if (span) span.innerText = "⏳..."; else btn.innerText = "⏳...";

            const email = document.getElementById('auth-email').value.trim().toLowerCase();
            const pass = document.getElementById('auth-password').value;
            const errEl = document.getElementById('auth-error');
            errEl.innerText = '';

            if (!email || !pass) {
                errEl.innerText = "Please enter both email and password.";
                if (span) span.innerText = origText; else btn.innerText = origText;
                return;
            }

            try {
                const authPromise = window.firebaseSignIn(window.auth, email, pass);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Login timed out. Check connection.")), 15000));
                await Promise.race([authPromise, timeoutPromise]);

                if (span) span.innerText = "✅ Logged In"; else btn.innerText = "✅ Logged In";
                setTimeout(() => { if (span) span.innerText = origText; else btn.innerText = origText; window.openAccountModal(); }, 1500);
            } catch(err) { 
                if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                    errEl.innerText = "Invalid email or password.";
                } else {
                    errEl.innerText = err.message; 
                }
                if (span) span.innerText = "❌ Error"; else btn.innerText = "❌ Error";
                setTimeout(() => { if (span) span.innerText = origText; else btn.innerText = origText; }, 2500); 
            }
        }

        window.logoutAccount = async function(e) {
            const btn = e.currentTarget; 
            const span = btn ? btn.querySelector('span') : null;
            const origText = span ? span.innerText : btn.innerText;
            if (span) span.innerText = "⏳..."; else btn.innerText = "⏳...";

            try {
                await window.firebaseSignOut(window.auth);
                await window.firebaseSignInAnon(window.auth);
                if (span) span.innerText = "✅ Signed Out"; else btn.innerText = "✅ Signed Out";
                setTimeout(() => { if (span) span.innerText = origText; else btn.innerText = origText; window.openAccountModal(); }, 1500);
            } catch(err) { 
                console.error(err); 
                if (span) span.innerText = "❌ Error"; else btn.innerText = "❌ Error";
                setTimeout(() => { if (span) span.innerText = origText; else btn.innerText = origText; }, 1500); 
            }
        }


}