import { useState, useEffect, useRef } from 'react'
import { useLocation } from '../contexts/LocationContext'
import { searchAddresses, type AddressSearchResult } from '../utils/api'

interface LocationPickerProps {
  onClose: () => void
}

export default function LocationPicker({ onClose }: LocationPickerProps) {
  const { location, isResolving, error, setLocationDirect, requestGPS, resetToDefault } = useLocation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AddressSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleGPS = async () => {
    setLocalError(null)
    const ok = await requestGPS()
    if (ok) onClose()
  }

  const runSearch = async (text: string) => {
    const q = text.trim()
    if (!q) {
      setResults([])
      setSearched(false)
      return
    }
    setSearching(true)
    setLocalError(null)
    try {
      const r = await searchAddresses(q, 15)
      setResults(r)
      setSearched(true)
      if (r.length === 0) {
        setLocalError('검색 결과가 없습니다. 다른 키워드로 시도해보세요.')
      }
    } catch {
      setLocalError('검색에 실패했습니다.')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  // 타이핑 → 500ms 후 자동 검색 (디바운스)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      runSearch(query)
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelect = (r: AddressSearchResult) => {
    const addr = r.road_address || r.address || r.place_name || r.label
    setLocationDirect(r.lat, r.lng, addr)
    onClose()
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] overflow-y-auto animate-fade-in">
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden my-4">
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

          {/* 주소 검색 입력 */}
          <div>
            <label className="text-xs font-bold text-gray-500 mb-2 block">주소/장소 검색</label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch(query)}
                placeholder="도로명, 지번, 건물명, 우편번호"
                className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                disabled={isResolving}
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!searching && query && (
                <button
                  onClick={() => { setQuery(''); setResults([]); setSearched(false) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  aria-label="지우기"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              💡 예: "부산광역시 해운대구 우동", "서울역", "12345"
            </p>
          </div>

          {/* 검색 결과 목록 */}
          {results.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-[10px] font-bold text-gray-500 border-b border-gray-200">
                검색 결과 {results.length}개 · 항목을 탭해 선택
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {results.map((r, i) => (
                  <button
                    key={`${r.lat}_${r.lng}_${i}`}
                    onClick={() => handleSelect(r)}
                    className="w-full text-left px-3 py-3 hover:bg-primary-50 active:bg-primary-100 transition-colors"
                  >
                    {r.place_name && (
                      <p className="text-sm font-bold text-gray-900 mb-1 truncate">
                        {r.place_name}
                      </p>
                    )}
                    {r.road_address && (
                      <div className="flex items-start gap-1.5 mb-0.5">
                        <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-bold flex-shrink-0 mt-0.5">
                          도로명
                        </span>
                        <p className="text-xs text-gray-800 leading-tight flex-1 min-w-0">
                          {r.road_address}
                        </p>
                      </div>
                    )}
                    {r.address && (
                      <div className="flex items-start gap-1.5">
                        <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold flex-shrink-0 mt-0.5">
                          지번
                        </span>
                        <p className="text-xs text-gray-600 leading-tight flex-1 min-w-0">
                          {r.address}
                        </p>
                      </div>
                    )}
                    {r.postal_code && (
                      <p className="text-[10px] text-gray-400 mt-1 ml-0.5">
                        📮 우편번호 {r.postal_code}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 검색 안내: 결과 없음 */}
          {searched && results.length === 0 && !searching && (
            <div className="text-center py-4 text-xs text-gray-400">
              🔍 검색 결과가 없습니다
            </div>
          )}

          {/* 기본 위치로 */}
          <button
            onClick={handleReset}
            className="w-full text-xs text-gray-500 hover:text-gray-700 py-2"
          >
            기본 위치(울산시청)로 초기화
          </button>

          {/* 에러 표시 */}
          {(error || localError) && results.length === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs text-red-700">{localError || error}</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
