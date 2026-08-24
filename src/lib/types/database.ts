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
          updated_at?: string
        }
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
          next_followup_at: string | null
          lost_reason: string | null
          won_value: number | null
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
          next_followup_at?: string | null
          lost_reason?: string | null
          won_value?: number | null
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
          next_followup_at?: string | null
          lost_reason?: string | null
          won_value?: number | null
        }
      }
      lead_activities: {
        Row: {
          id: string
          lead_id: string
          user_id: string | null
          type: 'status_change' | 'comment' | 'assignment' | 'reminder_set' | 'email_sent' | 'call_logged' | 'system' | 'edit'
          content: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          user_id?: string | null
          type: 'status_change' | 'comment' | 'assignment' | 'reminder_set' | 'email_sent' | 'call_logged' | 'system' | 'edit'
          content?: string | null
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          metadata?: Json | null
        }
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
      }
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

// Extended types (with joins)
export type LeadWithAgent = Lead & {
  agent?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}

export type LeadActivityWithUser = LeadActivity & {
  user?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}

export type UserRole = 'admin' | 'manager' | 'agent'
export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent'
