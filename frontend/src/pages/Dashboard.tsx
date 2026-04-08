import { useState, useEffect } from 'react';
import { Users, IndianRupee, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { PaymentStats, Payment, Defaulter } from '@/types';

export default function Dashboard() {
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [collectionTrend, setCollectionTrend] = useState<{date: string; amount: number}[]>([]);
  const [classWise, setClassWise] = useState<{class_name: string; amount: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, paymentsRes, defaultersRes] = await Promise.all([
          api.get('/payments/stats'),
          api.get('/payments'),
          api.get('/payments/defaulters'),
        ]);
        setStats(statsRes.data);
        const payments: Payment[] = paymentsRes.data.payments || [];
        setRecentPayments(payments.slice(0, 10));
        setDefaulters(defaultersRes.data.defaulters?.slice(0, 5) || []);

        const trendMap: Record<string, number> = {};
        const classMap: Record<string, number> = {};
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          trendMap[d.toISOString().split('T')[0]] = 0;
        }
        payments.forEach((p: Payment) => {
          const date = new Date(p.created_at).toISOString().split('T')[0];
          if (trendMap[date] !== undefined) trendMap[date] += p.amount;
          classMap[p.class_name] = (classMap[p.class_name] || 0) + p.amount;
        });
        setCollectionTrend(Object.entries(trendMap).map(([date, amount]) => ({
          date: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
          amount,
        })));
        setClassWise(
          Object.entries(classMap)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([class_name, amount]) => ({ class_name: `Class ${class_name}`, amount }))
        );
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  const statCards = [
    { label: 'Total Students', value: stats?.total_students || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: "Today's Collection", value: formatCurrency(stats?.today_collection || 0), icon: IndianRupee, color: 'bg-green-50 text-green-600' },
    { label: 'Pending Fees', value: formatCurrency(stats?.pending_amount || 0), icon: TrendingUp, color: 'bg-orange-50 text-orange-600' },
    { label: 'Defaulters', value: stats?.defaulter_count || 0, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{s.label}</span>
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.color}`}><s.icon className="h-4 w-4" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Collection Trend (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={collectionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'Collection']} />
              <Line type="monotone" dataKey="amount" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Class-wise Collection</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={classWise}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="class_name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'Collected']} />
              <Bar dataKey="amount" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {defaulters.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" /> Defaulter Alerts
          </h3>
          <div className="space-y-2">
            {defaulters.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-50 text-sm">
                <div>
                  <span className="font-medium text-gray-900">{d.name}</span>
                  <span className="text-gray-500 ml-2">Class {d.class_name}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-red-600">{formatCurrency(d.pending_amount)}</span>
                  <span className="text-gray-400 text-xs ml-2">{d.days_overdue}d overdue</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Payments</h3>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No payments yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Receipt</th>
                <th className="pb-2 font-medium">Student</th>
                <th className="pb-2 font-medium">Fee Type</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Method</th>
              </tr></thead>
              <tbody>
                {recentPayments.map(p => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs text-accent">{p.receipt_number}</td>
                    <td className="py-2">{p.student_name}</td>
                    <td className="py-2 capitalize">{p.fee_type}</td>
                    <td className="py-2 font-medium">{formatCurrency(p.amount)}</td>
                    <td className="py-2 uppercase text-xs">{p.payment_method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
