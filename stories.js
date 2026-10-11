/* ================================================================
   stories.js · TIMAWA / Barkada Stories  (core, v1.3)
   One module shared by index.html and dashboard.html:
     - ONE realtime listener on `stories` (active ones only)
     - Stories row (mounted into #storiesMount) + rings on squad avatars
     - Full-screen viewer, reactions, replies -> existing chatMessages
   The composer (stories-composer.js) is lazy-loaded on first use.
   Reuses the page's existing default Firebase app (no second init).

   Firestore model
     stories/{id}                     ownerUid, ownerName, ownerPhoto, mediaType,
                                      mediaUrl, thumbUrl, mediaFit, caption,
                                      textOverlays[], spotifyTrack?, status,
                                      mediaItems[] + layout (photo collage, images only),
                                      durationMs (how long it plays: 15-60s for photos,
                                      auto for video), music? (30s clip + start/length),
                                      muteVideo, createdAt (server), expiresAt (= +24h,
                                      Firestore TTL policy deletes the doc afterwards)
     stories/{id}/reactions/{uid}     emoji, uid, name, photo, createdAt
     stories/{id}/views/{uid}         uid, name, photo, viewedAt  (readable by the story owner + admins only)
     chatMessages/{id}                (existing schema) + type:'story_reply',
                                      storyRef:{...}
   ================================================================ */
