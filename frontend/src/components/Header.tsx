import { useLocation } from '../contexts/LocationContext'

interface HeaderProps {
  onLogoClick: () => void
  onSettingsClick: () => void
  onLocationClick: () => void
}

export default function Header({ onLogoClick, onSettingsClick, onLocationClick }: HeaderProps) {
  const { location } = useLocation()

  const sourceLabel: Record<string, string> = {
    gps: '실시간 GPS',
    manual: '직접 입력',
    default: '기본 위치',
  }

  const sourceDot: Record<string, string> = {
    gps: 'bg-green-500',
    manual: 'bg-blue-500',
    default: 'bg-gray-400',
  }

  const sourceRing: Record<string, string> = {
    gps: 'ring-green-300',
    manual: 'ring-blue-300',
    default: 'ring-gray-300',
  }

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      {/* 1행: 로고 + 설정 */}
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <button onClick={onLogoClick} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M8 14l2 2 4-4" />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900 whitespace-nowrap">반차출장플랜</span>
        </button>
        <button
          onClick={onSettingsClick}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          title="알림 설정"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
      </div>

      {/* 2행: 현재 위치 바 (풀 와이드) */}
      <div className="max-w-5xl mx-auto px-4 pb-3 pt-0.5">
        <button
          onClick={onLocationClick}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-50 to-indigo-50 hover:from-primary-100 hover:to-indigo-100 border border-primary-200 rounded-xl transition-all active:scale-[0.99] shadow-sm"
        >
          {/* 위치 아이콘 + GPS 상태 점 */}
          <div className="relative flex-shrink-0">
            <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center ring-2 ${sourceRing[location.source] || 'ring-gray-300'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ${sourceDot[location.source] || 'bg-gray-400'} ring-2 ring-white`} />
          </div>

          {/* 주소 + 메타 */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wide">현재 위치</span>
              <span className="text-[10px] text-primary-500/80">· {sourceLabel[location.source] || ''}</span>
            </div>
            <p className="text-sm font-bold text-gray-900 truncate leading-tight mt-0.5">
              {location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
            </p>
          </div>

          {/* 변경 표시 화살표 */}
          <div className="flex-shrink-0 flex items-center gap-1 text-primary-600">
            <span className="text-xs font-bold hidden sm:inline">변경</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>
      </div>
    </header>
  )
}
