# AskMeAnything — in plain language

**A smart chat bubble for your website that answers visitors' questions using
your own content — and never makes things up.**

---

## What it is

Think of it as a **smart receptionist** for your website.

You let it "read" your website and any documents you upload. After that, a small
chat bubble appears in the corner of your site. Visitors can type any question,
and the receptionist answers them — using only what it read — and shows links
back to where it found the answer.

If it doesn't know something, it says so honestly and suggests contacting you,
instead of inventing an answer.

---

## Why people want this

- **Visitors get instant answers** at 2am without waiting for support.
- **You stop answering the same questions** over and over.
- **No wrong answers.** It only speaks from your real content, with sources.
- **One line to install.** Paste a single tag and it shows up on your site.
- **You're in control of cost.** You plug in your own AI key (there's a free
  option), so you're never locked into someone else's bill.

---

## How it works, in 3 steps

### 1. Teach it
In a simple admin dashboard you:
- paste your **website link**, and/or
- upload **documents** (PDF, Word, text, Markdown).

It reads the pages, throws away the clutter (menus, footers, popups), and
remembers the real content by **meaning** — not just keywords.

### 2. Connect your AI key
You paste your own **AI API key** once per project. There's a **free Google
Gemini** option, or you can use OpenAI and similar services. Your key is stored
**encrypted** and is never shown to visitors.

### 3. Install the bubble
Add one line to your site:

```html
<script src="https://YOUR_DOMAIN/widget.js" data-project-id="YOUR_ID"></script>
```

That's it — the chat bubble is live.

---

## The clever part: it fills its own gaps

If a visitor asks something the receptionist hasn't read yet, it doesn't give
up. It **quickly reads a few more pages of your live website right then**,
learns the answer, and replies — and it **remembers** what it learned so the
next person gets an instant answer. The knowledge base improves itself over time.

---

## What it will *not* do (on purpose)

- It **never collects personal info** — no name, email, phone, or "book a demo"
  forms. No hidden lead capture anywhere.
- It **never invents** facts, prices, or promises. If your content doesn't say
  it, the bubble won't claim it.
- It **keeps your AI key private** — keys live on your server, never in the
  visitor's browser.
- For sensitive topics (legal, billing, account-specific), it politely points
  people to contact you directly.

---

## Who it's for

- **Small businesses & SaaS** — answer product, pricing, and how-to questions.
- **Documentation & help centers** — a search box that actually answers.
- **Anyone with a website** and a few docs who wants self-serve support.

---

## What you need to run it

- A place to host a web app (it's built with Next.js).
- A PostgreSQL database (with the free `pgvector` add-on for the "memory").
- An AI API key — the **free Gemini tier** is enough to start.

Full setup steps are in the [README](README.md).

---

## The honest limitations (today)

- The admin dashboard has **no login yet** — add one before going public.
- It reads normal web pages; pages that build themselves entirely with
  JavaScript may not be fully read.
- Free AI tiers have **rate limits** and can change.

These are noted so you know exactly what you're getting — an MVP that works
end-to-end, ready to grow.

---

*Short version: it reads your site and documents, answers visitors from that
knowledge with sources, fills gaps by reading your live site on the fly, and
never makes things up or collects personal data — using an AI key you control.*
