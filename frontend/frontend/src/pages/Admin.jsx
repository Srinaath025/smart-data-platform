import React, { useEffect, useState } from 'react';
import axios from 'axios';

function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get('http://127.0.0.1:8000/api/auth/users', { headers });
        setUsers(res.data);
      } catch (err) {
        console.error('Error fetching users', err);
        setError('Failed to load platform users. Permission denied.');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'Admin').length;
  const analystCount = users.filter(u => u.role === 'Analyst').length;
  const viewerCount = users.filter(u => u.role === 'Viewer').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <svg className="animate-spin h-8 w-8 text-violet-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="font-heading font-bold text-4xl text-slate-900 tracking-tight m-0">Platform Administration</h1>
        <p className="text-slate-600 mt-1">Manage platform accounts, monitor user roles, and audit system activities.</p>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium">
          {error}
        </div>
      ) : (
        <>
          {/* User statistics summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="glass-panel p-6 bg-white relative overflow-hidden">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total User Accounts</span>
              <span className="text-3xl font-heading font-bold text-slate-900 block mt-2">{totalUsers}</span>
            </div>
            <div className="glass-panel p-6 bg-white relative overflow-hidden">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Administrators</span>
              <span className="text-3xl font-heading font-bold text-violet-650 block mt-2">{adminCount}</span>
            </div>
            <div className="glass-panel p-6 bg-white relative overflow-hidden">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Analysts</span>
              <span className="text-3xl font-heading font-bold text-cyan-600 block mt-2">{analystCount}</span>
            </div>
            <div className="glass-panel p-6 bg-white relative overflow-hidden">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Viewers</span>
              <span className="text-3xl font-heading font-bold text-emerald-600 block mt-2">{viewerCount}</span>
            </div>
          </div>

          {/* Registered Users Table */}
          <div className="glass-panel p-6 bg-white space-y-4">
            <h3 className="font-heading font-bold text-lg text-slate-900">Registered Accounts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">User Name</th>
                    <th className="pb-3 font-semibold">Email Address</th>
                    <th className="pb-3 font-semibold">Assigned Role</th>
                    <th className="pb-3 font-semibold text-right">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-semibold text-slate-900">{u.name}</td>
                      <td className="py-3 text-slate-600 font-mono text-xs">{u.email}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'Admin' 
                            ? 'bg-violet-50 text-violet-600 border border-violet-100' 
                            : u.role === 'Analyst' 
                            ? 'bg-cyan-50 text-cyan-600 border border-cyan-100' 
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 text-right text-xs text-slate-500">
                        {new Date(u.created_at).toLocaleDateString()} {new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Admin;
