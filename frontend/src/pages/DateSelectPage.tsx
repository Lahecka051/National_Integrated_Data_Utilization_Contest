import { useState, useEffect } from 'react'
import type { HalfDayType } from '../types'
import { fetchHolidays, type HolidayInfo } from '../utils/api'

interface DateSelectPageProps {
  onSubmit: (date: string, halfDay: HalfDayType) => void
  error: string | null
  onBack: () => void
}

// 로컬 타임존 기준으로 YYYY-MM-DD 생성 (toISOString은 UTC 기준이라 로컬 자정에 날짜 어긋날 수 있음)
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DateSelectPage({ onSubmit, error, onBack }: DateSelectPageProps) {
  const [now, setNow] = useState(() => new Date())
  const todayStr = localDateStr(now)
  const year = now.getFullYear().toString()

  const [date, setDate] = useState('')
  const [halfDay, setHalfDay] = useState<HalfDayType | ''>('')
  const [holidays, setHolidays] = useState<Record<string, string>>({})

  // 실시간으로 현재 시각 갱신 (1분마다) — 시간 경계가 지나면 버튼이 자동 비활성화
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  // 한국천문연구원 특일정보 API로 공휴일 로드
  useEffect(() => {
    fetchHolidays(year).then(data => {
      const map: Record<string, string> = {}
      for (const h of data.holidays) {
        if (h.is_holiday) {
          // locdate: 20260101 → 2026-01-01
          const d = String(h.date)
          const formatted = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
          map[formatted] = h.name
        }
      }
      setHolidays(map)
    }).catch(() => {})
  }, [year])

  const selectedDate = date ? new Date(date) : null
  const dayOfWeek = selectedDate
    ? ['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()]
    : ''
  const isWeekend = selectedDate ? selectedDate.getDay() === 0 || selectedDate.getDay() === 6 : false
  const holidayName = date ? (holidays[date] || null) : null
  const isClosed = isWeekend || !!holidayName

  // === 실시간 시각 기반 반차 옵션 활성화 ===
  // 오늘을 선택한 경우에만 "이미 지난 시간대" 버튼을 비활성화
  const isToday = date === todayStr
  const currentHour = now.getHours()
  const currentMin = now.getMinutes()

  // 오전반차 09:00~13:00 — 13시부터 불가
  const morningDisabled = isToday && (currentHour >= 13)
  // 오후반차 14:00~18:00 — 18시부터 불가
  const afternoonDisabled = isToday && (currentHour >= 18)
  // 연차 09:00~18:00 — 18시부터 불가
  const fullDayDisabled = isToday && (currentHour >= 18)

  // 선택한 반차 유형이 비활성화되면 자동 해제
  useEffect(() => {
    if (halfDay === '오전반차' && morningDisabled) setHalfDay('')
    else if (halfDay === '오후반차' && afternoonDisabled) setHalfDay('')
    else if (halfDay === '연차' && fullDayDisabled) setHalfDay('')
  }, [morningDisabled, afternoonDisabled, fullDayDisabled, halfDay])

  const canSubmit = date && halfDay && !isClosed

  const handleSubmit = () => {
    if (canSubmit) {
      onSubmit(date, halfDay as HalfDayType)
    }
  }

  // 시간 안내 문구
  const timeNotice = isToday
    ? `현재 ${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')} — 이미 지난 시간대는 선택할 수 없습니다`
    : null

  return (
    <div className="pt-8 max-w-lg mx-auto">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors mb-6 text-sm font-medium"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        뒤로가기
      </button>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">날짜와 시간을 선택하세요</h2>
        <p className="text-gray-500">휴가를 사용할 날짜와 유형을 선택하면 최적 경로를 알려드립니다</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      {/* 날짜 선택 */}
      <div className="card mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          <span className="inline-flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            날짜 선택
          </span>
        </h3>
        <input
          type="date"
          value={date}
          min={todayStr}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-900 text-lg
                     focus:border-primary-500 focus:outline-none transition-colors"
        />
        {date && (
          <div className="mt-3">
            {holidayName ? (
              <p className="text-sm text-red-500 font-medium">
                {date.replace(/-/g, '.')} ({dayOfWeek}요일)은 {holidayName}으로 공공기관 휴무일입니다.
              </p>
            ) : isWeekend ? (
              <p className="text-sm text-red-500 font-medium">
                {dayOfWeek}요일은 공공기관 휴무일입니다. 평일을 선택해주세요.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                {date.replace(/-/g, '.')} ({dayOfWeek}요일)
              </p>
            )}
          </div>
        )}
      </div>

      {/* 반차 유형 선택 */}
      <div className="card mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          <span className="inline-flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            휴가 유형
          </span>
        </h3>
        {timeNotice && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⏰ {timeNotice}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => !morningDisabled && setHalfDay('오전반차')}
            disabled={morningDisabled}
            title={morningDisabled ? '이미 오전 시간이 지나 선택할 수 없습니다' : undefined}
            className={`flex flex-col items-center px-3 py-5 rounded-xl border-2 transition-all duration-150
              ${morningDisabled
                ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-50'
                : halfDay === '오전반차'
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
              }`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <p className="font-bold text-sm">오전반차</p>
            <p className="text-xs text-gray-400 mt-1">09:00~13:00</p>
            {morningDisabled && (
              <p className="text-[10px] text-red-500 mt-1 font-medium">시간 종료</p>
            )}
          </button>
          <button
            onClick={() => !afternoonDisabled && setHalfDay('오후반차')}
            disabled={afternoonDisabled}
            title={afternoonDisabled ? '이미 오후 시간이 지나 선택할 수 없습니다' : undefined}
            className={`flex flex-col items-center px-3 py-5 rounded-xl border-2 transition-all duration-150
              ${afternoonDisabled
                ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-50'
                : halfDay === '오후반차'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
              }`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <p className="font-bold text-sm">오후반차</p>
            <p className="text-xs text-gray-400 mt-1">14:00~18:00</p>
            {afternoonDisabled && (
              <p className="text-[10px] text-red-500 mt-1 font-medium">시간 종료</p>
            )}
          </button>
          <button
            onClick={() => !fullDayDisabled && setHalfDay('연차')}
            disabled={fullDayDisabled}
            title={fullDayDisabled ? '이미 업무 종료 시간이 지나 선택할 수 없습니다' : undefined}
            className={`flex flex-col items-center px-3 py-5 rounded-xl border-2 transition-all duration-150
              ${fullDayDisabled
                ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-50'
                : halfDay === '연차'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
              }`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M8 14l2 2 4-4" />
            </svg>
            <p className="font-bold text-sm">연차</p>
            <p className="text-xs text-gray-400 mt-1">09:00~18:00</p>
            {fullDayDisabled && (
              <p className="text-[10px] text-red-500 mt-1 font-medium">시간 종료</p>
            )}
          </button>
        </div>
      </div>

      {/* 제출 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="btn-primary w-full text-lg py-4"
      >
        최적 경로 찾기
      </button>
    </div>
  )
}
