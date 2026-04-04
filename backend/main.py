from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv
from app.api.routes import router

# 프로젝트 루트의 .env 로드 (backend/ 상위 디렉토리)
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)
load_dotenv()  # 현재 디렉토리도 fallback

app = FastAPI(
    title="하루짜기 DayPlanner API",
    description="직장인 반차/연차 최적화 서비스",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {"service": "하루짜기 DayPlanner", "status": "running"}
