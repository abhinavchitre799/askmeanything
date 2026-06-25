/*
 * AskMeAnything embeddable chat widget — framework-free.
 *
 * Despite the `.tsx` extension (kept for the requested folder layout), this
 * module imports NO React. It builds the entire UI with native DOM APIs and
 * renders inside a Shadow DOM for full style isolation.
 *
 * The CSS lives inline as a template string (kept in sync with
 * `widget/styles.css`) so the esbuild step needs no special CSS loader config.
 *
 * No lead capture: the widget never asks for name/email/phone/company/contact.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MountWidgetOptions {
  appOrigin: string;
  projectId: string;
  accentColor?: string;
}

interface Source {
  title: string;
  url: string | null;
  type: "website" | "file";
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface ChatResponse {
  answer: string;
  sources: Source[];
  conversationId: string;
}

const WIDGET_TITLE = "Ask me anything";
const WELCOME_MESSAGE = "Hi! Ask me anything about this site.";
const GENERIC_ERROR = "Sorry, something went wrong. Please try again.";
const VISITOR_STORAGE_KEY = "ama_visitor_id";
const CONVERSATION_STORAGE_KEY = "ama_conversation_id";

/*
 * Widget CSS. Kept in sync with widget/styles.css. Inlined here so the bundle
 * is fully self-contained with no CSS loader configuration.
 */
