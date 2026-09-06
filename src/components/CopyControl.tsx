import { useState } from 'react'

type Props = { value: string; label: string; copiedLabel: string; className?: string }

export function CopyControl({ value, label, copiedLabel, className = '' }: Props) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard?.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_800)
  }
  return <button className={`text-action ${className}`.trim()} type="button" onClick={() => void copy()}>{copied ? copiedLabel : label}</button>
}
