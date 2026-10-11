// ================================================================
// idle-logout.js
// Auto-logout users after a period of inactivity.
// - Works with Firebase Auth (waits for auth state)
// - Dormant for guests, active only when signed in
// - Safe to include on every page (index, login, dashboard, etc.)
// ================================================================

(function () {
    'use strict';

    // ===== CONFIG =====
    const IDLE_TIMEOUT_MS = 15 * 60 * 1000;   // 15 minutes of inactivity
    const WARNING_DURATION_MS = 60 * 1000;     // Show warning 60s before logout
    const WARNING_REDIRECT = 'login.html';

    // ===== STATE =====
    let idleTimer = null;
    let warningTimer = null;
    let warningCountdownInterval = null;
    let isWarningVisible = false;
    let lastActivity = Date.now();
    let isRunning = false;

    // ===== ACTIVITY EVENTS =====
    const ACTIVITY_EVENTS = [
        'mousemove',
        'mousedown',
        'keydown',
        'scroll',
        'touchstart',
        'touchmove',
        'click',
        'wheel',
        'focus'
    ];

    // Throttle activity resets
    let activityThrottle = null;
    const ACTIVITY_THROTTLE_MS = 1000;

    // ===== WARNING MODAL =====
    function createWarningModal() {
        if (document.getElementById('idleWarningModal')) return;

        const modal = document.createElement('div');
        modal.id = 'idleWarningModal';
        modal.innerHTML = `
            <div class="idle-warning-backdrop"></div>
            <div class="idle-warning-box" role="alertdialog" aria-labelledby="idleWarningTitle">
                <div class="idle-warning-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <h2 id="idleWarningTitle">Still there? 👋</h2>
                <p>You've been idle for a while. For your security, you'll be signed out in:</p>
                <div class="idle-warning-countdown" id="idleWarningCountdown">60</div>
                <div class="idle-warning-actions">
                    <button type="button" class="idle-warning-stay" id="idleWarningStay">
                        <i class="fas fa-check"></i> Stay Signed In
                    </button>
                    <button type="button" class="idle-warning-logout" id="idleWarningLogout">
                        <i class="fas fa-sign-out-alt"></i> Log Out Now
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('idleWarningStay').addEventListener('click', dismissWarning);
        document.getElementById('idleWarningLogout').addEventListener('click', performLogout);
    }

    // ===== STYLES =====
    function injectStyles() {
        if (document.getElementById('idleWarningStyles')) return;

        const style = document.createElement('style');
        style.id = 'idleWarningStyles';
        style.textContent = `
            #idleWarningModal {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 99999;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            }
            #idleWarningModal.show { display: flex; }

            #idleWarningModal .idle-warning-backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.55);
                backdrop-filter: blur(8px);
                animation: idleFadeIn 0.25s ease;
            }

            #idleWarningModal .idle-warning-box {
                position: relative;
                background: white;
                border-radius: 24px;
                padding: 32px 30px 26px;
                max-width: 420px;
                width: 100%;
                text-align: center;
                box-shadow: 0 25px 70px rgba(0,0,0,0.25);
                animation: idlePopIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                font-family: inherit;
            }

            #idleWarningModal .idle-warning-icon {
                width: 70px;
                height: 70px;
                margin: 0 auto 16px;
                border-radius: 50%;
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                color: #d97706;
                animation: idlePulse 1.6s ease-in-out infinite;
            }

            #idleWarningModal h2 {
                font-size: 22px;
                font-weight: 800;
                color: #1a1a2e;
                margin-bottom: 8px;
            }

            #idleWarningModal p {
                font-size: 14px;
                color: #666;
                line-height: 1.5;
                margin-bottom: 14px;
            }

            #idleWarningModal .idle-warning-countdown {
                font-size: 44px;
                font-weight: 900;
                color: #f5576c;
                margin-bottom: 20px;
                line-height: 1;
                font-variant-numeric: tabular-nums;
                animation: idleTick 1s ease-in-out infinite;
            }

            #idleWarningModal .idle-warning-actions {
                display: flex;
                gap: 10px;
                flex-direction: column;
            }

            #idleWarningModal .idle-warning-actions button {
                width: 100%;
                padding: 13px 20px;
                border-radius: 14px;
                border: none;
                font-weight: 700;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.25s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-family: inherit;
            }

            #idleWarningModal .idle-warning-stay {
                background: linear-gradient(45deg, rgb(16, 137, 211) 0%, rgb(18, 177, 209) 100%);
                color: white;
                box-shadow: 0 4px 15px rgba(16, 137, 211, 0.3);
            }

            #idleWarningModal .idle-warning-stay:hover {
                transform: scale(1.02);
                box-shadow: 0 6px 20px rgba(16, 137, 211, 0.45);
            }

            #idleWarningModal .idle-warning-logout {
                background: #f3f4f6;
                color: #666;
            }

            #idleWarningModal .idle-warning-logout:hover {
                background: #fee2e2;
                color: #dc2626;
            }

            @keyframes idleFadeIn {
                from { opacity: 0; }
                to   { opacity: 1; }
            }

            @keyframes idlePopIn {
                from { transform: scale(0.9) translateY(15px); opacity: 0; }
                to   { transform: scale(1) translateY(0); opacity: 1; }
            }

            @keyframes idlePulse {
                0%, 100% { transform: scale(1); }
                50%      { transform: scale(1.08); }
            }

            @keyframes idleTick {
                0%, 100% { transform: scale(1); }
                50%      { transform: scale(1.06); }
            }

            @media (max-width: 480px) {
                #idleWarningModal .idle-warning-box {
                    padding: 26px 22px 22px;
                }
                #idleWarningModal .idle-warning-countdown {
                    font-size: 38px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ===== TIMER RESET =====
    function resetIdleTimer() {
        lastActivity = Date.now();

        if (idleTimer) clearTimeout(idleTimer);
        if (warningTimer) clearTimeout(warningTimer);

        if (isWarningVisible) {
            dismissWarning();
        }

        const warningDelay = Math.max(IDLE_TIMEOUT_MS - WARNING_DURATION_MS, 1000);
        warningTimer = setTimeout(showWarning, warningDelay);
        idleTimer = setTimeout(performLogout, IDLE_TIMEOUT_MS);
    }

    // ===== SHOW WARNING =====
    function showWarning() {
        if (isWarningVisible) return;
        isWarningVisible = true;

        createWarningModal();
        const modal = document.getElementById('idleWarningModal');
        modal.classList.add('show');

        let secondsLeft = Math.round(WARNING_DURATION_MS / 1000);
        const countdownEl = document.getElementById('idleWarningCountdown');
        countdownEl.textContent = secondsLeft;

        if (warningCountdownInterval) clearInterval(warningCountdownInterval);
        warningCountdownInterval = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                clearInterval(warningCountdownInterval);
                warningCountdownInterval = null;
                return;
            }
            countdownEl.textContent = secondsLeft;
        }, 1000);
    }

    // ===== DISMISS WARNING =====
    function dismissWarning() {
        if (!isWarningVisible) return;
        isWarningVisible = false;

        const modal = document.getElementById('idleWarningModal');
        if (modal) modal.classList.remove('show');

        if (warningCountdownInterval) {
            clearInterval(warningCountdownInterval);
            warningCountdownInterval = null;
        }

        resetIdleTimer();
    }

    // ===== PERFORM LOGOUT =====
    async function performLogout() {
        if (idleTimer) clearTimeout(idleTimer);
        if (warningTimer) clearTimeout(warningTimer);
        if (warningCountdownInterval) clearInterval(warningCountdownInterval);

        ACTIVITY_EVENTS.forEach(evt => {
            document.removeEventListener(evt, onActivity, true);
            window.removeEventListener(evt, onActivity, true);
        });

        try {
            if (window.firebase && firebase.auth) {
                const auth = firebase.auth();
                if (auth.currentUser) {
                    await auth.signOut();
                }
            }
        } catch (err) {
            console.warn('Idle logout: signOut error', err);
        }

        try {
            sessionStorage.setItem('timawa_idle_logout', '1');
        } catch (e) { /* ignore */ }

        window.location.href = WARNING_REDIRECT;
    }

    // ===== ACTIVITY HANDLER =====
    function onActivity() {
        if (!isRunning) return;

        if (isWarningVisible) {
            dismissWarning();
            return;
        }

        if (activityThrottle) return;
        activityThrottle = setTimeout(() => {
            activityThrottle = null;
        }, ACTIVITY_THROTTLE_MS);

        resetIdleTimer();
    }

    // ===== START / STOP =====
    function start() {
        if (isRunning) return;

        injectStyles();

        ACTIVITY_EVENTS.forEach(evt => {
            document.addEventListener(evt, onActivity, true);
            window.addEventListener(evt, onActivity, true);
        });

        document.addEventListener('visibilitychange', onVisibilityChange);

        resetIdleTimer();
        isRunning = true;

        console.log(`⏱️ Idle auto-logout ACTIVE: ${IDLE_TIMEOUT_MS / 60000} min timeout, ${WARNING_DURATION_MS / 1000}s warning`);
    }

    function stop() {
        if (!isRunning) return;

        if (idleTimer) clearTimeout(idleTimer);
        if (warningTimer) clearTimeout(warningTimer);
        if (warningCountdownInterval) clearInterval(warningCountdownInterval);
        idleTimer = warningTimer = warningCountdownInterval = null;

        ACTIVITY_EVENTS.forEach(evt => {
            document.removeEventListener(evt, onActivity, true);
            window.removeEventListener(evt, onActivity, true);
        });
        document.removeEventListener('visibilitychange', onVisibilityChange);

        dismissWarning();
        isRunning = false;

        console.log('⏱️ Idle auto-logout DORMANT (no signed-in user)');
    }

    function onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            onActivity();
        }
    }

    // ===== WATCH AUTH STATE =====
    function watchAuth() {
        if (!window.firebase || !firebase.auth) {
            console.log('ℹ️ idle-logout: Firebase not present, skipping.');
            return;
        }

        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                start();
            } else {
                stop();
            }
        });
    }

    // ===== BOOT =====
    function boot() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', watchAuth);
        } else {
            watchAuth();
        }
    }

    boot();

    // Expose for debugging
    window.IdleLogout = {
        reset: resetIdleTimer,
        logout: performLogout,
        start,
        stop,
        isRunning: () => isRunning,
        getLastActivity: () => lastActivity
    };
})();