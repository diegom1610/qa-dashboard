import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { Dashboard } from './components/Dashboard';
import { AgentDashboard } from './components/AgentDashboard';

type ViewMode = 'reviewer' | 'agent';

function AppContent() {
  const { user, loading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('reviewer');
  const location = useLocation();

  // Supabase's recovery link redirects to whatever "Site URL" is configured
  // for the project, which may not be /reset-password (e.g. a recovery email
  // sent manually from the Supabase dashboard has no way to request a
  // specific redirect). If the recovery hash lands anywhere else, forward it
  // to the page that knows how to use it instead of losing the token behind
  // the login screen.
  if (location.hash.includes('type=recovery') || location.hash.includes('error_description')) {
    return <Navigate to={`/reset-password${location.hash}`} replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div>
      {viewMode === 'reviewer' ? (
        <Dashboard viewMode={viewMode} onViewModeChange={setViewMode} />
      ) : (
        <AgentDashboard viewMode={viewMode} onViewModeChange={setViewMode} />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Accessible without being logged in - Supabase sends users here via a recovery link */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
