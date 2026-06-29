import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Email TLD check (must be >= 2 characters, e.g. .in, .com)
    const emailParts = email.split('@');
    if (emailParts.length !== 2) {
      setError('Please enter a valid email address.');
      return;
    }
    const domainParts = emailParts[1].split('.');
    if (domainParts.length < 2 || domainParts[domainParts.length - 1].length < 2) {
      setError('Email address must end with a valid extension (e.g., .in or .com).');
      return;
    }

    // Password validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/auth/login', {
        email,
        password,
      });

      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      
      // Notify parent app
      await onLoginSuccess();
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      let errMsg = 'Failed to login. Please check your credentials.';
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          errMsg = err.response.data.detail.map(d => d.msg).join(', ');
        } else {
          errMsg = err.response.data.detail;
        }
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-8 glass-panel p-8 md:p-10 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-violet-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-cyan-600/10 rounded-full blur-3xl"></div>

        <div className="text-center relative z-10">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-violet-500/20 mb-4">
            S
          </div>
          <h2 className="font-heading font-bold text-3xl text-slate-900 tracking-tight">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to automate your data engineering & BI
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium fade-in">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6 relative z-10" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 transition-all duration-200 text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 transition-all duration-200 text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 glow-btn transition-all duration-300 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        <div className="text-center text-sm text-slate-500 relative z-10">
          Don't have an account?{' '}
          <Link to="/register" className="font-bold text-violet-600 hover:text-violet-500 transition-colors">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
