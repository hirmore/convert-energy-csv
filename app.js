import { parseCsv, serializeCsv, arrayToIndex, getField } from "./csv.js";
import {
	buildEvoToSdmxMap,
	buildSdmxToEvoMap,
	buildSdmxKey,
	buildEvoKey,
} from "./mappings.js";
import {
	loadVersion as fetchVersion,
	loadDateConstants as fetchDateConstants,
	loadOutputColumnHead as fetchOutputColumnHead,
	loadDefaultValues as fetchDefaultValues,
	loadCountryMapping as fetchCountryMapping,
	loadDataSetMapping as fetchDataSetMapping,
	loadProductFlowsMapping as fetchProductFlowsMapping,
} from "./loader.js";
import {
	bindInputFileChange,
	bindConvertClick,
	bindDownloadClick,
	bindDownloadSkippedClick,
	setVersion,
	setMappingStatus,
	setInputStatus,
	setResultStatus,
	setOutputText,
	setConvertEnabled,
	setDownloadReady,
	setSkippedDownloadReady,
	hideDownloadButton,
	hideSkippedDownloadButton,
	getSelectedDirection,
} from "./ui.js";

let downloadBlob = null;
let downloadFileName = "converted.csv";
let skippedBlob = null;
let skippedFileName = "skipped-rows.csv";

let dateConst = null;
let outputColumnHead = null;
let countryMap = null;
let dataSetMap = null;
let evoToSdmxDefaults = null;

let mapProductFlows = null;
let inputFile = null;
let refAreaMap = null;

const EVO_KEY_FIELDS = ["DATATYPE", "PRODUCT", "ITEM1", "ITEM2"];

const SDMX_KEY_FIELDS = [
	"ENERGY_PRODUCT",
	"MAIN_FLOW",
	"FLOW_BREAKDOWN",
	"PLANT_TYPE",
	"STOCKS",
	"VIS_A_VIS_AREA",
	"MEASURE_VALUE_TYPE",
	"UNIT_MEASURE",
];

window.addEventListener("DOMContentLoaded", () => {
	loadVersion();
	loadDateConstants();
	loadOutputColumnHead();
	loadProductFlowsMapping();
	loadDefaultValues();
	loadCountryMapping();
	loadDataSetMappingCsv();

	bindInputFileChange(handleInputFileChange);
	bindConvertClick(handleConvertClick);
	bindDownloadClick(handleDownloadClick);
	bindDownloadSkippedClick(handleDownloadSkippedClick);
	hideDownloadButton();
	hideSkippedDownloadButton();
});

async function loadProductFlowsMapping() {
	try {
		mapProductFlows = await fetchProductFlowsMapping();
		setMappingStatus(`Product flows mapping loaded: ${mapProductFlows.rows.length} rows.`);
	} catch (err) {
		mapProductFlows = null;
		setMappingStatus(`Failed to load product flows mapping: ${err.message}`);
		setResultStatus(`Product flows mapping failed: ${err.message}`);
	}
	updateButtonState();
}

async function loadVersion() {
	try {
		const version = await fetchVersion();
		setVersion(version);
	} catch (err) {
		setVersion("unknown");
	}
}

async function loadDateConstants() {
	try {
		dateConst = await fetchDateConstants();
	} catch (err) {
		setResultStatus(`Failed to load date constants: ${err.message}`);
	}
}

async function loadOutputColumnHead() {
	try {
		outputColumnHead = await fetchOutputColumnHead();
	} catch (err) {
		setResultStatus(`Failed to load output rows: ${err.message}`);
	}
}

async function loadDefaultValues() {
	try {
		evoToSdmxDefaults = await fetchDefaultValues();
	} catch (err) {
		setResultStatus(`Failed to load default values: ${err.message}`);
	}
}

async function loadCountryMapping() {
	try {
		countryMap = await fetchCountryMapping();
		buildCountryReverseMap();
	} catch (err) {
		setResultStatus(`Failed to load country mapping: ${err.message}`);
	}
}

async function loadDataSetMappingCsv() {
	try {
		dataSetMap = await fetchDataSetMapping();
	} catch (err) {
		dataSetMap = null;
		setMappingStatus(`Failed to load dataset mapping: ${err.message}`);
		setResultStatus(`Dataset mapping failed: ${err.message}`);
	}
}

