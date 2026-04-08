import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, Bell, Download, Search } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Defaulter } from '@/types';

const CLASSES = ['1','2','3','4','5','6','7','8','9','10'];

export default function Defaulters() {
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/payments/defaulters');
      setDefaulters(data.defaulters || []);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remind = async (id: string) => {
    try {
      await api.post(`/payments/remind/${id}`);
      toast.success('Marked as reminded');
      load();
    } catch { toast.error('Failed'); }
  };

  const exportCSV = () => {
    const filtered = getFiltered();
    const rows = [['Name', 'Adm No', 'Class', 'Phone', 'Pending Amount', 'Days Overdue', 'Last Payment']];
    filtered.forEach(d => {
      rows.push([d.name, d.admission_number, d.class_name, d.phone, String(d.pending_amount), String(d.days_overdue), d.last_payment_date || 'N/A']);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'defaulters.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFiltered = () => {
    let filtered = defaulters;
    if (classFilter) filtered = filtered.filter(d => d.class_name === classFilter);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(d => d.name.toLowerCase().includes(q) || d.admission_number.toLowerCase().includes(q));
    }
    return filtered;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  const filtered = getFiltered();
  const totalPending = filtered.reduce((s, d) => s + d.pending_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-red-500" /> Defaulters</h2>
        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"><Download className="h-4 w-4" /> Export CSV</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Defaulters</p>
          <p className="text-2xl font-bold text-red-600">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Pending Amount</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Avg Days Overdue</p>
          <p className="text-2xl font-bold text-orange-600">{filtered.length ? Math.round(filtered.reduce((s, d) => s + d.days_overdue, 0) / filtered.length) : 0}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search defaulters..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent/30 outline-none" />
        </div>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent/30 outline-none">
          <option value="">All Classes</option>
          {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 bg-gray-50 border-b">
            <th className="px-4 py-3 font-medium">Student</th>
            <th className="px-4 py-3 font-medium">Adm #</th>
            <th className="px-4 py-3 font-medium">Class</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Pending</th>
            <th className="px-4 py-3 font-medium">Days Overdue</th>
            <th className="px-4 py-3 font-medium">Last Payment</th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr></thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{d.admission_number}</td>
                <td className="px-4 py-3">{d.class_name} - {d.section}</td>
                <td className="px-4 py-3">{d.phone}</td>
                <td className="px-4 py-3 font-semibold text-red-600">{formatCurrency(d.pending_amount)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.days_overdue > 30 ? 'bg-red-100 text-red-700' : d.days_overdue > 15 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {d.days_overdue} days
                  </span>
                </td>
                <td className="px-4 py-3">{d.last_payment_date ? formatDate(d.last_payment_date) : 'Never'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => remind(d.id)} disabled={d.reminded} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${d.reminded ? 'bg-gray-100 text-gray-400' : 'bg-accent text-white hover:opacity-90'}`}>
                    <Bell className="h-3 w-3" /> {d.reminded ? 'Reminded' : 'Remind'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No defaulters found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
