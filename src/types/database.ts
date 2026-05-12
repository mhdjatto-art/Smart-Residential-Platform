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
      announcements: {
        Row: {
          attachments: Json
          body: string
          compound_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_pinned: boolean
          kind: Database["public"]["Enums"]["announcement_kind"]
          organization_id: string
          published_at: string
          target_audience: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attachments?: Json
          body: string
          compound_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          kind?: Database["public"]["Enums"]["announcement_kind"]
          organization_id: string
          published_at?: string
          target_audience?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attachments?: Json
          body?: string
          compound_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          kind?: Database["public"]["Enums"]["announcement_kind"]
          organization_id?: string
          published_at?: string
          target_audience?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      commissions: {
        Row: {
          amount: number
          commission_kind: Database["public"]["Enums"]["commission_kind"]
          commission_value: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          order_id: string
          organization_id: string
          payee: Database["public"]["Enums"]["commission_payee"]
          provider_id: string
        }
        Insert: {
          amount: number
          commission_kind: Database["public"]["Enums"]["commission_kind"]
          commission_value: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          order_id: string
          organization_id: string
          payee?: Database["public"]["Enums"]["commission_payee"]
          provider_id: string
        }
        Update: {
          amount?: number
          commission_kind?: Database["public"]["Enums"]["commission_kind"]
          commission_value?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          order_id?: string
          organization_id?: string
          payee?: Database["public"]["Enums"]["commission_payee"]
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
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
      electricity_meters: {
        Row: {
          adapter_config: Json
          adapter_kind: string | null
          brand: string | null
          compound_id: string
          created_at: string
          created_by: string | null
          current_reading: number
          id: string
          installed_at: string | null
          meter_number: string
          model: string | null
          notes: string | null
          organization_id: string
          serial_number: string | null
          smart_enabled: boolean
          status: Database["public"]["Enums"]["meter_status"]
          unit_id: string | null
          unit_of_measure: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adapter_config?: Json
          adapter_kind?: string | null
          brand?: string | null
          compound_id: string
          created_at?: string
          created_by?: string | null
          current_reading?: number
          id?: string
          installed_at?: string | null
          meter_number: string
          model?: string | null
          notes?: string | null
          organization_id: string
          serial_number?: string | null
          smart_enabled?: boolean
          status?: Database["public"]["Enums"]["meter_status"]
          unit_id?: string | null
          unit_of_measure?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adapter_config?: Json
          adapter_kind?: string | null
          brand?: string | null
          compound_id?: string
          created_at?: string
          created_by?: string | null
          current_reading?: number
          id?: string
          installed_at?: string | null
          meter_number?: string
          model?: string | null
          notes?: string | null
          organization_id?: string
          serial_number?: string | null
          smart_enabled?: boolean
          status?: Database["public"]["Enums"]["meter_status"]
          unit_id?: string | null
          unit_of_measure?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "electricity_meters_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_meters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_meters_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      electricity_tariffs: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          effective_from: string
          effective_to: string | null
          id: string
          metadata: Json
          organization_id: string
          provider_id: string
          rate_per_unit: number
          service_fee: number
          tariff_name: string
          tier_brackets: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          provider_id: string
          rate_per_unit: number
          service_fee?: number
          tariff_name: string
          tier_brackets?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          provider_id?: string
          rate_per_unit?: number
          service_fee?: number
          tariff_name?: string
          tier_brackets?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "electricity_tariffs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_tariffs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "utility_providers"
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
      facilities: {
        Row: {
          booking_fee: number
          capacity: number | null
          compound_id: string
          created_at: string
          created_by: string | null
          description: string | null
          facility_type: Database["public"]["Enums"]["facility_type"]
          fee_currency: string | null
          id: string
          is_active: boolean
          max_duration_minutes: number
          metadata: Json
          min_duration_minutes: number
          name: string
          organization_id: string
          requires_approval: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_fee?: number
          capacity?: number | null
          compound_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          facility_type: Database["public"]["Enums"]["facility_type"]
          fee_currency?: string | null
          id?: string
          is_active?: boolean
          max_duration_minutes?: number
          metadata?: Json
          min_duration_minutes?: number
          name: string
          organization_id: string
          requires_approval?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_fee?: number
          capacity?: number | null
          compound_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          facility_type?: Database["public"]["Enums"]["facility_type"]
          fee_currency?: string | null
          id?: string
          is_active?: boolean
          max_duration_minutes?: number
          metadata?: Json
          min_duration_minutes?: number
          name?: string
          organization_id?: string
          requires_approval?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facilities_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_bookings: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          compound_id: string
          created_at: string
          created_by: string | null
          end_time: string
          facility_id: string
          fee_amount: number
          fee_paid: boolean
          id: string
          notes: string | null
          organization_id: string
          rejected_reason: string | null
          resident_id: string
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          compound_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          facility_id: string
          fee_amount?: number
          fee_paid?: boolean
          id?: string
          notes?: string | null
          organization_id: string
          rejected_reason?: string | null
          resident_id: string
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          compound_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          facility_id?: string
          fee_amount?: number
          fee_paid?: boolean
          id?: string
          notes?: string | null
          organization_id?: string
          rejected_reason?: string | null
          resident_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_bookings_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_bookings_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_bookings_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_bookings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
      gas_orders: {
        Row: {
          bill_id: string | null
          compound_id: string
          created_at: string
          created_by: string | null
          currency: string
          cylinder_count: number
          delivered_at: string | null
          delivered_by: string | null
          delivery_address: string | null
          delivery_notes: string | null
          id: string
          notes: string | null
          order_number: string
          organization_id: string
          provider_id: string
          requested_at: string
          resident_id: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["gas_order_status"]
          total_amount: number | null
          unit_id: string | null
          unit_price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bill_id?: string | null
          compound_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          cylinder_count?: number
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          id?: string
          notes?: string | null
          order_number: string
          organization_id: string
          provider_id: string
          requested_at?: string
          resident_id?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["gas_order_status"]
          total_amount?: number | null
          unit_id?: string | null
          unit_price: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bill_id?: string | null
          compound_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          cylinder_count?: number
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_address?: string | null
          delivery_notes?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          organization_id?: string
          provider_id?: string
          requested_at?: string
          resident_id?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["gas_order_status"]
          total_amount?: number | null
          unit_id?: string | null
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gas_orders_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "utility_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_orders_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_orders_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "utility_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_orders_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
      internet_packages: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          data_cap_gb: number | null
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          monthly_price: number
          organization_id: string
          package_name: string
          package_tier: string
          provider_id: string
          speed_mbps_down: number
          speed_mbps_up: number | null
          suspension_policy: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          data_cap_gb?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          monthly_price: number
          organization_id: string
          package_name: string
          package_tier?: string
          provider_id: string
          speed_mbps_down: number
          speed_mbps_up?: number | null
          suspension_policy?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          data_cap_gb?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          monthly_price?: number
          organization_id?: string
          package_name?: string
          package_tier?: string
          provider_id?: string
          speed_mbps_down?: number
          speed_mbps_up?: number | null
          suspension_policy?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internet_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internet_packages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "utility_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_jobs: {
        Row: {
          assigned_technician_id: string | null
          building_id: string | null
          completed_at: string | null
          completion_notes: string | null
          completion_proof_path: string | null
          compound_id: string
          cost: number | null
          cost_currency: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_recurring: boolean
          job_number: string
          job_type: Database["public"]["Enums"]["maintenance_type"]
          organization_id: string
          recurrence_interval_days: number | null
          scheduled_for: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          ticket_id: string | null
          title: string
          unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_technician_id?: string | null
          building_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_proof_path?: string | null
          compound_id: string
          cost?: number | null
          cost_currency?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean
          job_number: string
          job_type: Database["public"]["Enums"]["maintenance_type"]
          organization_id: string
          recurrence_interval_days?: number | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          ticket_id?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_technician_id?: string | null
          building_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_proof_path?: string | null
          compound_id?: string
          cost?: number | null
          cost_currency?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean
          job_number?: string
          job_type?: Database["public"]["Enums"]["maintenance_type"]
          organization_id?: string
          recurrence_interval_days?: number | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          ticket_id?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_jobs_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_jobs_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_jobs_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_jobs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_jobs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          line_total: number | null
          notes: string | null
          order_id: string
          organization_id: string
          quantity: number
          service_item_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          line_total?: number | null
          notes?: string | null
          order_id: string
          organization_id: string
          quantity?: number
          service_item_id?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          line_total?: number | null
          notes?: string | null
          order_id?: string
          organization_id?: string
          quantity?: number
          service_item_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_service_item_id_fkey"
            columns: ["service_item_id"]
            isOneToOne: false
            referencedRelation: "service_items"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          commission_amount: number
          completed_at: string | null
          compound_id: string
          created_at: string
          created_by: string | null
          currency: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_notes: string | null
          id: string
          metadata: Json
          notes: string | null
          order_number: string
          order_status: Database["public"]["Enums"]["order_status"]
          organization_id: string
          paid_amount: number
          payment_id: string | null
          payment_status: Database["public"]["Enums"]["order_payment_status"]
          provider_id: string
          provider_net: number
          resident_id: string
          scheduled_for: string | null
          service_fee: number
          subtotal: number
          tax_amount: number
          total_amount: number
          unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          commission_amount?: number
          completed_at?: string | null
          compound_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_notes?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          order_number: string
          order_status?: Database["public"]["Enums"]["order_status"]
          organization_id: string
          paid_amount?: number
          payment_id?: string | null
          payment_status?: Database["public"]["Enums"]["order_payment_status"]
          provider_id: string
          provider_net?: number
          resident_id: string
          scheduled_for?: string | null
          service_fee?: number
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          commission_amount?: number
          completed_at?: string | null
          compound_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_notes?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          order_number?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          organization_id?: string
          paid_amount?: number
          payment_id?: string | null
          payment_status?: Database["public"]["Enums"]["order_payment_status"]
          provider_id?: string
          provider_net?: number
          resident_id?: string
          scheduled_for?: string | null
          service_fee?: number
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          consumption: number | null
          created_at: string
          created_by: string | null
          id: string
          is_validated: boolean
          meter_id: string
          notes: string | null
          organization_id: string
          photo_path: string | null
          previous_reading: number
          reading_date: string
          reading_value: number
          source: Database["public"]["Enums"]["reading_source"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          consumption?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_validated?: boolean
          meter_id: string
          notes?: string | null
          organization_id: string
          photo_path?: string | null
          previous_reading?: number
          reading_date?: string
          reading_value: number
          source?: Database["public"]["Enums"]["reading_source"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          consumption?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_validated?: boolean
          meter_id?: string
          notes?: string | null
          organization_id?: string
          photo_path?: string | null
          previous_reading?: number
          reading_date?: string
          reading_value?: number
          source?: Database["public"]["Enums"]["reading_source"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "electricity_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          href: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          organization_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          organization_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          organization_id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
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
      provider_payouts: {
        Row: {
          commission_amount: number
          created_at: string
          currency: string
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          organization_id: string
          paid_at: string | null
          paid_by: string | null
          period_end: string
          period_start: string
          provider_id: string
          status: Database["public"]["Enums"]["payout_status"]
          total_orders: number
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          currency?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          paid_by?: string | null
          period_end: string
          period_start: string
          provider_id: string
          status?: Database["public"]["Enums"]["payout_status"]
          total_orders?: number
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          currency?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          paid_by?: string | null
          period_end?: string
          period_start?: string
          provider_id?: string
          status?: Database["public"]["Enums"]["payout_status"]
          total_orders?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_reviews: {
        Row: {
          body: string | null
          created_at: string
          helpful_count: number
          id: string
          is_hidden: boolean
          is_moderated: boolean
          order_id: string | null
          organization_id: string
          provider_id: string
          rating: number
          resident_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_hidden?: boolean
          is_moderated?: boolean
          order_id?: string | null
          organization_id: string
          provider_id: string
          rating: number
          resident_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_hidden?: boolean
          is_moderated?: boolean
          order_id?: string | null
          organization_id?: string
          provider_id?: string
          rating?: number
          resident_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_reviews_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
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
          unit_id: string | null
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
          unit_id?: string | null
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
          unit_id?: string | null
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
      security_logs: {
        Row: {
          action: string
          compound_id: string
          created_at: string
          id: string
          notes: string | null
          officer_id: string | null
          organization_id: string
          visitor_id: string | null
        }
        Insert: {
          action: string
          compound_id: string
          created_at?: string
          id?: string
          notes?: string | null
          officer_id?: string | null
          organization_id: string
          visitor_id?: string | null
        }
        Update: {
          action?: string
          compound_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          officer_id?: string | null
          organization_id?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_logs_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_logs_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      service_items: {
        Row: {
          availability_rules: Json
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          duration_minutes: number | null
          id: string
          image_path: string | null
          is_active: boolean
          metadata: Json
          name: string
          organization_id: string
          price: number
          provider_id: string
          service_kind: Database["public"]["Enums"]["service_kind"]
          slug: string
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          availability_rules?: Json
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          metadata?: Json
          name: string
          organization_id: string
          price: number
          provider_id: string
          service_kind?: Database["public"]["Enums"]["service_kind"]
          slug: string
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          availability_rules?: Json
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          metadata?: Json
          name?: string
          organization_id?: string
          price?: number
          provider_id?: string
          service_kind?: Database["public"]["Enums"]["service_kind"]
          slug?: string
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          address: string | null
          availability_status: Database["public"]["Enums"]["provider_availability"]
          compound_id: string | null
          created_at: string
          created_by: string | null
          default_commission_kind: Database["public"]["Enums"]["commission_kind"]
          default_commission_value: number
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_path: string | null
          metadata: Json
          mobile: string | null
          operating_hours: Json
          organization_id: string
          provider_kind: Database["public"]["Enums"]["provider_kind"]
          provider_name: string
          rating_avg: number
          rating_count: number
          slug: string
          updated_at: string
          updated_by: string | null
          verification_status: Database["public"]["Enums"]["provider_verification"]
          website: string | null
        }
        Insert: {
          address?: string | null
          availability_status?: Database["public"]["Enums"]["provider_availability"]
          compound_id?: string | null
          created_at?: string
          created_by?: string | null
          default_commission_kind?: Database["public"]["Enums"]["commission_kind"]
          default_commission_value?: number
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          metadata?: Json
          mobile?: string | null
          operating_hours?: Json
          organization_id: string
          provider_kind: Database["public"]["Enums"]["provider_kind"]
          provider_name: string
          rating_avg?: number
          rating_count?: number
          slug: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["provider_verification"]
          website?: string | null
        }
        Update: {
          address?: string | null
          availability_status?: Database["public"]["Enums"]["provider_availability"]
          compound_id?: string | null
          created_at?: string
          created_by?: string | null
          default_commission_kind?: Database["public"]["Enums"]["commission_kind"]
          default_commission_value?: number
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          metadata?: Json
          mobile?: string | null
          operating_hours?: Json
          organization_id?: string
          provider_kind?: Database["public"]["Enums"]["provider_kind"]
          provider_name?: string
          rating_avg?: number
          rating_count?: number
          slug?: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["provider_verification"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_suspensions: {
        Row: {
          compound_id: string
          created_at: string
          id: string
          initiated_by: string | null
          organization_id: string
          reason: Database["public"]["Enums"]["suspension_reason"]
          reason_notes: string | null
          released_at: string | null
          resident_id: string | null
          status: Database["public"]["Enums"]["suspension_status"]
          subscription_id: string
          suspended_at: string
          unit_id: string | null
          updated_at: string
          utility_type: Database["public"]["Enums"]["utility_type"]
        }
        Insert: {
          compound_id: string
          created_at?: string
          id?: string
          initiated_by?: string | null
          organization_id: string
          reason: Database["public"]["Enums"]["suspension_reason"]
          reason_notes?: string | null
          released_at?: string | null
          resident_id?: string | null
          status?: Database["public"]["Enums"]["suspension_status"]
          subscription_id: string
          suspended_at?: string
          unit_id?: string | null
          updated_at?: string
          utility_type: Database["public"]["Enums"]["utility_type"]
        }
        Update: {
          compound_id?: string
          created_at?: string
          id?: string
          initiated_by?: string | null
          organization_id?: string
          reason?: Database["public"]["Enums"]["suspension_reason"]
          reason_notes?: string | null
          released_at?: string | null
          resident_id?: string | null
          status?: Database["public"]["Enums"]["suspension_status"]
          subscription_id?: string
          suspended_at?: string
          unit_id?: string | null
          updated_at?: string
          utility_type?: Database["public"]["Enums"]["utility_type"]
        }
        Relationships: [
          {
            foreignKeyName: "service_suspensions_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_suspensions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_suspensions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_suspensions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "utility_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_suspensions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          availability_status: Database["public"]["Enums"]["technician_availability"]
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          mobile: string | null
          notes: string | null
          organization_id: string
          specialization: string[]
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          availability_status?: Database["public"]["Enums"]["technician_availability"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          mobile?: string | null
          notes?: string | null
          organization_id: string
          specialization?: string[]
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          availability_status?: Database["public"]["Enums"]["technician_availability"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          mobile?: string | null
          notes?: string | null
          organization_id?: string
          specialization?: string[]
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technicians_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          organization_id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          closed_at: string | null
          compound_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          metadata: Json
          opened_at: string
          organization_id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resident_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          satisfaction_rating: number | null
          sla_due_date: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number: string
          unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          compound_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          metadata?: Json
          opened_at?: string
          organization_id: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resident_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          satisfaction_rating?: number | null
          sla_due_date?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          compound_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          metadata?: Json
          opened_at?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resident_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          satisfaction_rating?: number | null
          sla_due_date?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          ticket_number?: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_unit_id_fkey"
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
      utility_bills: {
        Row: {
          bill_number: string
          billing_period_end: string
          billing_period_start: string
          compound_id: string
          consumption: number | null
          created_at: string
          created_by: string | null
          currency: string
          current_reading: number | null
          due_date: string
          id: string
          metadata: Json
          meter_id: string | null
          notes: string | null
          organization_id: string
          paid_amount: number
          paid_at: string | null
          payment_id: string | null
          penalty_amount: number
          previous_reading: number | null
          provider_id: string | null
          rate_per_unit: number | null
          resident_id: string | null
          status: Database["public"]["Enums"]["utility_bill_status"]
          subscription_id: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          unit_id: string | null
          updated_at: string
          updated_by: string | null
          utility_type: Database["public"]["Enums"]["utility_type"]
        }
        Insert: {
          bill_number: string
          billing_period_end: string
          billing_period_start: string
          compound_id: string
          consumption?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_reading?: number | null
          due_date: string
          id?: string
          metadata?: Json
          meter_id?: string | null
          notes?: string | null
          organization_id: string
          paid_amount?: number
          paid_at?: string | null
          payment_id?: string | null
          penalty_amount?: number
          previous_reading?: number | null
          provider_id?: string | null
          rate_per_unit?: number | null
          resident_id?: string | null
          status?: Database["public"]["Enums"]["utility_bill_status"]
          subscription_id?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
          utility_type: Database["public"]["Enums"]["utility_type"]
        }
        Update: {
          bill_number?: string
          billing_period_end?: string
          billing_period_start?: string
          compound_id?: string
          consumption?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_reading?: number | null
          due_date?: string
          id?: string
          metadata?: Json
          meter_id?: string | null
          notes?: string | null
          organization_id?: string
          paid_amount?: number
          paid_at?: string | null
          payment_id?: string | null
          penalty_amount?: number
          previous_reading?: number | null
          provider_id?: string | null
          rate_per_unit?: number | null
          resident_id?: string | null
          status?: Database["public"]["Enums"]["utility_bill_status"]
          subscription_id?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
          utility_type?: Database["public"]["Enums"]["utility_type"]
        }
        Relationships: [
          {
            foreignKeyName: "utility_bills_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_bills_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "electricity_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_bills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_bills_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_bills_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "utility_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_bills_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_bills_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "utility_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_bills_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_providers: {
        Row: {
          adapter_config: Json
          adapter_kind: string | null
          billing_method: Database["public"]["Enums"]["billing_method"]
          compound_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          organization_id: string
          provider_code: string | null
          provider_name: string
          provider_status: Database["public"]["Enums"]["provider_status"]
          provider_type: Database["public"]["Enums"]["utility_type"]
          tariff_type: Database["public"]["Enums"]["tariff_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adapter_config?: Json
          adapter_kind?: string | null
          billing_method?: Database["public"]["Enums"]["billing_method"]
          compound_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          provider_code?: string | null
          provider_name: string
          provider_status?: Database["public"]["Enums"]["provider_status"]
          provider_type: Database["public"]["Enums"]["utility_type"]
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adapter_config?: Json
          adapter_kind?: string | null
          billing_method?: Database["public"]["Enums"]["billing_method"]
          compound_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          provider_code?: string | null
          provider_name?: string
          provider_status?: Database["public"]["Enums"]["provider_status"]
          provider_type?: Database["public"]["Enums"]["utility_type"]
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utility_providers_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_subscriptions: {
        Row: {
          auto_suspend: boolean
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          compound_id: string
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          id: string
          internet_package_id: string | null
          last_billed_at: string | null
          metadata: Json
          monthly_fee: number
          next_billing_date: string | null
          notes: string | null
          organization_id: string
          provider_id: string
          resident_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_type: Database["public"]["Enums"]["utility_type"]
          unit_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_suspend?: boolean
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          compound_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          id?: string
          internet_package_id?: string | null
          last_billed_at?: string | null
          metadata?: Json
          monthly_fee?: number
          next_billing_date?: string | null
          notes?: string | null
          organization_id: string
          provider_id: string
          resident_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_type: Database["public"]["Enums"]["utility_type"]
          unit_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_suspend?: boolean
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          compound_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          id?: string
          internet_package_id?: string | null
          last_billed_at?: string | null
          metadata?: Json
          monthly_fee?: number
          next_billing_date?: string | null
          notes?: string | null
          organization_id?: string
          provider_id?: string
          resident_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_type?: Database["public"]["Enums"]["utility_type"]
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utility_subscriptions_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_subscriptions_internet_package_id_fkey"
            columns: ["internet_package_id"]
            isOneToOne: false
            referencedRelation: "internet_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_subscriptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "utility_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_subscriptions_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_subscriptions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
      visitors: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          compound_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          full_name: string
          id: string
          id_number: string | null
          mobile: string | null
          notes: string | null
          organization_id: string
          pass_code: string
          resident_id: string
          scheduled_date: string
          scheduled_time: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          unit_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_plate: string | null
          visit_purpose: string | null
          visitor_type: Database["public"]["Enums"]["visitor_type"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          compound_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          mobile?: string | null
          notes?: string | null
          organization_id: string
          pass_code: string
          resident_id: string
          scheduled_date: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_plate?: string | null
          visit_purpose?: string | null
          visitor_type?: Database["public"]["Enums"]["visitor_type"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          compound_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          mobile?: string | null
          notes?: string | null
          organization_id?: string
          pass_code?: string
          resident_id?: string
          scheduled_date?: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_plate?: string | null
          visit_purpose?: string | null
          visitor_type?: Database["public"]["Enums"]["visitor_type"]
        }
        Relationships: [
          {
            foreignKeyName: "visitors_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
      auto_suspend_overdue_utilities: {
        Args: { p_grace_days?: number }
        Returns: number
      }
      bootstrap_organization: {
        Args: { p_admin_email: string; p_name: string; p_slug: string }
        Returns: string
      }
      bootstrap_super_admin: { Args: { p_email: string }; Returns: string }
      cancel_marketplace_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: undefined
      }
      compute_provider_payout: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_provider_id: string
        }
        Returns: string
      }
      contract_currency: { Args: { p_contract_id: string }; Returns: string }
      dismiss_reminder: { Args: { p_reminder_id: string }; Returns: undefined }
      generate_electricity_bill_for_reading: {
        Args: { p_reading_id: string }
        Returns: string
      }
      generate_installment_schedule: {
        Args: { p_contract_id: string }
        Returns: number
      }
      generate_payment_reminders: {
        Args: { p_upcoming_days?: number }
        Returns: number
      }
      generate_recurring_utility_bills: {
        Args: { p_billing_date?: string }
        Returns: number
      }
      is_super_admin: { Args: { p_user?: string }; Returns: boolean }
      mark_order_completed: { Args: { p_order_id: string }; Returns: undefined }
      place_order: {
        Args: {
          p_compound_id?: string
          p_currency?: string
          p_delivery_address?: string
          p_delivery_fee?: number
          p_delivery_notes?: string
          p_items: Json
          p_notes?: string
          p_provider_id: string
          p_resident_id: string
          p_scheduled_for?: string
          p_service_fee?: number
          p_tax_amount?: number
          p_unit_id?: string
        }
        Returns: string
      }
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
      release_suspension: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      reverse_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      storage_org_from_path: { Args: { p_path: string }; Returns: string }
      suspend_subscription: {
        Args: {
          p_notes?: string
          p_reason: Database["public"]["Enums"]["suspension_reason"]
          p_subscription_id: string
        }
        Returns: string
      }
      user_compound_ids: { Args: { p_user?: string }; Returns: string[] }
      user_has_management_role: {
        Args: { p_compound?: string; p_org: string; p_user?: string }
        Returns: boolean
      }
      user_organization_ids: { Args: { p_user?: string }; Returns: string[] }
    }
    Enums: {
      announcement_kind:
        | "general"
        | "urgent"
        | "maintenance"
        | "billing"
        | "security"
        | "event"
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
      billing_cycle:
        | "monthly"
        | "quarterly"
        | "biannual"
        | "annual"
        | "one_time"
      billing_method:
        | "flat"
        | "metered"
        | "tiered"
        | "time_of_use"
        | "package"
        | "pay_per_use"
      booking_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "completed"
      commission_kind: "percentage" | "fixed"
      commission_payee: "platform" | "compound" | "organization"
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
      facility_type:
        | "gym"
        | "pool"
        | "meeting_room"
        | "event_hall"
        | "football_field"
        | "basketball_court"
        | "tennis_court"
        | "bbq_area"
        | "playground"
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
      gas_order_status:
        | "pending"
        | "scheduled"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      gender_type: "male" | "female" | "unspecified"
      installment_frequency: "monthly" | "quarterly" | "biannual" | "annual"
      installment_status:
        | "pending"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      maintenance_status:
        | "scheduled"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "cancelled"
      maintenance_type: "preventive" | "corrective" | "emergency"
      meter_status: "active" | "inactive" | "faulty" | "replaced"
      notification_kind:
        | "ticket_update"
        | "maintenance_assigned"
        | "booking_status"
        | "visitor_status"
        | "announcement"
        | "payment_received"
        | "payment_due"
        | "penalty"
        | "generic"
      order_payment_status: "unpaid" | "partial" | "paid" | "refunded"
      order_status:
        | "pending"
        | "confirmed"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "refunded"
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
      payout_status: "pending" | "processing" | "paid" | "cancelled"
      penalty_status: "pending" | "applied" | "waived" | "paid"
      penalty_type: "fixed" | "percentage" | "daily" | "monthly"
      provider_availability: "open" | "busy" | "closed"
      provider_kind:
        | "maintenance"
        | "cleaning"
        | "plumbing"
        | "electrician"
        | "ac_technician"
        | "grocery"
        | "pharmacy"
        | "restaurant"
        | "laundry"
        | "moving"
        | "car_wash"
        | "delivery"
        | "security"
        | "internet_services"
        | "other"
      provider_status: "active" | "inactive" | "suspended"
      provider_verification: "unverified" | "pending" | "verified" | "rejected"
      reading_source: "manual" | "photo" | "smart_meter" | "imported"
      reminder_channel: "in_app" | "email" | "sms"
      reminder_kind: "upcoming" | "overdue" | "penalty" | "payment_received"
      reminder_status: "pending" | "sent" | "failed" | "dismissed"
      resident_status: "active" | "pending" | "former"
      service_kind: "product" | "on_demand_service" | "subscription" | "package"
      subscription_status:
        | "pending"
        | "active"
        | "suspended"
        | "cancelled"
        | "expired"
      suspension_reason:
        | "overdue"
        | "manual"
        | "violation"
        | "maintenance"
        | "request"
      suspension_status: "active" | "released" | "expired"
      tariff_type: "fixed" | "tiered" | "time_of_use" | "seasonal"
      technician_availability: "available" | "busy" | "off_duty" | "vacation"
      tenancy_type: "owner" | "tenant" | "family_member" | "guest"
      ticket_category:
        | "electricity"
        | "water"
        | "internet"
        | "gas"
        | "maintenance"
        | "cleaning"
        | "parking"
        | "security"
        | "elevator"
        | "noise"
        | "other"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "pending"
        | "resolved"
        | "closed"
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
      utility_bill_status:
        | "draft"
        | "issued"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      utility_type:
        | "electricity"
        | "internet"
        | "gas"
        | "water"
        | "maintenance"
        | "generator"
        | "other"
      visitor_status:
        | "pending"
        | "approved"
        | "rejected"
        | "expired"
        | "checked_in"
        | "checked_out"
      visitor_type: "guest" | "delivery" | "maintenance" | "contractor"
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
      announcement_kind: [
        "general",
        "urgent",
        "maintenance",
        "billing",
        "security",
        "event",
      ],
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
      billing_cycle: ["monthly", "quarterly", "biannual", "annual", "one_time"],
      billing_method: [
        "flat",
        "metered",
        "tiered",
        "time_of_use",
        "package",
        "pay_per_use",
      ],
      booking_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "completed",
      ],
      commission_kind: ["percentage", "fixed"],
      commission_payee: ["platform", "compound", "organization"],
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
      facility_type: [
        "gym",
        "pool",
        "meeting_room",
        "event_hall",
        "football_field",
        "basketball_court",
        "tennis_court",
        "bbq_area",
        "playground",
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
      gas_order_status: [
        "pending",
        "scheduled",
        "out_for_delivery",
        "delivered",
        "cancelled",
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
      maintenance_status: [
        "scheduled",
        "in_progress",
        "on_hold",
        "completed",
        "cancelled",
      ],
      maintenance_type: ["preventive", "corrective", "emergency"],
      meter_status: ["active", "inactive", "faulty", "replaced"],
      notification_kind: [
        "ticket_update",
        "maintenance_assigned",
        "booking_status",
        "visitor_status",
        "announcement",
        "payment_received",
        "payment_due",
        "penalty",
        "generic",
      ],
      order_payment_status: ["unpaid", "partial", "paid", "refunded"],
      order_status: [
        "pending",
        "confirmed",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
        "refunded",
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
      payout_status: ["pending", "processing", "paid", "cancelled"],
      penalty_status: ["pending", "applied", "waived", "paid"],
      penalty_type: ["fixed", "percentage", "daily", "monthly"],
      provider_availability: ["open", "busy", "closed"],
      provider_kind: [
        "maintenance",
        "cleaning",
        "plumbing",
        "electrician",
        "ac_technician",
        "grocery",
        "pharmacy",
        "restaurant",
        "laundry",
        "moving",
        "car_wash",
        "delivery",
        "security",
        "internet_services",
        "other",
      ],
      provider_status: ["active", "inactive", "suspended"],
      provider_verification: ["unverified", "pending", "verified", "rejected"],
      reading_source: ["manual", "photo", "smart_meter", "imported"],
      reminder_channel: ["in_app", "email", "sms"],
      reminder_kind: ["upcoming", "overdue", "penalty", "payment_received"],
      reminder_status: ["pending", "sent", "failed", "dismissed"],
      resident_status: ["active", "pending", "former"],
      service_kind: ["product", "on_demand_service", "subscription", "package"],
      subscription_status: [
        "pending",
        "active",
        "suspended",
        "cancelled",
        "expired",
      ],
      suspension_reason: [
        "overdue",
        "manual",
        "violation",
        "maintenance",
        "request",
      ],
      suspension_status: ["active", "released", "expired"],
      tariff_type: ["fixed", "tiered", "time_of_use", "seasonal"],
      technician_availability: ["available", "busy", "off_duty", "vacation"],
      tenancy_type: ["owner", "tenant", "family_member", "guest"],
      ticket_category: [
        "electricity",
        "water",
        "internet",
        "gas",
        "maintenance",
        "cleaning",
        "parking",
        "security",
        "elevator",
        "noise",
        "other",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "assigned",
        "in_progress",
        "pending",
        "resolved",
        "closed",
      ],
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
      utility_bill_status: [
        "draft",
        "issued",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      utility_type: [
        "electricity",
        "internet",
        "gas",
        "water",
        "maintenance",
        "generator",
        "other",
      ],
      visitor_status: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "checked_in",
        "checked_out",
      ],
      visitor_type: ["guest", "delivery", "maintenance", "contractor"],
    },
  },
} as const
