import type { NotificationSettings as Settings } from '../hooks/useNotification'

interface NotificationSettingsProps {
  settings: Settings
  onUpdate: (update: Partial<Settings>) => void
  permissionState: NotificationPermission
  onRequestPermission: () => void
  onTestNotification: () => void
  onClose: () => void
}

export default function NotificationSettings({
  settings,
  onUpdate,
  permissionState,
  onRequestPermission,
  onTestNotification,
  onClose,
}: NotificationSettingsProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">알림 설정</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* 소리 알림 */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">소리 알림</p>
              <p className="text-xs text-gray-400 mt-0.5">방문 일정 시작 전 알림음이 울립니다</p>
            </div>
            <ToggleSwitch
              checked={settings.soundEnabled}
              onChange={(v) => onUpdate({ soundEnabled: v })}
            />
          </div>

          {/* 팝업 알림 */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">팝업 알림</p>
              <p className="text-xs text-gray-400 mt-0.5">브라우저 알림으로 일정을 알려드립니다</p>
            </div>
            <ToggleSwitch
              checked={settings.popupEnabled}
              onChange={(v) => onUpdate({ popupEnabled: v })}
            />
          </div>

          {/* 브라우저 알림 권한 */}
          {settings.popupEnabled && permissionState !== 'granted' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-700 mb-2">
                팝업 알림을 받으려면 브라우저 알림 권한이 필요합니다.
              </p>
              <button
                onClick={onRequestPermission}
                className="text-sm font-medium text-amber-700 underline hover:text-amber-800"
              >
                알림 권한 허용하기
              </button>
            </div>
          )}

          {permissionState === 'granted' && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              브라우저 알림 권한이 허용되어 있습니다
            </p>
          )}
        </div>

        {/* 테스트 버튼 */}
        <button
          onClick={onTestNotification}
          className="mt-6 w-full py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-medium text-sm
                     hover:bg-gray-50 transition-colors"
        >
          알림 테스트
        </button>
      </div>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0
        ${checked ? 'bg-primary-600' : 'bg-gray-300'}`}
    >
      <div
        className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200
          ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  )
}
