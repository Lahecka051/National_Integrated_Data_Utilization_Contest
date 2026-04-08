import type { TripPlan } from '../types'
import ParkingStatusBadge from './ParkingStatusBadge'

interface TripPlanCardProps {
  plan: TripPlan
  expanded?: boolean
  onClick?: () => void
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

function formatFare(won: number): string {
  return `₩${won.toLocaleString()}`
}

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토']

function formatDateShort(dateStr: string): string {
  // YYYY-MM-DD → M/D(요일)
  if (!dateStr || dateStr.length < 10) return dateStr
  try {
    const d = new Date(dateStr + 'T00:00:00')
    if (isNaN(d.getTime())) return dateStr
    return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KR[d.getDay()]})`
  } catch {
    return dateStr
  }
}

function isNextDay(depDate: string, arrDate: string): boolean {
  return Boolean(depDate && arrDate && depDate !== arrDate)
}

export default function TripPlanCard({ plan, expanded, onClick }: TripPlanCardProps) {
  const modeIcon = plan.schedule.mode === 'train' ? '🚄' : '🚌'
  const modeLabel = plan.schedule.mode === 'train' ? '기차' : '고속버스'
  const isRealtime = !plan.schedule.is_estimated

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl border-2 p-5 transition-all hover:shadow-lg ${
        expanded ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'
      }`}
    >
      {/* 상단: 랭크 + 배지 */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${
            plan.rank === 1 ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gray-400'
          }`}>
            {plan.rank}
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{modeLabel} · {plan.schedule.grade}</p>
            <p className="text-lg font-bold text-gray-900">
              {formatDuration(plan.total_duration_min)} · {formatFare(plan.total_fare_won)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end">
          {isRealtime ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">실시간</span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">추정</span>
          )}
          <span className="text-xs font-bold text-primary-600">{plan.score}점</span>
        </div>
      </div>

      {/* 타임라인 — 주차장 또는 대중교통 → 허브 → 기차/버스 */}
      <div className="space-y-3 text-sm">
        {plan.access_mode === 'transit' && plan.transit_info && (
          <div className="flex items-start gap-3">
            <span className="text-xl">🚇</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-800">대중교통으로 이동</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                  지하철+버스
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                약 {plan.transit_info.duration_min}분 ({plan.transit_info.distance_km}km) · {plan.transit_info.note}
              </p>
            </div>
          </div>
        )}
        {plan.access_mode !== 'transit' && plan.parking && (
          <div className="flex items-start gap-3">
            <span className="text-xl">🅿️</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-800 truncate">{plan.parking.name}</span>
                <ParkingStatusBadge
                  status={plan.parking.status}
                  available={plan.parking.available_slots}
                  total={plan.parking.total_slots}
                />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                도보 {plan.parking.walk_minutes}분 ({plan.parking.distance_to_hub}m)
                {plan.parking.fee_info && ` · ${plan.parking.fee_info.slice(0, 25)}`}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <span className="text-xl">{modeIcon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800">
              {plan.origin_hub.name} → {plan.destination_hub.name}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {plan.schedule.vehicle_name} · {formatDuration(plan.schedule.duration_min)}
            </p>
            {/* 출발/도착 날짜+시간 */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                <span className="text-[10px] text-gray-500 font-bold">출발</span>
                <span className="text-xs font-bold text-gray-900">
                  {formatDateShort(plan.schedule.dep_date)} {plan.schedule.dep_time}
                </span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <div className="inline-flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                <span className="text-[10px] text-gray-500 font-bold">도착</span>
                <span className="text-xs font-bold text-gray-900">
                  {formatDateShort(plan.schedule.arr_date)} {plan.schedule.arr_time}
                </span>
                {isNextDay(plan.schedule.dep_date, plan.schedule.arr_date) && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">+1일</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 추천 사유 칩 */}
      {plan.reasons.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
          {plan.reasons.map((r, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
              {r}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
