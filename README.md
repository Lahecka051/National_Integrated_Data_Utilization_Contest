# 반차출장플랜 (하루짜기 / DayPlanner)

> **2026년 전국 통합데이터 활용 공모전 출품작**
> 주최·주관 : 행정안전부 / 한국지역정보개발원
> 공모부문 : 개방데이터 활용 개발(웹 또는 앱)

직장인이 **반차·연차·출장**을 가장 효율적으로 쓸 수 있도록,
공공데이터와 생성형 AI를 결합해 **"언제 갈지 + 어디부터 갈지 + 어떻게 갈지"** 를 한 번에 제안하는 웹/모바일 서비스입니다.

---

## 목차

1. [한 줄 소개 및 핵심 가치](#1-한-줄-소개-및-핵심-가치)
2. [서비스 목적 및 배경](#2-서비스-목적-및-배경)
3. [핵심 기능 및 특징](#3-핵심-기능-및-특징)
4. [기존 서비스와의 차별성 및 독창성](#4-기존-서비스와의-차별성-및-독창성)
5. [활용 공공데이터 및 기타 데이터](#5-활용-공공데이터-및-기타-데이터)
6. [기술 스택 및 시스템 아키텍처](#6-기술-스택-및-시스템-아키텍처)
7. [주요 알고리즘 · 기술 상세](#7-주요-알고리즘--기술-상세)
8. [AI 활용 (가점 대상)](#8-ai-활용-가점-대상)
9. [사용 흐름 (입력 → 처리 → 출력)](#9-사용-흐름-입력--처리--출력)
10. [화면별 설명](#10-화면별-설명)
11. [디렉토리 구조](#11-디렉토리-구조)
12. [실행 방법 (로컬·모바일)](#12-실행-방법-로컬모바일)
13. [기대 효과](#13-기대-효과)
14. [향후 고도화 계획](#14-향후-고도화-계획)
15. [라이선스 · 저작권 · 데이터 출처](#15-라이선스--저작권--데이터-출처)

---

## 1. 한 줄 소개 및 핵심 가치

> **"반차 낸 반나절, 연차 한 번, 출장 당일 — 당신의 시간을 공공데이터로 꽉 채워드립니다."**

- 직장인이 **민원실·은행·우체국** 용무를 한 번의 반차로 가장 빠르게 끝낼 수 있는 **최적 날짜·시간·동선** 제안
- 출장자가 **공공주차장 실시간 가용**과 **기차역/터미널 혼잡도**, **열차/고속버스 시간표**를 한 화면에서 비교 후 출발
- 모든 흐름이 **AI 상담사와의 자연어 대화**로 시작 가능 (원터치 폼도 병행 제공)
- 하나의 코드베이스가 **PWA(웹)** 와 **Android APK(Capacitor)** 로 동시에 배포

---

## 2. 서비스 목적 및 배경

### 2.1 문제 의식

| 문제 | 현황 |
|---|---|
| 반차·연차 낭비 | 민원실·은행·우체국이 **평일 주간에만** 열려 직장인은 반차·연차를 소진해 방문. 그런데도 대기·혼잡으로 한 기관에 1시간 넘게 걸리는 경우가 빈번. |
| 정보 파편화 | 민원실 실시간 대기, 버스 도착, 신호등 잔여, 주차장 가용, 기차/버스편은 **각각 다른 포털·앱**에 흩어져 있어 사용자가 직접 조합해야 함. |
| 출장 시 주차 문제 | 지방 출장 시 KTX/터미널 근처 주차장의 실시간 가용 정보가 없어 현장 도착 후 '만차' 낭비 발생. |
| 기존 일정 앱의 한계 | 구글 캘린더·네이버 캘린더 등은 **예약 관리** 도구일 뿐, **혼잡·대기·이동을 반영한 날짜/시간 추천**은 제공하지 않음. |

### 2.2 서비스 아이디어

세 가지 공공데이터 **(① 민원실 실시간 대기 · ② 초정밀 버스 · ③ 신호등 잔여)** 를 축으로,
사용자가 말하는 "용무" 또는 "출장 목적지" 를 자연어로 파싱하여,
**4주간의 모든 가능 시나리오(평일 × 오전/오후/연차)** 를 **실제 이동시간 + 대기시간 + 날씨 패널티** 로 점수화한 뒤
상위 3개 슬롯을 추천합니다.

### 2.3 타깃 사용자

- **핵심 사용자**: 서울·광역시 거주 직장인, 자영업자
- **보조 사용자**: 출장이 잦은 프리랜서/영업직, 고령자 대리방문 가족
- **확장 가능성**: 외국인 근로자(영문화), 지자체 민원 안내 키오스크

---

## 3. 핵심 기능 및 특징

앱은 크게 **세 가지 모드** + **통합 AI 상담사** 로 구성됩니다.

### 3.1 반차 모드 1 — 최적 날짜 찾기 (Mode 1)

- **입력**: 처리할 용무 (민원실·은행·우체국 중 복수 선택), 사용자 위치
- **처리**: 향후 4주(28일) × 평일(약 20일) × 3가지 반차 유형(오전/오후/연차) = **약 60개 슬롯 시뮬레이션**
- **출력**: 총 소요시간이 가장 짧은 상위 3개 슬롯 + 가장 느린 슬롯(비추천)
- **특징**: 요일별 대기 패턴(월·금 혼잡, 화·목 한산), 월말·월초 은행 혼잡, 비 예보 페널티, 공휴일·주말 자동 제외

### 3.2 반차 모드 2 — 날짜 지정 최적 경로 (Mode 2)

- **입력**: 용무 + 사용자가 지정한 특정 날짜 + 반차 유형(오전/오후/연차)
- **처리**: 해당 날짜 1일만 시뮬레이션하며 **TSP 전수탐색**으로 방문 순서 최적화
- **출력**: 방문 순서 타임라인 + 카카오 지도 경로 + 시설별 예상 대기/처리 시간

### 3.3 출장 모드 — 주차장·허브·대중교통 통합 플래너

- **입력**: 목적지 도시/역명, 출발 날짜, 출발 희망 시각, 이동수단 선호, 허브 접근 수단
- **처리**:
  1. 카카오 Geocode로 목적지 해석
  2. 출발지·목적지 주변 기차역(Top 3) + 고속버스터미널(Top 2) 수집
  3. **TAGO 열차/고속버스 실시간 시간표** 우선 시도, 실패 시 거리 기반 추정 폴백
  4. **허브 접근 수단**에 따른 분기:
     - **차량 모드**: 공공주차장 실시간 가용(서울 열린데이터광장) + 전국주차장 표준 메타데이터 매칭
     - **대중교통 모드**: 지하철·버스 거리 기반 추정(평균 22km/h + 환승여유 10분)
  5. 0~100점 점수화(소요시간·주차 가용·실시간 여부·허브 거리)
- **출력**: 상위 5개 플랜 카드 + 선택한 플랜의 타임라인 + 카카오 지도
- **부가 탭**: 주차장 목록·기차역 목록·터미널 목록 + **허브별 실시간 혼잡도 점수** (시간대·요일·공휴일·보행자 신호 대기·버스 좌석 잔여율 반영)

### 3.4 통합 AI 상담사 (반차 + 출장 자동 의도 감지)

- **위치**: 랜딩 페이지 최상단 챗봇
- **입력**: 자유로운 한국어 문장 (예: "내일 오전에 통장 개설이랑 등본 떼야 해", "다음 주 수요일 부산 출장 기차로")
- **처리**: Google Gemini 2.5 Flash로 아래를 단일 응답에서 전부 추출
  - **의도 감지**: 반차(`half_day`) / 출장(`business_trip`) / 일반 대화(`none`)
  - **반차 필드**: 용무 리스트(10종 매핑), 시간 제약(시작/종료), 날짜 제약(특정 1일 또는 이후 범위)
  - **출장 필드**: 목적지, 날짜, 출발시각, 주차 위치, 교통수단, 허브 접근 수단
  - **운영 가능성 체크**: 요일·공휴일·운영시간 기반으로 주말·공휴일 요청은 자동 거절하고 가까운 평일 대안 제시
- **출력**: 대화 + 구조화된 액션 카드 (파싱된 용무 뱃지, 시간 제약, 추천 결과 3개, 은행 선택 카드, 출장 플랜 3개)
- **게이트 패턴**: 은행 용무가 있는데 지점이 특정되지 않은 경우 **추천을 차단**하고 근처 은행 6개 카드를 먼저 제시, 사용자가 지점을 고른 뒤 자동 재추천

### 3.5 원클릭 서비스 (데모 단계 mock)

- 선택한 반차 플랜에 대해 "필요 서류 자동 발급 + 행정기관 사전 예약" 을 **한 번에 확정**
- 현재는 **mock 응답** (정부24/홈택스/은행 영업점 API 연동 없음). 실서비스 전환 시 행정안전부 원스톱 민원 포털 API 연동을 전제로 UX 검증용으로 구현
- **DEMO/MOCK 배지**로 명시하여 심사 시 혼동 방지

### 3.6 부가 편의 기능

- **GPS/수동 주소 선택**: 최초 진입 시 GPS 요청, 거부 시 울산 남구 기본 위치, 언제든 주소 검색 또는 좌표 입력으로 변경 (localStorage 영속)
- **Android Capacitor 연동**: 네이티브 뒤로가기 버튼, 지오로케이션, 로컬 알림(반차 당일 10분 전 출발 알림)
- **결과 공유 가능한 타임라인 & 지도**: 실제 카카오 내비 API로 호출한 경로 좌표를 카카오 지도에 폴리라인 렌더

---

## 4. 기존 서비스와의 차별성 및 독창성

| 축 | 기존 서비스 | 반차출장플랜 |
|---|---|---|
| **일정 추천의 근거** | 사용자가 직접 고른 시간만 저장 (캘린더) | **실시간 대기·혼잡·이동시간 수치화** 후 4주 × 3슬롯 자동 비교 |
| **여러 용무 통합** | 민원24, 은행앱, 우체국앱 각각 | 하나의 반차에 **3개 기관을 TSP 전수탐색** 으로 묶어 최적 순서 |
| **출장 주차장** | 포털 주차장 검색 (메타데이터만) | **서울 공영주차장 실시간 잔여면수 + 전국 주차장 메타 결합** |
| **허브 혼잡도** | 없음 (역사 도착 후 체감) | **시간대·요일·공휴일·보행자 대기·버스 좌석율** 다중 지표 점수 |
| **자연어 입력** | 캘린더 키워드 추출(제목만) | **LLM 기반 의도 감지 + 필드 추출 + 운영시간 검증** 을 한 번의 응답에서 |
| **앱 전환 부담** | 민원24 앱 · 카카오맵 · 네이버 지도 · 은행앱 · 코레일톡 | **단일 앱에서 전 과정** 완결 |
| **백엔드 의존성** | 대부분 서버 필요 | **완전 로컬 모드** 포팅 (백엔드 없이도 모든 로직이 브라우저/APK에서 실행) |

**핵심 독창성 3가지**
1. **"최적 날짜 찾기"** 라는 역발상: 일정을 입력받는 것이 아니라 **일정을 만들어주는** 서비스
2. **LLM × 공공데이터 하이브리드**: LLM이 파싱한 의도를 **즉시 공공데이터 API 호출 파이프라인** 으로 연결
3. **"완전 로컬 모드"**: 서버 없이도 작동 → 배포 비용 최소화, 사용자 데이터가 외부 서버를 거치지 않음 (프라이버시 친화)

---

## 5. 활용 공공데이터 및 기타 데이터

### 5.1 전국 통합개방데이터 (필수 — 7종 중 3종 활용)

| # | 데이터명 | API 엔드포인트 | 활용처 (코드) | 서비스 내 역할 |
|---|---|---|---|---|
| 6 | **민원실 이용 현황 실시간 정보** (2종) | `apis.data.go.kr/B551982/cso_v2` | `frontend/src/external/publicDataApi.ts` → `fetchCivilRealtime`, `fetchCivilMeta` | 반차 모드의 민원실 대기시간 실측/추정, 시설 메타정보(좌표·운영시간) |
| 5 | **교통안전 실시간 신호등 정보** (2종) | `apis.data.go.kr/B551982/rti` | 동일 파일 → `fetchCrossroadMap`, `fetchTrafficLightSignal` | 보행자 신호 대기시간 → 이동시간 가중치, 허브 혼잡도 지표의 일부 |
| 7 | **전국 초정밀 버스 실시간 위치 정보** (3종) | `apis.data.go.kr/B551982/rte` | 동일 파일 → `fetchBusRouteInfo`, `fetchBusRealtimeLocation` | 정류장→시설 이동 경로의 현재 버스 위치/배차 계산, 허브 혼잡도 지표의 버스 좌석 잔여율 |

### 5.2 추가 공공데이터 (완성도 제고용)

| 데이터명 | 출처 기관 | 엔드포인트 | 역할 |
|---|---|---|---|
| 전국주차장 표준데이터 | 국토교통부 | `api.data.go.kr/openapi/tn_pubr_prkplce_info_api` | 주차장 메타(위치·요금·타입) |
| 공영주차장 실시간 정보 | 서울 열린데이터광장 | `openapi.seoul.go.kr:8088` | 공영주차장 실시간 잔여면수 (서울 지역) |
| 기상청 단기예보 | 기상청 | `apis.data.go.kr/1360000/VilageFcstInfoService_2.0` | 비/눈 예보 → 이동시간 20% 가중, 슬롯 점수 페널티 |
| 한국천문연구원 특일정보 | 천문연 | `apis.data.go.kr/B090041/openapi/service/SpcdeInfoService` | 공휴일 자동 감지 → 추천 대상에서 제외 |
| TAGO 열차 정보 | 국토교통부 | `apis.data.go.kr/1613000/TrainInfoService` | 열차 실시간 시간표(폴백 포함) |
| TAGO 고속버스 정보 | 국토교통부 | `apis.data.go.kr/1613000/ExpBusInfoService` | 고속버스 실시간 시간표(폴백 포함) |

### 5.3 민간 데이터·API (활용 사유 명기)

| 데이터 | 출처 | 사유 |
|---|---|---|
| 카카오 Local API | 카카오 | 민원실·은행·우체국·주차장의 **사용자 위치 기반 검색**과 지오코딩. 공공데이터 기반 지명 검색만으로는 직장인 생활권 커버가 어려워 보조용으로 결합 |
| 카카오 Navi API | 카카오 | **실제 차량 이동 시간** 계산. 거리 기반 추정보다 교차로 신호·교통 반영이 정확 |
| 카카오 Maps JavaScript SDK | 카카오 | 결과 페이지 경로 렌더 |
| Google Gemini 2.5 Flash | Google | **LLM 자연어 파싱**. 사용자 의도와 필드를 한 번의 호출로 추출 (가점 AI 활용) |

> **공공데이터 출처 기입은 필수** (공모 요강) — 본 README와 결과 페이지 하단 "이 추천에 활용된 데이터" 섹션에 전부 명시되어 있습니다.

### 5.4 데이터 획득·결합 방식

1. **REST 호출**: 대부분의 공공데이터포털 API는 `serviceKey` 쿼리 파라미터 방식. 인증키는 `.env` → `frontend/src/config/apiKeys.ts` 로 주입 (빌드 타임 번들링, `.gitignore` 로 보호)
2. **CORS 우회**: 웹 dev 환경에서는 Vite 프록시(`/proxy-apis-data-go-kr` 등), 모바일 APK에서는 `@capacitor/core`의 `CapacitorHttp` 로 네이티브 HTTP 호출하여 CORS 제약 회피
3. **결합 로직**: 각 데이터는 `src/external/*Api.ts` 에서 단일 파싱 함수로 정규화 → `src/lib/*.ts` (optimizer, tripRecommender, transitCongestion, waitTimeModel) 에서 조합

### 5.5 획득 지속성

- 모든 필수 3종은 **전국 통합개방데이터 포털**에 2025년 기준 **24시간 공개** 중 (주최사 제공)
- 인증키 만료 시 재발급 절차가 표준화되어 있어 유지보수 부담 낮음
- 폴백 체계: 실시간 API 장애 시 **거리 기반 추정·mock 데이터**로 자동 전환하여 서비스 중단 없음

---

## 6. 기술 스택 및 시스템 아키텍처

### 6.1 기술 스택

| 레이어 | 기술 | 근거 |
|---|---|---|
| UI 프레임워크 | React 18 + TypeScript 5 | 풍부한 생태계, 타입 안정성 |
| 빌드 도구 | Vite 6 | 빠른 HMR, 프록시 내장 |
| 스타일 | Tailwind CSS 3 | 빠른 프로토타이핑, 일관된 디자인 시스템 |
| 모바일 | Capacitor 8 (Android APK) | 단일 코드베이스로 웹 + APK 동시 배포 |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) | 저비용·저지연, 한국어 품질 우수 |
| 지도 | Kakao Maps JavaScript SDK | 국내 POI/주소 품질 최상 |
| 백엔드(선택) | FastAPI 0.115 + Pydantic 2 + httpx | 타입 안전한 REST, 비동기 I/O. 현재는 참조 구현 / 백업 경로 |
| 데이터 처리 | TypeScript 포팅 (브라우저 실행) | 백엔드 없이 완전 로컬 모드 가능 |

### 6.2 아키텍처 — "완전 로컬 모드" 듀얼 구조

```
┌────────────────────────────────────────────────────────────────┐
│                     Android APK / 웹 브라우저                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  React (pages / components / contexts)                  │   │
│  └──────┬──────────────────────────────────────────────────┘   │
│         │                                                      │
│  ┌──────┴──────────────────────────────────────────────────┐   │
│  │  src/utils/api.ts   ←── 통합 Facade (과거: 백엔드 호출) │   │
│  └──────┬──────────────────────────────────────────────────┘   │
│         │                                                      │
│  ┌──────┴────────────┐   ┌──────────────────────────────────┐  │
│  │  src/lib/*.ts     │   │  src/external/*.ts              │  │
│  │  비즈니스 로직     │←─│  외부 API 클라이언트              │  │
│  │  (TSP·LLM·Score)  │   │  (Kakao/Gemini/공공데이터)       │  │
│  └──────┬────────────┘   └──────────┬───────────────────────┘  │
│         │                            │                         │
└─────────┼────────────────────────────┼─────────────────────────┘
          │                            │
          │                            │  CapacitorHttp / Vite Proxy
          │                            ▼
          │     ┌──────────────────────────────────────┐
          │     │  공공데이터포털 · Kakao · Google AI   │
          │     └──────────────────────────────────────┘
          │
          │ (선택적 백업 경로)
          ▼
    ┌─────────────────────┐
    │  FastAPI 백엔드      │  ← 레거시/데모 검증용
    │  backend/app        │    (동일 로직을 Python 재구현)
    └─────────────────────┘
```

**핵심 포인트**: 모든 비즈니스 로직(TSP 최적화, LLM 파싱, 혼잡도 산정, 주차장 점수화)이 **두 번 구현**되어 있음.
- `backend/app/services/*.py`  — 초기 개발·검증용 (FastAPI)
- `frontend/src/lib/*.ts`  — 실제 빌드·배포용 (브라우저/APK)

→ **서버 운영 비용 0원** 이 가능하고, **사용자 데이터가 제3자 서버를 거치지 않음**.

### 6.3 레이어 상세

| 디렉토리 | 역할 | 대표 파일 |
|---|---|---|
| `frontend/src/pages/` | 페이지 단위 | `LandingPage.tsx` (랜딩+챗봇), `BusinessTripPage.tsx` (출장), `ErrandSelectPage.tsx` (용무 선택), `DateSelectPage.tsx` (모드2 날짜), `ResultPage.tsx` (결과 타임라인+지도), `LoadingPage.tsx` |
| `frontend/src/components/` | 재사용 UI | `KakaoMap`, `TripRouteMap`, `Timeline`, `TripTimeline`, `TripPlanCard`, `RecommendationCard`, `ParkingList`, `TransitHubCard`, `CongestionGauge`, `CongestionChart`, `NotificationSettings`, `LocationPicker`, `OneClickConfirmModal` |
| `frontend/src/lib/` | **비즈니스 로직 (TS 포팅)** | `optimizer.ts` (TSP·슬롯), `tripRecommender.ts` (출장 플래너), `llmService.ts` (Gemini), `facilityFinder.ts` (시설 해석), `waitTimeModel.ts` (대기시간 모델), `transitCongestion.ts` (혼잡도), `oneclickService.ts`, `cityCode.ts`, `backButtonStack.ts`, `httpClient.ts` |
| `frontend/src/external/` | 외부 API 클라이언트 | `kakaoApi.ts`, `publicDataApi.ts`, `parkingApi.ts`, `railApi.ts`, `busTerminalApi.ts`, `geminiApi.ts` |
| `frontend/src/contexts/` | 전역 상태 | `LocationContext.tsx` (사용자 위치 + localStorage) |
| `frontend/src/hooks/` | 공통 훅 | `useNotification.ts` (Capacitor Local Notifications) |
| `frontend/src/config/` | 설정(비커밋) | `apiKeys.ts` (`.gitignore`로 보호) |
| `backend/app/` | 참조 구현 | `api/routes.py`, `services/*.py`, `external/*.py`, `models/schemas.py` |

---

## 7. 주요 알고리즘 · 기술 상세

### 7.1 TSP 전수탐색 기반 방문 순서 최적화

파일: `frontend/src/lib/optimizer.ts` — 함수 `findOptimalOrder`

- 사용자가 선택한 시설이 n개일 때 n! 순열 전수 탐색 (n ≤ 3 이므로 최대 6 경로 — 실시간 처리 가능)
- 각 경로 비용 = Σ(이동시간 + 대기시간 + 처리시간)
- 이동시간은 **카카오 Navi API** 로 실측, 실패 시 haversine × 1.4(도로율) ÷ 30km/h 로 추정
- 대기시간은 요일·시간대·월중 날짜에 따라 **가중치 모델**로 계산 (`waitTimeModel.ts`)

### 7.2 대기시간 모델 (`waitTimeModel.ts`)

한국은행 금융기관 이용 통계·행정안전부 민원처리시간 통계·우정사업본부 우편물 처리 통계 등 **공식 통계 자료**를 바탕으로 한 경험적 수식:

```
민원실 대기(분) = base(8) + 월말가중(6) + 요일가중(월·금 +5) + 시간가중(10~11시, 13~14시 +4)
은행   대기(분) = base(12) + 월초월말가중(10) + 요일가중(월·금 +6) + 점심시간(11:30~13:00 +8)
우체국 대기(분) = base(6) + 요일가중(월·금 +3) + 퇴근시간(16~18시 +5)
```

> 실시간 API(B551982/cso_v2)가 **실제 대기 인원**을 제공하는 경우 이를 우선 사용하고, 해당 시설·시점에 데이터가 없으면 위 수식 폴백.

### 7.3 슬롯 시뮬레이션 (`recommendBestSlots`)

```
for (weeks × 주간 평일)       // 최대 20일
  for (오전반차, 오후반차, 연차) // 3 유형
    for (n! 방문 순서)         // 최대 6
      simulate → 총 소요 + 페널티 점수
→ 상위 3개 + 최하 1개 (비추천) 반환
```

- **날씨 페널티**: 비 예보 시 모든 이동시간 × 1.2 + 점수 +5 페널티
- **시간 초과 페널티**: 사용자가 지정한 `start_time ~ end_time` 을 초과하면 분당 10점 페널티
- **날짜 캐시**: 같은 날짜의 날씨는 Map 캐시로 API 호출 1회만

### 7.4 출장 플랜 점수화 (`tripRecommender.ts`)

```
base  = max(0, 100 - (total_duration_min - 60) × 100/180)
+ 주차 가용도 보정 (+10 여유 ~ -15 만차)
+ 실시간 시간표 보정 (+5)
+ 허브 접근 거리 보정 (차량 모드만, 2km 이내 +10)
+ 주차장 도보 5분 이내 (+5)
```

- `access_mode === 'transit'` (대중교통 모드) 일 때는 주차장 점수를 제외하고 거리 페널티도 적용하지 않음
- 0~100점으로 clamp

### 7.5 허브 혼잡도 지표 (`transitCongestion.ts`)

출장 모드 기차역/터미널 탭에서 카드 탭 시 실시간 산정:

| 지표 | 데이터 출처 | 가중치 |
|---|---|---|
| 시간대 (출퇴근 ±) | 현재 시각 | 25% |
| 요일 (주말·월·금) | 현재 요일 | 15% |
| 공휴일 여부 | 천문연 특일정보 | 10% |
| 보행자 신호 평균 대기 | 교통안전 신호등 API | 20% |
| 초정밀 버스 좌석 잔여율 | 초정밀 버스 API | 30% |

→ 0~100점 → "여유 / 보통 / 혼잡" 3단계 라벨

### 7.6 통합 AI 상담사 (`llmService.ts` + `api.ts::sendConsultantMessage`)

- **단일 LLM 호출**로 아래를 전부 추출:
  - `intent`: `half_day` | `business_trip` | `none`
  - `parsed_errands`: 10종 용무 매핑 (예: "통장 만들기" → "통장 개설")
  - `time_constraint`: `{start_time, end_time, date, start_date}`
  - `trip_fields`: `{destination, date, earliest_departure, parking_preference, modes, access_mode}`
  - `should_recommend`: 바로 추천할지 여부
- **날짜 변환표 주입**: 시스템 프롬프트에 오늘부터 다음주까지의 `요일=YYYY-MM-DD` 매핑을 하드코딩 주입하여 LLM의 상대날짜 환각 방지
- **운영시간 검증**: 주말·공휴일·영업시간 외 요청이면 `should_recommend=false` 로 강제하고 가까운 평일 대안을 `text` 에 생성
- **모델 폴백**: `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.0-flash` 순차 시도 (429 대응)
- **은행 게이트**: LLM 응답이 `should_recommend=true` 여도 은행 용무에 `selected_facility` 가 없으면 **추천을 가로채서** 근처 은행 6개 카드를 대신 응답으로 반환. 사용자가 카드를 고르면 LLM을 우회하고 즉시 재추천 실행 (비용·지연 절감).

### 7.7 기타 기술 포인트

- **ES Module ISO**: 웹과 네이티브 APK가 동일한 TS 모듈 실행. `httpClient.ts` 가 `Capacitor.isNativePlatform()` 으로 분기
- **뒤로가기 스택**: Android 하드웨어 뒤로가기 버튼에 대해 `backButtonStack.ts` 로 컴포넌트 레벨 우선권 제어 (모달 열림 → 모달만 닫기, 아니면 페이지 단계 이동)
- **로컬 알림**: 반차 당일 출발 10분 전 `@capacitor/local-notifications` 로 푸시
- **localStorage**: 사용자 위치, 알림 설정 지속화. 서버 저장 없음

---

## 8. AI 활용 (가점 대상)

> 공모 가점 항목 **"AI 모델(LLM, 알고리즘 등)을 활용한 기능 구현"** (최대 10점)

### 8.1 활용 AI 모델

| 모델 | 제공처 | 역할 |
|---|---|---|
| **Gemini 2.5 Flash** | Google AI | 메인 — 자연어 의도 감지 + 필드 추출 |
| Gemini 2.5 Flash Lite | Google AI | 폴백 1 (429 쿼터 초과 시) |
| Gemini 2.0 Flash | Google AI | 폴백 2 |

### 8.2 AI가 수행하는 작업

1. **자연어 → 구조화된 요청 변환**
   - 입력: "내일 오전에 통장 개설 하고 등본도 떼야 해"
   - 출력: `{intent: "half_day", parsed_errands: [{task_name: "통장 개설", ...}, {task_name: "주민등록등본 발급", ...}], time_constraint: {start_time: "09:00", end_time: "12:00", date: "2026-04-09"}, should_recommend: true}`

2. **의도 자동 분기**
   - "출장", "KTX", "부산" → 출장 모드
   - "통장", "여권", "등본" → 반차 모드
   - 모호한 경우 `intent: none` 으로 되묻기

3. **시간/날짜 상대 표현 해석**
   - "다음 주 수요일", "모레", "이번 주 금요일 이후" → `YYYY-MM-DD`
   - 시스템 프롬프트에 **주 2회분 날짜 변환표** 주입으로 환각 방지

4. **운영시간·휴무일 사전 검증**
   - "이번 주 일요일에 등본 떼야 해" → 일요일 휴무 안내 + "월요일(4/13) 대안"

5. **출장 필드 추출**
   - "차 두고 기차로 부산" → `access_mode: "transit", modes: ["train"], destination: "부산"`

6. **추천 이유 자연어 생성** (선택적 보강)
   - 슬롯 점수만으로는 "왜 좋은지" 설명이 어렵기 때문에, 시뮬레이션 결과를 LLM에 다시 넘겨 2~3문장 설명문 생성 (`generate_recommendation_reason`)

### 8.3 프롬프트 엔지니어링 기법

- **JSON 스키마 강제**: `[응답 형식] 반드시 아래 JSON만 출력` 지시 + `extractJson` 헬퍼로 ```` ```json ```` 블록 제거
- **날짜 변환표 주입**: 오늘~다음주의 모든 `요일=YYYY-MM-DD` 를 프롬프트에 포함 (상대날짜 환각 방지)
- **역할·운영시간·매핑 규칙**을 구조화된 섹션으로 분리 (LLM이 섹션 단위로 참조)
- **출력 검증**: 파싱 후 `task_name` 이 허용 목록에 있는지, 시간이 09~18시 범위인지, `access_mode` 가 `drive`/`transit` 인지 재검증

---

## 9. 사용 흐름 (입력 → 처리 → 출력)

### 9.1 시나리오 A — AI 상담사로 반차 찾기

```
사용자 입력:  "다음 주 오전에 통장 개설하고 등본도 떼야해"
   │
   ▼
[1] LandingPage 챗봇에 텍스트 전송
   │
   ▼
[2] sendConsultantMessage (utils/api.ts)
   │ ─ unifiedConsultantChat (lib/llmService.ts) → Gemini 호출
   │    └ intent=half_day, parsed_errands=[통장 개설, 등본 발급],
   │      time_constraint={start:09:00,end:12:00, start_date:2026-04-13},
   │      should_recommend=true
   │
   ▼
[3] 은행 게이트 발동
   │ ─ 은행 용무 있는데 selected_facility 없음 → 추천 차단
   │ ─ fetchNearbyBanks(userLat, userLng) → 6개 은행 후보
   │
   ▼
[4] 챗봇에 "은행 선택 카드" 메시지 표시
   │
   ▼ (사용자가 BNK경남은행 울산시청지점 클릭)
   │
[5] handleSelectBank (LandingPage)
   │ ─ sessionErrands[은행].selected_facility = 해당 은행 풀세트
   │ ─ fetchRecommendation(updatedErrands, lat, lng, tc) 직접 호출 (LLM 우회)
   │
   ▼
[6] recommendBestSlots (lib/optimizer.ts)
   │ ─ resolveFacilitiesForTypes (민원실만 자동 검색, 은행은 사용자 선택 사용)
   │ ─ buildTravelMatrix (Kakao Navi API 병렬 호출)
   │ ─ simulateSlot × 20평일 × 3반차 유형
   │   └ for each: 대기시간 모델 + 날씨 API + TSP 순서
   │
   ▼
[7] 상위 3개 슬롯 + 비추천 1개 → 챗봇 메시지에 추천 카드 추가
   │
   ▼
[8] 사용자가 "상세 결과 보기" 클릭 → ResultPage
   │ ─ Timeline (방문 순서)
   │ ─ KakaoMap (카카오 내비 실경로 폴리라인)
   │ ─ CongestionChart (요일별 혼잡도 비교)
   │ ─ 원클릭 서비스 카드 (DEMO)
   │ ─ "알람 설정" → @capacitor/local-notifications
```

### 9.2 시나리오 B — 폼으로 출장 플랜 (대중교통 모드)

```
사용자:
  목적지 = "부산"
  날짜 = 2026-04-15
  출발 시각 = 09:00
  허브 접근 수단 = 대중교통 (🚇)
  교통수단 = 기차 + 고속버스 (둘 다)
   │
   ▼
BusinessTripPage.handleTripSubmit → fetchTripRecommend(req)
   │
   ▼
recommendTrip (lib/tripRecommender.ts)
   │ [1] Kakao Geocode → 부산 좌표
   │ [2] 출발지 주변 기차역 Top 3 + 터미널 Top 2
   │ [3] 부산 주변 대표 기차역 1 + 터미널 1
   │ [4] 각 (출발, 도착, 수단) 조합에 대해:
   │     ├ TAGO 실시간 시간표 시도 → 실패 시 거리 추정
   │     └ access_mode='transit' → 주차장 스킵,
   │        estimateTransitMinutes(distKm) 로 허브 접근시간 계산
   │ [5] 0~100점 scorePlan, buildReasons
   │ [6] 상위 5개 반환
   │
   ▼
출력:
   - 플랜 카드 5개 (각 카드: 🚇 대중교통 이동 + 🚄 탑승 + 도착 시각)
   - 선택한 플랜의 TripTimeline + TripRouteMap
```

---

## 10. 화면별 설명

| 화면 | 파일 | 주요 기능 |
|---|---|---|
| **랜딩** | `LandingPage.tsx` | 히어로, AI 상담사 챗봇, 반차/출장 모드 카드, 작동 원리, 활용 데이터 출처 |
| **용무 선택** (반차) | `ErrandSelectPage.tsx` | 10종 용무 체크박스, 은행 용무 선택 시 근처 은행 지점 선택 모달, 총 처리시간 요약 |
| **날짜 선택** (반차 모드2) | `DateSelectPage.tsx` | 캘린더 + 반차 유형 라디오 |
| **로딩** | `LoadingPage.tsx` | 시뮬레이션 진행 중 애니메이션 |
| **결과** (반차) | `ResultPage.tsx` | 추천 카드 3개 + 비추천 1개, 타임라인, 카카오 경로 지도, 혼잡도 차트, 원클릭 서비스 배너, 알람 설정 |
| **출장** | `BusinessTripPage.tsx` | 탭 4개 (여행 계획 / 주차장 / 기차역 / 터미널), 플랜 폼, 플랜 카드, 플랜 타임라인, 경로 지도 |

---

## 11. 디렉토리 구조

```
National_Integrated_Data_Utilization_Contest/
├─ README.md                ← 이 파일
├─ .env.example             ← 인증키 템플릿
├─ .env                     ← 실제 인증키 (gitignore)
│
├─ frontend/                ← 실제 빌드·배포 대상
│  ├─ package.json
│  ├─ vite.config.ts        ← 웹 dev 프록시 설정
│  ├─ capacitor.config.ts   ← Android 빌드 설정
│  ├─ tailwind.config.js
│  ├─ index.html            ← 카카오맵 SDK 포함
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx            ← 단계 라우팅 (step state)
│     ├─ index.css
│     ├─ config/
│     │  └─ apiKeys.ts      ← 인증키 주입 (gitignore)
│     ├─ contexts/
│     │  └─ LocationContext.tsx
│     ├─ hooks/
│     │  └─ useNotification.ts
│     ├─ pages/
│     │  ├─ LandingPage.tsx
│     │  ├─ ErrandSelectPage.tsx
│     │  ├─ DateSelectPage.tsx
│     │  ├─ LoadingPage.tsx
│     │  ├─ ResultPage.tsx
│     │  └─ BusinessTripPage.tsx
│     ├─ components/        ← 재사용 UI (17개)
│     ├─ lib/               ← 비즈니스 로직 (TS 포팅, 10개)
│     │  ├─ optimizer.ts
│     │  ├─ tripRecommender.ts
│     │  ├─ llmService.ts
│     │  ├─ facilityFinder.ts
│     │  ├─ waitTimeModel.ts
│     │  ├─ transitCongestion.ts
│     │  ├─ oneclickService.ts
│     │  ├─ cityCode.ts
│     │  ├─ backButtonStack.ts
│     │  └─ httpClient.ts
│     ├─ external/          ← 외부 API 클라이언트 (6개)
│     │  ├─ kakaoApi.ts
│     │  ├─ publicDataApi.ts
│     │  ├─ parkingApi.ts
│     │  ├─ railApi.ts
│     │  ├─ busTerminalApi.ts
│     │  └─ geminiApi.ts
│     ├─ types/
│     │  └─ index.ts        ← 전역 타입 정의
│     └─ utils/
│        └─ api.ts          ← 통합 Facade
│
└─ backend/                 ← 참조 구현 (레거시/데모 검증용)
   ├─ requirements.txt
   ├─ main.py
   └─ app/
      ├─ api/routes.py
      ├─ services/          ← 동일 로직 Python 재구현
      ├─ external/
      └─ models/schemas.py
```

---

## 12. 실행 방법 (로컬·모바일)

### 12.1 사전 준비

1. **Node.js 18+** (프론트엔드)
2. **Python 3.10+** (백엔드는 선택 — 안 돌려도 됨)
3. **API 키 발급** (모두 무료)
   - 공공데이터포털 `DATA_GO_KR_API_KEY` — https://www.data.go.kr
   - 카카오 REST API 키 `KAKAO_REST_API_KEY` — https://developers.kakao.com
   - 카카오 JavaScript 키 `KAKAO_MAP_API_KEY` (선택) — 지도 렌더용
   - 서울 열린데이터광장 `SEOUL_OPENDATA_API_KEY` — https://data.seoul.go.kr
   - Google Gemini `GEMINI_API_KEY` — https://aistudio.google.com/apikey

### 12.2 환경 변수 세팅

```bash
# 프로젝트 루트에서
cp .env.example .env
# .env 파일을 열어 위 5개 키를 채움
```

그런 다음 **프론트엔드에 키를 주입**하려면 `frontend/src/config/apiKeys.ts` 파일을 만듭니다(`.gitignore`로 보호됨):

```typescript
export interface ApiKeys {
  KAKAO_REST: string
  DATA_GO_KR: string
  SEOUL_OPENDATA: string
  GEMINI: string
}

export const API_KEYS: ApiKeys = {
  KAKAO_REST: '...',       // .env의 KAKAO_REST_API_KEY
  DATA_GO_KR: '...',       // .env의 DATA_GO_KR_API_KEY
  SEOUL_OPENDATA: '...',   // .env의 SEOUL_OPENDATA_API_KEY
  GEMINI: '...',           // .env의 GEMINI_API_KEY
}

export const DEFAULT_WEATHER_GRID: { nx: number; ny: number } = {
  nx: 60,
  ny: 127,  // 서울 격자 (향후 사용자 좌표 → 격자 변환 예정)
}
```

`frontend/index.html` 의 `dapi.kakao.com/v2/maps/sdk.js?appkey=...` 에도 카카오 JavaScript 키를 넣어야 지도가 렌더됩니다.

### 12.3 프론트엔드 실행 (웹 데모)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 12.4 프론트엔드 프로덕션 빌드

```bash
cd frontend
npm run build
# → frontend/dist/ 에 정적 파일 생성
```

### 12.5 Android APK 빌드 (Capacitor)

```bash
cd frontend
npm run build
npx cap add android      # 최초 1회
npx cap sync android
npx cap open android     # Android Studio 열기 → Build → Generate Signed Bundle/APK
```

### 12.6 백엔드 (선택, 참조용)

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000/docs (Swagger UI)
```

### 12.7 데모 시나리오 (심사용 주요 기능 흐름)

**반차 모드 시연**
1. 랜딩에서 챗봇에 `"다음 주 수요일 통장 개설 추천해줘"` 입력
2. 은행 선택 카드가 뜨면 하나 클릭
3. 추천 카드 3개 확인 → "상세 결과 보기" 클릭
4. 결과 페이지에서 타임라인 + 지도 확인

**출장 모드 시연**
1. 랜딩에서 "출장 모드 시작" 클릭
2. "여행 계획" 탭에서 목적지 `부산`, 날짜 미래 일자, 허브 접근 수단 `🚇 대중교통` 선택
3. "추천 받기" 클릭 → 5개 플랜 카드 확인
4. 플랜 카드 하나 클릭 → 타임라인 + 카카오 지도 확인

**AI 상담사 출장 시연**
1. 랜딩 챗봇에 `"다음 주 수요일 부산 출장 기차로, 차 두고 지하철로 갈래요"` 입력
2. 자동으로 `destination=부산, date=..., modes=[train], access_mode=transit` 파싱
3. 출장 플랜 카드 메시지로 표시

---

## 13. 기대 효과

### 13.1 국민 편익 (심사 기준 3 — 20점)

| 지표 | 기대 절감 |
|---|---|
| 반차 1회당 낭비 시간 | 기존 평균 약 3시간 → 본 서비스 이용 시 약 1시간대로 단축 (이동·대기 최적화) |
| 출장 주차 실패율 | 기차역 주변 만차로 인한 재주차·지각 리스크 대폭 감소 (실시간 가용 정보) |
| 정보 탐색 시간 | 최소 5개 앱(민원24·카카오맵·은행앱·코레일톡·주차장 앱)을 오가야 하던 과정을 1개 앱으로 통합 |
| 반차·연차 소진 | 반나절로 3건 처리 가능 → 연차 보존 효과 |

### 13.2 파급 효과

- **지자체 확산성**: 울산 남구 기본 좌표로 개발했지만, 카카오 Local 기반 전국 모든 시·군·구에서 즉시 동작
- **데이터 가치 증대**: 공공데이터포털의 3종 필수 데이터를 LLM과 결합해 "**원시 데이터 → 의사결정**"으로 변환하는 레퍼런스 사례
- **취약계층 확장**: 향후 교통약자 이동지원 데이터(7종 중 2번)를 결합하면 장애인·고령자 대리 방문 코디네이션 가능

### 13.3 사회적 가치

- **탄소 저감**: 이동 최적화로 불필요한 차량 운행 감소
- **일자리**: 서비스 운영(데이터 큐레이션, 고객 지원, 추천 품질 개선) 직군 창출 여지
- **상생 협력**: 민관 데이터(카카오) + 공공데이터의 결합 모범 사례

---

## 14. 향후 고도화 계획

> 심사 기준 5 — 지속가능성 (10점)

### 14.1 단기 (3개월 내)

- [ ] **사용자 좌표 → 기상청 격자 변환**: 현재 서울 격자(60,127) 하드코딩 → 좌표 기반 동적 변환
- [ ] **iOS 지원**: Capacitor iOS 추가 빌드
- [ ] **카카오 대중교통 길찾기 API**: 현재는 거리 기반 추정 → 실제 지하철·버스 경로 적용
- [ ] **Push 알림 서버**: 반차 당일 알림을 로컬에서 FCM으로 확장 (외출 중에도 수신)
- [ ] **음성 입력**: Web Speech API로 챗봇 음성 질의

### 14.2 중기 (6개월 내)

- [ ] **원클릭 서비스 실제화**: 정부24 연계 원스톱 민원 API (현재 mock) → 실제 서류 자동 발급
- [ ] **은행 지점별 대기 데이터**: 주요 시중은행 오픈뱅킹 API 연동으로 지점별 실시간 대기 반영
- [ ] **교통약자 이동지원 결합**: 7종 데이터 2번 추가 활용 → 휠체어 접근 가능 경로
- [ ] **사용 이력 기반 추천**: 과거 방문 기록 학습(온디바이스) → 개인화 가중치

### 14.3 장기

- [ ] **다국어**: 영어·중국어·베트남어 → 외국인 근로자 민원 지원
- [ ] **지자체 민원 키오스크 탑재**: 공공 키오스크에 PWA로 탑재, 고령자 대상 음성 안내
- [ ] **B2B**: 기업 HR 시스템 연동(관공서 업무 반차 사전 승인 API)

### 14.4 서비스 유지 전략

- **완전 로컬 모드**로 서버 운영 비용이 거의 0원 — 유지보수 부담이 작음
- 인증키 만료 대응이 표준화 → 한 달에 한 번 점검으로 충분
- 오픈소스 공개 시 커뮤니티 기여 가능 구조 (명확한 `lib/`·`external/` 레이어 분리)

---

## 15. 라이선스 · 저작권 · 데이터 출처

### 15.1 개발 결과물의 저작권

- 본 결과물의 저작권은 공모전 참가팀에게 귀속 (공고문 준수)
- 수상 시 공공데이터포털 등에 **비영리·공익적 홍보 목적**의 활용 사례로 게재될 수 있음을 동의

### 15.2 사용된 외부 자산의 출처 (필수 기입)

| 분류 | 이름 | 제공 기관 | 라이선스 |
|---|---|---|---|
| 필수 공공데이터 | 민원실 이용 현황 실시간 정보 (2종) | 행정안전부 / 공공데이터포털 | 공공누리 |
| 필수 공공데이터 | 초정밀 버스 실시간 위치 정보 (3종) | 국토교통부 / 공공데이터포털 | 공공누리 |
| 필수 공공데이터 | 교통안전 실시간 신호등 정보 (2종) | 경찰청 / 공공데이터포털 | 공공누리 |
| 추가 공공데이터 | 전국주차장 표준데이터 | 국토교통부 | 공공누리 |
| 추가 공공데이터 | 공영주차장 실시간 정보 | 서울 열린데이터광장 | 서울특별시 공공데이터 이용약관 |
| 추가 공공데이터 | 기상청 단기예보 | 기상청 | 공공누리 |
| 추가 공공데이터 | 한국천문연구원 특일정보 | 한국천문연구원 | 공공누리 |
| 추가 공공데이터 | TAGO 열차·고속버스 정보 | 국토교통부 | 공공누리 |
| 민간 API | 카카오 Local · Navi · Maps | 카카오 | 카카오 디벨로퍼스 이용약관 |
| 민간 AI | Google Gemini | Google | Google AI Terms of Service |

> 모든 API는 **정식 발급받은 인증키**로 호출되며, 본 결과물은 API 제공자의 이용약관 범위 내에서만 사용됩니다.

### 15.3 오픈소스 의존성 (주요)

- React (MIT), Vite (MIT), TypeScript (Apache 2.0), Tailwind CSS (MIT)
- Capacitor (MIT), `@google/generative-ai` (Apache 2.0)
- FastAPI (MIT), Pydantic (MIT), httpx (BSD-3)

### 15.4 개인정보 처리

- 사용자 위치·알림 설정은 **localStorage** 에만 저장되며, **제3자 서버로 전송되지 않음**
- 챗봇 대화 내용은 **Google Gemini** 에 전달되어 응답 생성에만 사용 (Google의 데이터 정책에 따름)
- 서버리스 아키텍처로 **앱 제공자가 사용자 데이터를 수집·보관하지 않음**

---

## 부록 A — 기획서 [붙임4] 항목 대응표

보고서 작성자가 서비스 개발 기획서를 작성할 때 본 README의 어느 섹션을 참조하면 되는지 매핑:

| 기획서 항목 | 참조할 README 섹션 |
|---|---|
| 1) 개발 결과물 개요 | §1, §2.2 |
| 2-1) 서비스 목적·배경 | §2 |
| 2-2) 핵심 기술·기능·구성·특징 | §3, §6, §7, §9 |
| 3) 기존 서비스와 차별성·독창성 | §4 |
| 4-1) 활용 공공데이터 출처·내용·획득 | §5.1, §5.2, §5.4, §15.2 |
| 4-2) 타 기관·민간 데이터 출처·내용 | §5.3 |
| 4-3) 공공데이터 획득 지속성·활용범위 | §5.5 |
| 5-1) 활용한 주요 기술 | §6, §7 |
| 5-2) 완성도·실제 구현 가능성 | §3 (완성된 기능), §9 (흐름), §12 (실행법) |
| 6) 기대 효과 (사회적 가치·파급) | §13 |
| (가점) AI 활용 | §8 |
| (심사 기준 5) 지속가능성 | §14 |

---

## 부록 B — 평가 지표별 강조 포인트 (심사 대비)

| 심사 지표 | 배점 | 본 프로젝트 강점 |
|---|---|---|
| **1. 참신성** (기존 차별성·독창성) | 30 | §4 — "최적 날짜 찾기" 역발상, LLM×공공데이터 하이브리드, 완전 로컬 모드(서버리스) |
| **2. 공공데이터 활용성** | 25 | §5 — 7종 중 **3종 활용**, 추가로 국토부·서울·기상청·천문연 결합, 출처 전부 명기 |
| **3. 국민편익 및 파급력** | 20 | §13 — 반차·출장 시간 단축, 전국 범위 확장성, 취약계층 확장 계획 |
| **4. 구현 및 실현가능성** | 15 | §9 (입→처리→출 완결), §12 (실제 빌드·APK 가능), 웹 데모 URL·APK 첨부 |
| **5. 지속가능성** | 10 | §14 — 3·6개월·장기 로드맵, 서버리스로 유지비 최소 |
| **(가점) AI 활용** | 10 | §8 — Gemini 2.5 Flash, 프롬프트 엔지니어링, 멀티모델 폴백, 검증·게이트 설계 |

---

## 문의

- **프로젝트 리포지토리**: https://https://github.com/Lahecka051/National_Integrated_Data_Utilization_Contest
- **데모 URL**: (배포 후 추가)
- **APK 다운로드**: (릴리즈 후 추가)
- **팀 연락처**: (참가신청서 [붙임1] 참조)
