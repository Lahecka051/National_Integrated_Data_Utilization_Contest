import type { TripPlan } from '../types'
import ParkingStatusBadge from './ParkingStatusBadge'

interface TripTimelineProps {
  plan: TripPlan
  originAddress?: string
  destinationResolved?: string
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

function formatFullDate(dateStr: string): string {
  // YYYY-MM-DD → YYYY년 M월 D일 (요일)
  if (!dateStr || dateStr.length < 10) return dateStr
  try {
    const d = new Date(dateStr + 'T00:00:00')
    if (isNaN(d.getTime())) return dateStr
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KR[d.getDay()]})`
  } catch {
    return dateStr
  }
}

export default function TripTimeline({ plan, originAddress, destinationResolved }: TripTimelineProps) {
  const modeIcon = plan.schedule.mode === 'train' ? '🚄' : '🚌'
  const modeLabel = plan.schedule.mode === 'train' ? '열차' : '고속버스'

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-2xl border-2 border-indigo-200 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-indigo-700 font-bold mb-0.5">플랜 {plan.rank} 상세</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatDuration(plan.total_duration_min)}
            <span className="text-base font-normal text-gray-500 ml-2">· {formatFare(plan.total_fare_won)}</span>
          </p>
        </div>
        <div className={`text-xs px-3 py-1 rounded-full font-bold ${
          plan.schedule.is_estimated
            ? 'bg-gray-100 text-gray-500'
            : 'bg-green-100 text-green-700'
        }`}>
          {plan.schedule.is_estimated ? '예상값' : '실시간'}
        </div>
      </div>

      <div className="relative pl-8 space-y-6">
        {/* 세로선 */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-300 via-indigo-400 to-violet-400" />

        {/* 출발지 */}
        <div className="relative">
          <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-gray-300 border-4 border-white flex items-center justify-center text-[10px] font-bold text-white">출</div>
          <p className="text-xs text-gray-500 font-medium">출발지</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">
            {originAddress || '현재 위치'}
          </p>
        </div>

        {/* 주차장 */}
        {plan.parking && (
          <div className="relative">
            <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-amber-400 border-4 border-white flex items-center justify-center text-sm">🅿️</div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-amber-700 font-bold">주차장</p>
              <ParkingStatusBadge
                status={plan.parking.status}
                available={plan.parking.available_slots}
                total={plan.parking.total_slots}
              />
            </div>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{plan.parking.name}</p>
            <p className="text-xs text-gray-500">{plan.parking.address}</p>
            {plan.parking.fee_info && (
              <p className="text-xs text-gray-500 mt-0.5">💰 {plan.parking.fee_info}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">↓ 도보 {plan.parking.walk_minutes}분 ({plan.parking.distance_to_hub}m)</p>
          </div>
        )}

        {/* 출발 허브 */}
        <div className="relative">
          <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-indigo-500 border-4 border-white flex items-center justify-center text-[10px] font-bold text-white">역</div>
          <p className="text-xs text-indigo-700 font-bold">출발 {plan.origin_hub.type === 'train_station' ? '역' : '터미널'}</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{plan.origin_hub.name}</p>
          <p className="text-xs text-gray-500">{plan.origin_hub.address}</p>
          <p className="text-xs font-bold text-indigo-600 mt-1">
            {formatFullDate(plan.schedule.dep_date)} · {plan.schedule.dep_time} 출발
          </p>
        </div>

        {/* 탑승 */}
        <div className="relative">
          <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-violet-500 border-4 border-white flex items-center justify-center text-sm">{modeIcon}</div>
          <p className="text-xs text-violet-700 font-bold">{modeLabel} 탑승</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{plan.schedule.vehicle_name}</p>
          <p className="text-xs text-gray-500">
            {plan.schedule.grade} · {formatDuration(plan.schedule.duration_min)} · {formatFare(plan.schedule.fare_won)}
          </p>
          {plan.schedule.note && (
            <p className="text-[11px] text-gray-400 mt-1">{plan.schedule.note}</p>
          )}
        </div>

        {/* 도착 허브 */}
        <div className="relative">
          <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-violet-600 border-4 border-white flex items-center justify-center text-[10px] font-bold text-white">도</div>
          <p className="text-xs text-violet-700 font-bold">도착 {plan.destination_hub.type === 'train_station' ? '역' : '터미널'}</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{plan.destination_hub.name}</p>
          <p className="text-xs text-gray-500">{plan.destination_hub.address}</p>
          <p className="text-xs font-bold text-violet-600 mt-1">
            {formatFullDate(plan.schedule.arr_date)} · {plan.schedule.arr_time} 도착
            {plan.schedule.dep_date !== plan.schedule.arr_date && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">+1일</span>
            )}
          </p>
        </div>

        {/* 목적지 */}
        {destinationResolved && (
          <div className="relative">
            <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 border-4 border-white flex items-center justify-center text-[10px] font-bold text-white">🏁</div>
            <p className="text-xs text-gray-500 font-medium">최종 목적지</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{destinationResolved}</p>
          </div>
        )}
      </div>

      {plan.reasons.length > 0 && (
        <div className="mt-5 pt-4 border-t border-indigo-200 flex flex-wrap gap-1.5">
          {plan.reasons.map((r, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white text-indigo-700 font-medium border border-indigo-200">
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
