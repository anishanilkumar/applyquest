import React, { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, BarChart3, Users, User, LogOut, Eye } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isMentorView } = useAppContext();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: 0 },
    { path: '/applications', icon: Briefcase, label: 'Applications', badge: 0 },
    { path: '/analytics', icon: BarChart3, label: 'Analytics', badge: 0 },
    { path: '/network', icon: Users, label: 'Network', badge: 0 },
    { path: '/profile', icon: User, label: 'Profile', badge: 0 },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-2">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">ApplyQuest</h1>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${isActive(item.path)
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                    {item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {isMentorView && (
                <span className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium">
                  <Eye className="w-3.5 h-3.5" />
                  Read-only
                </span>
              )}
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-gray-800">{user?.name || 'Guest'}</p>
                <p className="text-xs text-gray-500">
                  {isMentorView ? 'Mentor View' : `Level ${user?.level || 1} • ${user?.points || 0} pts`}
                </p>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden mt-4 flex gap-2 overflow-x-auto pb-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${isActive(item.path)
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-600 bg-gray-100'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;