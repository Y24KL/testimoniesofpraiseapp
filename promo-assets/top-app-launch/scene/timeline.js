/* Deterministic timeline for the T.O.P. promo. renderAt(t) positions everything from t (seconds). */
(function () {
  const $ = (id) => document.getElementById(id);
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ramp = (t, a, b) => cl((t - a) / (b - a));
  const eo = (x) => 1 - Math.pow(1 - x, 3);            // ease-out cubic
  const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const vis = (t, a, b, fi = 0.5, fo = 0.5) => Math.min(eo(ramp(t, a, a + fi)), 1 - ramp(t, b - fo, b));
  const lerp = (a, b, x) => a + (b - a) * x;
  const set = (el, o, tf, extra) => { el.style.opacity = o.toFixed(3); el.style.visibility = o <= 0.001 ? 'hidden' : 'visible'; if (tf !== undefined) el.style.transform = tf; if (extra) Object.assign(el.style, extra); };
  // reveal: fade + rise + un-blur, from time a
  const reveal = (el, t, a, d = 0.6, rise = 28, out) => {
    const x = eo(ramp(t, a, a + d));
    let o = x;
    if (out) o = Math.min(o, 1 - ramp(t, out[0], out[1]));
    set(el, o, `translateY(${(1 - x) * rise}px)`, { filter: x < 1 ? `blur(${((1 - x) * 8).toFixed(2)}px)` : 'none' });
  };

  // ---------- one-time DOM setup ----------
  const thumbs = [0, 1, 2, 3, 4, 5];
  const wall = $('wall');
  wall.style.transform = 'perspective(1800px) rotateX(14deg) rotateZ(-7deg) scale(1.25)';
  const tiles = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    const d = document.createElement('div');
    d.className = 'thumb';
    d.innerHTML = `<img src="../assets/ui/thumb${thumbs[(r * 3 + c) % 6]}.jpg"/>`;
    d.style.left = (c * 380 - 400) + 'px'; d.style.top = (r * 256 - 120) + 'px';
    wall.appendChild(d); tiles.push({ el: d, r, c });
  }
  const hookWordsEl = $('hookWords');
  const HW = [['healing', 6.26], ['hope', 7.25], ['restoration', 7.83], ['miracles', 9.11], ['transformation', 9.82]];
  const hw = HW.map(([w, at], i) => {
    const d = document.createElement('div');
    d.textContent = w;
    d.style.cssText = `font-weight:800;font-size:96px;line-height:1.02;letter-spacing:-.02em;${i === HW.length - 1 ? '' : ''}`;
    if (i === HW.length - 1) d.className = 'gold';
    hookWordsEl.appendChild(d);
    return { d, at };
  });
  const tail = document.createElement('div');
  tail.className = 'body'; tail.style.marginTop = '26px'; tail.style.fontSize = '34px';
  tail.textContent = 'to countless lives around the world';
  hookWordsEl.appendChild(tail);

  const parts = $('particles');
  const P = [];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const el = document.createElement('i');
    parts.appendChild(el);
    P.push({ el, x: rnd() * 1920, y: rnd() * 1080, v: 10 + rnd() * 26, s: 0.4 + rnd() * 0.9, ph: rnd() * 6.28, a: 0.25 + rnd() * 0.55 });
  }
  const chips3 = [...$('s3chips').children], at3 = [28.75, 30.75, 33.05, 34.6];
  const chips4 = [...$('s4chips').children], at4 = [39.15, 40.5, 41.05, 43.2];
  const chips7 = [...$('s7chips').children];
  const CAPS = window.CAPTIONS || [];

  window.renderAt = function (t) {
    // background breathe + particles
    $('bgGlow').style.transform = `scale(${1 + 0.04 * Math.sin(t * 0.35)}) translateX(${Math.sin(t * 0.13) * 30}px)`;
    for (const p of P) {
      const y = ((p.y - p.v * t) % 1180 + 1180) % 1180 - 50;
      const x = p.x + Math.sin(t * 0.5 + p.ph) * 18;
      p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${p.s})`;
      p.el.style.opacity = (p.a * (0.6 + 0.4 * Math.sin(t * 1.3 + p.ph))).toFixed(3);
    }

    // ---- S0 hook (0 – 13.1)
    const s0 = vis(t, 0.2, 13.1, 1.2, 0.5);
    set($('s0'), s0);
    if (s0 > 0) {
      const drift = -t * 22;
      for (const tl of tiles) tl.el.style.transform = `translateX(${drift + (tl.r % 2 ? -190 : 0)}px)`;
      wall.style.opacity = (0.75 * eo(ramp(t, 0.2, 2.5)) - 0.3 * ramp(t, 5.6, 6.6)).toFixed(3);
      wall.style.filter = `blur(${lerp(6, 1.5, eo(ramp(t, 0, 5)))}px) saturate(1.1)`;
      reveal($('hookEyebrow'), t, 0.9, 0.7, 20, [5.6, 6.0]);
      reveal($('hookText'), t, 1.25, 0.8, 34, [5.6, 6.05]);
      hw.forEach(({ d, at }, i) => {
        const x = eo(ramp(t, at - 0.12, at + 0.35));
        const next = hw[i + 1] ? eo(ramp(t, hw[i + 1].at - 0.1, hw[i + 1].at + 0.3)) : 0;
        const dim = i === hw.length - 1 ? 1 : lerp(1, 0.42, next);
        set(d, x * dim, `translateY(${(1 - x) * 40}px) scale(${lerp(1.08, 1, x)})`, { filter: x < 1 ? `blur(${(1 - x) * 10}px)` : 'none' });
      });
      reveal(tail, t, 10.75, 0.7, 20);
    }

    // ---- S1 impact (12.9 – 23.0)
    const s1 = vis(t, 12.9, 23.0, 0.5, 0.5);
    set($('s1'), s1, `scale(${lerp(0.98, 1.02, ramp(t, 12.9, 23))})`);
    if (s1 > 0) {
      const n = Math.round(500 * eio(ramp(t, 14.75, 15.95)));
      $('count').textContent = n + (n >= 500 ? '+' : '');
      reveal($('count'), t, 14.7, 0.5, 40);
      reveal($('impactSub'), t, 16.4, 0.7, 24);
      reveal($('impactSub2'), t, 19.6, 0.8, 20);
      $('s1').children[0].style.opacity = eo(ramp(t, 13.3, 13.9)).toFixed(3);
    }

    // ---- S2 logo (22.9 – 27.45)
    const s2 = vis(t, 22.9, 27.45, 0.5, 0.5);
    set($('s2'), s2);
    if (s2 > 0) {
      const x = eo(ramp(t, 22.95, 24.3));
      $('logoWrap').style.transform = `scale(${lerp(0.82, 1, x) + 0.04 * ramp(t, 24.3, 27.45)})`;
      $('logoWrap').style.filter = x < 1 ? `blur(${(1 - x) * 12}px)` : 'none';
      $('logoHalo').style.opacity = (0.55 + 0.45 * Math.sin(ramp(t, 23, 24.6) * Math.PI)).toFixed(3);
      reveal($('credit'), t, 24.9, 0.7, 16);
    }

    // ---- S3 home (27.25 – 36.6)
    const s3 = vis(t, 27.25, 36.6, 0.5, 0.45);
    set($('s3'), s3);
    if (s3 > 0) {
      const x = eo(ramp(t, 27.25, 28.3));
      $('ph3').style.transform = `perspective(2200px) translateY(${(1 - x) * 120}px) rotateY(${lerp(-16, -7, ramp(t, 27.25, 36.6))}deg) rotateX(3deg) scale(${lerp(0.96, 1.03, ramp(t, 27.25, 36.6))})`;
      reveal($('s3text'), t, 27.5, 0.7, 30);
      chips3.forEach((c, i) => { const y = eo(ramp(t, at3[i] - 0.15, at3[i] + 0.4)); set(c, y, `translateX(${(1 - y) * -40}px)`); });
    }

    // ---- S4 testimonies (36.4 – 45.2)
    const s4 = vis(t, 36.4, 45.2, 0.5, 0.45);
    set($('s4'), s4);
    if (s4 > 0) {
      const x = eo(ramp(t, 36.4, 37.4));
      $('ph4').style.transform = `perspective(2200px) translateY(${(1 - x) * 120}px) rotateY(${lerp(14, 6, ramp(t, 36.4, 45.2))}deg) rotateX(3deg)`;
      const y = eio(ramp(t, 37.6, 38.6));
      set($('pop4'), Math.min(1, y * 1.5), `perspective(2000px) translate(${lerp(-300, 40, y)}px, ${lerp(80, -20, y)}px) scale(${lerp(0.82, 1.22, y) + 0.03 * ramp(t, 38.6, 45)}) rotateY(${lerp(10, -4, y)}deg)`);
      reveal($('s4text'), t, 36.7, 0.7, 30);
      chips4.forEach((c, i) => { const z = eo(ramp(t, at4[i] - 0.15, at4[i] + 0.4)); set(c, z, `translateY(${(1 - z) * 24}px) scale(${lerp(0.9, 1, z)})`); });
    }

    // ---- S5 live + radio (45.0 – 52.35)
    const s5 = vis(t, 45.0, 52.35, 0.45, 0.45);
    set($('s5'), s5);
    if (s5 > 0) {
      const a = eo(ramp(t, 45.1, 46.1)), b = eo(ramp(t, 45.6, 46.6));
      $('ph5a').style.transform = `perspective(2200px) translateY(${(1 - a) * 140}px) rotateY(-10deg) scale(.96)`;
      $('ph5b').style.transform = `perspective(2200px) translateY(${(1 - b) * 140 + 30}px) rotateY(-10deg) scale(.9)`;
      $('ph5b').style.opacity = b.toFixed(3);
      reveal($('s5text'), t, 45.3, 0.7, 30);
      $('liveDot').style.transform = `scale(${1 + 0.06 * Math.max(0, Math.sin(t * 5))})`;
      $('liveDot').style.boxShadow = `0 0 ${18 + 14 * Math.max(0, Math.sin(t * 5))}px rgba(255,59,78,.7)`;
    }

    // ---- S6 Praxiom (52.2 – 63.55)
    const s6 = vis(t, 52.2, 63.55, 0.45, 0.45);
    set($('s6'), s6);
    if (s6 > 0) {
      const x = eo(ramp(t, 52.25, 53.3));
      $('ph6').style.transform = `perspective(2200px) translateY(${(1 - x) * 120}px) rotateY(${lerp(14, 7, ramp(t, 52.2, 63.5))}deg) rotateX(3deg)`;
      reveal($('s6text'), t, 52.6, 0.7, 30);
      reveal($('s6body'), t, 53.6, 0.7, 20);
      reveal($('scrub'), t, 57.65, 0.6, 40);
      const k = eio(ramp(t, 60.2, 61.35)) * 0.68;
      $('scrubFill').style.width = (k * 100).toFixed(2) + '%';
      $('scrubKnob').style.left = (k * 100).toFixed(2) + '%';
      const m = eo(ramp(t, 61.25, 61.7));
      set($('scrubMark'), m, `translateX(-50%) translateY(${(1 - m) * 12}px) scale(${lerp(0.7, 1, m)})`);
    }

    // ---- S7 payoff (63.4 – 70.0)
    const s7 = vis(t, 63.4, 70.0, 0.45, 0.45);
    set($('s7'), s7);
    if (s7 > 0) {
      const f = eio(ramp(t, 63.5, 64.7));
      const lift = lerp(0, -10, ramp(t, 63.5, 70));
      $('ph7b').style.transform = `translateY(${(1 - f) * 160 + lift}px) scale(.9)`;
      $('ph7a').style.transform = `translateX(${lerp(198, 0, f)}px) translateY(${(1 - f) * 160 + 40 + lift}px) rotate(${lerp(0, -9, f)}deg) scale(.82)`;
      $('ph7c').style.transform = `translateX(${lerp(-198, 0, f)}px) translateY(${(1 - f) * 160 + 40 + lift}px) rotate(${lerp(0, 9, f)}deg) scale(.82)`;
      $('ph7a').style.opacity = $('ph7c').style.opacity = (0.9 * f).toFixed(3);
      reveal($('s7head'), t, 63.9, 0.7, 24);
      chips7.forEach((c, i) => { const z = eo(ramp(t, 64.9 + i * 0.28, 65.4 + i * 0.28)); set(c, z, `translateY(${(1 - z) * 30}px)`); });
    }

    // ---- S8 CTA (69.8 – 76)
    const s8 = vis(t, 69.8, 80, 0.5, 0.5);
    set($('s8'), s8);
    if (s8 > 0) {
      const x = eo(ramp(t, 69.85, 71.0));
      $('ctaLogo').style.transform = `scale(${lerp(0.85, 1, x)})`;
      $('ctaLogo').style.filter = x < 1 ? `blur(${(1 - x) * 10}px) drop-shadow(0 0 40px rgba(245,197,66,.35))` : 'drop-shadow(0 0 40px rgba(245,197,66,.35))';
      reveal($('ctaText'), t, 70.4, 0.7, 30);
      reveal($('ctaQr'), t, 70.9, 0.7, 30);
    }

    // light sweeps (logo reveal, CTA)
    const sw = (a, b) => ramp(t, a, b);
    let sx = null;
    if (t >= 23.4 && t <= 25.0) sx = sw(23.4, 25.0);
    else if (t >= 70.6 && t <= 72.2) sx = sw(70.6, 72.2);
    const se = $('sweep');
    if (sx === null) se.style.opacity = '0';
    else { se.style.opacity = Math.sin(sx * Math.PI).toFixed(3); se.style.left = lerp(200, 1500, eio(sx)) + 'px'; }

    // captions
    const cue = CAPS.find((c) => t >= c.s && t < c.e);
    const capEl = $('cap');
    if (cue && !window.NO_CAPTIONS) { capEl.classList.remove('off'); $('capText').textContent = cue.t; }
    else capEl.classList.add('off');

    // fade from / to black
    $('fade').style.opacity = Math.max(1 - ramp(t, 0, 0.8), ramp(t, 75.1, 76)).toFixed(3);
  };

  // preview mode: open scene/index.html?play
  if (/[?&]play/.test(location.search)) {
    const audio = new Audio('../build/mix.wav');
    document.addEventListener('click', () => { audio.currentTime = 0; audio.play(); });
    const tick = () => { window.renderAt(audio.currentTime || 0); requestAnimationFrame(tick); };
    tick();
  } else {
    window.renderAt(0);
  }
})();
