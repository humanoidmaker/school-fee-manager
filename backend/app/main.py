from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import init_db
from app.api import auth, settings as settings_api
from app.api import students, fee_structures, payments

@asynccontextmanager
async def lifespan(a):
    await init_db()
    yield

app = FastAPI(title="FeeFlow API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(settings_api.router)
app.include_router(students.router)
app.include_router(fee_structures.router)
app.include_router(payments.router)

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "FeeFlow"}

@app.get("/api/stats")
async def stats():
    from app.core.database import get_db as gdb
    from datetime import datetime, timezone
    db = await gdb()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    total_students = await db.students.count_documents({})
    total_payments = await db.payments.count_documents({})
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    today_result = await db.payments.aggregate(today_pipeline).to_list(1)
    today_collection = today_result[0]["total"] if today_result else 0
    total_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    total_result = await db.payments.aggregate(total_pipeline).to_list(1)
    total_collection = total_result[0]["total"] if total_result else 0
    return {
        "stats": {
            "total_students": total_students,
            "total_payments": total_payments,
            "today_collection": today_collection,
            "total_collection": total_collection,
        }
    }
