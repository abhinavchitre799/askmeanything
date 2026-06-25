# AskMeAnything — Embeddable AI Website Q&A Widget

Ask and get answers to any questions related to your product. AskMeAnything
builds a knowledge base from your **website content** and **uploaded documents**,
then serves a **floating chat widget** any site can embed with one `<script>`
tag. Answers are grounded in retrieved content and cite their sources.

If the knowledge base can't answer a question, the widget **crawls your website
on demand** to look for the answer, indexes what it finds, and tries again.

---

## What it does

- **Admin dashboard** — create projects, add a website/sitemap, upload docs,
  trigger crawls, and view indexed sources and visitor conversations.
- **Website ingestion** — sitemap parsing or same-domain BFS crawling, clean
  text extraction (boilerplate stripped), chunking, and embeddings.
- **Document ingestion** — TXT, Markdown, PDF, and DOCX uploads.
- **Vector search** — pgvector cosine similarity, strictly scoped per project.
- **Grounded answers** — a strict, provider-agnostic system prompt that refuses
  to invent facts and recommends contacting the company when unsure.
- **Live-crawl fallback** — when retrieval comes up empty, crawl the project's
  website on the fly, index it, and retry.
- **Embeddable widget** — vanilla JS, Shadow-DOM isolated, no React on the host.
- **No lead capture** — by design. See [No lead capture](#no-lead-capture).

## Tech stack

- Next.js 14 (App Router) + TypeScript + React 18
- Node.js route handlers (server-side only for all LLM calls)
- PostgreSQL + [pgvector](https://github.com/pgvector/pgvector)
- Prisma ORM
- Tailwind CSS
- Cheerio for static HTML extraction (Playwright intentionally not used for MVP)
- `fetch`-based LLM clients — **no provider SDKs**
- esbuild to bundle the standalone widget

---

## Setup

### 1. Prerequisites

- Node.js 18+ (tested on 22)
- PostgreSQL 14+ with the `vector` extension available

### 2. Install

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# then edit .env (see "Environment variables" below)
```

### 4. Database + pgvector

Create a database and enable pgvector. The migration also runs
`CREATE EXTENSION IF NOT EXISTS vector;`, but the role must be allowed to create
extensions (superuser locally, or pre-enabled on managed hosts like Neon/Supabase).

```bash
createdb widget_ai
# optional manual enable:
psql widget_ai -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

> **Embedding dimension matters.** The migration creates the embedding column as
> `vector(768)` (Google Gemini `text-embedding-004`). If your embedding model
> outputs a different size (e.g. OpenAI `text-embedding-3-small` = 1536), edit
> `prisma/migrations/0001_init/migration.sql` and replace every `vector(768)`
> with your dimension **before** migrating, and set `EMBEDDING_DIMENSION` to match.

### 5. Run Prisma migrations

```bash
npx prisma generate           # generate the client
npx prisma migrate deploy     # apply prisma/migrations/0001_init
```

(During development you can use `npx prisma migrate dev` instead.)

### 6. Build the widget bundle + run

```bash
npm run build:widget          # bundles /public/widget.js
npm run dev                   # http://localhost:3000
```

`npm run build` runs the widget build and the Next.js build together.

---

## Environment variables

```bash
DATABASE_URL=                 # postgres connection string
APP_URL=                      # e.g. http://localhost:3000

LLM_PROVIDER=                 # "openai-compatible" | "google-gemini"

# OpenAI-compatible provider
LLM_API_BASE_URL=
LLM_API_KEY=
LLM_CHAT_MODEL=
LLM_EMBEDDING_MODEL=

# Google Gemini provider
GOOGLE_GEMINI_API_KEY=
GOOGLE_GEMINI_CHAT_MODEL=
GOOGLE_GEMINI_EMBEDDING_MODEL=

# Optional tuning
EMBEDDING_DIMENSION=768       # must match your embedding model + the migration
CRAWL_MAX_PAGES=50            # max pages per full crawl job
LIVE_CRAWL_FALLBACK=true      # crawl the site on demand when the KB can't answer
LIVE_CRAWL_MAX_PAGES=5        # pages fetched during a live fallback
RETRIEVAL_MIN_SIMILARITY=0.3  # below this, the KB is "insufficient" -> fallback
```

**Never commit real keys.** All LLM calls happen server-side; keys are never
exposed to the browser or the widget.

---

## Using a free hosted model

The app supports the **Google Gemini API** as a free-tier hosted model option,
so you can run the whole MVP without paying for an LLM.

1. Create an API key at <https://aistudio.google.com/apikey>.
2. Set in `.env`:

   ```bash
   LLM_PROVIDER="google-gemini"
   GOOGLE_GEMINI_API_KEY="..."
   GOOGLE_GEMINI_CHAT_MODEL="your-gemini-chat-model"
   GOOGLE_GEMINI_EMBEDDING_MODEL="your-gemini-embedding-model"
   ```

   Working model values to try: chat `gemini-2.0-flash`, embedding
   `text-embedding-004` (768-dim — matches the default migration).

> Free tiers are **rate-limited and may change** without notice. Model names are
> read from environment variables and are never hardcoded, so you can swap them
> at any time without code changes. If you hit a rate limit the API returns a
> clear "rate limited" error.

## Using an OpenAI-compatible provider instead

Works with OpenAI, Together, Groq, OpenRouter, Ollama, LM Studio, etc. — anything
exposing `/chat/completions` and `/embeddings`.

```bash
LLM_PROVIDER="openai-compatible"
LLM_API_BASE_URL="https://api.openai.com/v1"   # or your provider's base URL
LLM_API_KEY="..."
LLM_CHAT_MODEL="gpt-4o-mini"
LLM_EMBEDDING_MODEL="text-embedding-3-small"   # 1536-dim -> update the migration!
```

Switching providers is **environment-only** — no application code changes. The
entire app depends on the generic interface in `lib/llm/types.ts`; the concrete
provider is chosen in `lib/llm/index.ts` from `LLM_PROVIDER`.

---

## How to use it

### Create a project

1. Open <http://localhost:3000/admin>.
2. Under **Projects**, enter a name and (optionally) your site's domain, e.g.
   `example.com`. The domain is used as a seed for the live-crawl fallback.
3. Click **Select** on the project to make it active for the other pages.

### Crawl a website

1. Go to **Sources**.
2. Under *Add website / sitemap source*, choose `website` or `sitemap`, paste the
   URL (e.g. `https://example.com` or `https://example.com/sitemap.xml`), submit.
3. Click **Crawl / Re-index** on the source. The job runs in the background; the
   table shows status and `pagesIndexed / pagesFound`. (Use **Refresh** or wait
   for the auto-poll.)

The crawler stays on the same domain, dedupes URLs, respects `CRAWL_MAX_PAGES`,
times out slow requests, records a `CrawlJob`, and notes failed URLs.

### Upload knowledge base files

On **Sources → Upload document**, pick a `.txt`, `.md`, `.pdf`, or `.docx` file
and submit. The text is extracted, chunked, embedded, and stored in the same
vector index as website content. Answers cite the file name.

### Test chat

- Quick demo page: build the widget, then open
  <http://localhost:3000/widget-demo.html> and set its `data-project-id`.
- Or call the API directly:

  ```bash
  curl -X POST http://localhost:3000/api/chat \
    -H 'Content-Type: application/json' \
    -d '{"projectId":"YOUR_PROJECT_ID","messages":[{"role":"user","content":"What does this product do?"}]}'
  ```

  Response:

  ```json
  {
    "answer": "...",
    "sources": [{ "title": "...", "url": "...", "type": "website" }],
    "conversationId": "..."
  }
  ```

### View conversations

**Admin → Conversations** lists visitor conversations; click one to see the
messages and the sources cited for each answer. (There is no leads page.)

---

## Embed the widget on another website

Build the bundle (`npm run build:widget`) so `/public/widget.js` exists, then add
one line to any site:

```html
<script
  src="https://YOUR_DOMAIN/widget.js"
  data-project-id="YOUR_PROJECT_ID"
  data-accent-color="#4f46e5"></script>
```

- `data-project-id` (required) scopes all answers to that project.
- `data-accent-color` (optional) themes the bubble/buttons.
- The widget derives the API origin from its own `src`, so host it from the same
  domain as the app. It renders inside a **Shadow DOM** (host styles can't leak
  in), shows a floating bubble → chat panel, keeps a local visitor id, preserves
  the conversation for the session, and is responsive on mobile.
- The widget only ever calls **your** `/api/chat` backend. All keys stay server-side.

---

## How the live website fallback works

When a visitor asks something the knowledge base can't answer confidently
(no chunks, or the best cosine similarity is below `RETRIEVAL_MIN_SIMILARITY`),
and `LIVE_CRAWL_FALLBACK` is enabled, `lib/answer.ts`:

1. Resolves a seed URL — the project's most recent website/sitemap source, or
   else the `Project.domain` (a website source is created on the fly).
2. Crawls up to `LIVE_CRAWL_MAX_PAGES` same-domain pages and indexes them
   (`ingestText` dedupes by content hash, so this is cheap on repeats).
3. Re-runs retrieval once and answers from the freshly indexed content.

A per-project 60-second cooldown prevents repeated questions from re-crawling on
every message. The fallback never throws — at worst it indexes nothing and the
assistant returns the safe "couldn't find that" message.

---

## No lead capture

This product **does not collect visitor contact details** — by design.

- Sales, pricing, demo, and support questions are answered from your content
  where possible.
- If the knowledge base (and live crawl) can't answer, the widget recommends
  **contacting the company directly** — it never asks for a name, email, phone,
  company, or any contact info.
- There is **no `Lead` model, no `/api/leads`, no lead form, and no admin leads
  page**. No CRM or email-notification logic exists anywhere in the codebase.

---

## Project structure

```
app/
  page.tsx                         landing
  admin/                           admin dashboard (no auth — see TODO)
    layout.tsx  page.tsx  sources/  conversations/
  api/
    projects/  sources/  crawl/  upload/  chat/
    admin/conversations/  admin/conversations/[id]/
components/admin/                  shared UI + project context
lib/
  llm/  types.ts  openaiCompatibleClient.ts  googleGeminiClient.ts  index.ts
  env.ts  prisma.ts  validation.ts  http.ts  prompts.ts
  chunkText.ts  crawler.ts  documents.ts  retrieval.ts  answer.ts
prisma/  schema.prisma  migrations/0001_init/
widget/  Widget.tsx  entry.ts  build-widget.ts  styles.css
public/  widget.js (generated)  widget-demo.html
```

---

## Error handling

Clear errors are surfaced for: missing `DATABASE_URL`, missing/invalid
`LLM_PROVIDER`, missing provider API key / chat model / embedding model, failed
crawls, failed embedding generation, failed chat completion, an empty knowledge
base, and "no relevant context found" (a safe fallback answer, not a crash).
Provider errors are mapped to typed codes (`invalid_api_key`, `rate_limited`,
`malformed_response`, …) and never leak secrets or raw internals to visitors.

## Security & privacy

- API keys are never exposed to the browser; all LLM calls are server-side.
- The widget only calls our own backend APIs.
- Project IDs are validated and retrieval is strictly scoped per project — chunks
  never cross project boundaries.
- Raw internal errors are not exposed to visitors.
- Only necessary conversation data is stored. No visitor contact info, no leads.

---

## Known limitations

- **No authentication on the admin** — anyone who can reach `/admin` can manage
  projects. **TODO: add auth before production.**
- Crawls and uploads run **inline in the request** (background promise for
  crawls). For real scale, move to a proper job queue/worker. (Marked TODO in
  `app/api/crawl/route.ts`.)
- Token counting for chunking is an approximation (~4 chars/token), not a real
  tokenizer.
- Static HTML only — JavaScript-rendered pages aren't executed (Playwright is
  deliberately out of scope for the MVP).
- The pgvector dimension is fixed at migration time; changing embedding models
  later requires a migration.
- Single default organization (multi-tenant org management is stubbed).

## Next steps

- Add admin authentication and per-project API scoping.
- Background job queue for crawling/ingestion with retries and progress.
- Configurable widget settings UI (welcome message, color, position) — the
  `WidgetSettings` model already exists.
- Re-ranking and hybrid (keyword + vector) retrieval.
- Incremental re-crawl / change detection via `contentHash`.
- Optional Playwright renderer for JS-heavy sites.
- Rate limiting and abuse protection on `/api/chat`.
```
