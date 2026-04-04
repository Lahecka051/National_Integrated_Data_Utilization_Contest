import { useState, useCallback, useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

export function useNotification() {
  const [permissionGranted, setPermissionGranted] = useState(false)

  useEffect(() => {
    checkPermission()
  }, [])

  const checkPermission = async () => {
    if (!Device.isDevice) return
    const { status } = await Notifications.getPermissionsAsync()
    setPermissionGranted(status === 'granted')
  }

  const requestPermission = useCallback(async () => {
    if (!Device.isDevice) return false
    const { status: existing } = await Notifications.getPermissionsAsync()
    if (existing === 'granted') {
      setPermissionGranted(true)
      return true
    }
    const { status } = await Notifications.requestPermissionsAsync()
    setPermissionGranted(status === 'granted')
    return status === 'granted'
  }, [])

  const scheduleNotification = useCallback(async (
    title: string,
    body: string,
    delaySeconds: number,
  ): Promise<string | null> => {
    const granted = await requestPermission()
    if (!granted) return null

    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: delaySeconds > 0 ? { seconds: delaySeconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL } : null,
    })
    return id
  }, [requestPermission])

  const cancelNotification = useCallback(async (id: string) => {
    await Notifications.cancelScheduledNotificationAsync(id)
  }, [])

  const sendImmediate = useCallback(async (title: string, body: string) => {
    return scheduleNotification(title, body, 0)
  }, [scheduleNotification])

  return {
    permissionGranted,
    requestPermission,
    scheduleNotification,
    cancelNotification,
    sendImmediate,
  }
}
