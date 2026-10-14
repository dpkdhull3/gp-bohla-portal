interface Props {
  title: string
  body?: string
}

export function EmptyState({ title, body }: Props) {
  return (
    <div className="empty-state" role="status">
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  )
}
