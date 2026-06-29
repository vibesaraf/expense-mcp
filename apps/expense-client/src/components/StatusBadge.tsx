export function StatusBadge({ status }: { status: string }) {
  const known = ['pending', 'approved', 'rejected', 'paid'].includes(status)
  return (
    <span className={known ? `badge badge-${status}` : 'badge badge-default'}>
      {status}
    </span>
  )
}
