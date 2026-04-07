import { useState, useEffect } from 'react'
import type { AppStep, AppMode, Errand, HalfDayType, RecommendationResponse, TripRecommendResponse } from './types'
import LandingPage from './pages/LandingPage'
import ErrandSelectPage from './pages/ErrandSelectPage'
import DateSelectPage from './pages/DateSelectPage'
import LoadingPage from './pages/LoadingPage'
import ResultPage from './pages/ResultPage'
import BusinessTripPage from './pages/BusinessTripPage'
import Header from './components/Header'
import NotificationSettings from './components/NotificationSettings'
import LocationPicker from './components/LocationPicker'
import { useNotification } from './hooks/useNotification'
import { useLocation } from './contexts/LocationContext'
import { fetchRecommendation, fetchOptimizeSlot, fetchLLMStatus } from './utils/api'

export interface AlarmInfo {
  date: string
  time: string
  label: string
  timerId: number
}

export default function App() {
  const [step, setStep] = useState<AppStep>('landing')
  const [mode, setMode] = useState<AppMode>('mode1')
  const [errands, setErrands] = useState<Errand[]>([])
  const [result, setResult] = useState<RecommendationResponse | null>(null)
  const [initialTripResult, setInitialTripResult] = useState<TripRecommendResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [alarm, setAlarm] = useState<AlarmInfo | null>(null)
  const [llmAvailable, setLlmAvailable] = useState(false)

  const notification = useNotification()
  const { location } = useLocation()

  useEffect(() => {
    fetchLLMStatus().then(s => setLlmAvailable(s.available)).catch(() => {})
  }, [])

  const handleStartMode1 = () => {
    setMode('mode1')
    setStep('errand-select')
  }

  const handleStartMode2 = () => {
    setMode('mode2')
    setStep('errand-select')
  }

  const handleStartBusinessTrip = () => {
    setMode('business-trip')
    setInitialTripResult(null)
    setStep('business-trip')
  }

  const handleChatTripRecommendation = (tripResult: TripRecommendResponse) => {
    setInitialTripResult(tripResult)
    setMode('business-trip')
    setStep('business-trip')
  }

  const handleSubmitErrands = async (selectedErrands: Errand[]) => {
    setErrands(selectedErrands)
    setError(null)

    if (mode === 'mode2') {
      setStep('date-select')
      return
    }

    setStep('loading')
    try {
      const data = await fetchRecommendation(selectedErrands, location.lat, location.lng)
      setResult(data)
      setStep('result')
    } catch (e) {
      setError('서버 연결에 실패했습니다. 백엔드가 실행 중인지 확인해주세요.')
      setStep('errand-select')
    }
  }

  const handleSubmitDate = async (date: string, halfDay: HalfDayType) => {
    setStep('loading')
    setError(null)
    try {
      const data = await fetchOptimizeSlot(errands, date, halfDay, location.lat, location.lng)
      setResult(data)
      setStep('result')
    } catch (e) {
      setError('서버 연결에 실패했습니다. 백엔드가 실행 중인지 확인해주세요.')
      setStep('date-select')
    }
  }

  const handleSetAlarm = (date: string, time: string, label: string) => {
    const [hour, min] = time.split(':').map(Number)
    const departureDate = new Date(`${date}T${time}:00`)
    const alarmDate = new Date(departureDate.getTime() - 10 * 60 * 1000)
    const now = new Date()
    const delayMs = alarmDate.getTime() - now.getTime()

    if (delayMs > 0) {
      const timerId = window.setTimeout(() => {
        notification.sendNotification(
          '하루짜기 - 출발 알림',
          `10분 후 ${label} 출발! (${time} 도착 예정)`
        )
        setAlarm(null)
      }, delayMs)
      setAlarm({ date, time, label, timerId })
      notification.sendNotification(
        '하루짜기 - 알람 설정 완료',
        `${date} ${hour}시 ${min > 0 ? min + '분' : ''} 출발 10분 전에 알려드립니다`
      )
    } else {
      const timerId = window.setTimeout(() => {
        notification.sendNotification(
          '하루짜기 - 알람 데모',
          `${label} 출발 알림이 설정되었습니다 (${date} ${time} 10분 전)`
        )
      }, 100)
      setAlarm({ date, time, label, timerId })
    }

    // 알람 설정 후 홈으로 이동
    setStep('landing')
    setErrands([])
    setResult(null)
  }

  const handleCancelAlarm = () => {
    if (alarm) {
      clearTimeout(alarm.timerId)
      setAlarm(null)
      notification.sendNotification(
        '하루짜기 - 알람 취소',
        '설정된 알람이 취소되었습니다.'
      )
    }
  }

  const handleChatRecommendation = (chatResult: RecommendationResponse, chatErrands: Errand[]) => {
    setResult(chatResult)
    setErrands(chatErrands)
    setMode('mode1')
    setStep('result')
  }

  const handleReset = () => {
    setStep('landing')
    setMode('mode1')
    setErrands([])
    setResult(null)
    setInitialTripResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Header
        onLogoClick={handleReset}
        onSettingsClick={() => setShowSettings(true)}
        onLocationClick={() => setShowLocationPicker(true)}
      />
      <main className="max-w-5xl mx-auto px-4 pb-20">
        {/* 활성 알람 배너 */}
        {alarm && step === 'landing' && (
          <div className="mt-4 mb-0">
            <div className="bg-primary-50 border border-primary-200 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-600">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-primary-800">알람이 설정되어 있습니다</p>
                  <p className="text-xs text-primary-600">
                    {alarm.date} {alarm.time} 출발 10분 전 — {alarm.label}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelAlarm}
                className="text-sm font-medium text-red-500 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
              >
                알람 취소
              </button>
            </div>
          </div>
        )}

        {step === 'landing' && (
          <LandingPage
            onStartMode1={handleStartMode1}
            onStartMode2={handleStartMode2}
            onStartBusinessTrip={handleStartBusinessTrip}
            llmAvailable={llmAvailable}
            onRecommendationReady={handleChatRecommendation}
            onTripRecommendationReady={handleChatTripRecommendation}
          />
        )}
        {step === 'business-trip' && (
          <BusinessTripPage onBack={handleReset} initialTripResult={initialTripResult} />
        )}
        {step === 'errand-select' && (
          <ErrandSelectPage
            onSubmit={handleSubmitErrands}
            error={error}
            mode={mode}
            onBack={() => setStep('landing')}
          />
        )}
        {step === 'date-select' && (
          <DateSelectPage
            onSubmit={handleSubmitDate}
            error={error}
            onBack={() => setStep('errand-select')}
          />
        )}
        {step === 'loading' && <LoadingPage errands={errands} />}
        {step === 'result' && result && (
          <ResultPage result={result} errands={errands} onReset={handleReset} mode={mode} onSetAlarm={handleSetAlarm} />
        )}
      </main>

      {showLocationPicker && (
        <LocationPicker onClose={() => setShowLocationPicker(false)} />
      )}

      {showSettings && (
        <NotificationSettings
          settings={notification.settings}
          onUpdate={notification.updateSettings}
          permissionState={notification.permissionState}
          onRequestPermission={notification.requestPermission}
          onTestNotification={() => notification.sendNotification(
            '하루짜기 - 테스트 알림',
            '알림이 정상적으로 작동합니다!'
          )}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
