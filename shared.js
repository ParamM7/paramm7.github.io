/* =========================================================================
   shared.js — site-wide behavior
   ========================================================================= */
(function () {
  'use strict';

  /* --- PREFS (persistent) ------------------------------------------------ */
  const PREFS_KEY = 'pm_prefs_v1';
  const DEFAULTS = { theme: 'light', accent: 'ember', motion: 'standard', type: 'grotesk-mono' };
  function loadPrefs() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); }
    catch { return { ...DEFAULTS }; }
  }
  function savePrefs(p) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }
  const prefs = loadPrefs();

  function applyPrefs() {
    const html = document.documentElement;
    if (prefs.theme === 'dark') html.setAttribute('data-theme', 'dark');
    else html.removeAttribute('data-theme');
    html.setAttribute('data-accent', prefs.accent);
    html.setAttribute('data-motion', prefs.motion);
    html.setAttribute('data-type', prefs.type);
  }
  applyPrefs();

  /* --- NAV behavior ------------------------------------------------------ */
  function initNav() {
    const nav = document.querySelector('nav.site');
    if (!nav) return;
    const onScroll = () => {
      if (window.scrollY > 8) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // mark active
    const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    nav.querySelectorAll('.nav-links a').forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (href === here || (here === '' && href === 'index.html')) a.classList.add('active');
    });

    // hamburger
    const burger = nav.querySelector('.nav-hamburger');
    const links = nav.querySelector('.nav-links');
    if (burger && links) {
      burger.addEventListener('click', () => {
        links.classList.toggle('open');
        burger.setAttribute('aria-expanded', links.classList.contains('open'));
      });
    }

    // theme toggle
    const tt = nav.querySelector('.theme-toggle');
    if (tt) {
      tt.addEventListener('click', () => {
        prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
        savePrefs(prefs); applyPrefs();
        updateTweaks();
      });
    }
  }

  /* --- Reveal on scroll -------------------------------------------------- */
  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => io.observe(el));
  }

  /* --- Word reveal for hero name ---------------------------------------- */
  function initWordReveal() {
    document.querySelectorAll('.word-reveal').forEach((el, i) => {
      el.style.setProperty('--word-delay', (i * 110) + 'ms');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    });
  }

  /* --- AMBIENT FLOW FIELD (vector field advection)
     Used as page-header and section background. Particles advected through
     a curl-noise-like flow. Quiet, slow; respects motion pref.
     ------------------------------------------------------------------ */
  function createFlowField(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const density = opts.density ?? 0.00028;
    const maxLife = opts.maxLife ?? 140;
    const color = opts.color || 'rgba(10,22,40,0.18)';
    const accentColor = opts.accent || 'rgba(196,69,54,0.55)';
    const speed = opts.speed ?? 0.9;
    const accentRate = opts.accentRate ?? 0.12;
    const scale = opts.scale ?? 0.0025;
    let particles = [];
    let t = 0;
    let mouseX = 0, mouseY = 0, mouseActive = false;
    let animId = null;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const target = Math.floor(W * H * density);
      particles = [];
      for (let i = 0; i < target; i++) particles.push(spawn());
    }

    function spawn(fromEdge = false) {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        life: Math.random() * maxLife,
        accent: Math.random() < accentRate
      };
    }

    // pseudo curl noise using sines
    function field(x, y, time) {
      const s = scale;
      const a = Math.sin(x * s + time * 0.6) + Math.cos(y * s * 1.4 - time * 0.3);
      const b = Math.cos(x * s * 0.8 - time * 0.2) + Math.sin(y * s * 1.2 + time * 0.4);
      // light cursor attraction
      let mx = 0, my = 0;
      if (mouseActive) {
        const dx = x - mouseX, dy = y - mouseY;
        const d2 = dx * dx + dy * dy;
        const r = 180;
        if (d2 < r * r) {
          const k = (1 - Math.sqrt(d2) / r) * 0.8;
          mx = -dy / (Math.sqrt(d2) + 1) * k;
          my = dx / (Math.sqrt(d2) + 1) * k;
        }
      }
      return { vx: a * 0.7 + mx, vy: b * 0.7 + my };
    }

    function step() {
      t += 0.006;
      // fade trail
      ctx.fillStyle = (document.documentElement.getAttribute('data-theme') === 'dark')
        ? 'rgba(10,13,18,0.08)' : 'rgba(246,245,241,0.12)';
      ctx.fillRect(0, 0, W, H);

      for (let p of particles) {
        const f = field(p.x, p.y, t);
        const nx = p.x + f.vx * speed;
        const ny = p.y + f.vy * speed;
        // stroke the segment
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = p.accent ? accentColor : color;
        ctx.lineWidth = p.accent ? 1.2 : 0.7;
        ctx.stroke();

        p.x = nx; p.y = ny;
        p.life--;
        if (p.life <= 0 || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) {
          p.x = Math.random() * W;
          p.y = Math.random() * H;
          p.life = maxLife;
          p.accent = Math.random() < accentRate;
        }
      }
      animId = requestAnimationFrame(step);
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      mouseActive = true;
      clearTimeout(onMove._t);
      onMove._t = setTimeout(() => mouseActive = false, 1500);
    }
    const scope = opts.interactive ? window : null;

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    if (scope) scope.addEventListener('mousemove', onMove);

    resize();
    step();

    return {
      destroy() {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', onResize);
        if (scope) scope.removeEventListener('mousemove', onMove);
      }
    };
  }

  /* --- TAYLOR BUBBLE SIMULATION ------------------------------------------
     A capillary channel with a train of gas slugs (Taylor bubbles) advecting
     through liquid. Interface drawn with signed-distance-like approach. An
     external electric field deforms the bubble (control surface below).
     ------------------------------------------------------------------ */
  function createTaylorSim(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    let t = 0;
    const state = {
      Ef: opts.Ef ?? 0.55,       // electric field strength 0..1
      speed: opts.speed ?? 1.0,  // flow velocity
      bubbles: []
    };
    let animId = null;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seedBubbles();
    }

    function seedBubbles() {
      state.bubbles = [];
      const n = 4;
      for (let i = 0; i < n; i++) {
        state.bubbles.push({
          x: -W * 0.1 + (W * 1.2 / n) * i,
          w: 140 + Math.random() * 70,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    // color helpers
    function colors() {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c44536';
      return {
        bg: dark ? '#0a0d12' : '#efede6',
        wall: dark ? '#e9e5db' : '#0a1628',
        liquid: dark ? '#6ea8ff' : '#1a4fad',
        bubble: dark ? '#e9e5db' : '#fbfaf7',
        accent
      };
    }

    function step() {
      t += 0.01;
      const c = colors();
      // bg
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      // capillary channel band
      const cy = H / 2;
      const rInner = Math.min(H * 0.33, 70);
      const rOuter = rInner + 8;

      // velocity contour (ambient streaks in liquid)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, cy - rInner, W, rInner * 2);
      ctx.clip();
      ctx.globalAlpha = 0.18;
      for (let y = -rInner; y <= rInner; y += 6) {
        const ny = cy + y;
        const v = 1 - Math.pow(y / rInner, 2); // parabolic
        const dash = Math.max(4, v * 40);
        ctx.strokeStyle = c.liquid;
        ctx.lineWidth = 1;
        ctx.setLineDash([dash, 60]);
        ctx.lineDashOffset = -t * 60 * state.speed * v;
        ctx.beginPath();
        ctx.moveTo(0, ny);
        ctx.lineTo(W, ny);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();

      // bubbles (Taylor slugs). Update positions.
      for (const b of state.bubbles) {
        b.x += 0.7 * state.speed;
        if (b.x - b.w / 2 > W + 40) {
          b.x = -40 - b.w / 2;
          b.w = 140 + Math.random() * 70;
        }
      }
      state.bubbles.sort((a, bb) => a.x - bb.x);

      // draw each bubble as a capsule distorted by EHD
      for (const b of state.bubbles) {
        const elong = 1 + state.Ef * 0.6;           // elongation along flow
        const pinch = 1 - state.Ef * 0.25;          // narrowing radial
        const wobble = Math.sin(t * 3 + b.phase) * state.Ef * 3.5;
        const bw = b.w * elong;
        const br = (rInner - 6) * pinch;
        const x0 = b.x - bw / 2;
        const x1 = b.x + bw / 2;

        // bubble shape — rounded capsule with EHD tip distortion
        ctx.beginPath();
        const tipL = br * (1 + state.Ef * 0.35);
        const tipR = br * (1 + state.Ef * 0.35);
        // top
        ctx.moveTo(x0 + br, cy - br + wobble * 0.3);
        ctx.lineTo(x1 - br, cy - br - wobble * 0.3);
        // right cap (elongated if Ef high)
        ctx.bezierCurveTo(x1 - br + tipR * 0.5, cy - br, x1 + tipR * 0.7, cy - br * 0.5, x1 + tipR * 0.9, cy);
        ctx.bezierCurveTo(x1 + tipR * 0.7, cy + br * 0.5, x1 - br + tipR * 0.5, cy + br, x1 - br, cy + br);
        // bottom
        ctx.lineTo(x0 + br, cy + br);
        // left cap (slight rear elongation)
        const backTip = tipL * (0.4 + state.Ef * 0.2);
        ctx.bezierCurveTo(x0 + br - backTip * 0.5, cy + br, x0 - backTip * 0.6, cy + br * 0.4, x0 - backTip * 0.7, cy);
        ctx.bezierCurveTo(x0 - backTip * 0.6, cy - br * 0.4, x0 + br - backTip * 0.5, cy - br, x0 + br, cy - br);
        ctx.closePath();
        // bubble fill
        const grad = ctx.createLinearGradient(0, cy - br, 0, cy + br);
        grad.addColorStop(0, c.bubble);
        grad.addColorStop(1, c.bg);
        ctx.fillStyle = grad;
        ctx.fill();
        // interface
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Maxwell stress arrows at the caps (when Ef high)
        if (state.Ef > 0.25) {
          ctx.strokeStyle = c.accent;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.7;
          const len = 10 + state.Ef * 12;
          // right cap
          drawArrow(ctx, x1 + tipR * 0.9, cy, x1 + tipR * 0.9 + len, cy);
          drawArrow(ctx, x0 - backTip * 0.7, cy, x0 - backTip * 0.7 - len * 0.6, cy);
          ctx.globalAlpha = 1;
        }
      }

      // capillary walls
      ctx.strokeStyle = c.wall;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(0, cy - rInner - 2); ctx.lineTo(W, cy - rInner - 2);
      ctx.moveTo(0, cy + rInner + 2); ctx.lineTo(W, cy + rInner + 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // hatching on walls
      ctx.strokeStyle = c.wall;
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.3;
      for (let x = 0; x < W; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, cy - rInner - 2); ctx.lineTo(x + 6, cy - rInner - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, cy + rInner + 2); ctx.lineTo(x + 6, cy + rInner + 10);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // E field indicator lines at edges (above/below)
      if (state.Ef > 0.1) {
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.25 + state.Ef * 0.25;
        ctx.setLineDash([2, 4]);
        const yTop = cy - rInner - 22;
        const yBot = cy + rInner + 22;
        for (let x = 10; x < W - 10; x += 14) {
          ctx.beginPath();
          ctx.moveTo(x, yTop);
          ctx.lineTo(x, yTop + 6);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, yBot);
          ctx.lineTo(x, yBot - 6);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // labels
      ctx.fillStyle = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'rgba(233,229,219,.55)' : 'rgba(10,22,40,.55)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(`E = ${state.Ef.toFixed(2)} · Co ≤ 0.5`, 10, 14);
      ctx.textAlign = 'right';
      ctx.fillText('interEHDFoam · VoF + Maxwell', W - 10, 14);
      animId = requestAnimationFrame(step);
    }

    function drawArrow(c, x1, y1, x2, y2) {
      c.beginPath();
      c.moveTo(x1, y1); c.lineTo(x2, y2);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const ah = 4;
      c.moveTo(x2, y2);
      c.lineTo(x2 - ah * Math.cos(ang - Math.PI / 6), y2 - ah * Math.sin(ang - Math.PI / 6));
      c.moveTo(x2, y2);
      c.lineTo(x2 - ah * Math.cos(ang + Math.PI / 6), y2 - ah * Math.sin(ang + Math.PI / 6));
      c.stroke();
    }

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    resize();
    step();

    return {
      setEf(v) { state.Ef = Math.max(0, Math.min(1, v)); },
      setSpeed(v) { state.speed = Math.max(0.1, Math.min(3, v)); },
      destroy() {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', onResize);
      }
    };
  }

  /* --- TWEAKS PANEL ------------------------------------------------------ */
  let tweakEl = null;
  function initTweaks() {
    if (document.querySelector('.tweaks')) return;
    const html = `
      <div class="tweaks" id="tweaks-panel" aria-hidden="true">
        <h5>
          <span>Tweaks</span>
          <button id="tweaks-close" title="Close">×</button>
        </h5>
        <div class="tweak-group">
          <label>Accent color</label>
          <div class="tweak-swatches">
            <button class="tweak-swatch" data-accent="ember" style="background:#c44536" title="Ember"></button>
            <button class="tweak-swatch" data-accent="copper" style="background:#b86840" title="Copper"></button>
            <button class="tweak-swatch" data-accent="forest" style="background:#3d7d5b" title="Forest"></button>
            <button class="tweak-swatch" data-accent="indigo" style="background:#3a5fb5" title="Indigo"></button>
            <button class="tweak-swatch" data-accent="ink" style="background:#0a1628" title="Ink"></button>
          </div>
        </div>
        <div class="tweak-group">
          <label>Type pairing</label>
          <div class="tweak-pills">
            <button class="tweak-pill" data-type="grotesk-mono">IBM Plex Sans</button>
            <button class="tweak-pill" data-type="serif-sans">Newsreader + Inter</button>
            <button class="tweak-pill" data-type="archivo">Archivo</button>
          </div>
        </div>
        <div class="tweak-group">
          <label>Motion intensity</label>
          <div class="tweak-pills">
            <button class="tweak-pill" data-motion="calm">Calm</button>
            <button class="tweak-pill" data-motion="standard">Standard</button>
            <button class="tweak-pill" data-motion="expressive">Expressive</button>
          </div>
        </div>
        <div class="tweak-group">
          <label>Theme</label>
          <div class="tweak-pills">
            <button class="tweak-pill" data-theme="light">Light</button>
            <button class="tweak-pill" data-theme="dark">Dark</button>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
    tweakEl = document.getElementById('tweaks-panel');

    tweakEl.addEventListener('click', (e) => {
      const t = e.target.closest('[data-accent],[data-type],[data-motion],[data-theme]');
      if (t) {
        if (t.dataset.accent) prefs.accent = t.dataset.accent;
        if (t.dataset.type) prefs.type = t.dataset.type;
        if (t.dataset.motion) prefs.motion = t.dataset.motion;
        if (t.dataset.theme) prefs.theme = t.dataset.theme;
        savePrefs(prefs); applyPrefs(); updateTweaks();
      }
      if (e.target.id === 'tweaks-close') closeTweaks();
    });

    window.addEventListener('message', (ev) => {
      const m = ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.type === '__activate_edit_mode') openTweaks();
      if (m.type === '__deactivate_edit_mode') closeTweaks();
    });
    // announce availability AFTER listener is live
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}

    updateTweaks();
  }

  function openTweaks() { tweakEl && tweakEl.classList.add('open'); }
  function closeTweaks() { tweakEl && tweakEl.classList.remove('open'); }

  function updateTweaks() {
    if (!tweakEl) return;
    tweakEl.querySelectorAll('.tweak-swatch').forEach(b =>
      b.classList.toggle('active', b.dataset.accent === prefs.accent));
    tweakEl.querySelectorAll('.tweak-pill').forEach(b => {
      if (b.dataset.type) b.classList.toggle('active', b.dataset.type === prefs.type);
      if (b.dataset.motion) b.classList.toggle('active', b.dataset.motion === prefs.motion);
      if (b.dataset.theme) b.classList.toggle('active', b.dataset.theme === prefs.theme);
    });
  }

  /* --- footer year ------------------------------------------------------- */
  function initFooter() {
    document.querySelectorAll('.footer-year').forEach(el => el.textContent = new Date().getFullYear());
  }

  /* --- expose ------------------------------------------------------------ */
  window.PM = {
    createFlowField,
    createTaylorSim,
    prefs
  };

  /* --- boot -------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initReveal();
    initWordReveal();
    initFooter();
    initTweaks();

    // auto-mount ambient flow canvases on .page-header[data-flow]
    document.querySelectorAll('.page-header[data-flow]').forEach(ph => {
      const c = document.createElement('canvas');
      c.className = 'ambient';
      ph.insertBefore(c, ph.firstChild);
      createFlowField(c, { density: 0.00025, speed: 0.6, accentRate: 0.08 });
    });
  });
})();
