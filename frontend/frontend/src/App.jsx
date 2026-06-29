import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

// Import Pages & Components
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Datasets from './pages/Datasets';
import Chatbot from './pages/Chatbot';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get('http://127.0.0.1:8000/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setUser(response.data);
    } catch (err) {
      console.error('Session expired or invalid token', err);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <svg className="animate-spin h-8 w-8 text-violet-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" /> : <Login onLoginSuccess={fetchCurrentUser} />} 
        />
        <Route 
          path="/register" 
          element={user ? <Navigate to="/dashboard" /> : <Register />} 
        />

        {/* Private Dashboard Routes */}
        <Route
          path="/*"
          element={
            user ? (
              <div className="flex bg-slate-50/30 min-h-screen">
                {/* Sidebar Navigation */}
                <Sidebar user={user} onLogout={handleLogout} />

                {/* Main Content Pane */}
                <main className="flex-1 pl-64 min-h-screen">
                  <div className="p-8 md:p-12 max-w-7xl mx-auto w-full">
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/datasets" element={<Datasets user={user} />} />
                      <Route path="/chatbot" element={<Chatbot />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </div>
                </main>
              </div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
