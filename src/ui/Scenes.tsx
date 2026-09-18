import { currentScene, SCENES, sceneUrl } from '../scenes.ts'

export function Scenes({ snapshot }: { snapshot: string | null }) {
  const current = currentScene(snapshot)
  const options = SCENES.some((s) => s.id === current.id) ? SCENES : [...SCENES, current]
  return (
    <label className="scenes" title="Replay a recorded peak or a synthetic scene">
      <span className="scenes-dot" aria-hidden="true" />
      <select
        className="scenes-select"
        aria-label="Scene"
        value={current.id}
        onChange={(e) => {
          const next = options.find((s) => s.id === e.target.value)
          if (next) window.location.assign(sceneUrl(next, window.location))
        }}
      >
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}
