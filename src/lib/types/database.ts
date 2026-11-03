/**
 * src/lib/types/database.ts
 *
 * Tipuri Supabase (generate) + tipuri derivate
 *
 * Tipul `Database` corespunde schemei Postgres curente (tabele: profiles,
 * leads, lead_activities, reminders, notifications, pipeline_stages,
 * lead_sources, lead_attachments, call_campaigns, call_lists,
 * call_list_members, ai_calls — vezi supabase/migrations/*.sql) și e
 * folosit ca generic pe toți clienții Supabase (src/lib/supabase/*.ts).
 * Mai jos în fișier sunt și alias-uri comode per tabel (Lead, Profile,
 * LeadActivity, Reminder, Notification, PipelineStage, LeadSource,
 * LeadAttachment), câteva tipuri extinse cu join-uri (LeadWithAgent,
 * LeadActivityWithUser), și enum-urile UserRole/LeadPriority. Regenerat cu
 * `supabase gen types` — nu se editează manual partea de `Database`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          role: 'admin' | 'manager' | 'agent'
          avatar_url: string | null
          is_active: boolean
          available_for_autoassign: boolean
          receives_digest: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          phone?: string | null
          role?: 'admin' | 'manager' | 'agent'
          avatar_url?: string | null
          is_active?: boolean
          available_for_autoassign?: boolean
          receives_digest?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          phone?: string | null
          role?: 'admin' | 'manager' | 'agent'
          avatar_url?: string | null
          is_active?: boolean
          available_for_autoassign?: boolean
          receives_digest?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          email: string | null
          phone: string | null
          source: string
          source_detail: string | null
          source_raw_data: Json | null
          facebook_lead_id: string | null
          destination: string | null
          travel_date_from: string | null
          travel_date_to: string | null
          nr_adults: number
          nr_children: number
          children_ages: string | null
          budget_range: string | null
          trip_type: string | null
          message: string | null
          status: string
          priority: 'low' | 'medium' | 'high' | 'urgent'
          tags: string[]
          assigned_to: string | null
          assigned_at: string | null
          assigned_by: string | null
          first_response_at: string | null
          last_activity_at: string | null
          last_interaction_at: string
          next_followup_at: string | null
          lost_reason: string | null
          won_value: number | null
          total_amount_ron: number | null
          commission_eur: number | null
          commission_ron: number | null
          order_number: string | null
          contract_number: string | null
          invoice_number: string | null
          eligible_for_auto_assign: boolean
          ai_call_status: AiCallStatus | null
          ai_call_count: number
          ai_last_call_at: string | null
          ai_last_call_id: string | null
          do_not_call: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          source: string
          source_detail?: string | null
          source_raw_data?: Json | null
          destination?: string | null
          travel_date_from?: string | null
          travel_date_to?: string | null
          nr_adults?: number
          nr_children?: number
          children_ages?: string | null
          budget_range?: string | null
          trip_type?: string | null
          message?: string | null
          status?: string
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          tags?: string[]
          assigned_to?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          first_response_at?: string | null
          last_activity_at?: string | null
          last_interaction_at?: string
          next_followup_at?: string | null
          lost_reason?: string | null
          won_value?: number | null
          total_amount_ron?: number | null
          commission_eur?: number | null
          commission_ron?: number | null
          order_number?: string | null
          contract_number?: string | null
          invoice_number?: string | null
          eligible_for_auto_assign?: boolean
          ai_call_status?: AiCallStatus | null
          ai_call_count?: number
          ai_last_call_at?: string | null
          ai_last_call_id?: string | null
          do_not_call?: boolean
        }
        Update: {
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          source?: string
          source_detail?: string | null
          destination?: string | null
          travel_date_from?: string | null
          travel_date_to?: string | null
          nr_adults?: number
          nr_children?: number
          children_ages?: string | null
          budget_range?: string | null
          trip_type?: string | null
          message?: string | null
          status?: string
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          tags?: string[]
          assigned_to?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          first_response_at?: string | null
          last_interaction_at?: string
          next_followup_at?: string | null
          lost_reason?: string | null
          won_value?: number | null
          total_amount_ron?: number | null
          commission_eur?: number | null
          commission_ron?: number | null
          order_number?: string | null
          contract_number?: string | null
          invoice_number?: string | null
          eligible_for_auto_assign?: boolean
          ai_call_status?: AiCallStatus | null
          ai_call_count?: number
          ai_last_call_at?: string | null
          ai_last_call_id?: string | null
          do_not_call?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'leads_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leads_assigned_by_fkey'
            columns: ['assigned_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      lead_activities: {
        Row: {
          id: string
          lead_id: string
          user_id: string | null
          type: 'status_change' | 'comment' | 'assignment' | 'reminder_set' | 'email_sent' | 'call_logged' | 'system' | 'edit' | 'ai_call'
          content: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          user_id?: string | null
          type: 'status_change' | 'comment' | 'assignment' | 'reminder_set' | 'email_sent' | 'call_logged' | 'system' | 'edit' | 'ai_call'
          content?: string | null
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'lead_activities_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_activities_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      reminders: {
        Row: {
          id: string
          lead_id: string
          user_id: string
          remind_at: string
          note: string | null
          is_completed: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          user_id: string
          remind_at: string
          note?: string | null
          is_completed?: boolean
        }
        Update: {
          remind_at?: string
          note?: string | null
          is_completed?: boolean
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'reminders_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reminders_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'lead_assigned' | 'reminder_due' | 'lead_new' | 'mention' | 'system'
          title: string
          body: string | null
          lead_id: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'lead_assigned' | 'reminder_due' | 'lead_new' | 'mention' | 'system'
          title: string
          body?: string | null
          lead_id?: string | null
          is_read?: boolean
        }
        Update: {
          is_read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
        ]
      }
      pipeline_stages: {
        Row: {
          id: string
          name: string
          slug: string
          display_order: number
          color: string | null
          is_terminal: boolean
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          display_order: number
          color?: string | null
          is_terminal?: boolean
          is_default?: boolean
        }
        Update: {
          name?: string
          slug?: string
          display_order?: number
          color?: string | null
          is_terminal?: boolean
          is_default?: boolean
        }
        Relationships: []
      }
      lead_sources: {
        Row: {
          id: string
          name: string
          slug: string
          icon: string | null
          webhook_key: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          icon?: string | null
          webhook_key?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          slug?: string
          icon?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      lead_attachments: {
        Row: {
          id: string
          lead_id: string
          file_name: string
          file_url: string
          file_type: string | null
          file_size: number | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          file_name: string
          file_url: string
          file_type?: string | null
          file_size?: number | null
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lead_attachments_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_attachments_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'app_settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      facebook_form_field_mappings: {
        Row: {
          sheet_tab: string
          full_name_header: string | null
          email_header: string | null
          phone_header: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          sheet_tab: string
          full_name_header?: string | null
          email_header?: string | null
          phone_header?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          sheet_tab?: string
          full_name_header?: string | null
          email_header?: string | null
          phone_header?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'facebook_form_field_mappings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      call_campaigns: {
        Row: {
          id: string
          name: string
          vapi_assistant_id: string
          description: string | null
          is_active: boolean
          auto_call_enabled: boolean
          fb_match_campaign: string | null
          fb_match_form: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          vapi_assistant_id: string
          description?: string | null
          is_active?: boolean
          auto_call_enabled?: boolean
          fb_match_campaign?: string | null
          fb_match_form?: string | null
          created_by?: string | null
        }
        Update: {
          name?: string
          vapi_assistant_id?: string
          description?: string | null
          is_active?: boolean
          auto_call_enabled?: boolean
          fb_match_campaign?: string | null
          fb_match_form?: string | null
        }
        Relationships: []
      }
      call_lists: {
        Row: {
          id: string
          name: string
          campaign_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          campaign_id?: string | null
          created_by?: string | null
        }
        Update: {
          name?: string
          campaign_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'call_lists_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'call_campaigns'
            referencedColumns: ['id']
          },
        ]
      }
      call_list_members: {
        Row: {
          list_id: string
          lead_id: string
          added_at: string
        }
        Insert: {
          list_id: string
          lead_id: string
          added_at?: string
        }
        Update: {
          added_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'call_list_members_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'call_lists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'call_list_members_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
        ]
      }
      ai_calls: {
        Row: {
          id: string
          lead_id: string
          campaign_id: string | null
          list_id: string | null
          phone_number: string
          direction: 'outbound' | 'inbound'
          vapi_call_id: string | null
          status: AiCallRunStatus
          result: AiCallStatus | null
          ended_reason: string | null
          error_message: string | null
          started_at: string | null
          ended_at: string | null
          duration_sec: number | null
          cost: number | null
          summary: string | null
          transcript: string | null
          recording_url: string | null
          structured_data: Json | null
          raw_report: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          campaign_id?: string | null
          list_id?: string | null
          phone_number: string
          direction?: 'outbound' | 'inbound'
          vapi_call_id?: string | null
          status?: AiCallRunStatus
          result?: AiCallStatus | null
          ended_reason?: string | null
          error_message?: string | null
          started_at?: string | null
          ended_at?: string | null
          duration_sec?: number | null
          cost?: number | null
          summary?: string | null
          transcript?: string | null
          recording_url?: string | null
          structured_data?: Json | null
          raw_report?: Json | null
          created_by?: string | null
        }
        Update: {
          vapi_call_id?: string | null
          status?: AiCallRunStatus
          result?: AiCallStatus | null
          ended_reason?: string | null
          error_message?: string | null
          started_at?: string | null
          ended_at?: string | null
          duration_sec?: number | null
          cost?: number | null
          summary?: string | null
          transcript?: string | null
          recording_url?: string | null
          structured_data?: Json | null
          raw_report?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'ai_calls_lead_id_fkey'
            columns: ['lead_id']
            isOneToOne: false
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_calls_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'call_campaigns'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: Record<string, never>
        Returns: string
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_admin_or_manager: {
        Args: Record<string, never>
        Returns: boolean
      }
      // Migrarea 014 — doar service_role (import liste de apelare)
      find_leads_by_phone_suffix: {
        Args: { suffixes: string[] }
        Returns: {
          id: string
          phone: string | null
          first_name: string | null
          last_name: string | null
          do_not_call: boolean
          created_at: string
          phone_suffix: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Lead = Database['public']['Tables']['leads']['Row']
export type LeadInsert = Database['public']['Tables']['leads']['Insert']
export type LeadUpdate = Database['public']['Tables']['leads']['Update']
export type LeadActivity = Database['public']['Tables']['lead_activities']['Row']
export type Reminder = Database['public']['Tables']['reminders']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type PipelineStage = Database['public']['Tables']['pipeline_stages']['Row']
export type LeadSource = Database['public']['Tables']['lead_sources']['Row']
export type LeadAttachment = Database['public']['Tables']['lead_attachments']['Row']
export type AppSetting = Database['public']['Tables']['app_settings']['Row']
export type CallCampaign = Database['public']['Tables']['call_campaigns']['Row']
export type CallList = Database['public']['Tables']['call_lists']['Row']
export type AiCall = Database['public']['Tables']['ai_calls']['Row']

// Extended types (with joins)
export type LeadWithAgent = Lead & {
  agent?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}

export type LeadActivityWithUser = LeadActivity & {
  user?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}

export type UserRole = 'admin' | 'manager' | 'agent'
export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Calificare AI (leads.ai_call_status / ai_calls.result) — migrarea 013.
 * Separată de etapa din pipeline: arată rezultatul ULTIMULUI apel AI.
 * NULL pe lead = neapelat.
 */
export type AiCallStatus =
  | 'queued'
  | 'in_progress'
  | 'hot'
  | 'interested'
  | 'other_request'
  | 'callback'
  | 'not_interested'
  | 'no_answer'
  | 'hung_up'
  | 'unclear'
  | 'invalid'
  | 'failed'

/** Starea tehnică a unui apel (ai_calls.status). */
export type AiCallRunStatus = 'queued' | 'ringing' | 'in_progress' | 'ended' | 'failed' | 'cancelled'
