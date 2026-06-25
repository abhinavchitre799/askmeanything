/**
 * Website / sitemap crawler.
 *
 * Discovers same-domain page URLs (via sitemap or BFS link-following),
 * extracts readable text with cheerio, and ingests each page as a Document.
 * Playwright is intentionally not used for the MVP — static HTML only.
 */

import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { getCrawlMaxPages, getLiveCrawlMaxPages } from "@/lib/env";
import { ingestText } from "@/lib/documents";

export interface RunCrawlArgs {
  projectId: string;
  sourceId: string;
  jobId: string;
}

const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = "AskMeAnythingBot/1.0 (+crawler)";

/** Extensions we never try to fetch/parse as HTML. */
const SKIP_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "gz", "tar",
  "rar", "7z", "jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "bmp",
  "tiff", "mp3", "mp4", "wav", "avi", "mov", "webm", "css", "js", "json",
  "xml", "rss", "woff", "woff2", "ttf", "eot", "wasm", "map",
]);

/** Fetch a URL with an AbortController timeout. Returns null on any failure. */
async function fetchWithTimeout(
  url: string,
  ms: number
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True when a URL clearly points at a non-HTML asset by its extension. */
function hasSkippableExtension(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    const idx = pathname.lastIndexOf(".");
    if (idx < 0) return false;
    const ext = pathname.slice(idx + 1).toLowerCase();
    return SKIP_EXTENSIONS.has(ext);
  } catch {
    return true;
  }
}

/** Normalize a URL: drop hash, keep query. Returns null if invalid. */
function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Extract <loc> values from sitemap XML. */
function parseSitemapLocs(xml: string): string[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const locs: string[] = [];
  $("loc").each((_, el) => {
    const text = $(el).text().trim();
    if (text) locs.push(text);
  });
  return locs;
}

/** Fetch a sitemap and return its <loc> URLs, expanding nested sitemaps one level deep. */
async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const res = await fetchWithTimeout(sitemapUrl, REQUEST_TIMEOUT_MS);
  if (!res || !res.ok) return [];
  const xml = await res.text();
  const locs = parseSitemapLocs(xml);

  const pageUrls: string[] = [];
  const nestedSitemaps = locs.filter((u) => /\.xml(\?|$)/i.test(u));

  if (nestedSitemaps.length > 0 && nestedSitemaps.length === locs.length) {
    // This is a sitemap index: expand nested sitemaps one level deep.
    for (const nested of nestedSitemaps) {
      const res2 = await fetchWithTimeout(nested, REQUEST_TIMEOUT_MS);
      if (!res2 || !res2.ok) continue;
      pageUrls.push(...parseSitemapLocs(await res2.text()));
    }
  } else {
    pageUrls.push(...locs);
  }

  return pageUrls;
}

/** True if both URLs share the same hostname. */
function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).hostname === new URL(b).hostname;
  } catch {
    return false;
  }
}

/**
 * Discover the list of page URLs to crawl for a source, capped at the
 * configured max. Sitemap sources parse the sitemap; website sources try
 * /sitemap.xml first, then fall back to a same-domain BFS link crawl.
 */
async function discoverUrls(
  source: {
    type: string;
    url: string;
  },
  maxPagesOverride?: number
): Promise<string[]> {
  const maxPages = maxPagesOverride ?? getCrawlMaxPages();
  const startUrl = source.url;
  const origin = new URL(startUrl).origin;

  const collect = (urls: string[]): string[] => {
    const out = new Set<string>();
    for (const raw of urls) {
      const normalized = normalizeUrl(raw, startUrl);
      if (!normalized) continue;
      if (!sameHost(normalized, startUrl)) continue;
      if (hasSkippableExtension(normalized)) continue;
      out.add(normalized);
      if (out.size >= maxPages) break;
    }
    return [...out];
  };

  if (source.type === "sitemap") {
    return collect(await fetchSitemapUrls(startUrl));
  }

  // website: prefer the sitemap if one exists.
  const sitemapUrls = await fetchSitemapUrls(`${origin}/sitemap.xml`);
  if (sitemapUrls.length > 0) {
    const fromSitemap = collect(sitemapUrls);
    if (fromSitemap.length > 0) return fromSitemap;
  }

  // Fallback: breadth-first crawl following same-domain internal links.
  return bfsCrawlUrls(startUrl, maxPages);
}

