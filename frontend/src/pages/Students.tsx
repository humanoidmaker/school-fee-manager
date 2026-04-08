import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Loader2, X, ChevronLeft, CreditCard } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Student, PendingFee, Payment } from '@/types';

const CLASSES = ['1','2','3','4','5','6','7','8','9','10'];

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState({ name: '', admission_number: '', class_name: '1', section: 'A', father_name: '', mother_name: '', phone: '', email: '', address: '', date_of_birth: '', gender: 'Male' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (classFilter) params.set('class_name', classFilter);
      const { data } = await api.get(`/students?${params}`);
      setStudents(data.students || []);
    } catch { toast.error('Failed to load students'); }
    setLoading(false);
  }, [search, classFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/students/${id}`);
      setSelectedStudent(data.student);
    } catch { toast.error('Failed to load student'); }
    setDetailLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/students', form);
      toast.success('Student added');
      setShowAdd(false);
      setForm({ name: '', admission_number: '', class_name: '1', section: 'A', father_name: '', mother_name: '', phone: '', email: '', address: '', date_of_birth: '', gender: 'Male' });
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed to add'); }
    setSaving(false);
  };

  const payFee = async (fee: PendingFee) => {
    if (!selectedStudent) return;
    const method = prompt('Payment method (cash/upi/cheque/bank_transfer):', 'cash');
    if (!method) return;
    const ref = method !== 'cash' ? prompt('Transaction reference:', '') || '' : '';
    try {
      await api.post('/payments', {
        student_id: selectedStudent.id,
        fee_structure_id: fee.fee_structure_id,
        amount: fee.remaining,
        payment_method: method,
        transaction_ref: ref,
      });
      toast.success('Payment recorded!');
      openDetail(selectedStudent.id);
    } catch { toast.error('Payment failed'); }
  };

  const getFeeStatus = (s: Student) => {
    // Simple heuristic based on student data
    return 'Active';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  // Student detail view
  if (selectedStudent) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedStudent(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary">
          <ChevronLeft className="h-4 w-4" /> Back to Students
        </button>
        {detailLoading ? <Loader2 className="h-6 w-6 animate-spin text-accent" /> : (
          <>
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{selectedStudent.name}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-500">Admission No:</span> <span className="font-medium">{selectedStudent.admission_number}</span></div>
                <div><span className="text-gray-500">Class:</span> <span className="font-medium">{selectedStudent.class_name} - {selectedStudent.section}</span></div>
                <div><span className="text-gray-500">Father:</span> <span className="font-medium">{selectedStudent.father_name}</span></div>
                <div><span className="text-gray-500">Mother:</span> <span className="font-medium">{selectedStudent.mother_name}</span></div>
                <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{selectedStudent.phone}</span></div>
                <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedStudent.email}</span></div>
                <div><span className="text-gray-500">DOB:</span> <span className="font-medium">{selectedStudent.date_of_birth}</span></div>
                <div><span className="text-gray-500">Gender:</span> <span className="font-medium">{selectedStudent.gender}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium">{selectedStudent.address}</span></div>
              </div>
            </div>
            {/* Pending Fees */}
            <div className="bg-white rounded-xl border p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Fee Breakdown</h4>
              {(selectedStudent.pending_fees || []).length === 0 ? (
                <p className="text-sm text-green-600 font-medium">All fees paid!</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Fee Type</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Paid</th>
                    <th className="pb-2 font-medium">Remaining</th>
                    <th className="pb-2 font-medium">Due Date</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium"></th>
                  </tr></thead>
                  <tbody>
                    {selectedStudent.pending_fees!.map((f, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 capitalize">{f.fee_type}</td>
                        <td className="py-2">{formatCurrency(f.amount)}</td>
                        <td className="py-2 text-green-600">{formatCurrency(f.paid)}</td>
                        <td className="py-2 font-medium text-red-600">{formatCurrency(f.remaining)}</td>
                        <td className="py-2">{f.due_date || '-'}</td>
                        <td className="py-2">
                          {f.paid > 0 ? <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Partial</span>
                            : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Pending</span>}
                        </td>
                        <td className="py-2">
                          <button onClick={() => payFee(f)} className="flex items-center gap-1 px-3 py-1 bg-accent text-white rounded text-xs font-medium hover:opacity-90">
                            <CreditCard className="h-3 w-3" /> Pay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {/* Payment History */}
            <div className="bg-white rounded-xl border p-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Payment History</h4>
              {(selectedStudent.payments || []).length === 0 ? (
                <p className="text-sm text-gray-400">No payments yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Receipt</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Fee Type</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Method</th>
                  </tr></thead>
                  <tbody>
                    {selectedStudent.payments!.map(p => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs text-accent">{p.receipt_number}</td>
                        <td className="py-2">{formatDate(p.created_at)}</td>
                        <td className="py-2 capitalize">{p.fee_type}</td>
                        <td className="py-2 font-medium">{formatCurrency(p.amount)}</td>
                        <td className="py-2 uppercase text-xs">{p.payment_method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users className="h-6 w-6 text-accent" /> Students</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90"><Plus className="h-4 w-4" /> Add Student</button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, admission#, phone..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent/30 outline-none" />
        </div>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent/30 outline-none">
          <option value="">All Classes</option>
          {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 bg-gray-50 border-b">
            <th className="px-4 py-3 font-medium">Adm #</th>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Class</th>
            <th className="px-4 py-3 font-medium">Section</th>
            <th className="px-4 py-3 font-medium">Father</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr></thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} onClick={() => openDetail(s.id)} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs">{s.admission_number}</td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.class_name}</td>
                <td className="px-4 py-3">{s.section}</td>
                <td className="px-4 py-3">{s.father_name}</td>
                <td className="px-4 py-3">{s.phone}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Active</span>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No students found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Student Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Add Student</h3>
              <button onClick={() => setShowAdd(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label><input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Admission No *</label><input required value={form.admission_number} onChange={e => setForm(f => ({...f, admission_number: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Class *</label><select value={form.class_name} onChange={e => setForm(f => ({...f, class_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30">{CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Section</label><select value={form.section} onChange={e => setForm(f => ({...f, section: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30"><option>A</option><option>B</option></select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Father's Name</label><input value={form.father_name} onChange={e => setForm(f => ({...f, father_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Mother's Name</label><input value={form.mother_name} onChange={e => setForm(f => ({...f, mother_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone</label><input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({...f, date_of_birth: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Gender</label><select value={form.gender} onChange={e => setForm(f => ({...f, gender: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30"><option>Male</option><option>Female</option><option>Other</option></select></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Address</label><textarea value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
              <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {saving ? 'Adding...' : 'Add Student'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
