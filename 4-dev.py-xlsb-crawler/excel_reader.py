import xlwings as xw

def read_named_ranges(book, sheet_name):
    sht = book.sheets[sheet_name]
    return {
        "Topic": sht.range("Topic").value,
        "QuestSource": sht.range("QuestSource").value,
        "DataFlow": sht.range("DataFlow").value,
        "Frequency": sht.range("Frequency").value,
    }

def read_mapping_table(book, sheet_name, table_name):
    sht = book.sheets[sheet_name]
    tbl = sht.api.ListObjects(table_name)

    headers = [c.Value for c in tbl.HeaderRowRange]
    data = tbl.DataBodyRange.Value

    if not data:
        return [], []

    if not isinstance(data[0], (list, tuple)):
        data = [data]

    rows = [dict(zip(headers, row)) for row in data]
    return headers, rows
