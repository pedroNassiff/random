import type { KeyboardEvent, MouseEvent } from 'react'

interface Props {
  label: string
  description?: string
  value: number | null
  onChange: (value: number) => void
}

const CELLS = Array.from({ length: 10 }, (_, i) => i + 1)
const clamp = (n: number) => Math.min(10, Math.max(1, n))

/** Un solo control con role="slider": flechas ±1, Home/End extremos (DESIGN §5 y §7). */
export function SkillPicker({ label, description, value, onChange }: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
    if (e.key === 'Home') onChange(1)
    else if (e.key === 'End') onChange(10)
    else if (step !== undefined) onChange(value === null ? 5 : clamp(value + step))
    else return
    e.preventDefault()
  }

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const cell = Number((e.target as HTMLElement).dataset.cell)
    if (cell >= 1 && cell <= 10) onChange(cell)
  }

  return (
    <div>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value === null ? 'Sin puntuar' : `${value} de 10`}
        className="vf-picker"
        onKeyDown={onKeyDown}
        onClick={onClick}
      >
        {CELLS.map((n) => {
          const on = value !== null && n <= value
          const cls = [
            'vf-picker__cell',
            on ? 'vf-picker__cell--on' : '',
            n === value ? 'vf-picker__cell--selected' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return <span key={n} className={cls} data-cell={n} />
        })}
      </div>
      {description && <p className="vf-muted">{description}</p>}
    </div>
  )
}
