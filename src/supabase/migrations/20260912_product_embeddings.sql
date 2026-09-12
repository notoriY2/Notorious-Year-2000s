create extension if not exists vector;

alter table public.products add column if not exists embedding vector(1536);

create or replace function public.match_products(
  p_product_id uuid,
  p_match_count int default 8
)
returns table(id uuid, similarity float)
language sql stable as $$
  select p2.id, 1 - (p2.embedding <=> p1.embedding) as similarity
  from public.products p1
  join public.products p2 on p2.id != p1.id
  where p1.id = p_product_id
    and p1.embedding is not null
    and p2.embedding is not null
    and p2.is_staged = false
    and p2.status = 'Active'
  order by p2.embedding <=> p1.embedding
  limit p_match_count;
$$;

grant execute on function public.match_products(uuid, int) to anon, authenticated;