from fastapi import APIRouter, Depends, HTTPException
from app.core.database import get_db
from app.utils.auth import require_admin
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter(prefix="/api/fee-structures", tags=["fee-structures"])

def ser(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc

@router.get("/")
async def list_fee_structures(class_name: str = "", db=Depends(get_db)):
    filt = {}
    if class_name:
        filt["class_name"] = class_name
    docs = await db.fee_structures.find(filt).sort([("class_name", 1), ("fee_type", 1)]).to_list(500)
    return {"success": True, "fee_structures": [ser(d) for d in docs]}

@router.post("/")
async def create_fee_structure(data: dict, user=Depends(require_admin), db=Depends(get_db)):
    existing = await db.fee_structures.find_one({
        "class_name": data["class_name"],
        "fee_type": data["fee_type"],
        "academic_year": data.get("academic_year", "2024-25"),
    })
    if existing:
        raise HTTPException(400, "Fee structure already exists for this class/type/year")
    doc = {
        "class_name": data["class_name"],
        "fee_type": data["fee_type"],
        "amount": float(data["amount"]),
        "due_date": data.get("due_date", ""),
        "academic_year": data.get("academic_year", "2024-25"),
        "is_mandatory": data.get("is_mandatory", True),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    r = await db.fee_structures.insert_one(doc)
    doc["id"] = str(r.inserted_id)
    return {"success": True, "fee_structure": doc}

@router.get("/by-class/{class_name}")
async def fee_structures_by_class(class_name: str, db=Depends(get_db)):
    docs = await db.fee_structures.find({"class_name": class_name}).sort("fee_type", 1).to_list(100)
    return {"success": True, "fee_structures": [ser(d) for d in docs]}

@router.put("/{fs_id}")
async def update_fee_structure(fs_id: str, data: dict, user=Depends(require_admin), db=Depends(get_db)):
    data["updated_at"] = datetime.now(timezone.utc)
    data.pop("id", None)
    data.pop("_id", None)
    if "amount" in data:
        data["amount"] = float(data["amount"])
    r = await db.fee_structures.update_one({"_id": ObjectId(fs_id)}, {"$set": data})
    if r.matched_count == 0:
        raise HTTPException(404, "Fee structure not found")
    return {"success": True}

@router.delete("/{fs_id}")
async def delete_fee_structure(fs_id: str, user=Depends(require_admin), db=Depends(get_db)):
    r = await db.fee_structures.delete_one({"_id": ObjectId(fs_id)})
    if r.deleted_count == 0:
        raise HTTPException(404, "Fee structure not found")
    return {"success": True}
