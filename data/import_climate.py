"""
import_climate.py
Creates the climate_impact table (if not exists) and imports
climate_change_impact_on_agriculture_2024.csv into MySQL.
"""

import csv
import sys

CSV_PATH = r"C:\Users\Lavanya\.gemini\antigravity\scratch\crop_recommendation_system\data\extracted\climate\climate_change_impact_on_agriculture_2024.csv"

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "Lavanya@123",
    "database": "crop_recommendation_db",
}

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS `climate_impact` (
  `id` int NOT NULL AUTO_INCREMENT,
  `year` int DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `region` varchar(150) DEFAULT NULL,
  `crop_type` varchar(100) DEFAULT NULL,
  `avg_temperature_c` decimal(8,2) DEFAULT NULL,
  `total_precipitation_mm` decimal(10,2) DEFAULT NULL,
  `co2_emissions_mt` decimal(10,2) DEFAULT NULL,
  `crop_yield_mt_ha` decimal(10,4) DEFAULT NULL,
  `extreme_weather_events` int DEFAULT NULL,
  `irrigation_access_pct` decimal(6,2) DEFAULT NULL,
  `pesticide_use_kg_ha` decimal(10,4) DEFAULT NULL,
  `fertilizer_use_kg_ha` decimal(10,4) DEFAULT NULL,
  `soil_health_index` decimal(6,4) DEFAULT NULL,
  `adaptation_strategies` varchar(255) DEFAULT NULL,
  `economic_impact_million_usd` decimal(12,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_region` (`region`),
  KEY `idx_crop_type` (`crop_type`),
  KEY `idx_year` (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

COLUMN_MAP = {
    "Year": "year",
    "Country": "country",
    "Region": "region",
    "Crop_Type": "crop_type",
    "Average_Temperature_C": "avg_temperature_c",
    "Total_Precipitation_mm": "total_precipitation_mm",
    "CO2_Emissions_MT": "co2_emissions_mt",
    "Crop_Yield_MT_per_HA": "crop_yield_mt_ha",
    "Extreme_Weather_Events": "extreme_weather_events",
    "Irrigation_Access_%": "irrigation_access_pct",
    "Pesticide_Use_KG_per_HA": "pesticide_use_kg_ha",
    "Fertilizer_Use_KG_per_HA": "fertilizer_use_kg_ha",
    "Soil_Health_Index": "soil_health_index",
    "Adaptation_Strategies": "adaptation_strategies",
    "Economic_Impact_Million_USD": "economic_impact_million_usd",
}

DB_COLUMNS = list(COLUMN_MAP.values())

INSERT_SQL = (
    "INSERT INTO climate_impact ("
    + ", ".join(f"`{c}`" for c in DB_COLUMNS)
    + ") VALUES ("
    + ", ".join(["%s"] * len(DB_COLUMNS))
    + ")"
)

BATCH_SIZE = 500


def coerce(value):
    """Return None for empty strings, otherwise the stripped value."""
    v = value.strip()
    return None if v == "" else v


def main():
    try:
        import mysql.connector
    except ImportError:
        print("ERROR: mysql-connector-python not installed.", file=sys.stderr)
        print("Run: pip install mysql-connector-python", file=sys.stderr)
        sys.exit(1)

    print("Connecting to MySQL …")
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    # Step 1: Create table if not exists
    print("Creating table climate_impact (if not exists) …")
    cursor.execute(CREATE_TABLE_SQL)
    conn.commit()
    print("Table ready.")

    # Step 2: Clear existing data to avoid duplicates on re-run
    cursor.execute("DELETE FROM climate_impact")
    conn.commit()
    print("Existing rows cleared.")

    # Step 3: Read CSV and insert in batches
    print(f"Reading CSV: {CSV_PATH}")
    total_inserted = 0
    batch = []

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        # Show detected headers for verification
        print(f"CSV headers detected: {reader.fieldnames}")
        for row in reader:
            record = tuple(
                coerce(row.get(csv_col, ""))
                for csv_col in COLUMN_MAP.keys()
            )
            batch.append(record)

            if len(batch) >= BATCH_SIZE:
                cursor.executemany(INSERT_SQL, batch)
                conn.commit()
                total_inserted += len(batch)
                print(f"  Inserted {total_inserted} rows so far …")
                batch = []

    # Insert any remaining rows
    if batch:
        cursor.executemany(INSERT_SQL, batch)
        conn.commit()
        total_inserted += len(batch)

    cursor.close()
    conn.close()

    print(f"\n✅ Import complete. Total rows inserted: {total_inserted}")

    # Step 4: Verification
    verify_conn = mysql.connector.connect(**DB_CONFIG)
    vcur = verify_conn.cursor()
    vcur.execute("SELECT COUNT(*) FROM climate_impact")
    count = vcur.fetchone()[0]
    vcur.close()
    verify_conn.close()
    print(f"✅ Verification — COUNT(*) FROM climate_impact: {count}")
    if count == 10000:
        print("✅ All 10,000 rows confirmed in database.")
    else:
        print(f"⚠️  Expected 10000, got {count}. Check CSV row count.")


if __name__ == "__main__":
    main()

