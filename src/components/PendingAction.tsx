type Props = {
  label: string
  href: string | null
  className?: string
  pendingLabel: string
}

export function PendingAction({ label, href, className = '', pendingLabel }: Props) {
  if (href) return <a className={`button ${className}`.trim()} href={href}>{label}</a>

  return <button className={`button ${className}`.trim()} disabled type="button" aria-label={pendingLabel}>{label}<span>{pendingLabel}</span></button>
}
