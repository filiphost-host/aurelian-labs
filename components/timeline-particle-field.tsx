"use client";

import { useEffect, useRef, type RefObject } from "react";

type Particle = {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
};

function jitter(column: number, row: number, axis: number) {
  const value = Math.sin(column * 73.9 + row * 41.3 + axis * 57.7) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * 1.35;
}

function falloff(distance: number, radius: number) {
  const amount = Math.max(0, Math.min(1, 1 - distance / radius));
  return amount * amount * (3 - 2 * amount);
}

export function TimelineParticleField({
  surfaceRef,
  onYearChange,
}: {
  surfaceRef: RefObject<HTMLDivElement | null>;
  onYearChange: (year: number | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const maybeCanvas = canvasRef.current;
    const maybeSurface = surfaceRef.current;
    const maybeContext = maybeCanvas?.getContext("2d", { alpha: true });
    if (!maybeCanvas || !maybeSurface || !maybeContext) return;
    const canvas: HTMLCanvasElement = maybeCanvas;
    const surface: HTMLDivElement = maybeSurface;
    const context: CanvasRenderingContext2D = maybeContext;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const interactive = !reducedMotion && !coarsePointer;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let frameId = 0;
    let active = false;
    let cursorX = 0;
    let cursorY = 0;
    let targetX = 0;
    let targetY = 0;
    let lastYear: number | null = null;

    function draw() {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "rgba(113, 151, 130, 0.16)";
      for (const particle of particles) context.fillRect(particle.x - 0.35, particle.y - 0.35, 0.7, 0.7);

      if (!active) return;
      const radius = Math.max(78, Math.min(118, width * 0.09));
      for (const particle of particles) {
        const influence = falloff(Math.hypot(particle.baseX - cursorX, particle.baseY - cursorY), radius);
        if (influence <= 0) continue;
        const size = 0.55 + influence * 0.95;
        context.fillStyle = `rgba(137, 188, 157, ${0.16 + influence * 0.16})`;
        context.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
      }
    }

    function buildParticles() {
      const bounds = surface.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      const spacing = width < 680 ? 12 : 10.5;
      const next: Particle[] = [];
      for (let row = 0; row <= Math.ceil(height / spacing); row += 1) {
        for (let column = 0; column <= Math.ceil(width / spacing); column += 1) {
          const baseX = column * spacing + jitter(column, row, 0);
          const baseY = row * spacing + jitter(column, row, 1);
          next.push({ baseX, baseY, x: baseX, y: baseY, velocityX: 0, velocityY: 0 });
        }
      }
      particles = next;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw();
    }

    function animate() {
      frameId = 0;
      cursorX += (targetX - cursorX) * 0.22;
      cursorY += (targetY - cursorY) * 0.22;
      const radius = Math.max(78, Math.min(118, width * 0.09));
      let remainingMotion = Math.hypot(targetX - cursorX, targetY - cursorY);

      for (const particle of particles) {
        let desiredX = particle.baseX;
        let desiredY = particle.baseY;
        if (active) {
          const deltaX = cursorX - particle.baseX;
          const deltaY = cursorY - particle.baseY;
          const distance = Math.hypot(deltaX, deltaY);
          const influence = falloff(distance, radius);
          if (influence > 0 && distance > 0.001) {
            const compression = 6.6 * influence;
            desiredX += deltaX / distance * compression;
            desiredY += deltaY / distance * compression - 3 * influence * influence;
          }
        }
        particle.velocityX = (particle.velocityX + (desiredX - particle.x) * 0.11) * 0.79;
        particle.velocityY = (particle.velocityY + (desiredY - particle.y) * 0.11) * 0.79;
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        remainingMotion = Math.max(remainingMotion, Math.abs(particle.velocityX), Math.abs(particle.velocityY), Math.abs(desiredX - particle.x), Math.abs(desiredY - particle.y));
      }
      draw();
      if (remainingMotion > 0.025) frameId = window.requestAnimationFrame(animate);
    }

    function requestFrame() {
      if (!frameId) frameId = window.requestAnimationFrame(animate);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!interactive || event.pointerType === "touch") return;
      const bounds = surface.getBoundingClientRect();
      targetX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
      targetY = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
      const year = Math.round(1850 + targetX / Math.max(1, bounds.width) * (2026 - 1850));
      if (year !== lastYear) {
        lastYear = year;
        onYearChange(year);
      }
      if (!active) {
        cursorX = targetX;
        cursorY = targetY;
      }
      active = true;
      requestFrame();
    }

    function handlePointerLeave() {
      active = false;
      lastYear = null;
      onYearChange(null);
      requestFrame();
    }

    const resizeObserver = new ResizeObserver(buildParticles);
    resizeObserver.observe(surface);
    buildParticles();
    if (interactive) {
      surface.addEventListener("pointermove", handlePointerMove, { passive: true });
      surface.addEventListener("pointerleave", handlePointerLeave, { passive: true });
      surface.addEventListener("pointercancel", handlePointerLeave, { passive: true });
    }

    return () => {
      resizeObserver.disconnect();
      surface.removeEventListener("pointermove", handlePointerMove);
      surface.removeEventListener("pointerleave", handlePointerLeave);
      surface.removeEventListener("pointercancel", handlePointerLeave);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [onYearChange, surfaceRef]);

  return <canvas ref={canvasRef} className="history-particle-canvas" aria-hidden="true" />;
}
