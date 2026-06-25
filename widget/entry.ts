/*
 * AskMeAnything widget loader entry point.
 *
 * This is the file embedded site owners load:
 *   <script src="https://YOUR_DOMAIN/widget.js" data-project-id="PROJECT_ID"></script>
 *
 * On load it:
 *   1. Finds its own <script> tag.
 *   2. Reads `data-project-id` (required) and optional `data-accent-color`.
 *   3. Derives the app origin from its own src (where widget.js was served).
 *   4. Mounts the widget, guarding against double-mount.
 */

import { mountWidget } from "./Widget";

declare global {
  interface Window {
    __amaWidgetMounted?: boolean;
  }
}

/**
 * Locate the <script> element that loaded this bundle. Prefers
 * document.currentScript; falls back to the script whose src ends in
 * `/widget.js`.
 */
function findOwnScript(): HTMLScriptElement | null {
  const current = document.currentScript as HTMLScriptElement | null;
  if (current && current.src) return current;

  const scripts = Array.from(document.getElementsByTagName("script"));
  for (const s of scripts) {
    if (s.src && /\/widget\.js(\?.*)?$/.test(s.src)) return s;
  }
  return null;
}

/** Derive the app origin from a script src, falling back to the page origin. */
function deriveAppOrigin(scriptSrc: string | undefined): string {
  if (scriptSrc) {
    try {
      return new URL(scriptSrc).origin;
    } catch {
      /* malformed src — fall through */
    }
  }
  return window.location.origin;
}

function init(): void {
  if (window.__amaWidgetMounted) return;

  const script = findOwnScript();

  const projectId = script?.dataset.projectId;
  if (!projectId) {
    console.warn(
      "[AskMeAnything] widget.js loaded but no `data-project-id` was found on the script tag. " +
        'Add it like: <script src=".../widget.js" data-project-id="YOUR_PROJECT_ID"></script>'
    );
    return;
  }

  const appOrigin = deriveAppOrigin(script?.src);
  const accentColor = script?.dataset.accentColor;

  window.__amaWidgetMounted = true;

  mountWidget({ appOrigin, projectId, accentColor });
}

// Run once the DOM is ready (the script may be in <head> or deferred).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
