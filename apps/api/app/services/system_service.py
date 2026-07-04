from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal


def get_database_status() -> dict[str, object]:
    required_tables = [
        "roles",
        "users",
        "customers",
        "categories",
        "products",
        "product_variants",
        "sales",
        "sale_items",
        "payments",
        "payment_sessions",
        "inventory_movements",
        "audit_logs",
    ]

    with SessionLocal() as db:
        existing_tables = _get_existing_tables(db, required_tables)
        roles_count = _count_table_rows(db, "roles")
        categories_count = _count_table_rows(db, "categories")

        missing_tables = [
            table_name
            for table_name in required_tables
            if table_name not in existing_tables
        ]

        return {
            "database": "connected",
            "schema": "ready" if not missing_tables else "incomplete",
            "required_tables": len(required_tables),
            "existing_tables": len(existing_tables),
            "missing_tables": missing_tables,
            "roles_count": roles_count,
            "categories_count": categories_count,
        }


def _get_existing_tables(db: Session, table_names: list[str]) -> set[str]:
    query = text(
        """
        select table_name
        from information_schema.tables
        where table_schema = 'public'
        and table_name = any(:table_names)
        """
    )

    result = db.execute(query, {"table_names": table_names})

    return {row.table_name for row in result}


def _count_table_rows(db: Session, table_name: str) -> int:
    allowed_tables = {"roles", "categories"}

    if table_name not in allowed_tables:
        raise ValueError("Table is not allowed for counting.")

    query = text(f"select count(*) as total from public.{table_name}")
    result = db.execute(query).one()

    return int(result.total)
