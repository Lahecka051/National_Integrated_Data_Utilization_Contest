/**
 * 기차역/고속버스 터미널 혼잡도 지수 산출 (TS 포팅)
 */
import { fetchTrafficLightSignal, getPedestrianWaitEstimate } from '../external/publicDataApi'
import { fetchExpbusRemainingSeats } from '../external/busTerminalApi'

function timeOfDayScore(now: Date): number {
  const h = now.getHours()
  if ((h >= 7 && h <= 9) || (h >= 17 && h <= 19)) return 35
  if (h >= 11 && h <= 13) return 20
  if (h > 9 && h < 17) return 15
  if (h >= 22 || h < 6) return 0
  return 10
}

function dayOfWeekScore(now: Date): number {
  const wd = (now.getDay() + 6) % 7   // Mon=0
  if (wd === 4 && now.getHours() >= 16) return 15
  if (wd === 6 && now.getHours() >= 16) return 13
  if (wd < 5) return 8
  return 5
}

function holidayBonus(isHoliday: boolean): number {
  return isHoliday ? 10 : 0
}

async function trafficWaitScore(stdgCd: string): Promise<[number, number]> {
  try {
    const signals = await fetchTrafficLightSignal(stdgCd)
    if (!signals || signals.length === 0) return [0, 0]
    const waits = getPedestrianWaitEstimate(signals)
    const values = Object.values(waits)
    if (values.length === 0) return [0, 0]
    const avgWait = values.reduce((a, b) => a + b, 0) / values.length
    return [Math.min(20, Math.floor(avgWait / 3)), Math.floor(avgWait)]
  } catch {
    return [0, 0]
  }
}

async function busSeatScore(terminalId?: string): Promise<[number, number]> {
  if (!terminalId) return [0, -1]
  const ratio = await fetchExpbusRemainingSeats(terminalId)
  if (ratio < 0) return [0, -1]
  const score = Math.floor(Math.max(0, Math.min(1, 1 - ratio)) * 20)
  return [score, ratio]
}

export async function calculateHubCongestion(params: {
  hub_id: string
  hub_name: string
  hub_type: 'train_station' | 'bus_terminal'
  lat: number
  lng: number
  stdg_cd?: string
  terminal_id?: string
  is_holiday?: boolean
}): Promise<{
  hub_id: string
  hub_name: string
  hub_type: 'train_station' | 'bus_terminal'
  level: '여유' | '보통' | '혼잡'
  score: number
  factors: any
  timestamp: string
  note: string
}> {
  const { hub_id, hub_name, hub_type, stdg_cd = '3100000000', terminal_id, is_holiday = false } = params
  const now = new Date()

  let sTime = timeOfDayScore(now)
  const sDay = dayOfWeekScore(now)
  const sHoliday = holidayBonus(is_holiday)
  const [sTraffic, avgWait] = await trafficWaitScore(stdg_cd)

  let sSeat = 0
  let seatRatio = -1
  if (hub_type === 'bus_terminal') {
    const [ss, sr] = await busSeatScore(terminal_id)
    sSeat = ss
    seatRatio = sr
  } else {
    sTime = Math.floor(sTime * 1.25)
  }

  let total = sTime + sDay + sHoliday + sTraffic + sSeat
  total = Math.max(0, Math.min(100, total))

  const level: '여유' | '보통' | '혼잡' =
    total >= 65 ? '혼잡' : total >= 35 ? '보통' : '여유'

  const notes: string[] = []
  if (sTime >= 30) notes.push('출퇴근 시간대')
  if (sHoliday > 0) notes.push('공휴일')
  if (avgWait >= 40) notes.push(`주변 보행 대기 ${avgWait}초`)
  if (seatRatio >= 0) notes.push(`고속버스 잔여 ${Math.floor(seatRatio * 100)}%`)

  return {
    hub_id,
    hub_name,
    hub_type,
    level,
    score: total,
    factors: {
      time_of_day: sTime,
      day_of_week: sDay,
      holiday: sHoliday,
      traffic_wait: sTraffic,
      seat_availability: sSeat,
      avg_pedestrian_wait_sec: avgWait,
      bus_seat_remaining_ratio: seatRatio >= 0 ? seatRatio : null,
    },
    timestamp: now.toISOString().split('.')[0],
    note: notes.length > 0 ? notes.join(', ') : '일반적 통행량',
  }
}
