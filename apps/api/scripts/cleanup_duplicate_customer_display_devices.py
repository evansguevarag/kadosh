from sqlalchemy import text

from app.db.session import SessionLocal


def main() -> None:
    db = SessionLocal()

    try:
        db.execute(
            text(
                """
                with ranked_devices as (
                    select
                        id,
                        row_number() over (
                            partition by lower(trim(device_name))
                            order by created_at desc
                        ) as rn
                    from customer_display_devices
                )
                update customer_display_devices d
                set
                    is_active = false,
                    updated_at = now()
                from ranked_devices r
                where d.id = r.id
                  and r.rn > 1
                """
            )
        )

        db.commit()
        print("Tablets duplicadas desactivadas correctamente.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
