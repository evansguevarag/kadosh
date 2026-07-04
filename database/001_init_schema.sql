-- =========================================================
-- KADOSH POS - ESQUEMA INICIAL PROFESIONAL
-- Base de datos: Supabase PostgreSQL
-- Proyecto: Sistema de Gestión de Tienda de Ropa Urbana
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- FUNCIÓN GLOBAL updated_at
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- =========================================================
-- TABLA: roles
-- =========================================================

create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    name varchar(50) not null unique,
    description varchar(255),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint chk_roles_name_not_empty check (length(trim(name)) > 0)
);

drop trigger if exists trg_roles_updated_at on public.roles;

create trigger trg_roles_updated_at
before update on public.roles
for each row
execute function public.set_updated_at();

-- =========================================================
-- TABLA: users
-- Usuarios internos del sistema: administrador, vendedor, cajero
-- =========================================================

create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    role_id uuid not null,
    first_name varchar(100) not null,
    last_name varchar(100) not null,
    email varchar(150) not null unique,
    password_hash varchar(255) not null,
    document_number varchar(20),
    phone varchar(30),
    status varchar(30) not null default 'ACTIVE',
    is_active boolean not null default true,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_users_role
        foreign key (role_id)
        references public.roles(id)
        on update cascade
        on delete restrict,

    constraint chk_users_status
        check (status in ('ACTIVE', 'INACTIVE', 'BLOCKED')),

    constraint chk_users_email_not_empty
        check (length(trim(email)) > 0),

    constraint chk_users_first_name_not_empty
        check (length(trim(first_name)) > 0),

    constraint chk_users_last_name_not_empty
        check (length(trim(last_name)) > 0)
);

create index if not exists idx_users_role_id on public.users(role_id);
create index if not exists idx_users_email on public.users(email);

drop trigger if exists trg_users_updated_at on public.users;

create trigger trg_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

-- =========================================================
-- TABLA: customers
-- Clientes de la tienda. Puede existir venta sin cliente.
-- =========================================================

create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    document_type varchar(20),
    document_number varchar(20),
    first_name varchar(100) not null,
    last_name varchar(100),
    phone varchar(30),
    email varchar(150),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint chk_customers_document_type
        check (
            document_type is null
            or document_type in ('DNI', 'RUC', 'CE', 'PASSPORT')
        ),

    constraint chk_customers_first_name_not_empty
        check (length(trim(first_name)) > 0)
);

create unique index if not exists uq_customers_document
on public.customers(document_type, document_number)
where document_type is not null and document_number is not null;

create index if not exists idx_customers_document_number on public.customers(document_number);
create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_customers_email on public.customers(email);

drop trigger if exists trg_customers_updated_at on public.customers;

create trigger trg_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

-- =========================================================
-- TABLA: categories
-- Categorías: poleras, joggers, casacas, accesorios, etc.
-- =========================================================

create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    name varchar(100) not null unique,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint chk_categories_name_not_empty
        check (length(trim(name)) > 0)
);

drop trigger if exists trg_categories_updated_at on public.categories;

create trigger trg_categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

-- =========================================================
-- TABLA: products
-- Producto base. No guarda talla/color/stock directamente.
-- =========================================================

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    category_id uuid not null,
    name varchar(150) not null,
    description text,
    brand varchar(100),
    status varchar(30) not null default 'ACTIVE',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_products_category
        foreign key (category_id)
        references public.categories(id)
        on update cascade
        on delete restrict,

    constraint chk_products_status
        check (status in ('ACTIVE', 'INACTIVE', 'ARCHIVED')),

    constraint chk_products_name_not_empty
        check (length(trim(name)) > 0)
);

create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_name on public.products(name);

drop trigger if exists trg_products_updated_at on public.products;

create trigger trg_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

-- =========================================================
-- TABLA: product_variants
-- Variante real vendible: talla, color, SKU, precio y stock.
-- =========================================================

