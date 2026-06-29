import csv
from collections import defaultdict

SDMX_KEY_FIELDS = [
    "ENERGY_PRODUCT",
    "MAIN_FLOW",
    "FLOW_BREAKDOWN",
    "PLANT_TYPE",
    "STOCKS",
    "VIS_A_VIS_AREA",
    "MEASURE_VALUE_TYPE",
    "UNIT_MEASURE"
]

def row_key_all(row, headers):
    return tuple(row.get(h) for h in headers)

def row_key_sdmx(row):
    return tuple(row.get(k) for k in SDMX_KEY_FIELDS)

def write_csv(path, headers, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        w.writerows(rows)

def build_param(records):
    return [records]

def build_mapping(all_rows, headers):
    unique = {}
    dup_log = []

    sdmx_seen = defaultdict(list)

    for file_name, rows in all_rows:
        for r in rows:
            k_all = tuple(r.get(h) for h in headers)

            if k_all not in unique:
                unique[k_all] = r

            k_sdmx = row_key_sdmx(r)
            sdmx_seen[k_sdmx].append((file_name, r))

    for k, items in sdmx_seen.items():
        if len(items) > 1:
            for file_name, r in items:
                dup_log.append({
                    "file": file_name,
                    "sdmx_key": k,
                    "row": r
                })

    return list(unique.values()), dup_log
