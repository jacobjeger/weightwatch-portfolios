import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoginModal, SignUpModal } from './AuthModals';

const ADVISOR_LINKS = [
  { to: '/',           label: 'Dashboard' },
  { to: '/portfolio/new', label: 'Portfolio Builder' },
  { to: '/benchmarks', label: 'Benchmarks' },
  { to: '/messages',   label: 'Messages' },
  { to: '/meetings',   label: 'Meetings' },
  { to: '/history',    label: 'History' },
  { to: '/settings',   label: 'Settings' },
  { to: '/help',       label: 'Help' },
];

const CLIENT_LINKS = [
  { to: '/',               label: 'Dashboard' },
  { to: '/client-portal',  label: 'My Portal' },
  { to: '/messages',       label: 'Messages' },
  { to: '/meetings',       label: 'Meetings' },
  { to: '/settings',       label: 'Settings' },
  { to: '/help',           label: 'Help' },
];

function NavItem({ to, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `text-sm font-medium px-2 py-1 rounded transition-colors whitespace-nowrap ${
          isActive
            ? 'text-white bg-white/10'
            : 'text-slate-300 hover:text-white hover:bg-white/5'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function Nav() {
  const { user, signOut, isMockMode, role } = useAuth();
  const LINKS = role === 'client' ? CLIENT_LINKS : ADVISOR_LINKS;
  const navigate = useNavigate();
  const location = useLocation();
  const [modal, setModal] = useState(null); // 'login' | 'signup' | null
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-open login modal when redirected from a protected page
  useEffect(() => {
    if (location.state?.requireAuth && !user) {
      setModal('login');
    }
  }, [location.state, user]);

  function closeModal() { setModal(null); }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <>
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2 flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-white text-sm leading-tight">
                WeightWatch<br />
                <span className="font-normal text-slate-400 text-xs">Portfolios</span>
              </span>
            </NavLink>

            {/* Desktop nav links */}
            {user && (
              <div className="hidden lg:flex items-center gap-1 ml-6">
                {LINKS.map((l) => <NavItem key={l.to} {...l} />)}
              </div>
            )}

            {/* Right side */}
            <div className="flex items-center gap-3 ml-auto">
              {isMockMode && (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Demo mode
                </span>
              )}

              {user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:block text-xs text-slate-400 max-w-[140px] truncate">
                    {user.email}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Log Out</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
                    onClick={() => setModal('login')}
                  >
                    Log In
                  </button>
                  <button
                    className="text-sm btn bg-blue-600 text-white hover:bg-blue-500"
                    onClick={() => setModal('signup')}
                  >
                    Sign Up
                  </button>
                </div>
              )}

              {/* Mobile hamburger */}
              {user && (
                <button
                  className="lg:hidden text-slate-300 hover:text-white"
                  onClick={() => setMobileOpen((o) => !o)}
                >
                  {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && user && (
          <div className="lg:hidden border-t border-slate-800 px-4 py-3 flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavItem key={l.to} {...l} onClick={() => setMobileOpen(false)} />
            ))}
          </div>
        )}
      </nav>

      {/* Auth modals */}
      {modal === 'login' && (
        <LoginModal
          onClose={closeModal}
          onSwitchToSignUp={() => setModal('signup')}
        />
      )}
      {modal === 'signup' && (
        <SignUpModal
          onClose={closeModal}
          onSwitchToLogin={() => setModal('login')}
        />
      )}
    </>
  );
}
