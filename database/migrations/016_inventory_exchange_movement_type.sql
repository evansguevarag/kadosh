alter table public.inventory_movements
drop constraint if exists chk_inventory_movements_type;

alter table public.inventory_movements
add constraint chk_inventory_movements_type
check (
    movement_type in (
        'ENTRADA',
        'SALIDA',
        'AJUSTE',
        'VENTA',
        'DEVOLUCION',
        'CAMBIO_SALIDA'
    )
);
