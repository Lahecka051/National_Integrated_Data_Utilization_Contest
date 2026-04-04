interface LandingPageProps {
  onStartMode1: () => void
  onStartMode2: () => void
}

export default function LandingPage({ onStartMode1, onStartMode2 }: LandingPageProps) {
  return (
    <div className="pt-16 pb-8">
      {/* Hero */}
      <section className="text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          AI 기반 반차 최적화
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          구청, 은행, 우체국<br />
          <span className="text-primary-600">한 번에 끝내는 최적 동선</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed">
          대기시간, 혼잡도, 이동경로, 날씨까지 분석해서
          <br className="hidden md:block" />
          가장 빠르게 끝나는 날짜와 순서를 알려드립니다.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button onClick={onStartMode1} className="btn-primary text-lg px-10 py-4 shadow-lg shadow-primary-200">
            최적 날짜 찾기
          </button>
          <button onClick={onStartMode2} className="btn-secondary text-lg px-10 py-4 bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:border-gray-300">
            날짜 지정 최적 경로
          </button>
        </div>
      </section>

      {/* 작동 원리 */}
      <section className="mb-16">
        <h2 className="text-center text-2xl font-bold text-gray-900 mb-8">어떻게 작동하나요?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <StepCard
            step={1}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            }
            title="용무 등록"
            desc="처리할 용무를 선택하세요. 전입신고, 통장 개설 등"
          />
          <StepCard
            step={2}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            title="한 달 시뮬레이션"
            desc="향후 한 달간 모든 반차 슬롯의 소요시간을 예측합니다"
          />
          <StepCard
            step={3}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
            title="최적 추천"
            desc="가장 빠르게 끝나는 날짜·시간·순서를 알려드려요"
          />
        </div>
      </section>

      {/* 데이터 출처 */}
      <section className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">활용 공공데이터</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <DataBadge icon="🏛️" label="민원실 이용 현황 실시간 정보" tag="필수" />
          <DataBadge icon="🚌" label="초정밀 버스 실시간 정보" tag="필수" />
          <DataBadge icon="🚦" label="교통안전 신호등 실시간 정보" tag="필수" />
          <DataBadge icon="🌤️" label="기상청 단기예보" tag="추가" />
          <DataBadge icon="📮" label="전국 우체국 현황 정보" tag="추가" />
          <DataBadge icon="🏦" label="금융기관 이용 통계" tag="추가" />
          <DataBadge icon="📅" label="공휴일/특일 정보" tag="추가" />
        </div>
      </section>
    </div>
  )
}

function StepCard({ step, icon, title, desc }: { step: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-100 text-primary-600 rounded-2xl mb-4">
        {icon}
      </div>
      <div className="text-xs font-bold text-primary-400 mb-1">STEP {step}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </div>
  )
}

function DataBadge({ icon, label, tag }: { icon: string; label: string; tag: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/70 rounded-xl px-4 py-3">
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
      </div>
      <span className={`badge text-xs ${tag === '필수' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
        {tag}
      </span>
    </div>
  )
}
