import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">AskMeAnything</h1>
      <p className="mt-3 text-gray-600">
        Embeddable AI website Q&amp;A widget. Build a knowledge base from your
        website and uploaded documents, then let visitors ask questions.
      </p>
      <div className="mt-8">
        <Link
          href="/admin"
          className="inline-block rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700"
        >
          Open admin
        </Link>
      </div>
    </main>
  );
}
