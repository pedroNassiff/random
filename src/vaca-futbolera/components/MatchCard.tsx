import type { ReactNode } from 'react'

interface Props {
  day: string
  time: string
  title: string
  status: ReactNode
}

/** Fecha a la izquierda, hora a la derecha, línea punteada, título y estado (DESIGN §5). */
export function MatchCard({ day, time, title, status }: Props) {
  return (
    <article className="vf-card vf-match">
      <div className="vf-match__meta vf-dotted">
        <span>{day}</span>
        <span>{time}</span>
      </div>
      <h2 className="vf-match__title">{title}</h2>
      <div>{status}</div>
    </article>
  )
}
