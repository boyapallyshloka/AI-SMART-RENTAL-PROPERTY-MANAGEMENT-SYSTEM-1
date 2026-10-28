
from database import get_connection

with get_connection() as conn:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                current_database() AS database_name,
                current_user AS database_user,
                current_schema() AS current_schema,
                inet_server_addr()::text AS server_address,
                current_setting('search_path') AS search_path
        """)
        print("Connection identity:", cur.fetchone())

        cur.execute("""
            SELECT COUNT(*) AS preference_rows
            FROM tenant_preferences
            WHERE tenant_id = 32
        """)
        print("Tenant 32 preferences:", cur.fetchone())

        cur.execute("""
            SELECT property_id, status
            FROM properties
            WHERE property_id = 14
        """)
        print("Property 14:", cur.fetchone())
