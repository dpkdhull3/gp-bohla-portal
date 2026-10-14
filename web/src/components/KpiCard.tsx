import { Link } from 'react-router-dom'

interface Props {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'muted' | 'accent' | 'unavailable'
  to?: string
  unavailable?: boolean
}

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  to,
  unavailable = false,
}: Props) {
  const className = `kpi-card kpi-${unavailable ? 'unavailable' : tone}${to ? ' kpi-clickable' : ''}`
  const body = (
    <>
      <p className="kpi-label">{label}</p>
      <p
        className="kpi-value"
        aria-label={unavailable ? `${label}: unavailable` : `${label}: ${value}`}
      >
        {unavailable ? '—' : value}
      </p>
      {hint ? <p className="kpi-hint">{hint}</p> : null}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    )
  }

  return <article className={className}>{body}</article>
}
