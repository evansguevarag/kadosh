from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal


def get_columns(db: Session, table_name: str) -> set[str]:
    result = db.execute(
        text(
            """
            select column_name
            from information_schema.columns
            where table_schema = 'public'
              and table_name = :table_name
            """
        ),
        {"table_name": table_name},
    )

    return {str(row[0]) for row in result.all()}


def get_id_by_column(
    db: Session,
    table_name: str,
    column_name: str,
    value: Any,
) -> str | None:
    columns = get_columns(db, table_name)

    if column_name not in columns:
        return None

    result = db.execute(
        text(
            f"""
            select id
            from {table_name}
            where {column_name} = :value
            limit 1
            """
        ),
        {"value": value},
    ).first()

    if result is None:
        return None

    return str(result[0])


def insert_row(db: Session, table_name: str, data: dict[str, Any]) -> str:
    columns = get_columns(db, table_name)
    filtered_data = {
        key: value
        for key, value in data.items()
        if key in columns and value is not None
    }

    if not filtered_data:
        raise RuntimeError(f"No hay columnas válidas para insertar en {table_name}.")

    column_names = ", ".join(filtered_data.keys())
    value_names = ", ".join(f":{key}" for key in filtered_data.keys())

    result = db.execute(
        text(
            f"""
            insert into {table_name} ({column_names})
            values ({value_names})
            returning id
            """
        ),
        filtered_data,
    ).first()

    if result is None:
        raise RuntimeError(f"No se pudo insertar en {table_name}.")

    return str(result[0])


def get_or_create(
    db: Session,
    table_name: str,
    lookup_column: str,
    lookup_value: Any,
    data: dict[str, Any],
) -> str:
    existing_id = get_id_by_column(
        db,
        table_name=table_name,
        column_name=lookup_column,
        value=lookup_value,
    )

    if existing_id:
        return existing_id

    return insert_row(db, table_name, data)


def seed_categories(db: Session) -> dict[str, str]:
    categories = [
        {
            "name": "Poleras",
            "description": "Poleras urbanas oversize y streetwear.",
            "is_active": True,
        },
        {
            "name": "Joggers",
            "description": "Joggers urbanos para hombre y mujer.",
            "is_active": True,
        },
        {
            "name": "Casacas",
            "description": "Casacas urbanas y cortavientos.",
            "is_active": True,
        },
        {
            "name": "Accesorios",
            "description": "Gorras, correas, bolsos y accesorios.",
            "is_active": True,
        },
    ]

    category_ids: dict[str, str] = {}

    for category in categories:
        category_id = get_or_create(
            db,
            table_name="categories",
            lookup_column="name",
            lookup_value=category["name"],
            data=category,
        )
        category_ids[category["name"]] = category_id

    return category_ids


