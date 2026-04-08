import { useState, useEffect } from 'react'
import type { FacilityVisit, HalfDayType, BusInfo } from '../types'

const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  '민원실': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  '은행':   { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  '우체국': { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
}

interface TimelineProps {
  visits: FacilityVisit[]
  halfDayType: HalfDayType
  onVisitClick?: (index: number) => void
  /** 출발지 이름. 미지정 시 '현재 위치'로 표시. */
  originLabel?: string
}

export default function Timeline({ visits, halfDayType, onVisitClick, originLabel }: TimelineProps) {
  const startTime = halfDayType === '오후반차' ? '14:00' : '09:00'
  const originText = originLabel?.trim() || '현재 위치'

  return (
    <div className="relative">
      <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onVisitClick?.(-1)}>
        <TimelineItem
          time={startTime}
          title="출발"
          subtitle={originText}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
            </svg>
          }
          color={{ bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400' }}
        />
      </div>

      {visits.map((visit, i) => {
        const colors = TYPE_COLORS[visit.facility.type] || TYPE_COLORS['민원실']
        const taskList = visit.task_names?.length > 0 ? visit.task_names : [visit.facility.type + ' 업무']
        return (
          <div key={i}>
            {/* 이동 구간 */}
            <TravelSegment visit={visit} />

            {/* 시설 방문 */}
            <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onVisitClick?.(i)}>
              <TimelineItem
                time={visit.arrival_time}
                title={visit.facility.name}
                subtitle={`대기 ${visit.wait_time}분 + 처리 ${visit.process_time}분`}
                detail={`${visit.arrival_time} 도착 → ${visit.departure_time} 완료`}
                tasks={taskList}
                icon={
                  <span className="text-xs">
                    {visit.facility.type === '민원실' ? '🏛️' : visit.facility.type === '은행' ? '🏦' : '📮'}
                  </span>
                }
                color={colors}
                waitTime={visit.wait_time}
              />
            </div>
          </div>
        )
      })}

      {visits.length > 0 && (
        <div className="ml-[18px] border-l-2 border-dashed border-gray-200 pl-8 py-2">
          <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            모든 용무 완료!
          </div>
        </div>
      )}
    </div>
  )
}

/** 이동 구간 표시 (도보/버스) */
function TravelSegment({ visit }: { visit: FacilityVisit }) {
  const [showAlternatives, setShowAlternatives] = useState(false)

  if (visit.travel_mode === 'bus' && visit.bus_info) {
    const info = visit.bus_info
    return (
      <div className="ml-[18px] border-l-2 border-dashed border-gray-200 pl-8 py-2 space-y-1.5">
        {/* 도보로 정류장까지 */}
        {info.walk_to_stop_minutes > 0 && (
          <p className="text-xs text-gray-400">🚶 도보 {info.walk_to_stop_minutes}분 → {info.stop_name}</p>
        )}
        {/* 버스 승차 */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-700 font-medium">🚌 {info.bus_no}번 승차</p>
              <p className="text-blue-500">{info.stop_name} → 승차 {info.ride_minutes}분</p>
            </div>
            <BusCountdown intervalSec={info.alternatives[0]?.interval_min ? info.alternatives[0].interval_min * 60 : 600} />
          </div>
          {/* 다른 버스 보기 */}
          {info.alternatives.length > 1 && (
            <div className="mt-2 pt-2 border-t border-blue-100">
              <button
                onClick={() => setShowAlternatives(!showAlternatives)}
                className="text-blue-600 text-xs font-medium hover:underline"
              >
                {showAlternatives ? '접기' : `다른 버스 ${info.alternatives.length - 1}개 더 보기`}
              </button>
              {showAlternatives && (
                <div className="mt-1.5 space-y-1">
                  {info.alternatives.filter(a => a.bus_no !== info.bus_no).map((alt, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/60 rounded-md px-2 py-1">
                      <span className="text-blue-700 font-medium">{alt.bus_no}번</span>
                      <span className="text-gray-500">배차 {alt.interval_min}분 · 승차 {alt.ride_min}분</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400">총 이동 {visit.travel_minutes}분</p>
      </div>
    )
  }

  // 도보
  return (
    <div className="ml-[18px] border-l-2 border-dashed border-gray-200 pl-8 py-2">
      <p className="text-xs text-gray-400">🚶 도보 이동 {visit.travel_minutes}분</p>
    </div>
  )
}

/** 버스 도착 실시간 카운트다운 */
function BusCountdown({ intervalSec }: { intervalSec: number }) {
  const [remainSec, setRemainSec] = useState(() => {
    const now = Math.floor(Date.now() / 1000)
    return intervalSec - (now % intervalSec)
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainSec(prev => prev <= 1 ? intervalSec : prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [intervalSec])

  const min = Math.floor(remainSec / 60)
  const sec = remainSec % 60

  return (
    <div className="text-right">
      <p className="font-mono font-bold text-blue-700 text-sm">{min}:{sec.toString().padStart(2, '0')}</p>
      <p className="text-blue-400 text-[10px]">후 도착</p>
    </div>
  )
}

interface TimelineItemProps {
  time: string
  title: string
  subtitle: string
  detail?: string
  tasks?: string[]
  icon: React.ReactNode
  color: { bg: string; text: string; dot: string }
  waitTime?: number
}

function TimelineItem({ time, title, subtitle, detail, tasks, icon, color, waitTime }: TimelineItemProps) {
  return (
    <div className="flex gap-4 items-start">
      <div className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm`}>
        {icon}
      </div>
      <div className={`flex-1 ${color.bg} rounded-xl px-4 py-3`}>
        <div className="flex items-center justify-between mb-1">
          <p className={`font-bold text-sm ${color.text}`}>{title}</p>
          <span className="text-xs font-mono text-gray-500">{time}</span>
        </div>
        <p className="text-xs text-gray-500">{subtitle}</p>
        {detail && <p className="text-xs text-gray-400 mt-1">{detail}</p>}
        {tasks && tasks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tasks.map((t, i) => (
              <span key={i} className="text-xs bg-white/70 px-2 py-0.5 rounded-md text-gray-600">{t}</span>
            ))}
          </div>
        )}
        {waitTime != null && waitTime > 15 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            대기시간 다소 길 수 있음
          </div>
        )}
      </div>
    </div>
  )
}
