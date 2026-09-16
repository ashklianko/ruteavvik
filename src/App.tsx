import { Debug } from './debug/Debug.tsx'
import { Spine } from './diagram/Spine.tsx'

export function App() {
  if (window.location.hash === '#debug') return <Debug />
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-lg font-medium tracking-tight">Ruteavvik</h1>
        <p className="text-sm text-ink-muted">measured, never forecast</p>
      </header>
      <p className="text-base text-ink-muted">Pick where you are and where you are going.</p>
      <div className="grid flex-1 gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0">
          <Spine />
        </div>
        <aside className="min-w-0 text-sm text-ink-faint">No trains to list yet.</aside>
      </div>
    </main>
  )
}
