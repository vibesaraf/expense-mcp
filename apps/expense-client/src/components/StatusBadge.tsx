const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  pending:  { background: '#fef3c7', color: '#92400e' },
  approved: { background: '#d1fae5', color: '#065f46' },
  rejected: { background: '#fee2e2', color: '#991b1b' },
  paid:     { background: '#dbeafe', color: '#1e40af' },
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { background: '#f3f4f6', color: '#374151' }
  return (
    <span
      style={{
        background: s.background,
        color: s.color,
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 500,
      }}
    >
      {status}
    </span>
  )
}
