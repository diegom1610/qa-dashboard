/**
 * DATABASE TYPE DEFINITIONS
 *
 * WHY TYPESCRIPT TYPES:
 * 1. Autocomplete: Your IDE knows what columns exist
 * 2. Type Safety: Prevents typos and wrong data types
 * 3. Documentation: Types serve as inline documentation
 *
 * HOW THIS WORKS:
 * These types mirror the database schema we created.
 * Supabase uses these types to provide accurate TypeScript support.
 */

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          agent_id: string;
          agent_name: string;
          email: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          agent_name: string;
          email?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          agent_name?: string;
          email?: string | null;
          active?: boolean;
          created_at?: string;
        };
      };
      qa_metrics: {
        Row: {
          id: string;
          conversation_id: string;
          agent_id: string;
          agent_name: string;
          metric_date: string;
          response_time_seconds: number | null;
          resolution_status: string | null;
          customer_satisfaction_score: number | null;
          ai_score: number | null;
          ai_feedback: string | null;
          conversation_tags: any;
          workspace: string | null;
          raw_data: any;
          synced_at: string;
          // NEW: Fields for workspace and 360 queue filtering
          tags: string[] | null;
          is_360_queue: boolean;
          queue_type_360: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          agent_id: string;
          agent_name: string;
          metric_date: string;
          response_time_seconds?: number | null;
          resolution_status?: string | null;
          customer_satisfaction_score?: number | null;
          ai_score?: number | null;
          ai_feedback?: string | null;
          conversation_tags?: any;
          workspace?: string | null;
          raw_data?: any;
          synced_at?: string;
          // NEW: Fields for workspace and 360 queue filtering
          tags?: string[] | null;
          is_360_queue?: boolean;
          queue_type_360?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          agent_id?: string;
          agent_name?: string;
          metric_date?: string;
          response_time_seconds?: number | null;
          resolution_status?: string | null;
          customer_satisfaction_score?: number | null;
          ai_score?: number | null;
          ai_feedback?: string | null;
          conversation_tags?: any;
          workspace?: string | null;
          raw_data?: any;
          synced_at?: string;
          // NEW: Fields for workspace and 360 queue filtering
          tags?: string[] | null;
          is_360_queue?: boolean;
          queue_type_360?: string | null;
        };
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          tag_identifiers: string[];
          description: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          tag_identifiers: string[];
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          tag_identifiers?: string[];
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      agent_groups: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          description?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      agent_workspace_mapping: {
        Row: {
          id: string;
          agent_id: string;
          workspace_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          workspace_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          workspace_id?: string;
          created_at?: string;
        };
      };
      agent_group_mapping: {
        Row: {
          id: string;
          agent_id: string;
          group_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          group_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          group_id?: string;
          created_at?: string;
        };
      };
      human_feedback: {
        Row: {
          id: string;
          conversation_id: string;
          reviewer_id: string;
          reviewer_name: string;
          rating: number;
          feedback_text: string | null;
          categories: any;
          logic_path: boolean;
          information: boolean;
          solution: boolean;
          communication: boolean;
          language_usage: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          reviewer_id: string;
          reviewer_name: string;
          rating: number;
          feedback_text?: string | null;
          categories?: any;
          logic_path?: boolean;
          information?: boolean;
          solution?: boolean;
          communication?: boolean;
          language_usage?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          reviewer_id?: string;
          reviewer_name?: string;
          rating?: number;
          feedback_text?: string | null;
          categories?: any;
          logic_path?: boolean;
          information?: boolean;
          solution?: boolean;
          communication?: boolean;
          language_usage?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

/**
 * CONVENIENCE TYPES
 *
 * WHY: Shorter names for common operations
 * Instead of writing Database['public']['Tables']['qa_metrics']['Row'],
 * we can just write QAMetric
 */

export type Agent = Database['public']['Tables']['agents']['Row'];
export type QAMetric = Database['public']['Tables']['qa_metrics']['Row'] & {
  human_feedback?: HumanFeedback[];
  rating_source: 'ai' | 'human' | 'both' | 'none';
};
export type HumanFeedback = Database['public']['Tables']['human_feedback']['Row'];
export type Workspace = Database['public']['Tables']['workspaces']['Row'];
export type AgentGroup = Database['public']['Tables']['agent_groups']['Row'];
export type AgentWorkspaceMapping = Database['public']['Tables']['agent_workspace_mapping']['Row'];
export type AgentGroupMapping = Database['public']['Tables']['agent_group_mapping']['Row'];

export type AgentInsert = Database['public']['Tables']['agents']['Insert'];
export type QAMetricInsert = Database['public']['Tables']['qa_metrics']['Insert'];
export type HumanFeedbackInsert = Database['public']['Tables']['human_feedback']['Insert'];
export type WorkspaceInsert = Database['public']['Tables']['workspaces']['Insert'];
export type AgentGroupInsert = Database['public']['Tables']['agent_groups']['Insert'];

/**
 * ADDITIONAL TYPES FOR UI
 */

export interface FilterState {
  agentIds: string[];
  conversationId: string;
  startDate: string | null;
  endDate: string | null;
  resolutionStatus: string | null;
}

export interface MetricsSummary {
  totalConversations: number;
  averageResponseTime: number;
  averageCsat: number;
  resolutionRate: number;
}