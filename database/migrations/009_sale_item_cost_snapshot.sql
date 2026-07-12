alter table public.sale_items
add column if not exists cost_price numeric(12, 2) not null default 0;

update public.sale_items si
set cost_price = pv.cost_price
from public.product_variants pv
where pv.id = si.product_variant_id
  and si.cost_price = 0;

