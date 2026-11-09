/**
 * High-performance, snappy smooth scrolling utility for fast cycling through guess occurrences.
 * Replaces sluggish native browser smooth scrolling (which defaults to 600-800ms) with a fast,
 * interruptible 140ms animation with cubic deceleration.
 */

let activeAnimationId: number | null = null;

export interface FastScrollOptions {
  duration?: number; // Duration in milliseconds (default: 140ms)
  block?: 'center' | 'start';
}

export function fastScrollToElement(
  target: string | HTMLElement,
  options: FastScrollOptions = {}
): void {
  const duration = options.duration ?? 140;
  const block = options.block ?? 'center';

  // Cancel any ongoing scroll animation immediately so repeated clicks feel instantaneous
  if (activeAnimationId !== null) {
    cancelAnimationFrame(activeAnimationId);
    activeAnimationId = null;
  }

  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;

  const container = document.getElementById('articleScrollContainer');
  if (!container) {
    el.scrollIntoView({ behavior: 'auto', block });
    return;
  }

  const isInsideContainer = container.contains(el);

  let targetScrollTop = 0;
  if (isInsideContainer) {
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    if (block === 'center') {
      const elCenterOffset = (elRect.top - containerRect.top) + (elRect.height / 2);
      targetScrollTop = container.scrollTop + elCenterOffset - (container.clientHeight / 2);
    } else {
      targetScrollTop = container.scrollTop + (elRect.top - containerRect.top) - 20;
    }

    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    targetScrollTop = Math.max(0, Math.min(maxScroll, targetScrollTop));
  } else {
    // Target element is outside scroll container (e.g., in article title)
    targetScrollTop = 0;
  }

  const startScrollTop = container.scrollTop;
  const distance = targetScrollTop - startScrollTop;

  // If distance is negligible, apply immediately
  if (Math.abs(distance) < 3) {
    container.scrollTop = targetScrollTop;
    return;
  }

  const startTime = performance.now();

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Cubic ease-out: rapid jump into motion with smooth deceleration
    const ease = 1 - Math.pow(1 - progress, 3);

    container.scrollTop = startScrollTop + distance * ease;

    if (progress < 1) {
      activeAnimationId = requestAnimationFrame(step);
    } else {
      activeAnimationId = null;
      container.scrollTop = targetScrollTop; // Ensure exact final placement
    }
  };

  activeAnimationId = requestAnimationFrame(step);

  // If on mobile/stacked view and element is off-screen vertically, keep it in window view
  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    const elRect = el.getBoundingClientRect();
    if (elRect.top < 60 || elRect.bottom > window.innerHeight - 60) {
      const targetWindowY = window.scrollY + elRect.top - (window.innerHeight / 3);
      window.scrollTo({
        top: Math.max(0, targetWindowY),
        behavior: 'smooth'
      });
    }
  }
}
