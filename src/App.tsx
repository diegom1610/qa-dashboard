import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { AgentDashboard } from './components/AgentDashboard';
import { BarChart3, Users, LogOut } from 'lucide-react';

type ViewMode = 'reviewer' | 'agent';

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('reviewer');

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

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
      {/* Fixed navigation bar */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex bg-white rounded-lg shadow-lg p-1 border border-slate-200">
          <button
            onClick={() => setViewMode('reviewer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              viewMode === 'reviewer'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Reviewer
          </button>
          <button
            onClick={() => setViewMode('agent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              viewMode === 'agent'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Agent
          </button>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-lg border border-slate-200 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      {viewMode === 'reviewer' ? <Dashboard /> : <AgentDashboard />}
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