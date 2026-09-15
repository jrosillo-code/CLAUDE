"use client";
import { useEffect, useRef } from "react";

// The atmospheric backdrop: a gradient mesh in the site's own palette, drawn
// by a fragment shader. Paper, cream, sage and mist drift under slow
// domain-warped noise; a warmer pool follows the cursor; a breath of the
// accent green appears where the noise peaks. Renders at half resolution,
// pauses off-screen, and hands over to a static CSS gradient on phones,
// under reduced motion, or without WebGL.

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision mediump float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_k;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0); m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw; return 130.0*dot(m,g);
}
float fbm(vec2 p){ float f=0.0, a=0.5; for(int i=0;i<4;i++){ f+=a*snoise(p); p=p*2.0+vec2(3.1,1.7); a*=0.5; } return f; }
void main(){
  vec2 uv = gl_FragCoord.xy / u_res; vec2 p = uv; p.x *= u_res.x / u_res.y;
  float t = u_time * 0.05;
  vec2 q = vec2(fbm(p*0.9 + t), fbm(p*0.9 - t*0.7 + 5.2));
  vec2 r = vec2(fbm(p*1.1 + 2.4*q + t*0.6), fbm(p*1.1 + 2.4*q - t*0.4 + 8.3));
  float n = fbm(p*0.8 + 2.0*r);
  vec3 paper = vec3(0.969, 0.965, 0.949);
  vec3 cream = vec3(0.957, 0.937, 0.886);
  vec3 sage  = vec3(0.874, 0.925, 0.894);
  vec3 mist  = vec3(0.886, 0.898, 0.918);
  vec3 accent= vec3(0.118, 0.420, 0.290);
  vec3 c = mix(paper, cream, smoothstep(-0.35, 0.45, n));
  c = mix(c, sage, smoothstep(0.0, 0.55, r.x));
  c = mix(c, mist, smoothstep(0.05, 0.65, q.y) * 0.9);
  float peak = smoothstep(0.42, 0.75, n) * smoothstep(0.2, 0.7, r.y);
  c = mix(c, accent, peak * 0.16);
  vec2 m = u_mouse; m.x *= u_res.x / u_res.y;
  float pool = exp(-dot(p - m, p - m) * 5.0);
  c = mix(c, cream * 0.985, pool * 0.55);
  c = mix(c, accent, pool * 0.08);
  c = mix(paper, c, u_k);
  float bottom = smoothstep(0.0, 0.22, uv.y);
  c = mix(paper, c, bottom);
  gl_FragColor = vec4(c, 1.0);
}`;

export function MeshCanvas({ intensity = 1 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(max-width: 640px)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader"); return s; };
    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
    } catch { return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "u_res"), uTime = gl.getUniformLocation(prog, "u_time"), uMouse = gl.getUniformLocation(prog, "u_mouse"), uK = gl.getUniformLocation(prog, "u_k");
    canvas.classList.add("live");
    let raf = 0, running = false; const t0 = performance.now();
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const resize = () => {
      const r = canvas.getBoundingClientRect(); const scale = 0.5 * Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.max(2, Math.round(r.width * scale)); canvas.height = Math.max(2, Math.round(r.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const frame = (now: number) => {
      if (!running) return;
      mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform1f(uTime, (now - t0) / 1000); gl.uniform2f(uMouse, mouse.x, mouse.y); gl.uniform1f(uK, intensity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mouse.tx = (e.clientX - r.left) / r.width; mouse.ty = 1 - (e.clientY - r.top) / r.height; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.02 }); io.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    const onVis = () => (document.hidden ? stop() : start()); document.addEventListener("visibilitychange", onVis);
    return () => { stop(); ro.disconnect(); io.disconnect(); window.removeEventListener("pointermove", onMove); document.removeEventListener("visibilitychange", onVis); gl.getExtension("WEBGL_lose_context")?.loseContext(); };
  }, [intensity]);
  return <canvas ref={ref} className="mesh" aria-hidden="true" />;
}
