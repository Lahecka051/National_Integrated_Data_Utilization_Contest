import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev 서버 설정:
 *  - APK 빌드 전에 `npm run dev`로 브라우저 테스트를 할 수 있도록
 *    CORS 제약이 있는 외부 API들을 Vite 프록시로 우회시킵니다.
 *  - 운영(APK) 환경에서는 CapacitorHttp가 직접 호출하므로 프록시 불필요.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 공공데이터포털 — apis.data.go.kr (TAGO, 기상청, 신호등, 민원실)
      '/proxy-apis-data-go-kr': {
        target: 'https://apis.data.go.kr',
        changeOrigin: true,
        secure: false,
        rewrite: p => p.replace(/^\/proxy-apis-data-go-kr/, ''),
      },
      // 공공데이터포털 — api.data.go.kr (전국주차장 표준)
      '/proxy-api-data-go-kr': {
        target: 'https://api.data.go.kr',
        changeOrigin: true,
        secure: false,
        rewrite: p => p.replace(/^\/proxy-api-data-go-kr/, ''),
      },
      // 서울 열린데이터광장 — 공영주차장 실시간
      '/proxy-openapi-seoul': {
        target: 'http://openapi.seoul.go.kr:8088',
        changeOrigin: true,
        secure: false,
        rewrite: p => p.replace(/^\/proxy-openapi-seoul/, ''),
      },
    },
  },
})
