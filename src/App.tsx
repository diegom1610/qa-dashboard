import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { AgentDashboard } from './components/AgentDashboard';
import { BarChart3, Users } from 'lucide-react';

type ViewMode = 'reviewer' | 'agent';

function AppContent() {
  const { user, loading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('reviewer');

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
      <AppContent />
    </AuthProvider>
  );
}

export default App;
