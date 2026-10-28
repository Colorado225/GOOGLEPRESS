// Généré par scripts/generate-supabase-types.mjs.
// Source : application locale PGlite des migrations supabase/migrations/*.sql.
// Ne pas modifier manuellement ; régénérer après toute nouvelle migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      "attendance_records": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "employee_id": string;
          "business_date": string;
          "status": string;
          "arrival_time": string | null;
          "reason": string | null;
          "notes": string | null;
          "recorded_by": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "employee_id": string;
          "business_date": string;
          "status": string;
          "arrival_time"?: string | null;
          "reason"?: string | null;
          "notes"?: string | null;
          "recorded_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "employee_id"?: string;
          "business_date"?: string;
          "status"?: string;
          "arrival_time"?: string | null;
          "reason"?: string | null;
          "notes"?: string | null;
          "recorded_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_organization_id_shop_id_employee_id_fkey";
            columns: ["organization_id","shop_id","employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["organization_id","shop_id","id"];
          },
          {
            foreignKeyName: "attendance_records_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "audit_log": {
        Row: {
          "id": string;
          "organization_id": string | null;
          "shop_id": string | null;
          "actor_user_id": string | null;
          "actor_type": string;
          "action": string;
          "resource_type": string | null;
          "resource_id": string | null;
          "metadata": Json;
          "created_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id"?: string | null;
          "shop_id"?: string | null;
          "actor_user_id"?: string | null;
          "actor_type": string;
          "action": string;
          "resource_type"?: string | null;
          "resource_id"?: string | null;
          "metadata"?: Json;
          "created_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string | null;
          "shop_id"?: string | null;
          "actor_user_id"?: string | null;
          "actor_type"?: string;
          "action"?: string;
          "resource_type"?: string | null;
          "resource_id"?: string | null;
          "metadata"?: Json;
          "created_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "audit_log_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "cash_register_days": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "business_date": string;
          "cash_amount_xof": number;
          "wave_amount_xof": number;
          "mobile_money_amount_xof": number;
          "total_amount_xof": number | null;
          "float_amount_xof": number;
          "monthly_target_xof": number;
          "month_achieved_xof": number;
          "status": string;
          "closed_at": string | null;
          "closed_by": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "business_date": string;
          "cash_amount_xof"?: number;
          "wave_amount_xof"?: number;
          "mobile_money_amount_xof"?: number;
          "total_amount_xof"?: number | null;
          "float_amount_xof"?: number;
          "monthly_target_xof"?: number;
          "month_achieved_xof"?: number;
          "status"?: string;
          "closed_at"?: string | null;
          "closed_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "business_date"?: string;
          "cash_amount_xof"?: number;
          "wave_amount_xof"?: number;
          "mobile_money_amount_xof"?: number;
          "total_amount_xof"?: number | null;
          "float_amount_xof"?: number;
          "monthly_target_xof"?: number;
          "month_achieved_xof"?: number;
          "status"?: string;
          "closed_at"?: string | null;
          "closed_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cash_register_days_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "cash_register_days_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "communication_preferences": {
        Row: {
          "id": string;
          "organization_id": string;
          "customer_id": string;
          "user_id": string | null;
          "transactional_in_app": boolean;
          "transactional_push": boolean;
          "transactional_whatsapp": boolean;
          "transactional_whatsapp_consented_at": string | null;
          "transactional_sms": boolean;
          "transactional_sms_consented_at": string | null;
          "transactional_email": boolean;
          "marketing_opt_in": boolean;
          "marketing_consented_at": string | null;
          "consent_source": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "customer_id": string;
          "user_id"?: string | null;
          "transactional_in_app"?: boolean;
          "transactional_push"?: boolean;
          "transactional_whatsapp"?: boolean;
          "transactional_whatsapp_consented_at"?: string | null;
          "transactional_sms"?: boolean;
          "transactional_sms_consented_at"?: string | null;
          "transactional_email"?: boolean;
          "marketing_opt_in"?: boolean;
          "marketing_consented_at"?: string | null;
          "consent_source"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "customer_id"?: string;
          "user_id"?: string | null;
          "transactional_in_app"?: boolean;
          "transactional_push"?: boolean;
          "transactional_whatsapp"?: boolean;
          "transactional_whatsapp_consented_at"?: string | null;
          "transactional_sms"?: boolean;
          "transactional_sms_consented_at"?: string | null;
          "transactional_email"?: boolean;
          "marketing_opt_in"?: boolean;
          "marketing_consented_at"?: string | null;
          "consent_source"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "communication_preferences_organization_id_customer_id_fkey";
            columns: ["organization_id","customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "communication_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "conversation_internal_notes": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "customer_id": string;
          "conversation_id": string;
          "author_user_id": string;
          "body": string;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "customer_id": string;
          "conversation_id": string;
          "author_user_id": string;
          "body": string;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "customer_id"?: string;
          "conversation_id"?: string;
          "author_user_id"?: string;
          "body"?: string;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_internal_notes_author_user_id_fkey";
            columns: ["author_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "conversation_internal_notes_organization_id_shop_id_custom_fkey";
            columns: ["organization_id","shop_id","customer_id","conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["organization_id","shop_id","customer_id","id"];
          }
        ];
      };
      "conversation_reads": {
        Row: {
          "conversation_id": string;
          "user_id": string;
          "last_read_message_id": string | null;
          "last_read_at": string | null;
          "updated_at": string;
        };
        Insert: {
          "conversation_id": string;
          "user_id": string;
          "last_read_message_id"?: string | null;
          "last_read_at"?: string | null;
          "updated_at"?: string;
        };
        Update: {
          "conversation_id"?: string;
          "user_id"?: string;
          "last_read_message_id"?: string | null;
          "last_read_at"?: string | null;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_reads_conversation_id_last_read_message_id_fkey";
            columns: ["conversation_id","last_read_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["conversation_id","id"];
          },
          {
            foreignKeyName: "conversation_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "conversations": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "customer_id": string;
          "order_id": string | null;
          "logistics_task_id": string | null;
          "conversation_type": string;
          "status": string;
          "assigned_to": string | null;
          "last_message_id": string | null;
          "last_message_at": string | null;
          "last_message_preview": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "customer_id": string;
          "order_id"?: string | null;
          "logistics_task_id"?: string | null;
          "conversation_type"?: string;
          "status"?: string;
          "assigned_to"?: string | null;
          "last_message_id"?: string | null;
          "last_message_at"?: string | null;
          "last_message_preview"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "customer_id"?: string;
          "order_id"?: string | null;
          "logistics_task_id"?: string | null;
          "conversation_type"?: string;
          "status"?: string;
          "assigned_to"?: string | null;
          "last_message_id"?: string | null;
          "last_message_at"?: string | null;
          "last_message_preview"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "conversations_last_message_fk";
            columns: ["organization_id","shop_id","customer_id","id","last_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["organization_id","shop_id","customer_id","conversation_id","id"];
          },
          {
            foreignKeyName: "conversations_organization_id_customer_id_fkey";
            columns: ["organization_id","customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "conversations_organization_id_shop_id_customer_id_logistic_fkey";
            columns: ["organization_id","shop_id","customer_id","logistics_task_id"];
            isOneToOne: false;
            referencedRelation: "logistics_tasks";
            referencedColumns: ["organization_id","shop_id","customer_id","id"];
          },
          {
            foreignKeyName: "conversations_organization_id_shop_id_customer_id_order_id_fkey";
            columns: ["organization_id","shop_id","customer_id","order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["organization_id","shop_id","customer_id","id"];
          },
          {
            foreignKeyName: "conversations_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "customer_account_links": {
        Row: {
          "id": string;
          "organization_id": string;
          "customer_id": string;
          "user_id": string;
          "verified_phone_e164": string;
          "status": string;
          "verified_at": string;
          "revoked_at": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "customer_id": string;
          "user_id": string;
          "verified_phone_e164": string;
          "status"?: string;
          "verified_at"?: string;
          "revoked_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "customer_id"?: string;
          "user_id"?: string;
          "verified_phone_e164"?: string;
          "status"?: string;
          "verified_at"?: string;
          "revoked_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_account_links_organization_id_customer_id_fkey";
            columns: ["organization_id","customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "customer_account_links_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "customers": {
        Row: {
          "id": string;
          "organization_id": string;
          "legacy_id": string | null;
          "full_name": string;
          "phone_display": string;
          "phone_e164": string | null;
          "address": string | null;
          "deposits_count": number;
          "balance_xof": number;
          "loyalty_discount_percent": number;
          "is_vip": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "legacy_id"?: string | null;
          "full_name": string;
          "phone_display": string;
          "phone_e164"?: string | null;
          "address"?: string | null;
          "deposits_count"?: number;
          "balance_xof"?: number;
          "loyalty_discount_percent"?: number;
          "is_vip"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "legacy_id"?: string | null;
          "full_name"?: string;
          "phone_display"?: string;
          "phone_e164"?: string | null;
          "address"?: string | null;
          "deposits_count"?: number;
          "balance_xof"?: number;
          "loyalty_discount_percent"?: number;
          "is_vip"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      "employees": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "legacy_id": string | null;
          "full_name": string;
          "phone_display": string | null;
          "position": string;
          "status": string;
          "hired_on": string | null;
          "notes": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "legacy_id"?: string | null;
          "full_name": string;
          "phone_display"?: string | null;
          "position": string;
          "status"?: string;
          "hired_on"?: string | null;
          "notes"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "legacy_id"?: string | null;
          "full_name"?: string;
          "phone_display"?: string | null;
          "position"?: string;
          "status"?: string;
          "hired_on"?: string | null;
          "notes"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "expense_categories": {
        Row: {
          "id": string;
          "organization_id": string;
          "legacy_id": string | null;
          "label": string;
          "is_active": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "legacy_id"?: string | null;
          "label": string;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "legacy_id"?: string | null;
          "label"?: string;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      "expenses": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "category_id": string;
          "legacy_id": string | null;
          "label": string;
          "amount_xof": number;
          "business_date": string;
          "payment_method": string;
          "supplier": string | null;
          "reference": string | null;
          "description": string | null;
          "status": string;
          "cancellation_reason": string | null;
          "created_by": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "category_id": string;
          "legacy_id"?: string | null;
          "label": string;
          "amount_xof": number;
          "business_date": string;
          "payment_method": string;
          "supplier"?: string | null;
          "reference"?: string | null;
          "description"?: string | null;
          "status"?: string;
          "cancellation_reason"?: string | null;
          "created_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "category_id"?: string;
          "legacy_id"?: string | null;
          "label"?: string;
          "amount_xof"?: number;
          "business_date"?: string;
          "payment_method"?: string;
          "supplier"?: string | null;
          "reference"?: string | null;
          "description"?: string | null;
          "status"?: string;
          "cancellation_reason"?: string | null;
          "created_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "expenses_organization_id_category_id_fkey";
            columns: ["organization_id","category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "expenses_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "invitations": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string | null;
          "email": string | null;
          "phone_e164": string | null;
          "role": string;
          "token_hash": string;
          "invited_by": string | null;
          "expires_at": string;
          "accepted_at": string | null;
          "revoked_at": string | null;
          "created_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id"?: string | null;
          "email"?: string | null;
          "phone_e164"?: string | null;
          "role": string;
          "token_hash": string;
          "invited_by"?: string | null;
          "expires_at": string;
          "accepted_at"?: string | null;
          "revoked_at"?: string | null;
          "created_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string | null;
          "email"?: string | null;
          "phone_e164"?: string | null;
          "role"?: string;
          "token_hash"?: string;
          "invited_by"?: string | null;
          "expires_at"?: string;
          "accepted_at"?: string | null;
          "revoked_at"?: string | null;
          "created_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "logistics_tasks": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "legacy_id": string | null;
          "kind": string;
          "status": string;
          "customer_id": string;
          "customer_name_snapshot": string;
          "customer_phone_snapshot": string;
          "address": string;
          "address_details": string | null;
          "scheduled_date": string;
          "time_slot": string;
          "assigned_employee_id": string | null;
          "assigned_employee_name_snapshot": string | null;
          "order_id": string | null;
          "order_ticket_label_snapshot": string | null;
          "fee_xof": number;
          "estimated_bags": number | null;
          "collected_bags": number | null;
          "instructions": string | null;
          "issue_reason": string | null;
          "issue_notes": string | null;
          "started_at": string | null;
          "completed_at": string | null;
          "collected_amount_xof": number | null;
          "collected_payment_method": string | null;
          "created_by": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "legacy_id"?: string | null;
          "kind": string;
          "status"?: string;
          "customer_id": string;
          "customer_name_snapshot": string;
          "customer_phone_snapshot": string;
          "address": string;
          "address_details"?: string | null;
          "scheduled_date": string;
          "time_slot": string;
          "assigned_employee_id"?: string | null;
          "assigned_employee_name_snapshot"?: string | null;
          "order_id"?: string | null;
          "order_ticket_label_snapshot"?: string | null;
          "fee_xof"?: number;
          "estimated_bags"?: number | null;
          "collected_bags"?: number | null;
          "instructions"?: string | null;
          "issue_reason"?: string | null;
          "issue_notes"?: string | null;
          "started_at"?: string | null;
          "completed_at"?: string | null;
          "collected_amount_xof"?: number | null;
          "collected_payment_method"?: string | null;
          "created_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "legacy_id"?: string | null;
          "kind"?: string;
          "status"?: string;
          "customer_id"?: string;
          "customer_name_snapshot"?: string;
          "customer_phone_snapshot"?: string;
          "address"?: string;
          "address_details"?: string | null;
          "scheduled_date"?: string;
          "time_slot"?: string;
          "assigned_employee_id"?: string | null;
          "assigned_employee_name_snapshot"?: string | null;
          "order_id"?: string | null;
          "order_ticket_label_snapshot"?: string | null;
          "fee_xof"?: number;
          "estimated_bags"?: number | null;
          "collected_bags"?: number | null;
          "instructions"?: string | null;
          "issue_reason"?: string | null;
          "issue_notes"?: string | null;
          "started_at"?: string | null;
          "completed_at"?: string | null;
          "collected_amount_xof"?: number | null;
          "collected_payment_method"?: string | null;
          "created_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "logistics_tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "logistics_tasks_organization_id_customer_id_fkey";
            columns: ["organization_id","customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "logistics_tasks_organization_id_shop_id_assigned_employee__fkey";
            columns: ["organization_id","shop_id","assigned_employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["organization_id","shop_id","id"];
          },
          {
            foreignKeyName: "logistics_tasks_organization_id_shop_id_customer_id_order__fkey";
            columns: ["organization_id","shop_id","customer_id","order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["organization_id","shop_id","customer_id","id"];
          },
          {
            foreignKeyName: "logistics_tasks_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "memberships": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string | null;
          "user_id": string;
          "employee_id": string | null;
          "role": string;
          "status": string;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id"?: string | null;
          "user_id": string;
          "employee_id"?: string | null;
          "role": string;
          "status"?: string;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string | null;
          "user_id"?: string;
          "employee_id"?: string | null;
          "role"?: string;
          "status"?: string;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_organization_id_shop_id_employee_id_fkey";
            columns: ["organization_id","shop_id","employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["organization_id","shop_id","id"];
          },
          {
            foreignKeyName: "memberships_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "message_templates": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "event_key": string;
          "channel": string;
          "locale": string;
          "subject": string | null;
          "body": string;
          "allowed_variables": Json;
          "status": string;
          "provider_status": string | null;
          "version": number;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "event_key": string;
          "channel": string;
          "locale"?: string;
          "subject"?: string | null;
          "body": string;
          "allowed_variables"?: Json;
          "status"?: string;
          "provider_status"?: string | null;
          "version"?: number;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "event_key"?: string;
          "channel"?: string;
          "locale"?: string;
          "subject"?: string | null;
          "body"?: string;
          "allowed_variables"?: Json;
          "status"?: string;
          "provider_status"?: string | null;
          "version"?: number;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_templates_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "messages": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "customer_id": string;
          "conversation_id": string;
          "sender_type": string;
          "sender_user_id": string | null;
          "message_kind": string;
          "body": string;
          "event_key": string | null;
          "metadata": Json;
          "client_idempotency_key": string | null;
          "created_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "customer_id": string;
          "conversation_id": string;
          "sender_type": string;
          "sender_user_id"?: string | null;
          "message_kind"?: string;
          "body": string;
          "event_key"?: string | null;
          "metadata"?: Json;
          "client_idempotency_key"?: string | null;
          "created_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "customer_id"?: string;
          "conversation_id"?: string;
          "sender_type"?: string;
          "sender_user_id"?: string | null;
          "message_kind"?: string;
          "body"?: string;
          "event_key"?: string | null;
          "metadata"?: Json;
          "client_idempotency_key"?: string | null;
          "created_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_shop_id_customer_id_conversation__fkey";
            columns: ["organization_id","shop_id","customer_id","conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["organization_id","shop_id","customer_id","id"];
          },
          {
            foreignKeyName: "messages_sender_user_id_fkey";
            columns: ["sender_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "messaging_channels": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "channel": string;
          "provider": string;
          "sender_identifier": string;
          "credential_secret_ref": string | null;
          "status": string;
          "daily_limit": number | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "channel": string;
          "provider": string;
          "sender_identifier": string;
          "credential_secret_ref"?: string | null;
          "status"?: string;
          "daily_limit"?: number | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "channel"?: string;
          "provider"?: string;
          "sender_identifier"?: string;
          "credential_secret_ref"?: string | null;
          "status"?: string;
          "daily_limit"?: number | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messaging_channels_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "notification_deliveries": {
        Row: {
          "id": string;
          "outbox_id": string;
          "channel": string;
          "provider": string | null;
          "provider_message_id": string | null;
          "status": string;
          "attempt_number": number;
          "error_code": string | null;
          "error_message": string | null;
          "sent_at": string | null;
          "delivered_at": string | null;
          "read_at": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "outbox_id": string;
          "channel": string;
          "provider"?: string | null;
          "provider_message_id"?: string | null;
          "status"?: string;
          "attempt_number"?: number;
          "error_code"?: string | null;
          "error_message"?: string | null;
          "sent_at"?: string | null;
          "delivered_at"?: string | null;
          "read_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "outbox_id"?: string;
          "channel"?: string;
          "provider"?: string | null;
          "provider_message_id"?: string | null;
          "status"?: string;
          "attempt_number"?: number;
          "error_code"?: string | null;
          "error_message"?: string | null;
          "sent_at"?: string | null;
          "delivered_at"?: string | null;
          "read_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_outbox_id_fkey";
            columns: ["outbox_id"];
            isOneToOne: false;
            referencedRelation: "notification_outbox";
            referencedColumns: ["id"];
          }
        ];
      };
      "notification_outbox": {
        Row: {
          "id": string;
          "organization_id": string | null;
          "shop_id": string | null;
          "customer_id": string | null;
          "recipient_user_id": string | null;
          "event_key": string;
          "aggregate_type": string | null;
          "aggregate_id": string | null;
          "conversation_id": string | null;
          "payload": Json;
          "requested_channels": Json;
          "status": string;
          "scheduled_for": string;
          "attempts": number;
          "last_error": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id"?: string | null;
          "shop_id"?: string | null;
          "customer_id"?: string | null;
          "recipient_user_id"?: string | null;
          "event_key": string;
          "aggregate_type"?: string | null;
          "aggregate_id"?: string | null;
          "conversation_id"?: string | null;
          "payload"?: Json;
          "requested_channels"?: Json;
          "status"?: string;
          "scheduled_for"?: string;
          "attempts"?: number;
          "last_error"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string | null;
          "shop_id"?: string | null;
          "customer_id"?: string | null;
          "recipient_user_id"?: string | null;
          "event_key"?: string;
          "aggregate_type"?: string | null;
          "aggregate_id"?: string | null;
          "conversation_id"?: string | null;
          "payload"?: Json;
          "requested_channels"?: Json;
          "status"?: string;
          "scheduled_for"?: string;
          "attempts"?: number;
          "last_error"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_outbox_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_outbox_organization_id_customer_id_fkey";
            columns: ["organization_id","customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "notification_outbox_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_outbox_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "notification_outbox_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "order_events": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "order_id": string;
          "event_type": string;
          "from_status": string | null;
          "to_status": string | null;
          "visibility": string;
          "actor_type": string;
          "actor_user_id": string | null;
          "payload": Json;
          "created_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "order_id": string;
          "event_type": string;
          "from_status"?: string | null;
          "to_status"?: string | null;
          "visibility"?: string;
          "actor_type"?: string;
          "actor_user_id"?: string | null;
          "payload"?: Json;
          "created_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "order_id"?: string;
          "event_type"?: string;
          "from_status"?: string | null;
          "to_status"?: string | null;
          "visibility"?: string;
          "actor_type"?: string;
          "actor_user_id"?: string | null;
          "payload"?: Json;
          "created_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_events_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "order_events_organization_id_shop_id_order_id_fkey";
            columns: ["organization_id","shop_id","order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["organization_id","shop_id","id"];
          }
        ];
      };
      "orders": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "customer_id": string;
          "legacy_id": string | null;
          "ticket_number": number;
          "ticket_label": string | null;
          "service_category": string;
          "customer_name_snapshot": string;
          "customer_phone_snapshot": string;
          "customer_address_snapshot": string | null;
          "lines": Json;
          "subtotal_xof": number;
          "service_fees_xof": number;
          "collection_fee_xof": number;
          "delivery_fee_xof": number;
          "discount_xof": number;
          "total_xof": number;
          "deposit_paid_xof": number;
          "remaining_balance_xof": number | null;
          "payment_method": string;
          "status": string;
          "received_at": string;
          "promised_at": string;
          "ready_at": string | null;
          "delivered_at": string | null;
          "notes": string | null;
          "is_late": boolean;
          "is_urgent": boolean;
          "rack_location_snapshot": string | null;
          "storage_location_id": string | null;
          "storage_location_code_snapshot": string | null;
          "storage_location_label_snapshot": string | null;
          "storage_package_count": number | null;
          "storage_notes": string | null;
          "stored_at": string | null;
          "machine_assigned": string | null;
          "assignee_name_snapshot": string | null;
          "progress_percent": number | null;
          "legacy_sms_sent": boolean;
          "origin": string;
          "fulfillment_method": string;
          "collection_address_snapshot": string | null;
          "collection_address_details_snapshot": string | null;
          "collection_date": string | null;
          "collection_time_slot": string | null;
          "delivery_address_snapshot": string | null;
          "delivery_address_details_snapshot": string | null;
          "delivery_date": string | null;
          "delivery_time_slot": string | null;
          "created_by": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "customer_id": string;
          "legacy_id"?: string | null;
          "ticket_number": number;
          "ticket_label"?: string | null;
          "service_category"?: string;
          "customer_name_snapshot": string;
          "customer_phone_snapshot": string;
          "customer_address_snapshot"?: string | null;
          "lines": Json;
          "subtotal_xof": number;
          "service_fees_xof"?: number;
          "collection_fee_xof"?: number;
          "delivery_fee_xof"?: number;
          "discount_xof"?: number;
          "total_xof": number;
          "deposit_paid_xof"?: number;
          "remaining_balance_xof"?: number | null;
          "payment_method": string;
          "status"?: string;
          "received_at"?: string;
          "promised_at": string;
          "ready_at"?: string | null;
          "delivered_at"?: string | null;
          "notes"?: string | null;
          "is_late"?: boolean;
          "is_urgent"?: boolean;
          "rack_location_snapshot"?: string | null;
          "storage_location_id"?: string | null;
          "storage_location_code_snapshot"?: string | null;
          "storage_location_label_snapshot"?: string | null;
          "storage_package_count"?: number | null;
          "storage_notes"?: string | null;
          "stored_at"?: string | null;
          "machine_assigned"?: string | null;
          "assignee_name_snapshot"?: string | null;
          "progress_percent"?: number | null;
          "legacy_sms_sent"?: boolean;
          "origin"?: string;
          "fulfillment_method"?: string;
          "collection_address_snapshot"?: string | null;
          "collection_address_details_snapshot"?: string | null;
          "collection_date"?: string | null;
          "collection_time_slot"?: string | null;
          "delivery_address_snapshot"?: string | null;
          "delivery_address_details_snapshot"?: string | null;
          "delivery_date"?: string | null;
          "delivery_time_slot"?: string | null;
          "created_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "customer_id"?: string;
          "legacy_id"?: string | null;
          "ticket_number"?: number;
          "ticket_label"?: string | null;
          "service_category"?: string;
          "customer_name_snapshot"?: string;
          "customer_phone_snapshot"?: string;
          "customer_address_snapshot"?: string | null;
          "lines"?: Json;
          "subtotal_xof"?: number;
          "service_fees_xof"?: number;
          "collection_fee_xof"?: number;
          "delivery_fee_xof"?: number;
          "discount_xof"?: number;
          "total_xof"?: number;
          "deposit_paid_xof"?: number;
          "remaining_balance_xof"?: number | null;
          "payment_method"?: string;
          "status"?: string;
          "received_at"?: string;
          "promised_at"?: string;
          "ready_at"?: string | null;
          "delivered_at"?: string | null;
          "notes"?: string | null;
          "is_late"?: boolean;
          "is_urgent"?: boolean;
          "rack_location_snapshot"?: string | null;
          "storage_location_id"?: string | null;
          "storage_location_code_snapshot"?: string | null;
          "storage_location_label_snapshot"?: string | null;
          "storage_package_count"?: number | null;
          "storage_notes"?: string | null;
          "stored_at"?: string | null;
          "machine_assigned"?: string | null;
          "assignee_name_snapshot"?: string | null;
          "progress_percent"?: number | null;
          "legacy_sms_sent"?: boolean;
          "origin"?: string;
          "fulfillment_method"?: string;
          "collection_address_snapshot"?: string | null;
          "collection_address_details_snapshot"?: string | null;
          "collection_date"?: string | null;
          "collection_time_slot"?: string | null;
          "delivery_address_snapshot"?: string | null;
          "delivery_address_details_snapshot"?: string | null;
          "delivery_date"?: string | null;
          "delivery_time_slot"?: string | null;
          "created_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "orders_organization_id_customer_id_fkey";
            columns: ["organization_id","customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "orders_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "orders_shop_id_storage_location_id_fkey";
            columns: ["shop_id","storage_location_id"];
            isOneToOne: false;
            referencedRelation: "storage_locations";
            referencedColumns: ["shop_id","id"];
          }
        ];
      };
      "organizations": {
        Row: {
          "id": string;
          "name": string;
          "slug": string;
          "status": string;
          "country_code": string;
          "default_currency": string;
          "created_by": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "name": string;
          "slug": string;
          "status"?: string;
          "country_code"?: string;
          "default_currency"?: string;
          "created_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "name"?: string;
          "slug"?: string;
          "status"?: string;
          "country_code"?: string;
          "default_currency"?: string;
          "created_by"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "pickup_requests": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "customer_id": string | null;
          "requester_user_id": string | null;
          "contact_name": string;
          "contact_phone_display": string;
          "contact_phone_e164": string | null;
          "address": string;
          "address_details": string | null;
          "requested_date": string;
          "requested_time_slot": string;
          "estimated_bags": number | null;
          "instructions": string | null;
          "status": string;
          "staff_notes": string | null;
          "converted_task_id": string | null;
          "source": string;
          "idempotency_key": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "customer_id"?: string | null;
          "requester_user_id"?: string | null;
          "contact_name": string;
          "contact_phone_display": string;
          "contact_phone_e164"?: string | null;
          "address": string;
          "address_details"?: string | null;
          "requested_date": string;
          "requested_time_slot": string;
          "estimated_bags"?: number | null;
          "instructions"?: string | null;
          "status"?: string;
          "staff_notes"?: string | null;
          "converted_task_id"?: string | null;
          "source"?: string;
          "idempotency_key"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "customer_id"?: string | null;
          "requester_user_id"?: string | null;
          "contact_name"?: string;
          "contact_phone_display"?: string;
          "contact_phone_e164"?: string | null;
          "address"?: string;
          "address_details"?: string | null;
          "requested_date"?: string;
          "requested_time_slot"?: string;
          "estimated_bags"?: number | null;
          "instructions"?: string | null;
          "status"?: string;
          "staff_notes"?: string | null;
          "converted_task_id"?: string | null;
          "source"?: string;
          "idempotency_key"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pickup_requests_organization_id_customer_id_fkey";
            columns: ["organization_id","customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "pickup_requests_organization_id_shop_id_customer_id_conver_fkey";
            columns: ["organization_id","shop_id","customer_id","converted_task_id"];
            isOneToOne: false;
            referencedRelation: "logistics_tasks";
            referencedColumns: ["organization_id","shop_id","customer_id","id"];
          },
          {
            foreignKeyName: "pickup_requests_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          },
          {
            foreignKeyName: "pickup_requests_requester_user_id_fkey";
            columns: ["requester_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "platform_admins": {
        Row: {
          "user_id": string;
          "is_active": boolean;
          "note": string | null;
          "created_at": string;
          "created_by": string | null;
        };
        Insert: {
          "user_id": string;
          "is_active"?: boolean;
          "note"?: string | null;
          "created_at"?: string;
          "created_by"?: string | null;
        };
        Update: {
          "user_id"?: string;
          "is_active"?: boolean;
          "note"?: string | null;
          "created_at"?: string;
          "created_by"?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_admins_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "platform_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "products": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "legacy_id": string | null;
          "name": string;
          "reference": string;
          "category": string;
          "unit": string;
          "current_quantity": number;
          "alert_threshold": number;
          "unit_cost_xof": number | null;
          "supplier": string | null;
          "description": string | null;
          "is_active": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "legacy_id"?: string | null;
          "name": string;
          "reference": string;
          "category": string;
          "unit": string;
          "current_quantity"?: number;
          "alert_threshold"?: number;
          "unit_cost_xof"?: number | null;
          "supplier"?: string | null;
          "description"?: string | null;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "legacy_id"?: string | null;
          "name"?: string;
          "reference"?: string;
          "category"?: string;
          "unit"?: string;
          "current_quantity"?: number;
          "alert_threshold"?: number;
          "unit_cost_xof"?: number | null;
          "supplier"?: string | null;
          "description"?: string | null;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "profiles": {
        Row: {
          "user_id": string;
          "display_name": string | null;
          "phone_e164": string | null;
          "locale": string;
          "time_zone": string;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "user_id": string;
          "display_name"?: string | null;
          "phone_e164"?: string | null;
          "locale"?: string;
          "time_zone"?: string;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "user_id"?: string;
          "display_name"?: string | null;
          "phone_e164"?: string | null;
          "locale"?: string;
          "time_zone"?: string;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [];
      };
      "provider_webhook_events": {
        Row: {
          "id": string;
          "organization_id": string | null;
          "shop_id": string | null;
          "provider": string;
          "external_event_id": string;
          "event_type": string | null;
          "signature_valid": boolean | null;
          "payload": Json;
          "processed_at": string | null;
          "processing_error": string | null;
          "received_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id"?: string | null;
          "shop_id"?: string | null;
          "provider": string;
          "external_event_id": string;
          "event_type"?: string | null;
          "signature_valid"?: boolean | null;
          "payload": Json;
          "processed_at"?: string | null;
          "processing_error"?: string | null;
          "received_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string | null;
          "shop_id"?: string | null;
          "provider"?: string;
          "external_event_id"?: string;
          "event_type"?: string | null;
          "signature_valid"?: boolean | null;
          "payload"?: Json;
          "processed_at"?: string | null;
          "processing_error"?: string | null;
          "received_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_webhook_events_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "push_subscriptions": {
        Row: {
          "id": string;
          "user_id": string;
          "endpoint": string;
          "subscription_keys": Json;
          "user_agent": string | null;
          "device_label": string | null;
          "is_revoked": boolean;
          "last_seen_at": string | null;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "user_id": string;
          "endpoint": string;
          "subscription_keys": Json;
          "user_agent"?: string | null;
          "device_label"?: string | null;
          "is_revoked"?: boolean;
          "last_seen_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "user_id"?: string;
          "endpoint"?: string;
          "subscription_keys"?: Json;
          "user_agent"?: string | null;
          "device_label"?: string | null;
          "is_revoked"?: boolean;
          "last_seen_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          }
        ];
      };
      "quick_replies": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "title": string;
          "body": string;
          "is_active": boolean;
          "sort_order": number;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "title": string;
          "body": string;
          "is_active"?: boolean;
          "sort_order"?: number;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "title"?: string;
          "body"?: string;
          "is_active"?: boolean;
          "sort_order"?: number;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quick_replies_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "service_catalog_items": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "legacy_key": string | null;
          "name": string;
          "audience_category": string;
          "service_category": string;
          "pricing_type": string;
          "unit_price_xof": number;
          "unit_label": string | null;
          "icon_emoji": string | null;
          "image_url": string | null;
          "description": string | null;
          "is_active": boolean;
          "sort_order": number;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "legacy_key"?: string | null;
          "name": string;
          "audience_category"?: string;
          "service_category": string;
          "pricing_type": string;
          "unit_price_xof": number;
          "unit_label"?: string | null;
          "icon_emoji"?: string | null;
          "image_url"?: string | null;
          "description"?: string | null;
          "is_active"?: boolean;
          "sort_order"?: number;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "legacy_key"?: string | null;
          "name"?: string;
          "audience_category"?: string;
          "service_category"?: string;
          "pricing_type"?: string;
          "unit_price_xof"?: number;
          "unit_label"?: string | null;
          "icon_emoji"?: string | null;
          "image_url"?: string | null;
          "description"?: string | null;
          "is_active"?: boolean;
          "sort_order"?: number;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_catalog_items_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "shop_settings": {
        Row: {
          "shop_id": string;
          "organization_id": string;
          "tagline": string;
          "currency": string;
          "enable_sms": boolean;
          "enable_thermal_printer": boolean;
          "pickup_fee_xof": number;
          "delivery_fee_xof": number;
          "storage_assignment_required": boolean;
          "storage_allow_capacity_overflow": boolean;
          "storage_suggestions_enabled": boolean;
          "storage_default_capacity_packages": number;
          "messaging_business_hours": Json;
          "messaging_out_of_hours_message": string | null;
          "show_storage_code_to_customers": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "shop_id": string;
          "organization_id": string;
          "tagline"?: string;
          "currency"?: string;
          "enable_sms"?: boolean;
          "enable_thermal_printer"?: boolean;
          "pickup_fee_xof"?: number;
          "delivery_fee_xof"?: number;
          "storage_assignment_required"?: boolean;
          "storage_allow_capacity_overflow"?: boolean;
          "storage_suggestions_enabled"?: boolean;
          "storage_default_capacity_packages"?: number;
          "messaging_business_hours"?: Json;
          "messaging_out_of_hours_message"?: string | null;
          "show_storage_code_to_customers"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "shop_id"?: string;
          "organization_id"?: string;
          "tagline"?: string;
          "currency"?: string;
          "enable_sms"?: boolean;
          "enable_thermal_printer"?: boolean;
          "pickup_fee_xof"?: number;
          "delivery_fee_xof"?: number;
          "storage_assignment_required"?: boolean;
          "storage_allow_capacity_overflow"?: boolean;
          "storage_suggestions_enabled"?: boolean;
          "storage_default_capacity_packages"?: number;
          "messaging_business_hours"?: Json;
          "messaging_out_of_hours_message"?: string | null;
          "show_storage_code_to_customers"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_settings_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "shops": {
        Row: {
          "id": string;
          "organization_id": string;
          "name": string;
          "slug": string;
          "public_slug": string | null;
          "status": string;
          "address": string | null;
          "city": string | null;
          "country_code": string;
          "phone_display": string | null;
          "email": string | null;
          "opening_hours": Json;
          "time_zone": string;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "name": string;
          "slug": string;
          "public_slug"?: string | null;
          "status"?: string;
          "address"?: string | null;
          "city"?: string | null;
          "country_code"?: string;
          "phone_display"?: string | null;
          "email"?: string | null;
          "opening_hours"?: Json;
          "time_zone"?: string;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "name"?: string;
          "slug"?: string;
          "public_slug"?: string | null;
          "status"?: string;
          "address"?: string | null;
          "city"?: string | null;
          "country_code"?: string;
          "phone_display"?: string | null;
          "email"?: string | null;
          "opening_hours"?: Json;
          "time_zone"?: string;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shops_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      "stock_movements": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "product_id": string;
          "legacy_id": string | null;
          "movement_type": string;
          "quantity_input": number;
          "quantity_delta": number | null;
          "quantity_before": number | null;
          "quantity_after": number | null;
          "business_date": string;
          "reason": string;
          "unit_cost_xof": number | null;
          "note": string | null;
          "created_by": string | null;
          "created_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "product_id": string;
          "legacy_id"?: string | null;
          "movement_type": string;
          "quantity_input": number;
          "quantity_delta"?: number | null;
          "quantity_before"?: number | null;
          "quantity_after"?: number | null;
          "business_date": string;
          "reason": string;
          "unit_cost_xof"?: number | null;
          "note"?: string | null;
          "created_by"?: string | null;
          "created_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "product_id"?: string;
          "legacy_id"?: string | null;
          "movement_type"?: string;
          "quantity_input"?: number;
          "quantity_delta"?: number | null;
          "quantity_before"?: number | null;
          "quantity_after"?: number | null;
          "business_date"?: string;
          "reason"?: string;
          "unit_cost_xof"?: number | null;
          "note"?: string | null;
          "created_by"?: string | null;
          "created_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "stock_movements_organization_id_shop_id_product_id_fkey";
            columns: ["organization_id","shop_id","product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["organization_id","shop_id","id"];
          }
        ];
      };
      "storage_locations": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string;
          "legacy_id": string | null;
          "code": string;
          "label": string;
          "zone": string;
          "capacity_packages": number;
          "description": string | null;
          "is_active": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id": string;
          "legacy_id"?: string | null;
          "code": string;
          "label": string;
          "zone": string;
          "capacity_packages": number;
          "description"?: string | null;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string;
          "legacy_id"?: string | null;
          "code"?: string;
          "label"?: string;
          "zone"?: string;
          "capacity_packages"?: number;
          "description"?: string | null;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "storage_locations_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "ticket_counters": {
        Row: {
          "shop_id": string;
          "organization_id": string;
          "prefix": string;
          "next_number": number;
          "updated_at": string;
        };
        Insert: {
          "shop_id": string;
          "organization_id": string;
          "prefix"?: string;
          "next_number"?: number;
          "updated_at"?: string;
        };
        Update: {
          "shop_id"?: string;
          "organization_id"?: string;
          "prefix"?: string;
          "next_number"?: number;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_counters_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
      "usage_counters": {
        Row: {
          "id": string;
          "organization_id": string;
          "shop_id": string | null;
          "metric": string;
          "period_start": string;
          "quantity": number;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "organization_id": string;
          "shop_id"?: string | null;
          "metric": string;
          "period_start": string;
          "quantity"?: number;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "organization_id"?: string;
          "shop_id"?: string | null;
          "metric"?: string;
          "period_start"?: string;
          "quantity"?: number;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_counters_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_counters_organization_id_shop_id_fkey";
            columns: ["organization_id","shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["organization_id","id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
