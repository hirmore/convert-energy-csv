const inputFileInput = document.getElementById("inputFile");
const convertButton = document.getElementById("convertButton");
const versionInfo = document.getElementById("versionInfo");
const mappingStatus = document.getElementById("mappingStatus");
const inputStatus = document.getElementById("inputStatus");
const resultStatus = document.getElementById("resultStatus");
const outputText = document.getElementById("outputText");
const downloadButton = document.getElementById("downloadButton");

let downloadBlob = null;
let downloadFileName = "converted.csv";

let dateMapping = null;

let mappingData = null;
let inputFile = null;

window.addEventListener("DOMContentLoaded", () => {
	loadVersion();
	loadDateMapping();
	loadDefaultMapping();
});

downloadButton.addEventListener("click", () => {
	if (!downloadBlob) return;
	const url = URL.createObjectURL(downloadBlob);
	const a = document.createElement("a");
	a.href = url;
	a.download = downloadFileName;
	a.click();
	URL.revokeObjectURL(url);
});

inputFileInput.addEventListener("change", () => {
	inputFile = inputFileInput.files[0] || null;
	if (inputFile) {
		inputStatus.textContent = `Input file selected: ${inputFile.name}`;
	} else {
		inputStatus.textContent = "No input file selected.";
	}
	updateButtonState();
});

async function loadDefaultMapping() {
	try {
		const response = await fetch("mappings/mapping.csv");
		if (!response.ok) {
			throw new Error(
				`Unable to fetch mapping: ${response.status} ${response.statusText}`
			);
		}
		const text = await response.text();
		mappingData = parseMappingCsv(text);
		mappingStatus.textContent = `Default mapping loaded: ${mappingData.rows.length} rows.`;
	} catch (err) {
		mappingData = null;
		mappingStatus.textContent = `Failed to load default mapping: ${err.message}`;
		resultStatus.textContent = `Default mapping failed: ${err.message}`;
	}
	updateButtonState();
}

async function loadVersion() {
	try {
		const response = await fetch("version.json");
		if (!response.ok) {
			throw new Error(
				`Unable to fetch version: ${response.status} ${response.statusText}`
			);
		}
		const data = await response.json();
		versionInfo.textContent = `Version: ${data.version || "unknown"}`;
	} catch (err) {
		versionInfo.textContent = "Version unavailable";
	}
}

async function loadDateMapping() {
	const response = await fetch("constants/date.json");
	if (!response.ok) {
		throw new Error(
			`Unable to fetch date mapping: ${response.status} ${response.statusText}`
		);
	}
	dateMapping = await response.json();
}

convertButton.addEventListener("click", async () => {
	if (!mappingData || !inputFile) {
		return;
	}

	const direction = document.querySelector(
		'input[name="direction"]:checked'
	).value;
	const inputText = await inputFile.text();
	let result;

	try {
		if (direction === "sdmxToEvo") {
			result = convertSdmxToEvo(inputText, mappingData);
		} else {
			result = convertEvoToSdmx(inputText, mappingData);
		}
	} catch (err) {
		resultStatus.textContent = `Conversion failed: ${err.message}`;
		return;
	}

	outputText.value = result.csv;
	resultStatus.textContent = `Rows read: ${result.read}, rows written: ${result.written}, skipped: ${result.skipped}`;
	downloadBlob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
	downloadFileName = `converted-${direction}.csv`;
	downloadButton.classList.remove("hidden");
	downloadButton.disabled = false;
});

function updateButtonState() {
	convertButton.disabled = !mappingData || !inputFile;
}

