import csv
from collections import defaultdict

ISO_KEY_FIELDS = [
    "DATATYPE",
    "PRODUCT",
    "ITEM1",
    "ITEM2"
]

def row_key_all(row, headers):
    return tuple(row.get(h) for h in headers)

def row_key_iso(row):
    return tuple(row.get(k) for k in ISO_KEY_FIELDS)

def write_csv(path, headers, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        w.writerows(rows)

def build_param(records):
    return [records]
def diff_rows(row1, row2):
    return {
        key: (row1.get(key), row2.get(key))
        for key in row1.keys()
        if row1.get(key) != row2.get(key)
    }

def build_mapping(all_rows, headers):
    unique = {}
    dup_log = []

    # STEP 1: strict uniqueness across ALL columns
    for file_name, rows in all_rows:
        for r in rows:
            k_all = row_key_all(r, headers)

            if k_all not in unique:
                unique[k_all] = {
                    "file": file_name,
                    "row": r
                }

    # STEP 2: validation pass over uniques only
    iso_index = defaultdict(list)

    for k_all, payload in unique.items():
        iso_index[row_key_iso(payload["row"])].append(payload)

    for k_iso, items in iso_index.items():
        if len(items) <= 1:
            continue

        # Compare all rows against the first one
        base = items[0]

        for other in items[1:]:
            diffs = diff_rows(base["row"], other["row"])

            dup_log.append({
                "key": k_iso,
                "base_file": base["file"],
                "other_file": other["file"],
                "different_fields": ", ".join(diffs.keys()),
                "differences": diffs,
            })
    return [v["row"] for v in unique.values()], dup_log