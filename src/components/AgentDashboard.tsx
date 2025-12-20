import { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { QAMetric, HumanFeedback, Workspace, AgentGroup } from '../types/database';
import { AgentPerformanceStats } from './AgentPerformanceStats';
import { AgentPerformanceTable } from './AgentPerformanceTable';
import { AgentConversationsTable } from './AgentConversationsTable';

type DateRangeType = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom' | 'all';

export function AgentDashboard() {
  const [metrics, setMetrics] = useState<QAMetric[]>([]);
  const [filteredMetrics, setFilteredMetrics] = useState<QAMetric[]>([]);
  const [allFeedback, setAllFeedback] = useState<HumanFeedback[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');
  const [selectedReviewer, setSelectedReviewer] = useState<string>('all');
  const [selectedReviewee, setSelectedReviewee] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeType>('last_30_days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [showHumanReviewedOnly, setShowHumanReviewedOnly] = useState(false);

  const { user, signOut } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [metrics, allFeedback, selectedWorkspace, selectedReviewer, selectedReviewee, selectedGroup, dateRange, customStartDate, customEndDate, showHumanReviewedOnly]);

  const getDateRange = (): { startDate: Date | null; endDate: Date | null } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case 'today':
        return { startDate: today, endDate: now };

      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { startDate: yesterday, endDate: today };
      }

      case 'this_week': {
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        return { startDate: startOfWeek, endDate: now };
      }

      case 'last_week': {
        const dayOfWeek = today.getDay();
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - dayOfWeek - 7);
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 7);
        return { startDate: startOfLastWeek, endDate: endOfLastWeek };
      }

      case 'this_month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: startOfMonth, endDate: now };
      }

      case 'last_month': {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return { startDate: startOfLastMonth, endDate: endOfLastMonth };
      }

      case 'this_year': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return { startDate: startOfYear, endDate: now };
      }

      case 'last_year': {
        const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
        return { startDate: startOfLastYear, endDate: endOfLastYear };
      }

      case 'last_7_days': {
        const start = new Date(today);
        start.setDate(start.getDate() - 7);
        return { startDate: start, endDate: now };
      }

      case 'last_30_days': {
        const start = new Date(today);
        start.setDate(start.getDate() - 30);
        return { startDate: start, endDate: now };
      }

      case 'last_90_days': {
        const start = new Date(today);
        start.setDate(start.getDate() - 90);
        return { startDate: start, endDate: now };
      }

      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            startDate: new Date(customStartDate),
            endDate: new Date(customEndDate + 'T23:59:59')
          };
        }
        return { startDate: null, endDate: null };

      case 'all':
      default:
        return { startDate: null, endDate: null };
    }
  };

  /**
 * FIXED fetchData function for AgentDashboard.tsx
 * 
 * PROBLEM: The original code loads only the 1000 most recent metrics by metric_date.
 * Human-reviewed conversations may have older metric_dates and get excluded.
 * 
 * SOLUTION: 
 * 1. First fetch human_feedback to get all reviewed conversation_ids
 * 2. Then fetch metrics in two batches:
 *    - Recent metrics (limited to 10000)
 *    - Metrics specifically for human-reviewed conversations (no limit)
 * 3. Merge the two sets, removing duplicates
 * 
 * REPLACE the fetchData function (lines 126-192) with this code
 */

