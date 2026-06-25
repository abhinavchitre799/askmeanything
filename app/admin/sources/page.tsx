"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  api,
  Badge,
  Button,
  Card,
  Input,
  Select,
  StatusMessage,
} from "@/components/admin/ui";
import { useSelectedProject } from "@/components/admin/ProjectContext";
import { AiSettings } from "@/components/admin/AiSettings";

type CrawlJob = {
  status: string;
  pagesFound: number;
  pagesIndexed: number;
  finishedAt: string | null;
};

type Source = {
  id: string;
  type: "website" | "sitemap" | string;
  url: string;
  title: string | null;
  status: string;
  lastSyncedAt: string | null;
  createdAt: string;
  crawlJobs?: CrawlJob[];
};

export default function SourcesPage() {
  const { projectId } = useSelectedProject();

  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add source form
  const [type, setType] = useState<"website" | "sitemap">("website");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [sourceMsg, setSourceMsg] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  // Upload form
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  // Crawl
  const [crawlMsg, setCrawlMsg] = useState<{
    kind: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [crawlingId, setCrawlingId] = useState<string | null>(null);
  const pollTimers = useRef<ReturnType<typeof setInterval>[]>([]);

  const loadSources = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = (await api.get(
        `/api/sources?projectId=${encodeURIComponent(projectId)}`
      )) as Source[];
      setSources(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Cleanup any polling intervals on unmount.
  useEffect(() => {
    return () => {
      pollTimers.current.forEach((t) => clearInterval(t));
      pollTimers.current = [];
    };
  }, []);

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    setSourceMsg(null);
    if (!projectId) return;
    if (!url.trim()) {
      setSourceMsg({ kind: "error", text: "URL is required." });
      return;
    }
    setAddingSource(true);
    try {
      await api.post("/api/sources", {
        projectId,
        type,
        url: url.trim(),
        title: title.trim() || undefined,
      });
      setUrl("");
      setTitle("");
      setSourceMsg({ kind: "success", text: "Source added." });
      await loadSources();
    } catch (err) {
      setSourceMsg({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to add source",
      });
    } finally {
      setAddingSource(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadMsg(null);
    if (!projectId) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadMsg({ kind: "error", text: "Choose a file first." });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", file);
      const res = (await api.postForm("/api/upload", fd)) as {
        chunkCount: number;
      };
      setUploadMsg({
        kind: "success",
        text: `Uploaded "${file.name}" — ${res.chunkCount} chunk(s) indexed.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadSources();
    } catch (err) {
      setUploadMsg({
        kind: "error",
        text: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  }

  function startPolling() {
    // Poll every 3s for ~30s, then stop.
    const start = Date.now();
    const timer = setInterval(async () => {
      try {
        await loadSources();
      } catch {
        /* ignore transient errors during polling */
      }
      if (Date.now() - start > 30_000) {
        clearInterval(timer);
        pollTimers.current = pollTimers.current.filter((t) => t !== timer);
      }
    }, 3000);
    pollTimers.current.push(timer);
  }

  async function handleCrawl(sourceId: string) {
    if (!projectId) return;
    setCrawlMsg(null);
    setCrawlingId(sourceId);
    try {
      await api.post("/api/crawl", { projectId, sourceId });
      setCrawlMsg({
        kind: "info",
        text: "Crawl started. Refreshing status for ~30s…",
      });
      await loadSources();
      startPolling();
    } catch (err) {
      setCrawlMsg({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to start crawl",
      });
    } finally {
      setCrawlingId(null);
    }
  }

  if (!projectId) {
    return (
      <Card>
        <h1 className="text-xl font-bold text-gray-900">Sources</h1>
        <p className="mt-2 text-sm text-gray-600">
          No project selected. Please{" "}
          <Link href="/admin" className="text-indigo-600 underline">
            pick a project on the Projects page
          </Link>{" "}
          first.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sources</h1>
        <p className="mt-1 text-sm text-gray-600">
          Active project: <code className="font-mono">{projectId}</code>
        </p>
      </div>

      {/* AI provider / API key (Bring Your Own Key) */}
      <AiSettings projectId={projectId} />

      {/* Section A — add website / sitemap */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Add website / sitemap source
        </h2>
        <form onSubmit={handleAddSource} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Type
              </label>
              <Select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "website" | "sitemap")
                }
              >
                <option value="website">website</option>
                <option value="sitemap">sitemap</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                URL <span className="text-red-500">*</span>
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Title <span className="text-gray-400">(optional)</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Marketing site"
            />
          </div>
          {sourceMsg && (
            <StatusMessage kind={sourceMsg.kind}>
              {sourceMsg.text}
            </StatusMessage>
          )}
          <Button type="submit" disabled={addingSource}>
            {addingSource ? "Adding…" : "Add source"}
          </Button>
        </form>
      </Card>

      {/* Section B — upload document */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Upload document
        </h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              File <span className="text-gray-400">(.txt, .md, .pdf, .docx)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>
          {uploadMsg && (
            <StatusMessage kind={uploadMsg.kind}>
              {uploadMsg.text}
            </StatusMessage>
          )}
          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </form>
      </Card>

      {/* Section C — sources list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Sources</h2>
          <Button variant="secondary" onClick={loadSources} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {crawlMsg && (
          <StatusMessage kind={crawlMsg.kind}>{crawlMsg.text}</StatusMessage>
        )}
        {loadError && <StatusMessage kind="error">{loadError}</StatusMessage>}
        {loading && sources.length === 0 && (
          <p className="text-sm text-gray-500">Loading sources…</p>
        )}
        {!loading && !loadError && sources.length === 0 && (
          <p className="text-sm text-gray-500">
            No sources yet. Add one above.
          </p>
        )}

        {sources.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last indexed</th>
                  <th className="px-4 py-3 font-medium">Pages</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sources.map((s) => {
                  const latest = s.crawlJobs?.[0];
                  const crawlable =
                    s.type === "website" || s.type === "sitemap";
                  return (
                    <tr key={s.id} className="align-top">
                      <td className="px-4 py-3 text-gray-900">
                        {s.title || (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="max-w-[16rem] px-4 py-3">
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-indigo-600 hover:underline"
                          >
                            {s.url}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.type}</td>
                      <td className="px-4 py-3">
                        <Badge status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.lastSyncedAt
                          ? new Date(s.lastSyncedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {latest
                          ? `${latest.pagesIndexed ?? 0}/${
                              latest.pagesFound ?? 0
                            }`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {crawlable ? (
                          <Button
                            variant="secondary"
                            onClick={() => handleCrawl(s.id)}
                            disabled={crawlingId === s.id}
                          >
                            {crawlingId === s.id
                              ? "Starting…"
                              : "Crawl / Re-index"}
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400">
                            document
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
