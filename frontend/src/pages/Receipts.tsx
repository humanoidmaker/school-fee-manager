import { useState, useEffect, useCallback } from 'react';
import { Receipt, Search, Loader2, X, Printer, Download } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Payment } from '@/types';

export default function Receipts() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [receiptHtml, setReceiptHtml] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      const { data } = await api.get(`/payments?${params}`);
      let results: Payment[] = data.payments || [];
      if (search) {
        const q = search.toLowerCase();
        results = results.filter(p =>
          p.receipt_number.toLowerCase().includes(q) ||
          p.student_name.toLowerCase().includes(q) ||
          p.admission_number.toLowerCase().includes(q)
        );
      }
      setPayments(results);
    } catch {}
    setLoading(false);
  }, [search, dateFilter]);

  useEffect(() => { load(); }, [load]);

  const viewReceipt = async (id: string) => {
    try {
      const { data } = await api.get(`/payments/receipt/${id}`, { responseType: 'text' });
      setReceiptHtml(typeof data === 'string' ? data : '');
      setShowReceipt(true);
    } catch { toast.error('Failed to load receipt'); }
  };

  const printReceipt = () => {
    const w = window.open('', '_blank');
    if (w) { w.document.write(receiptHtml); w.document.close(); w.print(); }
  };

  const downloadReceipt = () => {
    const blob = new Blob([receiptHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receipt.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Receipt className="h-6 w-6 text-accent" /> Receipts</h2>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by receipt#, student name..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent/30 outline-none" />
        </div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent/30 outline-none" />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 bg-gray-50 border-b">
            <th className="px-4 py-3 font-medium">Receipt No</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Student</th>
            <th className="px-4 py-3 font-medium">Adm #</th>
            <th className="px-4 py-3 font-medium">Fee Type</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-accent">{p.receipt_number}</td>
                <td className="px-4 py-3">{formatDate(p.created_at)} {formatTime(p.created_at)}</td>
                <td className="px-4 py-3 font-medium">{p.student_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.admission_number}</td>
                <td className="px-4 py-3 capitalize">{p.fee_type}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(p.amount)}</td>
                <td className="px-4 py-3 flex gap-1">
                  <button onClick={() => viewReceipt(p.id)} className="p-1.5 hover:bg-gray-100 rounded" title="View & Print"><Printer className="h-4 w-4 text-gray-500" /></button>
                  <button onClick={() => viewReceipt(p.id)} className="p-1.5 hover:bg-gray-100 rounded" title="Download"><Download className="h-4 w-4 text-gray-500" /></button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No receipts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Receipt Preview */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold">Receipt</h3>
              <div className="flex gap-2">
                <button onClick={printReceipt} className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white rounded text-sm font-medium"><Printer className="h-3 w-3" /> Print</button>
                <button onClick={downloadReceipt} className="flex items-center gap-1 px-3 py-1.5 border rounded text-sm font-medium"><Download className="h-3 w-3" /> Download</button>
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
