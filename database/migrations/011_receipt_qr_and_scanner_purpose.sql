alter table public.sales
add column if not exists receipt_token varchar(64);

update public.sales
set receipt_token = replace(gen_random_uuid()::text, '-', '')
where receipt_token is null;

alter table public.sales alter column receipt_token set not null;
create unique index if not exists ux_sales_receipt_token on public.sales(receipt_token);

alter table public.scanner_sessions
add column if not exists purpose varchar(30) not null default 'POS_PRODUCT_SCAN';

alter table public.scanner_sessions
drop constraint if exists scanner_sessions_purpose_check;

alter table public.scanner_sessions
add constraint scanner_sessions_purpose_check
check (purpose in ('POS_PRODUCT_SCAN', 'RECEIPT_LOOKUP'));
