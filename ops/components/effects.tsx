"use client";
import { useEffect } from "react";

// The site's motion, all progressive: nothing here is required to read the
// page. Elements get their reveal class from this script, so without it they
// simply show. Reduced-motion users get none of it.

const GROUPS = ".bento, .steps, .offers, .trust, .proof, .rows, .two, .check, .compare tbody, .strip-track";
const SINGLES = ".section-head, .page-hero > *, .hero > *, .frame, .settle, .audit, .disclosure, .pull, details, .queue:not(.hero-art .queue)";

export function Effects() {
  useEffect(() => {
    document.documentElement.classList.add("js");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Reveal on scroll, staggered inside groups.
    const targets: HTMLElement[] = [];
    document.querySelectorAll<HTMLElement>(GROUPS).forEach((g) => {
      Array.from(g.children).forEach((c, i) => { const el = c as HTMLElement; el.style.setProperty("--d", `${Math.min(i, 8) * 70}ms`); targets.push(el); });
    });
    document.querySelectorAll<HTMLElement>(SINGLES).forEach((el) => { if (!targets.includes(el)) targets.push(el); });
    for (const el of targets) el.classList.add("reveal");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    for (const el of targets) io.observe(el);

    // The hero queue plays its sequence on load and again every 11 seconds.
    const hero = document.querySelector<HTMLElement>(".hero-art .queue");
    let timer: number | undefined;
    if (hero) {
      const back = document.querySelector<HTMLElement>(".hero-art .back");
      const play = () => { hero.classList.remove("play"); void hero.offsetWidth; hero.classList.add("play"); window.setTimeout(() => back?.classList.add("in"), 1200); };
      play();
      timer = window.setInterval(play, 11000);
    }

    // Nav tightens after the first scroll.
    const nav = document.querySelector<HTMLElement>(".nav");
    const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => { io.disconnect(); if (timer) window.clearInterval(timer); window.removeEventListener("scroll", onScroll); };
  }, []);
  return null;
}
