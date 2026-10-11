/* ================================================================
   stories-composer.js · TIMAWA / Barkada Stories  (lazy-loaded, v1.3)
   Instagram-style flow:
     1. "Add story" opens the photo / video picker immediately (see stories.js).
     2. The editor opens with the selection already in place.
        Tools sit on the LEFT of the story: Text, Music, Layout/Framing,
        Timing, Caption. Each opens an overlay sheet (formatting for text,
        song search + clip picker for music).
     3. Changing the media means discarding (X) and starting again.

   Media rules
     - Photos: up to 6 per story, collage layout presets.
     - Video:  ONE video per story, max 60 s, length is automatic.
     - Music:  YouTube full songs (search with an API key, or paste a link) via the official
               embedded player; iTunes 30 s previews remain as a fallback.
               You slide a window over the available audio to pick the part.
               A story with music lasts exactly as long as the chosen clip
               (video stories keep the video's length), and the viewer keeps
               the song locked to the story clock.

   Text is stored as STRUCTURED data (never baked into pixels):
     { id, text, x, y, size, rot, font, color, bg, bgColor, align, bold, italic }
   x / y are the element CENTRE as fractions (0-1) of the story canvas and
   size is a fraction of canvas width, so every device renders identically.
   Photos / videos are uploaded untouched (no re-encoding).
   ================================================================ */
