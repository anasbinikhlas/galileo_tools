import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { logout } from '../auth'

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000 // 1 Hour (3,600,000 ms)

export function useInactivityLogout() {
  const navigate = useNavigate()
  const timerRef = useRef(null)

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        logout()
        toast.error('Logged out due to 1 hour of inactivity.', { id: 'auto-logout-toast' })
        navigate('/login', { replace: true })
      }, INACTIVITY_TIMEOUT_MS)
    }

    // Set initial timer
    resetTimer()

    // Global activity listeners
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach(event => window.addEventListener(event, resetTimer))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(event => window.removeEventListener(event, resetTimer))
    }
  }, [navigate])
}
