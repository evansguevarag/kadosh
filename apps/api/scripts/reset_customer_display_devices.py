from sqlalchemy import text

from app.db.session import SessionLocal


def main() -> None:
    db = SessionLocal()

    try:
        db.execute(text("delete from payment_sessions"))
        db.execute(text("delete from customer_display_pairing_codes"))
        db.execute(text("delete from customer_display_devices"))

        db.commit()

        print("Limpieza completada correctamente.")
        print("Se eliminaron sesiones de pago, códigos de vinculación y tablets.")
        print("Ahora puedes crear la primera tablet desde cero.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