function parseMappingCsv(csvText) {
	const rows = parseCsv(csvText, ",");
	if (rows.length < 2) return null;

	const header = rows[0].map((h) => h.trim().toUpperCase());
	const required = [
		"DATATYPE",
		"PRODUCT",
		"ITEM1",
		"ITEM2",
		"ENERGY_PRODUCT",
		"MAIN_FLOW",
		"FLOW_BREAKDOWN",
		"PLANT_TYPE",
		"STOCKS",
		"VIS_A_VIS_AREA",
		"MEASURE_VALUE_TYPE",
		"UNIT_MEASURE",
	];

	const headerIndex = {};
	header.forEach((cell, index) => {
		headerIndex[cell] = index;
	});

	for (const name of required) {
		if (!(name in headerIndex)) {
			throw new Error(`Missing mapping column ${name}`);
		}
	}

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

function convertSdmxToEvo(text, mappingData) {
	const rows = parseCsv(text, ";");
	if (rows.length < 2) {
		throw new Error(
			"SDMX input file must contain a header row and at least one record."
		);
	}

	const header = rows[0].map((cell) => cell.trim().toUpperCase());
	const idx = arrayToIndex(header);
	const required = [
		"QUEST_SOURCE",
		"REF_AREA",
		"TIME_PERIOD",
		"ENERGY_PRODUCT",
		"MAIN_FLOW",
		"FLOW_BREAKDOWN",
		"PLANT_TYPE",
		"STOCKS",
		"VIS_A_VIS_AREA",
		"MEASURE_VALUE_TYPE",
		"UNIT_MEASURE",
		"OBS_VALUE",
		"OBS_STATUS",
	];
	required.forEach((name) => {
		if (!(name in idx)) {
			throw new Error(`SDMX input missing required column: ${name}`);
		}
	});

	const mapping = buildSdmxToEvoMap(mappingData.rows);
	const outputRows = [
		[
			"COUNTRY",
			"QUEST",
			"DATATYPE",
			"PRODUCT",
			"ITEM1",
			"ITEM2",
			"TIME",
			"VALUE",
			"FLAG",
		],
	];

	let read = 0;
	let written = 0;
	let skipped = 0;

	for (let i = 1; i < rows.length; i += 1) {
		const row = rows[i];
		if (row.every((cell) => !cell.trim())) continue;
		read += 1;

		const energyProduct = getField(row, idx, "ENERGY_PRODUCT");
		const mainFlow = getField(row, idx, "MAIN_FLOW");
		const flowBreakdown = getField(row, idx, "FLOW_BREAKDOWN");
		const plantType = getField(row, idx, "PLANT_TYPE");
		const stocks = getField(row, idx, "STOCKS");
		const visAVisArea = getField(row, idx, "VIS_A_VIS_AREA");
		const measureValueType = getField(row, idx, "MEASURE_VALUE_TYPE");
		const unitMeasure = getField(row, idx, "UNIT_MEASURE");

		const key = buildSdmxKey(
			energyProduct,
			mainFlow,
			flowBreakdown,
			plantType,
			stocks,
			visAVisArea,
			measureValueType,
			unitMeasure
		);
		const mapped = mapping[key];
		if (!mapped) {
			skipped += 1;
			continue;
		}

		const timeStr = sdmxMonthToEvo(getField(row, idx, "TIME_PERIOD"));
		outputRows.push([
			getField(row, idx, "REF_AREA"),
			getField(row, idx, "QUEST_SOURCE"),
			mapped.datatype,
			mapped.product,
			mapped.item1,
			mapped.item2,
			timeStr,
			getField(row, idx, "OBS_VALUE"),
			getField(row, idx, "OBS_STATUS"),
		]);
		written += 1;
	}

	return { csv: serializeCsv(outputRows, ","), read, written, skipped };
}

function convertEvoToSdmx(text, mappingData) {
	const rows = parseCsv(text, ",");
	if (rows.length < 2) {
		throw new Error(
			"EVO input file must contain a header row and at least one record."
		);
	}

	const header = rows[0].map((cell) => cell.trim().toUpperCase());
	const idx = arrayToIndex(header);
	const required = [
		"COUNTRY",
		"QUEST",
		"DATATYPE",
		"PRODUCT",
		"ITEM1",
		"ITEM2",
		"TIME",
		"VALUE",
		"FLAG",
	];
	required.forEach((name) => {
		if (!(name in idx)) {
			throw new Error(`EVO input missing required column: ${name}`);
		}
	});

	const mapping = buildEvoToSdmxMap(mappingData.rows);
	const outputRows = [
		[
			"DATAFLOW",
			"QUEST_SOURCE",
			"REF_AREA",
			"FREQ",
			"ENERGY_PRODUCT",
			"MAIN_FLOW",
			"FLOW_BREAKDOWN",
			"PLANT_TECH",
			"PLANT_TYPE",
			"STOCKS",
			"INFRASTRUCTURE_IND",
			"VIS_A_VIS_AREA",
			"MEASURE_VALUE_TYPE",
			"FACILITY_ID",
			"TIME_PERIOD",
			"OBS_VALUE",
			"UNIT_MEASURE",
			"OBS_STATUS",
			"CONF_STATUS",
			"COMMENT_OBS",
			"FACILITY_TYPE",
			"FACILITY_NAME",
		],
	];

	let read = 0;
	let written = 0;
	let skipped = 0;

	for (let i = 1; i < rows.length; i += 1) {
		const row = rows[i];
		if (row.every((cell) => !cell.trim())) continue;
		read += 1;

		const key = buildEvoKey(
			getField(row, idx, "DATATYPE"),
			getField(row, idx, "PRODUCT"),
			getField(row, idx, "ITEM1"),
			getField(row, idx, "ITEM2")
		);
		const mapped = mapping[key];
		if (!mapped) {
			skipped += 1;
			continue;
		}

		outputRows.push([
			"",
			getField(row, idx, "QUEST"),
			getField(row, idx, "COUNTRY"),
			"M",
			mapped.energyProduct,
			mapped.mainFlow,
			mapped.flowBreakdown,
			"_Z",
			mapped.plantType,
			mapped.stocks,
			"_Z",
			mapped.visAVisArea,
			mapped.measureValueType,
			"_Z",
			evoMonthToSdmx(getField(row, idx, "TIME")),
			getField(row, idx, "VALUE"),
			mapped.unitMeasure,
			getField(row, idx, "FLAG"),
			"F",
			"",
			"",
			"",
		]);
		written += 1;
	}

	return { csv: serializeCsv(outputRows, ";"), read, written, skipped };
}

function buildSdmxToEvoMap(rows) {
	const map = {};
	rows.forEach((item) => {
		const key = buildSdmxKey(
			item.energyProduct,
			item.mainFlow,
			item.flowBreakdown,
			item.plantType,
			item.stocks,
			item.visAVisArea,
			item.measureValueType,
			item.unitMeasure
		);
		map[key] = item;
	});
	return map;
}

function buildEvoToSdmxMap(rows) {
	const map = {};
	rows.forEach((item) => {
		const key = buildEvoKey(
			item.datatype,
			item.product,
			item.item1,
			item.item2
		);
		map[key] = item;
	});
	return map;
}

function parseCsv(text, delimiter) {
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;
	let i = 0;

	while (i < text.length) {
		const char = text[i];
		const nextChar = text[i + 1];

		if (inQuotes) {
			if (char === '"') {
				if (nextChar === '"') {
					field += '"';
					i += 1;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
		} else {
			if (char === '"') {
				inQuotes = true;
			} else if (char === delimiter) {
				row.push(field);
				field = "";
			} else if (char === "\r") {
				// ignore; wait for \n
			} else if (char === "\n") {
				row.push(field);
				rows.push(row);
				row = [];
				field = "";
			} else {
				field += char;
			}
		}
		i += 1;
	}

	if (inQuotes) {
		throw new Error("Malformed CSV: missing closing quote");
	}
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

function serializeCsv(rows, delimiter) {
	return rows.map((r) => r.map(escapeCsvCell).join(delimiter)).join("\r\n");
}

function escapeCsvCell(value) {
	const text = String(value ?? "");
	if (text.includes('"')) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	if (
		text.includes(",") ||
		text.includes(";") ||
		text.includes("\r") ||
		text.includes("\n")
	) {
		return `"${text}"`;
	}
	return text;
}

function arrayToIndex(array) {
	return array.reduce((acc, cell, index) => {
		acc[cell.trim().toUpperCase()] = index;
		return acc;
	}, {});
}

function getField(row, idx, name) {
	const index = idx[name];
	if (index === undefined || index < 0 || index >= row.length) return "";
	return (row[index] || "").trim();
}

function buildSdmxKey(
	energyProduct,
	mainFlow,
	flowBreakdown,
	plantType,
	stocks,
	visAVisArea,
	measureValueType,
	unitMeasure
) {
	return [
		energyProduct,
		mainFlow,
		flowBreakdown,
		plantType,
		stocks,
		visAVisArea,
		measureValueType,
		unitMeasure,
	]
		.map((v) => v.trim())
		.join("|");
}

function buildEvoKey(datatype, product, item1, item2) {
	return [datatype, product, item1, item2].map((v) => v.trim()).join("|");
}

function sdmxMonthToEvo(timePeriod) {
	const [year, month] = timePeriod.split("-");
	if (!year || !month) return timePeriod;
	const months = dateMapping && dateMapping.months;
	if (!months) {
		throw new Error("Date mapping not loaded");
	}
	return months[month] ? `${months[month]}${year}` : timePeriod;
}

function evoMonthToSdmx(evoTime) {
	const trimmed = evoTime.trim().toUpperCase();
	if (trimmed.length < 7) return evoTime;
	const mon = trimmed.slice(0, 3);
	const year = trimmed.slice(trimmed.length - 4);
	const months = dateMapping && dateMapping.months;
	if (!months) {
		throw new Error("Date mapping not loaded");
	}
	const reversed = {};
	for (const k in months) {
		if (Object.prototype.hasOwnProperty.call(months, k)) {
			reversed[months[k]] = k.padStart(2, "0");
		}
	}
	return reversed[mon] ? `${year}-${reversed[mon]}` : evoTime;
}
