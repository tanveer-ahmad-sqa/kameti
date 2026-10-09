
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"committee_id": string,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"payload": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"committee_id": string,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"payload"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"committee_id"?: string,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"payload"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_committee_id_fkey"
      columns: ["committee_id"]
isOneToOne: false
      referencedRelation: "committees"
      referencedColumns: ["id"]
    }
                  ]
                },"committee_members": {
                  Row: {
                    "committee_id": string,"created_at": string,"display_name": string,"id": string,"is_former_user": boolean,"is_organizer": boolean,"phone": string | null,"turn_number": number | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "committee_id": string,"created_at"?: string,"display_name": string,"id"?: string,"is_former_user"?: boolean,"is_organizer"?: boolean,"phone"?: string | null,"turn_number"?: number | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "committee_id"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"is_former_user"?: boolean,"is_organizer"?: boolean,"phone"?: string | null,"turn_number"?: number | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "committee_members_committee_id_fkey"
      columns: ["committee_id"]
isOneToOne: false
      referencedRelation: "committees"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "committee_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"committees": {
                  Row: {
                    "activated_at": string | null,"completed_at": string | null,"contribution_amount": number,"created_at": string,"description": string | null,"due_day": number,"id": string,"member_count": number,"name": string,"order_locked_at": string | null,"organizer_id": string | null,"payout_day": number,"payout_order_method": Database["public"]['Enums']["payout_order_method"],"start_month": string,"status": Database["public"]['Enums']["committee_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"completed_at"?: string | null,"contribution_amount": number,"created_at"?: string,"description"?: string | null,"due_day": number,"id"?: string,"member_count": number,"name": string,"order_locked_at"?: string | null,"organizer_id"?: string | null,"payout_day": number,"payout_order_method"?: Database["public"]['Enums']["payout_order_method"],"start_month": string,"status"?: Database["public"]['Enums']["committee_status"],"updated_at"?: string
                  }
                  Update: {
                    "activated_at"?: string | null,"completed_at"?: string | null,"contribution_amount"?: number,"created_at"?: string,"description"?: string | null,"due_day"?: number,"id"?: string,"member_count"?: number,"name"?: string,"order_locked_at"?: string | null,"organizer_id"?: string | null,"payout_day"?: number,"payout_order_method"?: Database["public"]['Enums']["payout_order_method"],"start_month"?: string,"status"?: Database["public"]['Enums']["committee_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "committees_organizer_id_fkey"
      columns: ["organizer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cycles": {
                  Row: {
                    "committee_id": string,"created_at": string,"cycle_number": number,"due_date": string,"id": string,"payout_completed_at": string | null,"payout_completed_by": string | null,"payout_date": string,"payout_note": string | null,"payout_status": Database["public"]['Enums']["payout_status"],"recipient_member_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "committee_id": string,"created_at"?: string,"cycle_number": number,"due_date": string,"id"?: string,"payout_completed_at"?: string | null,"payout_completed_by"?: string | null,"payout_date": string,"payout_note"?: string | null,"payout_status"?: Database["public"]['Enums']["payout_status"],"recipient_member_id": string,"updated_at"?: string
                  }
                  Update: {
                    "committee_id"?: string,"created_at"?: string,"cycle_number"?: number,"due_date"?: string,"id"?: string,"payout_completed_at"?: string | null,"payout_completed_by"?: string | null,"payout_date"?: string,"payout_note"?: string | null,"payout_status"?: Database["public"]['Enums']["payout_status"],"recipient_member_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cycles_committee_id_fkey"
      columns: ["committee_id"]
isOneToOne: false
      referencedRelation: "committees"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cycles_payout_completed_by_fkey"
      columns: ["payout_completed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cycles_recipient_fk"
      columns: ["recipient_member_id","committee_id"]
isOneToOne: false
      referencedRelation: "committee_members"
      referencedColumns: ["id","committee_id"]
    }
                  ]
                },"notification_log": {
                  Row: {
                    "created_at": string,"cycle_id": string,"id": number,"kind": string,"sent_on": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cycle_id": string,"id"?: never,"kind": string,"sent_on": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"cycle_id"?: string,"id"?: never,"kind"?: string,"sent_on"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_log_cycle_id_fkey"
      columns: ["cycle_id"]
isOneToOne: false
      referencedRelation: "cycles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_log_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"claimed_at": string | null,"claimed_by": string | null,"committee_id": string,"confirmed_by": string | null,"created_at": string,"cycle_id": string,"id": string,"member_id": string,"method": Database["public"]['Enums']["payment_method"] | null,"note": string | null,"paid_at": string | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"claimed_at"?: string | null,"claimed_by"?: string | null,"committee_id": string,"confirmed_by"?: string | null,"created_at"?: string,"cycle_id": string,"id"?: string,"member_id": string,"method"?: Database["public"]['Enums']["payment_method"] | null,"note"?: string | null,"paid_at"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"claimed_at"?: string | null,"claimed_by"?: string | null,"committee_id"?: string,"confirmed_by"?: string | null,"created_at"?: string,"cycle_id"?: string,"id"?: string,"member_id"?: string,"method"?: Database["public"]['Enums']["payment_method"] | null,"note"?: string | null,"paid_at"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_claimed_by_fkey"
      columns: ["claimed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_committee_id_fkey"
      columns: ["committee_id"]
isOneToOne: false
      referencedRelation: "committees"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_cycle_fk"
      columns: ["cycle_id","committee_id"]
isOneToOne: false
      referencedRelation: "cycles"
      referencedColumns: ["id","committee_id"]
    },{
      foreignKeyName: "payments_member_fk"
      columns: ["member_id","committee_id"]
isOneToOne: false
      referencedRelation: "committee_members"
      referencedColumns: ["id","committee_id"]
    }
                  ]
                },"payout_draws": {
                  Row: {
                    "algorithm": string,"committee_id": string,"created_at": string,"id": string,"performed_by": string | null,"result": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "algorithm": string,"committee_id": string,"created_at"?: string,"id"?: string,"performed_by"?: string | null,"result": NonNullable<Json>
                  }
                  Update: {
                    "algorithm"?: string,"committee_id"?: string,"created_at"?: string,"id"?: string,"performed_by"?: string | null,"result"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "payout_draws_committee_id_fkey"
      columns: ["committee_id"]
isOneToOne: false
      referencedRelation: "committees"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"locale": string,"phone": string,"reminders_enabled": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"locale"?: string,"phone": string,"reminders_enabled"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"locale"?: string,"phone"?: string,"reminders_enabled"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"id": string,"platform": string,"token": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"platform": string,"token": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"platform"?: string,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "committee_status": "draft"|"active"|"completed","payment_method": "cash"|"easypaisa"|"jazzcash"|"bank_transfer","payment_status": "pending"|"awaiting_confirmation"|"paid"|"late","payout_order_method": "random"|"manual"|"member_choice","payout_status": "pending"|"completed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "committee_status": ["draft", "active", "completed"],"payment_method": ["cash", "easypaisa", "jazzcash", "bank_transfer"],"payment_status": ["pending", "awaiting_confirmation", "paid", "late"],"payout_order_method": ["random", "manual", "member_choice"],"payout_status": ["pending", "completed"]
          }
        }
} as const
