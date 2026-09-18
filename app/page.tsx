import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold text-slate-900">GHL FlowLab</h1>
      <p className="mt-3 text-slate-500">
        Interactive automation simulator and diagnostic academy for GoHighLevel systems.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Link
          href="/sandbox"
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Enter Diagnostic Sandbox
        </Link>
        <Link
          href="/canvas"
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Open Workflow Canvas
        </Link>
      </div>
    </main>
  );
}
