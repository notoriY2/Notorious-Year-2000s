export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

async function sb(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${path}`);
  return res.json();
}

export default async function handler() {
  const [products, banners, settings, currencies] = await Promise.all([
    sb('products?select=id,slug,name,price,image,images,category,sold_out,position_top,position_left,mobile_position_top,mobile_position_left,rotation,scale,z_index,show_on_floor&status=eq.Active&is_staged=eq.false&order=z_index.asc'),
    sb('banners?select=id,title,image,position,status,banner_products(position,products(id,slug,name,price,image,images,category,sold_out))&status=eq.Active'),
    sb('store_settings?select=key,value'),
    sb('currencies?select=code,symbol,rate'),
  ]);

  return new Response(JSON.stringify({ products, banners, settings, currencies }), {
    headers: {
      'Content-Type': 'application/json',
      // Edge caches this for 60s, serves stale for up to 5 min while refreshing in background.
      // This is the single change that removes the client -> Postgres waterfall for every
      // new visitor hitting a warm cache slot.
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}