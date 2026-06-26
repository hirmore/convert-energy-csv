import {
	convertSdmxToEvo,
	convertEvoToSdmx,
	initConverterState,
	buildCountryReverseMap,
	getInputHeaderFields,
	getRequiredColumnsForDirection,
} from "./converter.js";
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
	bindDirectionButtonClick,
	bindDownloadClick,
	bindDownloadSkippedClick,
	bindToggleOutputClick,
	setVersion,
	setMappingStatus,
	setInputStatus,
	setResultStatus,
	setOutputText,
	setConvertEnabled,
	setDownloadReady,
	setSkippedDownloadReady,
	setToggleOutputReady,
	hideDownloadButton,
	hideSkippedDownloadButton,
	hideToggleOutputButton,
	setDirectionButtons,
	setMappingLoadedCount,
	setRowsRead,
	setRowsWritten,
	setRowsSkipped,
	setConversionStatus,
} from "./ui.js";

let downloadBlob = null;
let downloadFileName = "converted.csv";
let skippedBlob = null;
let skippedFileName = "skipped-rows.csv";
let convertedCsv = null;
let skippedCsv = null;
let showingSkipped = false;

let dateConst = null;
let outputColumnHead = null;
let countryMap = null;
let dataSetMap = null;
let evoToSdmxDefaults = null;

let mapProductFlows = null;
let inputFile = null;
let selectedDirection = "evoToSdmx";

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
	bindDirectionButtonClick(handleDirectionButtonClick);
	bindDownloadClick(handleDownloadClick);
	bindDownloadSkippedClick(handleDownloadSkippedClick);
	bindToggleOutputClick(handleToggleOutputClick);
	setDirectionButtons(selectedDirection);
	hideDownloadButton();
	hideSkippedDownloadButton();
	hideToggleOutputButton();
});

async function loadProductFlowsMapping() {
	try {
		mapProductFlows = await fetchProductFlowsMapping();
		// setMappingStatus( `Product flows mapping loaded: ${mapProductFlows.rows.length} rows.`);
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
		initConverterState({ dateConst });
	} catch (err) {
		setResultStatus(`Failed to load date constants: ${err.message}`);
	}
}

async function loadOutputColumnHead() {
	try {
		outputColumnHead = await fetchOutputColumnHead();
		initConverterState({ outputColumnHead });
	} catch (err) {
		setResultStatus(`Failed to load output rows: ${err.message}`);
	}
}

async function loadDefaultValues() {
	try {
		evoToSdmxDefaults = await fetchDefaultValues();
		initConverterState({ evoToSdmxDefaults });
	} catch (err) {
		setResultStatus(`Failed to load default values: ${err.message}`);
	}
}

async function loadCountryMapping() {
	try {
		countryMap = await fetchCountryMapping();
		initConverterState({
			dateConst,
			outputColumnHead,
			evoToSdmxDefaults,
			dataSetMap,
			countryMap,
		});
		buildCountryReverseMap();
	} catch (err) {
		setResultStatus(`Failed to load country mapping: ${err.message}`);
	}
}

async function loadDataSetMappingCsv() {
	try {
		dataSetMap = await fetchDataSetMapping();
		initConverterState({ dataSetMap });
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

	const direction = selectedDirection;
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

	convertedCsv = result.csv;
	skippedCsv =
		result.skipped > 0 && result.skippedRows ? result.skippedRows : null;
	showingSkipped = false;

	setOutputText(convertedCsv);
	setResultStatus(
		`Rows read: ${result.read}, rows written: ${result.written}, skipped: ${result.skipped}`
	);
	setRowsRead(result.read);
	setRowsWritten(result.written);
	setRowsSkipped(result.skipped);
	setConversionStatus(
		result.skipped === 0
			? "Conversion completed successfully!"
			: "Conversion completed with skipped rows"
	);
	downloadBlob = new Blob([convertedCsv], { type: "text/csv;charset=utf-8;" });
	const outFilePart = inputFile.name.replace(/\.[^./\\]+$/, "");
	downloadFileName = `${outFilePart}-${direction}.csv`;
	setDownloadReady();

	if (skippedCsv) {
		skippedBlob = new Blob([skippedCsv], { type: "text/csv;charset=utf-8;" });
		skippedFileName = `${outFilePart}-${direction}-skipped.csv`;
		setSkippedDownloadReady();
		setToggleOutputReady("Show skipped rows");
	} else {
		skippedBlob = null;
		hideSkippedDownloadButton();
		hideToggleOutputButton();
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

function handleToggleOutputClick() {
	if (!skippedCsv) return;
	showingSkipped = !showingSkipped;

	if (showingSkipped) {
		setOutputText(skippedCsv);
		setToggleOutputReady("Show converted rows");
	} else {
		setOutputText(convertedCsv);
		setToggleOutputReady("Show skipped rows");
	}
}

function resetConversionState() {
	downloadBlob = null;
	skippedBlob = null;

	convertedCsv = null;
	skippedCsv = null;

	showingSkipped = false;

	setOutputText("");

	setRowsRead(0);
	setRowsWritten(0);
	setRowsSkipped(0);

	setConversionStatus("");
	setResultStatus("");

	hideDownloadButton();
	hideSkippedDownloadButton();
	hideToggleOutputButton();
}

function validateRequiredColumns(header, requiredFields) {
	const headerSet = new Set(header.map((col) => col.trim().toUpperCase()));

	const missing = requiredFields.filter(
		(field) => !headerSet.has(field.toUpperCase())
	);

	return {
		valid: missing.length === 0,
		missing,
	};
}

async function validateRequiredColumnsForSelectedDirection() {
	if (!inputFile) {
		return { valid: false, missing: [] };
	}

	const text = await inputFile.text();

	const delimiter = selectedDirection === "sdmxToEvo" ? ";" : ",";
	const header = getInputHeaderFields(text, delimiter);

	const requiredFields = getRequiredColumnsForDirection(selectedDirection);

	return validateRequiredColumns(header, requiredFields);
}

async function handleInputFileChange(file) {
	resetConversionState();

	inputFile = file;
	if (inputFile) {
		setInputStatus(`Input file selected: ${inputFile.name}`);
	} else {
		setInputStatus("No input file selected.");
	}

	const validation = await validateRequiredColumnsForSelectedDirection();

	if (validation.valid) {
		updateButtonState();
		setConversionStatus("Correctly formatted input file");
	} else {
		setConvertEnabled(false);
		setConversionStatus("Wrongly formatted input file");

		setResultStatus(
			`Input file is missing required columns for ${selectedDirection} conversion. Missing: ${validation.missing.join(
				", "
			)}`
		);
	}
}

async function handleDirectionButtonClick(direction) {
	selectedDirection = direction;
	setDirectionButtons(direction);

	if (inputFile) {
		await handleInputFileChange(inputFile);
	}
}

function updateButtonState() {
	setConvertEnabled(Boolean(mapProductFlows && inputFile));
}
