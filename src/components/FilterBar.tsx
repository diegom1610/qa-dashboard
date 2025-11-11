/**
 * FILTER BAR COMPONENT
 *
 * PURPOSE:
 * Allows users to filter QA metrics by agent, conversation ID, dates, and status.
 *
 * WHY CONTROLLED COMPONENTS:
 * Each filter is a "controlled component" - its value is stored in parent state
 * and passed down as props. This makes the filters predictable and testable.
 *
 * FEATURES:
 * - Multi-select agent dropdown
 * - Conversation ID search
 * - Date range picker
 * - Resolution status filter
 * - Clear all filters button
 */

import { Search, X, Calendar, User, Filter } from 'lucide-react';
import type { Agent, FilterState } from '../types/database';

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  agents: Agent[];
  agentsLoading: boolean;
}

/**
 * FILTER BAR COMPONENT
 *
 * @param filters - Current filter state
 * @param onFiltersChange - Callback to update filters
 * @param agents - List of available agents
 * @param agentsLoading - Whether agents are still loading
 *
 * HOW IT WORKS:
 * 1. User interacts with filter control (selects agent, types conversation ID, etc.)
 * 2. Component calls onFiltersChange with updated filter object
 * 3. Parent updates state
 * 4. useMetrics hook detects change and re-fetches data
 * 5. UI updates with filtered results
 */
export function FilterBar({
  filters,
  onFiltersChange,
  agents,
  agentsLoading,
}: FilterBarProps) {
  /**
   * HELPER: Update a single filter field
   *
   * WHY:
   * Avoids repeating the spread operator pattern in every handler.
   * Makes code more readable and less error-prone.
   *
   * @param field - Which filter to update
   * @param value - New value for that filter
   */
  const updateFilter = <K extends keyof FilterState>(
    field: K,
    value: FilterState[K]
  ) => {
    onFiltersChange({
      ...filters,
      [field]: value,
    });
  };

  /**
   * HELPER: Clear all filters
   *
   * WHY:
   * Users often want to "start fresh" after applying many filters.
   * Single button is better UX than clearing each filter individually.
   */
  const clearFilters = () => {
    onFiltersChange({
      agentIds: [],
      conversationId: '',
      startDate: null,
      endDate: null,
      resolutionStatus: null,
    });
  };

  /**
   * HELPER: Check if any filters are active
   *
   * WHY:
   * Show/hide the "Clear Filters" button based on whether filters are applied.
   * Better UX than showing a useless button when no filters are active.
   */
  const hasActiveFilters =
    filters.agentIds.length > 0 ||
    filters.conversationId.trim() !== '' ||
    filters.startDate !== null ||
    filters.endDate !== null ||
    filters.resolutionStatus !== null;

  /**
   * HELPER: Toggle agent in multi-select
   *
   * WHY TOGGLE:
   * Allows selecting multiple agents without holding Ctrl/Cmd.
   * Click once to add, click again to remove.
   *
   * @param agentId - Agent to add/remove from filter
   */
  const toggleAgent = (agentId: string) => {
    const newAgentIds = filters.agentIds.includes(agentId)
      ? filters.agentIds.filter((id) => id !== agentId)
      : [...filters.agentIds, agentId];

    updateFilter('agentIds', newAgentIds);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
              Active
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-slate-600 hover:text-slate-900 font-medium transition"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Agent Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <User className="w-4 h-4 inline mr-1" />
            Agents
          </label>
          <div className="relative">
            <select
              multiple
              value={filters.agentIds}
              onChange={(e) => {
                const selected = Array.from(
                  e.target.selectedOptions,
                  (option) => option.value
                );
                updateFilter('agentIds', selected);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              size={4}
              disabled={agentsLoading}
            >
              {agentsLoading ? (
                <option disabled>Loading agents...</option>
              ) : (
                agents.map((agent) => (
                  <option key={agent.id} value={agent.agent_id}>
                    {agent.agent_name}
                  </option>
                ))
              )}
            </select>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hold Ctrl/Cmd to select multiple
          </p>
        </div>

        {/* Conversation ID Search */}
        <div>
          <label
            htmlFor="conversationId"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            <Search className="w-4 h-4 inline mr-1" />
            Conversation ID
          </label>
          <div className="relative">
            <input
              id="conversationId"
              type="text"
              value={filters.conversationId}
              onChange={(e) => updateFilter('conversationId', e.target.value)}
              placeholder="Search by ID..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition pr-8"
            />
            {filters.conversationId && (
              <button
                onClick={() => updateFilter('conversationId', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            <Calendar className="w-4 h-4 inline mr-1" />
            Start Date
          </label>
          <input
            id="startDate"
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => updateFilter('startDate', e.target.value || null)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
        </div>

        <div>
          <label
            htmlFor="endDate"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            <Calendar className="w-4 h-4 inline mr-1" />
            End Date
          </label>
          <input
            id="endDate"
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => updateFilter('endDate', e.target.value || null)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
        </div>

        {/* Resolution Status Filter */}
        <div>
          <label
            htmlFor="resolutionStatus"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Status
          </label>
          <select
            id="resolutionStatus"
            value={filters.resolutionStatus || ''}
            onChange={(e) =>
              updateFilter('resolutionStatus', e.target.value || null)
            }
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="resolved">Resolved</option>
            <option value="pending">Pending</option>
            <option value="escalated">Escalated</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>
    </div>
  );
}
