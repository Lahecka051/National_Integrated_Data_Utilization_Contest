import { useEffect, useRef, useState } from 'react'
import type { TripPlan } from '../types'
import { fetchRoute } from '../utils/api'

declare global {
  interface Window {
    kakao: any
  }
}

// Kakao SDK 로드 상태
type SdkState = 'loading' | 'ready' | 'failed'

// SDK 로드 대기 — 최대 10초 폴링
function waitForKakaoSdk(timeoutMs: number = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      if (window.kakao?.maps?.load) {
        resolve(true)
        return
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false)
        return
      }
      setTimeout(check, 100)
    }
    check()
  })
}

interface TripRouteMapProps {
  plan: TripPlan
  originLat: number
  originLng: number
  destinationLat: number
  destinationLng: number
  destinationLabel?: string
}

interface Waypoint {
  lat: number
  lng: number
  label: string
  sublabel: string
  color: string
  icon: string
}

function formatDist(m: number): string {
  if (m < 1000) return `${m}m`
  return `${(m / 1000).toFixed(1)}km`
}

function formatDur(sec: number): string {
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

export default function TripRouteMap({
  plan, originLat, originLng, destinationLat, destinationLng, destinationLabel,
}: TripRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [sdkState, setSdkState] = useState<SdkState>('loading')
  const [localRoute, setLocalRoute] = useState<{ lat: number; lng: number }[]>([])
  const [localSummary, setLocalSummary] = useState<{ distance: number; duration: number } | null>(null)

  // Kakao SDK 로드 대기 (폴링 + kakao.maps.load)
  useEffect(() => {
    let cancelled = false
    waitForKakaoSdk().then(ok => {
      if (cancelled) return
      if (!ok) {
        setSdkState('failed')
        return
      }
      try {
        window.kakao.maps.load(() => {
          if (!cancelled) setSdkState('ready')
        })
      } catch {
        setSdkState('failed')
      }
    })
    return () => { cancelled = true }
  }, [])

  // 로컬 구간 경로 조회 (사용자 위치 → 주차장 → 출발 허브)
  useEffect(() => {
    const coords: { lat: number; lng: number }[] = []
    if (plan.parking) {
      coords.push({ lat: plan.parking.lat, lng: plan.parking.lng })
    }
    coords.push({ lat: plan.origin_hub.lat, lng: plan.origin_hub.lng })

    fetchRoute(coords, originLat, originLng)
      .then(data => {
        const allCoords: { lat: number; lng: number }[] = [{ lat: originLat, lng: originLng }]
        let totalDist = 0
        let totalDur = 0
        for (const seg of data.segments) {
          if (seg.route_coords.length > 0) {
            allCoords.push(...seg.route_coords)
          }
          totalDist += seg.distance
          totalDur += seg.duration
        }
        setLocalRoute(allCoords)
        setLocalSummary({ distance: totalDist, duration: totalDur })
      })
      .catch(() => {
        setLocalRoute([])
        setLocalSummary(null)
      })
  }, [plan.rank, originLat, originLng])

  // 지도 렌더링
  useEffect(() => {
    if (!mapRef.current || sdkState !== 'ready') return
    const { kakao } = window

    // 기존 인스턴스 정리
    if (mapInstanceRef.current) {
      mapInstanceRef.current = null
    }

    const waypoints: Waypoint[] = []
    waypoints.push({
      lat: originLat, lng: originLng,
      label: '출', sublabel: '현재 위치',
      color: '#6b7280', icon: '📍',
    })
    if (plan.parking) {
      waypoints.push({
        lat: plan.parking.lat, lng: plan.parking.lng,
        label: 'P', sublabel: plan.parking.name,
        color: '#f59e0b', icon: '🅿️',
      })
    }
    waypoints.push({
      lat: plan.origin_hub.lat, lng: plan.origin_hub.lng,
      label: '🚉', sublabel: plan.origin_hub.name,
      color: '#6366f1', icon: plan.schedule.mode === 'train' ? '🚄' : '🚌',
    })
    waypoints.push({
      lat: plan.destination_hub.lat, lng: plan.destination_hub.lng,
      label: '🏁', sublabel: plan.destination_hub.name,
      color: '#8b5cf6', icon: '🏁',
    })
    if (
      destinationLabel &&
      (Math.abs(destinationLat - plan.destination_hub.lat) > 0.001 ||
       Math.abs(destinationLng - plan.destination_hub.lng) > 0.001)
    ) {
      waypoints.push({
        lat: destinationLat, lng: destinationLng,
        label: '★', sublabel: destinationLabel,
        color: '#ec4899', icon: '⭐',
      })
    }

    const center = new kakao.maps.LatLng(
      (waypoints[0].lat + waypoints[waypoints.length - 1].lat) / 2,
      (waypoints[0].lng + waypoints[waypoints.length - 1].lng) / 2,
    )
    const map = new kakao.maps.Map(mapRef.current, { center, level: 7 })
    mapInstanceRef.current = map

    const bounds = new kakao.maps.LatLngBounds()

    // 마커 생성
    waypoints.forEach((wp, i) => {
      const pos = new kakao.maps.LatLng(wp.lat, wp.lng)
      bounds.extend(pos)
      new kakao.maps.CustomOverlay({
        position: pos,
        content: `<div style="background:${wp.color};color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${wp.label}</div>`,
        map,
        yAnchor: 0.5,
        xAnchor: 0.5,
      })
      // 라벨 (아래쪽)
      new kakao.maps.CustomOverlay({
        position: pos,
        content: `<div style="background:white;border:1px solid ${wp.color};color:#111;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.15);margin-top:28px;">${i + 1}. ${wp.sublabel.slice(0, 16)}</div>`,
        map,
        yAnchor: 0,
        xAnchor: 0.5,
      })
    })

    // 로컬 구간 실선 (주차장 → 허브)
    if (localRoute.length >= 2) {
      const path = localRoute.map(c => new kakao.maps.LatLng(c.lat, c.lng))
      new kakao.maps.Polyline({
        path,
        strokeWeight: 5,
        strokeColor: '#f59e0b',
        strokeOpacity: 0.85,
        strokeStyle: 'solid',
        map,
      })
    } else if (plan.parking) {
      // 폴백: 사용자→주차장→허브 직선
      const path = [
        new kakao.maps.LatLng(originLat, originLng),
        new kakao.maps.LatLng(plan.parking.lat, plan.parking.lng),
        new kakao.maps.LatLng(plan.origin_hub.lat, plan.origin_hub.lng),
      ]
      new kakao.maps.Polyline({
        path, strokeWeight: 4, strokeColor: '#f59e0b',
        strokeOpacity: 0.6, strokeStyle: 'dashed', map,
      })
    }

    // 기차/버스 구간 (출발 허브 → 도착 허브) — 점선
    const hubPath = [
      new kakao.maps.LatLng(plan.origin_hub.lat, plan.origin_hub.lng),
      new kakao.maps.LatLng(plan.destination_hub.lat, plan.destination_hub.lng),
    ]
    new kakao.maps.Polyline({
      path: hubPath,
      strokeWeight: 5,
      strokeColor: plan.schedule.mode === 'train' ? '#6366f1' : '#8b5cf6',
      strokeOpacity: 0.75,
      strokeStyle: 'shortdash',
      map,
    })

    // 도착 허브 → 최종 목적지 (있는 경우, 점선)
    if (
      destinationLabel &&
      (Math.abs(destinationLat - plan.destination_hub.lat) > 0.001 ||
       Math.abs(destinationLng - plan.destination_hub.lng) > 0.001)
    ) {
      const finalPath = [
        new kakao.maps.LatLng(plan.destination_hub.lat, plan.destination_hub.lng),
        new kakao.maps.LatLng(destinationLat, destinationLng),
      ]
      new kakao.maps.Polyline({
        path: finalPath, strokeWeight: 4, strokeColor: '#ec4899',
        strokeOpacity: 0.6, strokeStyle: 'dashed', map,
      })
    }

    map.setBounds(bounds, 60, 60, 60, 60)
  }, [sdkState, plan.rank, localRoute, originLat, originLng, destinationLat, destinationLng, destinationLabel])

  // 로딩 상태
  if (sdkState === 'loading') {
    return (
      <div className="w-full h-80 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-gray-500">지도 로드 중...</p>
      </div>
    )
  }

  // 실패 상태
  if (sdkState === 'failed') {
    return (
      <div className="w-full h-80 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-3">🗺️</div>
        <p className="text-sm font-bold text-gray-700 mb-2">카카오맵을 불러올 수 없습니다</p>
        <div className="text-xs text-gray-500 space-y-1">
          <p>• 브라우저 콘솔(F12)에서 카카오 SDK 로드 오류 확인</p>
          <p>• Kakao Developers → 플랫폼 → Web에 <code className="bg-white px-1 rounded">http://localhost:5173</code> 등록 확인</p>
          <p>• Kakao Developers → 제품 설정 → 카카오맵 ON 확인</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div ref={mapRef} className="w-full h-80 rounded-xl overflow-hidden bg-gray-100" />

      {/* 범례 + 구간 정보 */}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
        <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
          <span className="w-3 h-0.5 bg-amber-500" />
          주차장 이동
          {localSummary && (
            <span className="text-gray-500">
              {' '}· {formatDist(localSummary.distance)} · {formatDur(localSummary.duration)}
            </span>
          )}
        </span>
        <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg">
          <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: plan.schedule.mode === 'train' ? '#6366f1' : '#8b5cf6' }} />
          {plan.schedule.mode === 'train' ? '열차' : '고속버스'} 구간
        </span>
        {destinationLabel && (
          <span className="inline-flex items-center gap-1 bg-pink-50 border border-pink-200 px-2 py-1 rounded-lg">
            <span className="inline-block w-3 border-t-2 border-dashed border-pink-500" />
            최종 이동
          </span>
        )}
      </div>
    </div>
  )
}
