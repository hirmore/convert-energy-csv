import { parseCsv, arrayToIndex, getField } from "./csv.js";

export function parseProductFlowsMappingCsv(csvText) {
	const rows = parseCsv(csvText, ",");
	if (rows.length < 2) return null;

	const header = rows[0].map((h) => h.trim().toUpperCase());

	const headerIndex = {};
	header.forEach((cell, index) => {
		headerIndex[cell] = index;
	});

	const map = { rows: [] };
	for (let i = 1; i < rows.length; i += 1) {
		const row = rows[i];
		if (row.every((cell) => !cell.trim())) continue;

		const item = {
			datatype: (row[headerIndex["DATATYPE"]] || "").trim(),
			product: (row[headerIndex["PRODUCT"]] || "").trim(),
			item1: (row[headerIndex["ITEM1"]] || "").trim(),
			item2: (row[headerIndex["ITEM2"]] || "").trim(),
			energyProduct: (row[headerIndex["ENERGY_PRODUCT"]] || "").trim(),
			mainFlow: (row[headerIndex["MAIN_FLOW"]] || "").trim(),
			flowBreakdown: (row[headerIndex["FLOW_BREAKDOWN"]] || "").trim(),
			plantType: (row[headerIndex["PLANT_TYPE"]] || "").trim(),
			stocks: (row[headerIndex["STOCKS"]] || "").trim(),
			visAVisArea: (row[headerIndex["VIS_A_VIS_AREA"]] || "").trim(),
			measureValueType: (row[headerIndex["MEASURE_VALUE_TYPE"]] || "").trim(),
			unitMeasure: (row[headerIndex["UNIT_MEASURE"]] || "").trim(),
		};
		map.rows.push(item);
	}

	return map;
}

export function parseDataSetMappingCsv(csvText) {
	const rows = parseCsv(csvText, ",");
	if (rows.length < 2) return null;
	const header = rows[0].map((h) => h.trim().toUpperCase());
	const idx = arrayToIndex(header);
	const map = {};
	for (let i = 1; i < rows.length; i += 1) {
		const row = rows[i];
		if (row.every((cell) => !cell.trim())) continue;
		const key = getField(row, idx, "QUEST");
		const questSource = getField(row, idx, "QUEST_SOURCE");
		const dataflow = getField(row, idx, "DATAFLOW");
		const freq = getField(row, idx, "FREQ");
		if (key && questSource) {
			map[key] = {
				QUEST_SOURCE: questSource.trim(),
				DATAFLOW: dataflow.trim(),
				FREQ: freq.trim(),
			};
		}
	}
	return map;
}

export function buildSdmxToEvoMap(rows) {
	const map = {};
	rows.forEach((item) => {
		const key = buildSdmxKey([
			item.energyProduct,
			item.mainFlow,
			item.flowBreakdown,
			item.plantType,
			item.stocks,
			item.visAVisArea,
			item.measureValueType,
			item.unitMeasure,
		]);
		map[key] = item;
	});
	return map;
}

export function buildEvoToSdmxMap(rows) {
	const map = {};
	rows.forEach((item) => {
		const key = buildEvoKey([
			item.datatype,
			item.product,
			item.item1,
			item.item2,
		]);
		map[key] = item;
	});
	return map;
}

export function buildSdmxKey(...values) {
	const items =
		values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
	return items.map((v) => String(v ?? "").trim()).join("|");
}

export function buildEvoKey(...values) {
	const items =
		values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
	return items.map((v) => String(v ?? "").trim()).join("|");
}
