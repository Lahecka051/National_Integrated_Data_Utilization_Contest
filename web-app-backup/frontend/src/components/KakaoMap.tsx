import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import type { FacilityVisit } from '../types'
import { fetchRoute, type RouteSegment } from '../utils/api'

declare global {
  interface Window {
    kakao: any
  }
}

const TYPE_MARKER_COLORS: Record<string, string> = {
  '민원실': '#3b82f6',
  '은행': '#f59e0b',
  '우체국': '#22c55e',
}

const SEGMENT_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6']

const START_LAT = 35.5396
const START_LNG = 129.3114

export interface KakaoMapHandle {
  focusOn: (lat: number, lng: number, level?: number) => void
}

interface KakaoMapProps {
  visits: FacilityVisit[]
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  if (sec === 0) return `${min}분`
  return `${min}분 ${sec}초`
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(({ visits }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [segments, setSegments] = useState<RouteSegment[]>([])

  useEffect(() => {
    if (!window.kakao?.maps) return
    window.kakao.maps.load(() => setMapReady(true))
  }, [])

  useEffect(() => {
    if (visits.length === 0) return
    const coords = visits.map(v => ({ lat: v.facility.lat, lng: v.facility.lng }))
    fetchRoute(coords)
      .then(data => setSegments(data.segments))
      .catch(() => setSegments([]))
  }, [visits])

  useImperativeHandle(ref, () => ({
    focusOn: (lat: number, lng: number, level: number = 3) => {
      const map = mapInstanceRef.current
      if (!map || !window.kakao?.maps) return
      const { kakao } = window
      map.setCenter(new kakao.maps.LatLng(lat, lng))
      map.setLevel(level)
    },
  }))

  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const { kakao } = window
    const center = visits.length > 0
      ? new kakao.maps.LatLng(visits[0].facility.lat, visits[0].facility.lng)
      : new kakao.maps.LatLng(START_LAT, START_LNG)

    const map = new kakao.maps.Map(mapRef.current, { center, level: 5 })
    mapInstanceRef.current = map

    const bounds = new kakao.maps.LatLngBounds()
    const startPos = new kakao.maps.LatLng(START_LAT, START_LNG)
    bounds.extend(startPos)

    new kakao.maps.CustomOverlay({
      position: startPos,
      content: '<div style="background:#6b7280;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">출</div>',
      map,
    })

    visits.forEach((visit, i) => {
      const pos = new kakao.maps.LatLng(visit.facility.lat, visit.facility.lng)
      bounds.extend(pos)
      new kakao.maps.CustomOverlay({
        position: pos,
        content: `<div style="background:${TYPE_MARKER_COLORS[visit.facility.type] || '#3b82f6'};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${i + 1}</div>`,
        map,
      })
    })

    if (segments.length > 0) {
      segments.forEach((seg, i) => {
        if (seg.route_coords.length >= 2) {
          const path = seg.route_coords.map(c => new kakao.maps.LatLng(c.lat, c.lng))
          new kakao.maps.Polyline({
            path, strokeWeight: 5,
            strokeColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
            strokeOpacity: 0.8, strokeStyle: 'solid', map,
          })
        }
      })
    } else if (visits.length > 0) {
      const path = [startPos, ...visits.map(v => new kakao.maps.LatLng(v.facility.lat, v.facility.lng))]
      new kakao.maps.Polyline({
        path, strokeWeight: 4, strokeColor: '#3b82f6',
        strokeOpacity: 0.5, strokeStyle: 'dashed', map,
      })
    }

    if (visits.length > 0) map.setBounds(bounds, 50, 50, 50, 50)
  }, [visits, mapReady, segments])

  if (!window.kakao?.maps) {
    return (
      <div className="w-full h-80 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center">
        <div className="text-5xl mb-3">🗺️</div>
        <p className="text-xs text-gray-400 mt-3">카카오맵 API 키 설정 후 실제 지도가 표시됩니다</p>
      </div>
    )
  }

  return (
    <div>
      <div ref={mapRef} className="w-full h-80 rounded-xl overflow-hidden bg-gray-100" />
      {segments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {segments.map((seg, i) => {
            const dest = i < visits.length ? visits[i].facility.name : `구간${i + 1}`
            return (
              <span key={i} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                → {dest}: {formatDistance(seg.distance)} · {formatDuration(seg.duration)}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
})

KakaoMap.displayName = 'KakaoMap'
export default KakaoMap
