import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'kr.hatuzzagi.app',
  appName: '반차출장플랜',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // 개발 중 라이브 리로드 — 필요 시 활성화
    // url: 'http://10.0.2.2:5173',
    // cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    Geolocation: {
      // 위치 권한 관련 설정
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#6366f1',
    },
  },
}

export default config
