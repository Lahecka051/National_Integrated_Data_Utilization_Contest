# 하루짜기 (DayPlanner)

2026 전국 통합데이터 활용 공모전 출품작

직장인이 반차/연차를 쓸 **최적 날짜와 동선**을 추천하는 웹 서비스.
민원실 대기시간, 은행 혼잡도, 이동시간, 신호등 대기, 날씨까지 종합 분석합니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React + TypeScript + Tailwind CSS (Vite) |
| Backend | FastAPI (Python) |
| 지도 | Kakao Maps JavaScript API |
| 최적화 | TSP 전수탐색 + 다중 슬롯 시뮬레이션 |

## 활용 공공데이터

### 필수 (전국 통합개방데이터)
- 민원실 이용 현황 실시간 정보 (2종)
- 초정밀 버스 실시간 정보 (3종)
- 교통안전 신호등 실시간 정보 (2종)

### 추가
- 기상청 단기예보 API
- 한국은행 금융기관 이용 통계
- 한국천문연구원 특일정보 API

## 실행 방법

### 백엔드
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 프론트엔드
```bash
cd frontend
npm install
npm run dev
```

### API 키 설정
`.env.example`을 `.env`로 복사 후 키를 입력하세요.
API 키가 없어도 Mock 데이터로 데모가 동작합니다.

## 데모 범위
- 대상 지역: 부산 해운대구
- 대상 시설: 해운대구청 민원실, 국민은행 해운대지점, 해운대우체국
- 핵심 기능: 용무 2~3개 등록 → 향후 2주 최적 반차 날짜 3개 추천
