import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MarketDataProvider } from './context/MarketDataContext';
import ProtectedRoute from './components/ProtectedRoute';
import Nav from './components/Nav';
import Dashboard from './pages/Dashboard';
import PortfolioBuilder from './pages/PortfolioBuilder';
import Benchmarks from './pages/Benchmarks';
import History from './pages/History';
import AccountSettings from './pages/AccountSettings';
import HelpTour from './pages/HelpTour';
import ResetPassword from './pages/ResetPassword';
import ShareView from './pages/ShareView';
import InviteView from './pages/InviteView';

export default function App() {
  return (
    <AuthProvider>
      <MarketDataProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1">
            <Routes>
              {/* Public */}
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/share/:token" element={<ShareView />} />
              <Route path="/invite/:token" element={<InviteView />} />

              {/* Protected */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/portfolio/new" element={<PortfolioBuilder />} />
                <Route path="/portfolio/:id" element={<PortfolioBuilder />} />
                <Route path="/benchmarks" element={<Benchmarks />} />
                <Route path="/history" element={<History />} />
                <Route path="/settings" element={<AccountSettings />} />
                <Route path="/help" element={<HelpTour />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
      </MarketDataProvider>
    </AuthProvider>
  );
}
