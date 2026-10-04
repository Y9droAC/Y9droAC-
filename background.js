// Predictive Arc 3 — Originkit (vanilla JS / WebGL port)
(function () {
  "use strict";

  const MAX_DPR = 2;

  const VERT_SRC = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

  const FRAG_SRC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uRes;
uniform float uTime, uDpr, uCell, uDot, uHover;
uniform vec2  uPtr;
uniform float uA, uB, uC, uD;
uniform vec3  uBg, uBase, uAccent, uHigh;

void main(){
  float cs = max(uCell, 2.0);
  vec2 ci = floor(gl_FragCoord.xy / cs);
  vec2 cc = (ci + 0.5) * cs;

  float x = cc.x / uDpr;
  float y = (uRes.y - cc.y) / uDpr;
  float w = uRes.x / uDpr;
  float h = uRes.y / uDpr;
  float t = uTime;

  float i = 0.0;
  float k = 6.2831853 / max(w * uC, 1.0);
  float y0 = h * uA + h * uB * (sin(x * k - t * 1.2) + 0.35 * sin(x * k * 2.3 + t * 0.9)) / 1.35;
  float gx = (x - uPtr.x) / (w * 0.12);
  float curveY = y0 + (uPtr.y - h * 0.5) * exp(-gx * gx) * 0.8 * uHover;
  float dist = abs(y - curveY);
  float normX = (x - w * 0.5) / (w * 0.75);
  float th = (70.0 + 30.0 * sin(x * k * 0.5 + t * 0.7)) * uD;
  if (dist < th) {
    i = 1.0 - dist / th;
    float waveX = sin(x * 0.015 + t);
    float waveY = cos(y * 0.02 + t);
    i = i * 0.7 + waveX * waveY * 0.3 * i;
    i *= max(0.0, 1.0 - pow(abs(normX), 2.5));
  }

  vec3 col = uBg;
  if (i > 0.02) {
    float side = uDot * i * uDpr;
    vec2 d = abs(gl_FragCoord.xy - cc);
    float cov = 1.0 - smoothstep(side * 0.5 - 1.0, side * 0.5 + 1.0, length(d));

    vec3 ink = mix(uBase, uAccent, clamp(pow(i, 1.1), 0.0, 1.0));
    ink = mix(ink, uHigh, smoothstep(0.72, 1.0, i));
    col = mix(uBg, ink, cov * clamp(i * 1.6, 0.0, 1.0));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("PredictiveArcSignal shader:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function parseColor(input, fb) {
    if (!input) return fb;
    const str = String(input).trim();
    if (str.charAt(0) === "#") {
      let hex = str.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      if (hex.length >= 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r / 255, g / 255, b / 255];
      }
      return fb;
    }
    const m = str.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      return [
        Math.min(255, parseFloat(m[0])) / 255,
        Math.min(255, parseFloat(m[1])) / 255,
        Math.min(255, parseFloat(m[2])) / 255,
      ];
    }
    return fb;
  }

  function num(v, fb) {
    return typeof v === "number" && isFinite(v) ? v : fb;
  }

  function clampN(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  const SIGNAL_DEFAULTS = { level: 50, amplitude: 18, wavelength: 60, thickness: 100 };

  class PredictiveArcSignal {
    constructor(canvas, props) {
      props = props || {};
      this.canvas = canvas;

      const grp = Object.assign({}, SIGNAL_DEFAULTS, props.signal || {});

      this.v = {
        bg: props.background || "#030604",
        base: props.baseColor || "#0E3B1F",
        accent: props.accentColor || "#3DFF8A",
        high: props.highlight || "#FFFFFF",
        density: Math.round(clampN(num(props.density, 160), 40, 320)),
        dotSize: clampN(num(props.dotSize, 100), 20, 400) / 100,
        speed: clampN(num(props.speed, 50), 0, 100) / 50,
        hover: clampN(num(props.hover, 100), 0, 200) / 100,
        level: clampN(num(grp.level, 50), 0, 100) / 100,
        amplitude: clampN(num(grp.amplitude, 18), 0, 100) / 100,
        wavelength: clampN(num(grp.wavelength, 60), 10, 300) / 100,
        thickness: clampN(num(grp.thickness, 100), 20, 400) / 100,
      };

      this.ptr = { tx: 0.5, ty: 0.5, x: 0.5, y: 0.5 };
      this._raf = 0;

      this._init();
    }

    _init() {
      const canvas = this.canvas;
      const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false });
      if (!gl) {
        console.error("PredictiveArcSignal: WebGL unavailable");
        return;
      }
      this.gl = gl;

      const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) return;
      const prog = gl.createProgram();
      if (!prog) return;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error("PredictiveArcSignal link:", gl.getProgramInfoLog(prog));
        return;
      }
      gl.useProgram(prog);
      this.prog = prog;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      this.locs = {};

      this._track = (e) => {
        const r = canvas.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        this.ptr.tx = clampN((e.clientX - r.left) / r.width, 0, 1);
        this.ptr.ty = clampN((e.clientY - r.top) / r.height, 0, 1);
      };
      this._onLeave = () => {
        this.ptr.tx = 0.5;
        this.ptr.ty = 0.5;
      };
      canvas.addEventListener("pointermove", this._track);
      canvas.addEventListener("pointerenter", this._track);
      canvas.addEventListener("pointerleave", this._onLeave);

      this._last = performance.now();
      this._clock = 0;
      this._raf = requestAnimationFrame((t) => this._render(t));
    }

    _u(name) {
      if (!(name in this.locs)) this.locs[name] = this.gl.getUniformLocation(this.prog, name);
      return this.locs[name];
    }

    _render(now) {
      const gl = this.gl;
      const canvas = this.canvas;
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      const v = this.v;

      this._clock = (this._clock + dt * 0.9 * v.speed) % 6283;

      const PTR_RATE = 6.0;
      const k = 1 - Math.exp(-dt * PTR_RATE);
      this.ptr.x += (this.ptr.tx - this.ptr.x) * k;
      this.ptr.y += (this.ptr.ty - this.ptr.y) * k;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const cw = canvas.clientWidth || 1200;
      const ch = canvas.clientHeight || 800;
      const bw = Math.max(1, Math.round(cw * dpr));
      const bh = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);

      const pitchCss = Math.min(bw, bh) / dpr / v.density;

      gl.uniform2f(this._u("uRes"), bw, bh);
      gl.uniform1f(this._u("uTime"), this._clock);
      gl.uniform1f(this._u("uDpr"), dpr);
      gl.uniform1f(this._u("uCell"), Math.max(2, pitchCss * dpr));
      gl.uniform1f(this._u("uDot"), pitchCss * 1.2 * v.dotSize);
      gl.uniform1f(this._u("uA"), v.level);
      gl.uniform1f(this._u("uB"), v.amplitude);
      gl.uniform1f(this._u("uC"), v.wavelength);
      gl.uniform1f(this._u("uD"), v.thickness);
      gl.uniform1f(this._u("uHover"), v.hover);
      gl.uniform2f(this._u("uPtr"), this.ptr.x * (bw / dpr), this.ptr.y * (bh / dpr));

      const cg = parseColor(v.bg, [0.012, 0.012, 0.012]);
      const cb = parseColor(v.base, [0.169, 0.055, 0.369]);
      const ca = parseColor(v.accent, [0.627, 0.314, 1.0]);
      const chh = parseColor(v.high, [1, 1, 1]);
      gl.uniform3f(this._u("uBg"), cg[0], cg[1], cg[2]);
      gl.uniform3f(this._u("uBase"), cb[0], cb[1], cb[2]);
      gl.uniform3f(this._u("uAccent"), ca[0], ca[1], ca[2]);
      gl.uniform3f(this._u("uHigh"), chh[0], chh[1], chh[2]);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this._raf = requestAnimationFrame((t) => this._render(t));
    }

    destroy() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this.canvas.removeEventListener("pointermove", this._track);
      this.canvas.removeEventListener("pointerenter", this._track);
      this.canvas.removeEventListener("pointerleave", this._onLeave);
    }
  }

  window.PredictiveArcSignal = PredictiveArcSignal;
})();