async function handleConvertClick() {
	if (!mapProductFlows || !inputFile) {
		return;
	}

	const direction = getSelectedDirection();
	const inputText = await inputFile.text();
	let result;

	try {
		if (direction === "sdmxToEvo") {
			result = convertSdmxToEvo(inputText, mapProductFlows);
		} else {
			result = convertEvoToSdmx(inputText, mapProductFlows);
		}
	} catch (err) {
		setResultStatus(`Conversion failed: ${err.message}`);
		return;
	}

	setOutputText(result.csv);
	setResultStatus(`Rows read: ${result.read}, rows written: ${result.written}, skipped: ${result.skipped}`);
	downloadBlob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
	const outFilePart = inputFile.name.replace(/\.[^./\\]+$/, "");
	downloadFileName = `${outFilePart}-${direction}.csv`;
	setDownloadReady();

	if (result.skipped > 0 && result.skippedRows) {
		skippedBlob = new Blob([result.skippedRows], { type: "text/csv;charset=utf-8;" });
		skippedFileName = `${outFilePart}-${direction}-skipped.csv`;
		setSkippedDownloadReady();
	} else {
		skippedBlob = null;
		hideSkippedDownloadButton();
	}
}

function handleDownloadClick() {
	if (!downloadBlob) return;
	const url = URL.createObjectURL(downloadBlob);
	const a = document.createElement("a");
	a.href = url;
	a.download = downloadFileName;
	a.click();
	URL.revokeObjectURL(url);
}

function handleDownloadSkippedClick() {
	if (!skippedBlob) return;
	const url = URL.createObjectURL(skippedBlob);
	const a = document.createElement("a");
	a.href = url;
	a.download = skippedFileName;
	a.click();
	URL.revokeObjectURL(url);
}

function handleInputFileChange(file) {
	inputFile = file;
	if (inputFile) {
		setInputStatus(`Input file selected: ${inputFile.name}`);
	} else {
		setInputStatus("No input file selected.");
	}
	updateButtonState();
}

function updateButtonState() {
	setConvertEnabled(Boolean(mapProductFlows && inputFile));
}

function convertSdmxToEvo(text, mapProductFlows) {
	const rows = parseCsv(text, ";");
	if (rows.length < 2) {
		throw new Error(
			"SDMX input file must contain a header row and at least one record."
		);
	}

	const header = rows[0].map((cell) => cell.trim().toUpperCase());
	const idx = arrayToIndex(header);

	const mapping = buildSdmxToEvoMap(mapProductFlows.rows);
	const outputRows = [outputColumnHead.sdmxToEvo];
	const constants = initEvoConstants(rows[1], idx);

	let read = 0;
	let written = 0;
	let skipped = 0;

	for (let i = 1; i < rows.length; i += 1) {
		const row = rows[i];
		if (row.every((cell) => !cell.trim())) continue;
		read += 1;

		const sdmxFields = SDMX_KEY_FIELDS.map((name) => getField(row, idx, name));

		const key = buildSdmxKey(sdmxFields);
		const mapped = mapping[key];
		if (!mapped) {
			skipped += 1;
			continue;
		}

		outputRows.push([
			constants.refArea,
			constants.quest,
			mapped.datatype,
			mapped.product,
			mapped.item1,
			mapped.item2,
			constants.time,
			getField(row, idx, "OBS_VALUE"),
			getField(row, idx, "OBS_STATUS"),
		]);
		written += 1;
	}

	return { csv: serializeCsv(outputRows, ","), read, written, skipped };
}

