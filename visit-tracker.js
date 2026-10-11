// ================================================================
// visit-tracker.js
// Tracks the last visit of each signed-in user.
//
// Behavior:
//   - Writes ONCE per browser session (per uid)
//   - visitCount increments once per session
//   - lastVisit / lastVisitPage / lastVisitTitle updated on that single write
//   - Handles multi-tab via localStorage "already counted this session" flag
//   - Skips admin pages
// ================================================================

(function () {
    'use strict';

    // ===== CONFIG =====
    const SKIP_ADMIN = true;
    const SESSION_WRITE_KEY = 'timawa_visit_written_';  // + uid
    const SESSION_UID_KEY   = 'timawa_visit_uid';

    // ===== GUARDS =====
    if (SKIP_ADMIN && /admin/i.test(window.location.pathname)) {
        console.log('🛡️ visit-tracker: skipped (admin page)');
        return;
    }

    if (!window.firebase || !firebase.auth || !firebase.firestore) {
        console.log('ℹ️ visit-tracker: Firebase not present, skipping.');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    // ===== HELPERS =====
    function safeGet(storage, key) {
        try { return storage.getItem(key); } catch (e) { return null; }
    }
    function safeSet(storage, key, value) {
        try { storage.setItem(key, value); } catch (e) {}
    }

    function alreadyWrittenThisSession(uid) {
        // localStorage is shared across tabs — a new tab in the SAME session
        // (same browser session) will see this flag and skip.
        // sessionStorage also checked for safety.
        return (
            safeGet(sessionStorage, SESSION_WRITE_KEY + uid) === '1' ||
            safeGet(localStorage,  SESSION_WRITE_KEY + uid) === '1'
        );
    }

    function markWritten(uid) {
        safeSet(sessionStorage, SESSION_WRITE_KEY + uid, '1');
        safeSet(localStorage,  SESSION_WRITE_KEY + uid, '1');
    }

    function currentPageInfo() {
        const path = window.location.pathname.split('/').pop() || 'index.html';
        const title = document.title || 'TIMAWA';
        return { path, title };
    }

    // ===== WRITE =====
    async function recordVisit(user) {
        if (!user) return;
        if (alreadyWrittenThisSession(user.uid)) {
            console.log('⏱️ visit-tracker: already written this session');
            return;
        }

        const { path, title } = currentPageInfo();

        try {
            await db.collection('users').doc(user.uid).set({
                lastVisit: firebase.firestore.FieldValue.serverTimestamp(),
                lastVisitPage: path,
                lastVisitTitle: title,
                visitCount: firebase.firestore.FieldValue.increment(1)
            }, { merge: true });

            markWritten(user.uid);
            console.log(`👋 visit-tracker: recorded visit to ${path}`);
        } catch (err) {
            console.warn('visit-tracker: write failed —', err.message);
            // Don't mark — allow retry on next page load
        }
    }

    // ===== AUTH HOOK =====
    let lastHandledUid = null;

    auth.onAuthStateChanged(function (user) {
        if (!user) { lastHandledUid = null; return; }
        if (lastHandledUid === user.uid) return;
        lastHandledUid = user.uid;

        setTimeout(() => recordVisit(user), 800);
    });

    // ===== NO visibilitychange handler needed =====
    // The session flag already prevents re-writes within the same session.
    // On a brand-new browser session, sessionStorage + localStorage are
    // cleared (localStorage is NOT — so we use a date-based reset below if needed).

    // ===== LOCAL DATE HELPER (fixes UTC rollover at 8AM PHT) =====
    function getLocalDateString(date) {
        const d = date instanceof Date ? date : new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // ===== OPTIONAL: clear the "already written" flag daily =====
    // localStorage persists across browser restarts, so we expire the flag
    // at midnight LOCAL time (PHT) to allow a fresh count per day.
    (function expireSessionFlagDaily() {
        try {
            const today = getLocalDateString();  // ✅ LOCAL date (PHT)
            const storedDay = safeGet(localStorage, 'timawa_visit_day');
            if (storedDay !== today) {
                // New day — clear all visit-written flags
                Object.keys(localStorage).forEach(k => {
                    if (k.startsWith(SESSION_WRITE_KEY)) localStorage.removeItem(k);
                });
                safeSet(localStorage, 'timawa_visit_day', today);
            }
        } catch (e) {}
    })();

    // ===== EXPOSE FOR DEBUGGING =====
    window.VisitTracker = {
        forceWrite: function () {
            const user = auth.currentUser;
            if (!user) { console.warn('visit-tracker: no signed-in user'); return; }
            try {
                sessionStorage.removeItem(SESSION_WRITE_KEY + user.uid);
                localStorage.removeItem(SESSION_WRITE_KEY + user.uid);
            } catch (e) {}
            recordVisit(user);
        },
        skipAdmin: SKIP_ADMIN
    };

    console.log(`✅ visit-tracker loaded (session-scoped, skipAdmin: ${SKIP_ADMIN})`);
})();