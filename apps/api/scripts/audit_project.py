from pathlib import Path
from sqlalchemy import text

from app.db.session import SessionLocal

ROOT = Path(r"C:\Users\JAIME Y BRISSA\kadosh-pos")
OUTPUT = ROOT / "KADOSH_PROJECT_AUDIT.txt"

FILES_TO_INCLUDE = [
    ROOT / "apps/api/app/db/session.py",
    ROOT / "apps/api/app/main.py",
    ROOT / "apps/api/app/api/v1/router.py",
    ROOT / "apps/api/app/api/v1/endpoints/payment_sessions.py",
    ROOT / "apps/api/app/api/v1/endpoints/customer_display.py",
    ROOT / "apps/api/app/api/v1/endpoints/customer_display_devices.py",
    ROOT / "apps/api/app/api/v1/endpoints/sales.py",
    ROOT / "apps/api/app/services/payment_session_service.py",
    ROOT / "apps/api/app/services/customer_display_device_service.py",
    ROOT / "apps/api/app/services/sale_service.py",
    ROOT / "apps/web/.env.local",
    ROOT / "apps/web/src/app/pos/page.tsx",
    ROOT / "apps/web/src/app/customer-display/page.tsx",
    ROOT / "apps/web/src/app/customer-displays/page.tsx",
    ROOT / "apps/web/src/features/payments/customer-display-device-service.ts",
    ROOT / "apps/web/src/features/payments/customer-display-service.ts",
    ROOT / "apps/web/src/features/payments/culqi-service.ts",
    ROOT / "apps/web/src/services/api-client.ts",
]

SECRET_WORDS = [
    "JWT_SECRET_KEY",
    "SUPABASE_DATABASE_URL",
    "CULQI_SECRET_KEY",
    "APIPERU_TOKEN",
    "PASSWORD",
    "TOKEN",
    "SECRET",
]


def safe_line(line: str) -> str:
    upper = line.upper()

    if any(word in upper for word in SECRET_WORDS):
        if "=" in line:
            key = line.split("=", 1)[0]
            return f"{key}=***OCULTO***\n"

        if ":" in line:
            key = line.split(":", 1)[0]
            return f"{key}: ***OCULTO***\n"

    return line


def write_section(handle, title: str) -> None:
    handle.write("\n")
    handle.write("=" * 90 + "\n")
    handle.write(title + "\n")
    handle.write("=" * 90 + "\n")


def audit_database(handle) -> None:
    db = SessionLocal()

    try:
        write_section(handle, "1. TABLAS DE LA BASE DE DATOS")

        tables = db.execute(
            text(
                """
                select table_name
                from information_schema.tables
                where table_schema = 'public'
                  and table_type = 'BASE TABLE'
                order by table_name
                """
            )
        ).all()

        for table in tables:
            table_name = table[0]
            handle.write(f"\n--- TABLE: {table_name} ---\n")

            columns = db.execute(
                text(
                    """
                    select
                        column_name,
                        data_type,
                        is_nullable,
                        column_default
                    from information_schema.columns
                    where table_schema = 'public'
                      and table_name = :table_name
                    order by ordinal_position
                    """
                ),
                {"table_name": table_name},
            ).all()

            for column in columns:
                handle.write(
                    f"{column[0]} | {column[1]} | nullable={column[2]} | default={column[3]}\n"
                )

        write_section(handle, "2. CONSTRAINTS")

        constraints = db.execute(
            text(
                """
                select
                    tc.table_name,
                    tc.constraint_name,
                    tc.constraint_type,
                    coalesce(cc.check_clause, '') as check_clause
                from information_schema.table_constraints tc
                left join information_schema.check_constraints cc
                  on cc.constraint_name = tc.constraint_name
                where tc.table_schema = 'public'
                order by tc.table_name, tc.constraint_type, tc.constraint_name
                """
            )
        ).all()

        for constraint in constraints:
            handle.write(
                f"{constraint[0]} | {constraint[1]} | {constraint[2]} | {constraint[3]}\n"
            )

        write_section(handle, "3. ÍNDICES")

        indexes = db.execute(
            text(
                """
                select
                    tablename,
                    indexname,
                    indexdef
                from pg_indexes
                where schemaname = 'public'
                order by tablename, indexname
                """
            )
        ).all()

        for index in indexes:
            handle.write(f"{index[0]} | {index[1]} | {index[2]}\n")

        write_section(handle, "4. CONTEO DE REGISTROS")

        for table in tables:
            table_name = table[0]

            try:
                count = db.execute(text(f'select count(*) from "{table_name}"')).scalar_one()
                handle.write(f"{table_name}: {count}\n")
            except Exception as exc:
                handle.write(f"{table_name}: ERROR {exc}\n")

        write_section(handle, "5. TABLETS VINCULADAS")

        try:
            devices = db.execute(
                text(
                    """
                    select id, device_name, is_active, last_seen_at, created_at
                    from customer_display_devices
                    order by created_at desc
                    """
                )
            ).all()

            for device in devices:
                handle.write(
                    f"id={device[0]} | name={device[1]} | active={device[2]} | last_seen={device[3]} | created={device[4]}\n"
                )
        except Exception as exc:
            handle.write(f"No se pudo leer customer_display_devices: {exc}\n")

        write_section(handle, "6. PRODUCTOS Y VARIANTES ACTIVAS")

        try:
            variants = db.execute(
                text(
                    """
                    select
                        p.name,
                        pv.sku,
                        pv.size,
                        pv.color,
                        pv.stock,
                        pv.is_active
                    from product_variants pv
                    join products p on p.id = pv.product_id
                    order by p.name, pv.sku
                    """
                )
            ).all()

            for variant in variants:
                handle.write(
                    f"product={variant[0]} | sku={variant[1]} | size={variant[2]} | color={variant[3]} | stock={variant[4]} | active={variant[5]}\n"
                )
        except Exception as exc:
            handle.write(f"No se pudo leer variantes: {exc}\n")

    finally:
        db.close()


def audit_files(handle) -> None:
    write_section(handle, "7. ARCHIVOS CLAVE DEL PROYECTO")

    for file_path in FILES_TO_INCLUDE:
        handle.write("\n")
        handle.write("-" * 90 + "\n")
        handle.write(str(file_path) + "\n")
        handle.write("-" * 90 + "\n")

        if not file_path.exists():
            handle.write("NO EXISTE\n")
            continue

        try:
            lines = file_path.read_text(encoding="utf-8").splitlines(keepends=True)

            for index, line in enumerate(lines, start=1):
                handle.write(f"{index:04d}: {safe_line(line)}")
        except Exception as exc:
            handle.write(f"ERROR LEYENDO ARCHIVO: {exc}\n")


def main() -> None:
    with OUTPUT.open("w", encoding="utf-8") as handle:
        handle.write("KADOSH POS - AUDITORÍA TÉCNICA DEL PROYECTO\n")
        handle.write("Este archivo oculta valores sensibles básicos.\n")

        audit_database(handle)
        audit_files(handle)

    print(f"Auditoría generada correctamente en: {OUTPUT}")


if __name__ == "__main__":
    main()
