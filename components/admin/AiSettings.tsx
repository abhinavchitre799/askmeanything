"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
  Select,
  StatusMessage,
  Badge,
  api,
} from "@/components/admin/ui";

type Provider = "google-gemini" | "openai-compatible";

interface ConfigStatus {
  configured: boolean;
  provider?: Provider;
  chatModel?: string;
  embeddingModel?: string;
  apiBaseUrl?: string | null;
  embeddingDimension?: number;
  apiKeyHint?: string;
}

// Sensible, working defaults users can keep or change. Models are NEVER
// hardcoded in the backend — these are just convenience presets in the form.
const PRESETS: Record<
  Provider,
  { chatModel: string; embeddingModel: string; apiBaseUrl: string; dimension: number }
> = {
  "google-gemini": {
    chatModel: "gemini-2.5-flash",
    embeddingModel: "gemini-embedding-001",
    apiBaseUrl: "",
    dimension: 768,
  },
  "openai-compatible": {
    chatModel: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
    apiBaseUrl: "https://api.openai.com/v1",
    dimension: 1536,
  },
};

export function AiSettings({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [provider, setProvider] = useState<Provider>("google-gemini");
  const [apiKey, setApiKey] = useState("");
  const [chatModel, setChatModel] = useState(PRESETS["google-gemini"].chatModel);
  const [embeddingModel, setEmbeddingModel] = useState(
    PRESETS["google-gemini"].embeddingModel
  );
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [dimension, setDimension] = useState<string>("768");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    try {
      const data: ConfigStatus = await api.get(`/api/projects/${projectId}/llm`);
      setStatus(data);
      if (data.configured && data.provider) {
        setProvider(data.provider);
        setChatModel(data.chatModel ?? "");
        setEmbeddingModel(data.embeddingModel ?? "");
        setApiBaseUrl(data.apiBaseUrl ?? "");
        setDimension(String(data.embeddingDimension ?? 768));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    setStatus(null);
    setApiKey("");
    setError(null);
    setSuccess(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function applyPreset(p: Provider) {
    setProvider(p);
    setChatModel(PRESETS[p].chatModel);
    setEmbeddingModel(PRESETS[p].embeddingModel);
    setApiBaseUrl(PRESETS[p].apiBaseUrl);
    setDimension(String(PRESETS[p].dimension));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!apiKey.trim()) {
      setError("Enter an API key.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`/api/projects/${projectId}/llm`, {
        provider,
        apiKey: apiKey.trim(),
        chatModel: chatModel.trim(),
        embeddingModel: embeddingModel.trim(),
        apiBaseUrl: provider === "openai-compatible" ? apiBaseUrl.trim() : undefined,
        embeddingDimension: Number(dimension) || undefined,
      });
      setSuccess(
        res.reindexRequired
          ? "Saved. The embedding model changed, so existing content was cleared — re-crawl / re-upload to rebuild the knowledge base."
          : "Saved. This project will now use your API key."
      );
      setApiKey("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">AI provider &amp; API key</h2>
        {status?.configured ? (
          <Badge status="ready" />
        ) : (
          <Badge status="pending" />
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600">
        This project uses <strong>your own</strong> API key for all AI calls.
        The key is encrypted at rest and never sent to the browser or the widget.
      </p>

      {status?.configured && (
        <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Currently: <strong>{status.provider}</strong> · chat{" "}
          <code>{status.chatModel}</code> · embeddings{" "}
          <code>{status.embeddingModel}</code> ({status.embeddingDimension}d) ·
          key <code>{status.apiKeyHint}</code>
        </div>
      )}

      <form onSubmit={save} className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Provider
          </label>
          <Select
            value={provider}
            onChange={(e) => applyPreset(e.target.value as Provider)}
          >
            <option value="google-gemini">Google Gemini (free tier)</option>
            <option value="openai-compatible">
              OpenAI-compatible (OpenAI, Groq, Together, OpenRouter, Ollama…)
            </option>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            API key {status?.configured && "(leave to keep, or paste a new one)"}
          </label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              provider === "google-gemini" ? "AIza..." : "sk-..."
            }
            autoComplete="off"
          />
          {provider === "google-gemini" && (
            <p className="mt-1 text-xs text-gray-500">
              Get a free key at{" "}
              <a
                className="text-indigo-600 underline"
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                aistudio.google.com/apikey
              </a>
              .
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Chat model
            </label>
            <Input
              value={chatModel}
              onChange={(e) => setChatModel(e.target.value)}
              placeholder="your-chat-model"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Embedding model
            </label>
            <Input
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              placeholder="your-embedding-model"
            />
          </div>
        </div>

        {provider === "openai-compatible" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              API base URL
            </label>
            <Input
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
        )}

        <div className="w-40">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Embedding dimension
          </label>
          <Input
            type="number"
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            placeholder="768"
          />
        </div>

        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        {success && <StatusMessage kind="success">{success}</StatusMessage>}

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : status?.configured ? "Update key" : "Save key"}
        </Button>
      </form>
    </Card>
  );
}
