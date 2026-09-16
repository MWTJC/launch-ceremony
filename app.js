/* =====================================================================
   启动仪式大屏 · 星辰大海 / 涟漪光圈
   单文件前端的替代实现：多文件版（index.html + styles.css + app.js）
   ===================================================================== */
(function () {
  "use strict";

  /* ================= 0. 常量 · 配置 · 持久化 ================= */
  var W = 1920,
    H = 1080;
  var APEX = { x: W / 2, y: 198 }; /* 流光汇聚的顶部星芒 */
  var Q = new URLSearchParams(location.search);
  var LSKEY = "ceremony-v2";

  var DEF = {
    n: 5,
    ring: 1,
    line: 0.52,
    spread: 1,
    hue: 197 /* 默认主题色相；须与 THEMES.ice.hue 保持一致 */,
    titley: 0.37,
    title: "××项目启动仪式",
    sub: "PROJECT LAUNCH CEREMONY",
    bgm: 1,
    perf: 0,
    dpr: 0,
    pos: "",
  };
  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(LSKEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  var CFG = Object.assign({}, DEF, loadSaved());
  [
    "n",
    "ring",
    "line",
    "spread",
    "hue",
    "titley",
    "bgm",
    "perf",
    "dpr",
  ].forEach(function (k) {
    if (Q.has(k)) CFG[k] = parseFloat(Q.get(k));
  });
  ["title", "sub", "pos"].forEach(function (k) {
    if (Q.has(k)) CFG[k] = Q.get(k);
  });

  var N = Math.max(1, Math.min(8, Math.round(CFG.n)));
  var RINGK = clamp(CFG.ring, 0.3, 3);
  var LINEY = clamp(CFG.line, 0.15, 0.92);
  var SPREADK = clamp(CFG.spread, 0.4, 1.6);

  /* ================= 主题色（换肤入口，看这一段就够） =================
     优先级（左高右低）：?brand=R,G,B  >  ?theme=预设名  >  ?hue=色相  >  DEF.hue（文件默认）
     三种改法：
       1) URL 选预设： index.html?theme=gold
       2) URL 给色相： index.html?hue=42
       3) URL 给品牌色：index.html?brand=228,0,43（用品牌色反推色相，主色直接用品牌色本身）
     永久换肤：改 DEF.hue，或往 THEMES 里加一条并保持一致
       例：mycolor: { hue: 160, hot: '230,255,245', name: '我的主题' }
       改完用 index.html?theme=mycolor 即可（也可把 DEF.hue 设成 160 作为默认）
     注意：主题色【不读 localStorage】，只认 URL 与这里的默认值——避免改了文件却被现场旧存档覆盖。
  ==================================================================== */
  var THEMES = {
    ice: { hue: 197, hot: "234,250,255", name: "冰蓝星辰（默认）" },
    deepblue: { hue: 212, hot: "226,240,255", name: "深海蓝" },
    violet: { hue: 282, hot: "240,236,255", name: "蓝紫" },
    teal: { hue: 172, hot: "226,255,250", name: "青碧" },
    gold: { hue: 42, hot: "255,250,236", name: "鎏金" },
    rose: { hue: 338, hot: "255,240,246", name: "玫红" },
  };
  var TH = THEMES[Q.get("theme")] || null;
  var BRAND = (Q.get("brand") || "").split(",").map(Number);
  var hasBrand =
    BRAND.length === 3 &&
    BRAND.every(function (v) {
      return isFinite(v) && v >= 0 && v <= 255;
    });
  function rgbHue(r, g, b) {
    /* 品牌色 → 色相 */
    r /= 255;
    g /= 255;
    b /= 255;
    var mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      d = mx - mn,
      h = 0;
    if (d) {
      if (mx === r) h = 60 * (((((g - b) / d) % 6) + 6) % 6);
      else if (mx === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    return (h + 360) % 360;
  }
  function mixWhite(rgb, k) {
    /* 向白混合，做高光/核心色 */
    return rgb
      .split(",")
      .map(function (v) {
        return Math.round(+v + (255 - +v) * k);
      })
      .join(",");
  }
  var HUE = hasBrand
    ? rgbHue(BRAND[0], BRAND[1], BRAND[2])
    : TH
      ? TH.hue
      : Q.has("hue")
        ? clamp(parseFloat(Q.get("hue")), 0, 359)
        : DEF.hue;

  var PERF = CFG.perf === 1;
  var DPRQ = CFG.dpr;
  /* 快门时间（秒）：决定动量拖尾的物理长度——拖尾 = 星在快门时间内真实走过的投影轨迹 */
  var SHUTTER = clamp(parseFloat(Q.get("shutter") || "0.26"), 0.04, 1.2);

  var custom = []; /* 现场拖动后的绝对坐标 */
  (function () {
    if (!CFG.pos) return;
    CFG.pos.split(";").forEach(function (pair, i) {
      var p = pair.split(",");
      if (p.length === 2)
        custom[i] = { x: parseFloat(p[0]), y: parseFloat(p[1]) };
    });
  })();

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  /* ================= 1. 配色（统一单色相） ================= */
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = l - c / 2,
      r,
      g,
      b;
    if (h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }
    return (
      Math.round((r + m) * 255) +
      "," +
      Math.round((g + m) * 255) +
      "," +
      Math.round((b + m) * 255)
    );
  }
  var C = {
    deep: hsl2rgb(HUE, 68, 4) /* 底色 */,
    base: hasBrand ? BRAND.join(",") : hsl2rgb(HUE, 88, 46) /* 光圈/流光主色 */,
    glow: hsl2rgb(HUE, 92, 56) /* 光晕 */,
    mid: hsl2rgb(HUE, 100, 68) /* 亮部 */,
    hi: hsl2rgb(HUE, 100, 82) /* 高光 */,
    pale: hsl2rgb(HUE, 100, 92) /* 极亮 */,
    white: TH
      ? TH.hot
      : hasBrand
        ? mixWhite(BRAND.join(","), 0.86)
        : "234,250,255" /* 核心白（随主题偏暖/偏冷） */,
  };

  /* ================= 2. 精灵缓存 ================= */
  function sprite(w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  var _glow = {},
    _star = {},
    _col = {};
  function mkGlow(rgb) {
    if (_glow[rgb]) return _glow[rgb];
    var s = 256,
      c = sprite(s, s),
      g = c.getContext("2d");
    var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "rgba(" + rgb + ",1)");
    gr.addColorStop(0.2, "rgba(" + rgb + ",0.55)");
    gr.addColorStop(0.52, "rgba(" + rgb + ",0.16)");
    gr.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    _glow[rgb] = c;
    return c;
  }
  function mkStar(rgb) {
    if (_star[rgb]) return _star[rgb];
    var s = 128,
      c = sprite(s, s),
      g = c.getContext("2d"),
      cx = s / 2,
      cy = s / 2;
    var lh = g.createLinearGradient(0, 0, s, 0);
    lh.addColorStop(0, "rgba(" + rgb + ",0)");
    lh.addColorStop(0.5, "rgba(" + rgb + ",0.85)");
    lh.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = lh;
    g.fillRect(0, cy - 1.6, s, 3.2);
    var lv = g.createLinearGradient(0, 0, 0, s);
    lv.addColorStop(0, "rgba(" + rgb + ",0)");
    lv.addColorStop(0.5, "rgba(" + rgb + ",0.85)");
    lv.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = lv;
    g.fillRect(cx - 1.6, 0, 3.2, s);
    var rg = g.createRadialGradient(cx, cy, 0, cx, cy, 12);
    rg.addColorStop(0, "rgba(" + rgb + ",1)");
    rg.addColorStop(0.4, "rgba(" + rgb + ",0.5)");
    rg.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, s, s);
    _star[rgb] = c;
    return c;
  }
  function mkCol(rgb) {
    /* 垂直流光柱 */
    if (_col[rgb]) return _col[rgb];
    var s = sprite(64, 512),
      g = s.getContext("2d");
    var gv = g.createLinearGradient(0, 0, 0, 512);
    gv.addColorStop(0, "rgba(" + rgb + ",0)");
    gv.addColorStop(0.42, "rgba(" + rgb + ",0.26)");
    gv.addColorStop(0.82, "rgba(" + rgb + ",0.62)");
    gv.addColorStop(1, "rgba(" + rgb + ",0.92)");
    g.fillStyle = gv;
    g.fillRect(0, 0, 64, 512);
    g.globalCompositeOperation = "destination-in";
    var gh = g.createLinearGradient(0, 0, 64, 0);
    gh.addColorStop(0, "rgba(0,0,0,0)");
    gh.addColorStop(0.5, "rgba(0,0,0,1)");
    gh.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gh;
    g.fillRect(0, 0, 64, 512);
    _col[rgb] = s;
    return s;
  }
  var _vig = null;
  function vignette() {
    if (_vig) return _vig;
    var s = 512,
      c = sprite(s, s),
      g = c.getContext("2d");
    var gr = g.createRadialGradient(
      s / 2,
      s / 2,
      s * 0.22,
      s / 2,
      s / 2,
      s * 0.74,
    );
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(0.7, "rgba(0,0,0,0.30)");
    gr.addColorStop(1, "rgba(0,0,0,0.80)");
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    _vig = c;
    return c;
  }

  /* ================= 3. DOM ================= */
  var cv = document.getElementById("cv");
  var ctx = cv.getContext("2d", { alpha: false });
  var stage = document.getElementById("stage");
  var $t1 = document.getElementById("t1"),
    $t2 = document.getElementById("t2");
  var $guide = document.getElementById("guideText");
  var $hint = document.getElementById("hint");
  var $toast = document.getElementById("toast");
  var $audio = document.getElementById("bgm");
  var $awarn = document.getElementById("audioWarn");
  var $cfgbox = document.getElementById("cfgbox");
  $t1.textContent = CFG.title;
  $t2.textContent = CFG.sub;
  var $tw = document.querySelector(".titleWrap");
  function applyTitlePos() {
    /* 标题基线：块向上生长，永不裁切 */
    CFG.titley = clamp(CFG.titley, 0.14, 0.8);
    $tw.style.bottom = Math.round((1 - CFG.titley) * H) + "px";
  }
  applyTitlePos();

  var DPR = 1,
    S = 1; /* 画布像素比 / 舞台缩放 */
  function setup() {
    DPR = PERF
      ? 1
      : DPRQ > 0
        ? DPRQ
        : Math.min(window.devicePixelRatio || 1, 1.5);
    stage.style.width = W + "px";
    stage.style.height = H + "px";
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    if ($tw) $tw.style.width = W + "px";
    if ($guide) $guide.style.width = W + "px";
  }
  function fit() {
    /* 设计画布宽度按屏幕实际比例自适应 → 16:9 / 16:10 / 4:3 / 21:9 / 32:9(双屏) 均满屏无黑边 */
    var vw = window.innerWidth,
      vh = window.innerHeight;
    var want = clamp(Math.round((H * vw) / Math.max(1, vh)), 1280, 3840);
    if (want !== W) {
      W = want;
      APEX.x = W / 2;
      cam.cx = W / 2;
      setup();
      layout();
      initAmbient();
      if (tpartOn) initTitleParticles();
    }
    S = Math.min(vw / W, vh / H);
    stage.style.transform =
      "translate(" +
      (vw - W * S) / 2 +
      "px," +
      (vh - H * S) / 2 +
      "px) scale(" +
      S +
      ")";
  }

  /* ================= 4. 环境层：3D星野 / 星云 / 流光柱 ================= */
  /* 手写透视投影（技法取自 rstyro/html5 的 project3D）：零依赖的真三维景深 */
  var cam = {
    x: 0,
    y: 0,
    yaw: 0,
    pitch: -0.055,
    focal: 900,
    cx: W / 2,
    cy: H / 2,
    cosyaw: 1,
    sinyaw: 0,
    cospitch: 1,
    sinpitch: 0,
  };
  var ZFAR = 3200,
    ZNEAR = 60;
  function proj3(x, y, z) {
    var x1 = x - cam.x,
      y1 = y - cam.y;
    var rx = x1 * cam.cosyaw - z * cam.sinyaw,
      rz = x1 * cam.sinyaw + z * cam.cosyaw;
    var ry = y1 * cam.cospitch - rz * cam.sinpitch,
      rz2 = y1 * cam.sinpitch + rz * cam.cospitch;
    if (rz2 < ZNEAR) return null;
    var k = cam.focal / rz2;
    return { x: cam.cx + rx * k, y: cam.cy + ry * k, k: k, z: rz2 };
  }
  function spawnLocal(lx, ly, z) {
    /* 相机局部坐标 → 世界坐标（yaw 的精确逆变换） */
    var c = Math.cos(cam.yaw),
      s = Math.sin(cam.yaw);
    return { x: lx * c + z * s + cam.x, y: ly + cam.y, z: -lx * s + z * c };
  }
  function newStar(atFar) {
    var k = ZFAR / cam.focal;
    var w = spawnLocal(
      (Math.random() - 0.5) * W * k * 1.12,
      (Math.random() - 0.5) * H * k * 1.12,
      ZFAR,
    );
    return {
      x: w.x,
      y: w.y,
      z: atFar ? ZFAR : ZNEAR + Math.random() * (ZFAR - ZNEAR),
      r: 1.0 + Math.random() * 3.3,
      sp: 0.5 + Math.random() * 0.95,
      ph: Math.random() * 6.28,
      tw: 0.35 + Math.random() * 0.65,
    };
  }
  /* 粒子拖影缓冲（半分辨率 → 软拖影 + 低开销） */
  var trailCv = null,
    tctx = null,
    TRAIL = Q.get("trail") !== "0";
  function initTrail() {
    if (!trailCv) trailCv = document.createElement("canvas");
    trailCv.width = Math.round(W / 2);
    trailCv.height = Math.round(H / 2);
    tctx = trailCv.getContext("2d");
  }
  /* 流星 */
  var comets = [];
  function newComet(spread) {
    var a = Math.random() * Math.PI * 2,
      sp = 300 + Math.random() * 520;
    return {
      x: spread ? Math.random() * W : Math.random() < 0.5 ? -240 : W + 240,
      y: Math.random() * H * 0.85,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * 0.35 - 30,
      len: 200 + Math.random() * 460,
      life: 0,
      max: 2.2 + Math.random() * 3.0,
      w: 2.2 + Math.random() * 3.4,
      rgb: Math.random() < 0.5 ? C.white : C.pale,
    };
  }
  function initComets() {
    comets = [];
    var nc = PERF ? 4 : 9;
    for (var i = 0; i < nc; i++) comets.push(newComet(true));
  }
  var stars = [],
    nebs = [],
    cols = [];
  function initAmbient() {
    stars = [];
    var NS = PERF ? 260 : 720;
    for (var i = 0; i < NS; i++) stars.push(newStar(true));
    initTrail();
    initComets();
    nebs = [
      { x: W * 0.16, y: H * 0.2, r: 780, vx: 7, vy: 4, a: 0.13 },
      { x: W * 0.86, y: H * 0.14, r: 640, vx: -6, vy: 5, a: 0.11 },
      { x: W * 0.52, y: H * 0.86, r: 980, vx: 5, vy: -6, a: 0.1 },
    ];
    cols = [];
    var NC = PERF ? 7 : 16;
    for (var j = 0; j < NC; j++) {
      cols.push({
        x: Math.random() * W,
        w: 16 + Math.random() * 40,
        h: 220 + Math.random() * 620,
        off: Math.random() * 900,
        sp: 26 + Math.random() * 70,
        a: 0.16 + Math.random() * 0.3,
      });
    }
  }

  /* ================= 5. 站位 · 涟漪光圈 ================= */
  var stations = [];
  function baseR() {
    var m = 150,
      span = (W - 2 * m) * SPREADK;
    var step = N > 1 ? span / (N - 1) : 0;
    return Math.min(168, N > 1 ? step * 0.34 : 190) * RINGK;
  }
  function layout() {
    var m = 150,
      span = (W - 2 * m) * SPREADK;
    var step = N > 1 ? span / (N - 1) : 0;
    var R = baseR();
    stations = [];
    for (var i = 0; i < N; i++) {
      var cu = custom[i] || {};
      var bx = N > 1 ? W / 2 - span / 2 + i * step : W / 2;
      stations.push({
        x: cu.x != null ? cu.x : bx,
        y: cu.y != null ? cu.y : LINEY * H,
        r: R,
        lit: 0,
        ripples: [],
        flare: -1,
        fired: false,
        ph: i * 1.9,
        i: i,
      });
    }
    if ($guide) $guide.style.top = Math.round(LINEY * H + 196) + "px";
  }

  /* ================= 6. 状态机 · 流光 ================= */
  var S_IDLE = 0,
    S_IGNITE = 1,
    S_FINALE = 2,
    S_COUNT = 3;
  var COUNT_N = Math.max(0, Math.min(9, parseInt(Q.get("count") || "3", 10)));
  var stageIdx = S_IDLE,
    st = 0,
    litTarget = 0,
    countShown = -1;
  var streaks = [],
    strands = [],
    bursts = [],
    apexPower = 0;
  var _digits = {};
  function digitSprite(ch) {
    if (_digits[ch]) return _digits[ch];
    var probe = sprite(8, 8).getContext("2d");
    var fam = '800 420px "Microsoft YaHei UI","Microsoft YaHei",sans-serif';
    probe.font = fam;
    var w = Math.ceil(probe.measureText(ch).width) + 80;
    var c = sprite(w, 560),
      g = c.getContext("2d");
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = fam;
    g.shadowColor = "rgba(" + C.hi + ",0.95)";
    g.shadowBlur = 46;
    g.fillStyle = "rgb(" + C.white + ")";
    g.fillText(ch, w / 2, 280);
    g.fillText(ch, w / 2, 280);
    g.fillText(ch, w / 2, 280);
    _digits[ch] = c;
    return c;
  }

  /* ---- ① 粒子聚成标题（星尘汇字） ---- */
  var tpts = [],
    tpart = [],
    tpartOn = 0,
    tptsSig = "";
  function buildTitlePoints() {
    tpts = [];
    var txt = ($t1.textContent || "").trim();
    if (!txt) return;
    var cs = getComputedStyle($t1);
    var rng = document.createRange();
    rng.selectNodeContents($t1);
    var tr = rng.getBoundingClientRect(),
      sr = stage.getBoundingClientRect();
    if (!tr.width || !tr.height) return;
    var x0 = (tr.left - sr.left) / S,
      cy0 = (tr.top + tr.height / 2 - sr.top) / S,
      w0 = tr.width / S,
      h0 = tr.height / S;
    var fs = parseFloat(cs.fontSize);
    var cw = Math.max(8, Math.ceil(w0 * 1.25)),
      chh = Math.max(8, Math.ceil(h0 * 1.8));
    var c = sprite(cw, chh),
      g = c.getContext("2d");
    g.font = cs.fontWeight + " " + fs + "px " + cs.fontFamily;
    if ("letterSpacing" in g) g.letterSpacing = cs.letterSpacing;
    g.textAlign = "left";
    g.textBaseline = "middle";
    var tw = Math.max(1, g.measureText(txt).width);
    g.save();
    g.scale(w0 / tw, 1); /* 横向校正到与实际渲染宽度一致 */
    g.fillStyle = "#fff";
    g.fillText(txt, 0, chh / 2);
    g.restore();
    var img = g.getImageData(0, 0, cw, chh).data;
    var step = PERF ? 9 : 5,
      cap = PERF ? 420 : 900;
    for (var y = 0; y < chh; y += step) {
      for (var x = 0; x < cw; x += step) {
        if (img[(y * cw + x) * 4 + 3] > 120) {
          tpts.push({ x: x0 + x, y: cy0 + (y - chh / 2) });
          if (tpts.length >= cap) return;
        }
      }
    }
  }
  function initTitleParticles() {
    buildTitlePoints();
    tpart = [];
    for (var i = 0; i < tpts.length; i++) {
      var a = Math.random() * 6.2832,
        rad = 620 + Math.random() * 980;
      tpart.push({
        ix: W / 2 + Math.cos(a) * rad,
        iy: H * 0.42 + Math.sin(a) * rad * 0.72,
        tx: tpts[i].x,
        ty: tpts[i].y,
        p: 0,
        d: Math.random() * 0.5,
        ph: Math.random() * 6.2832,
      });
    }
  }
  var DUST = Q.get("dust") !== "0";
  function startDust() {
    if (!DUST) {
      tpartOn = 0;
      tpart = [];
      return;
    }
    tpartOn = 1;
    initTitleParticles();
  }

  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function bez(p0, p1, p2, t) {
    var u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
  }
  function launchStreak(s) {
    var p0 = { x: s.x, y: s.y - s.r * 0.2 };
    var p1 = { x: s.x + (APEX.x - s.x) * 0.22, y: s.y - 420 };
    var sd = { p0: p0, p1: p1, p2: APEX, ph: Math.random() * 6.28, grow: 0 };
    strands.push(sd); /* 先登记，随流光进度逐段生长 */
    return { p0: p0, p1: p1, p2: APEX, t: 0, dur: 1.25, ph: sd.ph, sd: sd };
  }
  function burst() {
    bursts.push({ t: 0 });
  }

  function reset() {
    stageIdx = S_IDLE;
    st = 0;
    litTarget = 0;
    apexPower = 0;
    countShown = -1;
    streaks = [];
    strands = [];
    bursts = [];
    for (var i = 0; i < stations.length; i++) {
      stations[i].lit = 0;
      stations[i].ripples = [];
      stations[i].flare = -1;
      stations[i].fired = false;
    }
    document.body.classList.add("idle");
    document.body.classList.remove("counting");
    tpartOn = 0;
    tpart = [];
    if ($audio) {
      try {
        $audio.pause();
        $audio.currentTime = 0;
      } catch (e) {}
    }
  }
  function advance() {
    if (stageIdx === S_IDLE) {
      document.body.classList.remove("idle");
      if (COUNT_N > 0) {
        /* 3D 倒计时开场 */
        stageIdx = S_COUNT;
        st = 0;
        countShown = -1;
        document.body.classList.add("counting");
      } else {
        stageIdx = S_IGNITE;
        st = 0;
      }
      playBgm();
    } else if (stageIdx === S_COUNT) {
      /* 倒计时中再按一次 = 跳过倒计时 */
      stageIdx = S_IGNITE;
      st = 0;
      document.body.classList.remove("counting");
      startDust();
    } else if (stageIdx === S_IGNITE) {
      stageIdx = S_FINALE;
      st = 0;
    } else {
      reset();
    }
  }

  /* ================= 7. 音频 ================= */
  var bgmWarned = false;
  function playBgm() {
    if (!CFG.bgm || !$audio) return;
    if (!$audio.paused) return; /* 已在播放 */
    var p = $audio.play();
    if (p && p.then)
      p.then(
        function () {
          $awarn.classList.remove("on");
          bgmWarned = false;
        },
        function () {
          if (!bgmWarned) {
            bgmWarned = true;
            $awarn.classList.add("on");
          }
        },
      );
  }

  /* ================= 8. 渲染 ================= */
  var T = 0,
    fpsAcc = 0,
    fpsCnt = 0,
    fpsNow = 0;
  var tStat = { n: 0, sum: 0, min: 1e9, max: 0, drawn: 0, prev: null };
  function frame(now) {
    var dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
    frame.last = now;
    T += dt;
    st += dt;
    var i, j, p, s;

    /* --- 状态推进 --- */
    if (stageIdx === S_COUNT) {
      var cIdx = Math.floor(st / 0.9);
      if (cIdx >= COUNT_N) {
        stageIdx = S_IGNITE;
        st = 0;
        countShown = -1;
        document.body.classList.remove("counting");
      } else if (cIdx !== countShown) {
        countShown = cIdx;
        stations[Math.min(stations.length - 1, cIdx)].ripples.push({ t: 0 });
      }
    }
    if (stageIdx === S_IGNITE) {
      if (!tpartOn) startDust(); /* 进入点亮：星尘开始汇字 */
      litTarget = 0;
      for (i = 0; i < N; i++) if (st > 0.25 + i * 0.42) litTarget = i + 1;
      /* 已点亮但未发射流光的，逐个发射 */
      for (i = 0; i < stations.length; i++) {
        s = stations[i];
        if (i < litTarget && !s.fired && st > 0.25 + i * 0.42 + 0.16) {
          s.fired = true;
          s.flare = 0;
          s.ripples.push({ t: 0 });
          streaks.push(launchStreak(s));
        }
      }
      if (st > 0.25 + (N - 1) * 0.42 + 0.16 + 1.25 + 0.75) {
        stageIdx = S_FINALE;
        st = 0;
      }
    } else if (stageIdx === S_FINALE) {
      litTarget = N;
      for (i = 0; i < stations.length; i++)
        if (!stations[i].fired) {
          stations[i].fired = true;
        }
    } else {
      litTarget = 0;
    }

    /* --- 光圈状态插值 --- */
    for (i = 0; i < stations.length; i++) {
      s = stations[i];
      var on = i < litTarget ? 1 : 0;
      s.lit += (on - s.lit) * Math.min(1, dt * (on ? 3.0 : 3.6));
      if (s.flare >= 0) {
        s.flare += dt / 0.5;
        if (s.flare > 1) s.flare = -1;
      }
      for (j = s.ripples.length - 1; j >= 0; j--) {
        s.ripples[j].t += dt / 1.5;
        if (s.ripples[j].t > 1) s.ripples.splice(j, 1);
      }
    }
    /* --- 流光推进 --- */
    for (i = streaks.length - 1; i >= 0; i--) {
      var sk3 = streaks[i];
      sk3.t += dt / sk3.dur;
      sk3.sd.grow = ease(clamp(sk3.t, 0, 1)); /* 射线随飞行进度生长 */
      if (sk3.t >= 1) {
        sk3.sd.grow = 1;
        streaks.splice(i, 1);
        burst();
        apexPower = Math.min(1, apexPower + 0.26);
      }
    }
    for (i = bursts.length - 1; i >= 0; i--) {
      bursts[i].t += dt / 1.4;
      if (bursts[i].t > 1) bursts.splice(i, 1);
    }
    if (stageIdx === S_FINALE && apexPower < 1)
      apexPower = Math.min(1, apexPower + dt * 0.6);

    /* ================= 绘制 ================= */
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgb(" + C.deep + ")";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    /* 星云（缓慢流动） */
    for (i = 0; i < nebs.length; i++) {
      var nb = nebs[i];
      nb.x += nb.vx * dt;
      nb.y += nb.vy * dt;
      if (nb.x < -nb.r * 0.6) nb.x = W + nb.r * 0.4;
      if (nb.x > W + nb.r * 0.6) nb.x = -nb.r * 0.4;
      if (nb.y < -nb.r * 0.6) nb.y = H + nb.r * 0.4;
      if (nb.y > H + nb.r * 0.6) nb.y = -nb.r * 0.4;
      ctx.globalAlpha = nb.a * (0.85 + 0.15 * Math.sin(T * 0.25 + i));
      ctx.drawImage(
        mkGlow(C.base),
        nb.x - nb.r,
        nb.y - nb.r,
        nb.r * 2,
        nb.r * 2,
      );
    }

    /* 星野（3D 透视 + 半分辨率拖影缓冲） */
    cam.yaw = Math.sin(T * 0.035) * 0.1; /* 有界摆动，永不累积 → 星野不会漂空 */
    cam.cosyaw = Math.cos(cam.yaw);
    cam.sinyaw = Math.sin(cam.yaw);
    cam.cospitch = Math.cos(cam.pitch);
    cam.sinpitch = Math.sin(cam.pitch);
    var warp = stageIdx === S_FINALE ? 1 : 0;
    var zspd = (150 + 880 * warp) * (1 + apexPower * 0.55);
    var useTrail = TRAIL && trailCv && !PERF;
    var tgt = useTrail ? tctx : ctx,
      sc = useTrail ? 0.5 : 1;
    tStat.prev = {
      n: tStat.n,
      sum: tStat.sum,
      min: tStat.min,
      max: tStat.max,
      drawn: tStat.drawn,
    };
    tStat.n = 0;
    tStat.sum = 0;
    tStat.min = 1e9;
    tStat.max = 0;
    tStat.drawn = 0;
    if (useTrail) {
      tctx.globalCompositeOperation = "destination-out";
      tctx.globalAlpha = 1;
      tctx.fillStyle = "rgba(0,0,0,0.20)";
      tctx.fillRect(0, 0, trailCv.width, trailCv.height);
      tctx.globalCompositeOperation = "lighter";
    }
    for (i = 0; i < stars.length; i++) {
      var sk = stars[i];
      sk.z -= zspd * sk.sp * dt;
      if (sk.z < ZNEAR) {
        stars[i] = newStar(false);
        continue;
      }
      var pr = proj3(sk.x, sk.y, sk.z);
      if (!pr) {
        stars[i] = newStar(false);
        continue;
      }
      if (
        pr.x < -W * 0.7 ||
        pr.x > W * 1.7 ||
        pr.y < -H * 0.7 ||
        pr.y > H * 1.7
      ) {
        stars[i] = newStar(true);
        continue;
      }
      var depth = 1 - pr.z / ZFAR; /* 0 远 → 1 近 */
      var tw2 = 0.55 + 0.45 * Math.sin(T * (0.6 + sk.tw * 1.7) + sk.ph);
      var sz = clamp(sk.r * pr.k * 2.3, 0.7, 140);
      var px = pr.x * sc,
        py = pr.y * sc;
      tgt.globalAlpha = clamp(depth * 1.4 * tw2, 0, 1);
      if (sz < 2.6) {
        tgt.fillStyle = "rgb(" + (depth > 0.7 ? C.hi : C.mid) + ")";
        tgt.fillRect(px, py, Math.max(1, sz * sc), Math.max(1, sz * sc));
      } else {
        var gsz = sz * 3.6 * sc;
        tgt.drawImage(
          mkGlow(depth > 0.76 ? C.white : C.hi),
          px - gsz / 2,
          py - gsz / 2,
          gsz,
          gsz,
        );
      }
      /* 物理拖尾：同一颗星在 t-快门 时刻的透视投影 → 两点连线即精确轨迹 */
      var zTail = sk.z + zspd * sk.sp * SHUTTER;
      if (zTail < ZFAR * 1.7) {
        var pt = proj3(sk.x, sk.y, zTail);
        if (pt) {
          var tdx = (pr.x - pt.x) * sc,
            tdy = (pr.y - pt.y) * sc;
          var tlen = Math.hypot(tdx, tdy);
          tStat.n++;
          tStat.sum += tlen;
          if (tlen < tStat.min) tStat.min = tlen;
          if (tlen > tStat.max) tStat.max = tlen;
          if (tlen >= 1.8) tStat.drawn++;
          if (tlen > 1.8) {
            var tl = Math.min(tlen, W * 0.75);
            var ux = tdx / tlen,
              uy = tdy / tlen;
            var tw0 = Math.max(1, sz * 0.4 * sc);
            /* 沿轨迹渐隐渐细：短尾一段画完，长尾三段拉开，省开销 */
            var nseg = tlen < 10 ? 1 : tlen < 46 ? 2 : 3;
            var segs = [
              [0, 0.42, 0.62, 1.0],
              [0.42, 0.72, 0.3, 0.72],
              [0.72, 1, 0.14, 0.5],
            ];
            for (var sg = 0; sg < nseg; sg++) {
              var s0 = segs[sg][0],
                s1 = nseg === 1 ? 1 : segs[sg][1];
              var aK = nseg === 1 ? 0.42 : segs[sg][2];
              var wK = nseg === 1 ? 0.85 : segs[sg][3];
              tgt.globalAlpha = clamp(depth * 0.55 * tw2 * aK, 0, 1);
              tgt.strokeStyle = "rgba(" + (sg === 0 ? C.pale : C.mid) + ",1)";
              tgt.lineWidth = tw0 * wK;
              tgt.beginPath();
              tgt.moveTo(px - ux * tl * s0, py - uy * tl * s0);
              tgt.lineTo(px - ux * tl * s1, py - uy * tl * s1);
              tgt.stroke();
            }
          }
        }
      }
    }
    if (useTrail) {
      ctx.globalAlpha = 0.95;
      ctx.drawImage(trailCv, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "lighter";
    }

    /* 流星（长拖尾彗星） */
    for (i = 0; i < comets.length; i++) {
      var cm = comets[i];
      cm.x += cm.vx * dt;
      cm.y += cm.vy * dt;
      cm.life += dt;
      if (
        cm.life > cm.max ||
        cm.x < -600 ||
        cm.x > W + 600 ||
        cm.y < -600 ||
        cm.y > H + 600
      ) {
        comets[i] = newComet(false);
        continue;
      }
      var cvl = Math.hypot(cm.vx, cm.vy) || 1;
      var tx2 = cm.x - (cm.vx / cvl) * cm.len,
        ty2 = cm.y - (cm.vy / cvl) * cm.len;
      var grd = ctx.createLinearGradient(cm.x, cm.y, tx2, ty2);
      grd.addColorStop(0, "rgba(" + cm.rgb + ",0.85)");
      grd.addColorStop(0.35, "rgba(" + C.mid + ",0.32)");
      grd.addColorStop(1, "rgba(" + C.base + ",0)");
      ctx.globalAlpha = Math.sin(Math.min(1, cm.life / 0.6) * 1.57) * 0.75;
      ctx.strokeStyle = grd;
      ctx.lineWidth = cm.w;
      ctx.beginPath();
      ctx.moveTo(cm.x, cm.y);
      ctx.lineTo(tx2, ty2);
      ctx.stroke();
      var hsz = cm.w * 9;
      ctx.globalAlpha *= 0.9;
      ctx.drawImage(mkGlow(cm.rgb), cm.x - hsz / 2, cm.y - hsz / 2, hsz, hsz);
    }

    /* 流光柱（上升） */
    ctx.globalCompositeOperation = "lighter";
    for (i = 0; i < cols.length; i++) {
      var cl = cols[i];
      cl.off -= cl.sp * dt;
      if (cl.off < -cl.h) {
        cl.off = H + 80;
        cl.x = Math.random() * W;
      }
      var cy0 = cl.off + cl.h;
      ctx.globalAlpha = cl.a * (stageIdx === S_FINALE ? 1.15 : 0.7);
      ctx.drawImage(mkCol(C.base), cl.x - cl.w / 2, cy0 - cl.h, cl.w, cl.h);
    }

    /* ---- 手掌高度线（水平光带） ---- */
    var LY = LINEY * H;
    ctx.globalAlpha = 0.22 + (stageIdx === S_FINALE ? 0.06 : 0);
    ctx.drawImage(mkGlow(C.glow), -420, LY - 165, W + 840, 330);
    var lg = ctx.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, "rgba(" + C.base + ",0)");
    lg.addColorStop(0.18, "rgba(" + C.mid + ",0.75)");
    lg.addColorStop(0.5, "rgba(" + C.white + ",0.95)");
    lg.addColorStop(0.82, "rgba(" + C.mid + ",0.75)");
    lg.addColorStop(1, "rgba(" + C.base + ",0)");
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = lg;
    ctx.fillRect(0, LY - 1.5, W, 3);
    /* 沿线扫过的高光 */
    var sw = (T * 0.13) % 1;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(
      mkGlow(C.white),
      -300 + sw * (W + 600) - 260,
      LY - 60,
      520,
      120,
    );

    /* ---- 已建立的流光（华盖） ---- */
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (i = 0; i < strands.length; i++) {
      var sd = strands[i];
      var gw = sd.grow;
      if (gw <= 0.004) continue;
      var nseg = Math.max(1, Math.round(gw * 28));
      ctx.globalAlpha = 0.2 + 0.1 * Math.sin(T * 1.4 + sd.ph);
      ctx.strokeStyle = "rgba(" + C.mid + ",1)";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (j = 0; j <= nseg; j++) {
        var bp = bez(sd.p0, sd.p1, sd.p2, (gw * j) / nseg);
        if (j === 0) ctx.moveTo(bp.x, bp.y);
        else ctx.lineTo(bp.x, bp.y);
      }
      ctx.stroke();
      /* 持续性流光：仅在射线建成后沿路径循环上行 */
      if (gw >= 0.999) {
        var u = (T * 0.42 + i * 0.21) % 1;
        var hp = bez(sd.p0, sd.p1, sd.p2, u);
        ctx.globalAlpha = 0.75 * (stageIdx === S_FINALE ? 1 : 0.35);
        ctx.drawImage(mkGlow(C.pale), hp.x - 26, hp.y - 26, 52, 52);
        var hp2 = bez(sd.p0, sd.p1, sd.p2, Math.max(0, u - 0.05));
        ctx.globalAlpha = 0.32;
        ctx.drawImage(mkGlow(C.mid), hp2.x - 14, hp2.y - 14, 28, 28);
      }
    }

    /* ---- 飞行中的流光 ---- */
    for (i = 0; i < streaks.length; i++) {
      var sk = streaks[i],
        tt = ease(clamp(sk.t, 0, 1));
      for (j = 14; j >= 0; j--) {
        var uu = clamp(tt - j * 0.016, 0, 1);
        var sp = bez(sk.p0, sk.p1, sk.p2, uu);
        var coat = 1 - j / 15;
        ctx.globalAlpha = coat * coat * 0.85;
        var sz = 14 + coat * 44;
        ctx.drawImage(
          mkGlow(j > 8 ? C.base : C.pale),
          sp.x - sz / 2,
          sp.y - sz / 2,
          sz,
          sz,
        );
      }
    }

    /* ---- 顶部星芒 ---- */
    var ap = apexPower;
    ctx.globalAlpha = (0.3 + 0.62 * ap) * (0.88 + 0.12 * Math.sin(T * 2.1));
    var asz = 300 + 420 * ap;
    ctx.drawImage(mkGlow(C.hi), APEX.x - asz / 2, APEX.y - asz / 2, asz, asz);
    ctx.globalAlpha = 0.55 + 0.45 * ap;
    ctx.save();
    ctx.translate(APEX.x, APEX.y);
    ctx.rotate(T * 0.045);
    ctx.drawImage(mkStar(C.white), -230, -230, 460, 460);
    ctx.restore();
    /* 放射光芒 */
    if (!PERF) {
      for (i = 0; i < 26; i++) {
        var ang = T * 0.035 + i * ((Math.PI * 2) / 26);
        ctx.save();
        ctx.translate(APEX.x, APEX.y);
        ctx.rotate(ang);
        ctx.globalAlpha =
          (0.02 + 0.05 * ap) * (0.6 + 0.4 * Math.sin(T * 1.5 + i));
        ctx.drawImage(mkGlow(i % 4 === 0 ? C.white : C.mid), 60, -13, 620, 26);
        ctx.restore();
      }
    }
    /* 到达爆闪 */
    for (i = 0; i < bursts.length; i++) {
      var bt = bursts[i].t;
      ctx.globalAlpha = (1 - bt) * 0.85;
      var bsz = 120 + bt * 620;
      ctx.drawImage(
        mkGlow(C.white),
        APEX.x - bsz / 2,
        APEX.y - bsz / 2,
        bsz,
        bsz,
      );
      ctx.globalAlpha = (1 - bt) * 0.5;
      ctx.strokeStyle = "rgba(" + C.pale + ",1)";
      ctx.lineWidth = 5 * (1 - bt);
      ctx.beginPath();
      ctx.arc(APEX.x, APEX.y, 90 + bt * 320, 0, 6.2832);
      ctx.stroke();
    }

    /* ---- 涟漪光圈 ---- */
    for (i = 0; i < stations.length; i++) {
      s = stations[i];
      var lit = s.lit,
        R = s.r;
      var breathe = 0.86 + 0.14 * Math.sin(T * 1.4 + s.ph);

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (0.16 + 0.72 * lit) * breathe;
      ctx.drawImage(mkGlow(C.glow), s.x - R * 2.5, s.y - R * 2.5, R * 5, R * 5);

      /* 同心涟漪环 */
      ctx.globalAlpha = 0.2 + 0.55 * lit;
      ctx.strokeStyle = "rgba(" + C.mid + ",1)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, R, 0, 6.2832);
      ctx.stroke();
      ctx.globalAlpha = 0.12 + 0.42 * lit;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, R * 0.66, 0, 6.2832);
      ctx.stroke();
      /* 旋转弧 */
      ctx.globalAlpha = 0.35 + 0.5 * lit;
      ctx.lineWidth = 3.2;
      for (j = 0; j < 2; j++) {
        var a0 = T * (0.5 + j * 0.22) + s.ph + j * Math.PI;
        ctx.beginPath();
        ctx.arc(s.x, s.y, R * 1.16, a0, a0 + 0.55);
        ctx.stroke();
      }
      /* 核心光核 */
      ctx.globalAlpha = 0.3 + 0.7 * lit;
      var cs = R * (0.3 + 0.22 * lit);
      ctx.drawImage(mkGlow(C.white), s.x - cs, s.y - cs, cs * 2, cs * 2);
      ctx.globalAlpha = 0.25 + 0.6 * lit;
      ctx.drawImage(
        mkGlow(C.hi),
        s.x - R * 0.62,
        s.y - R * 0.62,
        R * 1.24,
        R * 1.24,
      );

      /* 点亮涟漪扩散 */
      for (j = 0; j < s.ripples.length; j++) {
        var rp = s.ripples[j].t;
        ctx.globalAlpha = (1 - rp) * 0.6;
        ctx.strokeStyle = "rgba(" + C.pale + ",1)";
        ctx.lineWidth = 5 * (1 - rp * 0.75);
        ctx.beginPath();
        ctx.arc(s.x, s.y, R * (1 + rp * 1.5), 0, 6.2832);
        ctx.stroke();
      }
      if (s.flare >= 0) {
        ctx.globalAlpha = (1 - s.flare) * 0.75;
        var fs = R * (1.6 + s.flare * 2.6);
        ctx.drawImage(mkGlow(C.white), s.x - fs / 2, s.y - fs / 2, fs, fs);
      }
    }

    /* ---- 3D 倒计时数字（从纵深冲向观众） ---- */
    if (stageIdx === S_COUNT && countShown >= 0) {
      var per = 0.9,
        ph3 = (st % per) / per;
      var dch = String(COUNT_N - countShown);
      var dsp = digitSprite(dch);
      var dsc = 0.3 + 1.55 * ease(clamp(ph3 * 1.12, 0, 1));
      var dW = dsp.width * dsc,
        dH = dsp.height * dsc;
      var dal = clamp(ph3 * 5, 0, 1) * (1 - clamp((ph3 - 0.8) / 0.2, 0, 1));
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = dal * 0.6;
      ctx.drawImage(mkGlow(C.hi), W / 2 - dW, H * 0.42 - dH, dW * 2, dH * 2);
      ctx.globalAlpha = dal;
      ctx.drawImage(dsp, W / 2 - dW / 2, H * 0.42 - dH / 2, dW, dH);
      ctx.globalAlpha = (1 - ph3) * 0.38;
      ctx.strokeStyle = "rgba(" + C.pale + ",1)";
      ctx.lineWidth = 6 * (1 - ph3 * 0.8);
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.42, 150 + ph3 * 460, 0, 6.2832);
      ctx.stroke();
    }

    /* ---- ① 星尘标题 ---- */
    if (tpartOn && tpart.length) {
      var tAlphaBase = tpartOn * (stageIdx === S_FINALE ? 0.95 : 0.8);
      for (i = 0; i < tpart.length; i++) {
        var tp = tpart[i];
        if (st > tp.d) tp.p = Math.min(1, tp.p + dt / 1.35);
        var ep = 1 - Math.pow(1 - tp.p, 3); /* easeOutCubic */
        var tx3 = tp.ix + (tp.tx - tp.ix) * ep;
        var ty3 = tp.iy + (tp.ty - tp.iy) * ep;
        var shim = (1 - tp.p) * 0 + Math.sin(T * 2.2 + tp.ph) * 1.6;
        var psz = 5.4 + 4.2 * (1 - tp.p);
        ctx.globalAlpha =
          tAlphaBase *
          clamp(tp.p * 2.4, 0, 1) *
          (0.55 + 0.45 * Math.sin(T * 1.9 + tp.ph));
        ctx.drawImage(
          mkGlow(tp.p > 0.995 ? C.pale : C.hi),
          tx3 - psz,
          ty3 - psz + shim,
          psz * 2,
          psz * 2,
        );
      }
      ctx.globalAlpha = 1;
    }

    /* ---- 暗角 ---- */
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(vignette(), 0, 0, W, H);

    /* ---- 定位辅助 ---- */
    if (G.on) drawGuides();

    fpsAcc += dt;
    fpsCnt++;
    if (fpsAcc >= 0.5) {
      fpsNow = fpsCnt / fpsAcc;
      window.__fps = fpsNow;
      fpsAcc = 0;
      fpsCnt = 0;
    }

    /* 低帧率自动降级（保护酒店弱机）：先关拖影，仍低则切性能模式 */
    if (!autoDone && T > 3) {
      if (fpsNow > 0 && fpsNow < 48) lowT += dt;
      else lowT = 0;
      if (lowT >= 2.5) {
        lowT = 0;
        if (TRAIL) {
          TRAIL = false;
          toast("帧率偏低：已自动关闭拖影（B 键可切回）");
        } else if (!PERF) {
          PERF = true;
          setup();
          fit();
          initAmbient();
          toast("帧率仍偏低：已切性能模式（P 键可切回）");
          autoDone = true;
        } else autoDone = true;
      }
    }

    requestAnimationFrame(frame);
  }

  /* ================= 9. 定位辅助 · 拖动 ================= */
  var G = { on: false, drag: null };
  var autoDone = false,
    lowT = 0;
  function drawGuides() {
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(120,220,255,.45)";
    ctx.strokeRect(60, 60, W - 120, H - 120); /* title-safe 5% */
    ctx.setLineDash([]);
    /* 高度线手柄（放在光带上方，避免压住 1 号光圈） */
    var LY = LINEY * H;
    ctx.fillStyle = "rgba(120,220,255,.13)";
    ctx.fillRect(0, LY - 26, W, 52);
    ctx.fillStyle = "rgba(120,220,255,.20)";
    ctx.fillRect(24, LY - 92, 320, 50);
    ctx.strokeStyle = "rgba(150,235,255,.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(24, LY - 92, 320, 50);
    ctx.beginPath();
    ctx.moveTo(184, LY - 42);
    ctx.lineTo(184, LY - 26);
    ctx.stroke();
    ctx.fillStyle = "rgba(215,245,255,.97)";
    ctx.font = '22px "Microsoft YaHei",sans-serif';
    ctx.fillText("手掌高度线 " + Math.round(LINEY * 100) + "%", 44, LY - 58);
    for (var i = 0; i < stations.length; i++) {
      var s = stations[i];
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = "rgba(150,235,255,.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 1.45, 0, 6.2832);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(s.x - 14, s.y);
      ctx.lineTo(s.x + 14, s.y);
      ctx.moveTo(s.x, s.y - 14);
      ctx.lineTo(s.x, s.y + 14);
      ctx.stroke();
      ctx.fillStyle = "rgba(210,245,255,.8)";
      ctx.fillText(
        "#" + (i + 1) + "  " + Math.round(s.x) + "," + Math.round(s.y),
        s.x - 42,
        s.y - s.r * 1.45 - 14,
      );
    }
    ctx.fillStyle = "rgba(180,235,255,.9)";
    ctx.font = '20px "Microsoft YaHei",sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(
      "人数 " +
        N +
        "　光圈 " +
        RINGK.toFixed(2) +
        "×　高度 " +
        Math.round(LINEY * 100) +
        "%　间距 " +
        SPREADK.toFixed(2) +
        "×　快门 " +
        SHUTTER.toFixed(2) +
        "s　色相 " +
        Math.round(HUE) +
        "　DPR " +
        DPR.toFixed(2) +
        "　FPS " +
        fpsNow.toFixed(0) +
        "　（Ctrl+滚轮=光圈，Shift+滚轮=高度，Alt+滚轮=间距，Shift+Alt+滚轮=快门，拖动=定位）",
      W - 70,
      96,
    );
    ctx.textAlign = "left";
    /* 标题基线（可拖动）＋ 与光圈的碰撞告警 */
    var TB = CFG.titley * H;
    var tbH = $tw ? $tw.offsetHeight : 170;
    ctx.fillStyle = "rgba(255,190,120,.10)";
    ctx.fillRect(0, TB - tbH, W, tbH);
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = "rgba(255,190,120,.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, TB);
    ctx.lineTo(W, TB);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, TB - tbH);
    ctx.lineTo(W, TB - tbH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,190,120,.20)";
    ctx.fillRect(W - 372, TB - 92, 348, 50);
    ctx.strokeStyle = "rgba(255,205,150,.85)";
    ctx.strokeRect(W - 372, TB - 92, 348, 50);
    ctx.beginPath();
    ctx.moveTo(W - 198, TB - 42);
    ctx.lineTo(W - 198, TB);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,228,195,.97)";
    ctx.font = '22px "Microsoft YaHei",sans-serif';
    ctx.fillText(
      "标题基线 " + Math.round(CFG.titley * 100) + "%",
      W - 352,
      TB - 58,
    );
    var clash = 0;
    for (var q = 0; q < stations.length; q++)
      if (stations[q].y - stations[q].r < TB) clash++;
    if (clash) {
      ctx.fillStyle = "rgba(255,120,120,.95)";
      ctx.font = 'bold 24px "Microsoft YaHei",sans-serif';
      ctx.fillText(
        "⚠ 有 " +
          clash +
          " 个光圈顶到标题区：请下移高度线 / 缩小光圈 / 上移标题基线",
        70,
        TB + 34,
      );
      ctx.font = '20px "Microsoft YaHei",sans-serif';
    }
    ctx.restore();
  }
  function toDesign(e) {
    var r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S };
  }
  function onLine(p) {
    var LY = LINEY * H;
    return (
      Math.abs(p.y - LY) < 40 ||
      (p.x > 24 && p.x < 344 && p.y > LY - 92 && p.y < LY - 42)
    );
  }
  function onTitleLine(p) {
    var TB = CFG.titley * H;
    return (
      Math.abs(p.y - TB) < 30 ||
      (p.x > W - 372 && p.x < W - 24 && p.y > TB - 92 && p.y < TB - 42)
    );
  }
  function onDown(e) {
    if (editing) return;
    if (!G.on) {
      advance();
      return;
    }
    var p = toDesign(e);
    for (var i = 0; i < stations.length; i++) {
      var s = stations[i];
      if (Math.hypot(p.x - s.x, p.y - s.y) < Math.max(70, s.r * 1.5)) {
        G.drag = { t: "ring", i: i };
        return;
      }
    }
    if (onLine(p)) {
      G.drag = { t: "line" };
      return;
    }
    if (onTitleLine(p)) {
      G.drag = { t: "title" };
      return;
    }
  }
  function onMove(e) {
    if (!G.drag) {
      if (G.on) e && (document.body.style.cursor = hitCursor(e));
      return;
    }
    var p = toDesign(e);
    if (G.drag.t === "ring") {
      var s = stations[G.drag.i];
      custom[G.drag.i] = {
        x: clamp(p.x, 60, W - 60),
        y: clamp(p.y, 80, H - 120),
      };
      s.x = custom[G.drag.i].x;
      s.y = custom[G.drag.i].y;
    } else if (G.drag.t === "title") {
      CFG.titley = clamp(p.y / H, 0.14, 0.8);
      applyTitlePos();
    } else {
      LINEY = clamp(p.y / H, 0.15, 0.92);
      for (var i = 0; i < stations.length; i++) {
        custom[i] = {
          x: custom[i] && custom[i].x != null ? custom[i].x : null,
          y: null,
        };
        stations[i].y = LINEY * H;
      }
    }
    save();
  }
  function onUp() {
    if (G.drag) {
      G.drag = null;
      save();
      toast("位置已保存");
    }
  }
  function hitCursor(e) {
    var p = toDesign(e);
    if (G.on) {
      for (var i = 0; i < stations.length; i++) {
        if (
          Math.hypot(p.x - stations[i].x, p.y - stations[i].y) <
          Math.max(70, stations[i].r * 1.5)
        )
          return "grab";
      }
      if (onLine(p) || onTitleLine(p)) return "ns-resize";
    }
    return "default";
  }

  /* ================= 10.5 标题编辑（E / Shift+E） ================= */
  var editing = null;
  function startEdit(el, which) {
    if (editing) return;
    editing = which;
    document.body.classList.add("editing");
    el.setAttribute("contenteditable", "true");
    el.focus();
    var r = document.createRange();
    r.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    toast("编辑中：回车/点击别处 = 确认，Esc = 取消");
  }
  function endEdit(commit) {
    if (!editing) return;
    var el = editing === "sub" ? $t2 : $t1;
    if (commit) {
      var txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (txt) {
        if (editing === "sub") CFG.sub = txt;
        else CFG.title = txt;
      }
    } else {
      el.textContent = editing === "sub" ? CFG.sub : CFG.title;
    }
    el.setAttribute("contenteditable", "false");
    el.blur();
    document.body.classList.remove("editing");
    editing = null;
    if (tpartOn) initTitleParticles(); /* 文字变了 → 星尘目标点重算 */
    save();
  }
  document.addEventListener("focusout", function (ev) {
    if (
      editing &&
      ev.target &&
      ev.target.getAttribute &&
      ev.target.getAttribute("contenteditable") === "true"
    )
      endEdit(true);
  });

  /* ================= 10. 输入 ================= */
  var toastT = 0;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () {
      $toast.classList.remove("on");
    }, 2200);
  }
  function save() {
    try {
      localStorage.setItem(
        LSKEY,
        JSON.stringify({
          n: N,
          ring: RINGK,
          line: LINEY,
          spread: SPREADK,
          titley: CFG.titley,
          title: CFG.title,
          sub: CFG.sub,
          bgm: CFG.bgm,
          perf: PERF ? 1 : 0,
          pos: stations
            .map(function (s) {
              return Math.round(s.x) + "," + Math.round(s.y);
            })
            .join(";"),
        }),
      );
    } catch (e) {}
  }
  function urlForShow() {
    return (
      location.origin +
      location.pathname +
      "?n=" +
      N +
      "&ring=" +
      RINGK.toFixed(2) +
      "&line=" +
      LINEY.toFixed(3) +
      "&spread=" +
      SPREADK.toFixed(2) +
      "&hue=" +
      HUE +
      "&titley=" +
      CFG.titley.toFixed(3) +
      "&shutter=" +
      SHUTTER.toFixed(2) +
      "&pos=" +
      stations
        .map(function (s) {
          return Math.round(s.x) + "," + Math.round(s.y);
        })
        .join(";") +
      "&title=" +
      encodeURIComponent(CFG.title) +
      "&sub=" +
      encodeURIComponent(CFG.sub)
    );
  }

  var NEXT = {
    " ": 1,
    Spacebar: 1,
    Enter: 1,
    ArrowRight: 1,
    ArrowDown: 1,
    PageDown: 1,
  };
  document.addEventListener("keydown", function (e) {
    var k = e.key;
    if (editing) {
      /* 编辑态：屏蔽所有现场快捷键 */
      if (k === "Escape") {
        e.preventDefault();
        endEdit(false);
      } else if (k === "Enter") {
        e.preventDefault();
        endEdit(true);
      }
      return;
    }
    if (k === "e" || k === "E") {
      e.preventDefault();
      startEdit(e.shiftKey ? $t2 : $t1, e.shiftKey ? "sub" : "title");
      return;
    }
    if (k === ",") {
      CFG.titley = clamp(CFG.titley - 0.01, 0.14, 0.8);
      applyTitlePos();
      save();
      toast("标题基线 " + Math.round(CFG.titley * 100) + "%");
      return;
    }
    if (k === ".") {
      CFG.titley = clamp(CFG.titley + 0.01, 0.14, 0.8);
      applyTitlePos();
      save();
      toast("标题基线 " + Math.round(CFG.titley * 100) + "%");
      return;
    }
    if (NEXT[k]) {
      e.preventDefault();
      advance();
      return;
    }
    if (k === "R" && e.shiftKey) {
      /* Shift+R：清掉现场标定，回出厂默认 */
      e.preventDefault();
      try {
        localStorage.removeItem(LSKEY);
      } catch (er) {}
      location.reload();
      return;
    }
    if (k === "r" || k === "R") {
      reset();
      return;
    }
    if (k === "t" || k === "T") {
      G.on = !G.on;
      toast(G.on ? "定位辅助：开（拖动定位）" : "定位辅助：关");
      save();
      return;
    }
    if (k === "h" || k === "H") {
      $hint.classList.toggle("off");
      return;
    }
    if (k === "f" || k === "F") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () {});
      return;
    }
    if (k === "p" || k === "P") {
      PERF = !PERF;
      setup();
      fit();
      initAmbient();
      reset();
      toast(PERF ? "性能模式：开" : "性能模式：关");
      return;
    }
    if (k === "m" || k === "M") {
      if ($audio) {
        $audio.muted = !$audio.muted;
        toast($audio.muted ? "静音" : "声音开");
      }
      return;
    }
    if (k === "b" || k === "B") {
      TRAIL = !TRAIL;
      toast(TRAIL ? "粒子拖影：开" : "粒子拖影：关");
      return;
    }
    if (k === "l" || k === "L") {
      if ($audio) {
        $audio.loop = !$audio.loop;
        toast($audio.loop ? "BGM 循环：开" : "BGM 循环：关");
      }
      return;
    }
    if (k >= "1" && k <= "8") {
      N = parseInt(k, 10);
      custom = [];
      CFG.pos = "";
      layout();
      reset();
      save();
      toast("掌印数（光圈）：" + N);
      return;
    }
    if (k === "[") {
      RINGK = clamp(RINGK - 0.05, 0.3, 3);
      layout();
      save();
      toast("光圈 " + RINGK.toFixed(2) + "×");
      return;
    }
    if (k === "]") {
      RINGK = clamp(RINGK + 0.05, 0.3, 3);
      layout();
      save();
      toast("光圈 " + RINGK.toFixed(2) + "×");
      return;
    }
    if (k === ";") {
      LINEY = clamp(LINEY - 0.01, 0.15, 0.92);
      layout();
      save();
      toast("高度线 " + Math.round(LINEY * 100) + "%");
      return;
    }
    if (k === "'") {
      LINEY = clamp(LINEY + 0.01, 0.15, 0.92);
      layout();
      save();
      toast("高度线 " + Math.round(LINEY * 100) + "%");
      return;
    }
    if (k === "-") {
      SPREADK = clamp(SPREADK - 0.03, 0.4, 1.6);
      layout();
      save();
      toast("间距 " + SPREADK.toFixed(2) + "×");
      return;
    }
    if (k === "=") {
      SPREADK = clamp(SPREADK + 0.03, 0.4, 1.6);
      layout();
      save();
      toast("间距 " + SPREADK.toFixed(2) + "×");
      return;
    }
    if (k === "c" || k === "C") {
      var u = urlForShow();
      $cfgbox.textContent = u;
      $cfgbox.classList.add("on");
      if (navigator.clipboard)
        navigator.clipboard.writeText(u).then(
          function () {
            toast("参数已复制（也已显示在左下）");
          },
          function () {
            toast("已显示参数，请手动复制");
          },
        );
      else toast("已显示参数，请手动复制");
      clearTimeout(save.ct);
      save.ct = setTimeout(function () {
        $cfgbox.classList.remove("on");
      }, 20000);
      return;
    }
  });
  document.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  /* Ctrl / Shift / Alt + 滚轮：现场标定（浏览器自带缩放对等比设计无效，故拦截改造） */
  window.addEventListener(
    "wheel",
    function (e) {
      if (!(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return;
      e.preventDefault();
      var up = e.deltaY < 0;
      if ((e.ctrlKey || e.metaKey) && e.altKey) {
        CFG.titley = clamp(CFG.titley + (up ? -0.006 : 0.006), 0.14, 0.8);
        applyTitlePos();
        save();
        toast("标题基线 " + Math.round(CFG.titley * 100) + "%");
      } else if (e.shiftKey && e.altKey) {
        SHUTTER = clamp(SHUTTER + (up ? 0.01 : -0.01), 0.04, 1.2);
        toast("快门时间（拖尾长度）" + SHUTTER.toFixed(2) + "s");
      } else if (e.ctrlKey || e.metaKey) {
        RINGK = clamp(RINGK * (up ? 1.05 : 0.952), 0.3, 3);
        layout();
        save();
        toast("光圈 " + RINGK.toFixed(2) + "×");
      } else if (e.shiftKey) {
        LINEY = clamp(LINEY + (up ? -0.006 : 0.006), 0.15, 0.92);
        layout();
        save();
        toast("手掌高度线 " + Math.round(LINEY * 100) + "%");
      } else if (e.altKey) {
        SPREADK = clamp(SPREADK * (up ? 1.02 : 0.98), 0.4, 1.6);
        layout();
        save();
        toast("间距 " + SPREADK.toFixed(2) + "×");
      }
    },
    { passive: false },
  );

  var idleT = null;
  function wake() {
    document.body.classList.remove("hidecursor");
    clearTimeout(idleT);
    idleT = setTimeout(function () {
      if (!G.on) document.body.classList.add("hidecursor");
    }, 2500);
  }
  document.addEventListener("mousemove", wake);
  wake();
  window.addEventListener("resize", fit);

  /* ================= 11. 启动 ================= */
  setup();
  fit();
  initAmbient();
  layout();
  reset();
  window.__fps = 0;
  window.__err = "";
  window.__dbg = {
    /* 测试/自检钩子（不影响运行） */
    stars: function () {
      return stars;
    },
    stage: function () {
      return stageIdx;
    },
    W: function () {
      return W;
    },
    cfg: function () {
      return {
        n: N,
        ring: RINGK,
        line: LINEY,
        spread: SPREADK,
        titley: CFG.titley,
        hue: HUE,
        W: W,
        DPR: DPR,
        trail: TRAIL,
      };
    },
    title: function () {
      return { h1: $t1.textContent, sub: $t2.textContent, editing: editing };
    },
    trail: function () {
      var p = tStat.prev || { n: 0, sum: 0, min: 0, max: 0, drawn: 0 };
      return {
        starsProj: p.n,
        drawn: p.drawn,
        minLen: +p.min.toFixed(1),
        avgLen: +(p.sum / Math.max(1, p.n)).toFixed(1),
        maxLen: +p.max.toFixed(1),
        shutter: SHUTTER,
        spread: +(p.max / Math.max(1, p.min)).toFixed(1),
      };
    },
  };
  window.onerror = function (m, src, l) {
    window.__err += m + "@" + l + ";";
  };
  requestAnimationFrame(frame);
})();
