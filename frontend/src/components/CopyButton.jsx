import { useState } from 'react'
import toast from 'react-hot-toast'

export default function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`btn-primary ${className}`}
      disabled={!text}
    >
      <i
        className={`ti ${copied ? 'ti-check' : 'ti-copy'}`}
        style={{ fontSize: 14 }}
        aria-hidden="true"
      />
      {copied ? 'Copied!' : label}
    </button>
  )
}
