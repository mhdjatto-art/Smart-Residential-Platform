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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          compound_id: string | null
          created_at: string
          diff: Json | null
          id: number
          organization_id: string | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          compound_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: number
          organization_id?: string | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          compound_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: number
          organization_id?: string | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      buildings: {
        Row: {
          code: string | null
          compound_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json
          name: string
          number_of_floors: number | null
          organization_id: string
          status: string
          total_units: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          compound_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          number_of_floors?: number | null
          organization_id: string
          status?: string
          total_units?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          compound_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          number_of_floors?: number | null
          organization_id?: string
          status?: string
          total_units?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compounds: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          code: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          logo_path: string | null
          metadata: Json
          name: string
          organization_id: string
          postal_code: string | null
          region: string | null
          slug: string
          status: Database["public"]["Enums"]["compound_status"]
          timezone: string
          total_buildings: number
          total_units: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_path?: string | null
          metadata?: Json
          name: string
          organization_id: string
          postal_code?: string | null
          region?: string | null
          slug: string
          status?: Database["public"]["Enums"]["compound_status"]
          timezone?: string
          total_buildings?: number
          total_units?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_path?: string | null
          metadata?: Json
          name?: string
          organization_id?: string
          postal_code?: string | null
          region?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["compound_status"]
          timezone?: string
          total_buildings?: number
          total_units?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compounds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          compound_id: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          expires_at: string | null
          file_name: string
          file_size: number | null
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          metadata: Json
          mime_type: string | null
          notes: string | null
          organization_id: string
          storage_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          compound_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          expires_at?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          metadata?: Json
          mime_type?: string | null
          notes?: string | null
          organization_id: string
          storage_path: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          compound_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          metadata?: Json
          mime_type?: string | null
          notes?: string | null
          organization_id?: string
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          organization_id: string
          phone: string
          relationship: string | null
          resident_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          organization_id: string
          phone: string
          relationship?: string | null
          resident_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          organization_id?: string
          phone?: string
          relationship?: string | null
          resident_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_contacts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          full_name: string
          id: string
          national_id: string | null
          notes: string | null
          organization_id: string
          relationship: string | null
          resident_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          full_name: string
          id?: string
          national_id?: string | null
          notes?: string | null
          organization_id: string
          relationship?: string | null
          resident_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          full_name?: string
          id?: string
          national_id?: string | null
          notes?: string | null
          organization_id?: string
          relationship?: string | null
          resident_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          action_type: Database["public"]["Enums"]["financial_action"]
          actor_id: string | null
          amount: number | null
          compound_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          new_values: Json | null
          old_values: Json | null
          organization_id: string
          reason: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["financial_action"]
          actor_id?: string | null
          amount?: number | null
          compound_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          organization_id: string
          reason?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["financial_action"]
          actor_id?: string | null
          amount?: number | null
          compound_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          building_id: string
          compound_id: string
          created_at: string
          created_by: string | null
          floor_name: string | null
          floor_number: number
          id: string
          metadata: Json
          organization_id: string
          total_units: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          building_id: string
          compound_id: string
          created_at?: string
          created_by?: string | null
          floor_name?: string | null
          floor_number: number
          id?: string
          metadata?: Json
          organization_id: string
          total_units?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          building_id?: string
          compound_id?: string
          created_at?: string
          created_by?: string | null
          floor_name?: string | null
          floor_number?: number
          id?: string
          metadata?: Json
          organization_id?: string
          total_units?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "floors_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floors_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_contracts: {
        Row: {
          annual_interest_rate: number
          compound_id: string
          contract_end_date: string | null
          contract_number: string
          contract_start_date: string
          contract_status: Database["public"]["Enums"]["contract_status"]
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          created_by: string | null
          currency: string | null
          down_payment: number
          financed_amount: number | null
          grace_period_days: number
          id: string
          installment_count: number
          installment_frequency: Database["public"]["Enums"]["installment_frequency"]
          late_penalty_type: Database["public"]["Enums"]["penalty_type"] | null
          late_penalty_value: number | null
          metadata: Json
          monthly_amount: number | null
          notes: string | null
          organization_id: string
          resident_id: string
          total_property_price: number
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          annual_interest_rate?: number
          compound_id: string
          contract_end_date?: string | null
          contract_number: string
          contract_start_date: string
          contract_status?: Database["public"]["Enums"]["contract_status"]
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          currency?: string | null
          down_payment?: number
          financed_amount?: number | null
          grace_period_days?: number
          id?: string
          installment_count: number
          installment_frequency?: Database["public"]["Enums"]["installment_frequency"]
          late_penalty_type?: Database["public"]["Enums"]["penalty_type"] | null
          late_penalty_value?: number | null
          metadata?: Json
          monthly_amount?: number | null
          notes?: string | null
          organization_id: string
          resident_id: string
          total_property_price: number
          unit_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          annual_interest_rate?: number
          compound_id?: string
          contract_end_date?: string | null
          contract_number?: string
          contract_start_date?: string
          contract_status?: Database["public"]["Enums"]["contract_status"]
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          currency?: string | null
          down_payment?: number
          financed_amount?: number | null
          grace_period_days?: number
          id?: string
          installment_count?: number
          installment_frequency?: Database["public"]["Enums"]["installment_frequency"]
          late_penalty_type?: Database["public"]["Enums"]["penalty_type"] | null
          late_penalty_value?: number | null
          metadata?: Json
          monthly_amount?: number | null
          notes?: string | null
          organization_id?: string
          resident_id?: string
          total_property_price?: number
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installment_contracts_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_contracts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_schedules: {
        Row: {
          compound_id: string
          contract_id: string
          created_at: string
          due_date: string
          id: string
          installment_number: number
          interest_amount: number
          notes: string | null
          organization_id: string
          paid_amount: number
          paid_at: string | null
          penalty_amount: number
          principal_amount: number
          status: Database["public"]["Enums"]["installment_status"]
          total_due: number
          updated_at: string
        }
        Insert: {
          compound_id: string
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          interest_amount?: number
          notes?: string | null
          organization_id: string
          paid_amount?: number
          paid_at?: string | null
          penalty_amount?: number
          principal_amount: number
          status?: Database["public"]["Enums"]["installment_status"]
          total_due: number
          updated_at?: string
        }
        Update: {
          compound_id?: string
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          interest_amount?: number
          notes?: string | null
          organization_id?: string
          paid_amount?: number
          paid_at?: string | null
          penalty_amount?: number
          principal_amount?: number
          status?: Database["public"]["Enums"]["installment_status"]
          total_due?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_schedules_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_schedules_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "installment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          metadata: Json
          name: string
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          metadata?: Json
          name: string
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount: number
          applied_to: string
          created_at: string
          id: string
          installment_id: string
          organization_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          applied_to?: string
          created_at?: string
          id?: string
          installment_id: string
          organization_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          applied_to?: string
          created_at?: string
          id?: string
          installment_id?: string
          organization_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installment_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          channel: Database["public"]["Enums"]["reminder_channel"]
          compound_id: string
          contract_id: string
          created_at: string
          id: string
          installment_id: string | null
          kind: Database["public"]["Enums"]["reminder_kind"]
          organization_id: string
          payload: Json
          resident_id: string
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
        }
        Insert: {
          channel?: Database["public"]["Enums"]["reminder_channel"]
          compound_id: string
          contract_id: string
          created_at?: string
          id?: string
          installment_id?: string | null
          kind: Database["public"]["Enums"]["reminder_kind"]
          organization_id: string
          payload?: Json
          resident_id: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
        }
        Update: {
          channel?: Database["public"]["Enums"]["reminder_channel"]
          compound_id?: string
          contract_id?: string
          created_at?: string
          id?: string
          installment_id?: string | null
          kind?: Database["public"]["Enums"]["reminder_kind"]
          organization_id?: string
          payload?: Json
          resident_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "installment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installment_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          compound_id: string
          contract_id: string
          created_at: string
          created_by: string | null
          currency: string | null
          external_reference: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_amount: number
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_reference: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          resident_id: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          compound_id: string
          contract_id: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          external_reference?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_amount: number
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_reference: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          resident_id: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          compound_id?: string
          contract_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          external_reference?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_amount?: number
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          resident_id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "installment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      penalties: {
        Row: {
          amount: number
          compound_id: string
          contract_id: string
          created_at: string
          created_by: string | null
          id: string
          installment_id: string
          organization_id: string
          penalty_date: string
          penalty_type: Database["public"]["Enums"]["penalty_type"]
          penalty_value: number
          reason: string | null
          status: Database["public"]["Enums"]["penalty_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          compound_id: string
          contract_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          installment_id: string
          organization_id: string
          penalty_date: string
          penalty_type: Database["public"]["Enums"]["penalty_type"]
          penalty_value: number
          reason?: string | null
          status?: Database["public"]["Enums"]["penalty_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          compound_id?: string
          contract_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          installment_id?: string
          organization_id?: string
          penalty_date?: string
          penalty_type?: Database["public"]["Enums"]["penalty_type"]
          penalty_value?: number
          reason?: string | null
          status?: Database["public"]["Enums"]["penalty_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "penalties_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalties_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "installment_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalties_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installment_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          id: string
          issued_at: string
          issued_by: string | null
          organization_id: string
          payment_id: string
          pdf_storage_path: string | null
          receipt_number: string
        }
        Insert: {
          id?: string
          issued_at?: string
          issued_by?: string | null
          organization_id: string
          payment_id: string
          pdf_storage_path?: string | null
          receipt_number: string
        }
        Update: {
          id?: string
          issued_at?: string
          issued_by?: string | null
          organization_id?: string
          payment_id?: string
          pdf_storage_path?: string | null
          receipt_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      residents: {
        Row: {
          compound_id: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          id: string
          last_name: string
          metadata: Json
          mobile: string | null
          move_in_date: string | null
          move_out_date: string | null
          national_id: string | null
          occupation: string | null
          organization_id: string
          phone: string | null
          profile_photo_path: string | null
          status: Database["public"]["Enums"]["resident_status"]
          tenancy_type: Database["public"]["Enums"]["tenancy_type"]
          unit_id: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          compound_id: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender_type"]
          id?: string
          last_name: string
          metadata?: Json
          mobile?: string | null
          move_in_date?: string | null
          move_out_date?: string | null
          national_id?: string | null
          occupation?: string | null
          organization_id: string
          phone?: string | null
          profile_photo_path?: string | null
          status?: Database["public"]["Enums"]["resident_status"]
          tenancy_type?: Database["public"]["Enums"]["tenancy_type"]
          unit_id: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          compound_id?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"]
          id?: string
          last_name?: string
          metadata?: Json
          mobile?: string | null
          move_in_date?: string | null
          move_out_date?: string | null
          national_id?: string | null
          occupation?: string | null
          organization_id?: string
          phone?: string | null
          profile_photo_path?: string | null
          status?: Database["public"]["Enums"]["resident_status"]
          tenancy_type?: Database["public"]["Enums"]["tenancy_type"]
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_assignments: {
        Row: {
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          compound_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          metadata: Json
          monthly_rent: number | null
          notes: string | null
          organization_id: string
          resident_id: string
          start_date: string
          status: Database["public"]["Enums"]["assignment_status"]
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          compound_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json
          monthly_rent?: number | null
          notes?: string | null
          organization_id: string
          resident_id: string
          start_date: string
          status?: Database["public"]["Enums"]["assignment_status"]
          unit_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignment_type?: Database["public"]["Enums"]["assignment_type"]
          compound_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json
          monthly_rent?: number | null
          notes?: string | null
          organization_id?: string
          resident_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_assignments_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_assignments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          building_id: string
          compound_id: string
          created_at: string
          created_by: string | null
          description: string | null
          floor: number | null
          floor_id: string | null
          id: string
          maintenance_fee: number | null
          metadata: Json
          organization_id: string
          ownership_status: Database["public"]["Enums"]["ownership_status"]
          parking_slots: number
          purchase_price: number | null
          rent_price: number | null
          status: Database["public"]["Enums"]["unit_status"]
          unit_number: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id: string
          compound_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          floor?: number | null
          floor_id?: string | null
          id?: string
          maintenance_fee?: number | null
          metadata?: Json
          organization_id: string
          ownership_status?: Database["public"]["Enums"]["ownership_status"]
          parking_slots?: number
          purchase_price?: number | null
          rent_price?: number | null
          status?: Database["public"]["Enums"]["unit_status"]
          unit_number: string
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string
          compound_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          floor?: number | null
          floor_id?: string | null
          id?: string
          maintenance_fee?: number | null
          metadata?: Json
          organization_id?: string
          ownership_status?: Database["public"]["Enums"]["ownership_status"]
          parking_slots?: number
          purchase_price?: number | null
          rent_price?: number | null
          status?: Database["public"]["Enums"]["unit_status"]
          unit_number?: string
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          compound_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          compound_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          compound_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          compound_id: string
          created_at: string
          created_by: string | null
          id: string
          make: string | null
          model: string | null
          notes: string | null
          organization_id: string
          parking_slot: string | null
          plate_number: string
          resident_id: string
          updated_at: string
          updated_by: string | null
          year: number | null
        }
        Insert: {
          color?: string | null
          compound_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          make?: string | null
          model?: string | null
          notes?: string | null
          organization_id: string
          parking_slot?: string | null
          plate_number: string
          resident_id: string
          updated_at?: string
          updated_by?: string | null
          year?: number | null
        }
        Update: {
          color?: string | null
          compound_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          make?: string | null
          model?: string | null
          notes?: string | null
          organization_id?: string
          parking_slot?: string | null
          plate_number?: string
          resident_id?: string
          updated_at?: string
          updated_by?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_contract: { Args: { p_contract_id: string }; Returns: undefined }
      apply_penalties_all: { Args: never; Returns: number }
      apply_penalties_for_contract: {
        Args: { p_contract_id: string }
        Returns: number
      }
      bootstrap_organization: {
        Args: { p_admin_email: string; p_name: string; p_slug: string }
        Returns: string
      }
      bootstrap_super_admin: { Args: { p_email: string }; Returns: string }
      contract_currency: { Args: { p_contract_id: string }; Returns: string }
      generate_installment_schedule: {
        Args: { p_contract_id: string }
        Returns: number
      }
      is_super_admin: { Args: { p_user?: string }; Returns: boolean }
      recompute_building_counts: {
        Args: { p_building_id: string }
        Returns: undefined
      }
      recompute_compound_counts: {
        Args: { p_compound_id: string }
        Returns: undefined
      }
      recompute_floor_counts: {
        Args: { p_floor_id: string }
        Returns: undefined
      }
      record_payment: {
        Args: {
          p_amount: number
          p_contract_id: string
          p_external_ref?: string
          p_notes?: string
          p_payment_date?: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: string
      }
      reverse_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      storage_org_from_path: { Args: { p_path: string }; Returns: string }
      user_compound_ids: { Args: { p_user?: string }; Returns: string[] }
      user_has_management_role: {
        Args: { p_compound?: string; p_org: string; p_user?: string }
        Returns: boolean
      }
      user_organization_ids: { Args: { p_user?: string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "developer_admin"
        | "compound_manager"
        | "finance_officer"
        | "maintenance_staff"
        | "security_staff"
        | "resident"
      assignment_status: "active" | "ended" | "cancelled"
      assignment_type: "owner" | "tenant"
      compound_status: "active" | "inactive" | "archived"
      contract_status:
        | "draft"
        | "active"
        | "completed"
        | "cancelled"
        | "defaulted"
      contract_type: "property_sale" | "rental" | "lease_to_own"
      document_kind:
        | "national_id"
        | "passport"
        | "ownership_deed"
        | "lease_agreement"
        | "sales_contract"
        | "profile_photo"
        | "compound_logo"
        | "building_photo"
        | "unit_photo"
        | "utility_bill"
        | "other"
      financial_action:
        | "contract_created"
        | "contract_updated"
        | "contract_cancelled"
        | "schedule_generated"
        | "schedule_regenerated"
        | "payment_recorded"
        | "payment_reversed"
        | "payment_refunded"
        | "penalty_applied"
        | "penalty_waived"
        | "adjustment"
        | "reminder_sent"
      gender_type: "male" | "female" | "unspecified"
      installment_frequency: "monthly" | "quarterly" | "biannual" | "annual"
      installment_status:
        | "pending"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      organization_status: "active" | "suspended" | "archived"
      ownership_status:
        | "owned"
        | "for_sale"
        | "for_rent"
        | "leased"
        | "reserved"
      payment_method:
        | "cash"
        | "bank_transfer"
        | "online_payment"
        | "wallet"
        | "cheque"
      payment_status: "pending" | "confirmed" | "reversed" | "refunded"
      penalty_status: "pending" | "applied" | "waived" | "paid"
      penalty_type: "fixed" | "percentage" | "daily" | "monthly"
      reminder_channel: "in_app" | "email" | "sms"
      reminder_kind: "upcoming" | "overdue" | "penalty" | "payment_received"
      reminder_status: "pending" | "sent" | "failed" | "dismissed"
      resident_status: "active" | "pending" | "former"
      tenancy_type: "owner" | "tenant" | "family_member" | "guest"
      unit_status: "vacant" | "occupied" | "reserved" | "maintenance"
      unit_type:
        | "apartment"
        | "villa"
        | "townhouse"
        | "studio"
        | "duplex"
        | "penthouse"
        | "other"
        | "office"
        | "commercial"
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
      app_role: [
        "super_admin",
        "developer_admin",
        "compound_manager",
        "finance_officer",
        "maintenance_staff",
        "security_staff",
        "resident",
      ],
      assignment_status: ["active", "ended", "cancelled"],
      assignment_type: ["owner", "tenant"],
      compound_status: ["active", "inactive", "archived"],
      contract_status: [
        "draft",
        "active",
        "completed",
        "cancelled",
        "defaulted",
      ],
      contract_type: ["property_sale", "rental", "lease_to_own"],
      document_kind: [
        "national_id",
        "passport",
        "ownership_deed",
        "lease_agreement",
        "sales_contract",
        "profile_photo",
        "compound_logo",
        "building_photo",
        "unit_photo",
        "utility_bill",
        "other",
      ],
      financial_action: [
        "contract_created",
        "contract_updated",
        "contract_cancelled",
        "schedule_generated",
        "schedule_regenerated",
        "payment_recorded",
        "payment_reversed",
        "payment_refunded",
        "penalty_applied",
        "penalty_waived",
        "adjustment",
        "reminder_sent",
      ],
      gender_type: ["male", "female", "unspecified"],
      installment_frequency: ["monthly", "quarterly", "biannual", "annual"],
      installment_status: [
        "pending",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      organization_status: ["active", "suspended", "archived"],
      ownership_status: ["owned", "for_sale", "for_rent", "leased", "reserved"],
      payment_method: [
        "cash",
        "bank_transfer",
        "online_payment",
        "wallet",
        "cheque",
      ],
      payment_status: ["pending", "confirmed", "reversed", "refunded"],
      penalty_status: ["pending", "applied", "waived", "paid"],
      penalty_type: ["fixed", "percentage", "daily", "monthly"],
      reminder_channel: ["in_app", "email", "sms"],
      reminder_kind: ["upcoming", "overdue", "penalty", "payment_received"],
      reminder_status: ["pending", "sent", "failed", "dismissed"],
      resident_status: ["active", "pending", "former"],
      tenancy_type: ["owner", "tenant", "family_member", "guest"],
      unit_status: ["vacant", "occupied", "reserved", "maintenance"],
      unit_type: [
        "apartment",
        "villa",
        "townhouse",
        "studio",
        "duplex",
        "penthouse",
        "other",
        "office",
        "commercial",
      ],
    },
  },
} as const
