import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type OrderStatus = 'pending' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled'

export type CartItem = {
  id: string
  name: string
  quantity: number
  price: number
  unit: string
  image?: string
}

export type Order = {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  customer_address: string
  customer_locality: string
  customer_pincode: string
  items: CartItem[]
  subtotal: number
  delivery_fee: number
  total: number
  delivery_zone: string | null
  status: OrderStatus
  created_at: string
}

export type Customer = {
  id: string
  phone: string
  name: string
  locality: string | null
  pincode: string | null
  total_orders: number
  total_spent: number
  last_order_at: string | null
  created_at: string
}

export type InventoryItem = {
  id: string
  product_id: string
  product_name: string
  price_per_kg: number
  stock_kg: number
  available: boolean
  updated_at: string
}