const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);

    // Step 1: Fetch ALL human feedback first
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('human_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (feedbackError) throw feedbackError;

    console.log('Human feedback loaded:', feedbackData?.length || 0);

    // Step 2: Get unique conversation IDs that have human feedback
    const reviewedConversationIds = [...new Set((feedbackData || []).map(f => f.conversation_id))];
    console.log('Unique reviewed conversation IDs:', reviewedConversationIds.length);

    // Step 3: Fetch recent metrics (main batch)
    const { data: recentMetricsData, error: recentMetricsError } = await supabase
      .from('qa_metrics')
      .select('*')
      .order('metric_date', { ascending: false })
      .limit(10000);

    if (recentMetricsError) throw recentMetricsError;

    console.log('Recent metrics loaded:', recentMetricsData?.length || 0);

    // Step 4: Fetch metrics specifically for human-reviewed conversations
    // This ensures they're included even if their metric_date is older
    let reviewedMetricsData: typeof recentMetricsData = [];
    
    if (reviewedConversationIds.length > 0) {
      const { data: reviewedData, error: reviewedError } = await supabase
        .from('qa_metrics')
        .select('*')
        .in('conversation_id', reviewedConversationIds);

      if (reviewedError) {
        console.error('Error fetching reviewed metrics:', reviewedError);
      } else {
        reviewedMetricsData = reviewedData || [];
        console.log('Reviewed metrics loaded:', reviewedMetricsData.length);
      }
    }

    // Step 5: Merge the two sets, removing duplicates
    const metricsMap = new Map<string, typeof recentMetricsData[0]>();
    
    // Add recent metrics first
    (recentMetricsData || []).forEach(metric => {
      metricsMap.set(metric.conversation_id, metric);
    });
    
    // Add/overwrite with reviewed metrics (ensures they're included)
    reviewedMetricsData.forEach(metric => {
      metricsMap.set(metric.conversation_id, metric);
    });

    const mergedMetricsData = Array.from(metricsMap.values());
    console.log('Merged metrics total:', mergedMetricsData.length);

    // Step 6: Join human_feedback with metrics AND UPDATE rating_source
    const metricsWithFeedback = mergedMetricsData.map(metric => {
      const humanFeedback = (feedbackData || []).filter(f => f.conversation_id === metric.conversation_id);
      
      // UPDATE rating_source based on available feedback
      let ratingSource = metric.rating_source || 'none';
      if (humanFeedback.length > 0) {
        ratingSource = metric.ai_score !== null ? 'both' : 'human';
      } else if (metric.ai_score !== null) {
        ratingSource = 'ai';
      }
      
      return {
        ...metric,
        human_feedback: humanFeedback,
        rating_source: ratingSource,
      };
    });

    // Sort by metric_date descending after merge
    metricsWithFeedback.sort((a, b) => {
      const dateA = a.metric_date || '';
      const dateB = b.metric_date || '';
      return dateB.localeCompare(dateA);
    });

    const { data: workspacesData, error: workspacesError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('active', true)
      .order('display_name');

    if (workspacesError) throw workspacesError;

    const { data: groupsData, error: groupsError } = await supabase
      .from('agent_groups')
      .select('*')
      .eq('active', true)
      .order('display_name');

    if (groupsError) throw groupsError;

    setMetrics(metricsWithFeedback);
    setAllFeedback(feedbackData || []);
    setWorkspaces(workspacesData || []);
    setGroups(groupsData || []);

    // Debug: Verify human-reviewed conversations are in metrics
    const loadedConvIds = new Set(metricsWithFeedback.map(m => m.conversation_id));
    const missingReviewed = reviewedConversationIds.filter(id => !loadedConvIds.has(id));
    console.log('Missing reviewed conversations:', missingReviewed.length);
    if (missingReviewed.length > 0) {
      console.log('Missing IDs:', missingReviewed.slice(0, 5));
    }

  } catch (err) {
    console.error('Error fetching data:', err);
    setError(err instanceof Error ? err.message : 'An error occurred');
  } finally {
    setLoading(false);
  }
};

  /**
 * FIXED applyFilters function for AgentDashboard.tsx
 * 
 * REPLACE lines 194-262 in your AgentDashboard.tsx with this code
 * 
 * KEY FIX: Timezone-safe date comparison using substring extraction
 * instead of Date object comparisons
 */

