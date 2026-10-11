/* ================================================================
   theme.js
   TIMAWA — Shared theme system
   Loaded SYNCHRONOUSLY in <head> after theme.css, before page render.

   ★ v6 ★ Matches theme.css (modern depth layer: atmosphere, particles, colour grade).
   - NEW: soft scene cross-fade on theme switch, color-scheme sync, stricter lite-mode detection.
   ★ v5 ★ Matches theme.css.
   - THEME_SHAPES: every theme is a new scene, except forest / sakura / aurora
     (same concept, upgraded). Shapes are plain divs + tiny inline SVG.
   - Palettes (THEMES.light / THEMES.dark) are UNCHANGED; only the short `sub`
     taglines were reworded to describe the new scenes.
   - NEW (perf): animations pause while the tab is hidden (html[data-tw-paused])
     and are switched off on low-end / data-saver devices (html[data-tw-lite]).
   - applyTheme, storage, sync: UNCHANGED.
   ================================================================ */

(function () {
    'use strict';

    window.THEME_STORAGE_KEY = 'timawa_theme';
    window.THEME_EVENT = 'timawa-theme-change';

    window.THEME_SHAPES = {

        // ★ OCEAN — "Deep Dive"
        ocean: `
            <div class="shape oc-rays"></div>
            <div class="shape oc-whale"><svg viewBox="0 0 400 170"><path class="wb" d="M8 96C30 44 120 16 214 42C262 56 300 82 346 90C358 70 376 46 396 34C398 60 392 80 380 96C392 112 398 134 398 156C376 146 358 120 346 106C300 118 250 134 200 138C120 146 40 142 8 96Z"/><path class="wl" d="M20 104C80 126 180 134 250 126C290 120 320 108 346 106C310 118 250 140 190 142C110 146 44 134 20 104Z"/><path class="wb" d="M140 124C150 148 172 160 196 162C186 146 180 134 178 126Z"/><circle class="we" cx="48" cy="90" r="3.4"/></svg></div>
            <svg class="shape oc-jelly opt" viewBox="0 0 60 110"><path d="M8 42C8 8 52 8 52 42Z"/><path class="t" d="M16 44C12 64 20 70 15 96M26 44C24 66 32 74 27 104M36 44C38 66 30 72 35 100M45 44C48 62 40 72 46 92"/></svg>
            <div class="shape oc-bubbles"></div>
            <svg class="shape oc-kelp k1" viewBox="0 0 100 300" preserveAspectRatio="xMinYMax meet"><path d="M22 300C8 250 36 214 20 168S34 88 24 30"/><path class="b" d="M50 300C40 262 64 232 52 190S62 120 54 84"/><path d="M76 300C68 270 84 248 76 214S84 170 80 150"/></svg>
            <svg class="shape oc-kelp k2" viewBox="0 0 100 300" preserveAspectRatio="xMaxYMax meet"><path d="M30 300C20 262 44 230 32 192S44 124 36 90"/><path class="b" d="M62 300C52 250 80 214 64 164S74 78 66 36"/></svg>
            <div class="shape oc-floor"></div>
        `,

        // ★ SUNSET — "Savanna Sunset"
        sunset: `
            <div class="shape sy-glow"></div>
            <div class="shape sy-sun"></div>
            <svg class="shape sy-birds" viewBox="0 0 160 60"><path d="M4 20Q10 10 16 20Q22 10 28 20M44 8Q50 -2 56 8Q62 -2 68 8M70 34Q76 24 82 34Q88 24 94 34M104 16Q110 6 116 16Q122 6 128 16M130 42Q136 32 142 42Q148 32 154 42"/></svg>
            <div class="shape sy-ground"></div>
            <svg class="shape sy-tree t2" viewBox="0 0 160 124"><path d="M6 40Q30 20 80 24Q130 20 154 40Q120 52 80 46Q40 52 6 40ZM76 46Q80 74 70 120H88Q84 76 84 46ZM80 64Q60 54 38 46L36 50Q60 60 78 72Z"/></svg>
            <svg class="shape sy-tree t1" viewBox="0 0 160 124"><path d="M6 40Q30 20 80 24Q130 20 154 40Q120 52 80 46Q40 52 6 40ZM76 46Q80 74 70 120H88Q84 76 84 46ZM80 64Q60 54 38 46L36 50Q60 60 78 72Z"/></svg>
            <svg class="shape sy-tree t3 opt" viewBox="0 0 160 124"><path d="M6 40Q30 20 80 24Q130 20 154 40Q120 52 80 46Q40 52 6 40ZM76 46Q80 74 70 120H88Q84 76 84 46ZM80 64Q60 54 38 46L36 50Q60 60 78 72Z"/></svg>
            <div class="shape sy-grass"></div>
        `,

        // ★ PINK — "Balloon Sky"
        pink: `
            <div class="shape bl-sparkle"></div>
            <div class="shape bl-b b1"><svg viewBox="0 0 60 92"><path class="a" d="M30 2C8 2 2 24 12 42C18 52 24 58 24 62H36C36 58 42 52 48 42C58 24 52 2 30 2Z"/><path class="b" d="M30 2C20 18 20 48 24 62H36C40 48 40 18 30 2Z"/><path class="r" d="M24 62L27 76M36 62L33 76"/><rect class="k" x="26" y="76" width="8" height="7" rx="1.5"/></svg></div>
            <div class="shape bl-b b2"><svg viewBox="0 0 60 92"><path class="a" d="M30 2C8 2 2 24 12 42C18 52 24 58 24 62H36C36 58 42 52 48 42C58 24 52 2 30 2Z"/><path class="b" d="M30 2C20 18 20 48 24 62H36C40 48 40 18 30 2Z"/><path class="r" d="M24 62L27 76M36 62L33 76"/><rect class="k" x="26" y="76" width="8" height="7" rx="1.5"/></svg></div>
            <div class="shape bl-b b3 opt"><svg viewBox="0 0 60 92"><path class="a" d="M30 2C8 2 2 24 12 42C18 52 24 58 24 62H36C36 58 42 52 48 42C58 24 52 2 30 2Z"/><path class="b" d="M30 2C20 18 20 48 24 62H36C40 48 40 18 30 2Z"/><path class="r" d="M24 62L27 76M36 62L33 76"/><rect class="k" x="26" y="76" width="8" height="7" rx="1.5"/></svg></div>
            <div class="shape bl-clouds back"></div>
            <div class="shape bl-clouds"></div>
        `,

        // ★ FOREST — "Canopy Window (upgraded)"
        forest: `

            <div class="shape forest-glow"></div>
            <div class="shape forest-ridge r1"></div>
            <div class="shape forest-ridge r2"></div>
            <div class="shape forest-mist"></div>
            <div class="shape forest-ridge r3"></div>
            <div class="shape forest-rays"></div>
            <div class="shape forest-canopy c2"></div>
            <div class="shape forest-canopy c1"></div>
            <svg class="shape forest-vines opt" viewBox="0 0 200 260"><path class="v" d="M34 0C22 62 48 108 30 176M96 0C84 52 108 96 92 140M160 0C150 70 172 120 156 200"/><g class="lv"><ellipse cx="28" cy="50" rx="11" ry="5" transform="rotate(-30 28 50)"/><ellipse cx="40" cy="98" rx="11" ry="5" transform="rotate(25 40 98)"/><ellipse cx="32" cy="150" rx="11" ry="5" transform="rotate(-20 32 150)"/><ellipse cx="92" cy="44" rx="11" ry="5" transform="rotate(30 92 44)"/><ellipse cx="100" cy="100" rx="11" ry="5" transform="rotate(-25 100 100)"/><ellipse cx="94" cy="128" rx="11" ry="5" transform="rotate(20 94 128)"/><ellipse cx="154" cy="60" rx="11" ry="5" transform="rotate(-30 154 60)"/><ellipse cx="166" cy="112" rx="11" ry="5" transform="rotate(28 166 112)"/><ellipse cx="158" cy="170" rx="11" ry="5" transform="rotate(-18 158 170)"/><ellipse cx="162" cy="196" rx="11" ry="5" transform="rotate(22 162 196)"/></g></svg>
            <div class="shape forest-trunk t3"></div>
            <div class="shape forest-trunk t1"></div>
            <div class="shape forest-trunk t2"></div>
            <div class="shape forest-ferns"></div>
            <svg class="shape forest-shroom" viewBox="0 0 140 90"><g class="st"><rect x="28" y="50" width="9" height="36" rx="3"/><rect x="74" y="42" width="11" height="44" rx="3"/><rect x="108" y="62" width="7" height="24" rx="3"/></g><g class="cp"><path d="M8 54Q8 28 32 28Q56 28 56 54Z"/><path d="M52 46Q52 16 80 16Q108 16 108 46Z"/><path d="M96 66Q96 48 112 48Q128 48 128 66Z"/></g><g class="sp"><circle cx="22" cy="42" r="3"/><circle cx="38" cy="38" r="2.4"/><circle cx="68" cy="30" r="3.4"/><circle cx="90" cy="26" r="2.6"/><circle cx="108" cy="58" r="2"/></g></svg>
            <div class="shape forest-firefly"></div>
            <div class="shape forest-firefly f2"></div>
            <div class="shape forest-firefly f3 opt"></div>
        `,

        // ★ SUNSHINE — "Sunny Beach"
        sunshine: `
            <div class="shape sn-sun"></div>
            <div class="shape sn-cloud c1"></div>
            <div class="shape sn-cloud c2 opt"></div>
            <svg class="shape sn-gull" viewBox="0 0 40 16"><path d="M1 12Q10 -2 20 10Q30 -2 39 12"/></svg>
            <div class="shape sn-sea"></div>
            <div class="shape sn-wave w1"></div>
            <div class="shape sn-wave w2"></div>
            <div class="shape sn-sand"></div>
            <svg class="shape sn-umb" viewBox="0 0 120 140"><rect class="po" x="58.5" y="56" width="3.5" height="82" rx="1.5"/><path class="ca" d="M6 62A54 54 0 0 1 114 62Z"/><path class="st" d="M60 8Q28 22 34 62H60ZM60 8Q92 22 86 62H60Z"/><path class="ca" d="M6 62Q20 72 33 62Q46 72 60 62Q74 72 87 62Q100 72 114 62Z"/></svg>
            <div class="shape sn-ball opt"></div>
        `,

        // ★ STARRY — "Campsite"
        starry: `
            <div class="shape st-milky"></div>
            <div class="shape st-stars"></div>
            <div class="shape st-stars t"></div>
            <div class="shape st-shoot"></div>
            <div class="shape st-mtn m1"></div>
            <div class="shape st-mtn m2"></div>
            <div class="shape st-ground"></div>
            <svg class="shape st-pine p1" viewBox="0 0 120 160"><path d="M60 4L86 50H72L98 96H78L110 148H10L42 96H22L48 50H34Z"/></svg>
            <svg class="shape st-pine p2" viewBox="0 0 120 160"><path d="M60 4L86 50H72L98 96H78L110 148H10L42 96H22L48 50H34Z"/></svg>
            <svg class="shape st-pine p3 opt" viewBox="0 0 120 160"><path d="M60 4L86 50H72L98 96H78L110 148H10L42 96H22L48 50H34Z"/></svg>
            <svg class="shape st-pine p4" viewBox="0 0 120 160"><path d="M60 4L86 50H72L98 96H78L110 148H10L42 96H22L48 50H34Z"/></svg>
            <svg class="shape st-tent" viewBox="0 0 160 100"><path class="t" d="M80 6L156 96H4Z"/><path class="s" d="M80 6L156 96H112Z"/><path class="d" d="M80 38L106 96H54Z"/></svg>
            <div class="shape st-fire"></div>
            <svg class="shape st-flame" viewBox="0 0 30 40"><path class="f1" d="M15 2C22 14 28 20 26 30C24 38 6 38 4 30C2 22 10 18 15 2Z"/><path class="f2" d="M15 18C19 24 22 28 20 33C18 37 12 37 10 33C8 28 13 26 15 18Z"/></svg>
        `,

        // ★ CAFE — "Rainy Window"
        cafe: `
            <div class="shape cf-bokeh"></div>
            <div class="shape cf-drops opt"></div>
            <div class="shape cf-rain r2"></div>
            <div class="shape cf-rain r1"></div>
            <div class="shape cf-frame"></div>
            <div class="shape cf-sill"></div>
            <div class="shape cf-steam"></div>
            <svg class="shape cf-mug" viewBox="0 0 120 110"><path class="m" d="M14 28H88V72C88 94 74 104 51 104C28 104 14 94 14 72Z"/><path class="h" d="M88 40H98C112 40 112 74 94 74H88"/><ellipse class="c" cx="51" cy="29" rx="37" ry="7"/><ellipse class="s" cx="51" cy="106" rx="50" ry="6"/></svg>
        `,

        // ★ CRIMSON — "Poppy Meadow"
        crimson: `
            <div class="shape cr-sun"></div>
            <div class="shape cr-hill h1"></div>
            <div class="shape cr-hill h2"></div>
            <div class="shape cr-hill h3"></div>
            <svg class="shape cr-field b" viewBox="0 0 600 160" preserveAspectRatio="xMidYMax slice"><path class="sm" d="M19 160Q22 131 19 110"/><g class="pp"><circle cx="14" cy="102" r="7.4"/><circle cx="24" cy="102" r="7.4"/><circle cx="19" cy="98" r="7.4"/><circle class="pc" cx="19" cy="102" r="2.4"/></g><path class="sm" d="M86 160Q95 121 86 91"/><g class="pp"><circle cx="81" cy="83" r="6.2"/><circle cx="90" cy="83" r="6.2"/><circle cx="86" cy="80" r="6.2"/><circle class="pc" cx="86" cy="83" r="2.0"/></g><path class="sm" d="M129 160Q128 125 129 97"/><g class="pp"><circle cx="122" cy="89" r="9.6"/><circle cx="135" cy="89" r="9.6"/><circle cx="129" cy="85" r="9.6"/><circle class="pc" cx="129" cy="89" r="3.1"/></g><path class="sm" d="M202 160Q192 130 202 107"/><g class="pp"><circle cx="196" cy="99" r="8.4"/><circle cx="208" cy="99" r="8.4"/><circle cx="202" cy="95" r="8.4"/><circle class="pc" cx="202" cy="99" r="2.7"/></g><path class="sm" d="M250 160Q257 137 250 123"/><g class="pp"><circle cx="244" cy="115" r="8.0"/><circle cx="255" cy="115" r="8.0"/><circle cx="250" cy="111" r="8.0"/><circle class="pc" cx="250" cy="115" r="2.6"/></g><path class="sm" d="M305 160Q308 121 305 91"/><g class="pp"><circle cx="299" cy="83" r="8.8"/><circle cx="312" cy="83" r="8.8"/><circle cx="305" cy="78" r="8.8"/><circle class="pc" cx="305" cy="83" r="2.8"/></g><path class="sm" d="M348 160Q347 121 348 89"/><g class="pp"><circle cx="342" cy="81" r="9.2"/><circle cx="355" cy="81" r="9.2"/><circle cx="348" cy="77" r="9.2"/><circle class="pc" cx="348" cy="81" r="2.9"/></g><path class="sm" d="M416 160Q428 138 416 123"/><g class="pp"><circle cx="410" cy="115" r="8.6"/><circle cx="422" cy="115" r="8.6"/><circle cx="416" cy="111" r="8.6"/><circle class="pc" cx="416" cy="115" r="2.8"/></g><path class="sm" d="M460 160Q472 136 460 120"/><g class="pp"><circle cx="455" cy="112" r="7.7"/><circle cx="466" cy="112" r="7.7"/><circle cx="460" cy="108" r="7.7"/><circle class="pc" cx="460" cy="112" r="2.5"/></g><path class="sm" d="M530 160Q522 122 530 92"/><g class="pp"><circle cx="526" cy="84" r="6.6"/><circle cx="535" cy="84" r="6.6"/><circle cx="530" cy="81" r="6.6"/><circle class="pc" cx="530" cy="84" r="2.1"/></g><path class="sm" d="M588 160Q582 129 588 105"/><g class="pp"><circle cx="582" cy="97" r="8.3"/><circle cx="593" cy="97" r="8.3"/><circle cx="588" cy="93" r="8.3"/><circle class="pc" cx="588" cy="97" r="2.7"/></g></svg>
            <svg class="shape cr-field a" viewBox="0 0 600 160" preserveAspectRatio="xMidYMax slice"><path class="sm" d="M32 160Q42 110 32 69"/><g class="pp"><circle cx="26" cy="61" r="9.5"/><circle cx="39" cy="61" r="9.5"/><circle cx="32" cy="56" r="9.5"/><circle class="pc" cx="32" cy="61" r="3.0"/></g><path class="sm" d="M84 160Q72 114 84 76"/><g class="pp"><circle cx="75" cy="68" r="13.2"/><circle cx="93" cy="68" r="13.2"/><circle cx="84" cy="61" r="13.2"/><circle class="pc" cx="84" cy="68" r="4.2"/></g><path class="sm" d="M168 160Q165 117 168 82"/><g class="pp"><circle cx="162" cy="74" r="9.0"/><circle cx="175" cy="74" r="9.0"/><circle cx="168" cy="69" r="9.0"/><circle class="pc" cx="168" cy="74" r="2.9"/></g><path class="sm" d="M240 160Q230 112 240 73"/><g class="pp"><circle cx="231" cy="65" r="12.4"/><circle cx="249" cy="65" r="12.4"/><circle cx="240" cy="59" r="12.4"/><circle class="pc" cx="240" cy="65" r="4.0"/></g><path class="sm" d="M292 160Q303 103 292 54"/><g class="pp"><circle cx="284" cy="46" r="11.3"/><circle cx="300" cy="46" r="11.3"/><circle cx="292" cy="40" r="11.3"/><circle class="pc" cx="292" cy="46" r="3.6"/></g><path class="sm" d="M370 160Q376 121 370 91"/><g class="pp"><circle cx="362" cy="83" r="10.7"/><circle cx="377" cy="83" r="10.7"/><circle cx="370" cy="77" r="10.7"/><circle class="pc" cx="370" cy="83" r="3.4"/></g><path class="sm" d="M421 160Q427 108 421 64"/><g class="pp"><circle cx="412" cy="56" r="12.1"/><circle cx="429" cy="56" r="12.1"/><circle cx="421" cy="50" r="12.1"/><circle class="pc" cx="421" cy="56" r="3.9"/></g><path class="sm" d="M497 160Q489 102 497 53"/><g class="pp"><circle cx="490" cy="45" r="10.1"/><circle cx="505" cy="45" r="10.1"/><circle cx="497" cy="40" r="10.1"/><circle class="pc" cx="497" cy="45" r="3.2"/></g><path class="sm" d="M560 160Q570 122 560 93"/><g class="pp"><circle cx="553" cy="85" r="9.8"/><circle cx="567" cy="85" r="9.8"/><circle cx="560" cy="80" r="9.8"/><circle class="pc" cx="560" cy="85" r="3.1"/></g></svg>
            <div class="shape cr-petal" style="--x:20%;--d:20s;--dl:-4s"></div>
            <div class="shape cr-petal" style="--x:55%;--d:26s;--dl:-13s"></div>
            <div class="shape cr-petal opt" style="--x:80%;--d:23s;--dl:-8s"></div>
        `,

        // ★ MAROON — "Grand Library"
        maroon: `
            <svg class="shape mr-defs" width="0" height="0" style="position:absolute"><defs><g id="mr-bk"><rect class="b1" x="0" y="19" width="10" height="73"/><rect class="b2" x="11" y="8" width="13" height="84"/><rect class="b1" x="25" y="34" width="8" height="58"/><rect class="b1" x="34" y="20" width="13" height="72"/><rect class="b5" x="48" y="5" width="10" height="87"/><rect class="b2" x="59" y="21" width="12" height="71"/><rect class="b2" x="72" y="22" width="8" height="70"/><rect class="b3" x="81" y="22" width="7" height="70"/><rect class="b3" x="89" y="28" width="10" height="64"/><rect class="b1" x="100" y="15" width="11" height="77"/><rect class="b5" x="112" y="14" width="12" height="78"/><rect class="b2" x="125" y="27" width="10" height="65"/><rect class="b1" x="136" y="21" width="14" height="71"/><rect class="b3" x="151" y="38" width="11" height="54"/><rect class="b2" x="163" y="6" width="11" height="86"/><rect class="b5" x="175" y="11" width="13" height="81"/><rect class="b4" x="189" y="11" width="11" height="81"/><rect class="b3" x="201" y="24" width="9" height="68"/><rect class="b1" x="211" y="36" width="11" height="56"/><rect class="b6" x="223" y="9" width="7" height="83"/><rect class="b5" x="231" y="5" width="11" height="87"/><rect class="pk" x="0" y="92" width="240" height="8"/><rect class="b2" x="0" y="117" width="14" height="75"/><rect class="b4" x="15" y="134" width="10" height="58"/><rect class="b3" x="26" y="110" width="10" height="82"/><rect class="b4" x="37" y="116" width="9" height="76"/><rect class="b3" x="47" y="126" width="12" height="66"/><rect class="b6" x="60" y="135" width="8" height="57"/><rect class="b5" x="69" y="121" width="10" height="71"/><rect class="b3" x="80" y="131" width="10" height="61"/><rect class="b4" x="91" y="120" width="9" height="72"/><rect class="b3" x="101" y="136" width="7" height="56"/><rect class="b6" x="109" y="120" width="8" height="72"/><rect class="b3" x="118" y="137" width="12" height="55"/><rect class="b2" x="131" y="118" width="11" height="74"/><rect class="b3" x="143" y="134" width="13" height="58"/><rect class="b3" x="157" y="110" width="10" height="82"/><rect class="b4" x="168" y="122" width="9" height="70"/><rect class="b5" x="178" y="117" width="9" height="75"/><rect class="b1" x="188" y="115" width="7" height="77"/><rect class="b3" x="196" y="128" width="14" height="64"/><rect class="b5" x="211" y="120" width="12" height="72"/><rect class="b2" x="224" y="110" width="8" height="82"/><rect class="b1" x="233" y="125" width="13" height="67"/><rect class="pk" x="0" y="192" width="240" height="8"/><rect class="b1" x="0" y="235" width="7" height="57"/><rect class="b5" x="8" y="229" width="9" height="63"/><rect class="b4" x="18" y="204" width="7" height="88"/><rect class="b1" x="26" y="218" width="10" height="74"/><rect class="b3" x="37" y="205" width="8" height="87"/><rect class="b4" x="46" y="226" width="13" height="66"/><rect class="b4" x="60" y="223" width="10" height="69"/><rect class="b1" x="71" y="207" width="13" height="85"/><rect class="b4" x="85" y="212" width="10" height="80"/><rect class="b2" x="96" y="211" width="10" height="81"/><rect class="b1" x="107" y="226" width="14" height="66"/><rect class="b3" x="122" y="222" width="7" height="70"/><rect class="b2" x="130" y="205" width="10" height="87"/><rect class="b3" x="141" y="212" width="10" height="80"/><rect class="b1" x="152" y="218" width="9" height="74"/><rect class="b5" x="162" y="231" width="12" height="61"/><rect class="b4" x="175" y="236" width="13" height="56"/><rect class="b4" x="189" y="233" width="13" height="59"/><rect class="b3" x="203" y="228" width="10" height="64"/><rect class="b6" x="214" y="208" width="11" height="84"/><rect class="b5" x="226" y="212" width="12" height="80"/><rect class="b3" x="239" y="221" width="10" height="71"/><rect class="pk" x="0" y="292" width="240" height="8"/><rect class="b1" x="0" y="307" width="13" height="85"/><rect class="b1" x="14" y="326" width="11" height="66"/><rect class="b3" x="26" y="330" width="13" height="62"/><rect class="b6" x="40" y="328" width="7" height="64"/><rect class="b6" x="48" y="308" width="14" height="84"/><rect class="b2" x="63" y="314" width="13" height="78"/><rect class="b2" x="77" y="325" width="7" height="67"/><rect class="b1" x="85" y="322" width="7" height="70"/><rect class="b2" x="93" y="314" width="13" height="78"/><rect class="b2" x="107" y="326" width="7" height="66"/><rect class="b5" x="115" y="308" width="12" height="84"/><rect class="b1" x="128" y="337" width="14" height="55"/><rect class="b4" x="143" y="331" width="7" height="61"/><rect class="b1" x="151" y="330" width="11" height="62"/><rect class="b5" x="163" y="333" width="12" height="59"/><rect class="b3" x="176" y="319" width="7" height="73"/><rect class="b5" x="184" y="333" width="8" height="59"/><rect class="b2" x="193" y="314" width="14" height="78"/><rect class="b2" x="208" y="314" width="11" height="78"/><rect class="b1" x="220" y="313" width="14" height="79"/><rect class="b5" x="235" y="331" width="8" height="61"/><rect class="pk" x="0" y="392" width="240" height="8"/><rect class="b4" x="0" y="406" width="12" height="86"/><rect class="b1" x="13" y="410" width="13" height="82"/><rect class="b4" x="27" y="419" width="10" height="73"/><rect class="b5" x="38" y="431" width="13" height="61"/><rect class="b2" x="52" y="415" width="9" height="77"/><rect class="b3" x="62" y="429" width="9" height="63"/><rect class="b3" x="72" y="417" width="14" height="75"/><rect class="b1" x="87" y="428" width="7" height="64"/><rect class="b5" x="95" y="431" width="11" height="61"/><rect class="b6" x="107" y="407" width="8" height="85"/><rect class="b1" x="116" y="405" width="14" height="87"/><rect class="b3" x="131" y="412" width="10" height="80"/><rect class="b2" x="142" y="424" width="12" height="68"/><rect class="b5" x="155" y="435" width="7" height="57"/><rect class="b4" x="163" y="404" width="12" height="88"/><rect class="b4" x="176" y="406" width="11" height="86"/><rect class="b2" x="188" y="413" width="14" height="79"/><rect class="b6" x="203" y="415" width="11" height="77"/><rect class="b4" x="215" y="430" width="12" height="62"/><rect class="b6" x="228" y="429" width="8" height="63"/><rect class="b3" x="237" y="420" width="9" height="72"/><rect class="pk" x="0" y="492" width="240" height="8"/><rect class="b6" x="0" y="516" width="10" height="76"/><rect class="b4" x="11" y="534" width="8" height="58"/><rect class="b6" x="20" y="517" width="9" height="75"/><rect class="b2" x="30" y="518" width="12" height="74"/><rect class="b5" x="43" y="537" width="11" height="55"/><rect class="b1" x="55" y="505" width="7" height="87"/><rect class="b2" x="63" y="532" width="12" height="60"/><rect class="b6" x="76" y="507" width="9" height="85"/><rect class="b2" x="86" y="531" width="8" height="61"/><rect class="b5" x="95" y="524" width="14" height="68"/><rect class="b5" x="110" y="513" width="11" height="79"/><rect class="b6" x="122" y="507" width="10" height="85"/><rect class="b3" x="133" y="519" width="10" height="73"/><rect class="b5" x="144" y="518" width="10" height="74"/><rect class="b5" x="155" y="513" width="14" height="79"/><rect class="b3" x="170" y="518" width="13" height="74"/><rect class="b5" x="184" y="512" width="14" height="80"/><rect class="b2" x="199" y="522" width="7" height="70"/><rect class="b4" x="207" y="515" width="14" height="77"/><rect class="b2" x="222" y="537" width="13" height="55"/><rect class="b6" x="236" y="509" width="8" height="83"/><rect class="pk" x="0" y="592" width="240" height="8"/><rect class="b1" x="0" y="619" width="12" height="73"/><rect class="b2" x="13" y="608" width="11" height="84"/><rect class="b2" x="25" y="634" width="14" height="58"/><rect class="b3" x="40" y="634" width="10" height="58"/><rect class="b2" x="51" y="635" width="9" height="57"/><rect class="b3" x="61" y="604" width="13" height="88"/><rect class="b2" x="75" y="605" width="7" height="87"/><rect class="b2" x="83" y="632" width="9" height="60"/><rect class="b1" x="93" y="618" width="7" height="74"/><rect class="b1" x="101" y="621" width="8" height="71"/><rect class="b6" x="110" y="627" width="11" height="65"/><rect class="b2" x="122" y="612" width="9" height="80"/><rect class="b6" x="132" y="615" width="8" height="77"/><rect class="b5" x="141" y="629" width="7" height="63"/><rect class="b2" x="149" y="629" width="13" height="63"/><rect class="b5" x="163" y="608" width="11" height="84"/><rect class="b2" x="175" y="614" width="8" height="78"/><rect class="b5" x="184" y="622" width="9" height="70"/><rect class="b6" x="194" y="604" width="13" height="88"/><rect class="b3" x="208" y="613" width="11" height="79"/><rect class="b1" x="220" y="614" width="9" height="78"/><rect class="b3" x="230" y="637" width="13" height="55"/><rect class="pk" x="0" y="692" width="240" height="8"/></g></defs></svg>
            <svg class="shape mr-shelf l" viewBox="0 0 240 700" preserveAspectRatio="xMinYMin slice"><use href="#mr-bk"/></svg>
            <svg class="shape mr-shelf r" viewBox="0 0 240 700" preserveAspectRatio="xMinYMin slice"><use href="#mr-bk"/></svg>
            <div class="shape mr-cone"></div>
            <div class="shape mr-lamp"><i class="cd"></i><i class="sh"></i><i class="gw"></i></div>
            <div class="shape mr-dust"></div>
            <div class="shape mr-desk"></div>
        `,

        // ★ SAKURA — "Torii at Dawn (upgraded)"
        sakura: `

            <div class="shape sakura-stars opt"></div>
            <div class="shape sakura-sun"></div>
            <div class="shape sakura-mount"></div>
            <div class="shape sakura-mist"></div>
            <div class="shape sakura-water"></div>
            <div class="shape sakura-sunpath"></div>
            <div class="shape sakura-torii-ref"></div>
            <div class="shape sakura-ripples"></div>
            <div class="shape sakura-torii"></div>
            <div class="shape sakura-lantern"><svg viewBox="0 0 60 122"><path class="s" d="M18 122h24v-9H18zM25 113h10V78H25z"/><path class="s" d="M14 78h32V50H14z"/><path class="w" d="M22 58h16v14H22z"/><path class="s" d="M6 50L30 30L54 50z"/><circle class="s" cx="30" cy="25" r="5"/></svg></div>
            <div class="shape sakura-floaters"></div>
            <div class="shape sakura-bough"><i class="sk-wood"></i><i class="sk-bl b1"></i><i class="sk-bl b2"></i><i class="sk-bl b3"></i><i class="sk-bl b4"></i><i class="sk-bl b5"></i><i class="sk-bl b6"></i><i class="sk-bl b7"></i><i class="sk-bl b8"></i></div>
            <div class="shape sakura-petal p1"></div>
            <div class="shape sakura-petal p2"></div>
            <div class="shape sakura-petal p3 opt"></div>
        `,

        // ★ NEBULA — "Orbital System"
        nebula: `
            <div class="shape nb-haze h1"></div>
            <div class="shape nb-haze h2"></div>
            <div class="shape nb-stars"></div>
            <div class="shape nb-sys"><i class="nb-ring r1"></i><i class="nb-ring r2"></i><i class="nb-ring r3"></i><i class="nb-ring r4"></i><i class="nb-sun"></i></div>
        `,

        // ★ EMBER — "Lantern Festival"
        ember: `
            <div class="shape em-dots"></div>
            <div class="shape em-lantern a" style="--x:20%;--d:52s;--dl:-10s"></div>
            <div class="shape em-lantern a" style="--x:62%;--d:64s;--dl:-34s"></div>
            <div class="shape em-lantern a opt" style="--x:84%;--d:58s;--dl:-48s"></div>
            <div class="shape em-water"></div>
            <svg class="shape em-temple" viewBox="0 0 240 232"><path d="M120 40V14"/><circle cx="120" cy="12" r="3"/><path d="M74 76Q94.7 85 120 60Q145.3 85 166 76Q120 92 74 76Z"/><rect x="92" y="78" width="56" height="30"/><path d="M56 126Q84.8 135 120 110Q155.2 135 184 126Q120 142 56 126Z"/><rect x="82" y="128" width="76" height="34"/><path d="M38 182Q74.9 191 120 166Q165.1 191 202 182Q120 198 38 182Z"/><rect x="66" y="184" width="108" height="26"/><rect x="40" y="210" width="160" height="20"/></svg>
        `,

        // ★ AUTUMN — "Birch Grove"
        autumn: `
            <div class="shape bi-sun"></div>
            <div class="shape bi-trunk t5 opt"></div>
            <div class="shape bi-fog"></div>
            <div class="shape bi-trunk t2"></div>
            <div class="shape bi-trunk t4 opt"></div>
            <div class="shape bi-trunk t1"></div>
            <div class="shape bi-trunk t3"></div>
            <div class="shape bi-canopy"></div>
            <div class="shape bi-ground"></div>
            <div class="shape bi-leaf" style="--x:12%;--d:22s;--dl:-4s;--c:var(--bi-l1)"></div>
            <div class="shape bi-leaf" style="--x:46%;--d:28s;--dl:-15s;--c:var(--bi-l2)"></div>
            <div class="shape bi-leaf" style="--x:78%;--d:25s;--dl:-9s;--c:var(--bi-l3)"></div>
            <div class="shape bi-leaf opt" style="--x:30%;--d:31s;--dl:-22s;--c:var(--bi-l2)"></div>
        `,

        // ★ GLACIER — "Alpine Gondola"
        glacier: `
            <div class="shape gl-sun"></div>
            <div class="shape gl-mtn m1"></div>
            <div class="shape gl-mtn m2"></div>
            <div class="shape gl-cable"><i class="gl-gond"><svg viewBox="0 0 40 46"><path class="w" d="M20 0V10"/><rect class="b" x="6" y="10" width="28" height="22" rx="4"/><rect class="g" x="10" y="15" width="8" height="8" rx="1.5"/><rect class="g" x="22" y="15" width="8" height="8" rx="1.5"/></svg></i></div>
            <div class="shape gl-snow"></div>
            <svg class="shape gl-pine p1" viewBox="0 0 120 160"><path d="M60 4L86 50H72L98 96H78L110 148H10L42 96H22L48 50H34Z"/></svg>
            <svg class="shape gl-pine p2" viewBox="0 0 120 160"><path d="M60 4L86 50H72L98 96H78L110 148H10L42 96H22L48 50H34Z"/></svg>
            <svg class="shape gl-pine p3 opt" viewBox="0 0 120 160"><path d="M60 4L86 50H72L98 96H78L110 148H10L42 96H22L48 50H34Z"/></svg>
            <div class="shape gl-flakes"></div>
        `,

        // ★ TROPIC — "Palm Fronds"
        tropic: `
            <svg class="shape" width="0" height="0" style="position:absolute"><defs><g id="tr-fr"><path class="lf" d="M48 5L79 -9L54 6ZM48 5L69 49L54 6ZM63 8L102 -8L69 9ZM63 8L86 63L69 9ZM79 11L124 -5L84 13ZM79 11L103 76L84 13ZM94 15L146 -1L99 17ZM94 15L118 89L99 17ZM109 20L167 5L114 22ZM109 20L132 102L114 22ZM124 26L187 12L129 28ZM124 26L146 114L129 28ZM138 32L206 20L144 35ZM138 32L158 126L144 35ZM153 39L225 29L158 42ZM153 39L170 137L158 42ZM167 46L242 39L172 49ZM167 46L182 147L172 49ZM181 55L258 51L186 58ZM181 55L193 156L186 58ZM195 63L272 62L200 67ZM195 63L204 165L200 67ZM209 73L286 75L214 76ZM209 73L214 174L214 76ZM223 83L298 88L227 87ZM223 83L225 181L227 87ZM236 94L310 101L241 98ZM236 94L236 188L241 98ZM250 105L320 114L254 109ZM250 105L247 195L254 109ZM263 117L329 128L267 121ZM263 117L258 202L267 121ZM276 130L337 142L280 134ZM276 130L270 208L280 134ZM289 143L344 157L293 148ZM289 143L282 214L293 148ZM301 158L351 171L305 162ZM301 158L294 220L305 162ZM314 172L357 185L318 177ZM314 172L307 227L318 177ZM326 188L362 200L330 192ZM326 188L319 233L330 192ZM338 204L367 215L342 209ZM338 204L333 240L342 209ZM350 221L371 230L354 225ZM350 221L346 247L354 225ZM362 238L374 244L365 243ZM362 238L360 253L365 243Z"/><path style="fill:none;stroke:var(--tr-rb);stroke-width:4;stroke-linecap:round" d="M0 0Q215 8 370 250"/></g></defs></svg>
            <div class="shape tr-sun"></div>
            <div class="shape tr-sea"></div>
            <div class="shape tr-wave"></div>
            <svg class="shape tr-frond f2" viewBox="-10 -10 420 330"><use href="#tr-fr"/></svg>
            <svg class="shape tr-frond f1" viewBox="-10 -10 420 330"><use href="#tr-fr"/></svg>
            <svg class="shape tr-frond f3" viewBox="-10 -10 420 330"><use href="#tr-fr"/></svg>
            <svg class="shape tr-hib opt" viewBox="0 0 100 100"><g><ellipse cx="50" cy="22" rx="14" ry="22" transform="rotate(0 50 50)"/><ellipse cx="50" cy="22" rx="14" ry="22" transform="rotate(72 50 50)"/><ellipse cx="50" cy="22" rx="14" ry="22" transform="rotate(144 50 50)"/><ellipse cx="50" cy="22" rx="14" ry="22" transform="rotate(216 50 50)"/><ellipse cx="50" cy="22" rx="14" ry="22" transform="rotate(288 50 50)"/></g><circle cx="50" cy="50" r="7" class="c"/><path class="c" d="M50 50L66 30" stroke-width="3"/></svg>
        `,

        // ★ MOONLIT — "Desert Moon"
        moonlit: `
            <div class="shape mo-stars"></div>
            <div class="shape mo-moon"></div>
            <div class="shape mo-cloud c1"></div>
            <div class="shape mo-cloud c2 opt"></div>
            <div class="shape mo-dune d1"></div>
            <div class="shape mo-dune d2"></div>
            <svg class="shape mo-cac k2 opt" viewBox="0 0 80 160"><path d="M34 160V50Q34 36 40 36Q46 36 46 50V160Z"/><path d="M34 102H20Q12 102 12 92V72Q12 64 18 64Q24 64 24 72V88H34Z"/><path d="M46 86H60Q68 86 68 76V56Q68 48 62 48Q56 48 56 56V72H46Z"/></svg>
            <div class="shape mo-dune d3"></div>
            <svg class="shape mo-cac k1" viewBox="0 0 80 160"><path d="M34 160V50Q34 36 40 36Q46 36 46 50V160Z"/><path d="M34 102H20Q12 102 12 92V72Q12 64 18 64Q24 64 24 72V88H34Z"/><path d="M46 86H60Q68 86 68 76V56Q68 48 62 48Q56 48 56 56V72H46Z"/></svg>
        `,

        // ★ AURORA — "Arctic Cabin (upgraded)"
        aurora: `

            <div class="shape aurora-stars"></div>
            <div class="shape aurora-ribbon a1"></div>
            <div class="shape aurora-ribbon a2"></div>
            <div class="shape aurora-peaks"></div>
            <div class="shape aurora-ridge"></div>
            <div class="shape aurora-ice"></div>
            <div class="shape aurora-reflect"></div>
            <div class="shape aurora-snow s1"></div>
            <div class="shape aurora-snow s2"></div>
            <div class="shape aurora-pines p1"></div>
            <div class="shape aurora-pines p2"></div>
            <div class="shape aurora-cabin"><i class="au-chimney"></i><i class="au-smoke"></i></div>
            <div class="shape aurora-flakes opt"></div>
        `,

        // ★ MATCHA — "Zen Garden"
        matcha: `
            <div class="shape mt-enso"></div>
            <div class="shape mt-sand"></div>
            <div class="shape mt-ripple r1"></div>
            <div class="shape mt-ripple r2"></div>
            <div class="shape mt-rock k1"></div>
            <div class="shape mt-rock k2"></div>
            <div class="shape mt-rock k3 opt"></div>
            <div class="shape mt-bamboo b1"></div>
            <div class="shape mt-bamboo b2"></div>
            <div class="shape mt-bamboo b3 opt"></div>
            <i class="shape mt-leaf a"></i><i class="shape mt-leaf b opt"></i>
        `
    };

    // ================================================================
    // ===== THEMES (palettes) — UNCHANGED =====
    // ================================================================
    window.THEMES = {
        ocean: {
            name: 'Ocean', sub: 'Deep · Calm', emoji: '🌊',
            preview: { primary: '#1089d3', gradient: 'linear-gradient(135deg, #1089d3 0%, #12b1d1 100%)' },
            light: {
                '--theme-primary': '#1089d3', '--theme-accent': '#12b1d1', '--theme-primary-dark': '#0c6ca8',
                '--theme-primary-soft': '#e0f2fe', '--theme-primary-soft-2': '#f0f7ff',
                '--theme-bg': '#ffffff', '--theme-bg-soft': '#f8faff', '--theme-card': '#ffffff',
                '--theme-text': '#1a1a2e', '--theme-text-muted': '#555', '--theme-text-dim': '#888', '--theme-text-faint': '#aaa',
                '--theme-border': '#eef2f7', '--theme-border-soft': '#f0f4ff', '--theme-border-input': '#e0e7ff',
                '--theme-gradient': 'linear-gradient(45deg, #1089d3 0%, #12b1d1 100%)',
                '--theme-shadow': 'rgba(133, 189, 215, 0.15)', '--theme-shadow-soft': '#cff0ff',
                '--theme-nav-bg': 'rgba(255, 255, 255, 0.98)'
            },
            dark: {
                '--theme-primary': '#4dabf7', '--theme-accent': '#5ac8fa', '--theme-primary-dark': '#339af0',
                '--theme-primary-soft': '#1a2b3d', '--theme-primary-soft-2': '#0f1a26',
                '--theme-bg': '#0a1118', '--theme-bg-soft': '#131b24', '--theme-card': '#131b24',
                '--theme-text': '#e6f0f9', '--theme-text-muted': '#a0b3c5', '--theme-text-dim': '#7a8fa3', '--theme-text-faint': '#5a6b7d',
                '--theme-border': '#1f2a37', '--theme-border-soft': '#16202b', '--theme-border-input': '#1f2a37',
                '--theme-gradient': 'linear-gradient(45deg, #4dabf7 0%, #5ac8fa 100%)',
                '--theme-shadow': 'rgba(77, 171, 247, 0.2)', '--theme-shadow-soft': 'rgba(77, 171, 247, 0.15)',
                '--theme-nav-bg': 'rgba(10, 17, 24, 0.98)'
            }
        },
        sunset: {
            name: 'Sunset', sub: 'Savanna · Warm', emoji: '🌅',
            preview: { primary: '#f5576c', gradient: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)' },
            light: {
                '--theme-primary': '#f5576c', '--theme-accent': '#f093fb', '--theme-primary-dark': '#c73a52',
                '--theme-primary-soft': '#ffe4e6', '--theme-primary-soft-2': '#fff1f2',
                '--theme-bg': '#ffffff', '--theme-bg-soft': '#fff8f9', '--theme-card': '#ffffff',
                '--theme-text': '#3a1418', '--theme-text-muted': '#6b3038', '--theme-text-dim': '#8a5560', '--theme-text-faint': '#b08890',
                '--theme-border': '#fdeef0', '--theme-border-soft': '#fef5f6', '--theme-border-input': '#fde0e3',
                '--theme-gradient': 'linear-gradient(45deg, #f5576c 0%, #f093fb 100%)',
                '--theme-shadow': 'rgba(245, 87, 108, 0.15)', '--theme-shadow-soft': 'rgba(245, 87, 108, 0.2)',
                '--theme-nav-bg': 'rgba(255, 255, 255, 0.98)'
            },
            dark: {
                '--theme-primary': '#ff6b7e', '--theme-accent': '#ff9db0', '--theme-primary-dark': '#e04458',
                '--theme-primary-soft': '#3d1f26', '--theme-primary-soft-2': '#1e0f13',
                '--theme-bg': '#1a0e11', '--theme-bg-soft': '#241318', '--theme-card': '#241318',
                '--theme-text': '#fbe5e8', '--theme-text-muted': '#c9a0a7', '--theme-text-dim': '#a57a82', '--theme-text-faint': '#7d5a61',
                '--theme-border': '#3a1f26', '--theme-border-soft': '#2a151b', '--theme-border-input': '#3a1f26',
                '--theme-gradient': 'linear-gradient(45deg, #ff6b7e 0%, #ff9db0 100%)',
                '--theme-shadow': 'rgba(255, 107, 126, 0.25)', '--theme-shadow-soft': 'rgba(255, 107, 126, 0.18)',
                '--theme-nav-bg': 'rgba(26, 14, 17, 0.98)'
            }
        },
        pink: {
            name: 'Blossom', sub: 'Balloons · Sweet', emoji: '🌸',
            preview: { primary: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #f9a8d4 100%)' },
            light: {
                '--theme-primary': '#ec4899', '--theme-accent': '#f9a8d4', '--theme-primary-dark': '#be185d',
                '--theme-primary-soft': '#fce7f3', '--theme-primary-soft-2': '#fdf2f8',
                '--theme-bg': '#ffffff', '--theme-bg-soft': '#fff7fb', '--theme-card': '#ffffff',
                '--theme-text': '#2e1a26', '--theme-text-muted': '#6b4a5c', '--theme-text-dim': '#9c7a8c', '--theme-text-faint': '#c4a5b4',
                '--theme-border': '#fde8f1', '--theme-border-soft': '#fef3f9', '--theme-border-input': '#fbd5e5',
                '--theme-gradient': 'linear-gradient(45deg, #ec4899 0%, #f9a8d4 100%)',
                '--theme-shadow': 'rgba(236, 72, 153, 0.15)', '--theme-shadow-soft': 'rgba(236, 72, 153, 0.2)',
                '--theme-nav-bg': 'rgba(255, 255, 255, 0.98)'
            },
            dark: {
                '--theme-primary': '#f472b6', '--theme-accent': '#fbcfe8', '--theme-primary-dark': '#db2777',
                '--theme-primary-soft': '#3d1f30', '--theme-primary-soft-2': '#1e0f1a',
                '--theme-bg': '#1a0e16', '--theme-bg-soft': '#241320', '--theme-card': '#241320',
                '--theme-text': '#fbe5f0', '--theme-text-muted': '#c9a0b8', '--theme-text-dim': '#a57a95', '--theme-text-faint': '#7d5a70',
                '--theme-border': '#3a1f30', '--theme-border-soft': '#2a1522', '--theme-border-input': '#3a1f30',
                '--theme-gradient': 'linear-gradient(45deg, #f472b6 0%, #fbcfe8 100%)',
                '--theme-shadow': 'rgba(244, 114, 182, 0.25)', '--theme-shadow-soft': 'rgba(244, 114, 182, 0.18)',
                '--theme-nav-bg': 'rgba(26, 14, 22, 0.98)'
            }
        },
        forest: {
            name: 'Forest', sub: 'Misty · Canopy', emoji: '🌲',
            preview: { primary: '#16a34a', gradient: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)' },
            light: {
                '--theme-primary': '#16a34a', '--theme-accent': '#22c55e', '--theme-primary-dark': '#15803d',
                '--theme-primary-soft': '#dcfce7', '--theme-primary-soft-2': '#f0fdf4',
                '--theme-bg': '#ffffff', '--theme-bg-soft': '#f8fdf9', '--theme-card': '#ffffff',
                '--theme-text': '#0a2418', '--theme-text-muted': '#2a5040', '--theme-text-dim': '#4a7a60', '--theme-text-faint': '#7aa890',
                '--theme-border': '#e8f5ec', '--theme-border-soft': '#f0f9f2', '--theme-border-input': '#d1e7d8',
                '--theme-gradient': 'linear-gradient(45deg, #16a34a 0%, #22c55e 100%)',
                '--theme-shadow': 'rgba(22, 163, 74, 0.15)', '--theme-shadow-soft': 'rgba(22, 163, 74, 0.2)',
                '--theme-nav-bg': 'rgba(255, 255, 255, 0.98)'
            },
            dark: {
                '--theme-primary': '#4ade80', '--theme-accent': '#86efac', '--theme-primary-dark': '#22c55e',
                '--theme-primary-soft': '#14281a', '--theme-primary-soft-2': '#0a1810',
                '--theme-bg': '#08140d', '--theme-bg-soft': '#0f1e15', '--theme-card': '#0f1e15',
                '--theme-text': '#e0f2e6', '--theme-text-muted': '#a0c4ad', '--theme-text-dim': '#7a9c86', '--theme-text-faint': '#5a7c66',
                '--theme-border': '#1c3524', '--theme-border-soft': '#122319', '--theme-border-input': '#1c3524',
                '--theme-gradient': 'linear-gradient(45deg, #4ade80 0%, #86efac 100%)',
                '--theme-shadow': 'rgba(74, 222, 128, 0.25)', '--theme-shadow-soft': 'rgba(74, 222, 128, 0.18)',
                '--theme-nav-bg': 'rgba(8, 20, 13, 0.98)'
            }
        },
        sunshine: {
            name: 'Sunshine', sub: 'Beach · Cheery', emoji: '☀️',
            preview: { primary: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' },
            light: {
                '--theme-primary': '#f59e0b', '--theme-accent': '#fbbf24', '--theme-primary-dark': '#d97706',
                '--theme-primary-soft': '#fef3c7', '--theme-primary-soft-2': '#fffbeb',
                '--theme-bg': '#ffffff', '--theme-bg-soft': '#fffdf5', '--theme-card': '#ffffff',
                '--theme-text': '#2e2410', '--theme-text-muted': '#6b5a30', '--theme-text-dim': '#9c8a5c', '--theme-text-faint': '#c4b588',
                '--theme-border': '#fdf3dc', '--theme-border-soft': '#fef9ec', '--theme-border-input': '#fce8b3',
                '--theme-gradient': 'linear-gradient(45deg, #f59e0b 0%, #fbbf24 100%)',
                '--theme-shadow': 'rgba(245, 158, 11, 0.15)', '--theme-shadow-soft': 'rgba(245, 158, 11, 0.2)',
                '--theme-nav-bg': 'rgba(255, 255, 255, 0.98)'
            },
            dark: {
                '--theme-primary': '#fbbf24', '--theme-accent': '#fcd34d', '--theme-primary-dark': '#f59e0b',
                '--theme-primary-soft': '#3d3018', '--theme-primary-soft-2': '#1f1808',
                '--theme-bg': '#171207', '--theme-bg-soft': '#221a0c', '--theme-card': '#221a0c',
                '--theme-text': '#fbf3d9', '--theme-text-muted': '#c9baa0', '--theme-text-dim': '#a59578', '--theme-text-faint': '#7d7058',
                '--theme-border': '#3a2e15', '--theme-border-soft': '#2a210f', '--theme-border-input': '#3a2e15',
                '--theme-gradient': 'linear-gradient(45deg, #fbbf24 0%, #fcd34d 100%)',
                '--theme-shadow': 'rgba(251, 191, 36, 0.25)', '--theme-shadow-soft': 'rgba(251, 191, 36, 0.18)',
                '--theme-nav-bg': 'rgba(23, 18, 7, 0.98)'
            }
        },
        starry: {
            name: 'Starry', sub: 'Campsite · Night', emoji: '✨',
            preview: { primary: '#8b5cf6', gradient: 'linear-gradient(135deg, #1e1b4b 0%, #6d28d9 50%, #c4b5fd 100%)' },
            light: {
                '--theme-primary': '#a78bfa', '--theme-accent': '#c4b5fd', '--theme-primary-dark': '#8b5cf6',
                '--theme-primary-soft': '#2a1e3d', '--theme-primary-soft-2': '#150e26',
                '--theme-bg': '#0a0714', '--theme-bg-soft': '#0e0818', '--theme-card': '#17102a',
                '--theme-text': '#e8e0ff', '--theme-text-muted': '#cfc4f0', '--theme-text-dim': '#b0a2d8', '--theme-text-faint': '#9486c4',
                '--theme-border': '#281e3d', '--theme-border-soft': '#1a1229', '--theme-border-input': '#281e3d',
                '--theme-gradient': 'linear-gradient(45deg, #a78bfa 0%, #c4b5fd 100%)',
                '--theme-shadow': 'rgba(167, 139, 250, 0.3)', '--theme-shadow-soft': 'rgba(167, 139, 250, 0.2)',
                '--theme-nav-bg': 'rgba(10, 7, 20, 0.98)'
            },
            dark: {
                '--theme-primary': '#a78bfa', '--theme-accent': '#c4b5fd', '--theme-primary-dark': '#8b5cf6',
                '--theme-primary-soft': '#2a1e3d', '--theme-primary-soft-2': '#150e26',
                '--theme-bg': '#0a0714', '--theme-bg-soft': '#0e0818', '--theme-card': '#17102a',
                '--theme-text': '#e8e0ff', '--theme-text-muted': '#b0a0d0', '--theme-text-dim': '#8878b0', '--theme-text-faint': '#665a88',
                '--theme-border': '#281e3d', '--theme-border-soft': '#1a1229', '--theme-border-input': '#281e3d',
                '--theme-gradient': 'linear-gradient(45deg, #a78bfa 0%, #c4b5fd 100%)',
                '--theme-shadow': 'rgba(167, 139, 250, 0.3)', '--theme-shadow-soft': 'rgba(167, 139, 250, 0.2)',
                '--theme-nav-bg': 'rgba(10, 7, 20, 0.98)'
            }
        },
        cafe: {
            name: 'Café', sub: 'Rainy · Cozy', emoji: '☕',
            preview: { primary: '#8B5E3C', gradient: 'linear-gradient(135deg, #8B5E3C 0%, #D2B48C 100%)' },
            light: {
                '--theme-primary': '#8B5E3C', '--theme-accent': '#D2B48C', '--theme-primary-dark': '#6B4226',
                '--theme-primary-soft': '#F5E6D3', '--theme-primary-soft-2': '#FAF3E8',
                '--theme-bg': '#FDF8F2', '--theme-bg-soft': '#F9F1E7', '--theme-card': '#FFFFFF',
                '--theme-text': '#3E2C1C', '--theme-text-muted': '#6B5A4A', '--theme-text-dim': '#9C8A7A', '--theme-text-faint': '#C4B5A5',
                '--theme-border': '#EDE0D0', '--theme-border-soft': '#F5EDE2', '--theme-border-input': '#DCC8B0',
                '--theme-gradient': 'linear-gradient(45deg, #8B5E3C 0%, #D2B48C 100%)',
                '--theme-shadow': 'rgba(139, 94, 60, 0.15)', '--theme-shadow-soft': 'rgba(139, 94, 60, 0.2)',
                '--theme-nav-bg': 'rgba(253, 248, 242, 0.98)'
            },
            dark: {
                '--theme-primary': '#C49A6C', '--theme-accent': '#D2B48C', '--theme-primary-dark': '#A67B5B',
                '--theme-primary-soft': '#3D2E1E', '--theme-primary-soft-2': '#1E150E',
                '--theme-bg': '#1A120B', '--theme-bg-soft': '#241A12', '--theme-card': '#241A12',
                '--theme-text': '#F0E6D8', '--theme-text-muted': '#C4B5A0', '--theme-text-dim': '#A09080', '--theme-text-faint': '#7D6E60',
                '--theme-border': '#3A2C1E', '--theme-border-soft': '#2A1E14', '--theme-border-input': '#3A2C1E',
                '--theme-gradient': 'linear-gradient(45deg, #C49A6C 0%, #D2B48C 100%)',
                '--theme-shadow': 'rgba(196, 154, 108, 0.25)', '--theme-shadow-soft': 'rgba(196, 154, 108, 0.18)',
                '--theme-nav-bg': 'rgba(26, 18, 11, 0.98)'
            }
        },
        crimson: {
            name: 'Crimson', sub: 'Poppy · Bold', emoji: '🌹',
            preview: { primary: '#dc2626', gradient: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)' },
            light: {
                '--theme-primary': '#dc2626', '--theme-accent': '#f87171', '--theme-primary-dark': '#b91c1c',
                '--theme-primary-soft': '#fee2e2', '--theme-primary-soft-2': '#fef2f2',
                '--theme-bg': '#ffffff', '--theme-bg-soft': '#fff5f5', '--theme-card': '#ffffff',
                '--theme-text': '#3a1018', '--theme-text-muted': '#6b2530', '--theme-text-dim': '#8a4550', '--theme-text-faint': '#b0808a',
                '--theme-border': '#fde8e8', '--theme-border-soft': '#fef3f3', '--theme-border-input': '#fbd5d5',
                '--theme-gradient': 'linear-gradient(45deg, #dc2626 0%, #f87171 100%)',
                '--theme-shadow': 'rgba(220, 38, 38, 0.15)', '--theme-shadow-soft': 'rgba(220, 38, 38, 0.2)',
                '--theme-nav-bg': 'rgba(255, 255, 255, 0.98)'
            },
            dark: {
                '--theme-primary': '#ef4444', '--theme-accent': '#fca5a5', '--theme-primary-dark': '#dc2626',
                '--theme-primary-soft': '#3d1a1a', '--theme-primary-soft-2': '#1e0e0e',
                '--theme-bg': '#1a0a0a', '--theme-bg-soft': '#241010', '--theme-card': '#241010',
                '--theme-text': '#fbe5e5', '--theme-text-muted': '#c9a0a0', '--theme-text-dim': '#a57a7a', '--theme-text-faint': '#7d5a5a',
                '--theme-border': '#3a1a1a', '--theme-border-soft': '#2a1010', '--theme-border-input': '#3a1a1a',
                '--theme-gradient': 'linear-gradient(45deg, #ef4444 0%, #fca5a5 100%)',
                '--theme-shadow': 'rgba(239, 68, 68, 0.25)', '--theme-shadow-soft': 'rgba(239, 68, 68, 0.18)',
                '--theme-nav-bg': 'rgba(26, 10, 10, 0.98)'
            }
        },
        maroon: {
            name: 'Maroon', sub: 'Library · Classic', emoji: '🍷',
            preview: { primary: '#800000', gradient: 'linear-gradient(135deg, #800000 0%, #a52a2a 100%)' },
            light: {
                '--theme-primary': '#800000', '--theme-accent': '#a52a2a', '--theme-primary-dark': '#5c0000',
                '--theme-primary-soft': '#f5e6e6', '--theme-primary-soft-2': '#faf0f0',
                '--theme-bg': '#fdf8f8', '--theme-bg-soft': '#f9f0f0', '--theme-card': '#ffffff',
                '--theme-text': '#3a1010', '--theme-text-muted': '#6b2525', '--theme-text-dim': '#8a4545', '--theme-text-faint': '#b08080',
                '--theme-border': '#e8d5d5', '--theme-border-soft': '#f0e0e0', '--theme-border-input': '#d4b5b5',
                '--theme-gradient': 'linear-gradient(45deg, #800000 0%, #a52a2a 100%)',
                '--theme-shadow': 'rgba(128, 0, 0, 0.15)', '--theme-shadow-soft': 'rgba(128, 0, 0, 0.2)',
                '--theme-nav-bg': 'rgba(253, 248, 248, 0.98)'
            },
            dark: {
                '--theme-primary': '#a52a2a', '--theme-accent': '#c04040', '--theme-primary-dark': '#800000',
                '--theme-primary-soft': '#2a1515', '--theme-primary-soft-2': '#1a0d0d',
                '--theme-bg': '#120808', '--theme-bg-soft': '#1a0f0f', '--theme-card': '#1a0f0f',
                '--theme-text': '#f0e0e0', '--theme-text-muted': '#c4a0a0', '--theme-text-dim': '#a08080', '--theme-text-faint': '#7d6060',
                '--theme-border': '#2e1a1a', '--theme-border-soft': '#221212', '--theme-border-input': '#2e1a1a',
                '--theme-gradient': 'linear-gradient(45deg, #a52a2a 0%, #c04040 100%)',
                '--theme-shadow': 'rgba(165, 42, 42, 0.25)', '--theme-shadow-soft': 'rgba(165, 42, 42, 0.18)',
                '--theme-nav-bg': 'rgba(18, 8, 8, 0.98)'
            }
        },
        sakura: {
            name: 'Sakura', sub: 'Shrine · Dawn', emoji: '🌸',
            preview: { primary: '#ff8fab', gradient: 'linear-gradient(135deg, #ffb7c5 0%, #ff8fab 100%)' },
            light: {
                '--theme-primary': '#ff8fab', '--theme-accent': '#ffb7c5', '--theme-primary-dark': '#e57399',
                '--theme-primary-soft': '#ffe4ec', '--theme-primary-soft-2': '#fff0f5',
                '--theme-bg': '#fff9fb', '--theme-bg-soft': '#fff5f8', '--theme-card': '#ffffff',
                '--theme-text': '#3a1f2b', '--theme-text-muted': '#7a5563', '--theme-text-dim': '#a88091', '--theme-text-faint': '#d4b3bf',
                '--theme-border': '#ffe0ea', '--theme-border-soft': '#ffeef4', '--theme-border-input': '#ffd0dd',
                '--theme-gradient': 'linear-gradient(45deg, #ff8fab 0%, #ffb7c5 100%)',
                '--theme-shadow': 'rgba(255, 143, 171, 0.18)', '--theme-shadow-soft': 'rgba(255, 143, 171, 0.22)',
                '--theme-nav-bg': 'rgba(255, 249, 251, 0.98)'
            },
            dark: {
                '--theme-primary': '#ffa5b8', '--theme-accent': '#ffc8d4', '--theme-primary-dark': '#e57a94',
                '--theme-primary-soft': '#3d1f2c', '--theme-primary-soft-2': '#1e0f17',
                '--theme-bg': '#1a0e14', '--theme-bg-soft': '#241420', '--theme-card': '#241420',
                '--theme-text': '#fbe5ed', '--theme-text-muted': '#c9a0b3', '--theme-text-dim': '#a57a8f', '--theme-text-faint': '#7d5a6c',
                '--theme-border': '#3a1f2c', '--theme-border-soft': '#2a1520', '--theme-border-input': '#3a1f2c',
                '--theme-gradient': 'linear-gradient(45deg, #ffa5b8 0%, #ffc8d4 100%)',
                '--theme-shadow': 'rgba(255, 165, 184, 0.28)', '--theme-shadow-soft': 'rgba(255, 165, 184, 0.20)',
                '--theme-nav-bg': 'rgba(26, 14, 20, 0.98)'
            }
        },
        nebula: {
            name: 'Nebula', sub: 'Orbit · Cosmic', emoji: '🌌',
            preview: { primary: '#7c3aed', gradient: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 50%, #ec4899 100%)' },
            light: {
                '--theme-primary': '#7c3aed', '--theme-accent': '#ec4899', '--theme-primary-dark': '#6d28d9',
                '--theme-primary-soft': '#f3e8ff', '--theme-primary-soft-2': '#fdf2f8',
                '--theme-bg': '#fdf7ff', '--theme-bg-soft': '#f9f0ff', '--theme-card': '#ffffff',
                '--theme-text': '#2a1e4d', '--theme-text-muted': '#5a4b80', '--theme-text-dim': '#8a7ca8', '--theme-text-faint': '#beb5d4',
                '--theme-border': '#ecdff5', '--theme-border-soft': '#f5eafb', '--theme-border-input': '#dcc8ee',
                '--theme-gradient': 'linear-gradient(45deg, #7c3aed 0%, #ec4899 100%)',
                '--theme-shadow': 'rgba(124, 58, 237, 0.2)', '--theme-shadow-soft': 'rgba(236, 72, 153, 0.18)',
                '--theme-nav-bg': 'rgba(253, 247, 255, 0.98)'
            },
            dark: {
                '--theme-primary': '#a78bfa', '--theme-accent': '#f472b6', '--theme-primary-dark': '#8b5cf6',
                '--theme-primary-soft': '#2a1e4d', '--theme-primary-soft-2': '#150e26',
                '--theme-bg': '#06030f', '--theme-bg-soft': '#0e0720', '--theme-card': '#150a28',
                '--theme-text': '#ede5ff', '--theme-text-muted': '#b8a8e0', '--theme-text-dim': '#8878b0', '--theme-text-faint': '#665a88',
                '--theme-border': '#2a1e4d', '--theme-border-soft': '#1a1229', '--theme-border-input': '#2a1e4d',
                '--theme-gradient': 'linear-gradient(45deg, #a78bfa 0%, #f472b6 100%)',
                '--theme-shadow': 'rgba(167, 139, 250, 0.4)', '--theme-shadow-soft': 'rgba(244, 114, 182, 0.28)',
                '--theme-nav-bg': 'rgba(6, 3, 15, 0.98)'
            }
        },
        ember: {
            name: 'Ember', sub: 'Lantern · Glow', emoji: '🔥',
            preview: { primary: '#f97316', gradient: 'linear-gradient(135deg, #7c2d12 0%, #f97316 50%, #dc2626 100%)' },
            light: {
                '--theme-primary': '#ea580c', '--theme-accent': '#dc2626', '--theme-primary-dark': '#c2410c',
                '--theme-primary-soft': '#ffedd5', '--theme-primary-soft-2': '#fff7ed',
                '--theme-bg': '#fff8f2', '--theme-bg-soft': '#fef3e8', '--theme-card': '#ffffff',
                '--theme-text': '#3a1f0f', '--theme-text-muted': '#6b4a30', '--theme-text-dim': '#a57852', '--theme-text-faint': '#d4b096',
                '--theme-border': '#f5e0c8', '--theme-border-soft': '#faecd8', '--theme-border-input': '#e8c8a8',
                '--theme-gradient': 'linear-gradient(45deg, #ea580c 0%, #dc2626 100%)',
                '--theme-shadow': 'rgba(234, 88, 12, 0.2)', '--theme-shadow-soft': 'rgba(220, 38, 38, 0.18)',
                '--theme-nav-bg': 'rgba(255, 248, 242, 0.98)'
            },
            dark: {
                '--theme-primary': '#fb923c', '--theme-accent': '#ef4444', '--theme-primary-dark': '#f97316',
                '--theme-primary-soft': '#3d1a0a', '--theme-primary-soft-2': '#1e0e05',
                '--theme-bg': '#0f0805', '--theme-bg-soft': '#1a0f0a', '--theme-card': '#1a0f0a',
                '--theme-text': '#fbe8d9', '--theme-text-muted': '#c9b0a0', '--theme-text-dim': '#a58a78', '--theme-text-faint': '#7d6858',
                '--theme-border': '#3a2015', '--theme-border-soft': '#2a1a10', '--theme-border-input': '#3a2015',
                '--theme-gradient': 'linear-gradient(45deg, #fb923c 0%, #ef4444 100%)',
                '--theme-shadow': 'rgba(251, 146, 60, 0.4)', '--theme-shadow-soft': 'rgba(239, 68, 68, 0.3)',
                '--theme-nav-bg': 'rgba(15, 8, 5, 0.98)'
            }
        },
        autumn: {
            name: 'Autumn', sub: 'Birch · Harvest', emoji: '🍁',
            preview: { primary: '#ea580c', gradient: 'linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #f59e0b 100%)' },
            light: {
                '--theme-primary': '#ea580c', '--theme-accent': '#f59e0b', '--theme-primary-dark': '#c2410c',
                '--theme-primary-soft': '#fee8d4', '--theme-primary-soft-2': '#fff5ea',
                '--theme-bg': '#fffbf5', '--theme-bg-soft': '#fdf5ea', '--theme-card': '#ffffff',
                '--theme-text': '#3a1f0f', '--theme-text-muted': '#6b4a30', '--theme-text-dim': '#a57852', '--theme-text-faint': '#d4b096',
                '--theme-border': '#f5e0c8', '--theme-border-soft': '#faecd8', '--theme-border-input': '#e8c8a8',
                '--theme-gradient': 'linear-gradient(45deg, #ea580c 0%, #f59e0b 100%)',
                '--theme-shadow': 'rgba(234, 88, 12, 0.18)', '--theme-shadow-soft': 'rgba(245, 158, 11, 0.22)',
                '--theme-nav-bg': 'rgba(255, 251, 245, 0.98)'
            },
            dark: {
                '--theme-primary': '#fb923c', '--theme-accent': '#fbbf24', '--theme-primary-dark': '#f97316',
                '--theme-primary-soft': '#3d2010', '--theme-primary-soft-2': '#1e1008',
                '--theme-bg': '#1a0f08', '--theme-bg-soft': '#241812', '--theme-card': '#241812',
                '--theme-text': '#fbe8d8', '--theme-text-muted': '#c9b0a0', '--theme-text-dim': '#a58a78', '--theme-text-faint': '#7d6858',
                '--theme-border': '#3a2015', '--theme-border-soft': '#2a1a10', '--theme-border-input': '#3a2015',
                '--theme-gradient': 'linear-gradient(45deg, #fb923c 0%, #fbbf24 100%)',
                '--theme-shadow': 'rgba(251, 146, 60, 0.3)', '--theme-shadow-soft': 'rgba(251, 191, 36, 0.22)',
                '--theme-nav-bg': 'rgba(26, 15, 8, 0.98)'
            }
        },
        glacier: {
            name: 'Glacier', sub: 'Alpine · Crisp', emoji: '🧊',
            preview: { primary: '#67e8f9', gradient: 'linear-gradient(135deg, #67e8f9 0%, #bae6fd 100%)' },
            light: {
                '--theme-primary': '#0891b2', '--theme-accent': '#67e8f9', '--theme-primary-dark': '#0e7490',
                '--theme-primary-soft': '#e0f7fa', '--theme-primary-soft-2': '#f0fbfd',
                '--theme-bg': '#f8fdff', '--theme-bg-soft': '#effaff', '--theme-card': '#ffffff',
                '--theme-text': '#0f2a35', '--theme-text-muted': '#3d5c6a', '--theme-text-dim': '#6b8a99', '--theme-text-faint': '#a0bcc7',
                '--theme-border': '#d8f0f7', '--theme-border-soft': '#e8f7fb', '--theme-border-input': '#bfe6f0',
                '--theme-gradient': 'linear-gradient(45deg, #0891b2 0%, #67e8f9 100%)',
                '--theme-shadow': 'rgba(8, 145, 178, 0.15)', '--theme-shadow-soft': 'rgba(103, 232, 249, 0.22)',
                '--theme-nav-bg': 'rgba(248, 253, 255, 0.98)'
            },
            dark: {
                '--theme-primary': '#22d3ee', '--theme-accent': '#67e8f9', '--theme-primary-dark': '#06b6d4',
                '--theme-primary-soft': '#0f2a35', '--theme-primary-soft-2': '#08181e',
                '--theme-bg': '#061217', '--theme-bg-soft': '#0f1e24', '--theme-card': '#0f1e24',
                '--theme-text': '#e0f7fc', '--theme-text-muted': '#a0c4d0', '--theme-text-dim': '#7a9ca8', '--theme-text-faint': '#5a7c88',
                '--theme-border': '#1a3040', '--theme-border-soft': '#122028', '--theme-border-input': '#1a3040',
                '--theme-gradient': 'linear-gradient(45deg, #22d3ee 0%, #67e8f9 100%)',
                '--theme-shadow': 'rgba(34, 211, 238, 0.3)', '--theme-shadow-soft': 'rgba(103, 232, 249, 0.22)',
                '--theme-nav-bg': 'rgba(6, 18, 23, 0.98)'
            }
        },
        tropic: {
            name: 'Tropic', sub: 'Fronds · Island', emoji: '🌴',
            preview: { primary: '#f43f5e', gradient: 'linear-gradient(135deg, #f43f5e 0%, #fbbf24 100%)' },
            light: {
                '--theme-primary': '#f43f5e', '--theme-accent': '#fbbf24', '--theme-primary-dark': '#e11d48',
                '--theme-primary-soft': '#ffe4e6', '--theme-primary-soft-2': '#fff1f2',
                '--theme-bg': '#fffaf0', '--theme-bg-soft': '#fff5e6', '--theme-card': '#ffffff',
                '--theme-text': '#3a1f2b', '--theme-text-muted': '#6b4a50', '--theme-text-dim': '#9c7a80', '--theme-text-faint': '#c4a5aa',
                '--theme-border': '#ffe4d0', '--theme-border-soft': '#fff0e0', '--theme-border-input': '#fdd0b8',
                '--theme-gradient': 'linear-gradient(45deg, #f43f5e 0%, #fbbf24 100%)',
                '--theme-shadow': 'rgba(244, 63, 94, 0.18)', '--theme-shadow-soft': 'rgba(251, 191, 36, 0.22)',
                '--theme-nav-bg': 'rgba(255, 250, 240, 0.98)'
            },
            dark: {
                '--theme-primary': '#fb7185', '--theme-accent': '#fbbf24', '--theme-primary-dark': '#f43f5e',
                '--theme-primary-soft': '#3d1f2b', '--theme-primary-soft-2': '#1e0f15',
                '--theme-bg': '#1a0f10', '--theme-bg-soft': '#241818', '--theme-card': '#241818',
                '--theme-text': '#fbe5e8', '--theme-text-muted': '#c9a0a5', '--theme-text-dim': '#a57a82', '--theme-text-faint': '#7d5a62',
                '--theme-border': '#3a1f26', '--theme-border-soft': '#2a151b', '--theme-border-input': '#3a1f26',
                '--theme-gradient': 'linear-gradient(45deg, #fb7185 0%, #fbbf24 100%)',
                '--theme-shadow': 'rgba(251, 113, 133, 0.3)', '--theme-shadow-soft': 'rgba(251, 191, 36, 0.22)',
                '--theme-nav-bg': 'rgba(26, 15, 16, 0.98)'
            }
        },
        moonlit: {
            name: 'Moonlit', sub: 'Serene · Desert', emoji: '🌙',
            preview: { primary: '#94a3b8', gradient: 'linear-gradient(135deg, #1e293b 0%, #94a3b8 50%, #e2e8f0 100%)' },
            light: {
                '--theme-primary': '#64748b', '--theme-accent': '#94a3b8', '--theme-primary-dark': '#475569',
                '--theme-primary-soft': '#e2e8f0', '--theme-primary-soft-2': '#f1f5f9',
                '--theme-bg': '#f8fafc', '--theme-bg-soft': '#f1f5f9', '--theme-card': '#ffffff',
                '--theme-text': '#0f172a', '--theme-text-muted': '#3a4759', '--theme-text-dim': '#64748b', '--theme-text-faint': '#94a3b8',
                '--theme-border': '#e2e8f0', '--theme-border-soft': '#eef2f6', '--theme-border-input': '#cbd5e1',
                '--theme-gradient': 'linear-gradient(45deg, #64748b 0%, #94a3b8 100%)',
                '--theme-shadow': 'rgba(100, 116, 139, 0.15)', '--theme-shadow-soft': 'rgba(148, 163, 184, 0.22)',
                '--theme-nav-bg': 'rgba(248, 250, 252, 0.98)'
            },
            dark: {
                '--theme-primary': '#cbd5e1', '--theme-accent': '#e2e8f0', '--theme-primary-dark': '#94a3b8',
                '--theme-primary-soft': '#1e293b', '--theme-primary-soft-2': '#0f172a',
                '--theme-bg': '#0a1020', '--theme-bg-soft': '#141c30', '--theme-card': '#141c30',
                '--theme-text': '#e2e8f0', '--theme-text-muted': '#a0aec4', '--theme-text-dim': '#7a8aa0', '--theme-text-faint': '#5a6a80',
                '--theme-border': '#1f2a44', '--theme-border-soft': '#162036', '--theme-border-input': '#1f2a44',
                '--theme-gradient': 'linear-gradient(45deg, #cbd5e1 0%, #e2e8f0 100%)',
                '--theme-shadow': 'rgba(203, 213, 225, 0.25)', '--theme-shadow-soft': 'rgba(226, 232, 240, 0.18)',
                '--theme-nav-bg': 'rgba(10, 16, 32, 0.98)'
            }
        },
        aurora: {
            name: 'Aurora', sub: 'Arctic · Night', emoji: '🌠',
            preview: { primary: '#34d399', gradient: 'linear-gradient(135deg, #0f172a 0%, #34d399 50%, #a78bfa 100%)' },
            light: {
                '--theme-primary': '#059669', '--theme-accent': '#7c3aed', '--theme-primary-dark': '#047857',
                '--theme-primary-soft': '#d1fae5', '--theme-primary-soft-2': '#ecfdf5',
                '--theme-bg': '#f0fdfa', '--theme-bg-soft': '#f7fefb', '--theme-card': '#ffffff',
                '--theme-text': '#0f2a25', '--theme-text-muted': '#3d5c55', '--theme-text-dim': '#6b8a82', '--theme-text-faint': '#a0bcc4',
                '--theme-border': '#d5efe6', '--theme-border-soft': '#e6f6f0', '--theme-border-input': '#bfe4d8',
                '--theme-gradient': 'linear-gradient(45deg, #059669 0%, #7c3aed 100%)',
                '--theme-shadow': 'rgba(5, 150, 105, 0.18)', '--theme-shadow-soft': 'rgba(124, 58, 237, 0.15)',
                '--theme-nav-bg': 'rgba(240, 253, 250, 0.98)'
            },
            dark: {
                '--theme-primary': '#34d399', '--theme-accent': '#c4b5fd', '--theme-primary-dark': '#10b981',
                '--theme-primary-soft': '#0f2a25', '--theme-primary-soft-2': '#08181a',
                '--theme-bg': '#04100f', '--theme-bg-soft': '#0a1818', '--theme-card': '#0a1818',
                '--theme-text': '#e0fff4', '--theme-text-muted': '#a0d4c4', '--theme-text-dim': '#7aa89c', '--theme-text-faint': '#5a7c72',
                '--theme-border': '#1a3028', '--theme-border-soft': '#122019', '--theme-border-input': '#1a3028',
                '--theme-gradient': 'linear-gradient(45deg, #34d399 0%, #c4b5fd 100%)',
                '--theme-shadow': 'rgba(52, 211, 153, 0.4)', '--theme-shadow-soft': 'rgba(196, 181, 253, 0.3)',
                '--theme-nav-bg': 'rgba(4, 16, 15, 0.98)'
            }
        },
        matcha: {
            name: 'Matcha', sub: 'Garden · Zen', emoji: '🍵',
            preview: { primary: '#84cc16', gradient: 'linear-gradient(135deg, #65a30d 0%, #a3e635 100%)' },
            light: {
                '--theme-primary': '#65a30d', '--theme-accent': '#a3e635', '--theme-primary-dark': '#4d7c0f',
                '--theme-primary-soft': '#ecfccb', '--theme-primary-soft-2': '#f7fee7',
                '--theme-bg': '#fefdf7', '--theme-bg-soft': '#f7f8ed', '--theme-card': '#ffffff',
                '--theme-text': '#1f2a0f', '--theme-text-muted': '#4a5c2a', '--theme-text-dim': '#7a8a5c', '--theme-text-faint': '#b5c096',
                '--theme-border': '#e8f0d0', '--theme-border-soft': '#f0f5e0', '--theme-border-input': '#d4e0a8',
                '--theme-gradient': 'linear-gradient(45deg, #65a30d 0%, #a3e635 100%)',
                '--theme-shadow': 'rgba(101, 163, 13, 0.15)', '--theme-shadow-soft': 'rgba(163, 230, 53, 0.22)',
                '--theme-nav-bg': 'rgba(254, 253, 247, 0.98)'
            },
            dark: {
                '--theme-primary': '#a3e635', '--theme-accent': '#bef264', '--theme-primary-dark': '#84cc16',
                '--theme-primary-soft': '#1a2810', '--theme-primary-soft-2': '#0d1a08',
                '--theme-bg': '#0a1408', '--theme-bg-soft': '#131f10', '--theme-card': '#131f10',
                '--theme-text': '#e8f7d9', '--theme-text-muted': '#a8c490', '--theme-text-dim': '#7a9c60', '--theme-text-faint': '#5a7c40',
                '--theme-border': '#1f3518', '--theme-border-soft': '#162510', '--theme-border-input': '#1f3518',
                '--theme-gradient': 'linear-gradient(45deg, #a3e635 0%, #bef264 100%)',
                '--theme-shadow': 'rgba(163, 230, 53, 0.3)', '--theme-shadow-soft': 'rgba(190, 242, 100, 0.22)',
                '--theme-nav-bg': 'rgba(10, 20, 8, 0.98)'
            }
        }
    };

    window.DEFAULT_THEME = { preset: 'ocean', mode: 'light' };
    window.selectedTheme = { ...window.DEFAULT_THEME };

    window.injectThemeShapes = function (presetKey) {
        const container = document.getElementById('themeBgShapes');
        if (!container) return;
        if (!presetKey || !window.THEME_SHAPES[presetKey]) {
            console.warn('injectThemeShapes: unknown preset "' + presetKey + '"');
            return;
        }
        if (container.dataset.activeTheme !== presetKey) {
            const hadScene = !!container.dataset.activeTheme;
            container.innerHTML = window.THEME_SHAPES[presetKey];
            container.dataset.activeTheme = presetKey;
            // v6: soft cross-fade when the user switches scenes (not on first paint)
            if (hadScene) {
                container.classList.remove('tw-swap');
                void container.offsetWidth;
                container.classList.add('tw-swap');
                setTimeout(() => container.classList.remove('tw-swap'), 900);
            }
        }
    };

    window.applyTheme = function (theme) {
        const safeTheme = (theme && typeof theme === 'object') ? theme : {};
        const presetKey = (safeTheme.preset && window.THEMES[safeTheme.preset])
            ? safeTheme.preset
            : window.DEFAULT_THEME.preset;
        const mode = safeTheme.mode === 'dark' ? 'dark' : 'light';
        const preset = window.THEMES[presetKey];
        const palette = preset[mode];
        const root = document.documentElement;
        Object.keys(palette).forEach(key => {
            root.style.setProperty(key, palette[key]);
        });
        root.setAttribute('data-timawa-theme', presetKey);
        root.setAttribute('data-timawa-mode', mode);
        root.style.colorScheme = mode; // v6: native form controls / scrollbars follow the mode
        window.injectThemeShapes(presetKey);
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = palette['--theme-bg'];
        window.selectedTheme = { preset: presetKey, mode };
    };

    window.readThemeFromStorage = function () {
        try {
            const raw = localStorage.getItem(window.THEME_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.preset && window.THEMES[parsed.preset]) {
                return { preset: parsed.preset, mode: parsed.mode === 'dark' ? 'dark' : 'light' };
            }
        } catch (e) { /* ignore */ }
        return null;
    };

    window.persistThemeLocally = function (theme) {
        if (!theme || typeof theme !== 'object') return;
        if (!theme.preset || !window.THEMES[theme.preset]) return;
        try {
            localStorage.setItem(window.THEME_STORAGE_KEY, JSON.stringify({
                preset: theme.preset,
                mode: theme.mode === 'dark' ? 'dark' : 'light'
            }));
        } catch (e) { /* ignore */ }
    };

    window.broadcastThemeChange = function (theme) {
        if (!theme || typeof theme !== 'object') return;
        if (!theme.preset || !window.THEMES[theme.preset]) return;
        const safe = {
            preset: theme.preset,
            mode: theme.mode === 'dark' ? 'dark' : 'light'
        };
        try {
            if ('BroadcastChannel' in window) {
                const bc = new BroadcastChannel('timawa_theme_sync');
                bc.postMessage({ type: 'theme-change', theme: safe });
                bc.close();
            }
        } catch (e) { /* ignore */ }
        try {
            window.dispatchEvent(new CustomEvent(window.THEME_EVENT, { detail: safe }));
        } catch (e) { /* ignore */ }
    };

    (function bootTheme() {
        const cached = window.readThemeFromStorage();
        if (cached) window.selectedTheme = cached;
        window.applyTheme(window.selectedTheme);
    })();

    try {
        if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('timawa_theme_sync');
            bc.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'theme-change' && event.data.theme) {
                    const incoming = event.data.theme;
                    if (!incoming.preset || !window.THEMES[incoming.preset]) return;
                    window.selectedTheme = {
                        preset: incoming.preset,
                        mode: incoming.mode === 'dark' ? 'dark' : 'light'
                    };
                    window.applyTheme(window.selectedTheme);
                    try {
                        localStorage.setItem(window.THEME_STORAGE_KEY, JSON.stringify(window.selectedTheme));
                    } catch (e) { /* ignore */ }
                }
            });
        }
    } catch (e) { /* ignore */ }

    function ensureShapesInjected() {
        const container = document.getElementById('themeBgShapes');
        if (!container) return;
        const currentPreset = document.documentElement.getAttribute('data-timawa-theme')
            || window.selectedTheme.preset
            || window.DEFAULT_THEME.preset;
        const currentMode = document.documentElement.getAttribute('data-timawa-mode')
            || window.selectedTheme.mode
            || window.DEFAULT_THEME.mode;
        container.dataset.activeTheme = '';
        window.applyTheme({ preset: currentPreset, mode: currentMode });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureShapesInjected);
    } else {
        ensureShapesInjected();
    }

    window.addEventListener('load', () => {
        setTimeout(ensureShapesInjected, 100);
    });

    // ── perf hooks: pause when hidden, lite mode on weak devices ──
    (function perfHooks() {
        const root = document.documentElement;
        try {
            const c = navigator.connection || {};
            if ((navigator.deviceMemory && navigator.deviceMemory <= 2) ||
                (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || c.saveData)
                root.setAttribute('data-tw-lite', '');
        } catch (e) { /* ignore */ }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) root.setAttribute('data-tw-paused', '');
            else root.removeAttribute('data-tw-paused');
        });
    })();
})();