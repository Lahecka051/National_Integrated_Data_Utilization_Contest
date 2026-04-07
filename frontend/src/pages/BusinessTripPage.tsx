import { useEffect, useState } from 'react'
import type { PublicParking, TransitHub, HubCongestion, HubType, TripPlan, TripRecommendResponse, ParkingPreference, TransportMode } from '../types'
import {
  fetchNearbyParking, fetchNearbyTrainStations, fetchNearbyBusTerminals, fetchHubCongestion,
  fetchTripRecommend,
} from '../utils/api'
import { useLocation } from '../contexts/LocationContext'
import ParkingList from '../components/ParkingList'
import TransitHubCard from '../components/TransitHubCard'
import LocationPicker from '../components/LocationPicker'
import TripPlanForm from '../components/TripPlanForm'
import TripPlanCard from '../components/TripPlanCard'
import TripTimeline from '../components/TripTimeline'
import TripRouteMap from '../components/TripRouteMap'

type Tab = 'trip' | 'parking' | 'train' | 'bus'

interface BusinessTripPageProps {
  onBack: () => void
  initialTripResult?: TripRecommendResponse | null
}

export default function BusinessTripPage({ onBack, initialTripResult }: BusinessTripPageProps) {
  const { location } = useLocation()
  const [tab, setTab] = useState<Tab>('trip')
  const [showPicker, setShowPicker] = useState(false)

  // 여행 계획 추천
  const [tripLoading, setTripLoading] = useState(false)
  const [tripResult, setTripResult] = useState<TripRecommendResponse | null>(initialTripResult ?? null)
  const [selectedPlanRank, setSelectedPlanRank] = useState<number | null>(
    initialTripResult && initialTripResult.plans.length > 0 ? 1 : null
  )

  // 주차장
  const [parkings, setParkings] = useState<PublicParking[]>([])
  const [hasRealtime, setHasRealtime] = useState(false)
  const [parkingLoading, setParkingLoading] = useState(false)
  const [selectedParkingId, setSelectedParkingId] = useState<string>()

  // 기차역 / 터미널
  const [trainHubs, setTrainHubs] = useState<TransitHub[]>([])
  const [busHubs, setBusHubs] = useState<TransitHub[]>([])
  const [hubsLoading, setHubsLoading] = useState(false)
  const [congestionMap, setCongestionMap] = useState<Record<string, HubCongestion>>({})
  const [selectedHubId, setSelectedHubId] = useState<string>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadAll() {
      setError(null)
      setParkingLoading(true)
      setHubsLoading(true)
      try {
        const [parkRes, trainRes, busRes] = await Promise.all([
          fetchNearbyParking(location.lat, location.lng, 2000),
          fetchNearbyTrainStations(location.lat, location.lng, 5000),
          fetchNearbyBusTerminals(location.lat, location.lng, 5000),
        ])
        if (cancelled) return
        setParkings(parkRes.parkings)
        setHasRealtime(parkRes.has_realtime)
        setTrainHubs(trainRes.hubs)
        setBusHubs(busRes.hubs)
      } catch (e) {
        if (cancelled) return
        setError('데이터를 불러오지 못했습니다. 백엔드가 실행 중인지 확인해주세요.')
      } finally {
        if (!cancelled) {
          setParkingLoading(false)
          setHubsLoading(false)
        }
      }
    }
    loadAll()
    // 위치 바뀔 때마다 다시 로드
    setCongestionMap({})
    setSelectedHubId(undefined)
    setSelectedParkingId(undefined)
    return () => { cancelled = true }
  }, [location.lat, location.lng])

  const handleHubClick = async (hub: TransitHub) => {
    setSelectedHubId(hub.id)
    if (congestionMap[hub.id]) return  // 이미 조회됨
    try {
      const cong = await fetchHubCongestion(hub.type, hub)
      setCongestionMap(prev => ({ ...prev, [hub.id]: cong }))
    } catch {
      /* ignore */
    }
  }

  const handleTripSubmit = async (params: {
    destination: string
    date: string
    earliestDeparture: string
    parkingPreference: ParkingPreference
    modes: TransportMode[]
  }) => {
    setTripLoading(true)
    setTripResult(null)
    setSelectedPlanRank(null)
    setError(null)
    try {
      const result = await fetchTripRecommend({
        origin_lat: location.lat,
        origin_lng: location.lng,
        destination: params.destination,
        date: params.date,
        earliest_departure: params.earliestDeparture,
        parking_preference: params.parkingPreference,
        modes: params.modes,
      })
      setTripResult(result)
      if (result.plans.length > 0) {
        setSelectedPlanRank(1)
      }
    } catch (e) {
      setError('여행 추천 요청에 실패했습니다. 백엔드가 실행 중인지 확인해주세요.')
    } finally {
      setTripLoading(false)
    }
  }

  const currentHubs = tab === 'train' ? trainHubs : tab === 'bus' ? busHubs : []
  const hubType: HubType | null = tab === 'train' ? 'train_station' : tab === 'bus' ? 'bus_terminal' : null
  const selectedPlan = tripResult?.plans.find(p => p.rank === selectedPlanRank) || null

  return (
    <div className="pt-6 pb-10">
      {/* 헤더 */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          홈으로
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold mb-3">
              ✈️ 출장 모드
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">공공주차장 · 역 혼잡도</h1>
            <p className="text-sm text-gray-500">차량을 공공주차장에 세우고 기차/고속버스로 이동하는 출장자를 위한 모드입니다.</p>
          </div>
        </div>

        {/* 현재 위치 배너 */}
        <button
          onClick={() => setShowPicker(true)}
          className="mt-4 w-full bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between hover:shadow-sm transition-shadow text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-600">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-500">현재 위치</p>
              <p className="text-sm font-medium text-gray-900 truncate">{location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}</p>
            </div>
          </div>
          <span className="text-xs text-primary-600 font-bold flex-shrink-0">변경</span>
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1.5 mb-4 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        <TabButton active={tab === 'trip'} onClick={() => setTab('trip')} icon="✈️" label="여행 계획" />
        <TabButton active={tab === 'parking'} onClick={() => setTab('parking')} icon="🅿️" label="주차장" count={parkings.length} />
        <TabButton active={tab === 'train'} onClick={() => setTab('train')} icon="🚄" label="기차역" count={trainHubs.length} />
        <TabButton active={tab === 'bus'} onClick={() => setTab('bus')} icon="🚌" label="터미널" count={busHubs.length} />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 컨텐츠 */}
      {tab === 'trip' && (
        <div className="space-y-5">
          <TripPlanForm onSubmit={handleTripSubmit} loading={tripLoading} />

          {tripResult && (
            <>
              {tripResult.note && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 mt-0.5 flex-shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <p className="text-xs text-blue-800">{tripResult.note}</p>
                </div>
              )}

              {tripResult.plans.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-sm">추천할 수 있는 플랜이 없습니다.</p>
                  <p className="text-xs mt-1">목적지나 출발 시각을 바꿔보세요.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                      총 {tripResult.plans.length}개 플랜 · 목적지 {tripResult.destination_resolved}
                    </p>
                    {tripResult.plans.map(plan => (
                      <TripPlanCard
                        key={plan.rank}
                        plan={plan}
                        expanded={selectedPlanRank === plan.rank}
                        onClick={() => setSelectedPlanRank(plan.rank === selectedPlanRank ? null : plan.rank)}
                      />
                    ))}
                  </div>

                  {selectedPlan && (
                    <div className="pt-3 space-y-4">
                      <div>
                        <p className="text-xs font-bold text-gray-500 mb-2">선택한 플랜 지도</p>
                        <TripRouteMap
                          plan={selectedPlan}
                          originLat={location.lat}
                          originLng={location.lng}
                          destinationLat={tripResult.destination_lat}
                          destinationLng={tripResult.destination_lng}
                          destinationLabel={tripResult.destination_resolved}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 mb-2">선택한 플랜 상세</p>
                        <TripTimeline
                          plan={selectedPlan}
                          originAddress={tripResult.origin_address}
                          destinationResolved={tripResult.destination_resolved}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'parking' && (
        <ParkingList
          parkings={parkings}
          hasRealtime={hasRealtime}
          loading={parkingLoading}
          onSelect={p => setSelectedParkingId(p.id)}
          selectedId={selectedParkingId}
        />
      )}

      {hubType && (
        <div>
          <p className="text-xs text-gray-500 mb-3">
            카드를 탭하면 실시간 혼잡도가 산출됩니다. (주변 교통·시간대·공휴일·좌석 잔여율 기반)
          </p>
          {hubsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="bg-gray-100 rounded-xl h-28 animate-pulse" />)}
            </div>
          ) : currentHubs.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm">주변에 {tab === 'train' ? '기차역' : '버스터미널'}이 없습니다.</p>
              <p className="text-xs mt-1">다른 위치를 입력해보세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentHubs.map(hub => (
                <TransitHubCard
                  key={hub.id}
                  hub={hub}
                  congestion={congestionMap[hub.id]}
                  selected={selectedHubId === hub.id}
                  onClick={() => handleHubClick(hub)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showPicker && <LocationPicker onClose={() => setShowPicker(false)} />}
    </div>
  )
}

function TabButton({
  active, onClick, icon, label, count,
}: { active: boolean; onClick: () => void; icon: string; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 px-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
        active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      <span className="mr-1.5">{icon}</span>
      {label}
      {count !== undefined && count > 0 && <span className="ml-1.5 text-xs opacity-60">({count})</span>}
    </button>
  )
}