create table if not exists public.product_variants (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null,
    sku varchar(80) not null unique,
    size varchar(30) not null,
    color varchar(60) not null,
    barcode varchar(100),
    cost_price numeric(12, 2) not null default 0,
    sale_price numeric(12, 2) not null,
    stock_quantity integer not null default 0,
    min_stock_quantity integer not null default 0,
    status varchar(30) not null default 'ACTIVE',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_product_variants_product
        foreign key (product_id)
        references public.products(id)
        on update cascade
        on delete restrict,

    constraint chk_product_variants_cost_price
        check (cost_price >= 0),

    constraint chk_product_variants_sale_price
        check (sale_price > 0),

    constraint chk_product_variants_stock_quantity
        check (stock_quantity >= 0),

    constraint chk_product_variants_min_stock_quantity
        check (min_stock_quantity >= 0),

    constraint chk_product_variants_status
        check (status in ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'ARCHIVED')),

    constraint chk_product_variants_sku_not_empty
        check (length(trim(sku)) > 0),

    constraint chk_product_variants_size_not_empty
        check (length(trim(size)) > 0),

    constraint chk_product_variants_color_not_empty
        check (length(trim(color)) > 0)
);

create index if not exists idx_product_variants_product_id on public.product_variants(product_id);
create index if not exists idx_product_variants_sku on public.product_variants(sku);
create index if not exists idx_product_variants_barcode on public.product_variants(barcode);
create index if not exists idx_product_variants_stock_quantity on public.product_variants(stock_quantity);

drop trigger if exists trg_product_variants_updated_at on public.product_variants;

create trigger trg_product_variants_updated_at
before update on public.product_variants
for each row
execute function public.set_updated_at();

-- =========================================================
-- TABLA: sales
-- Cabecera de venta.
-- customer_id puede ser null para venta anónima.
-- =========================================================

create table if not exists public.sales (
    id uuid primary key default gen_random_uuid(),
    sale_number varchar(40) not null unique,
    seller_id uuid not null,
    customer_id uuid,
    subtotal numeric(12, 2) not null default 0,
    discount_total numeric(12, 2) not null default 0,
    tax_total numeric(12, 2) not null default 0,
    total numeric(12, 2) not null default 0,
    status varchar(30) not null default 'DRAFT',
    notes text,
    paid_at timestamptz,
    cancelled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_sales_seller
        foreign key (seller_id)
        references public.users(id)
        on update cascade
        on delete restrict,

    constraint fk_sales_customer
        foreign key (customer_id)
        references public.customers(id)
        on update cascade
        on delete set null,

    constraint chk_sales_status
        check (
            status in (
                'DRAFT',
                'PENDING_PAYMENT',
                'PAID',
                'CANCELLED',
                'PAYMENT_FAILED',
                'REFUNDED'
            )
        ),

    constraint chk_sales_subtotal
        check (subtotal >= 0),

    constraint chk_sales_discount_total
        check (discount_total >= 0),

    constraint chk_sales_tax_total
        check (tax_total >= 0),

    constraint chk_sales_total
        check (total >= 0)
);

create index if not exists idx_sales_seller_id on public.sales(seller_id);
create index if not exists idx_sales_customer_id on public.sales(customer_id);
create index if not exists idx_sales_status on public.sales(status);
create index if not exists idx_sales_created_at on public.sales(created_at);

drop trigger if exists trg_sales_updated_at on public.sales;

create trigger trg_sales_updated_at
before update on public.sales
for each row
execute function public.set_updated_at();

-- =========================================================
-- TABLA: sale_items
-- Detalle de productos vendidos.
-- =========================================================

create table if not exists public.sale_items (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid not null,
    product_variant_id uuid not null,
    product_name varchar(150) not null,
    variant_sku varchar(80) not null,
    size varchar(30) not null,
    color varchar(60) not null,
    quantity integer not null,
    unit_price numeric(12, 2) not null,
    discount_amount numeric(12, 2) not null default 0,
    subtotal numeric(12, 2) not null,
    created_at timestamptz not null default now(),

    constraint fk_sale_items_sale
        foreign key (sale_id)
        references public.sales(id)
        on update cascade
        on delete cascade,

    constraint fk_sale_items_product_variant
        foreign key (product_variant_id)
        references public.product_variants(id)
        on update cascade
        on delete restrict,

    constraint chk_sale_items_quantity
        check (quantity > 0),

    constraint chk_sale_items_unit_price
        check (unit_price >= 0),

    constraint chk_sale_items_discount_amount
        check (discount_amount >= 0),

    constraint chk_sale_items_subtotal
        check (subtotal >= 0)
);

