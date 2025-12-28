/**
 * DASHBOARD COMPONENT
 *
 * PURPOSE:
 * Main application component that orchestrates all dashboard features.
 *
 * WHY SINGLE CONTAINER:
 * - Manages global state (filters)
 * - Coordinates data flow between components
 * - Provides consistent layout and navigation
 *
 * ARCHITECTURE:
 * Dashboard (state management)
 *   ├── Header (logo, user info, logout)
 *   ├── FilterBar (filter controls)
 *   ├── MetricsGrid (summary KPIs)
 *   └── ConversationTable (detailed data + feedback)
 *       ├── FeedbackHistory (existing reviews)
 *       └── FeedbackPanel (submit new review)
 */

import { useState } from 'react';
import { LogOut, BarChart3, RefreshCw, X, Menu, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMetrics } from '../hooks/useMetrics';
import { useAgents } from '../hooks/useAgents';
import { useFeedback } from '../hooks/useFeedback';
import { FilterBar } from './FilterBar';
import { MetricsGrid } from './MetricsGrid';
import { ConversationTable } from './ConversationTable';
import { ConversationViewer } from './ConversationViewer';
import { Sidebar } from './Sidebar';
import type { FilterState } from '../types/database';

type ViewMode = 'reviewer' | 'agent';

interface DashboardProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

/**
 * GET DEFAULT DATE RANGE
 *
 * WHY LAST 30 DAYS:
 * Showing all historical data by default can be overwhelming and slow.
 * Last 30 days provides relevant recent data while keeping queries fast.
 *
 * Users can still adjust the date range to see older data if needed.
 */
const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

/**
 * INITIAL FILTER STATE
 *
 * WHY DEFAULTS:
 * Start with last 30 days of data - show recent, relevant conversations.
 * Users can adjust date range or clear filters to see more/less data.
 */
const initialFilters: FilterState = {
  agentIds: [],
  conversationId: '',
  ...getDefaultDateRange(),
  resolutionStatus: null,
};

/**
 * DASHBOARD COMPONENT
 */
export function Dashboard({ viewMode, onViewModeChange }: DashboardProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [syncing, setSyncing] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { agents, loading: agentsLoading } = useAgents(true);
  const { metrics, loading: metricsLoading, error, refetch } = useMetrics(filters);
  const { feedback: allFeedback, refetch: refetchFeedback } = useFeedback();

  const handleFeedbackSubmitted = () => {
    refetchFeedback();
    refetch();
  };

  /**
   * HANDLE INTERCOM SYNC
   *
   * Syncs last 30 days of Intercom conversations
   */
  const handleIntercomSync = async () => {
    setSyncing(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-intercom-conversations`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days: 30 }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Intercom sync failed: ${response.statusText}`);
      }

      const result = await response.json();
      alert(`Intercom sync completed!\n\nProcessed: ${result.conversations_processed || 0} conversations`);

      refetch();
    } catch (error) {
      console.error('Intercom sync failed:', error);
      alert(`Failed to sync Intercom:\n${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  /**
   * HANDLE LOGOUT
   *
   * HOW IT WORKS:
   * 1. Call signOut from AuthContext
   * 2. AuthContext clears session
   * 3. App.tsx detects no user, shows LoginPage
   */
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Failed to logout. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                title="Open settings"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  QA Dashboard
                </h1>
                <p className="text-xs text-slate-600">
                  Agent Performance Metrics
                </p>
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => onViewModeChange('reviewer')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    viewMode === 'reviewer'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Reviewer
                </button>
                <button
                  onClick={() => onViewModeChange('agent')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    viewMode === 'agent'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Agent
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={refetch}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                title="Refresh data"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              {/* User Info */}
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-slate-900">
                  {user?.email}
                </p>
                <p className="text-xs text-slate-600">Reviewer</p>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filter Section */}
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          agents={agents}
          agentsLoading={agentsLoading}
        />

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">Error loading data</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Metrics Grid */}
        {!error && (
          <>
            <MetricsGrid metrics={metrics} allFeedback={allFeedback} />

            <div className={`grid gap-6 ${selectedConversationId ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              <div className={selectedConversationId ? 'lg:col-span-1' : 'col-span-1'}>
                <ConversationTable
                  metrics={metrics}
                  loading={metricsLoading}
                  onViewConversation={(conversationId) => {
                    setSelectedConversationId(conversationId);
                  }}
                  selectedConversationId={selectedConversationId}
                  onFeedbackSubmitted={handleFeedbackSubmitted}
                />
              </div>

              {selectedConversationId && (
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden sticky top-24">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                      <h2 className="text-lg font-semibold text-slate-900">
                        Conversation Preview
                      </h2>
                      <button
                        onClick={() => {
                          setSelectedConversationId(null);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      >
                        <X className="w-4 h-4" />
                        Close Preview
                      </button>
                    </div>
                    <div className="h-[calc(100vh-200px)] max-h-[800px]">
                      <ConversationViewer conversationId={selectedConversationId} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              QA Dashboard &copy; {new Date().getFullYear()}
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <a href="#" className="hover:text-slate-900 transition">
                Help
              </a>
              <span>•</span>
              <a href="#" className="hover:text-slate-900 transition">
                Documentation
              </a>
              <span>•</span>
              <a href="#" className="hover:text-slate-900 transition">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