(function () {
    'use strict';
    if (window.StoriesComposer) return;
    const S = window.StoriesShared;
    const MAX_TEXTS = 8, MAX_TEXT_LEN = 120, MAX_CAPTION = 200, MAX_IMG = 15 * 1024 * 1024, MAX_VID = 50 * 1024 * 1024, MAX_VID_S = 60;
    const MAX_PHOTOS = S.MAX_PHOTOS, MIN_DUR = S.MIN_SHOW_MS / 1000, MAX_DUR = S.MAX_SHOW_MS / 1000, MIN_CLIP = 5;
    const rid = () => Math.random().toString(36).slice(2, 8);

    let C = null, root = null, q = {};
    const M = {
        sheet: null, items: [], video: null, layout: '', fit: 'fill', dur: MIN_DUR,
        texts: [], sel: null, caption: '', track: null, spotify: null, query: '', spq: '', changing: false,
        hist: [], preview: false, xhr: null, busy: false, results: [], msg: '', searching: false, playing: '', drag: null, lastTap: null, tl: null
    };
    let PALETTE = ['#ffffff', '#111111', '#ffd23f', '#ff5a6e', '#4ade80', '#38bdf8', '#c084fc'];

    const $ = (s, r) => (r || root).querySelector(s);
    const find = id => M.texts.find(t => t.id === id);
    const selT = () => find(M.sel);
    const hex = v => { v = (v || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null; };
    const hasMedia = () => M.items.length > 0 || !!M.video;
    const vidSec = () => M.video ? Math.min(MAX_DUR, Math.round(M.video.dur || 0)) : 0;
    // how long the story plays: video = its own length; photos = the music clip if there is one, else the chosen time
    const storyDur = () => M.video ? vidSec() : (M.track ? M.track.clipSec : M.dur);

    // length of the song the clip is cut from: whole song for YouTube, 30 s for library previews
    const trkLen = t => t ? (t.provider === 'youtube' ? (t.durationSec || 0) : (t.previewSec || 30)) : 0;
    const ytKey = () => String((window.STORIES_CONFIG || {}).youtubeApiKey || '').trim();

    // ------------------------------------------------------------ YouTube preview player (one persistent, VISIBLE player)
    // It lives in a fixed overlay that is positioned over a placeholder (.st-ytph) in the music sheet / preview card,
    // so re-rendering the sheet never reloads the iframe.
    const YP = { ad: null, id: '', host: null, loop: 0 };
    function ytHost() {
        if (!YP.host) { YP.host = document.createElement('div'); YP.host.className = 'st-ythost off'; root.appendChild(YP.host); }
        return YP.host;
    }
    function placeYT() {
        const h = YP.host; if (!h || !root || root.hidden) return;
        const ph = root.querySelector('.st-ytph');
        if (!ph || !YP.ad) { h.classList.add('off'); h.removeAttribute('style'); return; }
        const r = ph.getBoundingClientRect();
        if (r.width < 10) { h.classList.add('off'); return; }
        h.classList.remove('off');
        h.style.left = r.left + 'px'; h.style.top = r.top + 'px'; h.style.width = r.width + 'px'; h.style.height = r.height + 'px';
    }
    const placeSoon = () => { requestAnimationFrame(placeYT); setTimeout(placeYT, 280); };
    function ytStop() { clearInterval(YP.loop); YP.loop = 0; if (YP.ad && YP.ad.isReady()) YP.ad.pause(); }
    function ytDrop() {
        ytStop(); if (YP.ad) { YP.ad.destroy(); YP.ad = null; }
        YP.id = ''; if (YP.host) { YP.host.innerHTML = ''; YP.host.classList.add('off'); }
    }
    function ytAttach(t) {
        if (YP.ad && YP.id === t.videoId) return YP.ad;
        ytDrop(); YP.id = t.videoId;
        const ad = S.ytPlayer(ytHost(), t.videoId, {
            onReady: () => { if (YP.ad === ad && M.track === t) probeDuration(ad, t); },
            onError: code => { if (YP.ad === ad) ytFail(code); }
        });
        YP.ad = ad; placeSoon(); return ad;
    }
    function ytFail(code) {
        const msg = code === 101 || code === 150 ? 'The owner of that video doesn’t allow it to be played outside YouTube. Try another version of the song.'
            : code === 100 ? 'That video was removed or is private.'
            : code === -1 ? 'Couldn’t load the YouTube player. Check your connection or any ad blocker, then try again.'
            : code === -2 ? 'Couldn’t read the song length. Try another version of the song.'
            : 'That video can’t be played here. Try another version of the song.';
        stopAudio(); ytDrop(); M.track = null; M.changing = true; M.msg = msg;
        renderSheet(); renderPv();
    }
    // The player only knows the real length after it has loaded the video.
    function probeDuration(ad, t) {
        let n = 0;
        const tick = () => {
            if (YP.ad !== ad || M.track !== t) return;
            const d = ad.duration();
            if (d > 1) return gotDuration(t, d);
            if (++n < 10) { setTimeout(tick, 300); return; }
            ad.setMuted(true); ad.play();                       // some browsers only report it once playback has begun
            setTimeout(() => {
                if (YP.ad !== ad || M.track !== t) return;
                const d2 = ad.duration(); ad.pause(); ad.seek(0); ad.setMuted(false);
                d2 > 1 ? gotDuration(t, d2) : ytFail(-2);
            }, 1500);
        };
        tick();
    }
    // clip length = story length (photos: 15-60 s as chosen; video: the video's length, max 60 s)
    function clipFor(t) {
        const P = trkLen(t);
        const want = M.video ? Math.max(1, Math.min(MAX_DUR, vidSec() || 15)) : S.clamp(Math.round(M.dur), MIN_DUR, MAX_DUR);
        return Math.max(1, Math.min(want, Math.floor(P) || want));
    }
    function gotDuration(t, d) {
        t.durationSec = Math.floor(d);
        if (!M.video && t.durationSec < MIN_DUR) {
            C.toast('That song is shorter than the 15 s minimum story length. Pick a longer one.', 'warn');
            stopAudio(); ytDrop(); M.track = null; M.changing = true; renderSheet(); renderPv(); return;
        }
        t.clipSec = clipFor(t);
        t.startSec = Math.min(t.startSec, Math.max(0, t.durationSec - t.clipSec));
        renderSheet(); renderPv();
        if (M.sheet === 'music' && !M.preview) playClip();
    }
    function ytPlayClip() {
        const t = M.track; if (!t || !t.durationSec) return;
        const ad = ytAttach(t); if (!ad.isReady()) return;
        stopAudio(); M.playing = 'clip';
        ad.setMuted(false); ad.seek(t.startSec);
        ad.play().then(ok => { if (!ok && M.playing === 'clip' && M.track === t) { stopAudio(); C.toast('Your browser blocked the audio. Tap ▶ to play.', 'info'); if (M.sheet === 'music') renderSheet(); } });
        YP.loop = setInterval(() => { if (ad.pos() >= t.startSec + t.clipSec - 0.1) ad.seek(t.startSec); }, 200);
    }

    // ------------------------------------------------------------ preview audio (composer only)
    let aud = null, audStop = null;
    function stopAudio() {
        ytStop();
        if (audStop) { audStop(); audStop = null; }
        if (aud) { try { aud.pause(); aud.removeAttribute('src'); aud.load(); } catch (e) { /* ignore */ } aud = null; }
        const was = M.playing; M.playing = '';
        return was;
    }
    function playAudio(url, key, start, end, loop) {
        stopAudio();
        const a = new Audio(); aud = a; a.preload = 'auto'; a.src = url;
        a.addEventListener('loadedmetadata', () => { try { a.currentTime = start || 0; } catch (e) { /* ignore */ } });
        if (loop) audStop = S.attachClipLoop(a, start || 0, end);
        else a.addEventListener('ended', () => { if (aud === a) { M.playing = ''; if (M.sheet === 'music') renderSheet(); } });
        M.playing = key;
        a.play().catch(() => { if (aud === a) { M.playing = ''; C.toast('Your browser blocked the audio. Tap play again.', 'info'); if (M.sheet === 'music') renderSheet(); } });
    }
    const clipEnd = t => Math.min(t.startSec + t.clipSec, trkLen(t));
    const playClip = () => { const t = M.track; if (!t) return; if (t.provider === 'youtube') ytPlayClip(); else playAudio(t.previewUrl, 'clip', t.startSec, clipEnd(t), true); };
    function toggleClip() { if (M.playing === 'clip') stopAudio(); else playClip(); renderSheet(); }

    // ------------------------------------------------------------ DOM
    function build() {
        if (root) return;
        S.loadFonts();
        root = document.createElement('div');
        root.className = 'st-comp'; root.hidden = true;
        root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Create story');
        root.innerHTML = `
          <div class="st-ch">
            <button class="st-ib" style="background:var(--theme-primary-soft,#e0f2fe);color:var(--theme-primary,#1089d3)" type="button" data-k="close" aria-label="Discard story"><i class="fas fa-xmark"></i></button>
            <h3>New story</h3>
            <button class="st-btn ghost sm" type="button" data-k="preview"><i class="fas fa-eye"></i> Preview</button>
          </div>
          <div class="st-cbody">
            <div class="st-stagewrap"><div class="st-cstage">
              <div class="st-bgblur"></div><div class="st-media-wrap"></div><div class="st-texts"></div>
              <div class="st-safe" style="top:14%"></div><div class="st-safe" style="top:80%"></div>
              <div class="st-scrim-t" hidden></div><div class="st-scrim-b" hidden></div>
              <div class="st-tools" role="toolbar" aria-label="Story tools"></div>
              <div class="st-pv" hidden style="position:absolute;left:12px;right:12px;bottom:12px;z-index:4;color:#fff;display:flex;flex-direction:column;gap:8px;pointer-events:none"></div>
            </div></div>
          </div>
          <div class="st-bb"><button class="st-btn" type="button" data-k="publish"><i class="fas fa-paper-plane"></i> Share to your story</button><div class="st-bar" hidden><i></i></div></div>
          <div class="st-sheet" hidden role="dialog" aria-label="Story options"><div class="st-sh-h"><b></b><button class="st-btn sm" type="button" data-k="done">Done</button></div><div class="st-sh-b"></div></div>
          <input type="file" hidden>`;
        document.body.appendChild(root);
        q = { head: $('.st-ch'), stage: $('.st-cstage'), mw: $('.st-media-wrap'), bg: $('.st-bgblur'), tx: $('.st-texts'), tools: $('.st-tools'), sheet: $('.st-sheet'),
              sht: $('.st-sh-h b'), shb: $('.st-sh-b'), file: $('input[type=file]'), bar: $('.st-bar'), barI: $('.st-bar i'), pub: $('[data-k=publish]'),
              pv: $('.st-pv'), sT: $('.st-scrim-t'), sB: $('.st-scrim-b'), prevB: $('[data-k=preview]') };
        S.observeStage(q.stage);
        if ('ResizeObserver' in window) new ResizeObserver(measure).observe(q.sheet);

        root.addEventListener('click', onClick);
        q.shb.addEventListener('input', onInput);
        q.shb.addEventListener('change', e => {
            if (e.target.type !== 'range') return;
            if (e.target.dataset.in === 'size' || e.target.dataset.in === 'rot') pushHist();
        });
        q.shb.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                if (e.target.dataset.in === 'music') { e.preventDefault(); musicSearch(); }
                else if (e.target.dataset.in === 'spotify') { e.preventDefault(); spotifyGo(); }
            }
            if (e.target.classList && e.target.classList.contains('st-win') && M.track && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault(); setStart(M.track.startSec + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1)); if (M.playing === 'clip') playClip();
            }
        });
        wireStage(); wireTimeline();
        document.addEventListener('keydown', e => {
            if (!root || root.hidden || e.key !== 'Escape' || e.target.isContentEditable) return;
            M.sheet ? closeSheet() : tryClose();
        });
    }

    // files: the selection made in the picker that opened this editor
    async function open(ctx, files) {
        C = ctx; C.cfg = Object.assign({ cloudName: 'ooq99nlw', uploadPreset: 't-imawa' }, C.cfg);
        build();
        const cs = getComputedStyle(document.documentElement);
        PALETTE = ['#ffffff', '#111111', hex(cs.getPropertyValue('--theme-primary')), hex(cs.getPropertyValue('--theme-accent')), '#ffd23f', '#ff5a6e', '#4ade80', '#38bdf8', '#c084fc'].filter(Boolean);
        reset();
        root.hidden = false; document.documentElement.classList.add('st-lock');
        renderAll();
        await addFiles(files || []);
        if (!hasMedia()) { closeNow(); return; }      // nothing usable was picked: no empty editor
        const c = root.querySelector('[data-k=close]'); if (c) c.focus({ preventScroll: true });
    }
    function revokeAll() {
        M.items.forEach(i => { try { URL.revokeObjectURL(i.url); } catch (e) { /* ignore */ } });
        if (M.video) { try { URL.revokeObjectURL(M.video.url); } catch (e) { /* ignore */ } }
    }
    function reset() {
        stopAudio(); ytDrop(); revokeAll();
        Object.assign(M, { sheet: null, items: [], video: null, layout: '', fit: 'fill', dur: MIN_DUR, texts: [], sel: null, caption: '', track: null, spotify: null, query: '', spq: '', changing: false,
            hist: [], preview: false, busy: false, results: [], msg: '', searching: false, playing: '', tl: null });
    }
    function dirty() { return !!(hasMedia() || M.texts.length || M.track || M.spotify); }
    function tryClose() {
        if (M.busy) { if (!confirm('Cancel the upload?')) return; if (M.xhr) M.xhr.abort(); }
        else if (dirty() && !confirm('Discard this story? Your photos or video and edits will be removed.')) return;
        closeNow();
    }
    function closeNow() {
        reset(); root.hidden = true; root.classList.remove('sheet'); document.documentElement.classList.remove('st-lock');
        q.mw.innerHTML = ''; q.bg.innerHTML = ''; q.tx.innerHTML = ''; q.bar.hidden = true;
    }

    // ------------------------------------------------------------ media (selected up-front, not editable afterwards)
    function readImage(f) {
        return new Promise((res, rej) => {
            const url = URL.createObjectURL(f), im = new Image();
            im.onload = () => res({ id: rid(), file: f, url, w: im.naturalWidth, h: im.naturalHeight });
            im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('read')); };
            im.src = url;
        });
    }
    function readVideo(f) {
        return new Promise((res, rej) => {
            const url = URL.createObjectURL(f), v = document.createElement('video'); v.preload = 'metadata';
            v.onloadedmetadata = () => {
                if (v.duration > MAX_VID_S + 0.5) { URL.revokeObjectURL(url); return rej(new Error('long')); }
                res({ file: f, url, w: v.videoWidth, h: v.videoHeight, dur: v.duration || 0 });
            };
            v.onerror = () => { URL.revokeObjectURL(url); rej(new Error('format')); };
            v.src = url;
        });
    }
    function fixLayout() { M.layout = M.items.length >= 2 ? S.getLayout(M.layout, M.items.length).id : ''; }
    async function addFiles(files) {
        const vids = files.filter(f => f.type.startsWith('video/')), imgs = files.filter(f => f.type.startsWith('image/'));
        if (!vids.length && !imgs.length) return C.toast('Please choose photos or a video.', 'warn');
        if (vids.length) {
            if (files.length > 1) return C.toast('A video story can only have one video. Choose a video on its own, or only photos.', 'warn');
            const f = vids[0];
            if (f.size > MAX_VID) return C.toast('Videos can be up to 50 MB.', 'warn');
            try { M.video = await readVideo(f); }
            catch (e) { C.toast(e.message === 'long' ? 'Videos can be up to 1 minute.' : 'That video format is not supported by your browser.', e.message === 'long' ? 'warn' : 'error'); }
        } else {
            if (imgs.length > MAX_PHOTOS) C.toast('Only the first ' + MAX_PHOTOS + ' photos were added (max ' + MAX_PHOTOS + ').', 'warn');
            for (const f of imgs.slice(0, MAX_PHOTOS)) {
                if (f.size > MAX_IMG) { C.toast('“' + f.name + '” is over 15 MB, skipped.', 'warn'); continue; }
                try { M.items.push(await readImage(f)); } catch (e) { C.toast('Could not read “' + f.name + '”.', 'error'); }
            }
            fixLayout();
        }
        renderAll();
    }

    function renderStage() {
        q.mw.innerHTML = ''; q.bg.innerHTML = '';
        const n = M.items.length;
        q.mw.className = 'st-media-wrap' + (n > 1 ? ' collage' : (M.fit === 'fit' ? ' fit' : ''));
        if (M.video) {
            const v = document.createElement('video'); v.src = M.video.url; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', '');
            q.mw.appendChild(v); v.play().catch(() => {});
            if (M.fit === 'fit') q.mw.classList.add('fit');
        } else if (n > 1) {
            q.mw.innerHTML = S.collageHtml(M.items, M.layout, true);
        } else if (n === 1) {
            const i = new Image(); i.src = M.items[0].url; i.alt = ''; q.mw.appendChild(i);
            if (M.fit === 'fit') { const b = new Image(); b.src = M.items[0].url; b.alt = ''; q.bg.appendChild(b); }
        }
        renderTexts(); renderPv();
    }
    function renderTexts() {
        q.tx.innerHTML = M.texts.map(t => S.textHtml(t, t.id === M.sel && !M.preview ? 'sel' : '', `data-id="${t.id}"`)).join('');
    }
    function refreshEl(t) {
        const el = q.tx.querySelector(`[data-id="${t.id}"]`); if (!el) return;
        const keep = el.getAttribute('contenteditable');
        el.style.cssText = S.textStyle(t);
        el.className = 'st-t st-t-' + (t.bg || 'none') + (t.id === M.sel && !M.preview ? ' sel' : '');
        if (keep) el.setAttribute('contenteditable', keep);
    }
    function musicCard(tr, spotify) {
        const art = S.safeImgUrl(tr.thumbnail), yt = !spotify && tr.provider === 'youtube';
        return `<div class="st-music-card playing${yt ? ' yt' : ''}">${yt ? '<div class="st-ytph"></div>' : art ? `<img src="${S.esc(art)}" alt="">` : '<span class="ph">🎵</span>'}<div class="st-mt"><b>${S.esc(tr.title)}</b><small>${S.esc(tr.artist || (spotify ? 'Spotify' : 'Music'))}</small></div>${spotify ? '<span class="st-mbtn">▶ Play</span>' : '<span class="st-eq" aria-hidden="true"><i></i><i></i><i></i></span>'}</div>`;
    }
    function renderPv() {
        q.stage.classList.toggle('pv', M.preview);
        q.sT.hidden = q.sB.hidden = q.pv.hidden = !M.preview;
        q.tx.style.pointerEvents = M.preview ? 'none' : '';
        if (!M.preview) { q.pv.innerHTML = ''; return; }
        q.pv.innerHTML = (M.caption ? `<div style="text-align:center;font-size:14px;text-shadow:0 1px 6px #000">${S.esc(M.caption)}</div>` : '') +
            (M.track ? musicCard(M.track, false) : M.spotify ? musicCard(M.spotify, true) : '');
        placeSoon();
    }
    function setPreview(on) {
        M.preview = on;
        if (on) {
            M.sel = null; if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            M.sheet = null; if (M.track) playClip(); else stopAudio();
        } else stopAudio();
        renderTexts(); renderPv(); renderSheet();
    }

    // ------------------------------------------------------------ left tool column
    function renderTools() {
        const n = M.items.length, tools = [
            ['text', 'Aa', 'Text', M.texts.length > 0],
            ['music', '<i class="fas fa-music"></i>', 'Music', !!(M.track || M.spotify)],
            n >= 2 ? ['layout', '<i class="fas fa-table-cells-large"></i>', 'Layout', false] : ['layout', '<i class="fas fa-expand"></i>', 'Framing', M.fit === 'fit'],
            ...(!M.video ? [['time', '<i class="far fa-clock"></i>', 'Timing', false]] : []),
            ['caption', '<i class="far fa-message"></i>', 'Caption', !!M.caption]
        ];
        q.tools.innerHTML = tools.map(([k, ic, lab, dot]) => `<button type="button" class="st-tool ${M.sheet === k ? 'on' : ''}" data-k="tool" data-v="${k}" aria-label="${lab}" aria-pressed="${M.sheet === k}">${ic}${dot ? '<span class="dot"></span>' : ''}<span class="st-tool-lab">${lab}</span></button>`).join('');
    }

    // ------------------------------------------------------------ sheets (overlays)
    const SHEET_TITLES = { text: 'Text', music: 'Music', layout: '', time: 'Story length', caption: 'Caption' };
    function openSheet(name) {
        if (M.preview) setPreview(false);
        if (M.sheet === 'music' && name !== 'music') stopAudio();
        M.sheet = name;
        if (name === 'music') S.loadYT().catch(() => { /* reported when a YouTube song is picked */ });
        if (name === 'text') { if (!M.texts.length) { addText(); return; } }
        renderSheet();
    }
    function closeSheet() {
        if (!M.sheet) return;
        if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
        if (M.sheet === 'music') { stopAudio(); M.changing = false; }
        if (M.sheet === 'text') { M.sel = null; renderTexts(); }
        M.sheet = null; renderSheet();
    }
    function measure() {
        if (!root) return;
        root.style.setProperty('--sh', (M.sheet ? q.sheet.offsetHeight : 0) + 'px');
        root.style.setProperty('--hh', q.head.offsetHeight + 'px');
        placeYT();
    }
    function renderAll() { renderStage(); renderSheet(); }
    function renderSheet() {
        const open = !!M.sheet && !M.preview;
        root.classList.toggle('sheet', open);
        q.sheet.hidden = !open;
        q.prevB.innerHTML = M.preview ? '<i class="fas fa-pen"></i> Edit' : '<i class="fas fa-eye"></i> Preview';
        q.pub.disabled = M.busy || !hasMedia();
        renderTools();
        if (!open) { root.style.setProperty('--sh', '0px'); return; }
        q.sht.textContent = M.sheet === 'layout' ? (M.items.length >= 2 ? 'Layout' : 'Framing') : SHEET_TITLES[M.sheet];
        q.shb.innerHTML = M.sheet === 'text' ? textSheet() : M.sheet === 'music' ? musicSheet() : M.sheet === 'layout' ? layoutSheet() : M.sheet === 'time' ? timeSheet() : captionSheet();
        requestAnimationFrame(measure); placeSoon();
    }

    function sw(list, cur, k) { return list.map(c => `<button type="button" class="st-sw ${c === cur ? 'on' : ''}" data-k="${k}" data-v="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join(''); }
    function chips(list, cur, k) { return list.map(([v, l]) => `<button type="button" class="st-chip ${v === cur ? 'on' : ''}" data-k="${k}" data-v="${v}">${l}</button>`).join(''); }

    // ---- text: formatting overlay
    function textSheet() {
        const t = selT();
        let h = `<div class="st-row2"><button class="st-btn sm" type="button" data-k="addText"><i class="fas fa-plus"></i> Add text</button>
            <button class="st-btn ghost sm" type="button" data-k="editText" ${t ? '' : 'disabled'}><i class="fas fa-pen"></i> Edit</button>
            <button class="st-btn ghost sm" type="button" data-k="dup" ${t ? '' : 'disabled'}><i class="far fa-clone"></i> Duplicate</button>
            <button class="st-btn danger sm" type="button" data-k="del" ${t ? '' : 'disabled'} aria-label="Delete text"><i class="fas fa-trash"></i></button>
            <button class="st-btn ghost sm" type="button" data-k="undo" ${M.hist.length > 1 ? '' : 'disabled'}><i class="fas fa-rotate-left"></i> Undo</button>
            <button class="st-btn ghost sm" type="button" data-k="resetText" ${M.texts.length ? '' : 'disabled'}>Reset</button></div>`;
        if (!t) return h + `<p class="st-hint">Tap a text on the story to style it. Double-tap a text to edit it, drag to move it.</p>`;
        return h + `<div class="st-lab">Font</div><div class="st-row2">${Object.entries(S.FONTS).map(([k, f]) => `<button type="button" class="st-chip ${t.font === k ? 'on' : ''}" data-k="font" data-v="${k}" style="font-family:${f.css}">${f.label}</button>`).join('')}</div>
          <div class="st-row2"><label class="st-range">Size <input type="range" min="35" max="180" value="${Math.round(t.size * 1000)}" data-in="size"></label>
            <label class="st-range">Rotate <input type="range" min="-45" max="45" value="${Math.round(t.rot)}" data-in="rot"></label></div>
          <div class="st-row2">${chips([['left', '<i class="fas fa-align-left"></i>'], ['center', '<i class="fas fa-align-center"></i>'], ['right', '<i class="fas fa-align-right"></i>']], t.align, 'align')}
            <button type="button" class="st-chip ${t.bold ? 'on' : ''}" data-k="bold"><b>B</b></button><button type="button" class="st-chip ${t.italic ? 'on' : ''}" data-k="italic"><i>I</i></button></div>
          <div class="st-lab">Text colour</div><div class="st-row2">${sw(PALETTE, t.color, 'color')}</div>
          <div class="st-lab">Background</div><div class="st-row2">${chips([['none', 'None'], ['semi', 'Soft'], ['solid', 'Solid'], ['pill', 'Pill']], t.bg, 'bg')}</div>
          ${t.bg !== 'none' ? `<div class="st-row2">${sw(PALETTE, t.bgColor, 'bgColor')}</div>` : ''}
          <div class="st-lab">Position</div><div class="st-row2">${chips([['top', 'Top'], ['mid', 'Middle'], ['bot', 'Bottom']], '', 'place')}</div>`;
    }

    // ---- music: search overlay + clip picker
    function waveHtml(seed, n) {
        let h = 7; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        let out = '';
        for (let i = 0; i < n; i++) { h = (h * 1664525 + 1013904223) >>> 0; out += `<i style="height:${20 + ((h >>> 9) % 72)}%"></i>`; }
        return out;
    }
    function musicSheet() {
        const tr = M.track, sp = M.spotify, searching = !tr || M.changing, hasKey = !!ytKey();
        let h = '';
        if (tr) {
            const yt = tr.provider === 'youtube', P = trkLen(tr), thumb = S.safeImgUrl(tr.thumbnail);
            const lens = (yt ? [15, 30, 45, 60] : [5, 10, 15, 20, 30]).filter(v => v <= P);
            if (yt) h += `<div class="st-ytph" aria-label="YouTube player"></div>`;
            h += `<div class="st-track" style="margin-top:0">${thumb ? `<img src="${S.esc(thumb)}" alt="">` : '<span class="ph" style="width:44px;height:44px;border-radius:8px;background:#1db954;display:grid;place-items:center">🎵</span>'}
                <div class="st-mt"><b>${S.esc(tr.title)}</b><small>${S.esc(tr.artist || 'Music')} · ${yt ? 'full song' : '30 s preview'}</small></div>
                ${yt ? `<a class="st-btn ghost sm" href="https://www.youtube.com/watch?v=${tr.videoId}" target="_blank" rel="noopener noreferrer" aria-label="Open on YouTube">YouTube ↗</a>` : ''}
                <button class="st-btn ghost sm" type="button" data-k="playClip" ${P ? '' : 'disabled'} aria-label="${M.playing === 'clip' ? 'Pause' : 'Play'} clip">${M.playing === 'clip' ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>'}</button>
                <button class="st-btn danger sm" type="button" data-k="rmTrack" aria-label="Remove song"><i class="fas fa-xmark"></i></button></div>`;
            if (!P) h += `<p class="st-hint">Loading the song…</p>`;
            else h += `<div class="st-lab" style="margin-top:12px">Choose the part of the song</div>
              <div class="st-tl" aria-label="Song timeline"><div class="st-wave">${waveHtml(tr.trackId || tr.title, 64)}</div>
                <div class="st-win" role="slider" tabindex="0" aria-label="Clip start" aria-valuemin="0" aria-valuemax="${(P - tr.clipSec).toFixed(1)}" aria-valuenow="${tr.startSec}" style="left:${(tr.startSec / P * 100).toFixed(2)}%;width:${(tr.clipSec / P * 100).toFixed(2)}%"></div></div>
              <div class="st-tlab"><span>0:00</span><b class="st-cliplabel">${S.fmtSec(tr.startSec)} – ${S.fmtSec(tr.startSec + tr.clipSec)} · ${tr.clipSec}s</b><span>${S.fmtSec(P)}</span></div>
              ${M.video ? `<p class="st-note2">Your video is ${S.fmtSec(vidSec())} long, so the clip follows it (${tr.clipSec}s). The video’s own sound is muted while a song is attached.</p>`
                : `<div class="st-lab" style="margin-top:10px">Clip length = story length</div><div class="st-lenrow">${lens.map(v => `<button type="button" class="st-chip ${tr.clipSec === v ? 'on' : ''}" data-k="clipLen" data-v="${v}">${v}s</button>`).join('')}</div>`}
              <p class="st-note2">Drag the window to pick where in the song your story starts (arrow keys nudge it). Your story lasts exactly as long as the clip and the song stays in sync.${yt ? '' : ` Library previews are ${P}s long; paste a YouTube link to use any part of a full song.`}</p>`;
            if (!M.changing) h += `<div class="st-row2" style="margin-top:10px"><button class="st-btn ghost sm" type="button" data-k="changeSong"><i class="fas fa-arrows-rotate"></i> Change song</button></div>`;
        }
        if (searching) {
            h += `<div class="st-lab"${tr ? ' style="margin-top:12px"' : ''}>${tr ? 'Search another song' : 'Search a song'}</div>
              <div class="st-row2" style="flex-wrap:nowrap"><input class="st-input" data-in="music" placeholder="${hasKey ? 'Search a song or paste a YouTube link' : 'Paste a YouTube link (or search 30 s previews)'}" aria-label="Search songs or paste a YouTube link" value="${S.esc(M.query)}"><button class="st-btn sm" type="button" data-k="musicGo" ${M.searching ? 'disabled' : ''} aria-label="Search"><i class="fas fa-magnifying-glass"></i></button></div>
              ${M.searching ? '<p class="st-hint">Searching…</p>' : M.msg ? `<p class="st-hint">${S.esc(M.msg)}</p>` : `<p class="st-hint">${hasKey ? 'Full songs from YouTube play automatically for viewers. ' : 'Paste a YouTube link to use a full song. Full-song search isn’t set up yet, so searching shows 30-second previews. '}You’ll pick which part goes with your story.</p>`}
              ${M.results.map((r, i) => `<div class="st-track">${r.thumbnail ? `<img src="${S.esc(r.thumbnail)}" alt="">` : ''}<div class="st-mt"><b>${S.esc(r.title)}</b><small>${S.esc(r.artist || '')} · ${r.provider === 'youtube' ? 'full song' : '30 s preview'}</small></div>
                ${r.provider === 'youtube' ? '' : `<button class="st-btn ghost sm" type="button" data-k="playRes" data-v="${i}" aria-label="Preview">${M.playing === 'r' + i ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>'}</button>`}
                <button class="st-btn sm" type="button" data-k="pickTrack" data-v="${i}">Select</button></div>`).join('')}
              ${M.changing && tr ? `<div class="st-row2" style="margin-top:10px"><button class="st-btn ghost sm" type="button" data-k="keepSong">Keep current song</button></div>` : ''}`;
        }
        if (sp) {
            h += `<div class="st-lab" style="margin-top:12px">Attached Spotify link</div>
                <div class="st-track">${S.safeImgUrl(sp.thumbnail) ? `<img src="${S.esc(S.safeImgUrl(sp.thumbnail))}" alt="">` : '<span class="ph" style="width:44px;height:44px;border-radius:8px;background:#1db954;display:grid;place-items:center">🎵</span>'}
                  <div class="st-mt"><b>${S.esc(sp.title)}</b><small>${S.esc(sp.artist || 'Spotify')}</small></div>
                  <a class="st-btn ghost sm" href="${S.esc(sp.url)}" target="_blank" rel="noopener noreferrer">Open</a>
                  <button class="st-btn danger sm" type="button" data-k="rmSpotify" aria-label="Remove link"><i class="fas fa-xmark"></i></button></div>
                <p class="st-hint">Spotify links show a Play button for viewers. They can’t auto-play or be clipped; use a YouTube link for that.</p>`;
        }
        if (searching) h += `<details class="st-det"${sp && !tr ? ' open' : ''}><summary>Use a Spotify link instead</summary>
            <div class="st-row2" style="flex-wrap:nowrap;margin-top:8px"><input class="st-input" data-in="spotify" placeholder="Paste a Spotify track link" aria-label="Spotify link" value="${S.esc(M.spq)}"><button class="st-btn sm" type="button" data-k="spotifyGo">Add</button></div></details>`;
        return h;
    }

    // ---- layout / framing
    function layoutSheet() {
        const n = M.items.length;
        if (n >= 2) return `<div class="st-row2">${S.layoutsFor(n).map(L => `<button type="button" class="st-lay ${L.id === M.layout ? 'on' : ''}" data-k="layout" data-v="${L.id}" title="${S.esc(L.label)}" aria-label="Layout: ${S.esc(L.label)}">${S.miniLayoutHtml(L)}</button>`).join('')}</div>
            <p class="st-hint">Photos appear in the order you selected them. To change photos, discard this story and pick again.</p>`;
        return `<div class="st-row2">${chips([['fill', 'Fill screen'], ['fit', 'Fit whole']], M.fit, 'fit')}</div>
            <p class="st-hint">“Fit whole” shows the entire ${M.video ? 'video' : 'photo'} with a soft background.</p>`;
    }
    // ---- timing (photos)
    function timeSheet() {
        if (M.track) return `<p class="st-hint" style="margin:0">With music attached your story lasts exactly as long as the song clip: <b>${M.track.clipSec}s</b>. Change the clip length in <b>Music</b>.</p>`;
        return `<div class="st-row2" style="margin-bottom:4px">${[15, 30, 45, 60].map(v => `<button type="button" class="st-chip ${M.dur === v ? 'on' : ''}" data-k="dur" data-v="${v}">${v}s</button>`).join('')}</div>
            <div class="st-row2"><label class="st-range">Custom <input type="range" min="${MIN_DUR}" max="${MAX_DUR}" step="1" value="${M.dur}" data-in="dur" aria-label="Story duration in seconds"><b class="st-durv" style="min-width:34px">${M.dur}s</b></label></div>
            <p class="st-hint">How long viewers see this story (15 s – 1 min).</p>`;
    }
    function captionSheet() {
        return `<input class="st-input" data-in="caption" maxlength="${MAX_CAPTION}" placeholder="Say something about this moment…" value="${S.esc(M.caption)}" aria-label="Caption"><p class="st-hint">Shown at the bottom of your story. Up to ${MAX_CAPTION} characters.</p>`;
    }

    // ------------------------------------------------------------ text elements
    const snap = () => JSON.stringify(M.texts);
    function pushHist() { const s = snap(); if (M.hist[M.hist.length - 1] !== s) { M.hist.push(s); if (M.hist.length > 40) M.hist.shift(); } }
    function undo() {
        if (M.hist.length < 2) { if (M.hist.length === 1 && M.texts.length) { M.texts = JSON.parse(M.hist[0]); } else return; }
        else { M.hist.pop(); M.texts = JSON.parse(M.hist[M.hist.length - 1]); }
        if (!find(M.sel)) M.sel = null;
        renderTexts(); renderSheet();
    }
    function addText() {
        if (!hasMedia()) return;
        if (M.texts.length >= MAX_TEXTS) return C.toast('You can add up to ' + MAX_TEXTS + ' text elements.', 'warn');
        if (!M.hist.length) M.hist.push('[]');
        const t = { id: rid(), text: 'Your text', x: 0.5, y: 0.5, size: 0.075, rot: 0, font: 'modern', color: '#ffffff', bg: 'none', bgColor: '#000000', align: 'center', bold: true, italic: false };
        M.texts.push(t); M.sel = t.id; M.sheet = 'text';
        renderTexts(); renderSheet(); pushHist(); edit(t.id, true);
    }
    function dup() {
        const t = selT(); if (!t) return;
        if (M.texts.length >= MAX_TEXTS) return C.toast('Text limit reached.', 'warn');
        const n = Object.assign({}, t, { id: rid(), x: S.clamp(t.x + 0.05, S.SAFE.xMin, S.SAFE.xMax), y: S.clamp(t.y + 0.06, S.SAFE.yMin, S.SAFE.yMax) });
        M.texts.push(n); M.sel = n.id; renderTexts(); renderSheet(); pushHist();
    }
    function del() {
        if (!M.sel) return;
        M.texts = M.texts.filter(t => t.id !== M.sel); M.sel = null; renderTexts(); renderSheet(); pushHist();
    }
    function select(id) {
        if (M.sel === id) return;
        M.sel = id;
        q.tx.querySelectorAll('.st-t').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
        if (id && M.sheet !== 'text') { if (M.sheet === 'music') stopAudio(); M.sheet = 'text'; }
        renderSheet();
    }
    function edit(id, selectAll) {
        const el = q.tx.querySelector(`[data-id="${id}"]`); if (!el) return;
        el.setAttribute('contenteditable', 'true'); el.setAttribute('role', 'textbox'); el.setAttribute('aria-label', 'Story text'); el.focus();
        const r = document.createRange(); r.selectNodeContents(el); if (!selectAll) r.collapse(false);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        const t = find(id);
        const onIn = () => { if (el.innerText.length > MAX_TEXT_LEN) { el.innerText = el.innerText.slice(0, MAX_TEXT_LEN); } };
        const onPaste = e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').slice(0, MAX_TEXT_LEN)); };
        const onBlur = () => {
            el.removeEventListener('input', onIn); el.removeEventListener('paste', onPaste); el.removeEventListener('blur', onBlur);
            el.removeAttribute('contenteditable'); el.removeAttribute('role');
            const v = el.innerText.replace(/\u00a0/g, ' ').trim().slice(0, MAX_TEXT_LEN);
            if (!find(id)) return;
            if (!v) { M.texts = M.texts.filter(x => x.id !== id); if (M.sel === id) M.sel = null; renderTexts(); renderSheet(); pushHist(); return; }
            if (v !== t.text) { t.text = v; pushHist(); }
            el.textContent = t.text;
        };
        el.addEventListener('input', onIn); el.addEventListener('paste', onPaste); el.addEventListener('blur', onBlur);
    }
    function wireStage() {
        const st = q.stage;
        st.addEventListener('pointerdown', e => {
            if (M.preview || e.target.closest('.st-tools')) return;
            const el = e.target.closest('.st-t');
            if (!el) {
                if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
                if (M.sheet === 'text') closeSheet(); else select(null);
                return;
            }
            if (el.isContentEditable) return;
            const t = find(el.dataset.id); if (!t) return;
            select(t.id);
            const nowT = Date.now();
            if (M.lastTap && M.lastTap.id === t.id && nowT - M.lastTap.t < 320) { M.lastTap = null; edit(t.id); return; }
            M.lastTap = { id: t.id, t: nowT };
            const r = st.getBoundingClientRect();
            M.drag = { id: t.id, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, w: r.width, h: r.height, moved: false };
            try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            e.preventDefault();
        });
        st.addEventListener('pointermove', e => {
            const d = M.drag; if (!d) return;
            const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
            if (!d.moved && Math.hypot(dx, dy) < 4) return;
            d.moved = true; st.classList.add('drag');
            const t = find(d.id); if (!t) return;
            t.x = S.clamp(d.ox + dx / d.w, S.SAFE.xMin, S.SAFE.xMax);
            t.y = S.clamp(d.oy + dy / d.h, S.SAFE.yMin, S.SAFE.yMax);
            refreshEl(t);
        });
        const end = () => { const d = M.drag; M.drag = null; st.classList.remove('drag'); if (d && d.moved) pushHist(); };
        st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
    }

    // ------------------------------------------------------------ music clip picker (draggable window)
    function setStart(v) {
        const t = M.track; if (!t) return;
        const P = trkLen(t); if (!P) return;
        t.startSec = Math.round(S.clamp(v, 0, Math.max(0, P - t.clipSec)) * 10) / 10;
        updateClipUI();
    }
    function updateClipUI() {
        const t = M.track; if (!t) return;
        const P = trkLen(t) || 1, win = $('.st-win'), lbl = $('.st-cliplabel');
        if (win) { win.style.left = (t.startSec / P * 100).toFixed(2) + '%'; win.style.width = (t.clipSec / P * 100).toFixed(2) + '%'; win.setAttribute('aria-valuenow', String(t.startSec)); win.setAttribute('aria-valuemax', (P - t.clipSec).toFixed(1)); }
        if (lbl) lbl.textContent = `${S.fmtSec(t.startSec)} – ${S.fmtSec(t.startSec + t.clipSec)} · ${t.clipSec}s`;
    }
    function wireTimeline() {
        q.shb.addEventListener('pointerdown', e => {
            const tl = e.target.closest('.st-tl'); if (!tl || !M.track) return;
            const r = tl.getBoundingClientRect(), P = trkLen(M.track), x = e.clientX - r.left; if (!P) return;
            const winL = (M.track.startSec / P) * r.width, winW = (M.track.clipSec / P) * r.width;
            let grab = x - winL;
            if (x < winL || x > winL + winW) { grab = winW / 2; setStart(((x - grab) / r.width) * P); }
            M.tl = { r, P, grab }; stopAudio();
            try { tl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            e.preventDefault();
        });
        q.shb.addEventListener('pointermove', e => { if (M.tl) setStart(((e.clientX - M.tl.r.left - M.tl.grab) / M.tl.r.width) * M.tl.P); });
        const end = () => { if (!M.tl) return; M.tl = null; if (M.track) { playClip(); renderSheet(); } };
        q.shb.addEventListener('pointerup', end); q.shb.addEventListener('pointercancel', end);
    }

    function onInput(e) {
        const k = e.target.dataset.in, t = selT();
        if (k === 'caption') { M.caption = e.target.value.slice(0, MAX_CAPTION); renderTools(); }
        else if (k === 'music') { M.query = e.target.value; }
        else if (k === 'spotify') { M.spq = e.target.value; }
        else if (k === 'dur') { M.dur = S.clamp(Math.round(e.target.value), MIN_DUR, MAX_DUR); const b = $('.st-durv'); if (b) b.textContent = M.dur + 's'; }
        else if (t && k === 'size') { t.size = S.clamp(e.target.value / 1000, 0.035, 0.18); refreshEl(t); }
        else if (t && k === 'rot') { t.rot = Number(e.target.value); refreshEl(t); }
    }
    function onClick(e) {
        const b = e.target.closest('[data-k]'); if (!b) return;
        const k = b.dataset.k, v = b.dataset.v, t = selT();
        const style = (fn) => { if (!t) return; fn(t); refreshEl(t); pushHist(); renderSheet(); };
        switch (k) {
            case 'close': tryClose(); break;
            case 'done': closeSheet(); break;
            case 'tool': M.sheet === v ? closeSheet() : openSheet(v); break;
            case 'preview': setPreview(!M.preview); break;
            case 'layout': M.layout = v; renderStage(); renderSheet(); break;
            case 'fit': M.fit = v; renderStage(); renderSheet(); break;
            case 'dur': M.dur = S.clamp(Number(v), MIN_DUR, MAX_DUR); renderSheet(); break;
            case 'addText': addText(); break;
            case 'editText': if (t) edit(t.id); break;
            case 'dup': dup(); break;
            case 'del': del(); break;
            case 'undo': undo(); break;
            case 'resetText': if (M.texts.length && confirm('Remove all text from this story?')) { if (!M.hist.length) M.hist.push(snap()); M.texts = []; M.sel = null; renderTexts(); renderSheet(); pushHist(); } break;
            case 'font': style(x => { x.font = v; }); break;
            case 'align': style(x => { x.align = v; }); break;
            case 'bold': style(x => { x.bold = !x.bold; }); break;
            case 'italic': style(x => { x.italic = !x.italic; }); break;
            case 'color': style(x => { x.color = v; }); break;
            case 'bg': style(x => { x.bg = v; }); break;
            case 'bgColor': style(x => { x.bgColor = v; }); break;
            case 'place': style(x => { x.y = v === 'top' ? 0.2 : v === 'mid' ? 0.5 : 0.74; x.x = 0.5; }); break;
            case 'musicGo': musicSearch(); break;
            case 'playRes': {
                const r = M.results[Number(v)]; if (!r) break;
                if (M.playing === 'r' + v) stopAudio(); else playAudio(r.previewUrl, 'r' + v, 0, 30, false);
                renderSheet(); break;
            }
            case 'pickTrack': {
                const r = M.results[Number(v)]; if (!r) break;
                if (r.provider === 'youtube') { selectYt(r); break; }
                ytDrop();
                const P = r.previewSec || 30;
                const clip = M.video ? Math.max(MIN_CLIP, Math.min(P, vidSec() || 15)) : S.clamp(Math.round(M.dur), MIN_CLIP, P);
                M.track = Object.assign({}, r, { startSec: 0, clipSec: clip });
                M.spotify = null; M.results = []; M.msg = ''; M.changing = false;
                renderSheet(); renderPv(); playClip(); renderSheet(); break;
            }
            case 'clipLen': if (M.track) { const P = trkLen(M.track); M.track.clipSec = Math.min(Number(v), P); setStart(M.track.startSec); renderSheet(); renderPv(); if (M.playing === 'clip') playClip(); } break;
            case 'playClip': toggleClip(); break;
            case 'changeSong': stopAudio(); M.changing = true; M.results = []; M.msg = ''; renderSheet(); break;
            case 'keepSong': stopAudio(); M.changing = false; renderSheet(); break;
            case 'rmTrack': stopAudio(); ytDrop(); M.track = null; M.changing = false; renderSheet(); renderPv(); break;
            case 'spotifyGo': spotifyGo(); break;
            case 'rmSpotify': M.spotify = null; renderSheet(); renderPv(); break;
            case 'publish': publish(); break;
        }
    }

    // ------------------------------------------------------------ music: in-site search + optional Spotify link
    function selectYt(r) {
        stopAudio();
        M.track = Object.assign({}, r, { provider: 'youtube', startSec: 0, clipSec: 15, durationSec: 0 });
        M.spotify = null; M.results = []; M.msg = ''; M.changing = false;
        ytAttach(M.track); renderSheet(); renderPv();
    }
    async function ytFromLink(id) {
        M.searching = true; M.msg = 'Checking the video…'; renderSheet();
        let info = { title: 'YouTube video', artist: '' };
        try { info = await S.ytInfo(id); }
        catch (e) {
            if (e.code === 'embed' || e.code === 'gone') {
                M.searching = false; M.msg = e.code === 'gone' ? 'That video was removed or is private.' : 'The owner doesn’t allow that video to be played outside YouTube. Try another version of the song.';
                renderSheet(); return;
            }                                                    // network/CORS hiccup: carry on, the player will report real problems
        }
        M.searching = false; M.msg = '';
        selectYt({ provider: 'youtube', videoId: id, trackId: id, title: info.title, artist: info.artist, thumbnail: S.ytThumb(id) });
    }
    async function musicSearch() {
        const term = (M.query || '').trim();
        if (M.searching) return;
        if (term.length < 2) { M.msg = 'Type at least 2 characters.'; renderSheet(); return; }
        stopAudio(); M.results = []; M.msg = '';
        const id = S.ytId(term);
        if (id) { ytFromLink(id); return; }
        if (/youtu/i.test(term) && /^(https?:\/\/|www\.)/i.test(term)) { M.msg = 'That doesn’t look like a valid YouTube video link.'; renderSheet(); return; }
        M.searching = true; renderSheet();
        let note = '';
        if (ytKey()) {
            try { M.results = await S.searchYouTube(term, ytKey()); if (!M.results.length) note = 'No full songs found; showing 30-second previews instead.'; }
            catch (e) {
                note = e.code === 'quota' ? 'YouTube search has hit its daily limit. Paste a YouTube link for a full song, or pick a 30-second preview.'
                    : e.code === 'key' ? 'YouTube search isn’t available right now. Paste a YouTube link for a full song, or pick a 30-second preview.'
                    : 'Couldn’t reach YouTube. Paste a link for a full song, or pick a 30-second preview.';
            }
        } else note = 'Showing 30-second previews. Paste a YouTube link to use a full song.';
        if (!M.results.length) {                                 // fallback: Apple/iTunes 30 s previews
            try { M.results = await S.searchMusic(term); } catch (e) { note = note || 'Song search is unavailable right now. Check your connection and try again.'; }
            if (!M.results.length && !note) note = 'No songs found. Try the artist name or a different spelling.';
        }
        M.msg = note; M.searching = false; renderSheet();
        const inp = $('[data-in=music]'); if (inp && !M.results.length) inp.focus({ preventScroll: true });
    }
    function spotifyId(v) {
        v = (v || '').trim();
        let m = v.match(/^spotify:track:([A-Za-z0-9]{22})$/); if (m) return m[1];
        try { const u = new URL(v); if (u.hostname !== 'open.spotify.com') return null; m = u.pathname.match(/\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/); return m ? m[1] : null; } catch (e) { return null; }
    }
    async function spotifyGo() {
        const val = (M.spq || '').trim(); if (!val) return;
        const id = spotifyId(val);
        if (!id) { M.msg = 'That doesn’t look like a Spotify track link. Open a song in Spotify → Share → Copy link.'; renderSheet(); return; }
        M.msg = 'Looking up…'; renderSheet();
        const url = 'https://open.spotify.com/track/' + id;
        let title = 'Spotify track', thumbnail = '';
        try {
            const r = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(url));
            if (r.ok) { const j = await r.json(); title = String(j.title || title).slice(0, 120); thumbnail = S.safeImgUrl(j.thumbnail_url) || ''; }
        } catch (e) { /* oEmbed unreachable: keep link-only card */ }
        stopAudio(); ytDrop(); M.track = null; M.changing = false; M.spq = '';
        M.spotify = { trackId: id, url, title, artist: '', thumbnail }; M.msg = '';
        renderSheet(); renderPv();
    }

    // ------------------------------------------------------------ publish
    const ymd = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    function upload(file, onProg) {
        return new Promise((res, rej) => {
            const fd = new FormData();
            fd.append('file', file); fd.append('upload_preset', C.cfg.uploadPreset); fd.append('folder', 't-imawa/stories');
            fd.append('tags', 'story,expires_' + ymd(Date.now() + 86400000));
            const x = new XMLHttpRequest(); M.xhr = x;
            x.open('POST', `https://api.cloudinary.com/v1_1/${C.cfg.cloudName}/auto/upload`);
            x.upload.onprogress = e => { if (e.lengthComputable) onProg(e.loaded / e.total); };
            x.onload = () => {
                let j = {}; try { j = JSON.parse(x.responseText); } catch (e) { /* ignore */ }
                x.status === 200 ? res(j) : rej(new Error((j.error && j.error.message) || 'Upload failed (' + x.status + ')'));
            };
            x.onerror = () => rej(new Error('Network error during upload'));
            x.onabort = () => rej(new Error('cancelled'));
            x.send(fd);
        });
    }
    // Best-effort cleanup if something fails after media was uploaded (unsigned presets return a short-lived delete_token).
    async function discardUploads(list) {
        for (const up of list) {
            try {
                if (!up || !up.delete_token) continue;
                const fd = new FormData(); fd.append('token', up.delete_token);
                await fetch(`https://api.cloudinary.com/v1_1/${C.cfg.cloudName}/delete_by_token`, { method: 'POST', body: fd });
            } catch (e) { /* orphan is swept by the expires_ tag job (see STORIES_SETUP.md) */ }
        }
    }
    async function publish() {
        if (M.busy || !hasMedia()) return;
        if (M.track && M.track.provider === 'youtube' && !M.track.durationSec) { C.toast('The song is still loading. Try again in a moment.', 'info'); return; }
        if (M.texts.some(t => !t.text)) M.texts = M.texts.filter(t => t.text);
        stopAudio(); M.busy = true; M.preview = false; M.sheet = null; renderPv(); renderSheet();
        q.bar.hidden = false; q.barI.style.width = '3%';
        const ups = [];
        try {
            const files = M.video ? [M.video.file] : M.items.map(i => i.file);
            for (let i = 0; i < files.length; i++) {
                ups.push(await upload(files[i], p => { q.barI.style.width = Math.max(3, Math.round(((i + p) / files.length) * 92)) + '%'; }));
            }
            const urls = ups.map(u => S.safeMediaUrl(u.secure_url));
            if (urls.some(u => !u)) throw new Error('Unexpected upload response');
            const first = ups[0], url = urls[0];
            const isV = first.resource_type === 'video';
            const thumb = isV ? url.replace('/video/upload/', '/video/upload/so_0,w_480,h_854,c_fill,f_jpg/').replace(/\.[a-z0-9]+$/i, '.jpg') : url.replace('/image/upload/', '/image/upload/w_480,q_auto,f_auto/');
            const ref = C.db.collection('stories').doc();
            const exp = firebase.firestore.Timestamp.fromMillis((C.now ? C.now() : Date.now()) + S.DURATION_MS);
            const multi = !isV && ups.length > 1;
            const vSec = Math.min(MAX_DUR, first.duration || (M.video && M.video.dur) || 0);
            const doc = {
                ownerUid: C.me.uid, ownerName: C.me.name, ownerPhoto: C.me.photo || '',
                mediaType: isV ? 'video' : 'image', mediaUrl: url, mediaPublicId: first.public_id || '', thumbUrl: S.safeMediaUrl(thumb),
                mediaFit: M.fit, mediaW: first.width || 0, mediaH: first.height || 0,
                // how long the story plays: video = its own length; photos = the music clip (if any) or the chosen 15-60 s
                durationMs: isV ? Math.round(vSec * 1000) : Math.round(storyDur() * 1000),
                caption: M.caption.trim().slice(0, MAX_CAPTION),
                textOverlays: M.texts.slice(0, MAX_TEXTS).map(t => ({ id: t.id, text: t.text.slice(0, MAX_TEXT_LEN), x: +t.x.toFixed(4), y: +t.y.toFixed(4), size: +t.size.toFixed(4), rot: Math.round(t.rot), font: t.font, color: t.color, bg: t.bg, bgColor: t.bgColor, align: t.align, bold: !!t.bold, italic: !!t.italic })),
                spotifyTrack: M.spotify ? { trackId: M.spotify.trackId, url: M.spotify.url, title: M.spotify.title, artist: (M.spotify.artist || '').slice(0, 80), thumbnail: M.spotify.thumbnail || '' } : null,
                music: M.track && M.track.provider === 'youtube' ? { provider: 'youtube', videoId: M.track.videoId, title: String(M.track.title || '').slice(0, 120), artist: (M.track.artist || '').slice(0, 80), thumbnail: S.ytThumb(M.track.videoId), durationSec: Math.round(M.track.durationSec), startSec: M.track.startSec, clipSec: M.track.clipSec }
                    : M.track ? { provider: 'itunes', trackId: M.track.trackId, title: M.track.title, artist: (M.track.artist || '').slice(0, 80), thumbnail: M.track.thumbnail || '', previewUrl: M.track.previewUrl, previewSec: M.track.previewSec || 30, startSec: M.track.startSec, clipSec: M.track.clipSec } : null,
                muteVideo: !!(isV && M.track),          // music added to a video mutes the video's audio
                mediaPublicIds: ups.map(u => u.public_id || '').filter(Boolean),
                status: 'active',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: exp
            };
            if (multi) { doc.mediaItems = ups.map((u, i) => ({ url: urls[i], w: u.width || 0, h: u.height || 0 })); doc.layout = S.getLayout(M.layout, ups.length).id; }
            q.barI.style.width = '96%';
            try { await ref.set(doc); }
            catch (we) { await discardUploads(ups); throw we; }
            try { const s = await ref.get({ source: 'server' }); const c = s.data().createdAt; if (c && c.toMillis) C.onPublished(c.toMillis() - Date.now()); } catch (e) { /* skew is optional */ }
            q.barI.style.width = '100%';
            C.toast('Story shared! It will disappear in 24 hours.', 'success');
            M.busy = false; closeNow();
        } catch (e) {
            if (!e.code) await discardUploads(ups);
            M.busy = false; q.bar.hidden = true;
            if (e.message === 'cancelled') { renderSheet(); return; }
            console.warn('publish failed', e);
            C.toast(e.code === 'permission-denied' ? 'Couldn’t publish. Check that you’re signed in and your device clock/time zone is correct.' : ('Couldn’t publish: ' + e.message), 'error');
            renderSheet();
        }
    }

    window.StoriesComposer = { open };
})();