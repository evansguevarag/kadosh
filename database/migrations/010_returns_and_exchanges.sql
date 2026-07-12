create table if not exists public.return_transactions (
    id uuid primary key default gen_random_uuid(),
    return_number varchar(40) not null unique,
    original_sale_id uuid not null references public.sales(id) on update cascade on delete restrict,
    processed_by_id uuid not null references public.users(id) on update cascade on delete restrict,
    transaction_type varchar(20) not null check (transaction_type in ('RETURN', 'EXCHANGE')),
    reason varchar(40) not null,
    item_condition varchar(30) not null,
    inventory_resolution varchar(30) not null check (
        inventory_resolution in ('RESTOCK', 'DEFECTIVE', 'REVIEW', 'DAMAGE', 'SUPPLIER_RETURN')
    ),
    returned_value numeric(12, 2) not null default 0,
    replacement_value numeric(12, 2) not null default 0,
    difference_amount numeric(12, 2) not null default 0,
    settlement_method varchar(40),
    notes varchar(500),
    status varchar(20) not null default 'COMPLETED',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_return_transactions_original_sale_id
on public.return_transactions(original_sale_id);

create index if not exists ix_return_transactions_created_at
on public.return_transactions(created_at desc);

create table if not exists public.return_items (
    id uuid primary key default gen_random_uuid(),
    return_transaction_id uuid not null references public.return_transactions(id) on update cascade on delete cascade,
    sale_item_id uuid not null references public.sale_items(id) on update cascade on delete restrict,
    quantity integer not null check (quantity > 0),
    unit_value numeric(12, 2) not null check (unit_value >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0)
);

create index if not exists ix_return_items_sale_item_id
on public.return_items(sale_item_id);

create table if not exists public.replacement_items (
    id uuid primary key default gen_random_uuid(),
    return_transaction_id uuid not null references public.return_transactions(id) on update cascade on delete cascade,
    product_variant_id uuid not null references public.product_variants(id) on update cascade on delete restrict,
    product_name varchar(150) not null,
    variant_sku varchar(80) not null,
    size varchar(30),
    color varchar(60),
    quantity integer not null check (quantity > 0),
    unit_price numeric(12, 2) not null check (unit_price >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0)
);

