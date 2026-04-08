/**
 * 요일별 혼잡도 비교 히트맵
 * 한국은행/행정안전부/우정사업본부 통계 기반
 */

const DAYS = ['월', '화', '수', '목', '금']
const HOURS = ['09', '10', '11', '12', '13', '14', '15', '16', '17']

// 통계 모델 — 공공데이터 기반의 일반 추정 모델 (frontend/src/lib/waitTimeModel.ts와 동일 수식)
const CIVIL_BASE = 8.5
const CIVIL_WD = [1.80, 0.90, 1.05, 0.75, 1.40]
const CIVIL_HR: Record<number, number> = { 9:1.30, 10:1.60, 11:1.80, 12:0.50, 13:0.80, 14:1.10, 15:0.95, 16:0.80, 17:0.60 }

const BANK_BASE = 12.3
const BANK_WD = [1.40, 0.80, 0.90, 0.70, 1.30]
const BANK_HR: Record<number, number> = { 9:1.20, 10:1.40, 11:1.50, 12:0.70, 13:0.90, 14:1.10, 15:1.00 }

function calcCivil(wd: number, hr: number): number {
  return Math.max(1, Math.round(CIVIL_BASE * CIVIL_WD[wd] * (CIVIL_HR[hr] ?? 1.0)))
}
function calcBank(wd: number, hr: number): number {
  if (hr >= 16) return 0
  return Math.max(1, Math.round(BANK_BASE * BANK_WD[wd] * (BANK_HR[hr] ?? 1.0)))
}

const CIVIL_DATA = DAYS.map((_, wd) => HOURS.map((_, hi) => calcCivil(wd, hi + 9)))
const BANK_DATA = DAYS.map((_, wd) => HOURS.map((_, hi) => calcBank(wd, hi + 9)))

function getColor(value: number): string {
  if (value === 0) return '#f3f4f6'
  if (value <= 5) return '#dcfce7'
  if (value <= 10) return '#bbf7d0'
  if (value <= 15) return '#fef08a'
  if (value <= 20) return '#fdba74'
  if (value <= 25) return '#fb923c'
  return '#ef4444'
}

export default function CongestionChart() {
  return (
    <div className="space-y-6">
      <HeatmapGrid title="🏛️ 민원실 평균" data={CIVIL_DATA} subtitle="행정안전부 민원처리 통계 기반 일반 추정" />
      <HeatmapGrid title="🏦 은행 평균" data={BANK_DATA} subtitle="한국은행 금융기관 이용 통계 기반 일반 추정" />

      <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
        <span>한산</span>
        <div className="flex gap-0.5">
          {['#dcfce7', '#bbf7d0', '#fef08a', '#fdba74', '#fb923c', '#ef4444'].map(c => (
            <div key={c} className="w-6 h-3 rounded-sm" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span>혼잡</span>
        <span className="ml-2 text-gray-300">|</span>
        <span className="text-gray-400">단위: 예상 대기시간(분) · 통계 기반 추정</span>
      </div>
    </div>
  )
}

function HeatmapGrid({ title, data, subtitle }: { title: string; data: number[][]; subtitle?: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-0.5">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mb-2">{subtitle}</p>}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-10" />
              {HOURS.map(h => (
                <th key={h} className="text-xs text-gray-400 font-normal py-1 px-1 text-center">{h}시</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, di) => (
              <tr key={day}>
                <td className="text-xs text-gray-500 font-medium pr-2 text-right">{day}</td>
                {HOURS.map((_, hi) => {
                  const val = data[di][hi]
                  return (
                    <td key={hi} className="p-0.5">
                      <div
                        className="rounded-md text-center py-2 text-xs font-medium cursor-default"
                        style={{ backgroundColor: getColor(val), color: val > 20 ? '#fff' : '#374151' }}
                        title={`${day}요일 ${HOURS[hi]}시: ${val === 0 ? '마감' : `${val}분 대기`}`}
                      >
                        {val === 0 ? '-' : val}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
