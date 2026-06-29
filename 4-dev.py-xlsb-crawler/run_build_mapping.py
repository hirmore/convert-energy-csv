import json
import os
import xlwings as xw

from excel_reader import read_named_ranges, read_mapping_table
from mapping_builder import build_mapping, write_csv

def main():
    with open("config.json") as f:
        cfg = json.load(f)

    os.makedirs(cfg["output_dir"], exist_ok=True)

    app = xw.App(visible=False)
    all_param = []
    all_mapping = []
    headers = None
    expected_headers = headers

    try:
        for file in cfg["files"]:
            wb = app.books.open(file)

            try:
                p = read_named_ranges(wb, cfg["param_sheet"])
                all_param.append(p)

                h, rows = read_mapping_table(wb, cfg["map_sheet"], cfg["table_name"])
                headers = headers or h
                if expected_headers is None:
                    expected_headers = headers
                if headers != expected_headers:
                    raise RuntimeError(
                        f"{file}\n"
                        f"Expected:\n{expected_headers}\n"
                        f"Found:\n{headers}"
                    )

                all_mapping.append((file, rows))
            finally:
                wb.close()

        # Param output (simple concat)
        param_path = os.path.join(cfg["output_dir"], cfg["output_dataset"])
        write_csv(param_path, ["Topic", "QuestSource", "DataFlow", "Frequency"], all_param)

        # Mapping + duplicates
        unique_rows, dup_log = build_mapping(all_mapping, headers)

        map_path = os.path.join(cfg["output_dir"], cfg["output_mapping"])
        write_csv(map_path, headers, unique_rows)

        dup_path = os.path.join(cfg["output_dir"], cfg["output_duplicates"])
        write_csv(dup_path, ["file", "sdmx_key", "row"], dup_log)

    finally:
        app.quit()

if __name__ == "__main__":
    main()
