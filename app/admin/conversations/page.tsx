"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, Button, Card, StatusMessage } from "@/components/admin/ui";
import { useSelectedProject } from "@/components/admin/ProjectContext";

type ConversationListItem = {
  id: string;
  visitorId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
};

type Message = {
  id: string;
  role: string;
  content: string;
  sourcesJson: unknown;
  createdAt: string;
};

type ConversationDetail = {
  id: string;
  visitorId: string;
  messages: Message[];
};

type ParsedSource = { title?: string; url?: string };

function parseSources(sourcesJson: unknown): ParsedSource[] {
  if (!sourcesJson) return [];
  let raw: unknown = sourcesJson;
  if (typeof sourcesJson === "string") {
    try {
      raw = JSON.parse(sourcesJson);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ParsedSource | null => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        return {
          title:
            typeof o.title === "string"
              ? o.title
              : typeof o.name === "string"
              ? o.name
              : undefined,
          url: typeof o.url === "string" ? o.url : undefined,
        };
      }
      return null;
    })
    .filter((x): x is ParsedSource => x !== null);
}

export default function ConversationsPage() {
  const { projectId } = useSelectedProject();

  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = (await api.get(
        `/api/admin/conversations?projectId=${encodeURIComponent(projectId)}`
      )) as ConversationListItem[];
      setConversations(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function openConversation(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = (await api.get(
        `/api/admin/conversations/${encodeURIComponent(id)}`
      )) as ConversationDetail;
      setDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setDetailLoading(false);
    }
  }

  if (!projectId) {
    return (
      <Card>
        <h1 className="text-xl font-bold text-gray-900">Conversations</h1>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
          <p className="mt-1 text-sm text-gray-600">
            Active project: <code className="font-mono">{projectId}</code>
          </p>
        </div>
        <Button variant="secondary" onClick={loadList} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {loadError && <StatusMessage kind="error">{loadError}</StatusMessage>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* List */}
        <div className="space-y-3">
          {loading && conversations.length === 0 && (
            <p className="text-sm text-gray-500">Loading conversations…</p>
          )}
          {!loading && !loadError && conversations.length === 0 && (
            <p className="text-sm text-gray-500">No conversations yet.</p>
          )}

          {conversations.length > 0 && (
            <Card className="overflow-x-auto p-0">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Visitor</th>
                    <th className="px-4 py-3 font-medium">Messages</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {conversations.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openConversation(c.id)}
                      className={`cursor-pointer hover:bg-indigo-50 ${
                        selectedId === c.id ? "bg-indigo-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-gray-700">
                        {c.visitorId
                          ? c.visitorId.slice(0, 12) +
                            (c.visitorId.length > 12 ? "…" : "")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {c._count?.messages ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(c.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* Detail panel */}
        <div>
          <Card className="lg:sticky lg:top-4">
            {!selectedId && (
              <p className="text-sm text-gray-500">
                Select a conversation to view its messages.
              </p>
            )}
            {selectedId && detailLoading && (
              <p className="text-sm text-gray-500">Loading messages…</p>
            )}
            {selectedId && detailError && (
              <StatusMessage kind="error">{detailError}</StatusMessage>
            )}
            {detail && (
              <div className="space-y-4">
                <div className="border-b border-gray-100 pb-2">
                  <h2 className="font-semibold text-gray-900">Conversation</h2>
                  <p className="font-mono text-xs text-gray-400">
                    {detail.id}
                  </p>
                </div>
                {detail.messages.length === 0 && (
                  <p className="text-sm text-gray-500">No messages.</p>
                )}
                <div className="space-y-3">
                  {detail.messages.map((m) => {
                    const isAssistant = m.role === "assistant";
                    const sources = isAssistant
                      ? parseSources(m.sourcesJson)
                      : [];
                    return (
                      <div
                        key={m.id}
                        className={`rounded-md border p-3 ${
                          isAssistant
                            ? "border-indigo-100 bg-indigo-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {m.role}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(m.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-gray-800">
                          {m.content}
                        </p>
                        {sources.length > 0 && (
                          <div className="mt-2 border-t border-indigo-100 pt-2">
                            <p className="mb-1 text-xs font-medium text-gray-500">
                              Sources
                            </p>
                            <ul className="space-y-0.5">
                              {sources.map((src, i) => (
                                <li key={i} className="text-xs">
                                  {src.url ? (
                                    <a
                                      href={src.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-indigo-600 hover:underline"
                                    >
                                      {src.title || src.url}
                                    </a>
                                  ) : (
                                    <span className="text-gray-600">
                                      {src.title || "Untitled source"}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
