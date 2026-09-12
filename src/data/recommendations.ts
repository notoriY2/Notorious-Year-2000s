import { supabase } from '../lib/supabase';
import { Product } from '../types/Product';
import { mapRowToProduct, ProductRow } from '../lib/mapProduct';

export const getSemanticRecommendations = async (
  productId: string,
  count = 8
): Promise<Product[] | null> => {
  const { data: matches, error } = await supabase.rpc('match_products', {
    p_product_id: productId,
    p_match_count: count,
  });

  if (error || !matches || matches.length === 0) return null;

  const ids = matches.map((m: any) => m.id);
  const { data: rows, error: rowsError } = await supabase
  .from('products')
  .select(`
    id,
    slug,
    name,
    price,
    image,
    images,
    category,
    sold_out
  `)
  .in('id', ids);

  if (rowsError || !rows) return null;

  const byId = new Map((rows as ProductRow[]).map(r => [r.id, mapRowToProduct(r)]));
  return ids.map((id: string) => byId.get(id)).filter(Boolean) as Product[];
};