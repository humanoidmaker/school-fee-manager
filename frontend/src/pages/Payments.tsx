import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Search, Loader2, X, Receipt, Eye } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Payment, Student, PendingFee } from '@/types';

const CLASSES = ['1','2','3','4','5','6','7','8','9','10'];

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showRecord, setShowRecord] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  // Record payment states
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [pendingFees, setPendingFees] = useState<PendingFee[]>([]);
  const [selectedFee, setSelectedFee] = useState<PendingFee | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      if (classFilter) params.set('class_name', classFilter);
      const { data } = await api.get(`/payments?${params}`);
      setPayments(data.payments || []);
    } catch {}
    setLoading(false);
  }, [dateFilter, classFilter]);

  useEffect(() => { load(); }, [load]);

  const searchStudents = async (q: string) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await api.get(`/students/search?q=${q}`);
      setSearchResults(data.students || []);
    } catch {}
  };

  const selectStudent = async (s: Student) => {
    setSelectedStudent(s);
    setSearchResults([]);
    setSearchQ(s.name);
    try {
      const { data } = await api.get(`/students/${s.id}`);
      setPendingFees(data.student.pending_fees || []);
    } catch {}
  };

  const recordPayment = async () => {
    if (!selectedStudent || !selectedFee) return;
    setSaving(true);
    try {
      const { data } = await api.post('/payments', {
        student_id: selectedStudent.id,
        fee_structure_id: selectedFee.fee_structure_id,
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        transaction_ref: payRef,
      });
      toast.success(`Payment recorded! Receipt: ${data.payment.receipt_number}`);
      setShowRecord(false);
      resetRecordForm();
      load();
      // Show receipt
      viewReceipt(data.payment.id);
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const resetRecordForm = () => {
    setSearchQ(''); setSearchResults([]); setSelectedStudent(null);
    setPendingFees([]); setSelectedFee(null); setPayAmount('');
    setPayMethod('cash'); setPayRef('');
  };

  const viewReceipt = async (id: string) => {
    try {
      const { data } = await api.get(`/payments/receipt/${id}`, { responseType: 'text' });
      setReceiptHtml(typeof data === 'string' ? data : '');
      setShowReceipt(true);
    } catch { toast.error('Failed to load receipt'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CreditCard className="h-6 w-6 text-accent" /> Payments</h2>
        <button onClick={() => { resetRecordForm(); setShowRecord(true); }} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90"><CreditCard className="h-4 w-4" /> Record Payment</button>
      </div>

      <div className="flex gap-3">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent/30 outline-none" />
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent/30 outline-none">
          <option value="">All Classes</option>
          {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 bg-gray-50 border-b">
            <th className="px-4 py-3 font-medium">Receipt</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Student</th>
            <th className="px-4 py-3 font-medium">Class</th>
            <th className="px-4 py-3 font-medium">Fee Type</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Method</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr></thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-accent">{p.receipt_number}</td>
                <td className="px-4 py-3">{formatDate(p.created_at)} {formatTime(p.created_at)}</td>
                <td className="px-4 py-3 font-medium">{p.student_name}</td>
                <td className="px-4 py-3">{p.class_name}</td>
                <td className="px-4 py-3 capitalize">{p.fee_type}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(p.amount)}</td>
                <td className="px-4 py-3 uppercase text-xs">{p.payment_method}</td>
                <td className="px-4 py-3">
                  <button onClick={() => viewReceipt(p.id)} className="p-1 hover:bg-gray-100 rounded" title="View Receipt"><Eye className="h-4 w-4 text-gray-500" /></button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No payments found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record Payment Modal */}
      {showRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Record Payment</h3>
              <button onClick={() => setShowRecord(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            {/* Step 1: Search Student */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search Student</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={searchQ} onChange={e => searchStudents(e.target.value)} placeholder="Name or admission#..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-1 border rounded-lg bg-white shadow-lg max-h-40 overflow-y-auto">
                  {searchResults.map(s => (
                    <button key={s.id} onClick={() => selectStudent(s)} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0">
                      <span className="font-medium">{s.name}</span> <span className="text-gray-400">({s.admission_number}) Class {s.class_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Select Fee */}
            {selectedStudent && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Pending Fees for {selectedStudent.name}</label>
                {pendingFees.length === 0 ? (
                  <p className="text-sm text-green-600">All fees paid!</p>
                ) : (
                  <div className="space-y-2">
                    {pendingFees.map((f, i) => (
                      <button key={i} onClick={() => { setSelectedFee(f); setPayAmount(String(f.remaining)); }}
                        className={`w-full text-left px-3 py-2 border rounded-lg text-sm transition-colors ${selectedFee?.fee_structure_id === f.fee_structure_id ? 'border-accent bg-accent/5' : 'hover:bg-gray-50'}`}>
                        <div className="flex justify-between">
                          <span className="capitalize font-medium">{f.fee_type}</span>
                          <span className="text-red-600 font-semibold">{formatCurrency(f.remaining)} remaining</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">Total: {formatCurrency(f.amount)} | Paid: {formatCurrency(f.paid)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Payment Details */}
            {selectedFee && (
              <div className="space-y-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Amount</label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30">
                    <option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                {payMethod !== 'cash' && (
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Transaction Reference</label><input value={payRef} onChange={e => setPayRef(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
                )}
                <button onClick={recordPayment} disabled={saving || !payAmount} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} {saving ? 'Recording...' : 'Record & Generate Receipt'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Preview */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold">Receipt Preview</h3>
              <div className="flex gap-2">
                <button onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(receiptHtml); w.document.close(); w.print(); } }} className="px-3 py-1.5 bg-accent text-white rounded text-sm font-medium">Print</button>
                <button onClick={() => setShowReceipt(false)}><X className="h-5 w-5 text-gray-400" /></button>
              </div>
            </div>
            <div className="p-4" dangerouslySetInnerHTML={{ __html: receiptHtml }} />
          </div>
        </div>
      )}
    </div>
  );
}
