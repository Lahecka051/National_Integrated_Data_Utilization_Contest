/**
 * 원클릭 서비스 (TS 포팅) — 데모/MOCK
 */

interface DocRequirement {
  name: string
  auto_issuable: boolean
  source: string
}

const REQUIRED_DOCS: Record<string, DocRequirement[]> = {
  '전입신고': [
    { name: '신분증', auto_issuable: false, source: '본인 지참' },
    { name: '임대차계약서', auto_issuable: false, source: '본인 지참' },
    { name: '전입신고서', auto_issuable: true, source: '정부24' },
  ],
  '주민등록등본 발급': [
    { name: '신분증', auto_issuable: false, source: '본인 지참' },
  ],
  '인감증명서 발급': [
    { name: '신분증', auto_issuable: false, source: '본인 지참' },
    { name: '본인 인감', auto_issuable: false, source: '본인 지참' },
  ],
  '여권 신청': [
    { name: '신분증', auto_issuable: false, source: '본인 지참' },
    { name: '여권용 사진', auto_issuable: false, source: '본인 지참' },
    { name: '여권발급 신청서', auto_issuable: true, source: '정부24' },
    { name: '병적증명서', auto_issuable: true, source: '병무청 (mock)' },
  ],
  '통장 개설': [
    { name: '신분증', auto_issuable: false, source: '본인 지참' },
    { name: '주민등록등본', auto_issuable: true, source: '정부24' },
  ],
  '카드 발급': [
    { name: '신분증', auto_issuable: false, source: '본인 지참' },
  ],
  '대출 상담': [
    { name: '신분증', auto_issuable: false, source: '본인 지참' },
    { name: '주민등록등본', auto_issuable: true, source: '정부24' },
    { name: '재직증명서', auto_issuable: true, source: '근로복지공단 (mock)' },
    { name: '소득금액증명원', auto_issuable: true, source: '홈택스 (mock)' },
    { name: '지방세납세증명서', auto_issuable: true, source: '정부24' },
  ],
  '환전': [
    { name: '신분증', auto_issuable: false, source: '본인 지참' },
  ],
  '등기우편 발송': [
    { name: '신분증', auto_issuable: false, source: '본인 지참' },
    { name: '발송 내용물', auto_issuable: false, source: '본인 지참' },
  ],
  '택배 발송': [
    { name: '신분증', auto_issuable: false, source: '본인 지참' },
    { name: '발송 내용물', auto_issuable: false, source: '본인 지참' },
  ],
}

const RESERVATION_CHANNEL: Record<string, string> = {
  '민원실': '정부24 민원예약',
  '은행': '영업점 방문 예약',
  '우체국': '우체국 인터넷 예약',
}

function generateReservationNo(): string {
  const chars = '0123456789ABCDEF'
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * 16)]
  return `RSV-${s}`
}

export interface OneClickDocumentResult {
  document_name: string
  required_for: string
  source: string
  auto_issued: boolean
  issued_at: string | null
  status: string
  download_url: string | null
  is_mock: boolean
}

export interface OneClickReservationResult {
  facility_id: string
  facility_name: string
  facility_type: string
  visit_date: string
  visit_time: string
  reservation_number: string
  channel: string
  status: string
  is_mock: boolean
}

export interface OneClickConfirmResult {
  success: boolean
  is_mock: boolean
  summary: string
  documents: OneClickDocumentResult[]
  reservations: OneClickReservationResult[]
  warnings: string[]
  confirmed_at: string
}

export async function confirmOneClickPlan(plan: any, errands: any[]): Promise<OneClickConfirmResult> {
  const taskNames = errands.map(e => e.task_name || '')
  const documents: OneClickDocumentResult[] = []
  const nowIso = new Date().toISOString()

  // 자동 발급 + 본인 지참 집계
  const seenNames = new Set<string>()
  const autoDocs: DocRequirement[] = []
  const bringDocs: DocRequirement[] = []
  const metaForName: Record<string, string> = {}

  for (const taskName of taskNames) {
    for (const doc of REQUIRED_DOCS[taskName] || []) {
      if (seenNames.has(doc.name)) continue
      seenNames.add(doc.name)
      metaForName[doc.name] = taskName
      if (doc.auto_issuable) autoDocs.push(doc)
      else bringDocs.push(doc)
    }
  }

  // 자동 발급 (mock delay)
  for (const doc of autoDocs) {
    await new Promise(r => setTimeout(r, 50))
    documents.push({
      document_name: doc.name,
      required_for: metaForName[doc.name] || '',
      source: doc.source,
      auto_issued: true,
      issued_at: nowIso,
      status: '발급 완료',
      download_url: `/mock/docs/${doc.name.replace(/ /g, '_')}.pdf`,
      is_mock: true,
    })
  }

  // 본인 지참 안내
  for (const doc of bringDocs) {
    documents.push({
      document_name: doc.name,
      required_for: metaForName[doc.name] || '',
      source: doc.source,
      auto_issued: false,
      issued_at: null,
      status: '본인 지참 필요',
      download_url: null,
      is_mock: true,
    })
  }

  // 예약 생성
  const reservations: OneClickReservationResult[] = []
  const visits = plan?.visits || []
  const planDate = plan?.date || ''

  for (const visit of visits) {
    await new Promise(r => setTimeout(r, 80))
    const facility = visit?.facility || {}
    const ftype = facility.type || ''
    let channel = RESERVATION_CHANNEL[ftype] || '예약 시스템'
    if (ftype === '은행') channel = `${facility.name || '은행'} 예약`

    reservations.push({
      facility_id: facility.id || '',
      facility_name: facility.name || '',
      facility_type: ftype,
      visit_date: planDate,
      visit_time: visit?.arrival_time || '',
      reservation_number: generateReservationNo(),
      channel: `${channel} (데모)`,
      status: '예약 확정',
      is_mock: true,
    })
  }

  const autoCount = documents.filter(d => d.auto_issued).length
  const bringCount = documents.length - autoCount
  const summaryParts: string[] = []
  if (autoCount > 0) summaryParts.push(`서류 ${autoCount}건 자동 발급`)
  if (bringCount > 0) summaryParts.push(`본인 지참 ${bringCount}건 안내`)
  if (reservations.length > 0) summaryParts.push(`행정기관 ${reservations.length}곳 예약 확정`)
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : '처리할 항목 없음'

  return {
    success: true,
    is_mock: true,
    summary,
    documents,
    reservations,
    warnings: [
      '이 응답은 데모용 mock 데이터입니다.',
      '실제 서류 발급 및 행정기관 예약은 진행되지 않습니다.',
      '정식 서비스 시 정부24/홈택스/은행 영업점 API와 연동 필요.',
    ],
    confirmed_at: nowIso,
  }
}
