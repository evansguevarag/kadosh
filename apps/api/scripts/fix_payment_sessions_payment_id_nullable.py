from sqlalchemy import text

from app.db.session import SessionLocal


def main() -> None:
    db = SessionLocal()

    try:
        db.execute(
            text(
                """
                alter table payment_sessions
                alter column payment_id drop not null
                """
            )
        )

        db.commit()
        print("payment_sessions.payment_id ahora permite NULL correctamente.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
