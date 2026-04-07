/**
 * 대기시간 추정 모델 (통계 기반)
 * — wait_time_model.py TS 포팅
 *
 * 은행: 한국은행 금융감독원 통계
 * 민원실: 행정안전부 정부24 통계
 * 우체국: 우정사업본부 통계
 */

// === 은행 ===
const BANK_BASE_WAIT = 12.3
const BANK_WEEKDAY_FACTOR: Record<number, number> = { 0: 1.40, 1: 0.80, 2: 0.90, 3: 0.70, 4: 1.30 }
const BANK_HOUR_FACTOR: Record<number, number> = {
  9: 1.20, 10: 1.40, 11: 1.50, 12: 0.70, 13: 0.90, 14: 1.10, 15: 1.00,
}

export function calcBankWait(weekday: number, hour: number, dayOfMonth: number): number {
  if (weekday > 4 || hour >= 16) return 0
  let base = BANK_BASE_WAIT
  base *= BANK_WEEKDAY_FACTOR[weekday] ?? 1.0
  base *= BANK_HOUR_FACTOR[hour] ?? 1.0
  if (dayOfMonth >= 25) base *= 1.60
  else if (dayOfMonth <= 5) base *= 1.30
  if ([10, 15, 25].includes(dayOfMonth)) base *= 1.40
  return Math.max(1, Math.round(base))
}

// === 민원실 ===
const CIVIL_BASE_WAIT = 8.5
const CIVIL_WEEKDAY_FACTOR: Record<number, number> = { 0: 1.80, 1: 0.90, 2: 1.05, 3: 0.75, 4: 1.40 }
const CIVIL_HOUR_FACTOR: Record<number, number> = {
  9: 1.30, 10: 1.60, 11: 1.80, 12: 0.50, 13: 0.80, 14: 1.10, 15: 0.95, 16: 0.80, 17: 0.60,
}

export function calcCivilWait(weekday: number, hour: number, dayOfMonth: number = 15): number {
  if (weekday > 4) return 0
  let base = CIVIL_BASE_WAIT
  base *= CIVIL_WEEKDAY_FACTOR[weekday] ?? 1.0
  base *= CIVIL_HOUR_FACTOR[hour] ?? 1.0
  if (dayOfMonth <= 5) base *= 1.50
  return Math.max(1, Math.round(base))
}

// === 우체국 ===
const POST_BASE_WAIT = 5.2
const POST_WEEKDAY_FACTOR: Record<number, number> = { 0: 1.50, 1: 0.85, 2: 1.00, 3: 0.80, 4: 1.25 }
const POST_HOUR_FACTOR: Record<number, number> = {
  9: 1.20, 10: 1.40, 11: 1.30, 12: 0.60, 13: 0.90, 14: 1.05, 15: 0.95, 16: 0.85, 17: 0.70,
}

export function calcPostWait(weekday: number, hour: number): number {
  if (weekday > 4) return 0
  let base = POST_BASE_WAIT
  base *= POST_WEEKDAY_FACTOR[weekday] ?? 1.0
  base *= POST_HOUR_FACTOR[hour] ?? 1.0
  return Math.max(1, Math.round(base))
}

// === 용무별 평균 처리시간 (분) ===
export const TASK_DURATIONS: Record<string, number> = {
  '전입신고': 10,
  '주민등록등본 발급': 5,
  '인감증명서 발급': 5,
  '여권 신청': 15,
  '통장 개설': 20,
  '카드 발급': 15,
  '대출 상담': 30,
  '환전': 10,
  '등기우편 발송': 10,
  '택배 발송': 5,
}

export function getTaskDuration(taskName: string): number {
  return TASK_DURATIONS[taskName] ?? 15
}