/** BFS over same-domain links starting from startUrl, capped at maxPages. */
async function bfsCrawlUrls(
  startUrl: string,
  maxPages: number
): Promise<string[]> {
  const start = normalizeUrl(startUrl);
  if (!start) return [];

  const discovered = new Set<string>([start]);
  const queue: string[] = [start];

  while (queue.length > 0 && discovered.size < maxPages) {
    const current = queue.shift()!;
    const res = await fetchWithTimeout(current, REQUEST_TIMEOUT_MS);
    if (!res || !res.ok) continue;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) continue;

    const html = await res.text();
    const $ = cheerio.load(html);
    $("a[href]").each((_, el) => {
      if (discovered.size >= maxPages) return;
      const href = $(el).attr("href");
      if (!href) return;
      const normalized = normalizeUrl(href, current);
      if (!normalized) return;
      if (!sameHost(normalized, startUrl)) return;
      if (hasSkippableExtension(normalized)) return;
      if (discovered.has(normalized)) return;
      discovered.add(normalized);
      queue.push(normalized);
    });
  }

  return [...discovered];
}

export interface ExtractedPage {
  title: string | null;
  text: string;
}

/** Extract a title and readable text from a page's HTML. */
function extractFromHtml(html: string, url: string): ExtractedPage {
  const $ = cheerio.load(html);

  // Title preference: <title>, then og:title, then first <h1>.
  const title =
    $("title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    null;

  // Strip boilerplate and non-content elements before reading text.
  $(
    "script, style, nav, footer, header, noscript, svg, form, iframe, " +
      "[role=navigation], .cookie, .cookie-banner, #cookie"
  ).remove();

  // Prefer main/article content; fall back to the body.
  const container = $("main").first().length
    ? $("main").first()
    : $("article").first().length
      ? $("article").first()
      : $("body");

  const text = container.text().replace(/\s+/g, " ").trim();

  return { title: title || url, text };
}

/**
 * Fetch a single page, extract readable text, and ingest it as a Document.
 * Returns "indexed" on success, or a human-readable failure reason string.
 * Shared by full crawl jobs and the on-demand live-crawl fallback.
 */
async function fetchExtractIngest(args: {
  projectId: string;
  sourceId: string;
  pageUrl: string;
}): Promise<"indexed" | string> {
  const { projectId, sourceId, pageUrl } = args;
  const res = await fetchWithTimeout(pageUrl, REQUEST_TIMEOUT_MS);
  if (!res || !res.ok) {
    return `HTTP ${res ? res.status : "timeout/error"}`;
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return `skipped non-HTML (${contentType || "unknown"})`;
  }

  const html = await res.text();
  const { title, text } = extractFromHtml(html, pageUrl);
  if (!text.trim()) return "no readable text";

  await ingestText({
    projectId,
    sourceId,
    title,
    url: pageUrl,
    fileName: null,
    text,
  });
  return "indexed";
}

/**
 * Run a crawl job for a source: discover pages, extract text, and ingest each
 * as a Document. Per-page failures are collected and do not abort the job.
 */
export async function runCrawl(args: RunCrawlArgs): Promise<void> {
  const { projectId, sourceId, jobId } = args;

  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { id: true, type: true, url: true },
  });
  if (!source || !source.url) {
    await prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: "Source not found or has no URL.",
      },
    });
    await prisma.source
      .update({ where: { id: sourceId }, data: { status: "error" } })
      .catch(() => {});
    throw new Error(`Crawl aborted: source ${sourceId} not found or missing URL.`);
  }

  await prisma.crawlJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  });
  await prisma.source.update({
    where: { id: sourceId },
    data: { status: "crawling" },
  });

  const failures: string[] = [];
  let pagesFound = 0;
  let pagesIndexed = 0;

  try {
    const urls = await discoverUrls({ type: source.type, url: source.url });
    pagesFound = urls.length;

    for (const pageUrl of urls) {
      try {
        const result = await fetchExtractIngest({ projectId, sourceId, pageUrl });
        if (result === "indexed") {
          pagesIndexed += 1;
        } else {
          failures.push(`${pageUrl}: ${result}`);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "unknown error";
        failures.push(`${pageUrl}: ${reason}`);
      }
    }

    const errorMessage =
      failures.length > 0
        ? `${failures.length} page(s) failed:\n${failures.slice(0, 20).join("\n")}`
        : null;

    await prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        finishedAt: new Date(),
        pagesFound,
        pagesIndexed,
        errorMessage,
      },
    });
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "ready", lastSyncedAt: new Date() },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    await prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        pagesFound,
        pagesIndexed,
        errorMessage: reason,
      },
    });
    await prisma.source
      .update({ where: { id: sourceId }, data: { status: "error" } })
      .catch(() => {});
    throw new Error(`Crawl failed for source ${sourceId}: ${reason}`);
  }
}