def seed_products_and_variants(db: Session, category_ids: dict[str, str]) -> None:
    products = [
        {
            "category": "Poleras",
            "name": "Polera Oversize Black",
            "description": "Polera oversize color negro, algodón premium.",
            "brand": "Kadosh",
            "model": "Oversize",
            "variants": [
                ("POL-OVER-BLK-S", "S", "Negro", "779001001", Decimal("39.90"), Decimal("79.90"), 12),
                ("POL-OVER-BLK-M", "M", "Negro", "779001002", Decimal("39.90"), Decimal("79.90"), 15),
                ("POL-OVER-BLK-L", "L", "Negro", "779001003", Decimal("39.90"), Decimal("79.90"), 10),
            ],
        },
        {
            "category": "Poleras",
            "name": "Polera Oversize White",
            "description": "Polera oversize color blanco, estilo urbano.",
            "brand": "Kadosh",
            "model": "Oversize",
            "variants": [
                ("POL-OVER-WHT-S", "S", "Blanco", "779001004", Decimal("38.00"), Decimal("74.90"), 8),
                ("POL-OVER-WHT-M", "M", "Blanco", "779001005", Decimal("38.00"), Decimal("74.90"), 14),
                ("POL-OVER-WHT-L", "L", "Blanco", "779001006", Decimal("38.00"), Decimal("74.90"), 9),
            ],
        },
        {
            "category": "Joggers",
            "name": "Jogger Cargo Urban",
            "description": "Jogger cargo urbano con bolsillos laterales.",
            "brand": "Kadosh",
            "model": "Cargo",
            "variants": [
                ("JOG-CAR-GRY-M", "M", "Gris", "779002001", Decimal("55.00"), Decimal("119.90"), 10),
                ("JOG-CAR-GRY-L", "L", "Gris", "779002002", Decimal("55.00"), Decimal("119.90"), 7),
                ("JOG-CAR-BLK-M", "M", "Negro", "779002003", Decimal("57.00"), Decimal("124.90"), 11),
            ],
        },
        {
            "category": "Casacas",
            "name": "Casaca Cortaviento Street",
            "description": "Casaca cortaviento urbana resistente y ligera.",
            "brand": "Kadosh",
            "model": "Street",
            "variants": [
                ("CAS-STR-BLK-M", "M", "Negro", "779003001", Decimal("85.00"), Decimal("179.90"), 6),
                ("CAS-STR-BLK-L", "L", "Negro", "779003002", Decimal("85.00"), Decimal("179.90"), 5),
                ("CAS-STR-BLU-M", "M", "Azul", "779003003", Decimal("82.00"), Decimal("169.90"), 4),
            ],
        },
        {
            "category": "Accesorios",
            "name": "Gorra Kadosh Classic",
            "description": "Gorra urbana ajustable con logo Kadosh.",
            "brand": "Kadosh",
            "model": "Classic",
            "variants": [
                ("GOR-KAD-BLK-U", "U", "Negro", "779004001", Decimal("18.00"), Decimal("39.90"), 20),
                ("GOR-KAD-WHT-U", "U", "Blanco", "779004002", Decimal("18.00"), Decimal("39.90"), 18),
            ],
        },
    ]

    for product in products:
        product_id = get_or_create(
            db,
            table_name="products",
            lookup_column="name",
            lookup_value=product["name"],
            data={
                "category_id": category_ids[product["category"]],
                "name": product["name"],
                "description": product["description"],
                "brand": product["brand"],
                "model": product["model"],
                "is_active": True,
            },
        )

        for sku, size, color, barcode, cost_price, sale_price, stock in product["variants"]:
            existing_variant_id = get_id_by_column(
                db,
                table_name="product_variants",
                column_name="sku",
                value=sku,
            )

            if existing_variant_id:
                continue

            insert_row(
                db,
                table_name="product_variants",
                data={
                    "product_id": product_id,
                    "sku": sku,
                    "size": size,
                    "color": color,
                    "barcode": barcode,
                    "cost_price": cost_price,
                    "sale_price": sale_price,
                    "stock": stock,
                    "stock_quantity": stock,
                    "current_stock": stock,
                    "min_stock": 3,
                    "min_stock_quantity": 3,
                    "minimum_stock": 3,
                    "is_active": True,
                },
            )


def seed_customers(db: Session) -> None:
    customers = [
        {
            "document_type": "DNI",
            "document_number": "70000001",
            "first_name": "Carlos",
            "last_name": "Ramirez",
            "full_name": "Carlos Ramirez",
            "phone": "900111222",
            "email": "carlos.ramirez@example.com",
            "address": "Lima Norte",
            "is_active": True,
        },
        {
            "document_type": "DNI",
            "document_number": "70000002",
            "first_name": "Andrea",
            "last_name": "Torres",
            "full_name": "Andrea Torres",
            "phone": "900333444",
            "email": "andrea.torres@example.com",
            "address": "Los Olivos",
            "is_active": True,
        },
        {
            "document_type": "DNI",
            "document_number": "70000003",
            "first_name": "Luis",
            "last_name": "Fernandez",
            "full_name": "Luis Fernandez",
            "phone": "900555666",
            "email": "luis.fernandez@example.com",
            "address": "Comas",
            "is_active": True,
        },
        {
            "document_type": "DNI",
            "document_number": "70000004",
            "first_name": "Valeria",
            "last_name": "Mendoza",
            "full_name": "Valeria Mendoza",
            "phone": "900777888",
            "email": "valeria.mendoza@example.com",
            "address": "Puente Piedra",
            "is_active": True,
        },
    ]

    for customer in customers:
        get_or_create(
            db,
            table_name="customers",
            lookup_column="document_number",
            lookup_value=customer["document_number"],
            data=customer,
        )


def main() -> None:
    db = SessionLocal()

    try:
        category_ids = seed_categories(db)
        seed_products_and_variants(db, category_ids)
        seed_customers(db)

        db.commit()

        print("Datos demo insertados correctamente.")
        print("Incluye clientes, categorías, productos y variantes con stock.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