create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);
create index if not exists idx_sale_items_product_variant_id on public.sale_items(product_variant_id);

-- =========================================================
-- TABLA: payments
-- Pagos manuales y pagos por Culqi.
-- =========================================================

create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid not null,
    payment_method varchar(40) not null,
    provider varchar(40) not null default 'MANUAL',
    amount numeric(12, 2) not null,
    currency varchar(10) not null default 'PEN',
    status varchar(30) not null default 'PENDING',
    operation_code varchar(120),
    provider_order_id varchar(150),
    provider_transaction_id varchar(150),
    culqi_charge_id varchar(150),
    raw_response jsonb,
    paid_at timestamptz,
    failed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_payments_sale
        foreign key (sale_id)
        references public.sales(id)
        on update cascade
        on delete restrict,

    constraint chk_payments_payment_method
        check (
            payment_method in (
                'CASH',
                'YAPE',
                'PLIN',
                'TRANSFER',
                'POS',
                'CULQI'
            )
        ),

    constraint chk_payments_provider
        check (
            provider in (
                'MANUAL',
                'CULQI',
                'YAPE',
                'PLIN',
                'NIUBIZ',
                'IZIPAY',
                'BANK'
            )
        ),

    constraint chk_payments_status
        check (
            status in (
                'PENDING',
                'PROCESSING',
                'PAID',
                'FAILED',
                'CANCELLED',
                'REFUNDED'
            )
        ),

    constraint chk_payments_amount
        check (amount > 0),

    constraint chk_payments_currency
        check (currency in ('PEN', 'USD'))
);

