/* ================================================================
   stories-shared.js  ·  TIMAWA / Barkada Stories   (v1.4)
   Tiny shared layer used by the viewer, composer and admin preview:
   - font stack + lazy Google Fonts loader (OFL-licensed families)
   - text-overlay rendering from STRUCTURED data (normalized coords)
   - photo-collage layout presets (images only)
   - in-site song search: YouTube (full songs, official IFrame player) with iTunes
     30-second previews as fallback, plus a clip looper
   - URL / colour sanitisers
   The same renderer draws the composer preview, the viewer and the
   admin preview, so what you see while editing is what gets published.
   ================================================================ */
(function () {
    'use strict';
    if (window.StoriesShared) return;

    // Curated, readable font stacks. Families are Google Fonts (SIL OFL).
    const FONTS = {
        modern:  { label: 'Modern', css: "'Poppins',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", normal: 500, bold: 800 },
        display: { label: 'Bold',   css: "'Bebas Neue',Impact,'Arial Narrow',sans-serif",                  normal: 400, bold: 400, upper: true },
        hand:    { label: 'Hand',   css: "'Caveat','Segoe Script','Bradley Hand',cursive",                 normal: 600, bold: 700 },
        serif:   { label: 'Serif',  css: "'Playfair Display',Georgia,'Times New Roman',serif",             normal: 600, bold: 800 }
    };
    const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@600;700&family=Playfair+Display:ital,wght@0,600;0,800;1,600;1,800&family=Poppins:ital,wght@0,500;0,800;1,500;1,800&display=swap';

    let fontsLoaded = false;
    function loadFonts() {
        if (fontsLoaded) return;
        fontsLoaded = true;
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = FONTS_HREF;
        document.head.appendChild(l);
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Only allow https media from our Cloudinary account (defence in depth).
    function safeMediaUrl(u) {
        try {
            const x = new URL(u);
            return (x.protocol === 'https:' && x.hostname === 'res.cloudinary.com') ? x.href : '';
        } catch (e) { return ''; }
    }
    function safeSpotifyUrl(u) {
        try {
            const x = new URL(u);
            return (x.protocol === 'https:' && x.hostname === 'open.spotify.com') ? x.href : '';
        } catch (e) { return ''; }
    }
    // artwork: Cloudinary, Spotify CDN or Apple (iTunes) artwork CDN
    function safeImgUrl(u) {
        try {
            const x = new URL(u);
            return (x.protocol === 'https:' && (x.hostname === 'res.cloudinary.com' || /(^|\.)scdn\.co$/.test(x.hostname) || /(^|\.)spotifycdn\.com$/.test(x.hostname) || /(^|\.)mzstatic\.com$/.test(x.hostname) || x.hostname === 'i.ytimg.com')) ? x.href : '';
        } catch (e) { return ''; }
    }
    // 30-second song previews served by Apple's CDN (never re-hosted by us)
    function safeAudioUrl(u) {
        try {
            const x = new URL(u);
            return (x.protocol === 'https:' && /(^|\.)(mzstatic\.com|itunes\.apple\.com)$/.test(x.hostname)) ? x.href : '';
        } catch (e) { return ''; }
    }
    function safeColor(c, fb) { return /^#[0-9a-f]{6}$/i.test(c || '') ? c : (fb || '#ffffff'); }
    function rgba(hex, a) {
        const h = safeColor(hex, '#000000');
        return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
    }
    const clamp = (n, a, b) => Math.min(b, Math.max(a, Number(n) || 0));

    // Safe vertical band (fractions) so text never sits under the header or reply bar.
    const SAFE = { xMin: 0.1, xMax: 0.9, yMin: 0.14, yMax: 0.8 };

    function textStyle(t) {
        const f = FONTS[t.font] || FONTS.modern;
        const bg = t.bg || 'none';
        const col = safeColor(t.color, '#ffffff');
        const bgc = safeColor(t.bgColor, '#000000');
        const align = ['left', 'center', 'right'].includes(t.align) ? t.align : 'center';
        let s = `left:${(clamp(t.x, 0, 1) * 100).toFixed(2)}%;top:${(clamp(t.y, 0, 1) * 100).toFixed(2)}%;` +
            `font-family:${f.css};font-size:calc(var(--stw,360px)*${clamp(t.size || 0.07, 0.03, 0.2).toFixed(4)});` +
            `color:${col};text-align:${align};font-weight:${t.bold ? f.bold : f.normal};font-style:${t.italic ? 'italic' : 'normal'};` +
            `transform:translate(-50%,-50%) rotate(${clamp(t.rot, -180, 180).toFixed(1)}deg);`;
        if (f.upper) s += 'text-transform:uppercase;letter-spacing:.04em;';
        if (bg === 'semi') s += `background:${rgba(bgc, 0.58)};`;
        else if (bg === 'solid' || bg === 'pill') s += `background:${bgc};`;
        else s += 'text-shadow:0 1px 2px rgba(0,0,0,.55),0 2px 14px rgba(0,0,0,.45);';
        return s;
    }
    function textHtml(t, extraClass, attrs) {
        const bg = ['none', 'semi', 'solid', 'pill'].includes(t.bg) ? t.bg : 'none';
        return `<div class="st-t st-t-${bg} ${extraClass || ''}" ${attrs || ''} style="${textStyle(t)}">${esc(t.text || '')}</div>`;
    }
    function renderTexts(container, overlays) {
        if (!container) return;
        container.innerHTML = (Array.isArray(overlays) ? overlays.slice(0, 8) : []).map(t => textHtml(t)).join('');
    }

    // Keeps --stw (stage width in px) in sync so text scales with the canvas.
    function observeStage(stage) {
        const set = () => stage.style.setProperty('--stw', stage.clientWidth + 'px');
        set();
        if (!('ResizeObserver' in window)) { window.addEventListener('resize', set); return () => window.removeEventListener('resize', set); }
        const ro = new ResizeObserver(set);
        ro.observe(stage);
        return () => ro.disconnect();
    }

    function timeAgo(ms) {
        const m = Math.floor((Date.now() - ms) / 60000);
        if (m < 1) return 'now';
        if (m < 60) return m + 'm';
        return Math.floor(m / 60) + 'h';
    }
    function cloudAvatar(url, size) {
        if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url || '';
        const after = url.split('/upload/')[1] || '';
        if (/^[a-z]_/.test(after) || /^[a-z]+,[a-z]/.test(after)) return url;
        return url.replace('/upload/', `/upload/w_${size},h_${size},c_fill,g_face,q_auto:good,f_auto/`);
    }
    // Resize a Cloudinary image on the fly (used for collage cells). Non-Cloudinary / blob URLs pass through.
    function cloudResize(url, w) {
        if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url || '';
        const after = url.split('/upload/')[1] || '';
        if (/^[a-z]{1,2}_/.test(after) || /^[a-z]+,[a-z]/.test(after)) return url;
        return url.replace('/upload/', `/upload/w_${w},q_auto,f_auto/`);
    }
    const fmtSec = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

    // ------------------------------------------------------------ collage layouts (images only)
    // cells = [x, y, w, h] as fractions of the story frame.
    function grid(c, r, n) {
        const cells = [];
        for (let i = 0; i < n; i++) cells.push([(i % c) / c, Math.floor(i / c) / r, 1 / c, 1 / r]);
        return cells;
    }
    const LAYOUTS = [
        { id: 'full', n: 1, label: 'Full', cells: [[0, 0, 1, 1]] },
        { id: 'v2', n: 2, label: 'Stacked', cells: grid(1, 2, 2) },
        { id: 'h2', n: 2, label: 'Side by side', cells: grid(2, 1, 2) },
        { id: 'w2', n: 2, label: 'Big + small', cells: [[0, 0, 1, 0.64], [0, 0.64, 1, 0.36]] },
        { id: 'r3', n: 3, label: 'Rows', cells: grid(1, 3, 3) },
        { id: 'c3', n: 3, label: 'Columns', cells: grid(3, 1, 3) },
        { id: 't1b2', n: 3, label: 'Top feature', cells: [[0, 0, 1, 0.56], [0, 0.56, 0.5, 0.44], [0.5, 0.56, 0.5, 0.44]] },
        { id: 'l1r2', n: 3, label: 'Side feature', cells: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]] },
        { id: 'g4', n: 4, label: 'Grid', cells: grid(2, 2, 4) },
        { id: 't1b3', n: 4, label: 'Top feature', cells: [[0, 0, 1, 0.5], [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5]] },
        { id: 'l1r3', n: 4, label: 'Side feature', cells: [[0, 0, 0.62, 1], [0.62, 0, 0.38, 1 / 3], [0.62, 1 / 3, 0.38, 1 / 3], [0.62, 2 / 3, 0.38, 1 / 3]] },
        { id: 'r4', n: 4, label: 'Rows', cells: grid(1, 4, 4) },
        { id: 't2b3', n: 5, label: '2 + 3', cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5]] },
        { id: 't1b4', n: 5, label: '1 + 4', cells: [[0, 0, 1, 0.4], [0, 0.4, 0.5, 0.3], [0.5, 0.4, 0.5, 0.3], [0, 0.7, 0.5, 0.3], [0.5, 0.7, 0.5, 0.3]] },
        { id: 'g6', n: 6, label: '2 × 3', cells: grid(2, 3, 6) },
        { id: 'g6b', n: 6, label: '3 × 2', cells: grid(3, 2, 6) }
    ];
    const MAX_PHOTOS = 6;
    const layoutsFor = n => LAYOUTS.filter(l => l.n === n);
    function getLayout(id, n) {
        const list = layoutsFor(Math.max(1, Math.min(MAX_PHOTOS, n)));
        return list.find(l => l.id === id) || list[0];
    }
    const pc = v => (v * 100).toFixed(3) + '%';
    // items: [{url}] ; allowBlob lets the composer preview local files
    function collageHtml(items, layoutId, allowBlob) {
        const list = (items || []).slice(0, MAX_PHOTOS);
        const L = getLayout(layoutId, list.length);
        return L.cells.map((c, i) => {
            const it = list[i]; if (!it) return '';
            let u = safeMediaUrl(it.url);
            if (!u && allowBlob && /^blob:/.test(it.url || '')) u = it.url;
            if (!u) return '';
            return `<div class="st-cell" style="left:${pc(c[0])};top:${pc(c[1])};width:${pc(c[2])};height:${pc(c[3])}"><img src="${esc(cloudResize(u, 720))}" alt="" draggable="false"></div>`;
        }).join('');
    }
    function miniLayoutHtml(L) {
        return '<span class="m">' + L.cells.map(c => `<i style="left:${pc(c[0])};top:${pc(c[1])};width:${pc(c[2])};height:${pc(c[3])}"></i>`).join('') + '</span>';
    }

    // ------------------------------------------------------------ music (iTunes Search API: free, no key, CORS-enabled)
    // Gives 30-second previews that can be played directly in an <audio> element,
    // which is what makes auto-play + "choose the part of the song" possible.
    // fetch first; if the browser blocks it (CORS / extension / network policy) fall back to JSONP (script tag)
    let jsonpN = 0;
    function itunesJsonp(url) {
        return new Promise((res, rej) => {
            const cb = '__stItunes' + (++jsonpN) + '_' + Date.now(), sc = document.createElement('script');
            const done = () => { clearTimeout(t); delete window[cb]; sc.remove(); };
            const t = setTimeout(() => { done(); rej(new Error('timeout')); }, 9000);
            window[cb] = d => { done(); res(d); };
            sc.onerror = () => { done(); rej(new Error('blocked')); };
            sc.src = url + '&callback=' + cb;
            document.head.appendChild(sc);
        });
    }
    async function itunesQuery(url) {
        try {
            const r = await fetch(url);
            if (!r.ok) throw new Error('search ' + r.status);
            return await r.json();
        } catch (e) { return itunesJsonp(url); }
    }
    async function searchMusic(term) {
        const base = 'https://itunes.apple.com/search?media=music&entity=song&limit=15&term=' + encodeURIComponent(term);
        const rs = await Promise.allSettled(['US', 'PH'].map(c => itunesQuery(base + '&country=' + c)));
        if (rs.every(r => r.status === 'rejected')) throw new Error('search failed');
        const seen = new Set(), out = [];
        const lists = rs.map(r => r.status === 'fulfilled' ? (r.value.results || []) : []);
        const max = Math.max(...lists.map(l => l.length));
        for (let i = 0; i < max; i++) lists.forEach(l => {
            const x = l[i]; if (!x) return;
            const prev = safeAudioUrl(x.previewUrl);
            if (!prev || !x.trackId) return;
            const key = (String(x.trackName) + '|' + String(x.artistName)).toLowerCase();
            if (seen.has(key)) return; seen.add(key);
            out.push({
                provider: 'itunes', trackId: String(x.trackId).slice(0, 20), title: String(x.trackName || 'Untitled').slice(0, 120), artist: String(x.artistName || '').slice(0, 80),
                thumbnail: safeImgUrl(String(x.artworkUrl100 || '').replace('100x100', '300x300')) || '', previewUrl: prev, previewSec: 30
            });
        });
        return out.slice(0, 20);
    }
    // Validates a music object read back from Firestore (never trust stored data blindly).
    function cleanMusic(m) {
        if (!m || typeof m !== 'object') return null;
        if (m.provider === 'youtube') {
            if (!YT_ID.test(String(m.videoId || ''))) return null;
            const id = String(m.videoId), dur = clamp(m.durationSec || 0, 0, 43200);
            const clipSec = clamp(m.clipSec || 15, 1, 60);
            const startSec = dur ? clamp(m.startSec, 0, Math.max(0, dur - clipSec)) : clamp(m.startSec, 0, 43200);
            return {
                provider: 'youtube', videoId: id, trackId: id, title: String(m.title || 'YouTube video').slice(0, 120),
                artist: String(m.artist || m.channel || '').slice(0, 80), thumbnail: ytThumb(id), durationSec: dur, startSec, clipSec
            };
        }
        const url = safeAudioUrl(m.previewUrl);
        if (!url) return null;
        const previewSec = clamp(m.previewSec || 30, 5, 30);
        const startSec = clamp(m.startSec, 0, previewSec - 5);
        const clipSec = clamp(m.clipSec || 15, 5, previewSec - startSec);
        return {
            provider: 'itunes', trackId: String(m.trackId || '').slice(0, 20), title: String(m.title || 'Song').slice(0, 120), artist: String(m.artist || '').slice(0, 80),
            thumbnail: safeImgUrl(m.thumbnail) || '', previewUrl: url, previewSec, startSec, clipSec
        };
    }
    // Loops an <audio> element between start and end (seconds). Returns a detach function.
    function attachClipLoop(audio, start, end) {
        const back = () => { try { audio.currentTime = start; } catch (e) { /* not seekable yet */ } };
        const onEnded = () => { back(); audio.play().catch(() => {}); };
        const timer = setInterval(() => { if (!audio.paused && audio.currentTime >= end - 0.05) back(); }, 100);
        audio.addEventListener('ended', onEnded);
        return () => { clearInterval(timer); audio.removeEventListener('ended', onEnded); };
    }


    // ------------------------------------------------------------ YouTube: full-length songs (official IFrame Player API only)
    // We never download or re-host audio: the song plays inside YouTube's own embedded player, which stays visible.
    const YT_ID = /^[A-Za-z0-9_-]{11}$/;
    const ytThumb = id => 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
    // watch / youtu.be / shorts / embed / live / music.youtube.com  ->  11-char video id (or null)
    function ytId(v) {
        v = String(v || '').trim();
        if (!/youtu/i.test(v)) return null;
        try {
            const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
            const h = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
            let id = '';
            if (h === 'youtu.be') id = u.pathname.split('/')[1] || '';
            else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
                if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
                else { const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/); id = m ? m[1] : ''; }
            }
            return YT_ID.test(id) ? id : null;
        } catch (e) { return null; }
    }
    // The IFrame API script is loaded lazily and only once, however many callers ask for it.
    let ytLoad = null;
    function loadYT() {
        if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
        if (ytLoad) return ytLoad;
        ytLoad = new Promise((res, rej) => {
            const prev = window.onYouTubeIframeAPIReady;
            const timer = setTimeout(() => { ytLoad = null; rej(new Error('youtube api timeout')); }, 15000);
            window.onYouTubeIframeAPIReady = function () { clearTimeout(timer); try { if (typeof prev === 'function') prev(); } catch (e) { /* ignore */ } res(window.YT); };
            if (!document.querySelector('script[src^="https://www.youtube.com/iframe_api"]')) {
                const sc = document.createElement('script');
                sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true;
                sc.onerror = () => { clearTimeout(timer); ytLoad = null; rej(new Error('youtube api blocked')); };
                document.head.appendChild(sc);
            }
        });
        return ytLoad;
    }
    // Small adapter around YT.Player: ready/playing/seek/pos/mute. o = { start, onReady, onState, onError }
    // onError gets the YouTube error code (2, 5, 100, 101, 150) or -1 when the API itself could not load.
    function ytPlayer(host, videoId, o) {
        o = o || {};
        const ad = { kind: 'yt', p: null, ready: false, state: -1, err: 0, dead: false, tol: 0.9, hold: 1200, seekAt: 0, videoId };
        const fail = c => { if (ad.dead || ad.err) return; ad.err = c || -1; if (o.onError) o.onError(ad.err); };
        loadYT().then(YT => {
            if (ad.dead) return;
            const slot = document.createElement('div'); host.appendChild(slot);
            ad.p = new YT.Player(slot, {
                videoId, width: '100%', height: '100%',
                playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, origin: location.origin, start: Math.max(0, Math.floor(o.start || 0)) },
                events: {
                    onReady: () => { if (ad.dead) return; ad.ready = true; if (o.onReady) o.onReady(ad); },
                    onStateChange: e => { ad.state = e.data; if (o.onState) o.onState(e.data, ad); },
                    onError: e => fail(e && e.data)
                }
            });
        }).catch(() => fail(-1));
        const call = (fn, a, b) => { try { return ad.p && typeof ad.p[fn] === 'function' ? ad.p[fn](a, b) : undefined; } catch (e) { return undefined; } };
        Object.assign(ad, {
            isReady: () => ad.ready && !ad.err,
            // resolves true only if it really started (false = the browser blocked autoplay)
            play() { call('playVideo'); return new Promise(res => setTimeout(() => res(ad.playing()), 1300)); },
            pause() { call('pauseVideo'); },
            seek(sec) { ad.seekAt = performance.now(); call('seekTo', Math.max(0, sec), true); },
            pos() { return Number(call('getCurrentTime')) || 0; },
            duration() { return Number(call('getDuration')) || 0; },
            setMuted(b) { call(b ? 'mute' : 'unMute'); },
            playing() { return ad.state === 1 || ad.state === 3; },
            destroy() { ad.dead = true; try { if (ad.p && ad.p.destroy) ad.p.destroy(); } catch (e) { /* ignore */ } ad.p = null; }
        });
        return ad;
    }
    function decodeEnt(t) { const x = document.createElement('textarea'); x.innerHTML = String(t || ''); return x.value; }
    // YouTube Data API v3 search.list (music category, embeddable only). err.code: nokey | quota | key | net
    async function searchYouTube(term, key) {
        const bad = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
        if (!key) throw bad('nokey');
        const qs = new URLSearchParams({ part: 'snippet', type: 'video', videoCategoryId: '10', videoEmbeddable: 'true', videoSyndicated: 'true', maxResults: '12', q: term, key });
        let r; try { r = await fetch('https://www.googleapis.com/youtube/v3/search?' + qs); } catch (e) { throw bad('net'); }
        let j = {}; try { j = await r.json(); } catch (e) { /* not json */ }
        if (!r.ok) {
            const reason = String((((j.error || {}).errors || [])[0] || {}).reason || '');
            throw bad(/quota|rateLimit|dailyLimit/i.test(reason) ? 'quota' : (r.status === 400 || r.status === 403) ? 'key' : 'net', reason || ('http ' + r.status));
        }
        return (j.items || []).map(it => {
            const id = it && it.id && it.id.videoId, sn = (it && it.snippet) || {};
            if (!YT_ID.test(String(id || ''))) return null;
            return { provider: 'youtube', videoId: id, trackId: id, title: decodeEnt(sn.title).slice(0, 120), artist: decodeEnt(sn.channelTitle).slice(0, 80), thumbnail: ytThumb(id), durationSec: 0 };
        }).filter(Boolean);
    }
    // oEmbed tells us the title/channel and, via 401/403, that the owner blocked embedding. err.code: embed | gone | net
    async function ytInfo(id) {
        const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
        if (!r.ok) { const e = new Error('oembed ' + r.status); e.code = (r.status === 401 || r.status === 403) ? 'embed' : r.status === 404 ? 'gone' : 'net'; throw e; }
        const j = await r.json();
        return { title: decodeEnt(j.title).slice(0, 120) || 'YouTube video', artist: decodeEnt(j.author_name).slice(0, 80) };
    }

    window.StoriesShared = {
        FONTS, SAFE, LAYOUTS, MAX_PHOTOS, loadFonts, esc, clamp, safeMediaUrl, safeSpotifyUrl, safeImgUrl, safeAudioUrl, safeColor, rgba,
        textStyle, textHtml, renderTexts, observeStage, timeAgo, cloudAvatar, cloudResize, fmtSec,
        layoutsFor, getLayout, collageHtml, miniLayoutHtml, searchMusic, cleanMusic, attachClipLoop,
        ytId, ytThumb, loadYT, ytPlayer, searchYouTube, ytInfo,
        DURATION_MS: 24 * 60 * 60 * 1000,          // how long a story stays available (expiry)
        MIN_SHOW_MS: 15 * 1000, MAX_SHOW_MS: 60 * 1000   // how long a story plays for viewers
    };
})();