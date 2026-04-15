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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      backtest_results: {
        Row: {
          created_at: string
          entry_price: number
          exit_price: number
          holding_days: number | null
          id: string
          instrument: string
          mae: number | null
          mfe: number | null
          pnl: number
          quantity: number
          side: string
          strategy_name: string
          timestamp: string
          user_id: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string
          entry_price: number
          exit_price: number
          holding_days?: number | null
          id?: string
          instrument: string
          mae?: number | null
          mfe?: number | null
          pnl: number
          quantity?: number
          side: string
          strategy_name: string
          timestamp?: string
          user_id: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string
          entry_price?: number
          exit_price?: number
          holding_days?: number | null
          id?: string
          instrument?: string
          mae?: number | null
          mfe?: number | null
          pnl?: number
          quantity?: number
          side?: string
          strategy_name?: string
          timestamp?: string
          user_id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      broker_connections: {
        Row: {
          broker_id: string
          broker_name: string
          created_at: string
          credentials_encrypted: string | null
          enc_totp: string | null
          id: string
          imei: string | null
          is_active: boolean
          last_heartbeat: string | null
          latency_ms: number | null
          orders_today: number | null
          status: Database["public"]["Enums"]["broker_status"]
          updated_at: string
          uptime_percent: number | null
          user_id: string
          vendor_code: string | null
        }
        Insert: {
          broker_id: string
          broker_name: string
          created_at?: string
          credentials_encrypted?: string | null
          enc_totp?: string | null
          id?: string
          imei?: string | null
          is_active?: boolean
          last_heartbeat?: string | null
          latency_ms?: number | null
          orders_today?: number | null
          status?: Database["public"]["Enums"]["broker_status"]
          updated_at?: string
          uptime_percent?: number | null
          user_id: string
          vendor_code?: string | null
        }
        Update: {
          broker_id?: string
          broker_name?: string
          created_at?: string
          credentials_encrypted?: string | null
          enc_totp?: string | null
          id?: string
          imei?: string | null
          is_active?: boolean
          last_heartbeat?: string | null
          latency_ms?: number | null
          orders_today?: number | null
          status?: Database["public"]["Enums"]["broker_status"]
          updated_at?: string
          uptime_percent?: number | null
          user_id?: string
          vendor_code?: string | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          entry_price: number
          id: string
          inserted_at: string
          ltp: number
          qty: number
          side: string
          strategy: string | null
          symbol: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          entry_price: number
          id?: string
          inserted_at?: string
          ltp: number
          qty: number
          side: string
          strategy?: string | null
          symbol: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          entry_price?: number
          id?: string
          inserted_at?: string
          ltp?: number
          qty?: number
          side?: string
          strategy?: string | null
          symbol?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      broker_configs: {
        Row: {
          broker_name: string
          broker_user_id: string | null
          created_at: string
          enc_api_key: string | null
          enc_password: string | null
          enc_totp: string | null
          id: string
          imei: string | null
          is_active: boolean
          updated_at: string
          user_id: string
          vendor_code: string | null
        }
        Insert: {
          broker_name: string
          broker_user_id?: string | null
          created_at?: string
          enc_api_key?: string | null
          enc_password?: string | null
          enc_totp?: string | null
          id?: string
          imei?: string | null
          is_active?: boolean
          updated_at?: string
          user_id: string
          vendor_code?: string | null
        }
        Update: {
          broker_name?: string
          broker_user_id?: string | null
          created_at?: string
          enc_api_key?: string | null
          enc_password?: string | null
          enc_totp?: string | null
          id?: string
          imei?: string | null
          is_active?: boolean
          updated_at?: string
          user_id?: string
          vendor_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_broker_credentials: {
        Args: { p_encrypted: string; p_encryption_key: string }
        Returns: Json
      }
      encrypt_broker_credentials: {
        Args: { p_credentials: Json; p_encryption_key: string }
        Returns: string
      }
    }
    Enums: {
      broker_status: "connected" | "degraded" | "disconnected"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      broker_status: ["connected", "degraded", "disconnected"],
    },
  },
} as const
