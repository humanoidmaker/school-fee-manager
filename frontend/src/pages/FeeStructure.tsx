import { useState, useEffect, useCallback } from 'react';
import { IndianRupee, Plus, Loader2, X, Edit2, Trash2, Copy } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { FeeStructure as FeeStructureType } from '@/types';

const CLASSES = ['1','2','3','4','5','6','7','8','9','10'];
const FEE_TYPES = ['tuition', 'exam', 'sports', 'library', 'transport', 'lab'];

export default function FeeStructure() {
  const [fees, setFees] = useState<FeeStructureType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('1');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<FeeStructureType | null>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [copyTarget, setCopyTarget] = useState('');
  const [form, setForm] = useState({ fee_type: 'tuition', amount: '', due_date: '', academic_year: '2024-25', is_mandatory: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/fee-structures/by-class/${selectedClass}`);
      setFees(data.fee_structures || []);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, [selectedClass]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/fee-structures/${editItem.id}`, { ...form, class_name: selectedClass, amount: parseFloat(form.amount) });
        toast.success('Updated');
      } else {
        await api.post('/fee-structures', { ...form, class_name: selectedClass, amount: parseFloat(form.amount) });
        toast.success('Added');
      }
      setShowAdd(false);
      setEditItem(null);
      setForm({ fee_type: 'tuition', amount: '', due_date: '', academic_year: '2024-25', is_mandatory: true });
      load();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fee structure?')) return;
    try { await api.delete(`/fee-structures/${id}`); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleEdit = (f: FeeStructureType) => {
    setEditItem(f);
    setForm({ fee_type: f.fee_type, amount: String(f.amount), due_date: f.due_date, academic_year: f.academic_year, is_mandatory: f.is_mandatory });
    setShowAdd(true);
  };

  const handleCopy = async () => {
    if (!copyTarget) return;
    setSaving(true);
    try {
      for (const f of fees) {
        try {
          await api.post('/fee-structures', {
            class_name: copyTarget,
            fee_type: f.fee_type,
            amount: f.amount,
            due_date: f.due_date,
            academic_year: f.academic_year,
            is_mandatory: f.is_mandatory,
          });
        } catch {} // Skip duplicates
      }
      toast.success(`Copied to Class ${copyTarget}`);
      setShowCopy(false);
    } catch { toast.error('Copy failed'); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><IndianRupee className="h-6 w-6 text-accent" /> Fee Structure</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowCopy(true)} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"><Copy className="h-4 w-4" /> Copy to Class</button>
          <button onClick={() => { setEditItem(null); setForm({ fee_type: 'tuition', amount: '', due_date: '', academic_year: '2024-25', is_mandatory: true }); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90"><Plus className="h-4 w-4" /> Add Fee</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CLASSES.map(c => (
          <button key={c} onClick={() => setSelectedClass(c)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedClass === c ? 'bg-primary text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            Class {c}
          </button>
        ))}
      </div>

      {loading ? <Loader2 className="h-6 w-6 animate-spin text-accent" /> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 bg-gray-50 border-b">
              <th className="px-4 py-3 font-medium">Fee Type</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Due Date</th>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium">Mandatory</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {fees.map(f => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="px-4 py-3 capitalize font-medium">{f.fee_type}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(f.amount)}</td>
                  <td className="px-4 py-3">{f.due_date || '-'}</td>
                  <td className="px-4 py-3">{f.academic_year}</td>
                  <td className="px-4 py-3">
                    {f.is_mandatory
                      ? <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Mandatory</span>
                      : <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Optional</span>}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => handleEdit(f)} className="p-1 hover:bg-gray-100 rounded"><Edit2 className="h-4 w-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(f.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
              {fees.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No fee structures for Class {selectedClass}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editItem ? 'Edit' : 'Add'} Fee Structure</h3>
              <button onClick={() => { setShowAdd(false); setEditItem(null); }}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Fee Type</label>
                <select value={form.fee_type} onChange={e => setForm(f => ({...f, fee_type: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30">
                  {FEE_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Amount</label><input type="number" required value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label><input value={form.academic_year} onChange={e => setForm(f => ({...f, academic_year: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_mandatory} onChange={e => setForm(f => ({...f, is_mandatory: e.target.checked}))} id="mandatory" />
                <label htmlFor="mandatory" className="text-sm text-gray-700">Mandatory</label>
              </div>
              <button type="submit" disabled={saving} className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving...' : editItem ? 'Update' : 'Add Fee Structure'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Copy Modal */}
      {showCopy && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Copy Fee Structure</h3>
              <button onClick={() => setShowCopy(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Copy all fees from Class {selectedClass} to:</p>
            <select value={copyTarget} onChange={e => setCopyTarget(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-accent/30">
              <option value="">Select class</option>
              {CLASSES.filter(c => c !== selectedClass).map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <button onClick={handleCopy} disabled={!copyTarget || saving} className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Copying...' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
