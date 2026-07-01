from pathlib import Path
import json
import xlwings as xw
from excel_reader import read_named_ranges, read_mapping_table
from mapping_builder import build_mapping, write_csv

def main() -> None:
    # ── Locate config.json relative to this script ──────────────────────
    script_dir = Path(__file__).resolve().parent
    config_path = script_dir / "config.json"
    with config_path.open(encoding="utf-8") as f:
        cfg = json.load(f)

    # ── Resolve input / output directories relative to script_dir ───────
    input_dir = script_dir / cfg["input_dir"]
    output_dir = script_dir / cfg["output_dir"]
    output_dir.mkdir(parents=True, exist_ok=True)

    app = None
    all_param = []
    all_mapping = []
    expected_headers = None

    try:
        app = xw.App(visible=False)
        app.display_alerts = False
        app.screen_updating = False

        for file in cfg["files"]:
            file_path = input_dir / file.lstrip(r"/\\\\")
            # print(f"Opening file: {file_path}")

            try:
                wb = app.books.open(str(file_path), update_links=False, read_only=True)
                print(f"Successfully opened: {wb.name}")

                try:
                    p = read_named_ranges(wb, cfg["param_sheet"])
                    all_param.append(p)

                    current_headers, rows = read_mapping_table(
                        wb, cfg["map_sheet"], cfg["table_name"]
                    )

                    if expected_headers is None:
                        expected_headers = current_headers
                    elif current_headers != expected_headers:
                        raise RuntimeError(
                            f"Header mismatch in {file}\\n"
                            f"Expected:\\n{expected_headers}\\n"
                            f"Found:\\n{current_headers}"
                        )

                    all_mapping.append((file, rows))
                finally:
                    wb.close()
            except Exception as e:
                print(f"Failed to process {file_path}: {e}")

        # ── Write parameter CSV ────────────────────────────────────────
        param_path = output_dir / cfg["output_dataset"]
        write_csv(str(param_path), [ "QUEST", "QUEST_SOURCE", "DATAFLOW", "FREQ" ], all_param)

        # ── Write mapping and duplicate logs if headers were read ───────
        if expected_headers is not None:
            unique_rows, dup_log = build_mapping(all_mapping, expected_headers)
            print(f"Unique mapping rows: {len(unique_rows)}")
            print(f"Duplicate mapping rows: {len(dup_log)}")

            map_path = output_dir / cfg["output_mapping"]
            write_csv(str(map_path), expected_headers, unique_rows)

            dup_path = output_dir / cfg["output_duplicates"]
            write_csv(
                str(dup_path),
                ["key", "base_file", "other_file", "different_fields", "differences"],
                dup_log
            )
        else:
            print("No valid mapping tables were read; skipping mapping output.")
    finally:
        if app is not None:
            app.quit()


if __name__ == "__main__":
    main()
