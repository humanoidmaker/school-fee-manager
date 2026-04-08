import asyncio, sys, random
from datetime import datetime, timedelta, timezone
sys.path.insert(0, ".")
from app.core.database import init_db, get_db
from app.utils.auth import hash_password

FIRST_NAMES_M = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
                  "Shaurya", "Atharv", "Advik", "Rudra", "Kabir", "Ritvik", "Aarush", "Kian", "Darsh", "Dhruv",
                  "Yash", "Rohan", "Arnav", "Dev", "Ravi"]
FIRST_NAMES_F = ["Ananya", "Diya", "Myra", "Sara", "Aadhya", "Aaradhya", "Anika", "Priya", "Isha", "Kavya",
                  "Meera", "Tara", "Nisha", "Riya", "Siya", "Pooja", "Shreya", "Tanvi", "Neha", "Saanvi",
                  "Avni", "Jiya", "Kiara", "Zara", "Pihu"]
LAST_NAMES = ["Sharma", "Verma", "Patel", "Kumar", "Singh", "Gupta", "Joshi", "Reddy", "Nair", "Mehta",
              "Mishra", "Rao", "Das", "Iyer", "Thakur", "Chauhan", "Malik", "Saxena", "Bhat", "Agarwal"]
FATHER_NAMES_PREFIX = ["Rajesh", "Suresh", "Amit", "Anil", "Sanjay", "Vikram", "Manoj", "Ramesh", "Ashok", "Dinesh",
                        "Pranav", "Nikhil", "Rajan", "Mohan", "Sunil", "Deepak", "Naveen", "Harish", "Satish", "Vinod"]
MOTHER_NAMES = ["Sunita", "Anita", "Priya", "Neeta", "Kavita", "Meena", "Rekha", "Geeta", "Suman", "Lata",
                "Pooja", "Anjali", "Shikha", "Renu", "Swati", "Nandini", "Pallavi", "Rashmi", "Jaya", "Rani"]
SECTIONS = ["A", "B"]

FEE_TYPES = [
    {"fee_type": "tuition", "amount": 2000, "is_mandatory": True},
    {"fee_type": "exam", "amount": 500, "is_mandatory": True},
    {"fee_type": "sports", "amount": 200, "is_mandatory": True},
    {"fee_type": "library", "amount": 100, "is_mandatory": True},
    {"fee_type": "transport", "amount": 1500, "is_mandatory": False},
]

async def seed():
    await init_db()
    db = await get_db()
    # Seed admin
    if not await db.users.find_one({"email": "admin@school.local"}):
        await db.users.insert_one({
            "email": "admin@school.local",
            "password_hash": hash_password("admin123"),
            "name": "Admin",
            "role": "admin",
            "is_active": True,
        })
        print("Admin created: admin@school.local / admin123")
    # Check if already seeded
    if await db.students.count_documents({}) > 0:
        print("Sample data exists"); return
    now = datetime.now(timezone.utc)
    academic_year = "2024-25"
    # Create fee structures for each class
    print("Creating fee structures...")
    fee_structure_ids = {}
    for cls in range(1, 11):
        cls_name = str(cls)
        fee_structure_ids[cls_name] = []
        for ft in FEE_TYPES:
            due_date = (now - timedelta(days=random.randint(5, 30))).strftime("%Y-%m-%d")
            doc = {
                "class_name": cls_name,
                "fee_type": ft["fee_type"],
                "amount": ft["amount"],
                "due_date": due_date,
                "academic_year": academic_year,
                "is_mandatory": ft["is_mandatory"],
                "created_at": now,
                "updated_at": now,
            }
            r = await db.fee_structures.insert_one(doc)
            fee_structure_ids[cls_name].append({"id": str(r.inserted_id), **ft})
    print("Created fee structures for 10 classes")
    # Create 50 students (5 per class)
    print("Creating 50 students...")
    all_students = []
    adm_counter = 1000
    for cls in range(1, 11):
        cls_name = str(cls)
        for i in range(5):
            adm_counter += 1
            gender = random.choice(["Male", "Female"])
            if gender == "Male":
                first = random.choice(FIRST_NAMES_M)
            else:
                first = random.choice(FIRST_NAMES_F)
            last = random.choice(LAST_NAMES)
            name = f"{first} {last}"
            father_first = random.choice(FATHER_NAMES_PREFIX)
            mother = random.choice(MOTHER_NAMES)
            phone = f"9{random.randint(100000000, 999999999)}"
            dob_year = 2024 - (5 + cls + random.randint(0, 1))
            dob = f"{dob_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}"
            student_doc = {
                "name": name,
                "admission_number": f"ADM{adm_counter}",
                "class_name": cls_name,
                "section": random.choice(SECTIONS),
                "father_name": f"{father_first} {last}",
                "mother_name": f"{mother} {last}",
                "phone": phone,
                "email": f"{first.lower()}.{last.lower()}{adm_counter}@parent.com",
                "address": f"{random.randint(1,500)}, {random.choice(['MG Road','Nehru Nagar','Gandhi Colony','Patel Street','Tagore Lane'])}, New Delhi",
                "date_of_birth": dob,
                "gender": gender,
                "created_at": now,
                "updated_at": now,
            }
            r = await db.students.insert_one(student_doc)
            all_students.append({"id": str(r.inserted_id), "class_name": cls_name, "name": name,
                                  "admission_number": student_doc["admission_number"], "section": student_doc["section"]})
    print(f"Created {len(all_students)} students")
    # Create 30 payments over current month
    print("Creating 30 payments...")
    payment_methods = ["cash", "upi", "cheque", "bank_transfer"]
    receipt_counter = 1000
    for _ in range(30):
        student = random.choice(all_students)
        fees = fee_structure_ids[student["class_name"]]
        fee = random.choice(fees)
        receipt_counter += 1
        days_ago = random.randint(0, 29)
        payment_date = now - timedelta(days=days_ago, hours=random.randint(0, 8))
        receipt_number = f"REC-{payment_date.strftime('%Y%m%d')}-{receipt_counter}"
        method = random.choice(payment_methods)
        txn_ref = ""
        if method == "upi":
            txn_ref = f"UPI{random.randint(100000, 999999)}"
        elif method == "cheque":
            txn_ref = f"CHQ{random.randint(100000, 999999)}"
        elif method == "bank_transfer":
            txn_ref = f"NEFT{random.randint(1000000, 9999999)}"
        payment_doc = {
            "student_id": student["id"],
            "student_name": student["name"],
            "admission_number": student["admission_number"],
            "class_name": student["class_name"],
            "section": student["section"],
            "fee_structure_id": fee["id"],
            "fee_type": fee["fee_type"],
            "amount": fee["amount"],
            "payment_method": method,
            "transaction_ref": txn_ref,
            "receipt_number": receipt_number,
            "academic_year": academic_year,
            "collected_by": "Admin",
            "created_at": payment_date,
        }
        await db.payments.insert_one(payment_doc)
    print("Created 30 payments")
    print("Seed complete!")

asyncio.run(seed())
