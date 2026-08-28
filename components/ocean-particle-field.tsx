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

const LAND_SELECTOR = ".map-land, .market-hit-target, .market-pulse, .point-market-ring, .country-focus-overlay";

function grainJitter(column: number, row: number, axis: number) {
  const value = Math.sin(column * 91.7 + row * 37.1 + axis * 53.3) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * 1.25;
}

function smoothFalloff(distance: number, radius: number) {
  const amount = Math.max(0, Math.min(1, 1 - distance / radius));
  return amount * amount * (3 - 2 * amount);
}

export function OceanParticleField({ surfaceRef }: { surfaceRef: RefObject<SVGSVGElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;

    const maybeContext = canvas.getContext("2d", { alpha: true });
    if (!maybeContext) return;
    const context: CanvasRenderingContext2D = maybeContext;
    const mapSurface: SVGSVGElement = surface;
    const fieldCanvas: HTMLCanvasElement = canvas;

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

    function draw() {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "rgba(147, 174, 161, 0.18)";
      for (const particle of particles) {
        context.fillRect(particle.x - 0.38, particle.y - 0.38, 0.76, 0.76);
      }

      if (!active) return;
      const radius = Math.max(72, Math.min(112, width * 0.075));
      context.fillStyle = "rgba(174, 207, 190, 0.22)";
      for (const particle of particles) {
        const distance = Math.hypot(particle.baseX - cursorX, particle.baseY - cursorY);
        const influence = smoothFalloff(distance, radius);
        if (influence <= 0) continue;
        const size = 0.55 + influence * 0.82;
        context.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
      }
    }

    function buildParticles() {
      const bounds = mapSurface.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      const density = width < 680 ? 10.5 : 9;
      const next: Particle[] = [];
      const columns = Math.ceil(width / density);
      const rows = Math.ceil(height / density);

      for (let row = 0; row <= rows; row += 1) {
        for (let column = 0; column <= columns; column += 1) {
          const baseX = column * density + grainJitter(column, row, 0);
          const baseY = row * density + grainJitter(column, row, 1);
          next.push({ baseX, baseY, x: baseX, y: baseY, velocityX: 0, velocityY: 0 });
        }
      }

      particles = next;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      fieldCanvas.width = Math.round(width * pixelRatio);
      fieldCanvas.height = Math.round(height * pixelRatio);
      fieldCanvas.style.width = `${width}px`;
      fieldCanvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw();
    }

    function animate() {
      frameId = 0;
      cursorX += (targetX - cursorX) * 0.24;
      cursorY += (targetY - cursorY) * 0.24;
      const radius = Math.max(72, Math.min(112, width * 0.075));
      let remainingMotion = Math.hypot(targetX - cursorX, targetY - cursorY);

      for (const particle of particles) {
        let desiredX = particle.baseX;
        let desiredY = particle.baseY;
        let influence = 0;

        if (active) {
          const deltaX = cursorX - particle.baseX;
          const deltaY = cursorY - particle.baseY;
          const distance = Math.hypot(deltaX, deltaY);
          influence = smoothFalloff(distance, radius);
          if (influence > 0 && distance > 0.001) {
            const compression = 7.2 * influence;
            desiredX += deltaX / distance * compression;
            desiredY += deltaY / distance * compression - 3.4 * influence * influence;
          }
        }

        particle.velocityX = (particle.velocityX + (desiredX - particle.x) * 0.115) * 0.78;
        particle.velocityY = (particle.velocityY + (desiredY - particle.y) * 0.115) * 0.78;
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        remainingMotion = Math.max(
          remainingMotion,
          Math.abs(particle.velocityX),
          Math.abs(particle.velocityY),
          Math.abs(desiredX - particle.x),
          Math.abs(desiredY - particle.y),
        );
      }

      draw();
      if (remainingMotion > 0.025) frameId = window.requestAnimationFrame(animate);
      else {
        particles.forEach((particle) => {
          particle.x = particle.baseX;
          particle.y = particle.baseY;
          particle.velocityX = 0;
          particle.velocityY = 0;
        });
        draw();
      }
    }

    function requestFrame() {
      if (!frameId) frameId = window.requestAnimationFrame(animate);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!interactive || event.pointerType === "touch") return;
      const target = event.target instanceof Element ? event.target : null;
      const overLand = Boolean(target?.closest(LAND_SELECTOR));
      if (overLand || mapSurface.classList.contains("dragging")) {
        if (active) {
          active = false;
          requestFrame();
        }
        return;
      }

      const bounds = mapSurface.getBoundingClientRect();
      targetX = event.clientX - bounds.left;
      targetY = event.clientY - bounds.top;
      if (!active) {
        cursorX = targetX;
        cursorY = targetY;
      }
      active = true;
      requestFrame();
    }

    function handlePointerLeave() {
      if (!active) return;
      active = false;
      requestFrame();
    }

    const resizeObserver = new ResizeObserver(buildParticles);
    resizeObserver.observe(mapSurface);
    buildParticles();
    if (interactive) {
      mapSurface.addEventListener("pointermove", handlePointerMove, { passive: true });
      mapSurface.addEventListener("pointerleave", handlePointerLeave, { passive: true });
      mapSurface.addEventListener("pointercancel", handlePointerLeave, { passive: true });
    }

    return () => {
      resizeObserver.disconnect();
      mapSurface.removeEventListener("pointermove", handlePointerMove);
      mapSurface.removeEventListener("pointerleave", handlePointerLeave);
      mapSurface.removeEventListener("pointercancel", handlePointerLeave);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [surfaceRef]);

  return <canvas ref={canvasRef} className="ocean-particle-canvas" aria-hidden="true" />;
}
