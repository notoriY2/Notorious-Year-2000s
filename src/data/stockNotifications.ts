import { supabase } from '../lib/supabase';

export const notifyWhenInStock = async (
  productId: string,
  size: string,
  email: string
): Promise<void> => {
  const { error } = await supabase
    .from('stock_notifications')
    .upsert(
      { product_id: productId, size, email: email.trim().toLowerCase() },
      { onConflict: 'product_id,size,email' }
    );
  if (error) throw error;
};