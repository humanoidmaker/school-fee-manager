from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db
from app.utils.auth import require_admin
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter(prefix="/api/students", tags=["students"])

def ser(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc

@router.get("/")
async def list_students(q: str = "", class_name: str = "", db=Depends(get_db)):
    filt = {}
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"admission_number": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    if class_name:
        filt["class_name"] = class_name
    docs = await db.students.find(filt).sort("name", 1).to_list(500)
    return {"success": True, "students": [ser(d) for d in docs]}

@router.post("/")
async def create_student(data: dict, user=Depends(require_admin), db=Depends(get_db)):
    if await db.students.find_one({"admission_number": data["admission_number"]}):
        raise HTTPException(400, "Admission number already exists")
    doc = {
        "name": data["name"],
        "admission_number": data["admission_number"],
        "class_name": data["class_name"],
        "section": data.get("section", "A"),
        "father_name": data.get("father_name", ""),
        "mother_name": data.get("mother_name", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "address": data.get("address", ""),
        "date_of_birth": data.get("date_of_birth", ""),
        "gender": data.get("gender", ""),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    r = await db.students.insert_one(doc)
    doc["id"] = str(r.inserted_id)
    return {"success": True, "student": doc}

@router.get("/search")
async def search_students(q: str = "", db=Depends(get_db)):
    if not q:
        return {"success": True, "students": []}
    filt = {"$or": [
        {"name": {"$regex": q, "$options": "i"}},
        {"admission_number": {"$regex": q, "$options": "i"}},
        {"phone": {"$regex": q, "$options": "i"}},
    ]}
    docs = await db.students.find(filt).sort("name", 1).to_list(20)
    return {"success": True, "students": [ser(d) for d in docs]}

@router.get("/by-class/{class_name}")
async def students_by_class(class_name: str, db=Depends(get_db)):
    docs = await db.students.find({"class_name": class_name}).sort("name", 1).to_list(200)
    return {"success": True, "students": [ser(d) for d in docs]}

@router.get("/{student_id}")
async def get_student(student_id: str, db=Depends(get_db)):
    doc = await db.students.find_one({"_id": ObjectId(student_id)})
    if not doc:
        raise HTTPException(404, "Student not found")
    student = ser(doc)
    # Payment history
    payments = await db.payments.find({"student_id": student_id}).sort("created_at", -1).to_list(200)
    for p in payments:
        p["id"] = str(p.pop("_id"))
    student["payments"] = payments
    # Pending fees
    fee_structures = await db.fee_structures.find({"class_name": student["class_name"]}).to_list(100)
    pending_fees = []
    for fs in fee_structures:
        fs_id = str(fs["_id"])
        paid = await db.payments.find({"student_id": student_id, "fee_structure_id": fs_id}).to_list(100)
        total_paid = sum(p.get("amount", 0) for p in paid)
        remaining = fs["amount"] - total_paid
        if remaining > 0:
            pending_fees.append({
                "fee_structure_id": fs_id,
                "fee_type": fs["fee_type"],
                "amount": fs["amount"],
                "paid": total_paid,
                "remaining": remaining,
                "due_date": fs.get("due_date", ""),
                "is_mandatory": fs.get("is_mandatory", True),
            })
    student["pending_fees"] = pending_fees
    return {"success": True, "student": student}

@router.put("/{student_id}")
async def update_student(student_id: str, data: dict, user=Depends(require_admin), db=Depends(get_db)):
    data["updated_at"] = datetime.now(timezone.utc)
    data.pop("id", None)
    data.pop("_id", None)
    r = await db.students.update_one({"_id": ObjectId(student_id)}, {"$set": data})
    if r.matched_count == 0:
        raise HTTPException(404, "Student not found")
    return {"success": True}

@router.delete("/{student_id}")
async def delete_student(student_id: str, user=Depends(require_admin), db=Depends(get_db)):
    r = await db.students.delete_one({"_id": ObjectId(student_id)})
    if r.deleted_count == 0:
        raise HTTPException(404, "Student not found")
    return {"success": True}
