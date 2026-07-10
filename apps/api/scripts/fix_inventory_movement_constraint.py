from sqlalchemy import text

from app.db.session import SessionLocal


def main() -> None:
    db = SessionLocal()

    try:
        db.execute(
            text(
                """
                alter table inventory_movements
                drop constraint if exists chk_inventory_movements_type
                """
            )
        )

        db.execute(
            text(
                """
                alter table inventory_movements
                add constraint chk_inventory_movements_type
                check (
                    movement_type in (
                        'ENTRADA',
                        'SALIDA',
                        'AJUSTE',
                        'VENTA',
                        'DEVOLUCION'
                    )
                )
                """
            )
        )

        db.commit()
        print("Constraint chk_inventory_movements_type corregido correctamente.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
