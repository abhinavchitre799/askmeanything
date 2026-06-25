"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  Button,
  Card,
  Input,
  StatusMessage,
} from "@/components/admin/ui";
import { useSelectedProject } from "@/components/admin/ProjectContext";

type Project = {
  id: string;
  name: string;
  domain: string | null;
  createdAt: string;
  _count?: { sources: number; documents: number };
};

export default function ProjectsPage() {
  const { projectId, setProjectId } = useSelectedProject();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = (await api.get("/api/projects")) as Project[];
      setProjects(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setCreating(true);
    try {
      const created = (await api.post("/api/projects", {
        name: name.trim(),
        domain: domain.trim() || undefined,
      })) as Project;
      setName("");
      setDomain("");
      setFormSuccess(`Created project "${created.name}".`);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a project, then select one as the active project for the{" "}
          <Link href="/admin/sources" className="text-indigo-600 underline">
            Sources
          </Link>{" "}
          and{" "}
          <Link
            href="/admin/conversations"
            className="text-indigo-600 underline"
          >
            Conversations
          </Link>{" "}
          pages.
        </p>
      </div>

      {/* Create form */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Create a project
        </h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Company Docs"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Domain <span className="text-gray-400">(optional)</span>
              </label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
              />
            </div>
          </div>
          {formError && <StatusMessage kind="error">{formError}</StatusMessage>}
          {formSuccess && (
            <StatusMessage kind="success">{formSuccess}</StatusMessage>
          )}
          <Button type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create project"}
          </Button>
        </form>
      </Card>

      {/* Selected hint */}
      {projectId && (
        <StatusMessage kind="info">
          Active project id: <code className="font-mono">{projectId}</code>. The
          Sources and Conversations pages use this selection.
        </StatusMessage>
      )}

      {/* List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Existing projects
          </h2>
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {loadError && <StatusMessage kind="error">{loadError}</StatusMessage>}
        {loading && projects.length === 0 && (
          <p className="text-sm text-gray-500">Loading projects…</p>
        )}
        {!loading && !loadError && projects.length === 0 && (
          <p className="text-sm text-gray-500">
            No projects yet. Create one above.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const selected = p.id === projectId;
            return (
              <Card
                key={p.id}
                className={
                  selected ? "ring-2 ring-indigo-500" : "hover:border-gray-300"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900">
                      {p.name}
                    </h3>
                    <p className="truncate text-sm text-gray-500">
                      {p.domain || "no domain"}
                    </p>
                  </div>
                  {selected && (
                    <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      Selected
                    </span>
                  )}
                </div>

                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                  <div>
                    <span className="font-medium text-gray-900">
                      {p._count?.sources ?? 0}
                    </span>{" "}
                    sources
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">
                      {p._count?.documents ?? 0}
                    </span>{" "}
                    documents
                  </div>
                  <div>
                    {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </dl>

                <p className="mt-3 truncate font-mono text-xs text-gray-400">
                  {p.id}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant={selected ? "secondary" : "primary"}
                    onClick={() => setProjectId(p.id)}
                    disabled={selected}
                  >
                    {selected ? "Active" : "Select"}
                  </Button>
                  <Link href="/admin/sources">
                    <Button variant="ghost">Sources</Button>
                  </Link>
                  <Link href="/admin/conversations">
                    <Button variant="ghost">Conversations</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
