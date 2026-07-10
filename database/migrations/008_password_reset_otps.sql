create table if not exists public.password_reset_otps (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    code_hash varchar(255) not null,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_password_reset_otps_user
        foreign key (user_id)
        references public.users(id)
        on update cascade
        on delete cascade
);

create index if not exists idx_password_reset_otps_user_id
on public.password_reset_otps(user_id);

create index if not exists idx_password_reset_otps_expires_at
on public.password_reset_otps(expires_at);

create index if not exists idx_password_reset_otps_active_user
on public.password_reset_otps(user_id, expires_at)
where consumed_at is null;

drop trigger if exists trg_password_reset_otps_updated_at
on public.password_reset_otps;

create trigger trg_password_reset_otps_updated_at
before update on public.password_reset_otps
for each row
execute function public.set_updated_at();

alter table public.password_reset_otps enable row level security;