create index if not exists idx_payments_sale_id on public.payments(sale_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_provider_transaction_id on public.payments(provider_transaction_id);

drop trigger if exists trg_payments_updated_at on public.payments;

create trigger trg_payments_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

-- =========================================================
-- TABLA: payment_sessions
-- Sesiones de pago enviadas a tablet del cliente.
-- Esta tabla será escuchada por Supabase Realtime.
-- =========================================================

create table if not exists public.payment_sessions (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid not null,
    payment_id uuid not null,
    seller_id uuid not null,
    device_id varchar(100) not null,
    status varchar(40) not null default 'CREATED',
    amount numeric(12, 2) not null,
    currency varchar(10) not null default 'PEN',
    customer_message varchar(255),
    expires_at timestamptz not null,
    viewed_at timestamptz,
    processing_at timestamptz,
    completed_at timestamptz,
    cancelled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_payment_sessions_sale
        foreign key (sale_id)
        references public.sales(id)
        on update cascade
        on delete cascade,

    constraint fk_payment_sessions_payment
        foreign key (payment_id)
        references public.payments(id)
        on update cascade
        on delete cascade,

    constraint fk_payment_sessions_seller
        foreign key (seller_id)
        references public.users(id)
        on update cascade
        on delete restrict,

    constraint chk_payment_sessions_status
        check (
            status in (
                'CREATED',
                'SENT_TO_CUSTOMER',
                'CUSTOMER_VIEWING',
                'PROCESSING',
                'PAID',
                'FAILED',
                'EXPIRED',
                'CANCELLED'
            )
        ),

    constraint chk_payment_sessions_amount
        check (amount > 0),

    constraint chk_payment_sessions_currency
        check (currency in ('PEN', 'USD')),

    constraint chk_payment_sessions_device_id_not_empty
        check (length(trim(device_id)) > 0)
);

create index if not exists idx_payment_sessions_sale_id on public.payment_sessions(sale_id);
create index if not exists idx_payment_sessions_payment_id on public.payment_sessions(payment_id);
create index if not exists idx_payment_sessions_seller_id on public.payment_sessions(seller_id);
create index if not exists idx_payment_sessions_device_id on public.payment_sessions(device_id);
create index if not exists idx_payment_sessions_status on public.payment_sessions(status);
create index if not exists idx_payment_sessions_expires_at on public.payment_sessions(expires_at);

drop trigger if exists trg_payment_sessions_updated_at on public.payment_sessions;

create trigger trg_payment_sessions_updated_at
before update on public.payment_sessions
for each row
execute function public.set_updated_at();

-- Necesario para recibir UPDATE completos por Supabase Realtime
alter table public.payment_sessions replica identity full;

-- =========================================================
-- TABLA: inventory_movements
-- Historial de entradas, salidas, ajustes y devoluciones.
-- =========================================================

create table if not exists public.inventory_movements (
    id uuid primary key default gen_random_uuid(),
    product_variant_id uuid not null,
    user_id uuid,
    sale_id uuid,
    movement_type varchar(40) not null,
    quantity integer not null,
    previous_stock integer not null,
    new_stock integer not null,
    reason varchar(255),
    created_at timestamptz not null default now(),

    constraint fk_inventory_movements_product_variant
        foreign key (product_variant_id)
        references public.product_variants(id)
        on update cascade
        on delete restrict,

    constraint fk_inventory_movements_user
        foreign key (user_id)
        references public.users(id)
        on update cascade
        on delete set null,

    constraint fk_inventory_movements_sale
        foreign key (sale_id)
        references public.sales(id)
        on update cascade
        on delete set null,

    constraint chk_inventory_movements_type
        check (
            movement_type in (
                'PURCHASE_IN',
                'SALE_OUT',
                'MANUAL_IN',
                'MANUAL_OUT',
                'ADJUSTMENT',
                'RETURN_IN',
                'CANCEL_SALE_IN'
            )
        ),

    constraint chk_inventory_movements_quantity_not_zero
        check (quantity <> 0),

    constraint chk_inventory_movements_previous_stock
        check (previous_stock >= 0),

    constraint chk_inventory_movements_new_stock
        check (new_stock >= 0)
);

create index if not exists idx_inventory_movements_product_variant_id
on public.inventory_movements(product_variant_id);

create index if not exists idx_inventory_movements_user_id
on public.inventory_movements(user_id);

create index if not exists idx_inventory_movements_sale_id
on public.inventory_movements(sale_id);

create index if not exists idx_inventory_movements_created_at
on public.inventory_movements(created_at);

-- =========================================================
-- TABLA: audit_logs
-- Auditoría de acciones importantes del sistema.
-- =========================================================

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid,
    action varchar(100) not null,
    entity_name varchar(100) not null,
    entity_id uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address varchar(60),
    user_agent text,
    created_at timestamptz not null default now(),

    constraint fk_audit_logs_user
        foreign key (user_id)
        references public.users(id)
        on update cascade
        on delete set null,

    constraint chk_audit_logs_action_not_empty
        check (length(trim(action)) > 0),

    constraint chk_audit_logs_entity_name_not_empty
        check (length(trim(entity_name)) > 0)
);

create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_entity_name on public.audit_logs(entity_name);
create index if not exists idx_audit_logs_entity_id on public.audit_logs(entity_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);

-- =========================================================
-- RLS - Row Level Security
-- Se habilita por seguridad. El backend operará con conexión segura.
-- =========================================================

alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_sessions enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

-- =========================================================
-- SUPABASE REALTIME
-- Agrega payment_sessions a la publicación realtime.
-- Si ya existe, ignora el error.
-- =========================================================

do $$
begin
    alter publication supabase_realtime add table public.payment_sessions;
exception
    when duplicate_object then
        null;
    when undefined_object then
        null;
end;
$$;

-- =========================================================
-- DATOS INICIALES
-- =========================================================

insert into public.roles (name, description)
values
    ('ADMIN', 'Administrador del sistema con acceso completo.'),
    ('SELLER', 'Vendedor encargado de registrar ventas.'),
    ('CASHIER', 'Cajero encargado de procesar pagos.')
on conflict (name) do nothing;

insert into public.categories (name, description)
values
    ('Poleras', 'Prendas superiores urbanas.'),
    ('Joggers', 'Pantalones jogger de estilo urbano.'),
    ('Casacas', 'Casacas y chaquetas urbanas.'),
    ('Accesorios', 'Accesorios complementarios para outfit urbano.')
on conflict (name) do nothing;

-- =========================================================
-- FIN DEL ESQUEMA INICIAL
-- =========================================================
