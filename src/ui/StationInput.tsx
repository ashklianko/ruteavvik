import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Station } from '../data/stations.ts'
import { rank } from './stationSearch.ts'

interface Props {
  stations: Station[]
  value: string | null
  exclude: string | null
  placeholder: string
  label: string
  onChange: (name: string | null) => void
}

export function StationInput({ stations, value, exclude, placeholder, label, onChange }: Props) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const text = draft ?? value ?? ''
  const setText = (t: string | null) => setDraft(t === null || t === (value ?? '') ? null : t)

  const options = useMemo(() => (open ? rank(stations, text, exclude) : []), [open, stations, text, exclude])
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const commit = (name: string | null) => {
    setOpen(false)
    if (name && name !== value) onChange(name)
    setDraft(null)
    inputRef.current?.blur()
  }

  const width = `${Math.max(10, (text || placeholder).length + 1)}ch`

  return (
    <span className="relative inline-block">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        className="station"
        style={{ width }}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => {
          setOpen(true)
          setActive(0)
          e.target.select()
        }}
        onBlur={() => {
          setOpen(false)
          setDraft(null)
        }}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, Math.max(0, options.length - 1)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            const pick = options[active] ?? (options.length === 1 ? options[0] : undefined)
            if (pick) commit(pick.name)
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            setOpen(false)
            setDraft(null)
          }
        }}
      />
      {open && options.length > 0 && (
        <ul id={`${id}-list`} ref={listRef} role="listbox" className="suggestions">
          {options.map((s, i) => (
            <li
              key={s.name}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(s.name)
              }}
              onMouseMove={() => {
                if (active !== i) setActive(i)
              }}
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}
      {open && text.trim() && options.length === 0 && (
        <ul className="suggestions" aria-hidden="true">
          <li className="none">No station matches</li>
        </ul>
      )}
    </span>
  )
}
