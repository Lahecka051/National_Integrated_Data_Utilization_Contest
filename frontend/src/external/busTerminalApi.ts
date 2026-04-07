/**
 * 고속버스/시외버스 터미널 API (TS 포팅) — Kakao Local 기반 + TAGO 고속버스
 */
import { httpGet } from '../lib/httpClient'
import { API_KEYS } from '../config/apiKeys'
import { searchNearbyPlaces } from './kakaoApi'
import type { TransitHub } from './railApi'

const TAGO_EXPBUS_BASE = 'http://apis.data.go.kr/1613000/ExpBusInfoService'

const EXCLUDE_NAMES = ['정류장', '정류소', '휴게소', '매표소', '안내소']

function isValidTerminal(name: string, category: string): boolean {
  const isTerminal =
    category.includes('버스터미널') ||
    (category.endsWith('터미널') && (category.includes('고속') || category.includes('시외'))) ||
    (category.startsWith('교통,수송') && category.includes('터미널') && !category.includes('정류'))
  if (!isTerminal) return false
  if (EXCLUDE_NAMES.some(kw => name.includes(kw))) return false
  return true
}

export async function fetchNearbyBusTerminals(lat: number, lng: number, radius = 5000): Promise<{
  hubs: TransitHub[]
  source: string
}> {
  const queries = ['고속버스터미널', '시외버스터미널', '버스터미널']
  const seen = new Set<string>()
  const results: TransitHub[] = []

  for (const q of queries) {
    const kakao = await searchNearbyPlaces({ query: q, lat, lng, radius, size: 15 })
    for (const k of kakao) {
      if (!k.id || seen.has(k.id)) continue
      if (!isValidTerminal(k.name, k.category)) continue
      seen.add(k.id)
      results.push({
        id: String(k.id),
        name: k.name,
        type: 'bus_terminal',
        address: k.address || k.road_address || '',
        lat: k.lat,
        lng: k.lng,
        distance: k.distance,
        category: k.category,
        phone: k.phone,
      })
    }
  }
  results.sort((a, b) => a.distance - b.distance)
  return { hubs: results.slice(0, 20), source: 'kakao' }
}

export async function fetchExpbusTerminals(): Promise<{ id: string; name: string; lat: number; lng: number; terminal_id: string }[]> {
  const key = API_KEYS.DATA_GO_KR
  if (!key) return []
  try {
    const res = await httpGet<any>({
      url: `${TAGO_EXPBUS_BASE}/getExpBusTrminlList`,
      params: {
        serviceKey: key,
        pageNo: '1',
        numOfRows: '500',
        _type: 'json',
      },
    })
    if (res.status !== 200) return []
    let items = res.data?.response?.body?.items ?? []
    if (typeof items === 'object' && !Array.isArray(items)) items = items.item ?? []
    if (!Array.isArray(items)) items = items ? [items] : []
    return items
      .map((it: any) => {
        const gx = parseFloat(String(it.gpsX || 0))
        const gy = parseFloat(String(it.gpsY || 0))
        if (!gx || !gy) return null
        return {
          id: `tago_${it.terminalId || ''}`,
          name: it.terminalNm || '',
          lat: gy,
          lng: gx,
          terminal_id: it.terminalId,
        }
      })
      .filter((x: any): x is NonNullable<typeof x> => x !== null)
  } catch {
    return []
  }
}

export async function fetchExpbusSchedules(
  depTerminalId: string,
  arrTerminalId: string,
  depPlandtime: string,
  busGradeId = '',
): Promise<any[]> {
  const key = API_KEYS.DATA_GO_KR
  if (!key || !depTerminalId || !arrTerminalId) return []
  try {
    const params: Record<string, string> = {
      serviceKey: key,
      pageNo: '1',
      numOfRows: '30',
      _type: 'json',
      depTerminalId,
      arrTerminalId,
      depPlandTime: depPlandtime,
    }
    if (busGradeId) params.busGradeId = busGradeId
    const res = await httpGet<any>({
      url: `${TAGO_EXPBUS_BASE}/getStrtpntAlocFndExpbusInfo`,
      params,
    })
    if (res.status !== 200) return []
    let items = res.data?.response?.body?.items ?? []
    if (typeof items === 'object' && !Array.isArray(items)) items = items.item ?? []
    if (!Array.isArray(items)) items = items ? [items] : []
    return items
  } catch {
    return []
  }
}

export async function fetchExpbusRemainingSeats(startTerminalId: string): Promise<number> {
  if (!startTerminalId) return -1
  try {
    const items = await fetchExpbusSchedules(startTerminalId, '', '')
    if (!items.length) return -1
    const ratios: number[] = []
    for (const it of items) {
      const remaining = parseInt(String(it.adultCharge || 0), 10) || 0
      const total = parseInt(String(it.chargeFormula || 0), 10) || 0
      if (total > 0) ratios.push(remaining / total)
    }
    if (!ratios.length) return -1
    return ratios.reduce((a, b) => a + b, 0) / ratios.length
  } catch {
    return -1
  }
}
