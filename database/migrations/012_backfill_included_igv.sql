update public.sales
set tax_total = round((total * 18 / 118)::numeric, 2)
where tax_total = 0
  and total > 0;
