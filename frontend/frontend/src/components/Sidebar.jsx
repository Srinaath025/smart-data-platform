import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();

  const menuItems = [
    {
      path: '/dashboard',
      name: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      )
    },
    {
      path: '/datasets',
      name: 'Datasets',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      )
    },
    {
      path: '/chatbot',
      name: 'AI Chatbot',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    }
  ];



  return (
    <div className="w-64 h-screen bg-white border-r border-slate-100 flex flex-col justify-between fixed top-0 left-0 z-20">
      <div>
        {/* Logo/Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/20">
              S
            </div>
            <div>
              <span className="font-heading font-bold text-slate-900 tracking-wide">SmartData</span>
              <span className="text-xs block text-violet-600 font-semibold -mt-1">AI Automation</span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-6 px-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium ${
                  isActive
                    ? 'bg-violet-50 text-violet-700 font-semibold border border-violet-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`
              }
            >
              <div className="transition-transform duration-200 group-hover:scale-110">
                {item.icon}
              </div>
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User profile footer & logout */}
      <div className="p-4 border-t border-slate-100 bg-slate-50">
        {user && (
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center font-bold text-violet-600">
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-semibold text-slate-900 truncate">{user.name}</h4>
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 hover:border-rose-500/20 text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 transition-all duration-200 text-sm font-semibold cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
