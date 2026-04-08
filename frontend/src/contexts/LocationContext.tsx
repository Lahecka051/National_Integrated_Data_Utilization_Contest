import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import type { UserLocation } from '../types'
import { reverseGeocode, geocodeAddress } from '../utils/api'

const DEFAULT_LOCATION: UserLocation = {
  lat: 35.1374,
  lng: 129.0997,
  address: '부산광역시 남구 수영로 309 (경성대학교)',
  source: 'default',
}

// 이전 버전의 기본 위치들 — 저장된 값이 이것과 일치하면 새 DEFAULT_LOCATION으로 자동 교체
const LEGACY_DEFAULT_COORDS: Array<{ lat: number; lng: number }> = [
  { lat: 35.5396, lng: 129.3114 }, // 울산광역시 남구 중앙로 201 (v1 기본값)
]

const STORAGE_KEY = 'dayplanner:user_location'

interface LocationContextValue {
  location: UserLocation
  isResolving: boolean
  error: string | null
  setManualLocation: (address: string) => Promise<boolean>
  setManualCoords: (lat: number, lng: number) => Promise<void>
  setLocationDirect: (lat: number, lng: number, address: string) => void
  requestGPS: () => Promise<boolean>
  resetToDefault: () => void
}

const LocationContext = createContext<LocationContextValue | null>(null)

function loadPersisted(): UserLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserLocation
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') {
      return null
    }
    // 이전 기본값(울산 등)이 저장된 경우 마이그레이션 — 새 DEFAULT_LOCATION 사용
    if (parsed.source === 'default') {
      const isLegacyDefault = LEGACY_DEFAULT_COORDS.some(
        (c) => Math.abs(c.lat - parsed.lat) < 1e-4 && Math.abs(c.lng - parsed.lng) < 1e-4,
      )
      if (isLegacyDefault) {
        try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
        return null
      }
    }
    return parsed
  } catch {
    /* noop */
  }
  return null
}

function persist(loc: UserLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc))
  } catch {
    /* noop */
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<UserLocation>(() => loadPersisted() || DEFAULT_LOCATION)
  const [isResolving, setIsResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateAddress = useCallback(async (lat: number, lng: number, source: UserLocation['source']) => {
    try {
      const r = await reverseGeocode(lat, lng)
      const addr = r.found ? (r.road_address || r.address || '') : ''
      const next: UserLocation = { lat, lng, address: addr, source }
      setLocation(next)
      persist(next)
    } catch {
      const next: UserLocation = { lat, lng, source }
      setLocation(next)
      persist(next)
    }
  }, [])

  const requestGPS = useCallback(async (): Promise<boolean> => {
    setIsResolving(true)
    setError(null)

    // 네이티브(Android/iOS): Capacitor Geolocation — OS 레벨 권한 다이얼로그 트리거
    if (Capacitor.isNativePlatform()) {
      try {
        // 현재 권한 상태 확인
        const current = await Geolocation.checkPermissions()
        let granted = current.location === 'granted' || current.coarseLocation === 'granted'

        // 권한이 없으면 요청 → OS 팝업 표시
        if (!granted) {
          const req = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] })
          granted = req.location === 'granted' || req.coarseLocation === 'granted'
        }

        if (!granted) {
          setError('위치 권한이 거부되었습니다. 직접 입력하거나 기본 위치를 사용합니다.')
          setIsResolving(false)
          return false
        }

        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
        await updateAddress(pos.coords.latitude, pos.coords.longitude, 'gps')
        setIsResolving(false)
        return true
      } catch (err: any) {
        setError(
          typeof err?.message === 'string' && err.message.toLowerCase().includes('denied')
            ? '위치 권한이 거부되었습니다. 직접 입력하거나 기본 위치를 사용합니다.'
            : '현재 위치를 가져올 수 없습니다.',
        )
        setIsResolving(false)
        return false
      }
    }

    // 웹 브라우저: 기존 navigator.geolocation 사용
    if (!('geolocation' in navigator)) {
      setError('이 브라우저는 위치 서비스를 지원하지 않습니다.')
      setIsResolving(false)
      return false
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await updateAddress(pos.coords.latitude, pos.coords.longitude, 'gps')
          setIsResolving(false)
          resolve(true)
        },
        (err) => {
          setError(
            err.code === err.PERMISSION_DENIED
              ? '위치 권한이 거부되었습니다. 직접 입력하거나 기본 위치를 사용합니다.'
              : '현재 위치를 가져올 수 없습니다.',
          )
          setIsResolving(false)
          resolve(false)
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      )
    })
  }, [updateAddress])

  const setManualLocation = useCallback(async (address: string): Promise<boolean> => {
    const trimmed = address.trim()
    if (!trimmed) return false
    setIsResolving(true)
    setError(null)
    try {
      const result = await geocodeAddress(trimmed)
      if (!result.found || result.lat == null || result.lng == null) {
        setError('주소를 찾을 수 없습니다. 다른 키워드로 시도해보세요.')
        setIsResolving(false)
        return false
      }
      const next: UserLocation = {
        lat: result.lat,
        lng: result.lng,
        address: result.road_address || result.address || trimmed,
        source: 'manual',
      }
      setLocation(next)
      persist(next)
      setIsResolving(false)
      return true
    } catch {
      setError('주소 검색에 실패했습니다.')
      setIsResolving(false)
      return false
    }
  }, [])

  const setManualCoords = useCallback(async (lat: number, lng: number) => {
    setIsResolving(true)
    await updateAddress(lat, lng, 'manual')
    setIsResolving(false)
  }, [updateAddress])

  // 이미 주소를 알고 있을 때 — 추가 API 호출 없이 바로 적용 (검색 결과 선택 시 사용)
  const setLocationDirect = useCallback((lat: number, lng: number, address: string) => {
    const next: UserLocation = { lat, lng, address, source: 'manual' }
    setLocation(next)
    persist(next)
    setError(null)
  }, [])

  const resetToDefault = useCallback(() => {
    setLocation(DEFAULT_LOCATION)
    persist(DEFAULT_LOCATION)
    setError(null)
  }, [])

  // 최초 마운트 시: 저장된 위치 없으면 GPS 시도
  useEffect(() => {
    const persisted = loadPersisted()
    if (!persisted) {
      requestGPS()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <LocationContext.Provider
      value={{ location, isResolving, error, setManualLocation, setManualCoords, setLocationDirect, requestGPS, resetToDefault }}
    >
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocation must be used within LocationProvider')
  return ctx
}