const applyFilters = async () => {
  let filtered = [...metrics];

  // DEBUG - Remove after confirming fix works
  console.log('=== FILTER DEBUG ===');
  console.log('Total metrics:', metrics.length);
  console.log('Sample metric_date:', metrics[0]?.metric_date);

  // Apply date range filter - TIMEZONE SAFE
  const { startDate, endDate } = getDateRange();
  if (startDate && endDate) {
    // Extract YYYY-MM-DD using LOCAL date components (not UTC conversion)
    const startYear = startDate.getFullYear();
    const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
    const startDay = String(startDate.getDate()).padStart(2, '0');
    const startStr = `${startYear}-${startMonth}-${startDay}`;

    const endYear = endDate.getFullYear();
    const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
    const endDay = String(endDate.getDate()).padStart(2, '0');
    const endStr = `${endYear}-${endMonth}-${endDay}`;

    console.log('Date range:', startStr, 'to', endStr);

    const beforeCount = filtered.length;
    
    filtered = filtered.filter(m => {
      if (!m.metric_date) return false;
      
      // Extract just YYYY-MM-DD from metric_date (handles both formats)
      // "2025-12-14" or "2025-12-14T00:00:00+00:00" -> "2025-12-14"
      const metricDateStr = m.metric_date.substring(0, 10);
      
      const inRange = metricDateStr >= startStr && metricDateStr <= endStr;
      return inRange;
    });

    console.log(`Date filter: ${beforeCount} -> ${filtered.length}`);
  }

  // Apply workspace filter (including 360 views)
  if (selectedWorkspace !== 'all') {
    const beforeCount = filtered.length;
    
    if (selectedWorkspace === '360_SkyPrivate') {
      filtered = filtered.filter(m => m.workspace === 'SkyPrivate' && m.is_360_queue === true);
    } else if (selectedWorkspace === '360_CamModelDirectory') {
      filtered = filtered.filter(m => m.workspace === 'CamModelDirectory' && m.is_360_queue === true);
    } else {
      filtered = filtered.filter(m => m.workspace === selectedWorkspace);
    }

    console.log(`Workspace filter (${selectedWorkspace}): ${beforeCount} -> ${filtered.length}`);
  }

  // Apply reviewee (agent) filter
  if (selectedReviewee !== 'all') {
    const beforeCount = filtered.length;
    filtered = filtered.filter(m => m.agent_name === selectedReviewee);
    console.log(`Reviewee filter: ${beforeCount} -> ${filtered.length}`);
  }

  // Apply group filter
  if (selectedGroup !== 'all') {
    try {
      const { data: groupMappings } = await supabase
        .from('agent_group_mapping')
        .select('agent_id')
        .eq('group_id', selectedGroup);

      if (groupMappings && groupMappings.length > 0) {
        const agentIds = groupMappings.map(m => m.agent_id);
        const beforeCount = filtered.length;
        filtered = filtered.filter(m => agentIds.includes(m.agent_id));
        console.log(`Group filter: ${beforeCount} -> ${filtered.length}`);
      } else {
        console.log('No group mappings found');
        filtered = [];
      }
    } catch (err) {
      console.error('Error fetching group mappings:', err);
    }
  }

  // Apply reviewer filter
  if (selectedReviewer !== 'all') {
    const reviewedConversations = allFeedback
      .filter(f => f.reviewer_id === selectedReviewer)
      .map(f => f.conversation_id);
    const beforeCount = filtered.length;
    filtered = filtered.filter(m => reviewedConversations.includes(m.conversation_id));
    console.log(`Reviewer filter: ${beforeCount} -> ${filtered.length}`);
  }

  // Filter by human review status
  if (showHumanReviewedOnly) {
    const conversationsWithHumanFeedback = new Set(allFeedback.map(f => f.conversation_id));
    const beforeCount = filtered.length;
    filtered = filtered.filter(m => conversationsWithHumanFeedback.has(m.conversation_id));
    console.log(`Human reviewed filter: ${beforeCount} -> ${filtered.length}`);
    console.log('Total human feedback records:', allFeedback.length);
  }

  console.log('=== FINAL COUNT:', filtered.length, '===');
  
  setFilteredMetrics(filtered);
};

  const uniqueReviewers = Array.from(
    new Set(allFeedback.map(f => f.reviewer_id))
  ).map(id => {
    const feedback = allFeedback.find(f => f.reviewer_id === id);
    return { id, name: feedback?.reviewer_name || 'Unknown' };
  });

  const uniqueAgents = Array.from(
    new Set(metrics.map(m => m.agent_name))
  ).sort();

  const resetFilters = () => {
    setSelectedWorkspace('all');
    setSelectedReviewer('all');
    setSelectedReviewee('all');
    setSelectedGroup('all');
    setDateRange('last_30_days');
    setCustomStartDate('');
    setCustomEndDate('');
    setShowCustomDatePicker(false);
  };

  const getDateRangeLabel = (): string => {
    const labels: Record<DateRangeType, string> = {
      today: 'Today',
      yesterday: 'Yesterday',
      this_week: 'This Week',
      last_week: 'Last Week',
      this_month: 'This Month',
      last_month: 'Last Month',
      this_year: 'This Year',
      last_year: 'Last Year',
      last_7_days: 'Last 7 Days',
      last_30_days: 'Last 30 Days',
      last_90_days: 'Last 90 Days',
      custom: 'Custom Period',
      all: 'All Time'
    };
    return labels[dateRange];
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setDateRange('custom');
      setShowCustomDatePicker(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - simplified since logout is now in App.tsx navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pr-48">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Agent Performance Dashboard</h1>
              <p className="text-sm text-slate-600">Welcome, {user?.email}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => {
                  const value = e.target.value as DateRangeType;
                  if (value === 'custom') {
                    setShowCustomDatePicker(true);
                  } else {
                    setDateRange(value);
                    setShowCustomDatePicker(false);
                  }
                }}
                className="pl-10 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="last_week">Last Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
                <option value="last_year">Last Year</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="last_90_days">Last 90 Days</option>
                <option value="custom">Custom Period</option>
                <option value="all">All Time</option>
              </select>
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Workspaces</option>
              <optgroup label="Workspaces">
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.name}>
                    {workspace.display_name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="360 Views">
                <option value="360_SkyPrivate">360 view - SkyPrivate</option>
                <option value="360_CamModelDirectory">360 view - CamModelDirectory</option>
              </optgroup>
            </select>

            <select
              value={selectedReviewer}
              onChange={(e) => setSelectedReviewer(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Reviewers</option>
              {uniqueReviewers.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.name}
                </option>
              ))}
            </select>

            <select
              value={selectedReviewee}
              onChange={(e) => setSelectedReviewee(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Reviewees</option>
              {uniqueAgents.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>

            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Groups</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.display_name}
                </option>
              ))}
            </select>

            <div className="flex items-center space-x-2 px-3 py-2 bg-white rounded-lg border border-slate-300">
              <input
                type="checkbox"
                id="humanReviewedOnly"
                checked={showHumanReviewedOnly}
                onChange={(e) => setShowHumanReviewedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="humanReviewedOnly" className="text-sm font-medium text-slate-700">
                Human Reviewed Only
              </label>
            </div>

            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
            >
              Reset
            </button>
          </div>

          {showCustomDatePicker && (
            <div className="mb-4 p-4 bg-white rounded-lg border border-slate-300 shadow-lg">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Custom Date Range</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleCustomDateApply}
                  disabled={!customStartDate || !customEndDate}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setShowCustomDatePicker(false);
                    setDateRange('last_30_days');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {dateRange !== 'last_30_days' && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                <span>Date: {getDateRangeLabel()}</span>
                <button onClick={() => {
                  setDateRange('last_30_days');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {selectedWorkspace !== 'all' && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                <span>Workspace: {
                  selectedWorkspace === '360_SkyPrivate' ? '360 view - SkyPrivate' :
                  selectedWorkspace === '360_CamModelDirectory' ? '360 view - CamModelDirectory' :
                  workspaces.find(w => w.name === selectedWorkspace)?.display_name || selectedWorkspace
                }</span>
                <button onClick={() => setSelectedWorkspace('all')} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {selectedReviewer !== 'all' && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                <span>Reviewer: {uniqueReviewers.find(r => r.id === selectedReviewer)?.name}</span>
                <button onClick={() => setSelectedReviewer('all')} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {selectedReviewee !== 'all' && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                <span>Reviewee: {selectedReviewee}</span>
                <button onClick={() => setSelectedReviewee('all')} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {selectedGroup !== 'all' && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                <span>Group: {groups.find(g => g.id === selectedGroup)?.display_name}</span>
                <button onClick={() => setSelectedGroup('all')} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {filteredMetrics.length === 0 && !loading && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                No data found for the selected filters. Try adjusting your filter criteria.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-slate-600">Loading performance data...</span>
          </div>
        ) : (
          <>
            {/* Filter feedback to only include conversations in filteredMetrics */}
            {(() => {
              const filteredConversationIds = new Set(filteredMetrics.map(m => m.conversation_id));
              const filteredFeedback = allFeedback.filter(f => filteredConversationIds.has(f.conversation_id));
              return (
                <>
                  <AgentPerformanceStats metrics={filteredMetrics} feedback={filteredFeedback} />
                  <AgentPerformanceTable metrics={filteredMetrics} feedback={filteredFeedback} />
                  <div className="mt-6"> 
                    <AgentConversationsTable metrics={filteredMetrics} feedback={filteredFeedback} />
                  </div>
                </>
              );
            })()}
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              QA Dashboard - Agent Performance Tracking
            </p>
            <p className="text-xs text-slate-500">
              Showing {filteredMetrics.length} of {metrics.length} conversations
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}