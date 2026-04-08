from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = None
db = None

async def get_db():
    return db

async def init_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db_name = settings.MONGODB_URI.rsplit("/", 1)[-1].split("?")[0] or "school_fees"
    db = client[db_name]
    await db.users.create_index("email", unique=True)
    await db.students.create_index("admission_number", unique=True)
    await db.students.create_index("phone")
    await db.payments.create_index("receipt_number", unique=True)
    await db.fee_structures.create_index(
        [("class_name", 1), ("fee_type", 1), ("academic_year", 1)], unique=True
    )
    # Seed default settings
    if not await db.settings.find_one({"key": "app_name"}):
        await db.settings.insert_many([
            {"key": "app_name", "value": "FeeFlow"},
            {"key": "org_name", "value": "FeeFlow Organization"},
            {"key": "school_name", "value": "FeeFlow Public School"},
            {"key": "school_address", "value": "123 Education Lane, New Delhi - 110001"},
            {"key": "academic_year", "value": "2024-25"},
            {"key": "late_fee_per_day", "value": "10"},
        ])
    # Seed classes
    if await db.classes.count_documents({}) == 0:
        await db.classes.insert_many([{"name": str(i)} for i in range(1, 11)])

    # Email settings defaults
    email_defaults = [
        {"key": "smtp_host", "value": ""},
        {"key": "smtp_port", "value": "587"},
        {"key": "smtp_user", "value": ""},
        {"key": "smtp_pass", "value": ""},
        {"key": "smtp_from", "value": ""},
        {"key": "email_verification_enabled", "value": "true"},
        {"key": "email_welcome_enabled", "value": "true"},
        {"key": "email_password_reset_enabled", "value": "true"},
        {"key": "email_password_changed_enabled", "value": "true"},
        {"key": "require_email_verification", "value": "false"},
    ]
    for d in email_defaults:
        await db.settings.update_one({"key": d["key"]}, {"$setOnInsert": d}, upsert=True)

