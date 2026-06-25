import Link from "next/link";
import { ProjectProvider } from "@/components/admin/ProjectContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProjectProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/admin" className="text-lg font-bold text-gray-900">
              AskMeAnything <span className="text-indigo-600">Admin</span>
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm font-medium">
              <Link
                href="/admin"
                className="text-gray-600 hover:text-indigo-600"
              >
                Projects
              </Link>
              <Link
                href="/admin/sources"
                className="text-gray-600 hover:text-indigo-600"
              >
                Sources
              </Link>
              <Link
                href="/admin/conversations"
                className="text-gray-600 hover:text-indigo-600"
              >
                Conversations
              </Link>
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4">
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            MVP — no authentication (TODO: add auth before production)
          </div>
        </div>

        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </div>
    </ProjectProvider>
  );
}
