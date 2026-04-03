export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          auth_user_id: string | null;
          profile_id: string;
          display_name: string;
          email: string | null;
          role: "admin" | "coach" | "client";
          status: "active" | "inactive_soft_locked";
          status_reason: string;
          accept_remote: boolean;
          accept_hybrid: boolean;
          accept_onsite: boolean;
          remote_region_scope: string;
          preferred_countries: string[];
          preferred_cities: string[];
          preferred_locations: string[];
          current_city: string;
          distance_range_km: number;
          salary_min: number;
          banned_keywords: string[];
          disqualifying_seniority: string[];
          allow_sales_heavy: boolean;
          allow_phone_heavy: boolean;
          allow_weekend_work: boolean;
          allow_shift_work: boolean;
          location_blacklist: string[];
          skill_keywords_plus: string[];
          skill_keywords_minus: string[];
          skill_profile_text: string;
          top_skills: string[];
          signature_stories: string[];
          role_tracks: Json;
          lane_controls: Json;
          search_terms_override: Json | null;
          last_fetch_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          profile_id: string;
          display_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      inbox_jobs: {
        Row: {
          id: string;
          profile_id: string;
          score: number;
          tier: "S" | "A" | "B" | "C" | "F" | "X";
          company: string;
          title: string;
          url: string | null;
          source: string | null;
          location: string | null;
          role_type: string | null;
          lane_label: string | null;
          category: string | null;
          job_summary: string | null;
          why_fit: string | null;
          salary: string | null;
          salary_source: string | null;
          salary_below_min: boolean;
          match_hits: number;
          added_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["inbox_jobs"]["Row"]> & {
          profile_id: string;
          company: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["inbox_jobs"]["Row"]>;
      };
      tracker_entries: {
        Row: {
          id: string;
          profile_id: string;
          company: string;
          title: string;
          url: string | null;
          source: string | null;
          location: string | null;
          role_type: string | null;
          lane_label: string | null;
          category: string | null;
          job_summary: string | null;
          why_fit: string | null;
          salary: string | null;
          good_fit: string;
          good_fit_updated_at: string | null;
          notes: string;
          status: string;
          stage_changed_at: string;
          date_applied: string;
          added_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tracker_entries"]["Row"]> & {
          profile_id: string;
          company: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["tracker_entries"]["Row"]>;
      };
      dismissed_jobs: {
        Row: {
          id: string;
          profile_id: string;
          url: string | null;
          company: string | null;
          title: string | null;
          dismissed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["dismissed_jobs"]["Row"]> & {
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["dismissed_jobs"]["Row"]>;
      };
      global_job_bank: {
        Row: {
          id: string;
          url: string | null;
          company: string | null;
          title: string | null;
          source: string | null;
          location: string | null;
          work_mode: string | null;
          job_family: string | null;
          description_snippet: string | null;
          job_summary: string | null;
          why_fit: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["global_job_bank"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["global_job_bank"]["Row"]>;
      };
      message_templates: {
        Row: {
          id: string;
          name: string;
          subject: string;
          body: string;
          ai_prompt_hint: string | null;
          trigger_event: string | null;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["message_templates"]["Row"]> & {
          name: string;
          subject: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["message_templates"]["Row"]>;
      };
      sent_messages: {
        Row: {
          id: string;
          coach_id: string;
          client_id: string;
          template_id: string | null;
          subject: string;
          body: string;
          trigger_event: string | null;
          tracker_entry_id: string | null;
          sent_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sent_messages"]["Row"]> & {
          coach_id: string;
          client_id: string;
          subject: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["sent_messages"]["Row"]>;
      };
      user_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_events"]["Row"]> & {
          event_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_events"]["Row"]>;
      };
      error_logs: {
        Row: {
          id: string;
          severity: "info" | "warning" | "error" | "critical";
          source_system: string;
          message: string;
          stack_trace: string | null;
          user_id: string | null;
          request_id: string | null;
          metadata: Json;
          resolved: boolean;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["error_logs"]["Row"]> & {
          source_system: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["error_logs"]["Row"]>;
      };
      job_fetch_logs: {
        Row: {
          id: string;
          profile_id: string | null;
          batch_id: string | null;
          source_name: string;
          search_term: string | null;
          jobs_returned: number;
          jobs_after_dedupe: number | null;
          jobs_scored: number | null;
          jobs_enriched: number | null;
          success: boolean;
          error_message: string | null;
          duration_ms: number | null;
          request_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["job_fetch_logs"]["Row"]> & {
          source_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["job_fetch_logs"]["Row"]>;
      };
      email_logs: {
        Row: {
          id: string;
          recipient_email: string;
          recipient_id: string | null;
          email_type: string;
          subject: string | null;
          success: boolean;
          error_message: string | null;
          template_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["email_logs"]["Row"]> & {
          recipient_email: string;
          email_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_logs"]["Row"]>;
      };
      resume_parse_logs: {
        Row: {
          id: string;
          user_id: string;
          file_name: string | null;
          file_size: number | null;
          success: boolean;
          error_message: string | null;
          openai_response_time_ms: number | null;
          model: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["resume_parse_logs"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["resume_parse_logs"]["Row"]>;
      };
      system_health_snapshots: {
        Row: {
          id: string;
          statuses: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["system_health_snapshots"]["Row"]> & {
          statuses: Json;
        };
        Update: Partial<Database["public"]["Tables"]["system_health_snapshots"]["Row"]>;
      };
      enrichment_cache: {
        Row: {
          id: string;
          url: string;
          job_summary: string | null;
          raw_response: Json | null;
          model: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["enrichment_cache"]["Row"]> & {
          url: string;
        };
        Update: Partial<Database["public"]["Tables"]["enrichment_cache"]["Row"]>;
      };
      lane_role_bank: {
        Row: {
          id: string;
          lane_key: string;
          role_name: string;
          aliases: string[];
          is_active: boolean;
          status: "active" | "pending" | "merged" | "hidden";
          role_slug: string | null;
          source: string;
          merged_into_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lane_role_bank"]["Row"]> & {
          lane_key: string;
          role_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["lane_role_bank"]["Row"]>;
      };
      role_bank: {
        Row: {
          id: string;
          profile_id: string;
          url: string | null;
          company: string | null;
          title: string | null;
          source: string | null;
          location: string | null;
          work_mode: string | null;
          job_family: string | null;
          description_snippet: string | null;
          job_summary: string | null;
          why_fit: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["role_bank"]["Row"]> & {
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["role_bank"]["Row"]>;
      };
      jobs_inbox: {
        Row: {
          id: string;
          job_id: string | null;
          email_received_at: string | null;
          title: string | null;
          company: string | null;
          url: string | null;
          source: string | null;
          location: string | null;
          work_mode: string | null;
          job_family: string | null;
          description_snippet: string | null;
          job_summary: string | null;
          why_fit: string | null;
          enrichment_status: "NEW" | "OUTLIER" | "ENRICHED" | "IN_GLOBAL";
          missing_fields: string | null;
          role_id: string | null;
          promoted_at: string | null;
          notes: string | null;
          role_bank_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["jobs_inbox"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["jobs_inbox"]["Row"]>;
      };
    };
    Functions: {
      get_my_profile_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
}
