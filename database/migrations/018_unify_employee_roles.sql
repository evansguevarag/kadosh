begin;

alter table public.users
    add column if not exists paternal_last_name varchar(100),
    add column if not exists maternal_last_name varchar(100);

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users'
          and column_name = 'last_name'
    ) then
        update public.users
        set paternal_last_name = split_part(btrim(last_name), ' ', 1),
            maternal_last_name = nullif(
                regexp_replace(btrim(last_name), '^\S+\s*', ''),
                ''
            )
        where paternal_last_name is null;

        alter table public.users drop constraint if exists chk_users_last_name_not_empty;
        alter table public.users alter column last_name drop not null;
    end if;
end $$;

do $$
begin
    if exists (
        select 1 from public.users
        where paternal_last_name is null
           or maternal_last_name is null
           or document_number is null
           or btrim(document_number) !~ '^\d{8}$'
           or phone is null
           or btrim(phone) !~ '^9\d{8}$'
    ) then
        raise exception 'Hay usuarios con apellidos, DNI o celular incompletos. Corrige esos datos antes de aplicar la migracion 018.';
    end if;
end $$;

alter table public.users
    alter column paternal_last_name set not null,
    alter column maternal_last_name set not null,
    alter column document_number set not null,
    alter column phone set not null;

alter table public.users drop constraint if exists chk_users_paternal_last_name_not_empty;
alter table public.users add constraint chk_users_paternal_last_name_not_empty
    check (length(btrim(paternal_last_name)) > 0);
alter table public.users drop constraint if exists chk_users_maternal_last_name_not_empty;
alter table public.users add constraint chk_users_maternal_last_name_not_empty
    check (length(btrim(maternal_last_name)) > 0);
alter table public.users drop constraint if exists chk_users_document_number_format;
alter table public.users add constraint chk_users_document_number_format
    check (document_number ~ '^\d{8}$');
alter table public.users drop constraint if exists chk_users_phone_format;
alter table public.users add constraint chk_users_phone_format
    check (phone ~ '^9\d{8}$');

create unique index if not exists uq_users_document_number
    on public.users (document_number);

insert into public.roles (name, description, is_active)
values (
    'EMPLOYEE',
    'Empleado encargado de ventas, cobros y atencion operativa.',
    true
)
on conflict (name) do update
set description = excluded.description,
    is_active = true,
    updated_at = now();

update public.users
set role_id = employee.id,
    updated_at = now()
from public.roles employee,
     public.roles legacy_role
where employee.name = 'EMPLOYEE'
  and legacy_role.id = public.users.role_id
  and legacy_role.name in ('SELLER', 'CASHIER');

update public.roles
set is_active = false,
    updated_at = now()
where name in ('SELLER', 'CASHIER');

update public.roles
set description = 'Administrador del sistema con acceso completo.',
    is_active = true,
    updated_at = now()
where name = 'ADMIN';

commit;
