create table if not exists public.return_inventory_reservations (
    id uuid primary key default gen_random_uuid(),
    return_transaction_id uuid not null references public.return_transactions(id) on update cascade on delete restrict,
    product_variant_id uuid not null references public.product_variants(id) on update cascade on delete restrict,
    quantity integer not null check (quantity > 0),
    status varchar(20) not null default 'ACTIVE' check (status in ('ACTIVE', 'CONSUMED', 'RELEASED')),
    expires_at timestamptz not null,
    consumed_at timestamptz,
    released_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (return_transaction_id, product_variant_id)
);

create index if not exists ix_return_inventory_reservations_variant_active
on public.return_inventory_reservations(product_variant_id, expires_at)
where status = 'ACTIVE';
