import { parseCsv, serializeCsv, arrayToIndex, getField } from "./csv.js";
import {
	buildEvoToSdmxMap,
	buildSdmxToEvoMap,
	buildSdmxKey,
	buildEvoKey,
} from "./mappings.js";

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

/**
 * Initialize converter state from app context
 */
export const converterState = {
	outputColumnHead: null,
	dateConst: null,
	evoToSdmxDefaults: null,
	dataSetMap: null,
	countryMap: null,
	refAreaMap: null,
};

export function buildCountryReverseMap() {
	converterState.refAreaMap = {};
	for (const [country, code] of Object.entries(converterState.countryMap)) {
		converterState.refAreaMap[code] = country;
	}
}

function validateConstants(constants, requiredFields) {
	for (const field of requiredFields) {
		const value = constants?.[field];

		if (
			value === undefined ||
			value === null ||
			(typeof value === "string" && value.trim() === "")
		) {
			throw new Error(`missing or invalid value for a field "${field}"`);
		}
	}

	return constants;
}

export function convertSdmxToEvo(text, mapProductFlows) {
	const rows = parseCsv(text, ";");
	if (rows.length < 2) {
		throw new Error(
			"SDMX input file must contain a header row and at least one record."
		);
	}

	const header = rows[0].map((cell) => cell.trim().toUpperCase());
	const idx = arrayToIndex(header);

	const mapping = buildSdmxToEvoMap(mapProductFlows.rows);
	const outputRows = [converterState.outputColumnHead.sdmxToEvo];
	const skippedRows = [converterState.outputColumnHead.evoToSdmx];
	const constants = validateConstants(initEvoConstants(rows[1], idx), [
		"refArea",
		"quest",
		"time",
	]);

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
			skippedRows.push(row);
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

	return {
		csv: serializeCsv(outputRows, ";"),
		read,
		written,
		skipped,
		skippedRows: serializeCsv(skippedRows, ","),
	};
}

export function convertEvoToSdmx(text, mapProductFlows) {
	const rows = parseCsv(text, ",");
	if (rows.length < 2) {
		throw new Error(
			"E-VO input file must contain a header row and at least one record."
		);
	}

	const header = rows[0].map((cell) => cell.trim().toUpperCase());
	const idx = arrayToIndex(header);
	const mapping = buildEvoToSdmxMap(mapProductFlows.rows);
	const outputRows = [converterState.outputColumnHead.evoToSdmx];
	const skippedRows = [converterState.outputColumnHead.sdmxToEvo];
	const constants = validateConstants(initSdmxConstants(rows[1], idx), [
		"questSource",
		"country",
		"timePeriod",
	]);

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
	if (!converterState.dataSetMap) return "";
	return quest &&
		converterState.dataSetMap[quest] &&
		converterState.dataSetMap[quest][fieldName]
		? converterState.dataSetMap[quest][fieldName]
		: "";
}

function getFlagValue(fieldValue) {
	if (!converterState.evoToSdmxDefaults) return "";
	return fieldValue || converterState.evoToSdmxDefaults["OBS_STATUS"] || "";
}

function getDefaultSdmxValue(fieldName) {
	if (!converterState.evoToSdmxDefaults) return "";
	return converterState.evoToSdmxDefaults[fieldName] || "";
}

function sdmxMonthToEvo(timePeriod) {
	const [year, month] = timePeriod.split("-");
	if (!year || !month) return timePeriod;
	const months = converterState.dateConst && converterState.dateConst.months;
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
	const months = converterState.dateConst && converterState.dateConst.months;
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
	return converterState.countryMap[country] || "";
}

function refAreaToCountry(refArea) {
	return converterState.refAreaMap[refArea.trim()] || "";
}

function questSourceToQuest(questSource) {
	if (!converterState.dataSetMap) return "";
	const qs = (questSource || "").trim();
	return Object.keys(converterState.dataSetMap).find(
		(key) =>
			converterState.dataSetMap[key] &&
			converterState.dataSetMap[key].QUEST_SOURCE === qs
	);
}

export function getRequiredColumnsForDirection(direction) {
	if (direction === "sdmxToEvo") {
		return SDMX_KEY_FIELDS;
	} else {
		return EVO_KEY_FIELDS;
	}
}

export function getInputHeaderFields(inputText, delimiter) {
	const rows = parseCsv(inputText, delimiter);
	if (rows.length < 1) {
		throw new Error("Input file must contain a header row.");
	}
	return rows[0].map((cell) => cell.trim().toUpperCase());
}
