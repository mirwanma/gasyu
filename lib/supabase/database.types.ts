export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          audience: Database["public"]["Enums"]["activity_audience"]
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["difficulty"] | null
          ends_at: string
          goal: Database["public"]["Enums"]["activity_goal"]
          group_max: number | null
          group_min: number | null
          host_organizer_id: string
          id: string
          is_paid: boolean
          join_mode: Database["public"]["Enums"]["join_mode"]
          payment_instructions: string | null
          payment_window_hours: number
          points_per_completion: number
          price_idr: number | null
          published_at: string | null
          quota: number | null
          residency_rule: Database["public"]["Enums"]["residency_rule"]
          review_note: string | null
          reviewed_by: string | null
          scope_region_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["activity_status"]
          submitted_at: string | null
          target_scope: Database["public"]["Enums"]["target_scope"]
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
          xp_base: number
        }
        Insert: {
          audience?: Database["public"]["Enums"]["activity_audience"]
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty"] | null
          ends_at: string
          goal: Database["public"]["Enums"]["activity_goal"]
          group_max?: number | null
          group_min?: number | null
          host_organizer_id: string
          id?: string
          is_paid?: boolean
          join_mode?: Database["public"]["Enums"]["join_mode"]
          payment_instructions?: string | null
          payment_window_hours?: number
          points_per_completion?: number
          price_idr?: number | null
          published_at?: string | null
          quota?: number | null
          residency_rule?: Database["public"]["Enums"]["residency_rule"]
          review_note?: string | null
          reviewed_by?: string | null
          scope_region_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["activity_status"]
          submitted_at?: string | null
          target_scope?: Database["public"]["Enums"]["target_scope"]
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          xp_base?: number
        }
        Update: {
          audience?: Database["public"]["Enums"]["activity_audience"]
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty"] | null
          ends_at?: string
          goal?: Database["public"]["Enums"]["activity_goal"]
          group_max?: number | null
          group_min?: number | null
          host_organizer_id?: string
          id?: string
          is_paid?: boolean
          join_mode?: Database["public"]["Enums"]["join_mode"]
          payment_instructions?: string | null
          payment_window_hours?: number
          points_per_completion?: number
          price_idr?: number | null
          published_at?: string | null
          quota?: number | null
          residency_rule?: Database["public"]["Enums"]["residency_rule"]
          review_note?: string | null
          reviewed_by?: string | null
          scope_region_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["activity_status"]
          submitted_at?: string | null
          target_scope?: Database["public"]["Enums"]["target_scope"]
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          xp_base?: number
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activities_scope_region_id_fkey"
            columns: ["scope_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_checkpoints: {
        Row: {
          activity_id: string
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          lat: number
          lng: number
          name: string
          outlet_id: string | null
          partner_organizer_id: string
          qr_secret: string
          radius_m: number
          updated_at: string
        }
        Insert: {
          activity_id: string
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          lat: number
          lng: number
          name: string
          outlet_id?: string | null
          partner_organizer_id: string
          qr_secret?: string
          radius_m?: number
          updated_at?: string
        }
        Update: {
          activity_id?: string
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number
          lng?: number
          name?: string
          outlet_id?: string | null
          partner_organizer_id?: string
          qr_secret?: string
          radius_m?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_checkpoints_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_checkpoints_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_checkpoints_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_checkpoints_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_checkpoints_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_checkpoints_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_checkpoints_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "merchant_outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_checkpoints_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_outlet_vouchers"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "activity_checkpoints_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_checkpoints_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activity_checkpoints_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_checkpoints_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activity_checkpoints_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_checkpoints_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      activity_missions: {
        Row: {
          activity_id: string
          available_from: string | null
          available_until: string | null
          checkpoint_id: string | null
          code_hash: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_required: boolean
          locked_at: string | null
          partner_organizer_id: string
          prerequisite_mission_id: string | null
          qr_secret: string
          reveal_at: string | null
          reveal_mode: Database["public"]["Enums"]["mission_reveal"]
          revealed_at: string | null
          show_teaser: boolean
          sort_order: number
          template_id: string | null
          title: string
          updated_at: string
          verification: Database["public"]["Enums"]["mission_verification"]
          xp_reward: number
        }
        Insert: {
          activity_id: string
          available_from?: string | null
          available_until?: string | null
          checkpoint_id?: string | null
          code_hash?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          locked_at?: string | null
          partner_organizer_id: string
          prerequisite_mission_id?: string | null
          qr_secret?: string
          reveal_at?: string | null
          reveal_mode?: Database["public"]["Enums"]["mission_reveal"]
          revealed_at?: string | null
          show_teaser?: boolean
          sort_order?: number
          template_id?: string | null
          title: string
          updated_at?: string
          verification: Database["public"]["Enums"]["mission_verification"]
          xp_reward: number
        }
        Update: {
          activity_id?: string
          available_from?: string | null
          available_until?: string | null
          checkpoint_id?: string | null
          code_hash?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          locked_at?: string | null
          partner_organizer_id?: string
          prerequisite_mission_id?: string | null
          qr_secret?: string
          reveal_at?: string | null
          reveal_mode?: Database["public"]["Enums"]["mission_reveal"]
          revealed_at?: string | null
          show_teaser?: boolean
          sort_order?: number
          template_id?: string | null
          title?: string
          updated_at?: string
          verification?: Database["public"]["Enums"]["mission_verification"]
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_missions_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "activity_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_missions_prerequisite_mission_id_fkey"
            columns: ["prerequisite_mission_id"]
            isOneToOne: false
            referencedRelation: "activity_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_prerequisite_mission_id_fkey"
            columns: ["prerequisite_mission_id"]
            isOneToOne: false
            referencedRelation: "v_mission_manual_candidates"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "activity_missions_prerequisite_mission_id_fkey"
            columns: ["prerequisite_mission_id"]
            isOneToOne: false
            referencedRelation: "v_mission_stats"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "activity_missions_prerequisite_mission_id_fkey"
            columns: ["prerequisite_mission_id"]
            isOneToOne: false
            referencedRelation: "v_participation_missions"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "activity_missions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "mission_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v_mission_template_stats"
            referencedColumns: ["template_id"]
          },
        ]
      }
      activity_partners: {
        Row: {
          activity_id: string
          benefits_note: string | null
          contribution_note: string | null
          created_at: string
          id: string
          invited_by: string | null
          organizer_id: string
          points_budget: number
          responded_at: string | null
          role: Database["public"]["Enums"]["partner_role"]
          source: Database["public"]["Enums"]["partner_source"]
          status: Database["public"]["Enums"]["partner_status"]
          updated_at: string
        }
        Insert: {
          activity_id: string
          benefits_note?: string | null
          contribution_note?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          organizer_id: string
          points_budget?: number
          responded_at?: string | null
          role: Database["public"]["Enums"]["partner_role"]
          source: Database["public"]["Enums"]["partner_source"]
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
        }
        Update: {
          activity_id?: string
          benefits_note?: string | null
          contribution_note?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          organizer_id?: string
          points_budget?: number
          responded_at?: string | null
          role?: Database["public"]["Enums"]["partner_role"]
          source?: Database["public"]["Enums"]["partner_source"]
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          note: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      badges: {
        Row: {
          code: string
          created_at: string
          description: string
          icon_url: string | null
          id: string
          name: string
          rule: Json
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          icon_url?: string | null
          id?: string
          name: string
          rule?: Json
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          icon_url?: string | null
          id?: string
          name?: string
          rule?: Json
          sort_order?: number
        }
        Relationships: []
      }
      challenge_targets: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["target_kind"]
          target_count: number
          updated_at: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["target_kind"]
          target_count: number
          updated_at?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["target_kind"]
          target_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_targets_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_targets_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_targets_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "challenge_targets_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "challenge_targets_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "challenge_targets_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
        ]
      }
      checkins: {
        Row: {
          activity_id: string
          checked_in_at: string
          checkpoint_id: string
          distance_m: number | null
          group_id: string | null
          id: string
          lat: number | null
          lng: number | null
          local_date: string
          participation_id: string
          partner_organizer_id: string
          review_note: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          checked_in_at?: string
          checkpoint_id: string
          distance_m?: number | null
          group_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          local_date?: string
          participation_id: string
          partner_organizer_id: string
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          checked_in_at?: string
          checkpoint_id?: string
          distance_m?: number | null
          group_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          local_date?: string
          participation_id?: string
          partner_organizer_id?: string
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "activity_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "participations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "v_activity_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "v_participation_missions"
            referencedColumns: ["participation_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "checkins_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      collab_applications: {
        Row: {
          contribution: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          organizer_id: string
          post_id: string
          proposed_points_budget: number
          proposed_role: Database["public"]["Enums"]["partner_role"]
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
        }
        Insert: {
          contribution?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          organizer_id: string
          post_id: string
          proposed_points_budget?: number
          proposed_role: Database["public"]["Enums"]["partner_role"]
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Update: {
          contribution?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          organizer_id?: string
          post_id?: string
          proposed_points_budget?: number
          proposed_role?: Database["public"]["Enums"]["partner_role"]
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collab_applications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_applications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_applications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collab_applications_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_applications_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "collab_applications_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "collab_applications_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "collab_applications_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "collab_applications_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "collab_applications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_posts: {
        Row: {
          activity_id: string | null
          benefits: string
          category: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          id: string
          kind: Database["public"]["Enums"]["collab_kind"]
          needs: string
          organizer_id: string
          region_id: string | null
          status: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          benefits: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          kind: Database["public"]["Enums"]["collab_kind"]
          needs: string
          organizer_id: string
          region_id?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          benefits?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["collab_kind"]
          needs?: string
          organizer_id?: string
          region_id?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_posts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_posts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_posts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "collab_posts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "collab_posts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "collab_posts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "collab_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collab_posts_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_posts_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "collab_posts_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "collab_posts_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "collab_posts_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "collab_posts_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "collab_posts_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_memberships: {
        Row: {
          community_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          ended_at: string | null
          id: string
          joined_at: string | null
          message: string | null
          removed_by: string | null
          removed_reason: string | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          community_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          ended_at?: string | null
          id?: string
          joined_at?: string | null
          message?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          community_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          ended_at?: string | null
          id?: string
          joined_at?: string | null
          message?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "community_memberships_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "community_memberships_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "community_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      community_profiles: {
        Row: {
          activity_area_village_id: string | null
          basecamp_address: string | null
          basecamp_lat: number | null
          basecamp_lng: number | null
          created_at: string
          est_members: number | null
          interest_category: string
          join_policy: Database["public"]["Enums"]["join_policy"]
          organizer_id: string
          proof_url: string | null
          social_links: Json
          updated_at: string
          whatsapp: string
        }
        Insert: {
          activity_area_village_id?: string | null
          basecamp_address?: string | null
          basecamp_lat?: number | null
          basecamp_lng?: number | null
          created_at?: string
          est_members?: number | null
          interest_category: string
          join_policy?: Database["public"]["Enums"]["join_policy"]
          organizer_id: string
          proof_url?: string | null
          social_links?: Json
          updated_at?: string
          whatsapp: string
        }
        Update: {
          activity_area_village_id?: string | null
          basecamp_address?: string | null
          basecamp_lat?: number | null
          basecamp_lng?: number | null
          created_at?: string
          est_members?: number | null
          interest_category?: string
          join_policy?: Database["public"]["Enums"]["join_policy"]
          organizer_id?: string
          proof_url?: string | null
          social_links?: Json
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_profiles_activity_area_village_id_fkey"
            columns: ["activity_area_village_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "community_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "community_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "community_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "community_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      fraud_flags: {
        Row: {
          checkin_id: string | null
          created_at: string
          detail: Json
          id: string
          kind: Database["public"]["Enums"]["flag_kind"]
          mission_completion_id: string | null
          organizer_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["flag_status"]
          user_id: string
        }
        Insert: {
          checkin_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          kind: Database["public"]["Enums"]["flag_kind"]
          mission_completion_id?: string | null
          organizer_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          user_id: string
        }
        Update: {
          checkin_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          kind?: Database["public"]["Enums"]["flag_kind"]
          mission_completion_id?: string | null
          organizer_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "v_checkpoint_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "v_moderation_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_mission_completion_id_fkey"
            columns: ["mission_completion_id"]
            isOneToOne: false
            referencedRelation: "mission_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_mission_completion_id_fkey"
            columns: ["mission_completion_id"]
            isOneToOne: false
            referencedRelation: "v_mission_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "fraud_flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_role"]
          status: Database["public"]["Enums"]["group_member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          status?: Database["public"]["Enums"]["group_member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          status?: Database["public"]["Enums"]["group_member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          leader_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          leader_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          leader_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      levels: {
        Row: {
          created_at: string
          level: number
          min_xp: number
          name: string
        }
        Insert: {
          created_at?: string
          level: number
          min_xp: number
          name: string
        }
        Update: {
          created_at?: string
          level?: number
          min_xp?: number
          name?: string
        }
        Relationships: []
      }
      merchant_outlets: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          lat: number
          lng: number
          name: string
          opening_hours: Json | null
          organizer_id: string
          updated_at: string
          village_id: string | null
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          lat: number
          lng: number
          name: string
          opening_hours?: Json | null
          organizer_id: string
          updated_at?: string
          village_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number
          lng?: number
          name?: string
          opening_hours?: Json | null
          organizer_id?: string
          updated_at?: string
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "merchant_outlets_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_profiles: {
        Row: {
          created_at: string
          merchant_category: string
          nib: string | null
          organizer_id: string
          proof_url: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          merchant_category: string
          nib?: string | null
          organizer_id: string
          proof_url?: string | null
          updated_at?: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          merchant_category?: string
          nib?: string | null
          organizer_id?: string
          proof_url?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "merchant_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "merchant_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "merchant_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "merchant_profiles_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: true
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      mission_code_attempts: {
        Row: {
          attempted_at: string
          id: number
          mission_id: string
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: never
          mission_id: string
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: never
          mission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_code_attempts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "activity_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_code_attempts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_mission_manual_candidates"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_code_attempts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_mission_stats"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_code_attempts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_participation_missions"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_code_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_code_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_code_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mission_completions: {
        Row: {
          activity_id: string
          distance_m: number | null
          group_id: string | null
          id: string
          is_flagged: boolean
          lat: number | null
          lng: number | null
          local_date: string | null
          mission_id: string
          participation_id: string
          proof_path: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["completion_status"]
          submitted_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          distance_m?: number | null
          group_id?: string | null
          id?: string
          is_flagged?: boolean
          lat?: number | null
          lng?: number | null
          local_date?: string | null
          mission_id: string
          participation_id: string
          proof_path?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: Database["public"]["Enums"]["completion_status"]
          submitted_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          distance_m?: number | null
          group_id?: string | null
          id?: string
          is_flagged?: boolean
          lat?: number | null
          lng?: number | null
          local_date?: string | null
          mission_id?: string
          participation_id?: string
          proof_path?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["completion_status"]
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "mission_completions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "activity_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_mission_manual_candidates"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_mission_stats"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_participation_missions"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_completions_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "participations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "v_activity_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "v_participation_missions"
            referencedColumns: ["participation_id"]
          },
          {
            foreignKeyName: "mission_completions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mission_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mission_templates: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"] | null
          category: Database["public"]["Enums"]["mission_category"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_required: boolean
          organizer_tips: string | null
          organizer_type: Database["public"]["Enums"]["organizer_type"] | null
          sort_order: number
          title: string
          updated_at: string
          verification: Database["public"]["Enums"]["mission_verification"]
          xp_reward: number
        }
        Insert: {
          activity_type?: Database["public"]["Enums"]["activity_type"] | null
          category?: Database["public"]["Enums"]["mission_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          organizer_tips?: string | null
          organizer_type?: Database["public"]["Enums"]["organizer_type"] | null
          sort_order?: number
          title: string
          updated_at?: string
          verification: Database["public"]["Enums"]["mission_verification"]
          xp_reward: number
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"] | null
          category?: Database["public"]["Enums"]["mission_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          organizer_tips?: string | null
          organizer_type?: Database["public"]["Enums"]["organizer_type"] | null
          sort_order?: number
          title?: string
          updated_at?: string
          verification?: Database["public"]["Enums"]["mission_verification"]
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "mission_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      monthly_village_winners: {
        Row: {
          active_citizens: number
          avg_xp: number
          created_at: string
          month: string
          rank: number
          village_id: string
        }
        Insert: {
          active_citizens: number
          avg_xp: number
          created_at?: string
          month: string
          rank: number
          village_id: string
        }
        Update: {
          active_citizens?: number
          avg_xp?: number
          created_at?: string
          month?: string
          rank?: number
          village_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_village_winners_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organizer_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          organizer_id: string
          role: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          organizer_id: string
          role: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          organizer_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organizer_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organizer_invites_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_invites_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "organizer_invites_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "organizer_invites_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "organizer_invites_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "organizer_invites_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      organizer_members: {
        Row: {
          created_at: string
          invited_by: string | null
          organizer_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          organizer_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          organizer_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "organizer_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organizers: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          review_note: string | null
          slug: string
          status: Database["public"]["Enums"]["organizer_status"]
          type: Database["public"]["Enums"]["organizer_type"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          village_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          review_note?: string | null
          slug: string
          status?: Database["public"]["Enums"]["organizer_status"]
          type: Database["public"]["Enums"]["organizer_type"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          village_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          review_note?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["organizer_status"]
          type?: Database["public"]["Enums"]["organizer_type"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organizers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organizers_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      participations: {
        Row: {
          activity_id: string
          completed_at: string | null
          created_at: string
          group_id: string | null
          id: string
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_due_at: string | null
          payment_note: string | null
          payment_proof_path: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          progress: number
          refunded_at: string | null
          registered_by: string | null
          status: Database["public"]["Enums"]["participation_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          completed_at?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_due_at?: string | null
          payment_note?: string | null
          payment_proof_path?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          progress?: number
          refunded_at?: string | null
          registered_by?: string | null
          status?: Database["public"]["Enums"]["participation_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          completed_at?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_due_at?: string | null
          payment_note?: string | null
          payment_proof_path?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          progress?: number
          refunded_at?: string | null
          registered_by?: string | null
          status?: Database["public"]["Enums"]["participation_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "participations_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "participations_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      point_allocations: {
        Row: {
          amount: number
          credit_id: string
          debit_id: string
        }
        Insert: {
          amount: number
          credit_id: string
          debit_id: string
        }
        Update: {
          amount?: number
          credit_id?: string
          debit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_allocations_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "point_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_allocations_debit_id_fkey"
            columns: ["debit_id"]
            isOneToOne: false
            referencedRelation: "point_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      point_ledger: {
        Row: {
          activity_id: string | null
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          reason: Database["public"]["Enums"]["point_reason"]
          redemption_id: string | null
          source_organizer_id: string | null
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          amount: number
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          reason: Database["public"]["Enums"]["point_reason"]
          redemption_id?: string | null
          source_organizer_id?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string | null
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["point_reason"]
          redemption_id?: string | null
          source_organizer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "point_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "point_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "point_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "point_ledger_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledger_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "v_reward_redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledger_source_organizer_id_fkey"
            columns: ["source_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledger_source_organizer_id_fkey"
            columns: ["source_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "point_ledger_source_organizer_id_fkey"
            columns: ["source_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "point_ledger_source_organizer_id_fkey"
            columns: ["source_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "point_ledger_source_organizer_id_fkey"
            columns: ["source_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "point_ledger_source_organizer_id_fkey"
            columns: ["source_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "point_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          full_name: string | null
          home_village_changed_at: string | null
          home_village_id: string | null
          id: string
          is_admin: boolean
          nickname: string | null
          onboarded_at: string | null
          suspended_at: string | null
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string | null
          home_village_changed_at?: string | null
          home_village_id?: string | null
          id: string
          is_admin?: boolean
          nickname?: string | null
          onboarded_at?: string | null
          suspended_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string | null
          home_village_changed_at?: string | null
          home_village_id?: string | null
          id?: string
          is_admin?: boolean
          nickname?: string | null
          onboarded_at?: string | null
          suspended_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_village_id_fkey"
            columns: ["home_village_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          price_points: number
          reward_id: string
          status: Database["public"]["Enums"]["redemption_status"]
          updated_at: string
          used_at: string | null
          used_by: string | null
          used_outlet_id: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          price_points: number
          reward_id: string
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          used_outlet_id?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          price_points?: number
          reward_id?: string
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          used_outlet_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "redemptions_used_outlet_id_fkey"
            columns: ["used_outlet_id"]
            isOneToOne: false
            referencedRelation: "merchant_outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_used_outlet_id_fkey"
            columns: ["used_outlet_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_outlet_vouchers"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          level: Database["public"]["Enums"]["region_level"]
          name: string
          parent_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          level: Database["public"]["Enums"]["region_level"]
          name: string
          parent_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["region_level"]
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          available_until: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          organizer_id: string
          price_points: number
          status: Database["public"]["Enums"]["reward_status"]
          stock: number
          title: string
          updated_at: string
          valid_days: number
          valid_outlet_ids: string[] | null
        }
        Insert: {
          available_until?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          organizer_id: string
          price_points: number
          status?: Database["public"]["Enums"]["reward_status"]
          stock?: number
          title: string
          updated_at?: string
          valid_days?: number
          valid_outlet_ids?: string[] | null
        }
        Update: {
          available_until?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          organizer_id?: string
          price_points?: number
          status?: Database["public"]["Enums"]["reward_status"]
          stock?: number
          title?: string
          updated_at?: string
          valid_days?: number
          valid_outlet_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "rewards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      suggestions: {
        Row: {
          body: string
          category: Database["public"]["Enums"]["suggestion_category"]
          created_at: string
          id: string
          is_anonymous: boolean
          organizer_id: string
          replied_at: string | null
          replied_by: string | null
          reply: string | null
          status: Database["public"]["Enums"]["suggestion_status"]
          status_changed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          category?: Database["public"]["Enums"]["suggestion_category"]
          created_at?: string
          id?: string
          is_anonymous?: boolean
          organizer_id: string
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          status_changed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: Database["public"]["Enums"]["suggestion_category"]
          created_at?: string
          id?: string
          is_anonymous?: boolean
          organizer_id?: string
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          status_changed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "suggestions_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_badges: {
        Row: {
          activity_id: string | null
          awarded_at: string
          badge_id: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          awarded_at?: string
          badge_id: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          awarded_at?: string
          badge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "user_badges_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "user_badges_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "user_badges_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      xp_ledger: {
        Row: {
          activity_id: string | null
          amount: number
          checkin_id: string | null
          created_at: string
          id: string
          local_date: string
          mission_completion_id: string | null
          note: string | null
          reason: Database["public"]["Enums"]["xp_reason"]
          user_id: string
          village_id: string | null
        }
        Insert: {
          activity_id?: string | null
          amount: number
          checkin_id?: string | null
          created_at?: string
          id?: string
          local_date?: string
          mission_completion_id?: string | null
          note?: string | null
          reason: Database["public"]["Enums"]["xp_reason"]
          user_id: string
          village_id?: string | null
        }
        Update: {
          activity_id?: string | null
          amount?: number
          checkin_id?: string | null
          created_at?: string
          id?: string
          local_date?: string
          mission_completion_id?: string | null
          note?: string | null
          reason?: Database["public"]["Enums"]["xp_reason"]
          user_id?: string
          village_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "xp_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "xp_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "xp_ledger_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "xp_ledger_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "v_checkpoint_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "v_moderation_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_mission_completion_id_fkey"
            columns: ["mission_completion_id"]
            isOneToOne: false
            referencedRelation: "mission_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_mission_completion_id_fkey"
            columns: ["mission_completion_id"]
            isOneToOne: false
            referencedRelation: "v_mission_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "xp_ledger_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_activity_budget: {
        Row: {
          activity_id: string | null
          budget: number | null
          organizer_id: string | null
          remaining: number | null
          used: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      v_activity_cards: {
        Row: {
          audience: Database["public"]["Enums"]["activity_audience"] | null
          cover_url: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["difficulty"] | null
          ends_at: string | null
          goal: Database["public"]["Enums"]["activity_goal"] | null
          group_max: number | null
          group_min: number | null
          host_logo_url: string | null
          host_name: string | null
          host_organizer_id: string | null
          host_slug: string | null
          host_type: Database["public"]["Enums"]["organizer_type"] | null
          id: string | null
          is_paid: boolean | null
          join_mode: Database["public"]["Enums"]["join_mode"] | null
          partner_count: number | null
          points_per_completion: number | null
          price_idr: number | null
          published_at: string | null
          quota: number | null
          residency_rule: Database["public"]["Enums"]["residency_rule"] | null
          scope_region_id: string | null
          scope_region_level: Database["public"]["Enums"]["region_level"] | null
          scope_region_name: string | null
          seats_taken: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["activity_status"] | null
          target_count: number | null
          target_kind: Database["public"]["Enums"]["target_kind"] | null
          target_scope: Database["public"]["Enums"]["target_scope"] | null
          title: string | null
          type: Database["public"]["Enums"]["activity_type"] | null
          xp_base: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_scope_region_id_fkey"
            columns: ["scope_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_activity_daily_checkins: {
        Row: {
          activity_id: string | null
          checkins: number | null
          citizens: number | null
          local_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
        ]
      }
      v_activity_participants: {
        Row: {
          activity_id: string | null
          completed_at: string | null
          created_at: string | null
          group_id: string | null
          id: string | null
          nickname: string | null
          payment_confirmed_at: string | null
          payment_due_at: string | null
          payment_note: string | null
          payment_proof_path: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          progress: number | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["participation_status"] | null
          user_id: string | null
          village_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_activity_partner_stats: {
        Row: {
          activity_id: string | null
          checkins: number | null
          citizens: number | null
          organizer_id: string | null
          organizer_name: string | null
          organizer_type: Database["public"]["Enums"]["organizer_type"] | null
          points_budget: number | null
          role: Database["public"]["Enums"]["partner_role"] | null
          vouchers_redeemed: number | null
          vouchers_used: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      v_activity_partners: {
        Row: {
          activity_id: string | null
          activity_status: Database["public"]["Enums"]["activity_status"] | null
          activity_title: string | null
          contribution_note: string | null
          created_at: string | null
          ends_at: string | null
          host_name: string | null
          host_organizer_id: string | null
          host_type: Database["public"]["Enums"]["organizer_type"] | null
          id: string | null
          organizer_id: string | null
          organizer_logo_url: string | null
          organizer_name: string | null
          organizer_slug: string | null
          organizer_type: Database["public"]["Enums"]["organizer_type"] | null
          points_budget: number | null
          responded_at: string | null
          role: Database["public"]["Enums"]["partner_role"] | null
          source: Database["public"]["Enums"]["partner_source"] | null
          starts_at: string | null
          status: Database["public"]["Enums"]["partner_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_partners_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      v_activity_payment_stats: {
        Row: {
          activity_id: string | null
          awaiting_confirmation: number | null
          expected_idr: number | null
          host_organizer_id: string | null
          paid: number | null
          price_idr: number | null
          refund_due: number | null
          refunded: number | null
          status: Database["public"]["Enums"]["activity_status"] | null
          title: string | null
          unpaid: number | null
        }
        Insert: {
          activity_id?: string | null
          awaiting_confirmation?: never
          expected_idr?: never
          host_organizer_id?: string | null
          paid?: never
          price_idr?: number | null
          refund_due?: never
          refunded?: never
          status?: Database["public"]["Enums"]["activity_status"] | null
          title?: string | null
          unpaid?: never
        }
        Update: {
          activity_id?: string | null
          awaiting_confirmation?: never
          expected_idr?: never
          host_organizer_id?: string | null
          paid?: never
          price_idr?: number | null
          refund_due?: never
          refunded?: never
          status?: Database["public"]["Enums"]["activity_status"] | null
          title?: string | null
          unpaid?: never
        }
        Relationships: [
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      v_activity_stats: {
        Row: {
          activity_id: string | null
          attended: number | null
          checkins_flagged: number | null
          checkins_today: number | null
          completed: number | null
          groups_count: number | null
          host_organizer_id: string | null
          new_citizens: number | null
          payments_pending: number | null
          registered_group: number | null
          registered_individual: number | null
          returning_citizens: number | null
        }
        Insert: {
          activity_id?: string | null
          attended?: never
          checkins_flagged?: never
          checkins_today?: never
          completed?: never
          groups_count?: never
          host_organizer_id?: string | null
          new_citizens?: never
          payments_pending?: never
          registered_group?: never
          registered_individual?: never
          returning_citizens?: never
        }
        Update: {
          activity_id?: string | null
          attended?: never
          checkins_flagged?: never
          checkins_today?: never
          completed?: never
          groups_count?: never
          host_organizer_id?: string | null
          new_citizens?: never
          payments_pending?: never
          registered_group?: never
          registered_individual?: never
          returning_citizens?: never
        }
        Relationships: [
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activities_host_organizer_id_fkey"
            columns: ["host_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      v_admin_overview: {
        Row: {
          active_communities: number | null
          active_merchants: number | null
          citizens: number | null
          flagged_checkins: number | null
          oldest_pending_activity_at: string | null
          open_pattern_flags: number | null
          pending_activities: number | null
          pending_merchants: number | null
          pending_organizers: number | null
          points_circulating: number | null
          points_redeemed_month: number | null
          refunds_pending: number | null
          running_activities: number | null
          running_challenges: number | null
          running_events: number | null
          weekly_active: number | null
          weekly_active_prev: number | null
        }
        Relationships: []
      }
      v_admin_refund_queue: {
        Row: {
          activity_id: string | null
          activity_status: Database["public"]["Enums"]["activity_status"] | null
          cancelled_at: string | null
          host_name: string | null
          host_organizer_id: string | null
          host_type: Database["public"]["Enums"]["organizer_type"] | null
          host_whatsapp: string | null
          oldest_due_at: string | null
          price_idr: number | null
          refund_due: number | null
          refunded: number | null
          title: string | null
        }
        Relationships: []
      }
      v_admin_users: {
        Row: {
          avatar_url: string | null
          checkins: number | null
          created_at: string | null
          deleted_at: string | null
          full_name: string | null
          id: string | null
          is_admin: boolean | null
          last_checkin_at: string | null
          nickname: string | null
          onboarded_at: string | null
          open_flags: number | null
          suspended_at: string | null
          total_xp: number | null
          village_name: string | null
        }
        Relationships: []
      }
      v_admin_weekly_active: {
        Row: {
          active_citizens: number | null
          week_start: string | null
        }
        Relationships: []
      }
      v_checkpoint_checkins: {
        Row: {
          activity_id: string | null
          checked_in_at: string | null
          checkpoint_id: string | null
          distance_m: number | null
          group_id: string | null
          id: string | null
          local_date: string | null
          nickname: string | null
          partner_organizer_id: string | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          village_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "activity_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      v_community_dashboard: {
        Row: {
          awaiting_partner_activities: number | null
          checkins_today: number | null
          draft_activities: number | null
          mission_proofs_pending: number | null
          organizer_id: string | null
          participants: number | null
          partner_invites_pending: number | null
          payments_pending: number | null
          pending_requests: number | null
          published_activities: number | null
          running_activities: number | null
        }
        Insert: {
          awaiting_partner_activities?: never
          checkins_today?: never
          draft_activities?: never
          mission_proofs_pending?: never
          organizer_id?: string | null
          participants?: never
          partner_invites_pending?: never
          payments_pending?: never
          pending_requests?: never
          published_activities?: never
          running_activities?: never
        }
        Update: {
          awaiting_partner_activities?: never
          checkins_today?: never
          draft_activities?: never
          mission_proofs_pending?: never
          organizer_id?: string | null
          participants?: never
          partner_invites_pending?: never
          payments_pending?: never
          pending_requests?: never
          published_activities?: never
          running_activities?: never
        }
        Relationships: []
      }
      v_community_member_stats: {
        Row: {
          active_members: number | null
          attending_members_30d: number | null
          community_id: string | null
          new_members_month: number | null
          pending_requests: number | null
        }
        Relationships: []
      }
      v_community_members: {
        Row: {
          community_id: string | null
          created_at: string | null
          decided_at: string | null
          ended_at: string | null
          id: string | null
          joined_at: string | null
          message: string | null
          nickname: string | null
          removed_reason: string | null
          status: Database["public"]["Enums"]["membership_status"] | null
          team_role: Database["public"]["Enums"]["member_role"] | null
          user_id: string | null
          village_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "community_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_group_members: {
        Row: {
          group_id: string | null
          joined_at: string | null
          nickname: string | null
          role: Database["public"]["Enums"]["group_role"] | null
          status: Database["public"]["Enums"]["group_member_status"] | null
          user_id: string | null
          village_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_group_progress: {
        Row: {
          activity_id: string | null
          contributors: number | null
          group_id: string | null
          group_name: string | null
          kind: Database["public"]["Enums"]["target_kind"] | null
          members: number | null
          progress: number | null
          rank: number | null
          target_count: number | null
        }
        Relationships: []
      }
      v_leaderboard_users_month: {
        Row: {
          nickname: string | null
          rank_city: number | null
          rank_village: number | null
          user_id: string | null
          village_id: string | null
          village_name: string | null
          xp_month: number | null
        }
        Relationships: []
      }
      v_leaderboard_villages_month: {
        Row: {
          active_citizens: number | null
          avg_xp: number | null
          district_name: string | null
          rank: number | null
          village_id: string | null
          village_name: string | null
          xp_total: number | null
        }
        Relationships: []
      }
      v_merchant_dashboard: {
        Row: {
          checkins_today: number | null
          draft_activities: number | null
          mission_proofs_pending: number | null
          new_citizens_30d: number | null
          next_starts_at: string | null
          organizer_id: string | null
          participants: number | null
          participants_week: number | null
          partner_budget_empty: number | null
          partner_invites_pending: number | null
          payments_pending: number | null
          points_budget: number | null
          points_used: number | null
          published_activities: number | null
          returning_citizens_30d: number | null
          running_activities: number | null
          vouchers_active: number | null
          vouchers_redeemed: number | null
          vouchers_used: number | null
        }
        Insert: {
          checkins_today?: never
          draft_activities?: never
          mission_proofs_pending?: never
          new_citizens_30d?: never
          next_starts_at?: never
          organizer_id?: string | null
          participants?: never
          participants_week?: never
          partner_budget_empty?: never
          partner_invites_pending?: never
          payments_pending?: never
          points_budget?: never
          points_used?: never
          published_activities?: never
          returning_citizens_30d?: never
          running_activities?: never
          vouchers_active?: never
          vouchers_redeemed?: never
          vouchers_used?: never
        }
        Update: {
          checkins_today?: never
          draft_activities?: never
          mission_proofs_pending?: never
          new_citizens_30d?: never
          next_starts_at?: never
          organizer_id?: string | null
          participants?: never
          participants_week?: never
          partner_budget_empty?: never
          partner_invites_pending?: never
          payments_pending?: never
          points_budget?: never
          points_used?: never
          published_activities?: never
          returning_citizens_30d?: never
          running_activities?: never
          vouchers_active?: never
          vouchers_redeemed?: never
          vouchers_used?: never
        }
        Relationships: []
      }
      v_merchant_outlet_vouchers: {
        Row: {
          organizer_id: string | null
          outlet_id: string | null
          outlet_name: string | null
          vouchers_used: number | null
          vouchers_used_30d: number | null
        }
        Insert: {
          organizer_id?: string | null
          outlet_id?: string | null
          outlet_name?: string | null
          vouchers_used?: never
          vouchers_used_30d?: never
        }
        Update: {
          organizer_id?: string | null
          outlet_id?: string | null
          outlet_name?: string | null
          vouchers_used?: never
          vouchers_used_30d?: never
        }
        Relationships: [
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "merchant_outlets_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      v_mission_manual_candidates: {
        Row: {
          activity_id: string | null
          done: boolean | null
          group_id: string | null
          mission_id: string | null
          nickname: string | null
          user_id: string | null
          village_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_mission_review_queue: {
        Row: {
          activity_id: string | null
          activity_title: string | null
          id: string | null
          mission_id: string | null
          mission_title: string | null
          nickname: string | null
          partner_organizer_id: string | null
          proof_path: string | null
          review_note: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["completion_status"] | null
          submitted_at: string | null
          user_id: string | null
          village_name: string | null
          xp_reward: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "activity_missions_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "mission_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "activity_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_mission_manual_candidates"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_mission_stats"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "v_participation_missions"
            referencedColumns: ["mission_id"]
          },
          {
            foreignKeyName: "mission_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_mission_stats: {
        Row: {
          activity_id: string | null
          approved: number | null
          flagged: number | null
          mission_id: string | null
          participants: number | null
          pending: number | null
          rejected: number | null
          unlocked_for: number | null
        }
        Insert: {
          activity_id?: string | null
          approved?: never
          flagged?: never
          mission_id?: string | null
          participants?: never
          pending?: never
          rejected?: never
          unlocked_for?: never
        }
        Update: {
          activity_id?: string | null
          approved?: never
          flagged?: never
          mission_id?: string | null
          participants?: never
          pending?: never
          rejected?: never
          unlocked_for?: never
        }
        Relationships: [
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_missions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
        ]
      }
      v_mission_template_stats: {
        Row: {
          activities: number | null
          completions: number | null
          last_used_at: string | null
          missions: number | null
          participant_slots: number | null
          template_id: string | null
        }
        Insert: {
          activities?: never
          completions?: never
          last_used_at?: never
          missions?: never
          participant_slots?: never
          template_id?: string | null
        }
        Update: {
          activities?: never
          completions?: never
          last_used_at?: never
          missions?: never
          participant_slots?: never
          template_id?: string | null
        }
        Relationships: []
      }
      v_moderation_checkins: {
        Row: {
          account_created_at: string | null
          activity_id: string | null
          activity_title: string | null
          activity_type: Database["public"]["Enums"]["activity_type"] | null
          checked_in_at: string | null
          checkpoint_id: string | null
          checkpoint_name: string | null
          distance_m: number | null
          id: string | null
          local_date: string | null
          nickname: string | null
          partner_name: string | null
          partner_organizer_id: string | null
          radius_m: number | null
          review_note: string | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          reviewed_at: string | null
          user_id: string | null
          village_name: string | null
          xp_awarded: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkins_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "activity_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "checkins_partner_organizer_id_fkey"
            columns: ["partner_organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_moderation_flags: {
        Row: {
          activity_title: string | null
          checkin_id: string | null
          checkpoint_name: string | null
          created_at: string | null
          detail: Json | null
          id: string | null
          kind: Database["public"]["Enums"]["flag_kind"] | null
          nickname: string | null
          organizer_id: string | null
          organizer_name: string | null
          organizer_type: Database["public"]["Enums"]["organizer_type"] | null
          partner_name: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["flag_status"] | null
          suspended_at: string | null
          user_id: string | null
          village_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "v_checkpoint_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "v_moderation_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "fraud_flags_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_organizer_reputation: {
        Row: {
          attendance_pct: number | null
          attended_90d: number | null
          checkins_90d: number | null
          collabs_90d: number | null
          completed_90d: number | null
          completion_pct: number | null
          name: string | null
          organizer_id: string | null
          registered_90d: number | null
          score: number | null
          type: Database["public"]["Enums"]["organizer_type"] | null
        }
        Relationships: []
      }
      v_organizer_suggestions: {
        Row: {
          body: string | null
          category: Database["public"]["Enums"]["suggestion_category"] | null
          created_at: string | null
          id: string | null
          is_anonymous: boolean | null
          nickname: string | null
          organizer_id: string | null
          replied_at: string | null
          replied_by_nickname: string | null
          reply: string | null
          status: Database["public"]["Enums"]["suggestion_status"] | null
          status_changed_at: string | null
          updated_at: string | null
          user_id: string | null
          village_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "suggestions_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      v_organizer_team: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          nickname: string | null
          organizer_id: string | null
          role: Database["public"]["Enums"]["member_role"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "organizer_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "organizer_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_participation_missions: {
        Row: {
          activity_id: string | null
          is_required: boolean | null
          is_revealed: boolean | null
          mission_id: string | null
          participation_id: string | null
          required_done: number | null
          required_total: number | null
          status: Database["public"]["Enums"]["completion_status"] | null
          title: string | null
          user_id: string | null
          verification:
            | Database["public"]["Enums"]["mission_verification"]
            | null
          xp_reward: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_payment_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_stats"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_group_progress"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_reward_redemptions: {
        Row: {
          code: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          nickname: string | null
          organizer_id: string | null
          outlet_name: string | null
          price_points: number | null
          reward_id: string | null
          status: Database["public"]["Enums"]["redemption_status"] | null
          title: string | null
          used_at: string | null
          used_outlet_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_used_outlet_id_fkey"
            columns: ["used_outlet_id"]
            isOneToOne: false
            referencedRelation: "merchant_outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_used_outlet_id_fkey"
            columns: ["used_outlet_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_outlet_vouchers"
            referencedColumns: ["outlet_id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_admin_refund_queue"
            referencedColumns: ["host_organizer_id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_community_member_stats"
            referencedColumns: ["community_id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_merchant_dashboard"
            referencedColumns: ["organizer_id"]
          },
          {
            foreignKeyName: "rewards_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "v_organizer_reputation"
            referencedColumns: ["organizer_id"]
          },
        ]
      }
      v_user_level: {
        Row: {
          level: number | null
          level_name: string | null
          next_min_xp: number | null
          total_xp: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_user_points_balance: {
        Row: {
          balance: number | null
          expiring_30d: number | null
          next_expiry_at: string | null
          user_id: string | null
        }
        Insert: {
          balance?: never
          expiring_30d?: never
          next_expiry_at?: never
          user_id?: string | null
        }
        Update: {
          balance?: never
          expiring_30d?: never
          next_expiry_at?: never
          user_id?: string | null
        }
        Relationships: []
      }
      v_user_xp_total: {
        Row: {
          total_xp: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_points_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_village_active_month: {
        Row: {
          active_citizens: number | null
          village_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_organizer_invite: { Args: { p_token: string }; Returns: string }
      active_uid: { Args: never; Returns: string }
      activity_is_public: {
        Args: { p_status: Database["public"]["Enums"]["activity_status"] }
        Returns: boolean
      }
      activity_seats_taken: { Args: { p_activity_id: string }; Returns: number }
      add_checkpoint: {
        Args: { p_activity_id: string; p_data: Json }
        Returns: string
      }
      admin_add_partner: {
        Args: {
          p_activity_id: string
          p_note?: string
          p_organizer_id: string
          p_role: Database["public"]["Enums"]["partner_role"]
        }
        Returns: string
      }
      advance_activity_status: { Args: never; Returns: number }
      advance_if_partners_answered: {
        Args: { p_activity_id: string }
        Returns: undefined
      }
      apply_mission_approval: {
        Args: { p_completion_id: string }
        Returns: Json
      }
      apply_open_call: {
        Args: {
          p_budget?: number
          p_contribution?: string
          p_message?: string
          p_organizer_id: string
          p_post_id: string
          p_role: Database["public"]["Enums"]["partner_role"]
        }
        Returns: string
      }
      approve_checkin: {
        Args: { p_checkin_id: string; p_note?: string }
        Returns: undefined
      }
      award_badges: { Args: { p_user_id: string }; Returns: number }
      award_challenge_completion: {
        Args: {
          p_activity: Database["public"]["Tables"]["activities"]["Row"]
          p_checkin_id: string
          p_user_id: string
        }
        Returns: number
      }
      award_streak: { Args: never; Returns: number }
      award_xp: {
        Args: {
          p_activity_id?: string
          p_amount: number
          p_checkin_id?: string
          p_mission_completion_id?: string
          p_note?: string
          p_reason: Database["public"]["Enums"]["xp_reason"]
          p_user_id: string
        }
        Returns: number
      }
      can_manage_missions: {
        Args: { p_activity_id: string; p_partner_organizer_id: string }
        Returns: boolean
      }
      cancel_activity: {
        Args: { p_activity_id: string; p_reason?: string }
        Returns: undefined
      }
      cancel_participation: {
        Args: { p_participation_id: string }
        Returns: undefined
      }
      cancel_partner_invite: {
        Args: { p_partner_id: string }
        Returns: undefined
      }
      change_home_village: {
        Args: { p_village_id: string }
        Returns: undefined
      }
      check_partner_candidate: {
        Args: {
          p_activity_id: string
          p_organizer_id: string
          p_role: Database["public"]["Enums"]["partner_role"]
        }
        Returns: undefined
      }
      check_reviewer_burst: {
        Args: {
          p_activity_id: string
          p_organizer_id: string
          p_reviewer: string
        }
        Returns: undefined
      }
      checkin_progress: {
        Args: {
          p_activity_id: string
          p_group_id?: string
          p_kind: Database["public"]["Enums"]["target_kind"]
          p_participation_id?: string
        }
        Returns: number
      }
      checkpoint_village: { Args: { p_checkpoint_id: string }; Returns: string }
      close_collab_post: { Args: { p_post_id: string }; Returns: undefined }
      close_expired_collab_posts: { Args: never; Returns: number }
      community_public_stats: {
        Args: { p_community_id: string }
        Returns: {
          active_members: number
        }[]
      }
      complete_mission: {
        Args: {
          p_code?: string
          p_lat?: number
          p_lng?: number
          p_mission_id: string
          p_proof_path?: string
          p_token?: string
        }
        Returns: Json
      }
      complete_onboarding: {
        Args: { p_full_name: string; p_nickname: string; p_village_id: string }
        Returns: number
      }
      confirm_group_registration: {
        Args: { p_accept: boolean; p_participation_id: string }
        Returns: undefined
      }
      confirm_payment: {
        Args: { p_note?: string; p_paid: boolean; p_participation_id: string }
        Returns: Json
      }
      create_activity: {
        Args: { p_data: Json; p_host_organizer_id: string }
        Returns: string
      }
      create_collab_post: {
        Args: { p_data: Json; p_organizer_id: string }
        Returns: string
      }
      create_group: { Args: { p_name: string }; Returns: string }
      create_organizer_invite: {
        Args: {
          p_organizer_id: string
          p_role: Database["public"]["Enums"]["member_role"]
        }
        Returns: string
      }
      credit_points: {
        Args: {
          p_activity_id: string
          p_amount: number
          p_note: string
          p_reason: Database["public"]["Enums"]["point_reason"]
          p_redemption_id: string
          p_source_organizer_id: string
          p_user_id: string
        }
        Returns: string
      }
      debit_points: {
        Args: {
          p_amount: number
          p_note: string
          p_reason: Database["public"]["Enums"]["point_reason"]
          p_redemption_id: string
          p_user_id: string
        }
        Returns: string
      }
      decide_application: {
        Args: { p_accept: boolean; p_application_id: string }
        Returns: undefined
      }
      decide_membership: {
        Args: { p_accept: boolean; p_membership_id: string }
        Returns: undefined
      }
      delete_my_account: { Args: { p_confirm: string }; Returns: undefined }
      detect_fraud_patterns: { Args: never; Returns: number }
      distance_m: {
        Args: { p_lat1: number; p_lat2: number; p_lng1: number; p_lng2: number }
        Returns: number
      }
      evaluate_completion: {
        Args: {
          p_checkin_id?: string
          p_participation_id: string
          p_preferred_organizer_id?: string
        }
        Returns: Json
      }
      expire_membership_requests: { Args: never; Returns: number }
      expire_points: { Args: never; Returns: number }
      expire_redemptions: { Args: never; Returns: number }
      expire_unpaid_participations: { Args: never; Returns: number }
      get_activity_missions: { Args: { p_activity_id: string }; Returns: Json }
      get_checkpoint_qr: { Args: { p_checkpoint_id: string }; Returns: Json }
      get_citizen_dashboard: { Args: never; Returns: Json }
      get_leaderboard: {
        Args: { p_month?: string; p_region_id?: string; p_scope?: string }
        Returns: Json
      }
      get_mission_qr: { Args: { p_mission_id: string }; Returns: Json }
      grant_completion_points: {
        Args: {
          p_activity: Database["public"]["Tables"]["activities"]["Row"]
          p_preferred_organizer_id: string
          p_user_id: string
        }
        Returns: number
      }
      invite_partner: {
        Args: {
          p_activity_id: string
          p_budget?: number
          p_note?: string
          p_organizer_id: string
          p_role: Database["public"]["Enums"]["partner_role"]
        }
        Returns: string
      }
      is_activity_host_leader: {
        Args: { p_activity_id: string }
        Returns: boolean
      }
      is_activity_host_team: {
        Args: { p_activity_id: string }
        Returns: boolean
      }
      is_activity_team: { Args: { p_activity_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_group_leader: { Args: { p_group_id: string }; Returns: boolean }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      is_invited_partner_team: {
        Args: { p_activity_id: string }
        Returns: boolean
      }
      is_resident_of: {
        Args: { p_region_id: string; p_user_id: string }
        Returns: boolean
      }
      is_team_leader: { Args: { p_organizer_id: string }; Returns: boolean }
      is_team_member: { Args: { p_organizer_id: string }; Returns: boolean }
      join_activity: { Args: { p_activity_id: string }; Returns: string }
      join_group: { Args: { p_invite_code: string }; Returns: string }
      leaderboard_users: {
        Args: { p_month?: string }
        Returns: {
          nickname: string
          rank_city: number
          rank_village: number
          user_id: string
          village_id: string
          village_name: string
          xp_month: number
        }[]
      }
      leaderboard_villages: {
        Args: { p_month?: string }
        Returns: {
          active_citizens: number
          avg_xp: number
          district_name: string
          qualifies: boolean
          rank: number
          village_id: string
          village_name: string
          xp_total: number
        }[]
      }
      leave_activity: { Args: { p_partner_id: string }; Returns: undefined }
      leave_community: { Args: { p_community_id: string }; Returns: undefined }
      leave_group: { Args: { p_group_id: string }; Returns: undefined }
      local_today: { Args: never; Returns: string }
      lookup_voucher: {
        Args: { p_code: string; p_organizer_id: string }
        Returns: Json
      }
      make_organizer_slug: { Args: { p_name: string }; Returns: string }
      mark_missions_manual: {
        Args: { p_mission_id: string; p_user_ids: string[] }
        Returns: number
      }
      mark_notifications_read: { Args: { p_id?: string }; Returns: undefined }
      mark_refunded: {
        Args: { p_note?: string; p_participation_id: string }
        Returns: Json
      }
      mission_open_for: {
        Args: { p_mission_id: string; p_user_id: string }
        Returns: boolean
      }
      mission_progress: {
        Args: {
          p_activity_id: string
          p_group_id?: string
          p_kind: Database["public"]["Enums"]["target_kind"]
          p_participation_id?: string
        }
        Returns: number
      }
      new_invite_code: { Args: never; Returns: string }
      new_voucher_code: { Args: never; Returns: string }
      notify: {
        Args: { p_kind: string; p_payload?: Json; p_user_id: string }
        Returns: undefined
      }
      notify_expiring: { Args: never; Returns: number }
      notify_team: {
        Args: { p_kind: string; p_organizer_id: string; p_payload?: Json }
        Returns: undefined
      }
      payment_due_for: {
        Args: { p_activity: Database["public"]["Tables"]["activities"]["Row"] }
        Returns: string
      }
      perform_checkin: {
        Args: {
          p_checkpoint_id: string
          p_lat?: number
          p_lng?: number
          p_token: string
        }
        Returns: Json
      }
      platform_organizer_id: { Args: never; Returns: string }
      points_balance: { Args: { p_user_id: string }; Returns: number }
      prune_code_attempts: { Args: never; Returns: number }
      public_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          id: string
          nickname: string
          village_name: string
        }[]
      }
      qr_slot: { Args: { p_at?: string }; Returns: number }
      qr_token: {
        Args: { p_checkpoint_id: string; p_secret: string; p_slot: number }
        Returns: string
      }
      read_pricing: { Args: { p_data: Json }; Returns: Json }
      redeem_reward: { Args: { p_reward_id: string }; Returns: Json }
      refund_redemption: {
        Args: { p_redemption_id: string }
        Returns: undefined
      }
      regenerate_invite_code: { Args: { p_group_id: string }; Returns: string }
      register_group: {
        Args: {
          p_activity_id: string
          p_group_id: string
          p_member_ids: string[]
        }
        Returns: number
      }
      register_organizer: {
        Args: {
          p_data: Json
          p_type: Database["public"]["Enums"]["organizer_type"]
        }
        Returns: string
      }
      remove_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      remove_member: {
        Args: { p_membership_id: string; p_reason?: string }
        Returns: undefined
      }
      remove_team_member: {
        Args: { p_organizer_id: string; p_user_id: string }
        Returns: undefined
      }
      request_membership: {
        Args: { p_community_id: string; p_message?: string }
        Returns: Database["public"]["Enums"]["membership_status"]
      }
      respond_partner_invite: {
        Args: { p_accept: boolean; p_budget?: number; p_partner_id: string }
        Returns: undefined
      }
      respond_suggestion: {
        Args: {
          p_reply?: string
          p_status: Database["public"]["Enums"]["suggestion_status"]
          p_suggestion_id: string
        }
        Returns: undefined
      }
      resubmit_organizer: {
        Args: { p_organizer_id: string }
        Returns: undefined
      }
      reveal_mission: { Args: { p_mission_id: string }; Returns: number }
      reveal_scheduled_missions: { Args: never; Returns: number }
      reverse_checkin: {
        Args: { p_checkin_id: string; p_note?: string }
        Returns: Json
      }
      review_activity: {
        Args: { p_activity_id: string; p_approve: boolean; p_note?: string }
        Returns: undefined
      }
      review_fraud_flag: {
        Args: { p_action: string; p_flag_id: string; p_note?: string }
        Returns: undefined
      }
      review_mission_completion: {
        Args: { p_approve: boolean; p_completion_id: string; p_note?: string }
        Returns: Json
      }
      review_organizer: {
        Args: { p_approve: boolean; p_note?: string; p_organizer_id: string }
        Returns: undefined
      }
      set_checkpoint_active: {
        Args: { p_active: boolean; p_checkpoint_id: string }
        Returns: undefined
      }
      set_join_policy: {
        Args: {
          p_community_id: string
          p_policy: Database["public"]["Enums"]["join_policy"]
        }
        Returns: undefined
      }
      set_mission_active: {
        Args: { p_active: boolean; p_mission_id: string }
        Returns: undefined
      }
      set_mission_template_active: {
        Args: { p_active: boolean; p_template_id: string }
        Returns: undefined
      }
      set_my_avatar: { Args: { p_url: string }; Returns: undefined }
      set_partner_budget: {
        Args: { p_budget: number; p_partner_id: string }
        Returns: undefined
      }
      set_points_per_completion: {
        Args: { p_activity_id: string; p_points: number }
        Returns: undefined
      }
      set_team_role: {
        Args: {
          p_organizer_id: string
          p_role: Database["public"]["Enums"]["member_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      setting_int: { Args: { p_key: string }; Returns: number }
      settle_ended_activities: { Args: never; Returns: number }
      snapshot_monthly_winners: { Args: never; Returns: number }
      submit_activity: {
        Args: { p_activity_id: string }
        Returns: Database["public"]["Enums"]["activity_status"]
      }
      submit_payment_proof: {
        Args: { p_participation_id: string; p_proof_path: string }
        Returns: Json
      }
      submit_suggestion: {
        Args: {
          p_body: string
          p_category: Database["public"]["Enums"]["suggestion_category"]
          p_is_anonymous?: boolean
          p_organizer_id: string
        }
        Returns: string
      }
      suspend_organizer: {
        Args: { p_note?: string; p_organizer_id: string; p_suspend: boolean }
        Returns: undefined
      }
      suspend_user: {
        Args: { p_note?: string; p_suspend: boolean; p_user_id: string }
        Returns: undefined
      }
      team_role: {
        Args: { p_organizer_id: string }
        Returns: Database["public"]["Enums"]["member_role"]
      }
      transfer_group_leader: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      update_activity: {
        Args: { p_activity_id: string; p_data: Json }
        Returns: undefined
      }
      update_my_profile: {
        Args: { p_full_name: string; p_nickname: string }
        Returns: undefined
      }
      upsert_challenge_target: {
        Args: { p_activity_id: string; p_data: Json }
        Returns: undefined
      }
      upsert_mission: {
        Args: { p_activity_id: string; p_mission: Json }
        Returns: string
      }
      upsert_mission_template: {
        Args: { p_data: Json; p_template_id: string }
        Returns: string
      }
      upsert_reward: {
        Args: { p_data: Json; p_organizer_id: string; p_reward_id: string }
        Returns: string
      }
      use_voucher: {
        Args: { p_code: string; p_outlet_id: string }
        Returns: Json
      }
      user_streak_weeks: { Args: { p_user_id: string }; Returns: number }
      withdraw_activity: { Args: { p_activity_id: string }; Returns: undefined }
      withdraw_application: {
        Args: { p_application_id: string }
        Returns: undefined
      }
    }
    Enums: {
      activity_audience: "public" | "members_only"
      activity_goal: "awareness" | "visit" | "sales" | "membership"
      activity_status:
        | "draft"
        | "awaiting_partners"
        | "in_review"
        | "published"
        | "running"
        | "ended"
        | "settled"
        | "cancelled"
      activity_type: "event" | "challenge"
      application_status: "pending" | "accepted" | "rejected" | "withdrawn"
      collab_kind: "collab" | "sponsor"
      completion_status: "pending_review" | "approved" | "rejected"
      difficulty: "easy" | "medium" | "hard"
      flag_kind:
        | "out_of_radius"
        | "impossible_travel"
        | "shared_device"
        | "burst_accounts"
        | "manual"
        | "reviewer_burst"
      flag_status: "open" | "dismissed" | "actioned"
      group_member_status: "active" | "left" | "removed"
      group_role: "leader" | "member"
      join_mode: "individual" | "group" | "both"
      join_policy: "open" | "approval"
      member_role: "owner" | "staff" | "chair" | "officer"
      membership_status: "pending" | "active" | "rejected" | "left" | "removed"
      mission_category:
        | "visit"
        | "purchase"
        | "social"
        | "sport"
        | "environment"
        | "learning"
        | "community"
        | "other"
      mission_reveal: "on_publish" | "scheduled" | "manual" | "after_mission"
      mission_verification: "qr_scan" | "secret_code" | "photo" | "manual"
      organizer_status: "pending" | "approved" | "rejected" | "suspended"
      organizer_type: "merchant" | "community" | "platform"
      participation_status:
        | "invited"
        | "registered"
        | "in_progress"
        | "completed"
        | "not_completed"
        | "cancelled"
      partner_role: "host" | "cohost" | "sponsor"
      partner_source: "creator" | "invite" | "open_call" | "admin"
      partner_status: "invited" | "accepted" | "declined" | "removed"
      payment_status:
        | "not_required"
        | "unpaid"
        | "awaiting_confirmation"
        | "paid"
        | "refunded"
      point_reason:
        | "activity_reward"
        | "redemption"
        | "refund"
        | "expiry"
        | "reversal"
        | "adjustment"
      post_status: "open" | "closed"
      redemption_status: "active" | "used" | "expired" | "refunded"
      region_level: "city" | "district" | "village"
      residency_rule: "open" | "residents_only"
      review_status: "ok" | "flagged" | "approved" | "rejected"
      reward_status: "active" | "inactive"
      suggestion_category:
        | "activity"
        | "product"
        | "service"
        | "place"
        | "other"
      suggestion_status: "new" | "in_progress" | "done" | "archived"
      target_kind:
        | "total_checkins"
        | "distinct_checkpoints"
        | "required_missions"
        | "missions_completed"
      target_scope: "individual" | "group"
      xp_reason:
        | "profile_complete"
        | "event_checkin"
        | "challenge_complete"
        | "mission_complete"
        | "first_visit_bonus"
        | "collab_bonus"
        | "group_bonus"
        | "streak"
        | "reversal"
        | "adjustment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_audience: ["public", "members_only"],
      activity_goal: ["awareness", "visit", "sales", "membership"],
      activity_status: [
        "draft",
        "awaiting_partners",
        "in_review",
        "published",
        "running",
        "ended",
        "settled",
        "cancelled",
      ],
      activity_type: ["event", "challenge"],
      application_status: ["pending", "accepted", "rejected", "withdrawn"],
      collab_kind: ["collab", "sponsor"],
      completion_status: ["pending_review", "approved", "rejected"],
      difficulty: ["easy", "medium", "hard"],
      flag_kind: [
        "out_of_radius",
        "impossible_travel",
        "shared_device",
        "burst_accounts",
        "manual",
        "reviewer_burst",
      ],
      flag_status: ["open", "dismissed", "actioned"],
      group_member_status: ["active", "left", "removed"],
      group_role: ["leader", "member"],
      join_mode: ["individual", "group", "both"],
      join_policy: ["open", "approval"],
      member_role: ["owner", "staff", "chair", "officer"],
      membership_status: ["pending", "active", "rejected", "left", "removed"],
      mission_category: [
        "visit",
        "purchase",
        "social",
        "sport",
        "environment",
        "learning",
        "community",
        "other",
      ],
      mission_reveal: ["on_publish", "scheduled", "manual", "after_mission"],
      mission_verification: ["qr_scan", "secret_code", "photo", "manual"],
      organizer_status: ["pending", "approved", "rejected", "suspended"],
      organizer_type: ["merchant", "community", "platform"],
      participation_status: [
        "invited",
        "registered",
        "in_progress",
        "completed",
        "not_completed",
        "cancelled",
      ],
      partner_role: ["host", "cohost", "sponsor"],
      partner_source: ["creator", "invite", "open_call", "admin"],
      partner_status: ["invited", "accepted", "declined", "removed"],
      payment_status: [
        "not_required",
        "unpaid",
        "awaiting_confirmation",
        "paid",
        "refunded",
      ],
      point_reason: [
        "activity_reward",
        "redemption",
        "refund",
        "expiry",
        "reversal",
        "adjustment",
      ],
      post_status: ["open", "closed"],
      redemption_status: ["active", "used", "expired", "refunded"],
      region_level: ["city", "district", "village"],
      residency_rule: ["open", "residents_only"],
      review_status: ["ok", "flagged", "approved", "rejected"],
      reward_status: ["active", "inactive"],
      suggestion_category: ["activity", "product", "service", "place", "other"],
      suggestion_status: ["new", "in_progress", "done", "archived"],
      target_kind: [
        "total_checkins",
        "distinct_checkpoints",
        "required_missions",
        "missions_completed",
      ],
      target_scope: ["individual", "group"],
      xp_reason: [
        "profile_complete",
        "event_checkin",
        "challenge_complete",
        "mission_complete",
        "first_visit_bonus",
        "collab_bonus",
        "group_bonus",
        "streak",
        "reversal",
        "adjustment",
      ],
    },
  },
} as const
