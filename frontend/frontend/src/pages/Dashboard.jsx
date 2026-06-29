import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Dashboard() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentLogs, setRecentLogs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch datasets
        const dsRes = await axios.get('http://127.0.0.1:8000/api/datasets', { headers });
        setDatasets(dsRes.data);

        // Fetch logs for each dataset to build a feed
        const logsList = [];
        for (const ds of dsRes.data) {
          if (ds.status === 'Cleaned') {
            try {
              const logRes = await axios.get(`http://127.0.0.1:8000/api/datasets/${ds.id}/reports/logs`, { headers });
              if (logRes.data && logRes.data.length > 0) {
                logsList.push({
                  ...logRes.data[0],
                  file_name: ds.file_name,
                });
              }
            } catch (err) {
              console.error('Failed to fetch logs for dataset', ds.id);
            }
          }
        }
        // Sort logs by date desc
        logsList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setRecentLogs(logsList.slice(0, 5));
      } catch (err) {
        console.error('Error fetching dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Compute aggregations
  const totalDatasets = datasets.length;
  const cleanedCount = datasets.filter((d) => d.status === 'Cleaned').length;
  const pendingCount = totalDatasets - cleanedCount;
  
  let avgQuality = 0;
  let totalMissingRemoved = 0;
  let totalDuplicatesRemoved = 0;

  if (recentLogs.length > 0) {
    const qualities = recentLogs.map((l) => parseFloat(l.quality_score));
    avgQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    totalMissingRemoved = recentLogs.reduce((sum, l) => sum + l.missing_values_removed, 0);
    totalDuplicatesRemoved = recentLogs.reduce((sum, l) => sum + l.duplicates_removed, 0);
  }

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
      {/* Top Welcome Title */}
      <div>
        <h1 className="font-heading font-bold text-4xl text-slate-900 tracking-tight m-0">Platform Overview</h1>
        <p className="text-slate-600 mt-1">Data health summaries, processing statistics, and system activity logs.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 relative overflow-hidden bg-white">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 rounded-full blur-xl"></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Datasets</span>
          <span className="text-3xl font-heading font-bold text-slate-900 block mt-2">{totalDatasets}</span>
          <span className="text-xs text-slate-500 block mt-2">{cleanedCount} Cleaned • {pendingCount} Pending</span>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden bg-white">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-600/5 rounded-full blur-xl"></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Average Quality</span>
          <span className="text-3xl font-heading font-bold text-cyan-650 block mt-2">
            {avgQuality > 0 ? `${avgQuality.toFixed(1)}%` : 'N/A'}
          </span>
          <span className="text-xs text-slate-500 block mt-2">Based on latest clean runs</span>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden bg-white">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 rounded-full blur-xl"></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Null Values Imputed</span>
          <span className="text-3xl font-heading font-bold text-emerald-600 block mt-2">{totalMissingRemoved}</span>
          <span className="text-xs text-slate-500 block mt-2">Across all active columns</span>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden bg-white">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-600/5 rounded-full blur-xl"></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Duplicates Pruned</span>
          <span className="text-3xl font-heading font-bold text-rose-600 block mt-2">{totalDuplicatesRemoved}</span>
          <span className="text-xs text-slate-500 block mt-2">Redundant records removed</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Datasets Table */}
        <div className="glass-panel p-6 lg:col-span-2 space-y-4 bg-white">
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-bold text-lg text-slate-900">Your Datasets</h3>
            <button
              onClick={() => navigate('/datasets')}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Upload & Clean
            </button>
          </div>

          <div className="overflow-x-auto">
            {datasets.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No datasets uploaded yet. Upload a CSV or Excel file to get started!
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-650 border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="pb-3 font-semibold px-4 text-left">File Name</th>
                    <th className="pb-3 font-semibold px-4 text-left">Upload Date</th>
                    <th className="pb-3 font-semibold px-4 text-left">Status</th>
                    <th className="pb-3 font-semibold px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {datasets.map((ds) => (
                    <tr key={ds.id} className="group hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[200px] truncate">{ds.file_name}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">{new Date(ds.upload_date).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          ds.status === 'Cleaned' 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : 'bg-violet-50 text-violet-700 border border-violet-100'
                        }`}>
                          {ds.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => navigate('/datasets', { state: { selectId: ds.id } })}
                          className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-violet-600 hover:text-white border border-slate-200/60 hover:border-violet-600 transition-all text-xs font-bold cursor-pointer"
                        >
                          Open Workspace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent logs activity */}
        <div className="glass-panel p-6 space-y-4 bg-white">
          <h3 className="font-heading font-bold text-lg text-slate-900">Recent Cleaning Logs</h3>
          <div className="space-y-4">
            {recentLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No cleaning logs recorded. Run a dataset cleaning operation to see history.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[150px]">{log.file_name}</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Score: {parseFloat(log.quality_score).toFixed(0)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500 font-bold text-center uppercase tracking-wider">
                    <div>
                      <span className="block text-slate-800 font-bold">{log.missing_values_removed}</span>
                      Imputed
                    </div>
                    <div>
                      <span className="block text-slate-800 font-bold">{log.duplicates_removed}</span>
                      Duplicates
                    </div>
                    <div>
                      <span className="block text-slate-800 font-bold">{log.outliers_detected}</span>
                      Outliers
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-500 text-right">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
