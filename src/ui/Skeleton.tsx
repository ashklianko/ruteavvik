export function Bar({ w, h = '0.9rem', className = '' }: { w: string; h?: string; className?: string }) {
  return <span className={`skel ${className}`} style={{ width: w, height: h }} aria-hidden="true" />
}

export function HeadlineSkeleton() {
  return (
    <div className="hero" aria-busy="true" aria-label="Loading the next departure">
      <div className="hero-line">
        <Bar w="6rem" h="1.4rem" className="rounded-full" />
        <Bar w="4.2rem" h="1.5rem" />
        <Bar w="18rem" />
      </div>
      <Bar w="12rem" h="0.8rem" />
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading trains">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 py-1">
          <div className="flex items-center gap-3">
            <Bar w="3rem" />
            <Bar w="2.2rem" />
            <Bar w="2.6rem" />
            <Bar w={`${9 + ((i * 3) % 6)}rem`} />
          </div>
          <Bar w={`${14 + ((i * 5) % 9)}rem`} h="0.75rem" />
        </div>
      ))}
    </div>
  )
}

export function DiagramSkeleton({ wide }: { wide: boolean }) {
  const W = wide ? 1000 : 640
  const H = wide ? 430 : 560
  const dots = wide ? [120, 260, 380, 520, 640, 760, 880] : [140, 220, 300, 380, 460]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spine block h-auto w-full max-w-full skel-svg" aria-busy="true" aria-label="Loading the line diagram">
      {wide ? (
        <>
          <line x1={90} y1={330} x2={W - 30} y2={330} stroke="var(--color-spine)" strokeWidth={3} strokeLinecap="round" />
          <line x1={W / 2} y1={60} x2={W / 2} y2={336} stroke="var(--color-spine-dim)" strokeWidth={1} />
          {dots.map((x, i) => (
            <g key={x}>
              <line x1={x} y1={324} x2={x} y2={336} stroke="var(--color-spine)" strokeWidth={1} />
              <rect x={x - 22} y={346} width={44} height={9} rx={4} className="skel-shape" style={{ animationDelay: `${i * 90}ms` }} />
              {i % 2 === 0 && <circle cx={x + 30} cy={330 - (i % 3) * 40 - 20} r={6} className="skel-shape" style={{ animationDelay: `${i * 120}ms` }} />}
            </g>
          ))}
        </>
      ) : (
        <>
          <line x1={150} y1={30} x2={150} y2={H - 30} stroke="var(--color-spine)" strokeWidth={3} strokeLinecap="round" />
          <line x1={120} y1={H / 2} x2={W} y2={H / 2} stroke="var(--color-spine-dim)" strokeWidth={1} />
          {dots.map((y, i) => (
            <g key={y}>
              <line x1={144} y1={y} x2={156} y2={y} stroke="var(--color-spine)" strokeWidth={1} />
              <rect x={60} y={y - 5} width={76} height={9} rx={4} className="skel-shape" style={{ animationDelay: `${i * 90}ms` }} />
              {i % 2 === 0 && <circle cx={150 + (i % 3) * 40 + 20} cy={y} r={6} className="skel-shape" style={{ animationDelay: `${i * 120}ms` }} />}
            </g>
          ))}
        </>
      )}
    </svg>
  )
}

export function MapSkeleton() {
  return (
    <div className="route-map">
      <div className="route-map-canvas skel-block" aria-busy="true" aria-label="Loading the map" />
    </div>
  )
}
