create table if not exists public.return_settlement_sessions (
    id uuid primary key default gen_random_uuid(),
    return_settlement_id uuid not null unique references public.return_settlements(id) on update cascade on delete restrict,
    device_id uuid not null references public.customer_display_devices(id) on update cascade on delete restrict,
    created_by_id uuid not null references public.users(id) on update cascade on delete restrict,
    status varchar(30) not null default 'SENT_TO_CUSTOMER' check (
        status in ('SENT_TO_CUSTOMER', 'CUSTOMER_VIEWING', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED')
    ),
    provider_order_id varchar(150),
    provider_transaction_id varchar(150),
    operation_reference varchar(120),
    raw_response jsonb,
    expires_at timestamptz not null,
    viewed_at timestamptz,
    processing_at timestamptz,
    completed_at timestamptz,
    cancelled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ix_return_settlement_sessions_device_status
on public.return_settlement_sessions(device_id, status, created_at desc);

create unique index if not exists ux_return_settlement_sessions_provider_order
on public.return_settlement_sessions(provider_order_id)
where provider_order_id is not null;

create unique index if not exists ux_return_settlement_sessions_provider_transaction
on public.return_settlement_sessions(provider_transaction_id)
where provider_transaction_id is not null;
