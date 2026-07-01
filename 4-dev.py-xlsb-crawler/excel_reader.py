import xlwings as xw

DEFAULT_VALUES = {
  "PLANT_TECH": "_Z",
  "PLANT_TYPE": "_Z",
  "STOCKS": "_Z",
  "INFRASTRUCTURE_IND": "_Z",
  "VIS_A_VIS_AREA": "_Z",
  "FACILITY_ID": "_Z",
  "ISO_EXCLUSION": "y"
}


def read_named_ranges(book, sheet_name):
    sht = book.sheets[sheet_name]
    return {
        "QUEST": sht.range("Topic").value,
        "QUEST_SOURCE": sht.range("QuestSource").value,
        "DATAFLOW": sht.range("DataFlow").value,
        "FREQ": sht.range("Frequency").value,
    }

def read_mapping_table(book, sheet_name, table_name):
    sht = book.sheets[sheet_name]
    tbl = sht.api.ListObjects(table_name)

    headers = [c.Value for c in tbl.HeaderRowRange]
    data = tbl.DataBodyRange.Value

    if not data:
        return headers, []

    if not isinstance(data[0], (list, tuple)):
        data = [data]

    rows = []

    product_idx = headers.index("PRODUCT")

    for row in data:
        # Skip rows with empty PRODUCT
        if row[product_idx] in (None, ""):
            continue

        row_dict = {}

        for header, value in zip(headers, row):
            if value == "" and header in DEFAULT_VALUES:
                value = DEFAULT_VALUES[header]

            row_dict[header] = value

        rows.append(row_dict)

    return headers, rows
