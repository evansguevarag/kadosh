create table if not exists public.return_settlements (
    id uuid primary key default gen_random_uuid(),
    return_transaction_id uuid not null unique references public.return_transactions(id) on update cascade on delete restrict,
    direction varchar(10) not null check (direction in ('CHARGE', 'REFUND', 'NONE')),
    method varchar(40),
    amount numeric(12, 2) not null default 0 check (amount >= 0),
    currency varchar(3) not null default 'PEN' check (currency = 'PEN'),
    status varchar(20) not null check (status in ('SETTLED', 'PENDING', 'FAILED', 'CANCELLED')),
    operation_reference varchar(120),
    settled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_return_settlement_consistency check (
        (direction = 'NONE' and amount = 0 and method is null)
        or (direction in ('CHARGE', 'REFUND') and amount > 0 and method is not null)
    )
);

create index if not exists ix_return_settlements_status
on public.return_settlements(status);

create index if not exists ix_return_settlements_created_at
on public.return_settlements(created_at desc);

insert into public.return_settlements (
    return_transaction_id,
    direction,
    method,
    amount,
    currency,
    status,
    settled_at
)
select
    rt.id,
    case
        when rt.difference_amount > 0 then 'CHARGE'
        when rt.difference_amount < 0 then 'REFUND'
        else 'NONE'
    end,
    case
        when rt.difference_amount = 0 then null
        else coalesce(rt.settlement_method, 'LEGACY_UNSPECIFIED')
    end,
    abs(rt.difference_amount),
    'PEN',
    'SETTLED',
    rt.created_at
from public.return_transactions rt
where not exists (
    select 1
    from public.return_settlements rs
    where rs.return_transaction_id = rt.id
);