function convertEvoToSdmx(text, mapProductFlows) {
	const rows = parseCsv(text, ",");
	if (rows.length < 2) {
		throw new Error(
			"EVO input file must contain a header row and at least one record."
		);
	}

	const header = rows[0].map((cell) => cell.trim().toUpperCase());
	const idx = arrayToIndex(header);
	const mapping = buildEvoToSdmxMap(mapProductFlows.rows);
	const outputRows = [outputColumnHead.evoToSdmx];
	const skippedRows = [outputColumnHead.sdmxToEvo];
	const constants = initSdmxConstants(rows[1], idx);

	let read = 0;
	let written = 0;
	let skipped = 0;

	for (let i = 1; i < rows.length; i += 1) {
		const row = rows[i];
		if (row.every((cell) => !cell.trim())) continue;
		read += 1;

		const evoFields = EVO_KEY_FIELDS.map((name) => getField(row, idx, name));
		const key = buildEvoKey(evoFields);
		const mapped = mapping[key];
		if (!mapped) {
			skippedRows.push(row);
			skipped += 1;
			continue;
		}

		outputRows.push([
			constants.dataflow,
			constants.questSource,
			constants.country,
			constants.freq,
			mapped.energyProduct,
			mapped.mainFlow,
			mapped.flowBreakdown,
			constants.plantTech,
			mapped.plantType,
			mapped.stocks,
			constants.infrastructureInd,
			mapped.visAVisArea,
			mapped.measureValueType,
			constants.facilityId,
			constants.timePeriod,
			getField(row, idx, "VALUE"),
			mapped.unitMeasure,
			getFlagValue(getField(row, idx, "FLAG")),
			constants.confStatus,
			"",
			"",
			"",
		]);
		written += 1;
	}

	return {
		csv: serializeCsv(outputRows, ";"),
		read,
		written,
		skipped,
		skippedRows: serializeCsv(skippedRows, ","),
	};
}

function getDatasetValue(fieldName, quest) {
	if (!dataSetMap) return "";
	return quest && dataSetMap[quest] && dataSetMap[quest][fieldName]
		? dataSetMap[quest][fieldName]
		: "";
}

function getFlagValue(fieldValue) {
	if (!evoToSdmxDefaults) return "";
	return fieldValue || evoToSdmxDefaults["OBS_STATUS"] || "";
}

function getDefaultSdmxValue(fieldName) {
	if (!evoToSdmxDefaults) return "";
	return evoToSdmxDefaults[fieldName] || "";
}

function sdmxMonthToEvo(timePeriod) {
	const [year, month] = timePeriod.split("-");
	if (!year || !month) return timePeriod;
	const months = dateConst && dateConst.months;
	if (!months) {
		throw new Error("Date constants not loaded");
	}
	return months[month] ? `${months[month]}${year}` : timePeriod;
}

function evoMonthToSdmx(evoTime) {
	const trimmed = evoTime.trim().toUpperCase();
	if (trimmed.length < 7) return evoTime;
	const mon = trimmed.slice(0, 3);
	const year = trimmed.slice(trimmed.length - 4);
	const months = dateConst && dateConst.months;
	if (!months) {
		throw new Error("Date constants not loaded");
	}
	const reversed = {};
	for (const k in months) {
		if (Object.prototype.hasOwnProperty.call(months, k)) {
			reversed[months[k]] = k.padStart(2, "0");
		}
	}
	return reversed[mon] ? `${year}-${reversed[mon]}` : evoTime;
}

function initEvoConstants(firstRow, idx) {
	return {
		refArea: refAreaToCountry(getField(firstRow, idx, "REF_AREA")),
		quest: questSourceToQuest(getField(firstRow, idx, "QUEST_SOURCE")),
		time: sdmxMonthToEvo(getField(firstRow, idx, "TIME_PERIOD")),
	};
}

function initSdmxConstants(firstRow, idx) {
	let key = getField(firstRow, idx, "QUEST");
	return {
		questSource: getDatasetValue("QUEST_SOURCE", key),
		dataflow: getDatasetValue("DATAFLOW", key),
		freq: getDatasetValue("FREQ", key),
		country: countryToRefArea(getField(firstRow, idx, "COUNTRY")),
		timePeriod: evoMonthToSdmx(getField(firstRow, idx, "TIME")),
		plantTech: getDefaultSdmxValue("PLANT_TECH"),
		infrastructureInd: getDefaultSdmxValue("INFRASTRUCTURE_IND"),
		facilityId: getDefaultSdmxValue("FACILITY_ID"),
		confStatus: getDefaultSdmxValue("CONF_STATUS"),
	};
}

function countryToRefArea(country) {
	return countryMap[country] || "";
}

function refAreaToCountry(refArea) {
	return refAreaMap[refArea.trim()] || "";
}

function buildCountryReverseMap() {
	refAreaMap = {};

	for (const [country, code] of Object.entries(countryMap)) {
		refAreaMap[code] = country;
	}
}

function questSourceToQuest(questSource) {
	if (!dataSetMap) return "";
	const qs = (questSource || "").trim();
	return Object.keys(dataSetMap).find(
		(key) => dataSetMap[key] && dataSetMap[key].QUEST_SOURCE === qs
	);
}
