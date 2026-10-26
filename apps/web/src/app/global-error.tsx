"use client";
import "./globals.css";

/** Replaces the root layout when it fails, so it renders its own document and cannot use providers or shared components. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-dvh items-center justify-center px-6 py-16">
          <div className="w-full max-w-md text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger" aria-hidden>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            </span>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">DataHub hit a critical error</h1>
            <p className="mt-3 text-sm leading-6 text-muted">The application could not load. Your data is safe. Reload to try again.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button onClick={reset} className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-6 text-base font-medium text-white shadow-card hover:bg-brand-hover">Reload</button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full reload is intended when the root layout failed */}
              <a href="/" className="inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-6 text-base font-medium hover:bg-surface2">Go to home</a>
            </div>
            {error.digest && <p className="mt-8 text-xs text-muted">Reference: <span className="font-mono">{error.digest}</span></p>}
          </div>
        </main>
      </body>
    </html>
  );
}