/**
 * On-demand "live crawl" fallback used when the knowledge base cannot answer a
 * visitor's question. It fetches a small number of pages from the project's
 * configured website and ingests them so retrieval can be retried immediately
 * (and so the KB improves over time). Kept deliberately small and resilient:
 * any failure just yields fewer indexed pages — it never throws.
 *
 * Seed selection order:
 *   1. The project's most recent website/sitemap Source.
 *   2. Otherwise, the Project.domain (a website Source is created on the fly).
 *
 * ingestText() dedupes by content hash, so repeated fallbacks are cheap and do
 * not re-embed unchanged pages.
 */
export async function liveCrawlProjectWebsite(args: {
  projectId: string;
  maxPages?: number;
}): Promise<{ pagesIndexed: number }> {
  const { projectId } = args;
  const maxPages = args.maxPages ?? getLiveCrawlMaxPages();

  try {
    const seed = await resolveLiveCrawlSeed(projectId);
    if (!seed) return { pagesIndexed: 0 };

    const urls = await discoverUrls(
      { type: seed.type, url: seed.url },
      maxPages
    );

    let pagesIndexed = 0;
    for (const pageUrl of urls.slice(0, maxPages)) {
      try {
        const result = await fetchExtractIngest({
          projectId,
          sourceId: seed.sourceId,
          pageUrl,
        });
        if (result === "indexed") pagesIndexed += 1;
      } catch {
        // Ignore per-page failures during the live fallback.
      }
    }

    if (pagesIndexed > 0) {
      await prisma.source
        .update({
          where: { id: seed.sourceId },
          data: { status: "ready", lastSyncedAt: new Date() },
        })
        .catch(() => {});
    }

    return { pagesIndexed };
  } catch {
    // The fallback must never break the chat flow.
    return { pagesIndexed: 0 };
  }
}

/**
 * Find (or bootstrap) a website/sitemap source to seed the live crawl from.
 * Returns null when the project has no website source and no domain.
 */
async function resolveLiveCrawlSeed(
  projectId: string
): Promise<{ sourceId: string; type: string; url: string } | null> {
  const existing = await prisma.source.findFirst({
    where: { projectId, type: { in: ["website", "sitemap"] }, url: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, url: true },
  });
  if (existing?.url) {
    return { sourceId: existing.id, type: existing.type, url: existing.url };
  }

  // Fall back to the project's domain, creating a website source on demand.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { domain: true },
  });
  const domain = project?.domain?.trim();
  if (!domain) return null;

  const url = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  if (!normalizeUrl(url)) return null;

  const created = await prisma.source.create({
    data: {
      projectId,
      type: "website",
      url,
      title: domain,
      status: "pending",
    },
    select: { id: true, type: true, url: true },
  });
  return { sourceId: created.id, type: created.type, url: created.url! };
}
