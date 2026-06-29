from collections import Counter
import csv
from pathlib import Path

INPUT_FILE = Path("./output/Mapping_ISO_SDMX.csv")
OUTPUT_FILE = Path("./output/Mapping_ISO_SDMX_duplicates.csv")

KEY_FIELDS = ["DATATYPE", "PRODUCT", "ITEM1", "ITEM2"]


def main():
    # Read input
    with INPUT_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        if fieldnames is None:
            raise ValueError("Input CSV has no header.")

        missing = [c for c in KEY_FIELDS if c not in fieldnames]
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(missing)}")

        rows = list(reader)

    # Count key occurrences
    key_counts = Counter(
        tuple(row[field].strip() for field in KEY_FIELDS)
        for row in rows
    )

    duplicate_keys = {k for k, count in key_counts.items() if count > 1}

    if not duplicate_keys:
        print("No duplicate keys found.")
        return

    # Write duplicates
    with OUTPUT_FILE.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)

        writer.writerow(["DUPLICATE_KEY", *fieldnames])

        duplicate_row_count = 0
        for row in rows:
            key = tuple(row[field].strip() for field in KEY_FIELDS)
            if key in duplicate_keys:
                writer.writerow([" | ".join(key), *[row[col] for col in fieldnames]])
                duplicate_row_count += 1

    print(f"Duplicate keys found: {len(duplicate_keys)}")
    print(f"Duplicate rows written: {duplicate_row_count}")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()