import React, { ReactNode, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, BarChart3, Users, User, LogOut, Eye, CalendarDays } from 'lucide-react';
import { upcomingInterviews } from '../../utils/interviews';
import { useAppContext } from '../../context/AppContext';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isMentorView, interviews } = useAppContext();

  // Interviews in the next seven days, so a booked call is visible from any page.
  const interviewBadge = useMemo(() => {
    const week = Date.now() + 7 * 86_400_000;
    return upcomingInterviews(interviews).filter(i => new Date(i.startsAt).getTime() < week).length;
  }, [interviews]);

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: 0 },
    { path: '/applications', icon: Briefcase, label: 'Applications', badge: 0 },
    { path: '/interviews', icon: CalendarDays, label: 'Interviews', badge: interviewBadge },
    { path: '/analytics', icon: BarChart3, label: 'Analytics', badge: 0 },
    { path: '/network', icon: Users, label: 'Network', badge: 0 },
    { path: '/profile', icon: User, label: 'Profile', badge: 0 },
  ];

  const isActive = (path: string) => location.pathname === path;

  // The nav is mono uppercase links on an engraved rule; the current page is arc
  // with an arc underline. The interview badge is a small gold count: someone
  // is waiting on you this week.
  const navButton = (item: typeof navItems[number], mobile = false) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-2 min-h-[44px] px-1 -mb-[2px] border-b-2 whitespace-nowrap font-mono text-label uppercase tracking-stamp transition-colors ${active
          ? 'text-arc border-arc'
          : 'text-ink-dim border-transparent hover:text-ink'
          }`}
      >
        <Icon className={mobile ? 'w-4 h-4' : 'w-[18px] h-[18px]'} strokeWidth={1.6} />
        <span>{item.label}</span>
        {item.badge > 0 && (
          <span className="tag text-gold" aria-label={`${item.badge} this week`}>{item.badge > 9 ? '9+' : item.badge}</span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen">
      <nav className="bg-ground sticky top-0 z-40 border-b-2 border-engrave">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between gap-6 min-h-[56px]">
            <button className="wordmark min-h-[44px]" onClick={() => navigate('/dashboard')}>ApplyQuest</button>

            <div className="hidden lg:flex items-center gap-5 self-end">
              {navItems.map((item) => navButton(item))}
            </div>

            <div className="flex items-center gap-3">
              {isMentorView && (
                <span className="hidden md:flex items-center gap-2 stamp uppercase text-gold">
                  <Eye className="w-4 h-4" strokeWidth={1.6} />
                  Read-only
                </span>
              )}
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-ink">{user?.name || 'Guest'}</p>
                <p className="stamp">
                  {isMentorView ? 'Mentor view' : `Level ${user?.level || 1} · ${user?.points || 0} pts`}
                </p>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="btn btn-quiet btn-icon border-transparent"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-5 h-5" strokeWidth={1.6} />
              </button>
            </div>
          </div>

          {/* Narrow windows: the same links, scrolling sideways. */}
          <div className="lg:hidden flex gap-5 overflow-x-auto">
            {navItems.map((item) => navButton(item, true))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;