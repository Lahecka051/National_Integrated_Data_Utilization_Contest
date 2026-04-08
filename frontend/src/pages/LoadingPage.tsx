import type { Errand } from '../types'

interface LoadingPageProps {
  errands: Errand[]
}

export default function LoadingPage({ errands }: LoadingPageProps) {
  return (
    <div className="pt-24 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-6 animate-pulse">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-600 animate-spin" style={{ animationDuration: '2s' }}>
          <circle cx="12" cy="12" r="10" strokeDasharray="30 10" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">최적 날짜를 분석하고 있어요</h2>
      <p className="text-gray-500 mb-8">{errands.length}개 용무의 최적 시간을 시뮬레이션 중...</p>
      <div className="max-w-md mx-auto space-y-3">
        <AnalysisStep label="민원실/은행 혼잡도 예측" delay={0} />
        <AnalysisStep label="시설 간 이동시간 산출" delay={300} />
        <AnalysisStep label="횡단보도 신호 대기시간 계산" delay={600} />
        <AnalysisStep label="날씨 보정 적용" delay={900} />
        <AnalysisStep label="최적 방문 순서 탐색" delay={1200} />
      </div>
    </div>
  )
}

function AnalysisStep({ label, delay }: { label: string; delay: number }) {
  return (
    <div
      className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 opacity-0 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  )
}