(function () {
    'use strict';
    if (window.Stories) return;
    const S = window.StoriesShared;
    if (!S) { console.warn('stories.js: stories-shared.js must load first'); return; }
    if (!window.firebase || !firebase.apps || !firebase.apps.length) { console.warn('stories.js: Firebase app not initialised'); return; }

    const CFG = Object.assign({
        IMAGE_MS: 6000,
        MAX_REPLY: 300,
        composerSrc: 'stories-composer.js?v=1.4.0',
        spotifySearchUrl: ''          // optional Cloud Function URL (see STORIES_SETUP.md)
    }, window.STORIES_CONFIG || {});

    const auth = firebase.auth();
    const db = firebase.firestore();
    const QUICK = ['❤️', '😂', '😮', '😢', '🔥', '👏'];
    const MORE = ['😍', '🥹', '🤣', '👍', '🙏', '💯', '🎉', '😎', '🤯', '🥰', '😭', '😡'];

    // ------------------------------------------------------------ state
    const st = {
        me: null,            // {uid,name,photo}
        stories: [],         // active, normalised
        loaded: false,
        error: null,
        groups: [],
        byOwner: new Map(),
        unsub: null,
        seen: {},
        chatEnabled: null,
        skew: 0              // serverTime - deviceTime (ms), learnt after publish
    };
    const now = () => Date.now() + st.skew;

    function toast(msg, type) {
        if (typeof window.showToast === 'function') { try { window.showToast(msg, type || 'info'); return; } catch (e) { /* fall through */ } }
        let el = document.getElementById('stToast');
        if (!el) {
            el = document.createElement('div'); el.id = 'stToast';
            el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10100;background:#222;color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;max-width:90vw';
            document.body.appendChild(el);
        }
        el.textContent = msg; el.style.display = 'block';
        clearTimeout(el._t); el._t = setTimeout(() => { el.style.display = 'none'; }, 3200);
    }

    // ------------------------------------------------------------ seen state (per device)
    function seenKey() { return 'timawa_story_seen_' + (st.me ? st.me.uid : 'x'); }
    function loadSeen() {
        try { st.seen = JSON.parse(localStorage.getItem(seenKey()) || '{}') || {}; } catch (e) { st.seen = {}; }
        const cut = Date.now() - 36 * 3600 * 1000;
        Object.keys(st.seen).forEach(k => { if (st.seen[k] < cut) delete st.seen[k]; });
    }
    function markSeen(id) {
        if (st.seen[id]) return;
        st.seen[id] = Date.now();
        try { localStorage.setItem(seenKey(), JSON.stringify(st.seen)); } catch (e) { /* ignore */ }
    }

    // ------------------------------------------------------------ data
    // Expiry is derived from the SERVER createdAt, never from a device clock:
    //   effective expiry = min(stored expiresAt, createdAt + 24h).
    // A doc with no usable server createdAt (and no pending local write) is
    // treated as malformed and dropped, so it can never become immortal.
    function norm(doc) {
        const d = doc.data();
        const pending = !!(doc.metadata && doc.metadata.hasPendingWrites);
        const hasServerTs = d.createdAt && typeof d.createdAt.toMillis === 'function';
        const created = hasServerTs ? d.createdAt.toMillis() : (pending ? Date.now() : 0);
        let exp = created + S.DURATION_MS;
        if (d.expiresAt && typeof d.expiresAt.toMillis === 'function') exp = Math.min(d.expiresAt.toMillis(), created + S.DURATION_MS);
        return {
            id: doc.id, ownerUid: d.ownerUid, ownerName: d.ownerName || 'Member', ownerPhoto: d.ownerPhoto || '',
            mediaType: d.mediaType === 'video' ? 'video' : 'image', mediaUrl: S.safeMediaUrl(d.mediaUrl), thumbUrl: S.safeMediaUrl(d.thumbUrl),
            mediaFit: d.mediaFit === 'fit' ? 'fit' : 'fill', durationMs: Number(d.durationMs) || 0,
            mediaItems: Array.isArray(d.mediaItems) ? d.mediaItems.map(x => ({ url: S.safeMediaUrl(x && x.url) })).filter(x => x.url).slice(0, S.MAX_PHOTOS) : [],
            layout: typeof d.layout === 'string' ? d.layout.slice(0, 12) : '', muteVideo: !!d.muteVideo, music: S.cleanMusic(d.music),
            caption: d.caption || '', textOverlays: Array.isArray(d.textOverlays) ? d.textOverlays : [],
            spotifyTrack: d.spotifyTrack || null, status: d.status || 'active', createdAtMs: created, expiresAtMs: exp
        };
    }
    const isActive = s => s && s.status !== 'removed' && s.createdAtMs > 0 && s.expiresAtMs > now() && !!s.mediaUrl && !!s.ownerUid;

    function rebuild(raw) {
        st.stories = (raw || st.stories).filter(isActive);
        const map = new Map();
        st.stories.sort((a, b) => a.createdAtMs - b.createdAtMs).forEach(s => {
            if (!map.has(s.ownerUid)) map.set(s.ownerUid, { uid: s.ownerUid, name: s.ownerName, photo: s.ownerPhoto, stories: [] });
            map.get(s.ownerUid).stories.push(s);
        });
        map.forEach(g => {
            g.hasUnseen = g.stories.some(s => !st.seen[s.id]);
            g.latest = g.stories[g.stories.length - 1].createdAtMs;
            const last = g.stories[g.stories.length - 1];
            g.name = last.ownerName; g.photo = last.ownerPhoto;
        });
        st.byOwner = map;
        st.groups = [...map.values()].sort((a, b) => {
            if (st.me) { if (a.uid === st.me.uid) return -1; if (b.uid === st.me.uid) return 1; }
            if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
            return b.latest - a.latest;
        });
        renderRow(); decorateAvatars(); refreshChatRefs();
    }
    let rawCache = [];
    function startListener() {
        stopListener();
        st.loaded = false; st.error = null; renderRow();
        st.unsub = db.collection('stories')
            .where('expiresAt', '>', firebase.firestore.Timestamp.fromMillis(now()))
            .orderBy('expiresAt', 'desc').limit(150)
            .onSnapshot(snap => {
                st.loaded = true; st.error = null;
                rawCache = snap.docs.map(norm);
                rebuild(rawCache);
            }, err => {
                console.warn('Stories listener:', err.code || err.message);
                st.loaded = true; st.error = err; renderRow();
            });
    }
    function stopListener() { if (st.unsub) { st.unsub(); st.unsub = null; } }
    // drop expired stories from the UI without waiting for a snapshot
    setInterval(() => { if (st.me && rawCache.length) { const before = st.stories.length; rebuild(rawCache); if (V.open && V.story && !isActive(V.story)) renderSlide(); void before; } }, 30000);

    function chatEnabled() {
        if (st.chatEnabled !== null) return Promise.resolve(st.chatEnabled);
        return db.collection('settings').doc('features').get()
            .then(d => (st.chatEnabled = !!(d.exists && d.data().chatEnabled === true)))
            .catch(() => false);
    }

    // ------------------------------------------------------------ row
    function mounts() { return document.querySelectorAll('.st-row-mount, #storiesMount'); }
    function avatarHtml(name, photo, size) {
        const ini = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const src = photo ? S.esc(S.cloudAvatar(photo, size || 120)) : '';
        return src ? `<img src="${src}" alt="" loading="lazy" onerror="this.remove()">` + '' : S.esc(ini);
    }
    function renderRow() {
        const ms = mounts();
        if (!ms.length) return;
        ms.forEach(m => {
            if (!st.me) { m.hidden = true; m.innerHTML = ''; return; }
            m.hidden = false;
            m.classList.add('st-row-wrap');
            let h = '<div class="st-row" role="list" aria-label="Stories">';
            const mine = st.byOwner.get(st.me.uid);
            h += `<div class="st-item" role="listitem"><button class="st-item" data-uid="${S.esc(st.me.uid)}" data-act="${mine ? 'view' : 'add'}" aria-label="${mine ? 'View your story' : 'Add story'}" style="width:74px">
                    <span class="st-ring ${mine ? (mine.hasUnseen ? '' : 'seen') : 'none'}"><span class="st-av">${avatarHtml(st.me.name, st.me.photo)}</span></span>
                    <span class="st-name">${mine ? 'Your story' : 'Add story'}</span></button>
                  <span class="st-plus" data-act="add" role="button" tabindex="0" aria-label="Add a new story"><i class="fas fa-plus"></i></span></div>`;
            if (!st.loaded) h += '<div class="st-item st-skel"><span class="st-ring"><span class="st-av"></span></span><span class="st-name">&nbsp;</span></div>'.repeat(3);
            st.groups.filter(g => g.uid !== st.me.uid).forEach(g => {
                h += `<button class="st-item" data-uid="${S.esc(g.uid)}" data-act="view" role="listitem" aria-label="View ${S.esc(g.name)}'s story">
                        <span class="st-ring ${g.hasUnseen ? '' : 'seen'}"><span class="st-av">${avatarHtml(g.name, g.photo)}</span></span>
                        <span class="st-name">${S.esc(g.name.split(' ')[0])}</span></button>`;
            });
            if (st.error) h += `<div class="st-row-msg">Stories are unavailable right now.</div>`;
            else if (st.loaded && st.groups.filter(g => g.uid !== st.me.uid).length === 0) h += `<div class="st-row-msg">No stories from the squad yet.</div>`;
            h += '</div>';
            if (m._sig === h) return;
            m._sig = h; m.innerHTML = h;
        });
    }
    document.addEventListener('click', e => {
        const plus = e.target.closest('.st-plus');
        if (plus) { e.preventDefault(); e.stopPropagation(); openComposer(); return; }
        const it = e.target.closest('.st-row .st-item[data-act]');
        if (!it) return;
        if (it.dataset.act === 'add') openComposer();
        else openUser(it.dataset.uid, null, it.querySelector('.st-ring'));
    });
    document.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('st-plus')) { e.preventDefault(); openComposer(); }
        if (V.open && (e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('st-music-card')) { e.preventDefault(); toggleMute(); }
    });

    // ------------------------------------------------------------ squad / member avatars
    const AV_SEL = '.member-card .avatar-circle, .member-card .card-top .avatar';
    function decorateAvatars() {
        document.querySelectorAll('.member-card[data-member-id]').forEach(card => {
            const av = card.querySelector(AV_SEL.replace(/\.member-card /g, ''));
            if (!av) return;
            const g = st.me ? st.byOwner.get(card.dataset.memberId) : null;
            av.classList.toggle('st-has', !!g);
            av.classList.toggle('st-seen', !!g && !g.hasUnseen);
        });
    }
    function watchGrid() {
        const grid = document.getElementById('membersGrid');
        if (!grid) return;
        if (grid._stObs) return;
        grid._stObs = new MutationObserver(() => decorateAvatars());
        grid._stObs.observe(grid, { childList: true });
        decorateAvatars();
    }
    // capture phase so we run before the card's own click handler
    document.addEventListener('click', e => {
        const av = e.target.closest(AV_SEL);
        if (!av || !av.classList.contains('st-has')) return;
        if (e.target.closest('.member-actions, .member-note-bubble, .note-bubble, a')) return;
        const card = av.closest('.member-card');
        if (!card) return;
        e.preventDefault(); e.stopPropagation();
        openUser(card.dataset.memberId, null, av);
    }, true);

    // ------------------------------------------------------------ viewer
    const V = { open: false, el: null, order: [], gi: 0, si: 0, story: null, paused: new Set(), raf: 0, last: 0, el_ms: 0, dur: 0, video: null, ready: false,
                unsubR: null, reactions: [], trayMore: false, returnFocus: null, pushed: false, sy: 0,
                mus: null, clip: null, userMuted: false, musicBlocked: false, muteVid: false,
                closing: false, anim: null, bdAnim: null, views: [], unsubV: null };

    function buildViewer() {
        if (V.el) return;
        S.loadFonts();
        const el = document.createElement('div');
        el.className = 'st-viewer'; el.hidden = true;
        el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Story viewer');
        el.innerHTML = `
          <div class="st-bd"></div>
          <button class="st-nav st-prev" type="button" aria-label="Previous story"><i class="fas fa-chevron-left"></i></button>
          <div class="st-frame">
            <div class="st-bgblur"></div><div class="st-media-wrap"></div><div class="st-texts"></div>
            <div class="st-scrim-t"></div><div class="st-scrim-b"></div>
            <div class="st-loading" role="status" aria-label="Loading"><span class="st-spin"></span></div>
            <div class="st-error" hidden><div><i class="fas fa-triangle-exclamation" style="font-size:26px"></i><p>We couldn't load this story.</p><button type="button" data-a="skip">Skip</button></div></div>
            <div class="st-expired" hidden><div><i class="fas fa-hourglass-end" style="font-size:26px"></i><p>This story has expired.</p><button type="button" data-a="skip">Continue</button></div></div>
            <div class="st-top"><div class="st-prog" aria-hidden="true"></div>
              <div class="st-head"><span class="st-av"></span><div class="st-who"><b></b><small></small></div>
                <button class="st-ib" type="button" data-a="pause" aria-label="Pause"><i class="fas fa-pause"></i></button>
                <button class="st-ib" type="button" data-a="mute" aria-label="Mute" hidden><i class="fas fa-volume-high"></i></button>
                <button class="st-ib" type="button" data-a="delete" aria-label="Delete story" hidden><i class="fas fa-trash"></i></button>
                <button class="st-ib" type="button" data-a="close" aria-label="Close"><i class="fas fa-xmark"></i></button></div></div>
            <div class="st-bottom st-ui">
              <div class="st-caption"></div>
              <div class="st-rsum" aria-live="polite"></div>
              <div class="st-music"></div>
              <div class="st-tray" hidden></div>
              <form class="st-reply" autocomplete="off">
                <input type="text" maxlength="${CFG.MAX_REPLY}" placeholder="Reply to story…" aria-label="Reply to story">
                <button class="st-heart" type="button" data-a="tray" aria-label="React" aria-expanded="false"><i class="far fa-heart"></i></button>
                <button class="st-send" type="submit" aria-label="Send reply"><i class="fas fa-paper-plane"></i></button>
              </form>
              <div class="st-own" hidden><button class="st-act" type="button" data-a="viewers" aria-haspopup="dialog"><i class="far fa-eye"></i> <span class="st-vc">0</span> <span class="st-vl">viewers</span></button></div>
              <div class="st-note" hidden></div>
            </div>
            <div class="st-vsheet st-ui" hidden role="dialog" aria-label="Story viewers"><div class="st-vh"><b>Viewers</b><button class="st-ib" type="button" data-a="vclose" aria-label="Close viewers"><i class="fas fa-xmark"></i></button></div><ul class="st-vlist"></ul></div>
          </div>
          <button class="st-nav st-next" type="button" aria-label="Next story"><i class="fas fa-chevron-right"></i></button>`;
        document.body.appendChild(el);
        V.el = el;
        const $ = s => el.querySelector(s);
        V.q = { frame: $('.st-frame'), bg: $('.st-bgblur'), mw: $('.st-media-wrap'), tx: $('.st-texts'), load: $('.st-loading'), err: $('.st-error'), exp: $('.st-expired'),
                prog: $('.st-prog'), av: $('.st-head .st-av'), who: $('.st-who b'), when: $('.st-who small'), cap: $('.st-caption'), sum: $('.st-rsum'), music: $('.st-music'),
                tray: $('.st-tray'), form: $('.st-reply'), input: $('.st-reply input'), send: $('.st-send'), heart: $('.st-heart'), note: $('.st-note'),
                pauseB: $('[data-a=pause]'), muteB: $('[data-a=mute]'), delB: $('[data-a=delete]'),
                bd: $('.st-bd'), own: $('.st-own'), vc: $('.st-vc'), vl: $('.st-vl'), vsheet: $('.st-vsheet'), vlist: $('.st-vlist') };
        S.observeStage(V.q.frame);

        $('.st-prev').onclick = prev; $('.st-next').onclick = next;
        el.addEventListener('click', e => {
            const b = e.target.closest('[data-a]'); if (!b) return;
            const a = b.dataset.a;
            if (a === 'close') close();
            else if (a === 'skip') next();
            else if (a === 'pause') { V.paused.has('user') ? resume('user') : pause('user'); syncPauseIcon(); }
            else if (a === 'mute') toggleMute();
            else if (a === 'delete') deleteOwn();
            else if (a === 'tray') toggleTray();
            else if (a === 'viewers') toggleViewers();
            else if (a === 'vclose') toggleViewers(false);
        });
        V.q.tray.addEventListener('click', e => {
            const b = e.target.closest('button[data-e]'); if (!b) return;
            if (b.dataset.e === 'more') { V.trayMore = !V.trayMore; buildTray(); return; }
            setReaction(b.dataset.e);
        });
        V.q.form.addEventListener('submit', e => { e.preventDefault(); sendReply(); });
        V.q.input.addEventListener('focus', () => pause('typing'));
        V.q.input.addEventListener('blur', () => resume('typing'));

        // left 30% = previous, the rest = next, hold = pause, drag down = dismiss.
        // Pointer capture + touch-action:none keep taps reliable on phones (a browser pan used to cancel them).
        let down = null;
        const fr = V.q.frame;
        fr.addEventListener('pointerdown', e => {
            if (V.anim || !V.open) return;
            if (e.target.closest('button,input,a,iframe,.st-ui,.st-tray')) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), held: false, drag: false, dy: 0 };
            try { fr.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            down.timer = setTimeout(() => { if (down && !down.drag) { down.held = true; pause('hold'); } }, 260);
        });
        fr.addEventListener('pointermove', e => {
            if (!down || e.pointerId !== down.id) return;
            const dx = e.clientX - down.x, dy = e.clientY - down.y;
            if (!down.drag && dy > 12 && dy > Math.abs(dx) * 1.2) {
                down.drag = true; clearTimeout(down.timer);
                if (down.held) { down.held = false; resume('hold'); }
                pause('drag');
            }
            if (down.drag) { down.dy = Math.max(0, dy); dragFrame(down.dy); }
        });
        fr.addEventListener('pointerup', e => {
            if (!down || e.pointerId !== down.id) return;
            const d = down; down = null; clearTimeout(d.timer);
            try { fr.releasePointerCapture(d.id); } catch (err) { /* ignore */ }
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (d.drag) { const v = d.dy / Math.max(1, performance.now() - d.t); (d.dy > 110 || v > 0.6) ? close(false, true) : springBack(); return; }
            if (d.held) { resume('hold'); return; }
            if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
                const r = fr.getBoundingClientRect();
                (e.clientX - r.left < r.width * 0.3) ? prev() : next();
            }
        });
        fr.addEventListener('pointercancel', () => {
            if (!down) return;
            const d = down; down = null; clearTimeout(d.timer);
            if (d.drag) springBack(); else if (d.held) resume('hold');
        });

        document.addEventListener('keydown', e => {
            if (!V.open) return;
            if (e.key === 'Escape') { e.preventDefault(); if (!V.q.vsheet.hidden) toggleViewers(false); else close(); return; }
            if (e.target === V.q.input) return;
            if (e.key === 'ArrowRight') next();
            else if (e.key === 'ArrowLeft') prev();
            else if (e.key === ' ') { e.preventDefault(); V.paused.has('user') ? resume('user') : pause('user'); syncPauseIcon(); }
        });
        document.addEventListener('visibilitychange', () => { if (!V.open) return; document.hidden ? pause('hidden') : resume('hidden'); });
        window.addEventListener('popstate', () => { if (V.open && V.pushed) { V.pushed = false; close(true); } });
    }

    const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    // The on-screen ring / avatar the story grows out of (and shrinks back into).
    function findOrigin(uid) {
        const k = window.CSS && CSS.escape ? CSS.escape(uid) : uid;
        const els = document.querySelectorAll(`.st-row [data-uid="${k}"] .st-ring, .member-card[data-member-id="${k}"] .st-has`);
        for (const el of els) {
            const r = el.getBoundingClientRect();
            if (r.width > 8 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) return r;
        }
        return null;
    }
    function frameState(o) {
        const fr = V.q.frame, w = fr.offsetWidth, h = fr.offsetHeight, rad = innerWidth <= 640 ? 0 : 18;
        const full = { transform: 'translate(0px,0px) scale(1)', clipPath: `inset(0px 0px 0px 0px round ${rad}px)`, opacity: 1 };
        let small;
        if (o && o.width > 8) {
            const s = o.width / w, vi = Math.max(0, (h - w) / 2);
            small = { transform: `translate(${o.left + o.width / 2 - innerWidth / 2}px,${o.top + o.height / 2 - innerHeight / 2}px) scale(${s})`,
                      clipPath: `inset(${vi}px 0px ${vi}px 0px round ${w / 2}px)`, opacity: 1 };
        } else small = { transform: 'translate(0px,26px) scale(.94)', clipPath: full.clipPath, opacity: 0 };
        return { full, small };
    }
    function stopAnims() {
        [V.anim, V.bdAnim].forEach(a => { if (a) { try { a.cancel(); } catch (e) { /* ignore */ } } });
        V.anim = V.bdAnim = null;
    }
    function runAnim(from, to, ms, bdFrom, bdTo, done, keep) {
        const fr = V.q.frame;
        stopAnims();
        if (reduceMotion() || !fr.animate) { done && done(); return; }
        const ease = 'cubic-bezier(.22,.9,.28,1)';
        const a = fr.animate([from, to], { duration: ms, easing: ease, fill: 'both' });
        const b = V.q.bd.animate([{ opacity: bdFrom }, { opacity: bdTo }], { duration: ms, easing: 'ease-out', fill: 'both' });
        V.anim = a; V.bdAnim = b;
        a.onfinish = () => {
            if (V.anim !== a) return;
            if (!keep) stopAnims();
            done && done();
        };
    }
    function dragFrame(dy) {
        const k = Math.min(dy / Math.max(300, innerHeight * 0.8), 1);
        V.q.frame.style.transform = `translateY(${dy}px) scale(${(1 - k * 0.16).toFixed(3)})`;
        V.q.bd.style.opacity = String((1 - k * 0.85).toFixed(3));
    }
    function springBack() {
        const fr = V.q.frame, from = fr.style.transform || 'none', bdo = parseFloat(V.q.bd.style.opacity || '1');
        fr.style.transform = ''; V.q.bd.style.opacity = '';
        if (fr.animate && !reduceMotion()) {
            fr.animate([{ transform: from }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1)' });
            V.q.bd.animate([{ opacity: bdo }, { opacity: 1 }], { duration: 240 });
        }
        resume('drag');
    }

    function openUser(uid, startId, originEl) {
        if (!st.me) { toast('Sign in to view stories', 'warn'); return; }
        const g = st.byOwner.get(uid);
        if (!g) { toast('This story has expired.', 'info'); return; }
        buildViewer();
        stopAnims(); V.closing = false;
        V.q.frame.style.transform = ''; V.q.bd.style.opacity = '';
        V.order = st.groups.map(x => x.uid);
        V.gi = Math.max(0, V.order.indexOf(uid));
        let si = 0;
        if (startId) si = Math.max(0, g.stories.findIndex(s => s.id === startId));
        else { const firstUnseen = g.stories.findIndex(s => !st.seen[s.id]); si = firstUnseen > -1 ? firstUnseen : 0; }
        V.si = si;
        const o = originEl && originEl.getBoundingClientRect ? originEl.getBoundingClientRect() : findOrigin(uid);
        V.returnFocus = document.activeElement;
        V.el.hidden = false; V.open = true;
        document.documentElement.classList.add('st-lock');
        try { history.pushState({ stv: 1 }, ''); V.pushed = true; } catch (e) { /* ignore */ }
        renderSlide();
        pause('anim');                                   // story clock starts when the grow animation ends
        const { full, small } = frameState(o);
        runAnim(small, full, 340, 0, 1, () => resume('anim'));
        if (!V.anim) resume('anim');
        V.el.querySelector('[data-a=close]').focus({ preventScroll: true });
    }
    function openById(id) {
        const s = st.stories.find(x => x.id === id);
        if (!s) { toast('This story has expired or is no longer available.', 'info'); return; }
        openUser(s.ownerUid, id);
    }
    function close(fromPop, fromDrag) {
        if (!V.open) return;
        const uid = V.order[V.gi];
        teardownSlide();                                  // stops timer, video and music immediately
        V.open = false; V.closing = true;
        const fr = V.q.frame;
        const finish = () => {
            V.closing = false; V.el.hidden = true; stopAnims();
            fr.style.transform = ''; V.q.bd.style.opacity = '';
            document.documentElement.classList.remove('st-lock');
            if (V.pushed && !fromPop) { V.pushed = false; try { history.back(); } catch (e) { /* ignore */ } }
            if (V.returnFocus && V.returnFocus.focus) { try { V.returnFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
            rebuild(rawCache);
        };
        const { full, small } = frameState(findOrigin(uid));
        const cur = fromDrag ? { transform: fr.style.transform || full.transform, clipPath: full.clipPath, opacity: 1 } : full;
        const bdo = fromDrag ? parseFloat(V.q.bd.style.opacity || '1') : 1;
        fr.style.transform = ''; V.q.bd.style.opacity = '';
        runAnim(cur, small, 280, bdo, 0, finish, true);
        if (!V.anim) finish();
    }
    function curGroup() { return st.byOwner.get(V.order[V.gi]); }
    function next() {
        const g = curGroup();
        if (g && V.si < g.stories.length - 1) { V.si++; renderSlide(); return; }
        // next member with active stories
        for (let i = V.gi + 1; i < V.order.length; i++) if (st.byOwner.has(V.order[i])) { V.gi = i; V.si = 0; renderSlide(); return; }
        close();
    }
    function prev() {
        if (V.si > 0) { V.si--; renderSlide(); return; }
        for (let i = V.gi - 1; i >= 0; i--) { const g = st.byOwner.get(V.order[i]); if (g) { V.gi = i; V.si = g.stories.length - 1; renderSlide(); return; } }
        restartSlide();
    }
    // Restart the CURRENT story from 0:00: progress bar, video AND music all go back together.
    function restartSlide() {
        V.el_ms = 0;
        if (V.video) { try { V.video.currentTime = 0; } catch (e) { /* ignore */ } }
        syncAudio(true);
        const seg = V.q.prog.children[V.si]; if (seg && seg.firstChild) seg.firstChild.style.transform = 'scaleX(0)';
        if (!V.paused.size && V.ready) { if (V.video) V.video.play().catch(() => {}); playMusic(); }
        restartTimer();
    }

    function teardownSlide() {
        cancelAnimationFrame(V.raf); V.raf = 0;
        if (V.unsubR) { V.unsubR(); V.unsubR = null; }
        if (V.unsubV) { V.unsubV(); V.unsubV = null; }
        V.views = [];
        if (V.q && V.q.vsheet) V.q.vsheet.hidden = true;
        if (V.video) { try { V.video.pause(); V.video.removeAttribute('src'); V.video.load(); } catch (e) { /* ignore */ } V.video = null; }
        stopMusic();
        V.paused.clear(); V.ready = false; V.reactions = [];
    }
    function pause(r) { V.paused.add(r); if (V.video) V.video.pause(); if (V.mus) V.mus.pause(); }
    function resume(r) { V.paused.delete(r); if (!V.paused.size && V.ready) { if (V.video) V.video.play().catch(() => {}); playMusic(); } V.last = performance.now(); }
    function syncPauseIcon() { V.q.pauseB.innerHTML = `<i class="fas fa-${V.paused.has('user') ? 'play' : 'pause'}"></i>`; V.q.pauseB.setAttribute('aria-label', V.paused.has('user') ? 'Play' : 'Pause'); }

    function renderSlide() {
        teardownSlide();
        const g = curGroup();
        if (!g) { close(); return; }
        if (V.si >= g.stories.length) V.si = g.stories.length - 1;
        const s = g.stories[V.si];
        V.story = s;
        const q = V.q, mine = s.ownerUid === st.me.uid;

        // header + progress
        q.av.innerHTML = avatarHtml(g.name, g.photo, 80);
        q.who.textContent = mine ? 'Your story' : g.name;
        q.when.textContent = S.timeAgo(s.createdAtMs) + ' · expires in ' + Math.max(1, Math.ceil((s.expiresAtMs - now()) / 3600000)) + 'h';
        q.prog.innerHTML = g.stories.map((x, i) => `<div class="st-seg ${i < V.si ? 'done' : ''}"><i></i></div>`).join('');
        q.delB.hidden = !mine; q.muteB.hidden = true; syncPauseIcon();
        q.exp.hidden = true; q.err.hidden = true;
        q.input.value = ''; q.tray.hidden = true; V.trayMore = false; q.heart.setAttribute('aria-expanded', 'false');

        // expired mid-view -> consistent fallback, no interactions
        if (!isActive(s)) {
            q.mw.innerHTML = ''; q.bg.innerHTML = ''; q.tx.innerHTML = ''; q.cap.textContent = ''; q.music.innerHTML = ''; q.sum.innerHTML = '';
            q.load.hidden = true; q.exp.hidden = false; q.form.hidden = true; q.own.hidden = true; q.note.hidden = true; return;
        }
        const firstSeen = !st.seen[s.id];
        markSeen(s.id);
        if (!mine && firstSeen) recordView(s);

        // media (single photo | photo collage | one video)
        const collage = s.mediaType === 'image' && s.mediaItems.length > 1 ? s.mediaItems : null;
        q.mw.className = 'st-media-wrap' + (collage ? ' collage' : (s.mediaFit === 'fit' ? ' fit' : ''));
        q.mw.innerHTML = ''; q.bg.innerHTML = ''; q.load.hidden = false;
        S.renderTexts(q.tx, s.textOverlays);
        q.cap.textContent = s.caption; q.cap.style.display = s.caption ? '' : 'none';
        V.muteVid = !!(s.music || s.muteVideo);          // music added to a video mutes the video's own audio
        if (s.mediaType === 'video') {
            const v = document.createElement('video');
            v.playsInline = true; v.preload = 'auto'; v.controls = false; v.setAttribute('playsinline', '');
            v.muted = V.muteVid || V.userMuted;
            v.src = s.mediaUrl;
            v.addEventListener('loadedmetadata', () => { V.dur = Math.min((v.duration || 15) * 1000, S.MAX_SHOW_MS); });
            v.addEventListener('canplay', () => onReady(v), { once: true });
            v.addEventListener('ended', () => { if (V.story === s) next(); });
            v.addEventListener('error', () => onError());
            q.mw.appendChild(v); V.video = v;
        } else {
            V.dur = s.durationMs > 0 ? Math.min(s.durationMs, S.MAX_SHOW_MS) : CFG.IMAGE_MS;
            if (collage) {
                q.mw.innerHTML = S.collageHtml(collage, s.layout);
                waitImages(q.mw.querySelectorAll('img'), s);
            } else {
                const im = new Image(); im.alt = s.caption || 'Story';
                im.onload = () => onReady(null); im.onerror = onError;
                im.src = s.mediaUrl; q.mw.appendChild(im);
                if (s.mediaFit === 'fit') { const b = new Image(); b.src = s.mediaUrl; b.alt = ''; q.bg.appendChild(b); }
            }
        }
        renderMusic(s);
        setupMusic(s);
        q.muteB.hidden = !(V.mus || (V.video && !V.muteVid));
        syncMuteIcon();
        renderInteract(s, mine);
        // prefetch next image
        const nx = g.stories[V.si + 1]; if (nx && nx.mediaType === 'image') { const p = new Image(); p.src = nx.mediaUrl; }
    }
    function waitImages(imgs, s) {
        const list = [...imgs]; let left = list.length, failed = 0;
        if (!left) { onError(); return; }
        const done = () => { if (--left > 0 || V.story !== s || !V.open) return; failed >= list.length ? onError() : onReady(null); };
        list.forEach(im => {
            if (im.complete) { if (!im.naturalWidth) failed++; done(); return; }
            im.onload = done; im.onerror = () => { failed++; done(); };
        });
    }
    function onError() { V.q.load.hidden = true; V.q.err.hidden = false; }
    function onReady(v) {
        if (!V.open) return;
        V.q.load.hidden = true; V.ready = true; V.el_ms = 0; V.last = performance.now();
        if (v) {
            v.muted = V.muteVid || V.userMuted;
            v.play().catch(() => { v.muted = true; syncMuteIcon(); v.play().catch(() => {}); });
        }
        playMusic();
        restartTimer();
    }
    function restartTimer() {
        cancelAnimationFrame(V.raf);
        const segs = V.q.prog.children, seg = segs[V.si] && segs[V.si].firstChild;
        const s = V.story;
        const tick = t => {
            if (!V.open || V.story !== s) return;
            const dt = t - V.last; V.last = t;
            if (!V.paused.size && V.ready) {
                if (V.video) V.el_ms = V.video.currentTime * 1000; else V.el_ms += dt;
                if (V.mus) syncAudio(false);              // music position = story position (never drifts)
            }
            const p = Math.min(1, V.el_ms / (V.dur || CFG.IMAGE_MS));
            if (seg) seg.style.transform = `scaleX(${p})`;
            if (!V.video && p >= 1) { next(); return; }
            if (V.video && V.el_ms >= S.MAX_SHOW_MS) { next(); return; }
            V.raf = requestAnimationFrame(tick);
        };
        V.last = performance.now(); V.raf = requestAnimationFrame(tick);
    }

    // ---- music card. Songs are never re-hosted: YouTube plays in its own embedded (visible) player,
    //      the 30-second library previews play straight from Apple's CDN, Spotify only via its official embed.
    function renderMusic(s) {
        const box = V.q.music, m = s.music;
        if (m && m.provider === 'youtube') {
            const url = 'https://www.youtube.com/watch?v=' + m.videoId;
            box.innerHTML = `<div class="st-music-card playing yt" data-a="mute" role="button" tabindex="0" aria-label="Toggle music sound">
                <div class="st-ytbox" aria-label="YouTube player"></div>
                <div class="st-mt"><b>${S.esc(m.title)}</b><small>${S.esc(m.artist || 'YouTube')}</small>
                  <a class="st-ytlink" data-a="yt" href="${S.esc(url)}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a></div>
                <span class="st-eq" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
            return;
        }
        if (m) {
            const art = S.safeImgUrl(m.thumbnail);
            box.innerHTML = `<div class="st-music-card playing" data-a="mute" role="button" tabindex="0" aria-label="Toggle music sound">${art ? `<img src="${S.esc(art)}" alt="">` : '<span class="ph">🎵</span>'}
                <div class="st-mt"><b>${S.esc(m.title)}</b><small>${S.esc(m.artist || 'Music')}</small></div>
                <span class="st-eq" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
            return;
        }
        renderSpotify(s);
    }
    // ---- auto-playing clip. The story clock is the master: the song position is always
    //      clipStart + (elapsed mod clipLength), so restarting, going back, pausing, holding or looping
    //      can never leave the song out of step. One small adapter per source (audio file | YouTube).
    function audioAdapter(m) {
        const a = new Audio();
        a.preload = 'auto'; a.src = m.previewUrl; a.muted = V.userMuted;
        const ad = {
            kind: 'audio', tol: 0.45, hold: 0, seekAt: 0, err: 0,
            isReady: () => a.readyState >= 1, play: () => a.play().then(() => true, () => false), pause: () => a.pause(),
            seek: t => { ad.seekAt = performance.now(); try { a.currentTime = t; } catch (e) { /* not seekable yet */ } },
            pos: () => a.currentTime, setMuted: b => { a.muted = b; }, playing: () => !a.paused,
            destroy: () => { try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { /* ignore */ } }
        };
        a.addEventListener('loadedmetadata', () => { if (V.mus === ad) syncAudio(true); });
        a.addEventListener('ended', () => { if (V.mus === ad) { syncAudio(true); playMusic(); } });
        a.addEventListener('error', () => { if (V.mus === ad) musicFailed(); });
        return ad;
    }
    function setupMusic(s) {
        const m = s.music; if (!m) return;
        if (m.provider === 'youtube') {
            const host = V.q.music.querySelector('.st-ytbox'); if (!host) return;
            V.clip = { start: m.startSec, end: m.startSec + m.clipSec };
            const ad = S.ytPlayer(host, m.videoId, {
                start: m.startSec,
                onReady: () => { if (V.mus !== ad) return; ad.setMuted(V.userMuted); if (V.ready) playMusic(); },
                onState: st => { if (V.mus === ad && st === 1) setBlocked(false); },
                onError: () => { if (V.mus === ad) musicFailed(); }
            });
            V.mus = ad;
        } else {
            V.clip = { start: m.startSec, end: Math.min(m.startSec + m.clipSec, m.previewSec) };
            V.mus = audioAdapter(m);
        }
    }
    function syncAudio(force) {
        const m = V.mus, c = V.clip; if (!m || !c || !m.isReady()) return;
        if (!force && m.hold && performance.now() - m.seekAt < m.hold) return;   // give a fresh seek time to land
        const len = Math.max(1, c.end - c.start);
        const want = c.start + ((V.el_ms / 1000) % len);
        if (force || Math.abs(m.pos() - want) > m.tol) m.seek(want);
    }
    function setBlocked(b) {
        V.musicBlocked = b;
        const c = V.q.music.querySelector('.st-music-card'); if (c) c.classList.toggle('blocked', b);
        syncMuteIcon();
    }
    function playMusic() {
        const m = V.mus; if (!m || V.paused.size || !V.ready || !m.isReady()) return;
        syncAudio(true);
        m.play().then(ok => { if (V.mus === m) setBlocked(!ok); });
    }
    // Music can't play (embedding disabled, removed/private, region-blocked, API blocked): the story carries on silently.
    function musicFailed() {
        const m = V.mus; if (!m) return;
        m.destroy(); V.mus = null; V.clip = null; V.musicBlocked = false;
        const c = V.q.music.querySelector('.st-music-card'), s = V.story;
        if (c) {
            c.classList.remove('playing', 'blocked'); c.classList.add('failed');
            const box = c.querySelector('.st-ytbox'), art = s && s.music && S.safeImgUrl(s.music.thumbnail);
            if (box) box.innerHTML = art ? `<img src="${S.esc(art)}" alt="">` : '';
            const sm = c.querySelector('.st-mt small'); if (sm) sm.textContent = 'Can’t be played here';
        }
        if (V.video) { V.muteVid = false; V.video.muted = V.userMuted; V.q.muteB.hidden = false; } else V.q.muteB.hidden = true;
        syncMuteIcon();
    }
    function stopMusic() {
        if (V.mus) { V.mus.destroy(); V.mus = null; }
        V.musicBlocked = false; V.clip = null;
    }
    function toggleMute() {
        const m = V.mus;
        if (m) {
            if (V.musicBlocked) { V.userMuted = false; m.setMuted(false); playMusic(); return; }   // "Tap to play"
            V.userMuted = !V.userMuted; m.setMuted(V.userMuted);
        } else if (V.video) { V.video.muted = !V.video.muted; V.userMuted = V.video.muted; }
        syncMuteIcon();
    }
    function syncMuteIcon() {
        const off = V.mus ? (V.musicBlocked || V.userMuted) : (V.video ? V.video.muted : false);
        V.q.muteB.innerHTML = `<i class="fas fa-volume-${off ? 'xmark' : 'high'}"></i>`;
        V.q.muteB.setAttribute('aria-label', off ? 'Unmute' : 'Mute');
    }
    // ---- legacy: Spotify link stories (official embed only; cannot auto-play)
    function renderSpotify(s) {
        const t = s.spotifyTrack, box = V.q.music;
        const url = t && S.safeSpotifyUrl(t.url);
        if (!t || !url) { box.innerHTML = ''; return; }
        const art = S.safeImgUrl(t.thumbnail);
        box.innerHTML = `<div class="st-music-card">${art ? `<img src="${S.esc(art)}" alt="">` : '<span class="ph">🎵</span>'}
            <div class="st-mt"><b>${S.esc(t.title || 'Spotify track')}</b><small>${S.esc(t.artist || 'Spotify')}</small></div>
            <button class="st-mbtn" type="button" data-m="play" aria-expanded="false">▶ Play</button>
            <a class="st-mbtn ghost" href="${S.esc(url)}" target="_blank" rel="noopener noreferrer">Open in Spotify</a></div><div class="st-embed" hidden></div>`;
        const btn = box.querySelector('[data-m=play]'), em = box.querySelector('.st-embed');
        btn.onclick = () => {
            const open = em.hidden;
            if (open && /^[A-Za-z0-9]{22}$/.test(t.trackId || '')) {
                em.innerHTML = `<iframe title="Spotify player" src="https://open.spotify.com/embed/track/${t.trackId}?utm_source=generator" allow="encrypted-media; clipboard-write" loading="lazy"></iframe>`;
                em.hidden = false; btn.textContent = '✕ Close'; pause('music');
            } else { em.hidden = true; em.innerHTML = ''; btn.textContent = '▶ Play'; resume('music'); }
            btn.setAttribute('aria-expanded', String(open));
        };
        if (!/^[A-Za-z0-9]{22}$/.test(t.trackId || '')) btn.remove();
    }

    // ---- reactions + replies
    function renderInteract(s, mine) {
        const q = V.q;
        q.form.hidden = mine; q.own.hidden = !mine; q.note.hidden = true;
        q.input.hidden = false; q.heart.hidden = false; q.send.hidden = false;
        buildTray();
        V.unsubR = db.collection('stories').doc(s.id).collection('reactions').onSnapshot(snap => {
            V.reactions = snap.docs.map(d => d.data());
            renderSummary();
        }, err => { console.warn('reactions:', err.code); });
        if (mine) {
            V.views = []; renderViewers();
            V.unsubV = db.collection('stories').doc(s.id).collection('views').orderBy('viewedAt', 'desc').limit(300).onSnapshot(snap => {
                V.views = snap.docs.map(d => d.data()); renderViewers();
            }, err => { console.warn('views:', err.code); });
        } else {
            q.input.disabled = true; q.send.disabled = true; q.input.placeholder = 'Reply to ' + (s.ownerName || 'story').split(' ')[0] + '…';
            chatEnabled().then(on => {
                if (V.story !== s) return;
                q.input.disabled = !on; q.send.disabled = !on;
                if (!on) { q.input.placeholder = 'Replies are unavailable'; q.note.hidden = false; q.note.textContent = 'Chat is turned off, so replies are unavailable.'; }
            });
        }
    }
    function recordView(s) {
        if (!st.me) return;
        db.collection('stories').doc(s.id).collection('views').doc(st.me.uid)
            .set({ uid: st.me.uid, name: st.me.name, photo: st.me.photo || '', viewedAt: firebase.firestore.FieldValue.serverTimestamp() })
            .catch(err => console.warn('view not recorded:', err.code || err.message));
    }
    // Story owner: who watched it, and which emoji they reacted with (badge on the avatar, like Instagram).
    function renderViewers() {
        const q = V.q, map = new Map(), ms = x => (x && x.toMillis ? x.toMillis() : 0);
        V.views.forEach(v => { if (v.uid) map.set(v.uid, { uid: v.uid, name: v.name || 'Member', photo: v.photo || '', at: ms(v.viewedAt), emoji: '' }); });
        V.reactions.forEach(r => {
            const e = map.get(r.uid) || { uid: r.uid, name: r.name || 'Member', photo: r.photo || '', at: ms(r.createdAt), emoji: '' };
            e.emoji = r.emoji; if (!e.photo && r.photo) e.photo = r.photo; map.set(r.uid, e);
        });
        if (st.me) map.delete(st.me.uid);
        const list = [...map.values()].sort((a, b) => b.at - a.at);
        q.vc.textContent = String(list.length); q.vl.textContent = list.length === 1 ? 'viewer' : 'viewers';
        q.vlist.innerHTML = list.length ? list.map(v => `<li class="st-vi"><span class="st-vav"><span class="st-av">${avatarHtml(v.name, v.photo, 80)}</span>${v.emoji ? `<em class="st-vemo" aria-label="Reacted ${S.esc(v.emoji)}">${S.esc(v.emoji)}</em>` : ''}</span>
            <div class="st-vn"><b>${S.esc(v.name)}</b><small>${v.at ? S.timeAgo(v.at) + ' ago' : 'viewed'}${v.emoji ? ' · reacted' : ''}</small></div></li>`).join('')
            : '<li class="st-vempty">No views yet. Check back soon.</li>';
    }
    function toggleViewers(force) {
        const open = typeof force === 'boolean' ? force : V.q.vsheet.hidden;
        if (open === !V.q.vsheet.hidden) return;
        V.q.vsheet.hidden = !open;
        open ? pause('viewers') : resume('viewers');
    }
    function renderSummary() {
        const m = new Map(); let mineE = null;
        V.reactions.forEach(r => { m.set(r.emoji, (m.get(r.emoji) || 0) + 1); if (st.me && r.uid === st.me.uid) mineE = r.emoji; });
        V.mineEmoji = mineE;
        if (V.story && st.me && V.story.ownerUid === st.me.uid) renderViewers();
        V.q.sum.innerHTML = [...m.entries()].map(([e, c]) => `<span class="${e === mineE ? 'mine' : ''}" title="${S.esc(V.reactions.filter(r => r.emoji === e).map(r => r.name || 'Member').join(', '))}">${S.esc(e)} ${c}</span>`).join('');
        V.q.heart.innerHTML = mineE ? `<span>${S.esc(mineE)}</span>` : '<i class="far fa-heart"></i>';
        buildTray();
    }
    function buildTray() {
        const list = V.trayMore ? QUICK.concat(MORE) : QUICK;
        V.q.tray.innerHTML = list.map(e => `<button type="button" data-e="${e}" class="${e === V.mineEmoji ? 'on' : ''}" aria-label="React ${e}">${e}</button>`).join('') +
            `<button type="button" data-e="more" aria-label="${V.trayMore ? 'Fewer' : 'More'} emojis" style="font-size:16px;color:#fff">${V.trayMore ? '−' : '＋'}</button>`;
    }
    function toggleTray() {
        const open = V.q.tray.hidden;
        V.q.tray.hidden = !open; V.q.heart.setAttribute('aria-expanded', String(open));
        open ? pause('tray') : resume('tray');
    }
    async function setReaction(emoji) {
        const s = V.story;
        if (!s || !st.me) return;
        if (!isActive(s)) { toast('This story has expired.', 'info'); return; }
        const ref = db.collection('stories').doc(s.id).collection('reactions').doc(st.me.uid);
        try {
            if (V.mineEmoji === emoji) await ref.delete();
            else await ref.set({ uid: st.me.uid, name: st.me.name, photo: st.me.photo || '', emoji, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            V.q.heart.classList.remove('st-pop'); void V.q.heart.offsetWidth; V.q.heart.classList.add('st-pop');
            V.q.tray.hidden = true; V.q.heart.setAttribute('aria-expanded', 'false'); resume('tray');
        } catch (e) {
            console.warn('reaction failed', e.code);
            toast(e.code === 'permission-denied' ? 'This story is no longer available for reactions.' : 'Could not save your reaction.', 'error');
        }
    }

    async function sendReply() {
        const s = V.story, text = V.q.input.value.trim().slice(0, CFG.MAX_REPLY);
        if (!s || !text || !st.me || V.sending) return;
        if (!isActive(s)) { toast('This story has expired.', 'info'); return; }
        if (s.ownerUid === st.me.uid) return;
        V.sending = true; V.q.send.disabled = true;
        try {
            if (!(await chatEnabled())) { toast('Chat is currently turned off.', 'warn'); return; }
            const me = st.me, key = [me.uid, s.ownerUid].sort().join('_');
            const first = (s.textOverlays.find(t => t.text) || {}).text || '';
            const excerpt = (s.caption || first || '').slice(0, 80);
            const ref = {
                storyId: s.id, ownerUid: s.ownerUid, ownerName: s.ownerName, mediaType: s.mediaType,
                thumbUrl: s.thumbUrl || (s.mediaType === 'image' ? s.mediaUrl : ''), excerpt,
                spotify: s.spotifyTrack && s.spotifyTrack.url ? { title: String(s.spotifyTrack.title || '').slice(0, 120), url: s.spotifyTrack.url, trackId: s.spotifyTrack.trackId || '' } : null,
                createdAtMs: s.createdAtMs, expiresAtMs: s.expiresAtMs
            };
            const msg = {
                senderUid: me.uid, participantsKey: key, senderName: me.name, senderPhoto: me.photo || '',
                text, mentions: [], hasSquadMention: false, read: false, isGroup: false, reactions: {},
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                receiverUid: s.ownerUid, participants: [me.uid, s.ownerUid],
                type: 'story_reply', storyRef: ref
            };
            await db.collection('chatMessages').doc().set(msg);
            if (typeof window.createDirectMessageNotification === 'function') {
                try { window.createDirectMessageNotification({ receiverUid: s.ownerUid, senderUid: me.uid, senderName: me.name, text: 'Replied to your story: ' + text }); } catch (e) { /* ignore */ }
            }
            V.q.input.value = '';
            toast('Reply sent! Find it in your Chat tab.', 'success');
            V.q.input.blur();
        } catch (e) {
            console.warn('story reply failed', e);
            toast(e.code === 'permission-denied' ? 'You are not allowed to reply to this story.' : 'Could not send your reply.', 'error');
        } finally { V.sending = false; V.q.send.disabled = false; }
    }

    async function deleteOwn() {
        const s = V.story;
        if (!s || s.ownerUid !== st.me.uid) return;
        if (!window.confirm('Delete this story? Replies already sent in chat will remain.')) return;
        pause('confirm');
        try {
            await deleteStoryDoc(db.collection('stories').doc(s.id));
            rawCache = rawCache.filter(x => x.id !== s.id); rebuild(rawCache);
            toast('Story deleted.', 'success');
            V.paused.delete('confirm');
            const g = curGroup(); if (!g) { close(); return; } if (V.si >= g.stories.length) V.si = g.stories.length - 1; renderSlide();
        } catch (e) { V.paused.delete('confirm'); toast('Could not delete the story.', 'error'); }
    }

    // ------------------------------------------------------------ chat reference card
    const refCache = new Map();
    function renderChatRef(msg) {
        const r = msg && msg.type === 'story_reply' && msg.storyRef;
        if (!r) return '';
        if (r.storyId) refCache.set(String(r.storyId), r);
        const live = st.stories.find(s => s.id === r.storyId);
        const cacheKnown = st.loaded && !st.error;
        const active = live ? true : (cacheKnown ? false : (r.expiresAtMs || 0) > now());
        const owner = S.esc(r.ownerName || 'a member');
        if (!active) {
            return `<div class="st-chatref gone" data-sid="${S.esc(r.storyId)}"><span class="th"><i class="fas fa-hourglass-end"></i></span><div class="tx"><b>Replying to ${owner}'s story</b><span>Story expired${r.excerpt ? ' · “' + S.esc(r.excerpt) + '”' : ''}</span></div></div>`;
        }
        const th = S.safeMediaUrl(r.thumbUrl);
        const thumb = th ? `style="background-image:url('${S.esc(th.replace('/upload/', '/upload/w_120,h_170,c_fill,q_auto,f_auto/'))}')"` : '';
        return `<div class="st-chatref" data-sid="${S.esc(r.storyId)}" role="button" tabindex="0" onclick="Stories.openById('${S.esc(r.storyId)}')" onkeydown="if(event.key==='Enter')Stories.openById('${S.esc(r.storyId)}')">
            <span class="th" ${thumb}>${th ? '' : '<i class="fas fa-image"></i>'}</span>
            <div class="tx"><b>Replying to ${owner}'s story</b><span>${S.esc(r.excerpt || (r.spotify && r.spotify.title) || (r.mediaType === 'video' ? 'Video story' : 'Photo story'))}</span></div></div>`;
    }

    // Re-evaluate chat reference cards in place (story expired / deleted / removed
    // while the chat is open) without re-rendering the whole chat body.
    function refreshChatRefs() {
        document.querySelectorAll('.st-chatref[data-sid]').forEach(el => {
            const r = refCache.get(el.dataset.sid); if (!r) return;
            const tmp = document.createElement('div');
            tmp.innerHTML = renderChatRef({ type: 'story_reply', storyRef: r });
            const n = tmp.firstElementChild;
            if (n && n.classList.contains('gone') !== el.classList.contains('gone')) el.replaceWith(n);
        });
    }

    // ------------------------------------------------------------ composer (lazy)
    let compLoading = null;
    function loadComposer() {
        if (window.StoriesComposer) return Promise.resolve();
        if (!compLoading) {
            compLoading = new Promise((res, rej) => {
                const sc = document.createElement('script');
                sc.src = CFG.composerSrc; sc.onload = res; sc.onerror = () => { compLoading = null; rej(new Error('composer load failed')); };
                document.head.appendChild(sc);
            });
        }
        return compLoading;
    }
    // Instagram flow: tapping "Add story" opens the photo/video picker straight away (it must happen
    // synchronously inside the tap or browsers block it); the editor appears once something is chosen.
    function openComposer() {
        if (!st.me) { toast('Sign in to share a story', 'warn'); return; }
        document.querySelectorAll('input.st-picker').forEach(x => x.remove());
        const inp = document.createElement('input');
        inp.type = 'file'; inp.multiple = true; inp.hidden = true; inp.className = 'st-picker';
        inp.accept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
        document.body.appendChild(inp);
        inp.addEventListener('change', () => {
            const files = [...inp.files]; inp.remove();
            if (!files.length) return;
            loadComposer().then(() => window.StoriesComposer.open(ctx(), files)).catch(() => toast('Could not load the story editor.', 'error'));
        });
        inp.addEventListener('cancel', () => inp.remove());
        loadComposer().catch(() => { /* retried on selection */ });   // warm up while the dialog is open
        inp.click();
    }
    function ctx() {
        return { db, me: st.me, cfg: CFG, toast, now, onPublished: skew => { if (typeof skew === 'number') st.skew = skew; } };
    }

    // ------------------------------------------------------------ auto-delete of expired stories
    // Primary mechanism: a Firestore TTL policy on stories.expiresAt (see STORIES_SETUP.md).
    // TTL can lag by up to a day, so each member's browser also removes THEIR OWN expired
    // stories (and the reactions under them) as a safety net; the admin page sweeps everyone's.
    async function deleteStoryDoc(ref) {
        const [rs, vs] = await Promise.all([ref.collection('reactions').get(), ref.collection('views').get()]);
        const b = db.batch(); rs.forEach(d => b.delete(d.ref)); vs.forEach(d => b.delete(d.ref)); b.delete(ref);
        await b.commit();
    }
    async function sweepMine() {
        if (!st.me) return;
        try {
            const snap = await db.collection('stories').where('ownerUid', '==', st.me.uid).limit(100).get();
            const t = now();
            for (const d of snap.docs) {
                const x = d.data();
                const c = x.createdAt && typeof x.createdAt.toMillis === 'function' ? x.createdAt.toMillis() : 0;
                const e = x.expiresAt && typeof x.expiresAt.toMillis === 'function' ? x.expiresAt.toMillis() : 0;
                if (!c) continue;
                const exp = Math.min(e || (c + S.DURATION_MS), c + S.DURATION_MS);
                if (exp + 60000 < t) { try { await deleteStoryDoc(d.ref); } catch (err) { /* retry next visit */ } }
            }
        } catch (e) { /* offline or rules: skip silently */ }
    }

    // ------------------------------------------------------------ boot
    async function onUser(user) {
        if (!user) { st.me = null; stopListener(); st.stories = []; st.groups = []; st.byOwner = new Map(); rawCache = []; renderRow(); decorateAvatars(); return; }
        let name = user.displayName || user.email || 'Member', photo = user.photoURL || '';
        st.me = { uid: user.uid, name, photo };
        loadSeen(); renderRow();
        try {
            const d = await db.collection('users').doc(user.uid).get();
            if (d.exists) { const u = d.data(); st.me.name = u.displayName || name; st.me.photo = u.photoURL || photo; }
        } catch (e) { /* use auth profile */ }
        startListener(); watchGrid(); setTimeout(watchGrid, 1500); setTimeout(watchGrid, 4000); setTimeout(sweepMine, 3000);
    }
    function boot() { auth.onAuthStateChanged(onUser); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

    window.Stories = { openUser, openById, openComposer, renderChatRef, isActive: id => !!st.stories.find(s => s.id === id), refreshChatRefs, version: '1.4.0' };
})();