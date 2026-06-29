import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut, Line, Scatter } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function Datasets({ user }) {
  const location = useLocation();
  const fileInputRef = useRef(null);

  // States
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);
  const [activeTab, setActiveTab] = useState('profile'); // profile, clean, analytics, ml, chat
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  // Data views
  const [profileData, setProfileData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [insightsData, setInsightsData] = useState(null);
  const [mlOptions, setMlOptions] = useState(null);
  const [mlResults, setMlResults] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedDistCol, setSelectedDistCol] = useState('');
  const [selectedCatCol, setSelectedCatCol] = useState('');

  // Cleaning wizard config
  const [cleaningConfig, setCleaningConfig] = useState({
    missing_values_method: 'mean',
    missing_values_constant: '',
    remove_duplicates: true,
    outlier_method: 'iqr',
    outlier_action: 'highlight',
    text_trim: true,
    text_case: 'none',
    remove_special_chars: false,
    date_standardization: true,
    column_standardization: true
  });
  const [cleaningResults, setCleaningResults] = useState(null);

  // ML form config
  const [mlConfig, setMlConfig] = useState({
    target_column: '',
    feature_columns: [],
    model_type: 'regression',
    algorithm: 'linear_regression'
  });

  // Fetch initial datasets list
  const fetchDatasets = async (selectId = null) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get('http://127.0.0.1:8000/api/datasets', { headers });
      setDatasets(res.data);

      if (selectId) {
        setSelectedDatasetId(selectId);
      } else if (res.data.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching datasets list', err);
    }
  };

  useEffect(() => {
    const passedId = location.state?.selectId;
    fetchDatasets(passedId);
  }, [location.state]);

  // Handle dataset selection
  useEffect(() => {
    if (selectedDatasetId) {
      loadDatasetDetails(selectedDatasetId);
      // Reset active tab to profile to prevent blank screens on uncleaned items
      setActiveTab('profile');
      setCleaningResults(null);
      setMlResults(null);
      setChatHistory([]);
    }
  }, [selectedDatasetId]);

  // Load details depending on tab
  useEffect(() => {
    if (selectedDatasetId && activeTab === 'analytics') {
      loadAnalytics(selectedDatasetId);
    } else if (selectedDatasetId && activeTab === 'ml') {
      loadMlOptions(selectedDatasetId);
    }
  }, [selectedDatasetId, activeTab]);



  const loadDatasetDetails = async (id) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`http://127.0.0.1:8000/api/datasets/${id}/profile`, { headers });
      setProfileData(res.data);
    } catch (err) {
      console.error('Error loading dataset profile', err);
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [sumRes, insRes] = await Promise.all([
        axios.get(`http://127.0.0.1:8000/api/datasets/${id}/analytics/summary`, { headers }),
        axios.get(`http://127.0.0.1:8000/api/datasets/${id}/analytics/insights`, { headers })
      ]);
      setAnalyticsData(sumRes.data);
      setInsightsData(insRes.data);

      const numCols = Object.keys(sumRes.data.numeric_stats || {});
      if (numCols.length > 0) {
        setSelectedDistCol(numCols[0]);
      }
      const catCols = Object.keys(sumRes.data.categorical_distributions || {});
      if (catCols.length > 0) {
        setSelectedCatCol(catCols[0]);
      }
    } catch (err) {
      console.error('Error loading analytics', err);
      setAnalyticsData(null);
      setInsightsData(null);
    }
  };

  const loadMlOptions = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`http://127.0.0.1:8000/api/datasets/${id}/predictions/options`, { headers });
      setMlOptions(res.data);
      if (res.data.numerical_columns.length > 0) {
        setMlConfig({
          target_column: res.data.numerical_columns[0],
          feature_columns: res.data.numerical_columns.slice(1),
          model_type: 'regression',
          algorithm: 'linear_regression'
        });
      }
    } catch (err) {
      console.error('Error loading ML options', err);
      setMlOptions(null);
    }
  };

  // Upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://127.0.0.1:8000/api/datasets/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      fetchDatasets(res.data.id);
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Failed to upload dataset. Ensure format is CSV/Excel.';
      setUploadError(errMsg);
      alert(errMsg);
    } finally {
      setUploading(false);
    }
  };

  // Delete handler
  const handleDeleteDataset = async (id) => {
    if (!confirm('Are you sure you want to delete this dataset? This will drop all SQL warehouse tables.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://127.0.0.1:8000/api/datasets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedDatasetId(null);
      setProfileData(null);
      fetchDatasets();
    } catch (err) {
      console.error('Failed to delete dataset', err);
    }
  };

  // Clean handler
  const handleRunCleaning = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(
        `http://127.0.0.1:8000/api/datasets/${selectedDatasetId}/clean`,
        cleaningConfig,
        { headers }
      );
      setCleaningResults(res.data);
      // Reload profile
      loadDatasetDetails(selectedDatasetId);
      // Refresh datasets list to update status badge
      fetchDatasets(selectedDatasetId);
    } catch (err) {
      alert(err.response?.data?.detail || 'Cleaning failed.');
    } finally {
      setLoading(false);
    }
  };

  // ML Model runner
  const handleTrainModel = async () => {
    setLoading(true);
    setMlResults(null);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(
        `http://127.0.0.1:8000/api/datasets/${selectedDatasetId}/predictions/run`,
        mlConfig,
        { headers }
      );
      setMlResults(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to train ML model.');
    } finally {
      setLoading(false);
    }
  };

  // Chat message submit
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(
        `http://127.0.0.1:8000/api/datasets/${selectedDatasetId}/chat`,
        { message: userMsg },
        { headers }
      );
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: res.data.response,
        data: res.data.data,
        sql: res.data.sql
      }]);
    } catch (err) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error executing that request. Make sure the dataset is cleaned.'
      }]);
    } finally {
      setChatLoading(false);
    }
  };



  const renderMlChart = () => {
    if (!mlResults || !mlResults.predictions_preview || mlResults.predictions_preview.length === 0) {
      return <span className="text-xs text-slate-400 flex items-center justify-center h-full">No prediction data available</span>;
    }

    const first = mlResults.predictions_preview[0];

    // Clustering view
    if (first.cluster !== undefined) {
      const clusterIds = Array.from(new Set(mlResults.predictions_preview.map(p => p.cluster)));
      const colors = ['#6366f1', '#06b6d4', '#10b981', '#f43f5e', '#f59e0b'];
      const datasetsArr = clusterIds.map(cId => {
        return {
          label: `Cluster ${cId + 1}`,
          data: mlResults.predictions_preview
            .filter(p => p.cluster === cId)
            .map(p => ({ x: p.x, y: p.y })),
          backgroundColor: colors[cId % colors.length],
          pointRadius: 6,
          pointHoverRadius: 8
        };
      });

      return (
        <Scatter
          data={{ datasets: datasetsArr }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } }
            },
            scales: {
              y: { grid: { color: 'rgba(226, 232, 240, 0.6)' }, title: { display: true, text: 'Feature 2 (Scaled)', font: { size: 9 } } },
              x: { grid: { display: false }, title: { display: true, text: 'Feature 1 (Scaled)', font: { size: 9 } } }
            }
          }}
        />
      );
    }

    // Classification view
    if (typeof first.actual === 'string' || mlConfig.model_type === 'classification') {
      const uniqueClasses = Array.from(new Set(
        mlResults.predictions_preview.flatMap(p => [String(p.actual), String(p.predicted)])
      ));
      
      const sliceCount = 15;
      const actualMapped = mlResults.predictions_preview.slice(0, sliceCount).map(p => uniqueClasses.indexOf(String(p.actual)));
      const predictedMapped = mlResults.predictions_preview.slice(0, sliceCount).map(p => uniqueClasses.indexOf(String(p.predicted)));

      return (
        <Line
          data={{
            labels: mlResults.predictions_preview.slice(0, sliceCount).map((_, i) => `Sample ${i + 1}`),
            datasets: [
              {
                label: 'Actual Class',
                data: actualMapped,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.1,
                borderWidth: 2,
                pointRadius: 4,
                stepped: true
              },
              {
                label: 'Predicted Class',
                data: predictedMapped,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.1,
                borderWidth: 2,
                pointRadius: 4,
                stepped: true
              }
            ]
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } }
            },
            scales: {
              y: {
                grid: { color: 'rgba(226, 232, 240, 0.6)' },
                ticks: {
                  callback: (val) => uniqueClasses[val] !== undefined ? uniqueClasses[val] : val,
                  font: { size: 9 }
                }
              },
              x: { grid: { display: false } }
            }
          }}
        />
      );
    }

    // Regression view
    const sliceCount = 15;
    return (
      <Line
        data={{
          labels: mlResults.predictions_preview.slice(0, sliceCount).map((_, i) => `Sample ${i + 1}`),
          datasets: [
            {
              label: 'Actual',
              data: mlResults.predictions_preview.slice(0, sliceCount).map(p => p.actual),
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 3,
            },
            {
              label: 'Predicted',
              data: mlResults.predictions_preview.slice(0, sliceCount).map(p => p.predicted),
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 3,
            }
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } }
          },
          scales: {
            y: { grid: { color: 'rgba(226, 232, 240, 0.6)' } },
            x: { grid: { display: false } }
          }
        }}
      />
    );
  };

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[calc(100vh-8rem)] fade-in">
      
      {/* Sidebar List and File Upload */}
      <div className="space-y-6 lg:col-span-1">
        
        {/* Upload Zone */}
        <div className="glass-panel p-6 space-y-4 bg-white">
          <h3 className="font-heading font-bold text-lg text-slate-900">Upload New Dataset</h3>
          
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-violet-500/40 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-slate-100/70 transition-all duration-300 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".csv,.xlsx,.xls"
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="animate-spin h-8 w-8 text-violet-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs text-slate-500 font-bold">Uploading...</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-violet-600/10 flex items-center justify-center mx-auto text-violet-600 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-800">Click to browse</p>
                <p className="text-[10px] text-slate-500 font-semibold">Supports CSV, XLSX, XLS up to 50MB</p>
              </div>
            )}
          </div>
          {uploadError && (
            <p className="text-xs text-rose-600 font-semibold text-center">{uploadError}</p>
          )}
        </div>

        {/* Datasets selector list */}
        <div className="glass-panel p-6 space-y-4 bg-white">
          <h3 className="font-heading font-bold text-lg text-slate-900">Datasets Hub</h3>
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {datasets.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No datasets loaded</p>
            ) : (
              datasets.map(ds => (
                <div
                  key={ds.id}
                  onClick={() => setSelectedDatasetId(ds.id)}
                  className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between group ${
                    selectedDatasetId === ds.id
                      ? 'bg-violet-50/70 border-violet-200/80 text-violet-750 font-semibold shadow-xs'
                      : 'bg-slate-50/50 border-slate-200/50 text-slate-650 hover:border-slate-300 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="overflow-hidden mr-2">
                    <span className={`text-sm font-semibold truncate block ${selectedDatasetId === ds.id ? 'text-violet-700' : 'text-slate-700 group-hover:text-slate-900'}`}>{ds.file_name}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider block mt-0.5 ${ds.status === 'Cleaned' ? 'text-emerald-600' : 'text-slate-500'}`}>{ds.status}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDataset(ds.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-600 p-1 text-slate-400 hover:bg-rose-50 rounded-lg transition-all cursor-pointer animate-none"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Main Workspace details panel */}
      <div className="lg:col-span-3">
        {selectedDatasetId && selectedDataset ? (
          <div className="space-y-6">
            
            {/* Header info card */}
            <div className="glass-panel p-6 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-xs text-violet-600 font-bold uppercase tracking-wider">Active Workspace</span>
                <h2 className="font-heading font-bold text-2xl text-slate-900 mt-1 m-0">{selectedDataset.file_name}</h2>
              </div>

              {/* Tabs list */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-stretch md:self-auto overflow-x-auto">
                {[
                  { id: 'profile', name: 'Profile' },
                  { id: 'clean', name: 'Cleaning' },
                  { id: 'analytics', name: 'Analytics' },
                  { id: 'ml', name: 'Predictions' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-violet-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB CONTENTS */}
            
            {/* Loading state indicator */}
            {loading && activeTab !== 'chat' && (
              <div className="glass-panel p-12 bg-white flex justify-center items-center">
                <svg className="animate-spin h-8 w-8 text-violet-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {/* 1. Tab PROFILE */}
            {!loading && activeTab === 'profile' && profileData && (
              <div className="space-y-6 fade-in">
                
                {/* Profile cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-panel p-5 bg-white">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Rows Count</span>
                    <span className="text-2xl font-heading font-bold text-slate-900 block mt-1">{profileData.rows}</span>
                  </div>
                  <div className="glass-panel p-5 bg-white">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Columns Count</span>
                    <span className="text-2xl font-heading font-bold text-slate-900 block mt-1">{profileData.columns_count}</span>
                  </div>
                  <div className="glass-panel p-5 bg-white">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Duplicate Rows</span>
                    <span className="text-2xl font-heading font-bold text-slate-900 block mt-1">{profileData.duplicate_count}</span>
                  </div>
                </div>

                {/* Columns List and data types */}
                <div className="glass-panel p-6 bg-white space-y-4">
                  <h3 className="font-heading font-bold text-lg text-slate-900">Data Profiling & Schema</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-650 border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs text-slate-550 uppercase tracking-wider">
                          <th className="pb-3 px-4 font-semibold text-left">Column Name</th>
                          <th className="pb-3 px-4 font-semibold text-left">Type</th>
                          <th className="pb-3 px-4 font-semibold text-left">Missing Cells</th>
                          <th className="pb-3 px-4 font-semibold text-left">Unique Count</th>
                          <th className="pb-3 px-4 font-semibold text-left">Data Preview</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {profileData.columns.map((col, index) => (
                          <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-900">{col.name}</td>
                            <td className="py-3 px-4">
                              <span className="px-1.5 py-0.5 bg-slate-105 text-slate-600 border border-slate-200 rounded text-[10px] uppercase font-bold">
                                {col.type}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {col.stats.missing_count > 0 ? (
                                <span className="text-rose-600 font-bold">{col.stats.missing_count} ({col.stats.missing_percentage.toFixed(1)}%)</span>
                              ) : (
                                <span className="text-slate-400">None</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-700">{col.stats.unique_count}</td>
                            <td className="py-3 px-4 font-mono text-slate-500 select-all truncate max-w-[240px]">
                              {col.sample_values.join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Raw data preview */}
                <div className="glass-panel p-6 bg-white space-y-4">
                  <h3 className="font-heading font-bold text-lg text-slate-900">Raw Data Table Preview</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600 border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70">
                          {profileData.columns.map((c, i) => (
                            <th key={i} className="p-3.5 px-4 font-bold text-slate-700 uppercase tracking-wider text-left">{c.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {profileData.sample_data.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
                            {profileData.columns.map((c, cIdx) => (
                              <td key={cIdx} className="p-3 px-4 truncate max-w-[180px] text-slate-700">{String(row[c.name])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* 2. Tab CLEANING */}
            {!loading && activeTab === 'clean' && (
              <div className="space-y-6 fade-in">
                
                {/* Configuration controls */}
                <div className="glass-panel p-6 bg-white space-y-6">
                  <h3 className="font-heading font-bold text-lg text-slate-900">Automated Cleaning Wizard</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Imputation method */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Impute Missing Values</label>
                      <select
                        value={cleaningConfig.missing_values_method}
                        onChange={(e) => setCleaningConfig({ ...cleaningConfig, missing_values_method: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-950 text-sm"
                      >
                        <option value="mean">Numeric Mean / Categorical Mode</option>
                        <option value="median">Numeric Median / Categorical Mode</option>
                        <option value="mode">Categorical & Numeric Mode</option>
                        <option value="constant">Constant Value</option>
                        <option value="ffill">Forward Fill (ffill)</option>
                        <option value="bfill">Backward Fill (bfill)</option>
                        <option value="none">Do Not Impute</option>
                      </select>
                      {cleaningConfig.missing_values_method === 'constant' && (
                        <input
                          type="text"
                          placeholder="Constant value (e.g. 0 or N/A)"
                          value={cleaningConfig.missing_values_constant}
                          onChange={(e) => setCleaningConfig({ ...cleaningConfig, missing_values_constant: e.target.value })}
                          className="w-full px-4 py-2 mt-2 rounded-lg bg-white border border-slate-200 text-slate-950 text-xs"
                        />
                      )}
                    </div>

                    {/* Outliers */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Outlier Handling</label>
                      <div className="flex gap-2">
                        <select
                          value={cleaningConfig.outlier_method}
                          onChange={(e) => setCleaningConfig({ ...cleaningConfig, outlier_method: e.target.value })}
                          className="w-1/2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:border-violet-500 focus:outline-none"
                        >
                          <option value="iqr">IQR Method (1.5x)</option>
                          <option value="zscore">Z-Score Method (3.0x)</option>
                          <option value="none">Ignore Outliers</option>
                        </select>
                        <select
                          value={cleaningConfig.outlier_action}
                          onChange={(e) => setCleaningConfig({ ...cleaningConfig, outlier_action: e.target.value })}
                          disabled={cleaningConfig.outlier_method === 'none'}
                          className="w-1/2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm disabled:opacity-50 focus:border-violet-500 focus:outline-none"
                        >
                          <option value="highlight">Highlight Only</option>
                          <option value="remove">Drop Outlier Rows</option>
                          <option value="replace">Replace with Median</option>
                        </select>
                      </div>
                    </div>

                    {/* String formatting */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Text Case Standardization</label>
                      <select
                        value={cleaningConfig.text_case}
                        onChange={(e) => setCleaningConfig({ ...cleaningConfig, text_case: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:border-violet-500 focus:outline-none"
                      >
                        <option value="none">Keep Original Case</option>
                        <option value="lower">lowercase (e.g. hello)</option>
                        <option value="upper">UPPERCASE (e.g. HELLO)</option>
                        <option value="title">Title Case (e.g. Hello)</option>
                      </select>
                    </div>

                    {/* Checkbox columns - Refactored for spaciousness */}
                    <div className="md:col-span-2 bg-slate-50/50 rounded-2xl p-5 border border-slate-100/80 space-y-4 mt-2">
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Standardization & Deduplication Rules</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { id: 'remove_duplicates', label: 'Deduplicate redundant records', desc: 'Identify and remove identical rows.' },
                          { id: 'text_trim', label: 'Trim leading/trailing whitespaces', desc: 'Remove surrounding empty space from fields.' },
                          { id: 'remove_special_chars', label: 'Remove special characters', desc: 'Strip special characters from text fields.' },
                          { id: 'date_standardization', label: 'Normalize dates (YYYY-MM-DD)', desc: 'Convert recognized formats into standard ISO date.' },
                          { id: 'column_standardization', label: 'Normalize headers (snake_case)', desc: 'Convert all column headers to lowercase snake_case.' }
                        ].map(item => (
                          <label key={item.id} className="flex items-start gap-3 cursor-pointer p-3.5 rounded-xl bg-white border border-slate-200/60 hover:border-violet-300 hover:shadow-xs transition-all select-none">
                            <input
                              type="checkbox"
                              checked={cleaningConfig[item.id]}
                              onChange={(e) => setCleaningConfig({ ...cleaningConfig, [item.id]: e.target.checked })}
                              className="mt-0.5 w-4 h-4 rounded accent-violet-600 border-slate-300 focus:ring-violet-500/20 cursor-pointer"
                            />
                            <div>
                              <span className="block text-xs font-bold text-slate-800">{item.label}</span>
                              <span className="block text-[10px] text-slate-500 font-semibold mt-0.5">{item.desc}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleRunCleaning}
                      className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm transition-all glow-btn cursor-pointer"
                    >
                      Run Automated Cleaning & Save to Warehouse
                    </button>
                  </div>
                </div>

                {/* Show Results dials if ran */}
                {cleaningResults && (
                  <div className="glass-panel p-6 space-y-6 fade-in border-emerald-100 bg-emerald-50/40">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="font-heading font-bold text-lg text-emerald-700 m-0">Cleaning Completed Successfully</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Before and after scores */}
                      <div className="md:col-span-1 border border-slate-100 p-4 rounded-xl flex flex-col justify-center items-center bg-white text-center">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Quality Score Progress</span>
                        <div className="flex items-center gap-4 mt-3">
                          <div>
                            <span className="block text-slate-550 text-xs font-semibold">BEFORE</span>
                            <span className="text-xl font-bold text-slate-500">{cleaningResults.quality_scores.before.overall_score}%</span>
                          </div>
                          <div className="text-slate-400 text-lg">➔</div>
                          <div>
                            <span className="block text-emerald-650 text-xs font-bold">AFTER</span>
                            <span className="text-3xl font-heading font-bold text-emerald-600">{cleaningResults.quality_scores.after.overall_score}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Log details */}
                      <div className="md:col-span-2 grid grid-cols-3 gap-4">
                        <div className="border border-slate-100 p-4 rounded-xl bg-white">
                          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Imputed Values</span>
                          <span className="text-2xl font-bold text-slate-900 block mt-1">{cleaningResults.metrics.missing_values_removed}</span>
                        </div>
                        <div className="border border-slate-100 p-4 rounded-xl bg-white">
                          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Duplicates Dropped</span>
                          <span className="text-2xl font-bold text-slate-900 block mt-1">{cleaningResults.metrics.duplicates_removed}</span>
                        </div>
                        <div className="border border-slate-100 p-4 rounded-xl bg-white">
                          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Outliers Flagged</span>
                          <span className="text-2xl font-bold text-slate-900 block mt-1">{cleaningResults.metrics.outliers_detected}</span>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

              </div>
            )}

            {/* 3. Tab ANALYTICS */}
            {!loading && activeTab === 'analytics' && analyticsData && (
              <div className="space-y-6 fade-in">
                
                {/* Business Insights checklist */}
                {insightsData && (
                  <div className="glass-panel p-6 space-y-4 bg-violet-50/50 border-violet-100">
                    <h3 className="font-heading font-bold text-lg text-violet-700 m-0">AI Insights & Business Recommendations</h3>
                    
                    <div className="space-y-3">
                      {insightsData.insights.map((ins, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-white">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                            {ins.title}
                          </h4>
                          <p className="text-xs text-slate-655 mt-1">{ins.content}</p>
                        </div>
                      ))}
                    </div>

                    {insightsData.recommendations.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recommendations Checklist</h4>
                        <ul className="list-disc pl-4 text-xs text-slate-600 mt-2 space-y-1">
                          {insightsData.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Visual Data Profiling (Charts) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Chart 1: Numerical Distribution */}
                  <div className="glass-panel p-6 bg-white space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-heading font-bold text-lg text-slate-900">Numerical Distributions</h3>
                      {analyticsData.numeric_stats && Object.keys(analyticsData.numeric_stats).length > 0 && (
                        <select
                          value={selectedDistCol}
                          onChange={(e) => setSelectedDistCol(e.target.value)}
                          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-violet-500 cursor-pointer"
                        >
                          {Object.keys(analyticsData.numeric_stats).map((col, idx) => (
                            <option key={idx} value={col}>{col}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    
                    <div className="h-[260px] relative flex items-center justify-center">
                      {selectedDistCol && analyticsData.histograms && analyticsData.histograms[selectedDistCol] ? (
                        <Bar
                          data={{
                            labels: analyticsData.histograms[selectedDistCol].bins.slice(0, -1).map((val, idx) => 
                              `${val.toFixed(1)} - ${analyticsData.histograms[selectedDistCol].bins[idx+1].toFixed(1)}`
                            ),
                            datasets: [{
                              label: 'Frequency',
                              data: analyticsData.histograms[selectedDistCol].counts,
                              backgroundColor: 'rgba(108, 93, 211, 0.75)',
                              borderColor: '#6C5DD3',
                              borderWidth: 1,
                              borderRadius: 6,
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                              y: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.6)' } },
                              x: { grid: { display: false }, ticks: { font: { size: 9 } } }
                            }
                          }}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No histogram data available</span>
                      )}
                    </div>
                  </div>

                  {/* Chart 2: Categorical Pie/Doughnut */}
                  <div className="glass-panel p-6 bg-white space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-heading font-bold text-lg text-slate-900">Categorical Distributions</h3>
                      {analyticsData.categorical_distributions && Object.keys(analyticsData.categorical_distributions).length > 0 && (
                        <select
                          value={selectedCatCol}
                          onChange={(e) => setSelectedCatCol(e.target.value)}
                          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-violet-500 cursor-pointer"
                        >
                          {Object.keys(analyticsData.categorical_distributions).map((col, idx) => (
                            <option key={idx} value={col}>{col}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    
                    <div className="h-[260px] relative flex items-center justify-center">
                      {selectedCatCol && analyticsData.categorical_distributions[selectedCatCol] ? (
                        <Doughnut
                          data={{
                            labels: analyticsData.categorical_distributions[selectedCatCol].map(c => c.value),
                            datasets: [{
                              label: 'Count',
                              data: analyticsData.categorical_distributions[selectedCatCol].map(c => c.count),
                              backgroundColor: [
                                'rgba(108, 93, 211, 0.75)',
                                'rgba(6, 182, 212, 0.75)',
                                'rgba(16, 185, 129, 0.75)',
                                'rgba(244, 63, 94, 0.75)',
                                'rgba(245, 158, 11, 0.75)',
                                'rgba(99, 102, 241, 0.75)',
                              ],
                              borderWidth: 1,
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } }
                            }
                          }}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No categorical columns identified</span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Summaries list */}
                <div className="glass-panel p-6 bg-white space-y-4">
                  <h3 className="font-heading font-bold text-lg text-slate-900">Numeric Columns Statistics</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600 border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="pb-3 px-4 text-left">Variable</th>
                          <th className="pb-3 px-4 text-left">Count</th>
                          <th className="pb-3 px-4 text-left">Mean</th>
                          <th className="pb-3 px-4 text-left">Std Dev</th>
                          <th className="pb-3 px-4 text-left">Min</th>
                          <th className="pb-3 px-4 text-left">50% (Median)</th>
                          <th className="pb-3 px-4 text-left">Max</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-705">
                        {Object.entries(analyticsData.numeric_stats).map(([col, s], index) => (
                          <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4 font-sans font-semibold text-slate-900">{col}</td>
                            <td className="py-3 px-4 text-slate-700">{s.count}</td>
                            <td className="py-3 px-4 text-slate-700">{s.mean ? s.mean.toFixed(2) : '-'}</td>
                            <td className="py-3 px-4 text-slate-700">{s.std ? s.std.toFixed(2) : '-'}</td>
                            <td className="py-3 px-4 text-slate-700">{s.min ? s.min.toFixed(2) : '-'}</td>
                            <td className="py-3 px-4 text-slate-700">{s.percentile_50 ? s.percentile_50.toFixed(2) : (s.median ? s.median.toFixed(2) : '-')}</td>
                            <td className="py-3 px-4 text-slate-700">{s.max ? s.max.toFixed(2) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Heatmap Grid representation */}
                {Object.keys(analyticsData.correlation_matrix).length > 0 && (
                  <div className="glass-panel p-6 bg-white space-y-4">
                    <h3 className="font-heading font-bold text-lg text-slate-900">Correlation Coefficient Matrix</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-4 text-left font-semibold w-36 bg-slate-50/50 rounded-tl-lg">Columns</th>
                            {Object.keys(analyticsData.correlation_matrix).map((k, i) => (
                              <th key={i} className="py-3 px-3 text-center font-semibold min-w-[80px] max-w-[120px] truncate bg-slate-50/50 last:rounded-tr-lg">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {Object.entries(analyticsData.correlation_matrix).map(([rowCol, cellDict], rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-2.5 px-4 font-semibold text-slate-900 truncate w-36">{rowCol}</td>
                              {Object.entries(cellDict).map(([colName, val], cIdx) => {
                                const r = val !== null ? parseFloat(val) : 0;
                                let bg = 'bg-slate-50/50';
                                let textClr = 'text-slate-400';
                                if (val !== null) {
                                  if (r > 0.7) { bg = 'bg-violet-100/70'; textClr = 'text-violet-800 font-bold'; }
                                  else if (r > 0.4) { bg = 'bg-violet-50/60'; textClr = 'text-violet-750 font-semibold'; }
                                  else if (r < -0.7) { bg = 'bg-rose-100/70'; textClr = 'text-rose-800 font-bold'; }
                                  else if (r < -0.4) { bg = 'bg-rose-50/60'; textClr = 'text-rose-750 font-semibold'; }
                                  else { textClr = 'text-slate-850'; }
                                }
                                return (
                                  <td key={cIdx} className="p-1 text-center">
                                    <div
                                      className={`py-1.5 px-2 rounded-lg text-center font-mono text-[11px] ${bg} ${textClr} transition-all duration-150`}
                                      title={`${rowCol} x ${colName} = ${r.toFixed(4)}`}
                                    >
                                      {val !== null ? r.toFixed(2) : '-'}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* 4. Tab PREDICTIONS (ML Sandbox) */}
            {!loading && activeTab === 'ml' && mlOptions && (
              <div className="space-y-6 fade-in">
                
                {/* Configuration form */}
                <div className="glass-panel p-6 bg-white space-y-4">
                  <h3 className="font-heading font-bold text-lg text-slate-900">Predictive Modeling Sandbox</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-semibold text-slate-650">
                    
                    {/* Target */}
                    <div className="space-y-2">
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider">Target (Variable to Predict)</label>
                      <select
                        value={mlConfig.target_column}
                        onChange={(e) => setMlConfig({ ...mlConfig, target_column: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:border-violet-500 focus:outline-none"
                      >
                        {mlOptions.all_columns.map((c, i) => (
                          <option key={i} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Model Type */}
                    <div className="space-y-2">
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider">Task Type</label>
                      <select
                        value={mlConfig.model_type}
                        onChange={(e) => {
                          const type = e.target.value;
                          setMlConfig({
                            ...mlConfig,
                            model_type: type,
                            algorithm: type === 'regression' ? 'linear_regression' : (type === 'classification' ? 'logistic_regression' : 'kmeans')
                          });
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:border-violet-500 focus:outline-none"
                      >
                        <option value="regression">Regression (Continuous Numeric)</option>
                        <option value="classification">Classification (Categorical Labels)</option>
                        <option value="clustering">Clustering (Unsupervised Patterns)</option>
                      </select>
                    </div>

                    {/* Algorithms */}
                    <div className="space-y-2">
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider">Algorithm</label>
                      <select
                        value={mlConfig.algorithm}
                        onChange={(e) => setMlConfig({ ...mlConfig, algorithm: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:border-violet-500 focus:outline-none"
                      >
                        {mlConfig.model_type === 'regression' && (
                          <>
                            <option value="linear_regression">OLS Linear Regression</option>
                            <option value="random_forest">Random Forest Regressor</option>
                          </>
                        )}
                        {mlConfig.model_type === 'classification' && (
                          <>
                            <option value="logistic_regression">Logistic Regression</option>
                            <option value="random_forest">Random Forest Classifier</option>
                          </>
                        )}
                        {mlConfig.model_type === 'clustering' && (
                          <option value="kmeans">K-Means Clustering</option>
                        )}
                      </select>
                    </div>

                    {/* Feature selections - Re-designed to be clean grid */}
                    <div className="space-y-2 md:col-span-3">
                      <label className="block text-slate-500 font-bold text-[11px] uppercase tracking-wider">Feature Columns (Inputs to the Model)</label>
                      <div className="max-h-[160px] overflow-y-auto border border-slate-200/80 rounded-xl p-3 bg-slate-50/50 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {mlOptions.all_columns
                          .filter(c => c !== mlConfig.target_column)
                          .map((col, idx) => (
                            <label key={idx} className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg bg-white border border-slate-200/50 hover:border-violet-300 transition-all select-none">
                              <input
                                type="checkbox"
                                checked={mlConfig.feature_columns.includes(col)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setMlConfig({ ...mlConfig, feature_columns: [...mlConfig.feature_columns, col] });
                                  } else {
                                    setMlConfig({ ...mlConfig, feature_columns: mlConfig.feature_columns.filter(f => f !== col) });
                                  }
                                }}
                                className="rounded accent-violet-600 bg-white border border-slate-200 cursor-pointer"
                              />
                              <span className="text-xs text-slate-700 truncate font-semibold">{col}</span>
                            </label>
                          ))}
                      </div>
                    </div>

                  </div>

                  <button
                    onClick={handleTrainModel}
                    className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-sm transition-all glow-btn mt-2 cursor-pointer"
                  >
                    Train Machine Learning Model
                  </button>
                </div>

                {/* Model execution evaluations output */}
                {mlResults && (
                  <div className="glass-panel p-6 space-y-6 fade-in border-cyan-100 bg-cyan-50/30">
                    
                    {/* Performance metrics */}
                    <div>
                      <h4 className="text-sm font-bold text-cyan-650 mb-3">Model Accuracy Metrics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(mlResults.metrics).map(([mName, val], i) => (
                          <div key={i} className="p-3.5 border border-slate-100 rounded-xl bg-white shadow-xs">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">{mName.replace('_', ' ')}</span>
                            <span className="text-xl font-heading font-bold text-slate-900 mt-1 block">{typeof val === 'number' ? val.toFixed(4) : val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Feature Importances list */}
                    {Object.keys(mlResults.feature_importances).length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-cyan-650 mb-3">Estimated Feature Importances</h4>
                        <div className="space-y-2 bg-white border border-slate-100 p-4 rounded-xl">
                          {Object.entries(mlResults.feature_importances)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([fName, val], idx) => (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-600 font-semibold">
                                  <span>{fName}</span>
                                  <span>{(val * 100).toFixed(1)}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${val * 100}%` }}></div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Sample test results & Actual vs Predicted chart */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Left: Predictions Preview table */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-cyan-650">Predictions Preview</h4>
                        <div className="max-h-[260px] overflow-y-auto border border-slate-100 rounded-xl text-xs font-mono bg-white">
                          <table className="w-full text-left text-slate-650 border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50/70 font-sans text-[10px] uppercase font-bold text-slate-500">
                                <th className="py-2.5 px-4">Actual Value</th>
                                <th className="py-2.5 px-4">Predicted Value</th>
                                <th className="py-2.5 px-4 text-right">Residual</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {mlResults.predictions_preview.slice(0, 15).map((p, idx) => {
                                const residual = typeof p.actual === 'number' && typeof p.predicted === 'number'
                                  ? (p.actual - p.predicted).toFixed(3)
                                  : 'N/A';
                                return (
                                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-2.5 px-4 text-slate-800">{p.actual}</td>
                                    <td className="py-2.5 px-4 text-cyan-600 font-semibold">{p.predicted}</td>
                                    <td className="py-2.5 px-4 text-right text-slate-500">{residual}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right: Actual vs Predicted Graph */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-cyan-650">Actual vs. Predicted Performance</h4>
                        <div className="h-[260px] border border-slate-100 rounded-xl bg-white p-4 relative">
                          {mlResults.predictions_preview && mlResults.predictions_preview.length > 0 ? (
                            renderMlChart()
                          ) : (
                            <span className="text-xs text-slate-400 flex items-center justify-center h-full">No prediction samples available</span>
                          )}
                        </div>
                      </div>

                    </div>

                  </div>
                )}

              </div>
            )}

            {/* 5. Tab CHATBOT */}
            {activeTab === 'chat' && (
              <div className="glass-panel p-6 bg-white flex flex-col h-[500px] justify-between fade-in">
                
                {/* Message display feed */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scroll-smooth">
                  
                  {/* Default welcome message */}
                  <div className="flex gap-3 max-w-[85%] items-start">
                    <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
                      B
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed">
                      Hello! I am your AI Data Assistant. Ask me statistics, averages, totals, or list queries on the cleaned database.
                      <br /><br />
                      *For example:*
                      <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-slate-500 font-semibold">
                        <li>Show me first 5 records</li>
                        <li>What is the total row count?</li>
                        <li>Show average values in the dataset</li>
                      </ul>
                    </div>
                  </div>

                  {/* Chat feed loop */}
                  {chatHistory.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 max-w-[85%] items-start ${
                        msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0 ${
                        msg.role === 'user' ? 'bg-cyan-600' : 'bg-violet-600'
                      }`}>
                        {msg.role === 'user' ? 'U' : 'B'}
                      </div>
                      <div className={`rounded-2xl p-4 text-sm leading-relaxed border ${
                        msg.role === 'user'
                          ? 'bg-cyan-50 border-cyan-100 text-slate-800'
                          : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}>
                        
                        {/* Text reply */}
                        <div className="whitespace-pre-wrap">{msg.content}</div>

                        {/* SQL trace details if debugging */}
                        {msg.sql && (
                          <div className="mt-2 font-mono text-[9px] text-slate-550 bg-slate-100 p-1.5 rounded select-all border border-slate-200">
                            <span className="text-[8px] font-bold text-violet-600 block font-sans mb-0.5">COMPILED SQL:</span>
                            {msg.sql}
                          </div>
                        )}                        {/* Render data table if chatbot returned result rows */}
                        {msg.data && msg.data.length > 0 && (
                          <div className="mt-3 overflow-x-auto max-w-full rounded-lg border border-slate-200 text-[11px] font-sans">
                            <table className="w-full text-left text-slate-650 border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-105/85 font-bold text-[10px] text-slate-550">
                                  {Object.keys(msg.data[0]).map((h, i) => (
                                    <th key={i} className="py-2.5 px-4 capitalize text-left">{h.replace('_', ' ')}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {msg.data.slice(0, 5).map((row, rIdx) => (
                                  <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                                    {Object.values(row).map((val, cIdx) => (
                                      <td key={cIdx} className="py-2.5 px-4 text-slate-800 truncate max-w-[150px]">{String(val)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {msg.data.length > 5 && (
                              <div className="p-1.5 text-center bg-slate-50 text-[9px] text-slate-500 font-bold border-t border-slate-100">
                                showing top 5 of {msg.data.length} results
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex gap-3 max-w-[85%] items-start">
                      <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
                        B
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-500">
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Processing SQL query...
                        </span>
                      </div>
                    </div>
                  )}

                </div>

                {/* Input prompt form bar */}
                <form onSubmit={handleSendChatMessage} className="flex gap-2 border-t border-slate-100 pt-4">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type natural language query (e.g. show average price by region)..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 transition-all duration-205"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow-md"
                  >
                    Ask AI
                  </button>
                </form>

              </div>
            )}



          </div>
        ) : (
          /* Empty placeholder screen */
          <div className="glass-panel p-16 bg-white flex flex-col items-center justify-center text-center space-y-4 h-full min-h-[400px]">
            <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 border border-violet-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-heading font-bold text-xl text-slate-900">No Dataset Selected</h3>
            <p className="text-slate-500 text-sm max-w-sm font-semibold">
              Please choose a dataset from the list, or upload a raw CSV/Excel file in the side panel to enter the analytics workspace.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

export default Datasets;
