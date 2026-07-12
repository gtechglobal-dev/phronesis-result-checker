import { useState, useEffect } from 'react'
import { useNetwork } from '../context/NetworkContext'

export default function NetworkBanner() {
  const { isOnline } = useNetwork()
  const [showRestored, setShowRestored] = useState(false)
  const [wasOffline, setWasOffline] = useState(!navigator.onLine)

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
      setShowRestored(false)
    } else if (wasOffline) {
      setShowRestored(true)
      const t = setTimeout(() => {
        setShowRestored(false)
        setWasOffline(false)
      }, 4000)
      return () => clearTimeout(t)
    }
  }, [isOnline, wasOffline])

  if (!isOnline) {
    return (
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-auto"
        style={{ top: '66vh', animation: 'fadeInUp 0.3s ease-out', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B' }}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
        </svg>
        <span>No network connection. Please check your internet.</span>
      </div>
    )
  }

  if (showRestored) {
    return (
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-auto"
        style={{ top: '66vh', animation: 'fadeInUp 0.3s ease-out', backgroundColor: '#D1FAE5', border: '1px solid #6EE7B7', color: '#065F46' }}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Network connection restored</span>
      </div>
    )
  }

  return null
}
