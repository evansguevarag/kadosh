do $$
begin
    if exists (
        select 1
        from public.payment_sessions
        where device_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then
        raise exception 'payment_sessions contiene device_id que no son UUID validos';
    end if;

    if exists (
        select 1
        from public.payment_sessions ps
        left join public.customer_display_devices d
            on d.id::text = ps.device_id
        where d.id is null
    ) then
        raise exception 'payment_sessions contiene referencias a tablets inexistentes';
    end if;
end
$$;

alter table public.payment_sessions
add column if not exists device_uuid uuid
generated always as (device_id::uuid) stored;

alter table public.payment_sessions
alter column device_uuid set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'fk_payment_sessions_device'
          and conrelid = 'public.payment_sessions'::regclass
    ) then
        alter table public.payment_sessions
        add constraint fk_payment_sessions_device
        foreign key (device_uuid)
        references public.customer_display_devices(id)
        on update restrict
        on delete restrict;
    end if;
end
$$;

create index if not exists idx_payment_sessions_device_uuid
on public.payment_sessions(device_uuid);
