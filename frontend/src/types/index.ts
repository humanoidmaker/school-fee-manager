// Types for FeeFlow - School Fee Manager
export interface User { id: string; email: string; name: string; role: string; }

export interface Student {
  id: string;
  name: string;
  admission_number: string;
  class_name: string;
  section: string;
  father_name: string;
  mother_name: string;
  phone: string;
  email: string;
  address: string;
  date_of_birth: string;
  gender: string;
  created_at: string;
  updated_at: string;
  payments?: Payment[];
  pending_fees?: PendingFee[];
}

export interface FeeStructure {
  id: string;
  class_name: string;
  fee_type: string;
  amount: number;
  due_date: string;
  academic_year: string;
  is_mandatory: boolean;
}

export interface Payment {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  section: string;
  fee_structure_id: string;
  fee_type: string;
  amount: number;
  payment_method: string;
  transaction_ref: string;
  receipt_number: string;
  academic_year: string;
  collected_by: string;
  created_at: string;
}

export interface PendingFee {
  fee_structure_id: string;
  fee_type: string;
  amount: number;
  paid: number;
  remaining: number;
  due_date: string;
  is_mandatory: boolean;
}

export interface Defaulter {
  id: string;
  name: string;
  admission_number: string;
  class_name: string;
  section: string;
  phone: string;
  pending_amount: number;
  days_overdue: number;
  last_payment_date: string | null;
  reminded: boolean;
}

export interface PaymentStats {
  today_collection: number;
  total_collection: number;
  pending_amount: number;
  total_students: number;
  defaulter_count: number;
}
