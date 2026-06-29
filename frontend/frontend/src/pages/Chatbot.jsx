import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function Chatbot() {
  const [datasets, setDatasets] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingDs, setFetchingDs] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, loading]);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get('http://127.0.0.1:8000/api/datasets', { headers });
        const cleanedOnly = res.data.filter(d => d.status === 'Cleaned');
        setDatasets(cleanedOnly);
        if (cleanedOnly.length > 0) {
          setSelectedId(cleanedOnly[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch datasets for chatbot', err);
      } finally {
        setFetchingDs(false);
      }
    };
    fetchDatasets();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedId) return;

    const userMsg = message;
    setMessage('');
    setHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(
        `http://127.0.0.1:8000/api/datasets/${selectedId}/chat`,
        { message: userMsg },
        { headers }
      );
      setHistory(prev => [...prev, {
        role: 'assistant',
        content: res.data.response,
        data: res.data.data,
        sql: res.data.sql
      }]);
    } catch (err) {
      setHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Failed to query the dataset. Make sure it is cleaned and available.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const activeDataset = datasets.find(d => String(d.id) === String(selectedId));

  if (fetchingDs) {
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
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col justify-between fade-in">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-heading font-bold text-3xl text-slate-900 tracking-tight m-0">Natural Language Chatbot</h1>
          <p className="text-slate-600 text-xs mt-1">Select a cleaned warehouse table and query it using conversational English.</p>
        </div>

        {/* Dropdown selector */}
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Active Table:</label>
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setHistory([]);
            }}
            className="flex-1 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-semibold cursor-pointer outline-none focus:border-violet-500"
          >
            {datasets.length === 0 ? (
              <option value="">No Cleaned Datasets</option>
            ) : (
              datasets.map(ds => (
                <option key={ds.id} value={ds.id}>{ds.file_name}</option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Main chat window */}
      <div className="glass-panel bg-white flex-1 flex flex-col justify-between p-6 overflow-hidden min-h-[300px]">
        
        {/* Messages feed */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scroll-smooth">
          
          {/* Welcome robot */}
          <div className="flex gap-3 max-w-[85%] items-start">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
              B
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed">
              {datasets.length === 0 ? (
                <span>
                  No cleaned datasets detected in the warehouse. Please go to the **Datasets** tab, upload a file, and click **Run Automated Cleaning** first to load it into the SQL warehouse.
                </span>
              ) : (
                <span>
                  Connected to **{activeDataset?.file_name}**!
                  <br /><br />
                  Ask me anything like:
                  <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-slate-500 font-bold">
                    <li>Show me a list of records</li>
                    <li>What is the average of numerical fields?</li>
                    <li>Calculate the sum of a column grouped by another column</li>
                  </ul>
                </span>
              )}
            </div>
          </div>

          {/* History */}
          {history.map((msg, index) => (
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
                  ? 'bg-cyan-50 border-cyan-100 text-slate-855'
                  : 'bg-slate-50 border-slate-100 text-slate-800'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {loading && (
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
                  Compiling statistics...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-100 pt-4">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!selectedId}
            placeholder={selectedId ? "Ask a question about the active SQL table..." : "Please clean a dataset first to begin chat"}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 transition-all duration-200 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!selectedId || !message.trim() || loading}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-100 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            Send
          </button>
        </form>

      </div>
    </div>
  );
}

export default Chatbot;