const WIDGET_CSS = `
.ama-root {
  --ama-accent: #4f46e5;
  --ama-accent-contrast: #ffffff;
  --ama-bg: #ffffff;
  --ama-fg: #1f2937;
  --ama-muted: #6b7280;
  --ama-border: #e5e7eb;
  --ama-user-bg: var(--ama-accent);
  --ama-user-fg: var(--ama-accent-contrast);
  --ama-assistant-bg: #f3f4f6;
  --ama-assistant-fg: #1f2937;
  --ama-error-bg: #fef2f2;
  --ama-error-fg: #b91c1c;
  --ama-error-border: #fecaca;
  --ama-radius: 16px;
  --ama-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.45;
  color: var(--ama-fg);
  box-sizing: border-box;
}
.ama-root *, .ama-root *::before, .ama-root *::after { box-sizing: border-box; }

.ama-bubble {
  position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px;
  border-radius: 50%; border: none; cursor: pointer;
  background: var(--ama-accent); color: var(--ama-accent-contrast);
  box-shadow: var(--ama-shadow); display: flex; align-items: center;
  justify-content: center; z-index: 2147483000; padding: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.ama-bubble:hover { transform: translateY(-2px) scale(1.03); }
.ama-bubble:focus-visible { outline: 3px solid rgba(0, 0, 0, 0.25); outline-offset: 2px; }
.ama-bubble svg { width: 28px; height: 28px; display: block; }
.ama-bubble.ama-hidden { display: none; }

.ama-panel {
  position: fixed; bottom: 20px; right: 20px; width: 360px;
  max-width: calc(100vw - 32px); height: 70vh; max-height: 640px;
  background: var(--ama-bg); border-radius: var(--ama-radius);
  box-shadow: var(--ama-shadow); display: flex; flex-direction: column;
  overflow: hidden; z-index: 2147483001; border: 1px solid var(--ama-border);
}
.ama-panel.ama-hidden { display: none; }

.ama-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; background: var(--ama-accent);
  color: var(--ama-accent-contrast); flex: 0 0 auto;
}
.ama-header__title { font-size: 15px; font-weight: 600; margin: 0; }
.ama-close {
  background: transparent; border: none; color: inherit; cursor: pointer;
  width: 30px; height: 30px; border-radius: 8px; display: flex;
  align-items: center; justify-content: center; padding: 0; opacity: 0.9;
  transition: background 0.15s ease, opacity 0.15s ease;
}
.ama-close:hover { background: rgba(255, 255, 255, 0.2); opacity: 1; }
.ama-close:focus-visible { outline: 2px solid var(--ama-accent-contrast); outline-offset: 1px; }
.ama-close svg { width: 18px; height: 18px; }

.ama-messages {
  flex: 1 1 auto; overflow-y: auto; padding: 16px; display: flex;
  flex-direction: column; gap: 12px; background: var(--ama-bg);
}
.ama-msg { display: flex; flex-direction: column; max-width: 85%; }
.ama-msg--user { align-self: flex-end; align-items: flex-end; }
.ama-msg--assistant { align-self: flex-start; align-items: flex-start; }
.ama-msg__bubble {
  padding: 10px 12px; border-radius: 14px; white-space: pre-wrap;
  word-wrap: break-word; overflow-wrap: anywhere;
}
.ama-msg--user .ama-msg__bubble {
  background: var(--ama-user-bg); color: var(--ama-user-fg);
  border-bottom-right-radius: 4px;
}
.ama-msg--assistant .ama-msg__bubble {
  background: var(--ama-assistant-bg); color: var(--ama-assistant-fg);
  border-bottom-left-radius: 4px;
}

.ama-sources {
  margin-top: 6px; display: flex; flex-direction: column; gap: 3px; max-width: 100%;
}
.ama-sources__label {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--ama-muted); margin-bottom: 1px;
}
.ama-source {
  font-size: 12px; color: var(--ama-accent); text-decoration: none;
  word-wrap: break-word; overflow-wrap: anywhere;
}
.ama-source[href] { text-decoration: underline; }
.ama-source:not([href]) { color: var(--ama-muted); cursor: default; }

.ama-typing {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 4px;
  padding: 12px 14px; background: var(--ama-assistant-bg); border-radius: 14px;
  border-bottom-left-radius: 4px;
}
.ama-typing__dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--ama-muted);
  opacity: 0.6; animation: ama-blink 1.2s infinite ease-in-out both;
}
.ama-typing__dot:nth-child(2) { animation-delay: 0.2s; }
.ama-typing__dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes ama-blink {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.ama-error {
  margin: 0 16px 8px; padding: 10px 12px; background: var(--ama-error-bg);
  color: var(--ama-error-fg); border: 1px solid var(--ama-error-border);
  border-radius: 10px; font-size: 13px; flex: 0 0 auto;
}
.ama-error.ama-hidden { display: none; }

.ama-input-row {
  flex: 0 0 auto; display: flex; align-items: flex-end; gap: 8px;
  padding: 12px; border-top: 1px solid var(--ama-border); background: var(--ama-bg);
}
.ama-input {
  flex: 1 1 auto; resize: none; border: 1px solid var(--ama-border);
  border-radius: 12px; padding: 10px 12px; font-family: inherit; font-size: 14px;
  line-height: 1.4; color: var(--ama-fg); background: var(--ama-bg);
  max-height: 120px; min-height: 40px; outline: none;
}
.ama-input:focus {
  border-color: var(--ama-accent); box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
}
.ama-input:disabled { opacity: 0.6; cursor: not-allowed; }

.ama-send {
  flex: 0 0 auto; width: 40px; height: 40px; border-radius: 12px; border: none;
  background: var(--ama-accent); color: var(--ama-accent-contrast); cursor: pointer;
  display: flex; align-items: center; justify-content: center; padding: 0;
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.ama-send:hover:not(:disabled) { transform: translateY(-1px); }
.ama-send:disabled { opacity: 0.5; cursor: not-allowed; }
.ama-send:focus-visible { outline: 2px solid var(--ama-accent); outline-offset: 2px; }
.ama-send svg { width: 20px; height: 20px; }

@media (max-width: 480px) {
  .ama-panel {
    width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh;
    bottom: 0; right: 0; left: 0; border-radius: 0; border: none;
  }
  .ama-bubble { bottom: 16px; right: 16px; }
}
`;

/* ---------- Small helpers ---------- */

