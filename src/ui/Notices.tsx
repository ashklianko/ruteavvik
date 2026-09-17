import type { Notice } from '../data/model.ts'

const ICON: Record<Notice['kind'], string> = { cancelled: '✕', incident: '!', short: '½', info: 'i' }

export function NoticeTags({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return null
  return (
    <span className="notices">
      {notices.map((n) => (
        <span key={n.id} className={`notice notice-${n.kind}`} title={`${n.summary}${n.description ? `. ${n.description}` : ''}${n.advice ? ` ${n.advice}` : ''}`}>
          <span className="notice-icon" aria-hidden="true">
            {ICON[n.kind]}
          </span>
          {n.kind === 'short' ? 'short train' : n.summary}
        </span>
      ))}
    </span>
  )
}

export function NoticeList({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return null
  return (
    <ul className="notice-list">
      {notices.map((n) => (
        <li key={n.id} className={`notice-item notice-${n.kind}`}>
          <span className="notice-icon" aria-hidden="true">
            {ICON[n.kind]}
          </span>
          <span>
            <strong>{n.summary}</strong>
            {n.description && n.description !== n.summary && <> {n.description}</>}
            {n.advice && <> {n.advice}</>}
            <span className="notice-src"> Operator notice.</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
