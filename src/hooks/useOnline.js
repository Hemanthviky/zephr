import { useEffect, useState } from 'react'

/**
 * Whether the browser thinks it has a connection.
 *
 * `navigator.onLine` is optimistic by design: it reports true whenever there's
 * *a* network interface, so a captive-portal wifi or a dead router still reads
 * as online. That makes it useless for proving connectivity, but reliable in
 * the direction that matters here — when it flips to false, you really are
 * offline. So this only ever drives a screen the user can dismiss, never a
 * decision about whether to attempt a write.
 */
export function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
