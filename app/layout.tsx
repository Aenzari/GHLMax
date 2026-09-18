import type { Metadata } from 'next';
import Link from 'next/link';
import { TutorContextProvider } from '@/lib/tutor/TutorContextProvider';
import AiTutorDrawer from '@/components/tutor/AiTutorDrawer';
import './globals.css';

export const metadata: Metadata = {
  title: 'GHL FlowLab — Automation Simulator & Diagnostic Academy',
  description: 'Interactive AI-evaluated GoHighLevel workflow diagnostic sandbox.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <TutorContextProvider>
          <nav className="flex h-16 items-center gap-6 border-b border-slate-200 bg-white px-6">
            <Link href="/" className="font-bold text-slate-900">
              GHL FlowLab
            </Link>
            <Link href="/learn" className="text-sm text-slate-600 hover:text-slate-900">
              Curriculum
            </Link>
            <Link href="/sandbox" className="text-sm text-slate-600 hover:text-slate-900">
              Diagnostic Sandbox
            </Link>
            <Link href="/canvas" className="text-sm text-slate-600 hover:text-slate-900">
              Workflow Canvas
            </Link>
          </nav>
          {children}

          {/* Single global drawer. Pages ground it via useSetTutorContext(...)
              rather than mounting their own instance. */}
          <AiTutorDrawer />
        </TutorContextProvider>
      </body>
    </html>
  );
}
