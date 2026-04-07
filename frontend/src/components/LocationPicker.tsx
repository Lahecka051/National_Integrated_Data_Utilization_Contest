import { useState } from 'react'
import { useLocation } from '../contexts/LocationContext'

interface LocationPickerProps {
  onClose: () => void
}

export default function LocationPicker({ onClose }: LocationPickerProps) {
  const { location, isResolving, error, setManualLocation, requestGPS, resetToDefault } = useLocation()
  const [address, setAddress] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleGPS = async () => {
    setLocalError(null)
    const ok = await requestGPS()
    if (ok) onClose()
  }

  const handleSearch = async () => {
    setLocalError(null)
    if (!address.trim()) {
      setLocalError('주소를 입력해주세요.')
      return
    }
    const ok = await setManualLocation(address)
    if (ok) onClose()
  }

  const handleReset = () => {
    resetToDefault()
    onClose()
  }

  const sourceLabel: Record<string, string> = {
    gps: 'GPS 실시간',
    manual: '직접 입력',
    default: '기본 위치',
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-5 bg-gradient-to-r from-primary-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <p className="font-bold">현재 위치 설정</p>
              <p className="text-xs text-white/70">주차장·혼잡도 검색에 사용됩니다</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center" aria-label="닫기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 현재 위치 상태 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 mb-1">현재 설정</p>
            <p className="text-sm font-medium text-gray-900 mb-1">{location.address || '주소 정보 없음'}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                <span className={`w-1.5 h-1.5 rounded-full ${location.source === 'gps' ? 'bg-green-500' : location.source === 'manual' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                {sourceLabel[location.source]}
              </span>
              <span>{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
            </div>
          </div>

          {/* GPS 버튼 */}
          <button
            onClick={handleGPS}
            disabled={isResolving}
            className="w-full flex items-center gap-3 px-4 py-3 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl text-left transition-colors disabled:opacity-50"
          >
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
                <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-primary-900">현재 위치 사용 (GPS)</p>
              <p className="text-xs text-primary-700/70">브라우저가 위치 권한을 요청합니다</p>
            </div>
            {isResolving && (
              <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            )}
          </button>

          {/* 주소 직접 입력 */}
          <div>
            <label className="text-xs font-bold text-gray-500 mb-2 block">주소 직접 입력</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="예: 서울역, 부산광역시 해운대구 우동"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                disabled={isResolving}
              />
              <button
                onClick={handleSearch}
                disabled={isResolving || !address.trim()}
                className="px-5 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm whitespace-nowrap"
              >
                검색
              </button>
            </div>
          </div>

          {/* 기본 위치로 */}
          <button
            onClick={handleReset}
            className="w-full text-xs text-gray-500 hover:text-gray-700 py-2"
          >
            기본 위치(울산시청)로 초기화
          </button>

          {/* 에러 표시 */}
          {(error || localError) && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs text-red-700">{localError || error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
