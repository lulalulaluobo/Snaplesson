import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type PwaInstallStatus =
  | 'android-ready'     // beforeinstallprompt captured → can prompt
  | 'ios-guide'         // iOS Safari → show manual guide
  | 'mobile-fallback'   // Other mobile (e.g. Android) but no prompt event yet → show manual guide
  | 'installed'         // already running as standalone
  | 'unsupported'       // desktop or other unsupported environment

// Global variable to capture the event if it fires before React mounts
let capturedPrompt: BeforeInstallPromptEvent | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    capturedPrompt = e as BeforeInstallPromptEvent
    window.dispatchEvent(new CustomEvent('pwa-prompt-available'))
  })
}

function getInitialStatus(): PwaInstallStatus {
  if (typeof window === 'undefined') return 'unsupported'

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true

  if (isStandalone) return 'installed'

  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua)
  if (isIOS) return 'ios-guide'

  if (capturedPrompt) return 'android-ready'

  const isMobile = /android|webos|blackberry|iemobile|opera mini/i.test(ua)
  if (isMobile) return 'mobile-fallback'

  return 'unsupported'
}

export function usePwaInstall() {
  const [status, setStatus] = useState<PwaInstallStatus>(getInitialStatus)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(capturedPrompt)

  useEffect(() => {
    const checkStatus = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true

      if (isStandalone) {
        setStatus('installed')
        return
      }

      const ua = navigator.userAgent
      const isIOS = /iphone|ipad|ipod/i.test(ua)
      if (isIOS) {
        setStatus('ios-guide')
        return
      }

      if (capturedPrompt) {
        setStatus('android-ready')
        setDeferredPrompt(capturedPrompt)
        return
      }

      const isMobile = /android|webos|blackberry|iemobile|opera mini/i.test(ua)
      if (isMobile) {
        setStatus('mobile-fallback')
        return
      }

      setStatus('unsupported')
    }

    checkStatus()

    const handlePrompt = (e: Event) => {
      e.preventDefault()
      capturedPrompt = e as BeforeInstallPromptEvent
      setDeferredPrompt(capturedPrompt)
      setStatus('android-ready')
    }

    const handleCustomEvent = () => {
      if (capturedPrompt) {
        setDeferredPrompt(capturedPrompt)
        setStatus('android-ready')
      }
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('pwa-prompt-available', handleCustomEvent)
    window.addEventListener('appinstalled', () => {
      setStatus('installed')
      setDeferredPrompt(null)
      capturedPrompt = null
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('pwa-prompt-available', handleCustomEvent)
    }
  }, [])

  const triggerInstall = async () => {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setStatus('installed')
      }
    } catch (err) {
      console.warn('PWA prompt failed:', err)
    }
    setDeferredPrompt(null)
  }

  return { status, triggerInstall }
}
