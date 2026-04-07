/**
 * 공공데이터포털 API 클라이언트 (TS 포팅)
 *   - 민원실 실시간/메타 (B551982/cso_v2)
 *   - 교차로/신호등 (B551982/rti)
 *   - 버스 실시간 (B551982/rte)
 *   - 기상청 단기예보
 *   - 한국천문연구원 공휴일
 */
import { httpGet } from '../lib/httpClient'
import { API_KEYS } from '../config/apiKeys'

const BASE_B551982 = 'https://apis.data.go.kr/B551982'
const WEATHER_BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0'
const HOLIDAY_BASE = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService'

function commonParams(stdgCd: string, numRows = 100): Record<string, string> {
  return {
    serviceKey: API_KEYS.DATA_GO_KR,
    pageNo: '1',
    numOfRows: String(numRows),
    type: 'json',
    stdgCd,
  }
}

async function fetchB551982(path: string, stdgCd: string): Promise<any | null> {
  try {
    const res = await httpGet<any>({
      url: `${BASE_B551982}${path}`,
      params: commonParams(stdgCd),
    })
    if (res.status !== 200) return null
    const data = res.data
    const code = data?.header?.resultCode || ''
    if (['00', 'K0', 'K3', ''].includes(code)) return data
    return null
  } catch {
    return null
  }
}

function extractItems(data: any): any[] {
  let items = data?.body?.items?.item ?? []
  if (!Array.isArray(items)) items = items ? [items] : []
  return items
}

// === 민원실 ===
export async function fetchCivilRealtime(stdgCd = '3100000000'): Promise<any[] | null> {
  const data = await fetchB551982('/cso_v2/cso_realtime_v2', stdgCd)
  return data ? extractItems(data) : null
}

export async function fetchCivilMeta(stdgCd = '3100000000'): Promise<any[] | null> {
  const data = await fetchB551982('/cso_v2/cso_meta_v2', stdgCd)
  return data ? extractItems(data) : null
}

// === 교통 신호등 ===
export async function fetchCrossroadMap(stdgCd = '3100000000'): Promise<any[] | null> {
  const data = await fetchB551982('/rti/crsrd_map_info', stdgCd)
  return data ? extractItems(data) : null
}

export async function fetchTrafficLightSignal(stdgCd = '3100000000'): Promise<any[] | null> {
  const data = await fetchB551982('/rti/tl_drct_info', stdgCd)
  return data ? extractItems(data) : null
}

// 신호등 데이터에서 보행자 대기시간(평균) 추정
export function getPedestrianWaitEstimate(signals: any[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const signal of signals) {
    const crId = signal?.crsrdId || signal?.crossroad_id
    if (!crId) continue
    let totalWait = 0
    let count = 0
    for (let dir = 1; dir <= 8; dir++) {
      const wait = parseInt(signal?.[`pedestRmnTmDir${dir}`] ?? '0', 10)
      if (wait > 0) {
        totalWait += wait
        count++
      }
    }
    if (count > 0) result[String(crId)] = Math.round(totalWait / count)
  }
  return result
}

// === 버스 ===
export async function fetchBusRouteInfo(stdgCd = '3100000000'): Promise<any[] | null> {
  const data = await fetchB551982('/rte/mst_info', stdgCd)
  return data ? extractItems(data) : null
}

export async function fetchBusRealtimeLocation(stdgCd = '3100000000'): Promise<any[] | null> {
  const data = await fetchB551982('/rte/rtm_loc_info', stdgCd)
  return data ? extractItems(data) : null
}

// === 기상청 단기예보 ===
export async function fetchWeatherForecast(nx: number, ny: number, baseDate: string): Promise<any | null> {
  try {
    // 기본 base_time 은 발표 시각(매 3시간: 0200, 0500, ...) 중 가장 최근 값을 사용
    const now = new Date()
    const hours = now.getHours()
    const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23]
    let baseHour = 2
    for (const h of baseTimes) {
      if (hours >= h) baseHour = h
    }
    const baseTime = String(baseHour).padStart(2, '0') + '00'

    const res = await httpGet<any>({
      url: `${WEATHER_BASE}/getVilageFcst`,
      params: {
        serviceKey: API_KEYS.DATA_GO_KR,
        pageNo: '1',
        numOfRows: '300',
        dataType: 'JSON',
        base_date: baseDate,
        base_time: baseTime,
        nx: String(nx),
        ny: String(ny),
      },
    })
    if (res.status !== 200) return null
    return res.data
  } catch {
    return null
  }
}

export function parseWeatherForecast(data: any): {
  condition: '맑음' | '흐림' | '비' | '눈'
  temperature: number
  rain_probability: number
  penalty_factor: number
} | null {
  try {
    const items = data?.response?.body?.items?.item || []
    if (items.length === 0) return null
    // 대표값 추출: SKY(하늘), PTY(강수형태), TMP(기온), POP(강수확률)
    let sky = 1, pty = 0, tmp = 20, pop = 0
    for (const it of items) {
      const cat = it.category
      const val = it.fcstValue
      if (cat === 'SKY') sky = parseInt(val, 10) || 1
      else if (cat === 'PTY') pty = parseInt(val, 10) || 0
      else if (cat === 'TMP') tmp = parseInt(val, 10) || 20
      else if (cat === 'POP') pop = parseInt(val, 10) || 0
    }
    let condition: '맑음' | '흐림' | '비' | '눈' = '맑음'
    if (pty === 3) condition = '눈'
    else if (pty === 1 || pty === 2 || pty === 4) condition = '비'
    else if (sky === 3 || sky === 4) condition = '흐림'
    const penalty = condition === '비' ? 1.3 : condition === '눈' ? 1.4 : 1.0
    return { condition, temperature: tmp, rain_probability: pop, penalty_factor: penalty }
  } catch {
    return null
  }
}

// === 공휴일 ===
export async function fetchHolidayInfo(year: string, month: string): Promise<any[]> {
  try {
    const params: Record<string, string> = {
      ServiceKey: API_KEYS.DATA_GO_KR,
      solYear: year,
      _type: 'json',
      numOfRows: '30',
    }
    if (month) params.solMonth = month
    const res = await httpGet<any>({
      url: `${HOLIDAY_BASE}/getRestDeInfo`,
      params,
    })
    if (res.status !== 200) return []
    let items = res.data?.response?.body?.items?.item ?? []
    if (!Array.isArray(items)) items = items ? [items] : []
    return items.map((it: any) => ({
      date: it.locdate,
      name: it.dateName,
      is_holiday: it.isHoliday === 'Y' || it.isHoliday === true,
    }))
  } catch {
    return []
  }
}

export function hasApiKey(): boolean {
  const k = API_KEYS.DATA_GO_KR
  return Boolean(k) && k !== 'your_api_key_here'
}
