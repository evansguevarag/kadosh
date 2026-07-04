from sqlalchemy import create_engine, text
from app.core.config import settings
from urllib.parse import urlsplit, urlunsplit

database_url = settings.supabase_database_url

parsed = urlsplit(database_url)
safe_netloc = parsed.netloc

if "@" in safe_netloc and ":" in safe_netloc.split("@")[0]:
    user_part, host_part = safe_netloc.split("@", 1)
    username = user_part.split(":", 1)[0]
    safe_netloc = f"{username}:********@{host_part}"

safe_url = urlunsplit((parsed.scheme, safe_netloc, parsed.path, parsed.query, parsed.fragment))

print("URL usada por FastAPI:")
print(safe_url)
print()

try:
    engine = create_engine(database_url, pool_pre_ping=True)
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1 AS ok"))
        print("Conexion correcta:")
        print(result.fetchone())
except Exception as exc:
    print("ERROR REAL:")
    print(type(exc).__name__)
    print(str(exc))
