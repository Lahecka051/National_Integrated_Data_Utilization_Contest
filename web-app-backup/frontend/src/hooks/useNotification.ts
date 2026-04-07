import { useState, useEffect, useCallback, useRef } from 'react'

export interface NotificationSettings {
  soundEnabled: boolean
  popupEnabled: boolean
}

const STORAGE_KEY = 'dayplanner_notification_settings'
const DEFAULT_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  popupEnabled: true,
}

function loadSettings(): NotificationSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(settings: NotificationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

// 알림 소리 생성 (Web Audio API - 외부 파일 불필요)
function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    // 알림음: 두 번 짧게 울림
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)      // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.15)

    // 두 번째 음
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)

    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.2)   // C#6
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.2)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)

    osc2.start(ctx.currentTime + 0.2)
    osc2.stop(ctx.currentTime + 0.4)
  } catch {}
}

export function useNotification() {
  const [settings, setSettings] = useState<NotificationSettings>(loadSettings)
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default')
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') {
      setPermissionState('granted')
      return true
    }
    const result = await Notification.requestPermission()
    setPermissionState(result)
    return result === 'granted'
  }, [])

  const updateSettings = useCallback((update: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...update }
      saveSettings(next)
      return next
    })
  }, [])

  const sendNotification = useCallback(async (title: string, body: string) => {
    // 소리 알림
    if (settings.soundEnabled) {
      playNotificationSound()
    }

    // 팝업 알림
    if (settings.popupEnabled && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await requestPermission()
      }
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/vite.svg',
          tag: 'dayplanner',
        })
      }
    }
  }, [settings, requestPermission])

  // 예약 알림: N분 후 알림
  const scheduleNotification = useCallback((title: string, body: string, delayMinutes: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      sendNotification(title, body)
    }, delayMinutes * 60 * 1000)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [sendNotification])

  return {
    settings,
    updateSettings,
    permissionState,
    requestPermission,
    sendNotification,
    scheduleNotification,
  }
}
