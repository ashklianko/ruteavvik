export interface Scene {
  id: string
  label: string
  snapshot: string | null
  at: string | null
}

export const SCENES: Scene[] = [
  { id: 'live', label: 'Live now', snapshot: null, at: null },
  { id: 'sandvika-morning', label: 'Morning peak, Sandvika 07:47', snapshot: 'sandvika-morning', at: '07:47' },
  { id: 'lillestrom-morning', label: 'Morning peak, Lillestrøm 07:57', snapshot: 'lillestrom-morning', at: '07:57' },
  { id: 'sandvika-evening', label: 'Evening peak, Sandvika 16:52', snapshot: 'sandvika-evening', at: '16:52' },
  { id: 'lillestrom-evening', label: 'Evening peak, Lillestrøm 16:57', snapshot: 'lillestrom-evening', at: '16:57' },
  { id: 'demo-calm', label: 'Synthetic: a calm morning', snapshot: 'demo-calm', at: null },
  { id: 'demo-rough', label: 'Synthetic: signal failure at Lysaker', snapshot: 'demo-rough', at: null },
]

export function sceneUrl(scene: Scene, location: Location): string {
  const params = new URLSearchParams(location.search)
  params.delete('snapshot')
  params.delete('at')
  if (scene.snapshot) params.set('snapshot', scene.snapshot)
  if (scene.at) params.set('at', scene.at)
  const query = params.toString()
  return `${location.pathname}${query ? `?${query}` : ''}${location.hash}`
}

export function currentScene(snapshot: string | null): Scene {
  return SCENES.find((s) => s.snapshot === snapshot) ?? (snapshot ? { id: snapshot, label: `Snapshot ${snapshot}`, snapshot, at: null } : SCENES[0])
}
