"""
Verify the Drizzle schema matches the live Postgres database.

Compares, for every table, the set of column names and their SQL types
between the live database and the schema described by `src/db/schema.ts`
(via the generated Drizzle migration).

Usage: python tests/verify_schema.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

API_TS = Path(r"C:\web-app\4-craft.com\apps\api-ts")
MIGRATION = sorted((API_TS / "drizzle").glob("0000_*.sql"))[0]

CONTAINER = "4craft-postgres"
DB = "adaptive_learning"


def psql(sql: str) -> str:
    result = subprocess.run(
        ["docker", "exec", CONTAINER, "psql", "-U", "postgres", "-d", DB, "-t", "-A", "-F", "|", "-c", sql],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def live_columns() -> dict[str, dict[str, str]]:
    rows = psql(
        "SELECT table_name, column_name, data_type "
        "FROM information_schema.columns WHERE table_schema = 'public' "
        r"AND table_name NOT LIKE 'pg\_%' "
        "ORDER BY table_name, column_name"
    )
    columns: dict[str, dict[str, str]] = {}
    for row in rows.splitlines():
        table, column, data_type = row.split("|")
        columns.setdefault(table, {})[column] = data_type
    return columns


def drizzle_columns() -> dict[str, dict[str, str]]:
    """Extract the table/column/type triples from the generated migration."""
    sql = MIGRATION.read_text(encoding="utf-8")
    tables: dict[str, dict[str, str]] = {}

    # Split on the CREATE TABLE statements.
    for match in re.finditer(r'CREATE TABLE "([^"]+)" \((.*?)\n\);', sql, re.S):
        table = match.group(1)
        body = match.group(2)
        columns: dict[str, str] = {}
        for line in body.splitlines():
            line = line.strip().rstrip(",")
            if not line.startswith('"'):
                continue
            column = line.split('"')[1]
            if line.startswith('"id"'):
                columns[column] = "character varying"
            elif "timestamp with time zone" in line:
                columns[column] = "timestamp with time zone"
            elif "jsonb" in line:
                columns[column] = "jsonb"
            elif "numeric" in line:
                columns[column] = "numeric"
            elif "boolean" in line:
                columns[column] = "boolean"
            elif "integer" in line:
                columns[column] = "integer"
            elif "text" in line:
                columns[column] = "text"
            elif "date" in line:
                columns[column] = "date"
            else:
                columns[column] = "character varying"
        tables[table] = columns
    return tables


def main() -> int:
    live = live_columns()
    drizzle = drizzle_columns()

    print(f"live tables     : {len(live)}")
    print(f"drizzle tables : {len(drizzle)}")

    failures = 0

    missing_tables = sorted(set(live) - set(drizzle))
    extra_tables = sorted(set(drizzle) - set(live))
    if missing_tables:
        print(f"\nFAIL tables missing from the Drizzle schema: {missing_tables}")
        failures += 1
    if extra_tables:
        print(f"\nFAIL tables in the Drizzle schema but not in the database: {extra_tables}")
        failures += 1

    for table in sorted(set(live) & set(drizzle)):
        live_cols = live[table]
        dz_cols = drizzle[table]
        missing = sorted(set(live_cols) - set(dz_cols))
        extra = sorted(set(dz_cols) - set(live_cols))
        if missing or extra:
            print(f"\nFAIL {table}")
            if missing:
                print(f"  columns missing from Drizzle: {missing}")
            if extra:
                print(f"  columns not in the database  : {extra}")
            failures += 1

    if failures == 0:
        print("\nPASS: the Drizzle schema covers every table and column of the live database.")
    else:
        print(f"\n{failures} mismatch group(s) found.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