/** Escape HTML so user/assistant text can never inject markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Stable per-visitor id, persisted in localStorage. */
function getVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const id = generateId();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, id);
    return id;
  } catch {
    // localStorage may be unavailable (private mode / blocked). Fall back to
    // an ephemeral id for this page load.
    return generateId();
  }
}

function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  // RFC4122-ish fallback.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  }
  return node;
}

/* Inline SVG icons (no external assets). */
const ICON_CHAT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const ICON_SEND =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

/**
 * Mount the widget. Idempotent guarding is the caller's responsibility
 * (see entry.ts).
 */
export function mountWidget(options: MountWidgetOptions): void {
  const { appOrigin, projectId, accentColor } = options;

  // ----- State (plain closure variables) -----
  const messages: ChatMessage[] = [
    { role: "assistant", content: WELCOME_MESSAGE },
  ];
  let loading = false;
  let error: string | null = null;
  let conversationId: string | null = readStoredConversationId();
  let isOpen = false;
  const visitorId = getVisitorId();

  // ----- Shadow host -----
  const host = el("div");
  host.setAttribute("data-ama-widget", "");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = WIDGET_CSS;
  shadow.appendChild(style);

  const root = el("div", "ama-root");
  if (accentColor) root.style.setProperty("--ama-accent", accentColor);
  shadow.appendChild(root);

  // ----- Build UI -----
  const bubble = createBubble(toggle);
  const { panel, messagesEl, errorEl, input, sendBtn } = createPanel({
    onClose: close,
    onSend: handleSend,
  });

  root.appendChild(bubble);
  root.appendChild(panel);

  renderMessages();
  renderError();
  syncOpenState();

  // ----- Escape closes the panel -----
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) close();
  });

  /* ---------- Builders ---------- */

  function createBubble(onClick: () => void): HTMLButtonElement {
    const btn = el("button", "ama-bubble", {
      type: "button",
      "aria-label": "Open chat",
    });
    btn.innerHTML = ICON_CHAT;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function createPanel(handlers: {
    onClose: () => void;
    onSend: (text: string) => void;
  }) {
    const panelEl = el("div", "ama-panel ama-hidden", {
      role: "dialog",
      "aria-label": WIDGET_TITLE,
      "aria-modal": "false",
    });

    // Header
    const header = el("div", "ama-header");
    const title = el("h2", "ama-header__title");
    title.textContent = WIDGET_TITLE;
    const closeBtn = el("button", "ama-close", {
      type: "button",
      "aria-label": "Close chat",
    });
    closeBtn.innerHTML = ICON_CLOSE;
    closeBtn.addEventListener("click", handlers.onClose);
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Messages
    const msgs = el("div", "ama-messages", { "aria-live": "polite" });

    // Error banner
    const err = el("div", "ama-error ama-hidden", { role: "alert" });

    // Input row
    const inputRow = el("div", "ama-input-row");
    const textarea = el("textarea", "ama-input", {
      rows: "1",
      placeholder: "Type your question…",
      "aria-label": "Type your question",
    }) as HTMLTextAreaElement;
    const send = el("button", "ama-send", {
      type: "button",
      "aria-label": "Send message",
    }) as HTMLButtonElement;
    send.innerHTML = ICON_SEND;

    const submit = () => {
      const value = textarea.value.trim();
      if (!value || loading) return;
      textarea.value = "";
      autoGrow(textarea);
      handlers.onSend(value);
    };

    send.addEventListener("click", submit);
    textarea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });
    textarea.addEventListener("input", () => autoGrow(textarea));

    inputRow.appendChild(textarea);
    inputRow.appendChild(send);

    panelEl.appendChild(header);
    panelEl.appendChild(msgs);
    panelEl.appendChild(err);
    panelEl.appendChild(inputRow);

    return {
      panel: panelEl,
      messagesEl: msgs,
      errorEl: err,
      input: textarea,
      sendBtn: send,
    };
  }

  /* ---------- Rendering ---------- */

  function renderMessages(): void {
    let html = "";
    for (const m of messages) {
      const cls = m.role === "user" ? "ama-msg--user" : "ama-msg--assistant";
      html += `<div class="ama-msg ${cls}">`;
      html += `<div class="ama-msg__bubble">${escapeHtml(m.content)}</div>`;
      if (m.role === "assistant" && m.sources && m.sources.length > 0) {
        html += renderSources(m.sources);
      }
      html += `</div>`;
    }
    if (loading) {
      html +=
        '<div class="ama-typing" aria-label="Assistant is typing">' +
        '<span class="ama-typing__dot"></span>' +
        '<span class="ama-typing__dot"></span>' +
        '<span class="ama-typing__dot"></span>' +
        "</div>";
    }
    messagesEl.innerHTML = html;
    // Scroll to the newest content.
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderSources(sources: Source[]): string {
    let html = '<div class="ama-sources">';
    html += '<span class="ama-sources__label">Sources</span>';
    for (const s of sources) {
      const label = escapeHtml(s.title || "Source");
      if (s.url) {
        html += `<a class="ama-source" href="${escapeHtml(
          s.url
        )}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      } else {
        // File source with no URL: render the title as plain text.
        html += `<span class="ama-source">${label}</span>`;
      }
    }
    html += "</div>";
    return html;
  }

  function renderError(): void {
    if (error) {
      errorEl.textContent = error;
      errorEl.classList.remove("ama-hidden");
    } else {
      errorEl.textContent = "";
      errorEl.classList.add("ama-hidden");
    }
  }

  function syncOpenState(): void {
    if (isOpen) {
      panel.classList.remove("ama-hidden");
      bubble.classList.add("ama-hidden");
      bubble.setAttribute("aria-label", "Close chat");
      // Focus the input when opening.
      window.setTimeout(() => input.focus(), 0);
    } else {
      panel.classList.add("ama-hidden");
      bubble.classList.remove("ama-hidden");
      bubble.setAttribute("aria-label", "Open chat");
    }
  }

  function setLoading(value: boolean): void {
    loading = value;
    input.disabled = value;
    sendBtn.disabled = value;
    renderMessages();
  }

  /* ---------- Behaviour ---------- */

  function toggle(): void {
    isOpen = !isOpen;
    syncOpenState();
  }

  function close(): void {
    isOpen = false;
    syncOpenState();
  }

  async function handleSend(text: string): Promise<void> {
    error = null;
    renderError();

    messages.push({ role: "user", content: text });
    renderMessages();
    setLoading(true);

    try {
      const res = await sendMessage(text);
      messages.push({
        role: "assistant",
        content: res.answer,
        sources: res.sources || [],
      });
      if (res.conversationId) {
        conversationId = res.conversationId;
        storeConversationId(res.conversationId);
      }
    } catch (e) {
      error = (e instanceof Error && e.message) || GENERIC_ERROR;
      renderError();
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(text: string): Promise<ChatResponse> {
    let res: Response;
    try {
      res = await fetch(`${appOrigin}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          visitorId,
          messages: [{ role: "user", content: text }],
        }),
      });
    } catch {
      // Network-level failure (offline, CORS, DNS, etc.).
      throw new Error("Couldn't reach the server. Check your connection.");
    }

    if (!res.ok) {
      let serverMsg: string | null = null;
      try {
        const data = (await res.json()) as { error?: string };
        if (data && typeof data.error === "string") serverMsg = data.error;
      } catch {
        /* response had no JSON body */
      }
      throw new Error(serverMsg || GENERIC_ERROR);
    }

    return (await res.json()) as ChatResponse;
  }
}

/* ---------- Session-scoped conversation id ---------- */

function readStoredConversationId(): string | null {
  try {
    return window.sessionStorage.getItem(CONVERSATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeConversationId(id: string): void {
  try {
    window.sessionStorage.setItem(CONVERSATION_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/* ---------- Misc DOM helpers ---------- */

function autoGrow(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
}
