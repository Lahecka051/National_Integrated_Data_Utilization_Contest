import { useLocation } from '../contexts/LocationContext'

interface HeaderProps {
  onLogoClick: () => void
  onSettingsClick: () => void
  onLocationClick: () => void
}

export default function Header({ onLogoClick, onSettingsClick, onLocationClick }: HeaderProps) {
  const { location } = useLocation()

  const shortAddr = location.address
    ? location.address.split(' ').slice(0, 3).join(' ')
    : `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}`

  const sourceDot: Record<string, string> = {
    gps: 'bg-green-500',
    manual: 'bg-blue-500',
    default: 'bg-gray-400',
  }

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <button onClick={onLogoClick} className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M8 14l2 2 4-4" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900 hidden sm:inline">하루짜기</span>
        </button>
        <div className="flex items-center gap-2 min-w-0">
          {/* 현재 위치 배지 */}
          <button
            onClick={onLocationClick}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors min-w-0 max-w-[260px]"
            title="현재 위치 변경"
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sourceDot[location.source] || 'bg-gray-400'}`} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 flex-shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-xs font-medium text-gray-700 truncate">{shortAddr}</span>
          </button>
          <button
            onClick={onSettingsClick}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
            title="알림 설정"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
