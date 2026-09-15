"use client";
import { useEffect } from "react";

// Scroll-driven motion with GSAP, loaded only on the public site and only
// when motion is allowed. Every effect degrades to the static page: the
// headline is visible before the split runs, the step line is a decoration,
// the progress bar is informational.

export function Motion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const [{ gsap }, { ScrollTrigger }, { SplitText }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("gsap/SplitText")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger, SplitText);
      await document.fonts.ready;
      const fine = window.matchMedia("(pointer: fine)").matches;
      const ctx = gsap.context(() => {
        // 1. Headline: words rise out of a mask.
        const h1 = document.querySelector<HTMLElement>(".hero h1, .page-hero h1");
        if (h1) {
          const split = new SplitText(h1, { type: "words", mask: "words" });
          gsap.from(split.words, { yPercent: 110, duration: 0.9, ease: "power3.out", stagger: 0.055, delay: 0.1 });
          const lede = h1.parentElement?.querySelector(".lede, .ctas, .contact");
          if (lede) gsap.from(h1.parentElement!.querySelectorAll(".lede, .ctas, .contact"), { y: 14, autoAlpha: 0, duration: 0.7, ease: "power2.out", stagger: 0.1, delay: 0.5 });
        }
        // 2. Hero layers drift apart on scroll (fine pointers only; phones keep the layout still).
        if (fine && document.querySelector(".hero-art")) {
          gsap.to(".hero-art .back", { y: -36, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 } });
          gsap.to(".hero-art .front", { y: 24, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 } });
        }
        // 3. Reading progress under the nav.
        const bar = document.querySelector<HTMLElement>(".nav-progress");
        if (bar) gsap.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.3 } });
        // 4. Numbered rows: the accent line draws itself down the sequence, each number turning ink as it is passed.
        document.querySelectorAll<HTMLElement>(".rows").forEach((rows) => {
          gsap.to(rows, { "--line": 1, ease: "none", scrollTrigger: { trigger: rows, start: "top 72%", end: "bottom 72%", scrub: 0.4 } } as gsap.TweenVars);
          rows.querySelectorAll<HTMLElement>(":scope > div").forEach((row) => {
            ScrollTrigger.create({ trigger: row, start: "top 72%", toggleClass: { targets: row, className: "passed" }, once: false });
          });
        });
        // 5. Figures count in when they are numeric.
        document.querySelectorAll<HTMLElement>(".stat .n[data-count]").forEach((n) => {
          const target = Number(n.dataset.count);
          if (!Number.isFinite(target)) return;
          const o = { v: 0 };
          gsap.to(o, { v: target, duration: 1.4, ease: "power2.out", scrollTrigger: { trigger: n, start: "top 85%", once: true }, onUpdate: () => { n.firstChild!.textContent = o.v.toLocaleString("es-ES", { maximumFractionDigits: 0 }); } });
        });
      });
      // 6. Magnetic primary buttons.
      const handlers: Array<() => void> = [];
      if (fine) {
        document.querySelectorAll<HTMLElement>(".hero .ctas .btn, .nav .btn, .page-hero .ctas .btn").forEach((btn) => {
          const xTo = gsap.quickTo(btn, "x", { duration: 0.35, ease: "power3" }), yTo = gsap.quickTo(btn, "y", { duration: 0.35, ease: "power3" });
          const move = (e: PointerEvent) => { const r = btn.getBoundingClientRect(); xTo((e.clientX - (r.left + r.width / 2)) * 0.18); yTo((e.clientY - (r.top + r.height / 2)) * 0.28); };
          const leave = () => { xTo(0); yTo(0); };
          btn.addEventListener("pointermove", move); btn.addEventListener("pointerleave", leave);
          handlers.push(() => { btn.removeEventListener("pointermove", move); btn.removeEventListener("pointerleave", leave); });
        });
      }
      cleanup = () => { ctx.revert(); handlers.forEach((h) => h()); };
    })().catch(() => { /* the page is fine without motion */ });
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  return null;
}
