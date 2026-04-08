from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from app.core.database import get_db
from app.utils.auth import require_admin, get_current_user
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import random, io, csv

router = APIRouter(prefix="/api/payments", tags=["payments"])

def ser(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc

def generate_receipt_number():
    now = datetime.now(timezone.utc)
    return f"REC-{now.strftime('%Y%m%d')}-{random.randint(1000, 9999)}"

@router.post("/")
async def create_payment(data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    student = await db.students.find_one({"_id": ObjectId(data["student_id"])})
    if not student:
        raise HTTPException(404, "Student not found")
    fee_structure = await db.fee_structures.find_one({"_id": ObjectId(data["fee_structure_id"])})
    if not fee_structure:
        raise HTTPException(404, "Fee structure not found")
    receipt_number = generate_receipt_number()
    # Ensure unique receipt number
    while await db.payments.find_one({"receipt_number": receipt_number}):
        receipt_number = generate_receipt_number()
    doc = {
        "student_id": data["student_id"],
        "student_name": student["name"],
        "admission_number": student["admission_number"],
        "class_name": student["class_name"],
        "section": student.get("section", ""),
        "fee_structure_id": data["fee_structure_id"],
        "fee_type": fee_structure["fee_type"],
        "amount": float(data["amount"]),
        "payment_method": data.get("payment_method", "cash"),
        "transaction_ref": data.get("transaction_ref", ""),
        "receipt_number": receipt_number,
        "academic_year": fee_structure.get("academic_year", "2024-25"),
        "collected_by": user.get("name", "Admin"),
        "created_at": datetime.now(timezone.utc),
    }
    r = await db.payments.insert_one(doc)
    doc["id"] = str(r.inserted_id)
    return {"success": True, "payment": doc}

@router.get("/")
async def list_payments(date: str = "", student_id: str = "", class_name: str = "", db=Depends(get_db)):
    filt = {}
    if date:
        d = datetime.strptime(date, "%Y-%m-%d")
        filt["created_at"] = {"$gte": d, "$lt": d + timedelta(days=1)}
    if student_id:
        filt["student_id"] = student_id
    if class_name:
        filt["class_name"] = class_name
    docs = await db.payments.find(filt).sort("created_at", -1).to_list(500)
    return {"success": True, "payments": [ser(d) for d in docs]}

@router.get("/today")
async def today_payments(db=Depends(get_db)):
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    docs = await db.payments.find({"created_at": {"$gte": start}}).sort("created_at", -1).to_list(500)
    total = sum(d.get("amount", 0) for d in docs)
    return {"success": True, "payments": [ser(d) for d in docs], "total": total, "count": len(docs)}

@router.get("/stats")
async def payment_stats(db=Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Today's collection
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    today_result = await db.payments.aggregate(today_pipeline).to_list(1)
    today_collection = today_result[0]["total"] if today_result else 0
    # Total collection
    total_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    total_result = await db.payments.aggregate(total_pipeline).to_list(1)
    total_collection = total_result[0]["total"] if total_result else 0
    # Total students
    total_students = await db.students.count_documents({})
    # Pending amount calculation
    fee_total_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    fee_total_result = await db.fee_structures.aggregate(fee_total_pipeline).to_list(1)
    total_fees_per_student = fee_total_result[0]["total"] if fee_total_result else 0
    # Per-class fee total multiplied by students
    pending_amount = 0
    classes = await db.fee_structures.distinct("class_name")
    for cls in classes:
        class_fees = await db.fee_structures.find({"class_name": cls}).to_list(100)
        class_fee_total = sum(f["amount"] for f in class_fees)
        student_count = await db.students.count_documents({"class_name": cls})
        class_expected = class_fee_total * student_count
        # What was collected for this class
        class_paid_pipeline = [
            {"$match": {"class_name": cls}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        class_paid_result = await db.payments.aggregate(class_paid_pipeline).to_list(1)
        class_paid = class_paid_result[0]["total"] if class_paid_result else 0
        pending_amount += max(0, class_expected - class_paid)
    # Defaulters count
    defaulters = 0
    students = await db.students.find().to_list(1000)
    for s in students:
        sid = str(s["_id"])
        fees = await db.fee_structures.find({"class_name": s["class_name"]}).to_list(100)
        for f in fees:
            fid = str(f["_id"])
            paid = await db.payments.find({"student_id": sid, "fee_structure_id": fid}).to_list(100)
            total_paid = sum(p.get("amount", 0) for p in paid)
            due_date = f.get("due_date", "")
            if due_date and total_paid < f["amount"]:
                try:
                    dd = datetime.strptime(due_date, "%Y-%m-%d")
                    if dd < now.replace(tzinfo=None):
                        defaulters += 1
                        break
                except:
                    pass
    return {
        "success": True,
        "today_collection": today_collection,
        "total_collection": total_collection,
        "pending_amount": pending_amount,
        "total_students": total_students,
        "defaulter_count": defaulters,
    }

@router.get("/defaulters")
async def get_defaulters(db=Depends(get_db)):
    now = datetime.now(timezone.utc)
    students = await db.students.find().to_list(1000)
    defaulters = []
    for s in students:
        sid = str(s["_id"])
        fees = await db.fee_structures.find({"class_name": s["class_name"]}).to_list(100)
        total_pending = 0
        max_days_overdue = 0
        for f in fees:
            fid = str(f["_id"])
            paid = await db.payments.find({"student_id": sid, "fee_structure_id": fid}).to_list(100)
            total_paid = sum(p.get("amount", 0) for p in paid)
            remaining = f["amount"] - total_paid
            if remaining > 0:
                due_date = f.get("due_date", "")
                if due_date:
                    try:
                        dd = datetime.strptime(due_date, "%Y-%m-%d")
                        days = (now.replace(tzinfo=None) - dd).days
                        if days > 0:
                            total_pending += remaining
                            max_days_overdue = max(max_days_overdue, days)
                    except:
                        pass
        if total_pending > 0:
            last_payment = await db.payments.find({"student_id": sid}).sort("created_at", -1).to_list(1)
            defaulters.append({
                "id": sid,
                "name": s["name"],
                "admission_number": s["admission_number"],
                "class_name": s["class_name"],
                "section": s.get("section", ""),
                "phone": s.get("phone", ""),
                "pending_amount": total_pending,
                "days_overdue": max_days_overdue,
                "last_payment_date": last_payment[0]["created_at"].isoformat() if last_payment else None,
                "reminded": s.get("reminded", False),
            })
    defaulters.sort(key=lambda x: x["pending_amount"], reverse=True)
    return {"success": True, "defaulters": defaulters}

@router.post("/remind/{student_id}")
async def remind_student(student_id: str, user=Depends(require_admin), db=Depends(get_db)):
    await db.students.update_one(
        {"_id": ObjectId(student_id)},
        {"$set": {"reminded": True, "reminded_at": datetime.now(timezone.utc)}},
    )
    return {"success": True}

@router.get("/receipt/{payment_id}")
async def get_receipt(payment_id: str, db=Depends(get_db)):
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(404, "Payment not found")
    settings_docs = await db.settings.find().to_list(20)
    s = {d["key"]: d["value"] for d in settings_docs}
    school_name = s.get("school_name", "FeeFlow Public School")
    school_address = s.get("school_address", "")
    html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt {payment['receipt_number']}</title>
    <style>body{{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;padding:20px}}
    .header{{text-align:center;border-bottom:2px solid #1e3a5f;padding-bottom:15px;margin-bottom:20px}}
    .header h1{{color:#1e3a5f;margin:0;font-size:22px}} .header p{{color:#666;margin:4px 0;font-size:13px}}
    .receipt-no{{text-align:right;color:#f59e0b;font-weight:bold;font-size:15px;margin-bottom:15px}}
    table{{width:100%;border-collapse:collapse;margin:15px 0}} td{{padding:8px 12px;border:1px solid #ddd;font-size:13px}}
    td:first-child{{background:#f8f9fa;font-weight:600;width:40%}} .total{{font-size:18px;font-weight:bold;color:#1e3a5f;text-align:center;margin:20px 0}}
    .footer{{text-align:center;margin-top:30px;padding-top:15px;border-top:1px solid #ddd;color:#999;font-size:11px}}
    @media print{{body{{margin:0}}}}
    </style></head><body>
    <div class="header"><h1>{school_name}</h1><p>{school_address}</p><p>Fee Receipt</p></div>
    <div class="receipt-no">Receipt: {payment['receipt_number']}</div>
    <table>
    <tr><td>Student Name</td><td>{payment.get('student_name','')}</td></tr>
    <tr><td>Admission No.</td><td>{payment.get('admission_number','')}</td></tr>
    <tr><td>Class / Section</td><td>{payment.get('class_name','')} / {payment.get('section','')}</td></tr>
    <tr><td>Fee Type</td><td>{payment.get('fee_type','').title()}</td></tr>
    <tr><td>Amount</td><td style="font-size:16px;font-weight:bold">&#8377;{payment.get('amount',0):,.2f}</td></tr>
    <tr><td>Payment Method</td><td>{payment.get('payment_method','').upper()}</td></tr>
    <tr><td>Transaction Ref</td><td>{payment.get('transaction_ref','N/A')}</td></tr>
    <tr><td>Date</td><td>{payment.get('created_at','').strftime('%d %b %Y, %I:%M %p') if hasattr(payment.get('created_at',''), 'strftime') else str(payment.get('created_at',''))}</td></tr>
    <tr><td>Collected By</td><td>{payment.get('collected_by','')}</td></tr>
    </table>
    <div class="footer"><p>This is a computer-generated receipt.</p><p>{school_name} | Academic Year: {payment.get('academic_year','2024-25')}</p></div>
    </body></html>"""
    return HTMLResponse(content=html)

@router.get("/export-csv")
async def export_csv(frm: str = "", to: str = "", db=Depends(get_db)):
    filt = {}
    if frm:
        filt.setdefault("created_at", {})["$gte"] = datetime.strptime(frm, "%Y-%m-%d")
    if to:
        filt.setdefault("created_at", {})["$lt"] = datetime.strptime(to, "%Y-%m-%d") + timedelta(days=1)
    docs = await db.payments.find(filt).sort("created_at", -1).to_list(5000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Receipt No", "Date", "Student Name", "Admission No", "Class", "Fee Type", "Amount", "Method", "Transaction Ref"])
    for d in docs:
        writer.writerow([
            d.get("receipt_number", ""),
            d.get("created_at", "").strftime("%Y-%m-%d %H:%M") if hasattr(d.get("created_at", ""), "strftime") else "",
            d.get("student_name", ""),
            d.get("admission_number", ""),
            d.get("class_name", ""),
            d.get("fee_type", ""),
            d.get("amount", 0),
            d.get("payment_method", ""),
            d.get("transaction_ref", ""),
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=payments_export.csv"},
    )

@router.get("/{payment_id}")
async def get_payment(payment_id: str, db=Depends(get_db)):
    doc = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not doc:
        raise HTTPException(404, "Payment not found")
    return {"success": True, "payment": ser(doc)}
