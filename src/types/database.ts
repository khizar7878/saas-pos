export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          sku: string | null
          pct_code: string | null
          barcode: string | null
          category_id: string | null
          price: number
          tax_rate: number
          cost_price: number | null
          meters_per_piece: number
          meters_per_suit?: number | null
          stock_quantity: number
          min_stock_level: number
          is_active: boolean
          created_at: string
          updated_at: string
          warehouse_product_id: string | null
          warehouse_variation_id: string | null
        }
        Insert: {
          id?: string
          name: string
          sku?: string | null
          pct_code?: string | null
          barcode?: string | null
          category_id?: string | null
          price: number
          tax_rate?: number
          cost_price?: number | null
          meters_per_piece?: number
          stock_quantity?: number
          min_stock_level?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          warehouse_product_id?: string | null
          warehouse_variation_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          sku?: string | null
          pct_code?: string | null
          barcode?: string | null
          category_id?: string | null
          price?: number
          tax_rate?: number
          cost_price?: number | null
          meters_per_piece?: number
          stock_quantity?: number
          min_stock_level?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          warehouse_product_id?: string | null
          warehouse_variation_id?: string | null
        }
      }
      product_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          sale_number: string
          customer_id: string | null
          customer_name: string
          subtotal: number
          discount_amount: number
          discount_percent: number | null
          total_amount: number
          payment_method: string
          amount_received: number
          change_amount: number
          deposit_account_id: string | null
          sale_type: string
          status: 'completed' | 'pending' | 'cancelled' | 'returned'
          notes: string | null
          cheque_number: string | null
          cheque_bank: string | null
          cheque_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sale_number: string
          customer_id?: string | null
          customer_name: string
          subtotal: number
          discount_amount?: number
          discount_percent?: number | null
          total_amount: number
          payment_method?: string
          amount_received: number
          change_amount: number
          deposit_account_id?: string | null
          sale_type?: string
          status?: 'completed' | 'pending' | 'cancelled' | 'returned'
          notes?: string | null
          cheque_number?: string | null
          cheque_bank?: string | null
          cheque_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sale_number?: string
          customer_id?: string | null
          customer_name?: string
          subtotal?: number
          discount_amount?: number
          discount_percent?: number | null
          total_amount?: number
          payment_method?: string
          amount_received?: number
          change_amount?: number
          deposit_account_id?: string | null
          sale_type?: string
          status?: 'completed' | 'pending' | 'cancelled' | 'returned'
          notes?: string | null
          cheque_number?: string | null
          cheque_bank?: string | null
          cheque_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          tax_percentage: number
          tax_amount: number
          discount: number
          pct_code: string
          quantity_returned: number
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          tax_percentage?: number
          tax_amount?: number
          discount?: number
          pct_code?: string
          quantity_returned?: number
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          quantity_returned?: number
          unit_price?: number
          total_price?: number
          tax_percentage?: number
          tax_amount?: number
          discount?: number
          pct_code?: string
          created_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      returns: {
        Row: {
          id: string
          return_number: string
          original_sale_id: string | null
          customer_id: string | null
          total_amount: number
          reason: string | null
          status: ReturnStatus
          return_type: 'cash' | 'credit'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          return_number: string
          original_sale_id?: string | null
          customer_id?: string | null
          total_amount: number
          reason?: string | null
          status?: ReturnStatus
          return_type?: 'cash' | 'credit'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          return_number?: string
          original_sale_id?: string | null
          customer_id?: string | null
          total_amount?: number
          reason?: string | null
          status?: ReturnStatus
          return_type?: 'cash' | 'credit'
          created_at?: string
          updated_at?: string
        }
      }
      return_items: {
        Row: {
          id: string
          return_id: string
          sale_item_id: string | null
          product_id: string | null
          quantity: number
          unit_price: number
          total_price: number
          created_at: string
        }
        Insert: {
          id?: string
          return_id: string
          sale_item_id?: string | null
          product_id?: string | null
          quantity: number
          unit_price: number
          total_price: number
          created_at?: string
        }
        Update: {
          id?: string
          return_id?: string
          sale_item_id?: string | null
          product_id?: string | null
          quantity?: number
          unit_price?: number
          total_price?: number
          created_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          name: string
          type: string
          phone?: string | null
          email?: string | null
          address?: string | null
          city?: string | null
          credit_limit?: number | null
          opening_balance?: number | null
          current_balance: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          phone?: string | null
          email?: string | null
          address?: string | null
          city?: string | null
          credit_limit?: number | null
          opening_balance?: number | null
          current_balance?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          city?: string | null
          credit_limit?: number | null
          opening_balance?: number | null
          current_balance?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      ledger_entries: {
        Row: {
          id: string
          account_id: string
          reference_type: string | null
          reference_id: string | null
          description: string | null
          debit: number
          credit: number
          balance: number
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          reference_type?: string | null
          reference_id?: string | null
          description?: string | null
          debit?: number
          credit?: number
          balance: number
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          reference_type?: string | null
          reference_id?: string | null
          description?: string | null
          debit?: number
          credit?: number
          balance?: number
          created_at?: string
        }
      }
      stock_receipts: {
        Row: {
          id: string
          receipt_number: string
          total_rolls: number
          total_meters: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          receipt_number: string
          total_rolls: number
          total_meters: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          receipt_number?: string
          total_rolls?: number
          total_meters?: number
          notes?: string | null
          created_at?: string
        }
      }
      stock_receipt_items: {
        Row: {
          id: string
          receipt_id: string
          product_id: string
          rolls_received: number
          meters_per_roll: number
          total_meters: number
          created_at: string
        }
        Insert: {
          id?: string
          receipt_id: string
          product_id: string
          rolls_received: number
          meters_per_roll: number
          total_meters: number
          created_at?: string
        }
        Update: {
          id?: string
          receipt_id?: string
          product_id?: string
          rolls_received?: number
          meters_per_roll?: number
          total_meters?: number
          created_at?: string
        }
      }
      held_carts: {
        Row: {
          id: string
          customer_id: string | null
          cart_data: Json
          total_amount: number
          page_type: string
          created_at: string
          assigned_to: string | null
          cart_name: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          cart_data: Json
          total_amount: number
          page_type?: string
          created_at?: string
          assigned_to?: string | null
          cart_name: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          cart_data?: Json
          total_amount?: number
          page_type?: string
          created_at?: string
          assigned_to?: string | null
          cart_name?: string
        }
      }
      credit_sales: {
        Row: {
          id: string
          bill_number: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          total_amount: number
          items: Json
          status: 'pending' | 'completed' | 'delivered'
          created_at: string
          created_by: string | null
          received_by: string | null
          store_id: string | null
          sale_id: string | null
        }
        Insert: {
          id?: string
          bill_number?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          total_amount: number
          items?: Json
          status?: 'pending' | 'completed' | 'delivered'
          created_at?: string
          created_by?: string | null
          received_by?: string | null
          store_id?: string | null
          sale_id?: string | null
        }
        Update: {
          id?: string
          bill_number?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          total_amount?: number
          items?: Json
          status?: 'pending' | 'completed' | 'delivered'
          created_at?: string
          created_by?: string | null
          received_by?: string | null
          store_id?: string | null
          sale_id?: string | null
        }
      }
    }
  }
}

export type Product = Database['public']['Tables']['products']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Account = Database['public']['Tables']['accounts']['Row'];
export type LedgerEntry = Database['public']['Tables']['ledger_entries']['Row'];
export type Return = Database['public']['Tables']['returns']['Row'];
export type CreditSale = Database['public']['Tables']['credit_sales']['Row'];

export type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export type StoreSettings = {
  id: number;
  store_name: string;
  address: string;
  phone: string;
  alt_phone?: string | null;
  email?: string | null;
  header_text?: string | null;
  footer_text?: string | null;
  exchange_policy?: string | null;
  logo_url?: string | null;
  strn?: string | null;
  ntn?: string | null;
}

export type PaymentMethod = 'cash' | 'card' | 'credit' | 'mixed' | 'cheque' | 'ibft';
export type SaleStatus = 'completed' | 'pending' | 'cancelled';
