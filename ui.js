const inputFileInput = document.getElementById("inputFile");
const convertButton = document.getElementById("convertButton");
const directionEvoToSdmx = document.getElementById("directionEvoToSdmx");
const directionSdmxToEvo = document.getElementById("directionSdmxToEvo");
const versionInfo = document.getElementById("versionInfo");
const mappingStatus = document.getElementById("mappingStatus");
const inputStatus = document.getElementById("inputStatus");
const resultStatus = document.getElementById("resultStatus");
const outputText = document.getElementById("outputText");
const downloadButton = document.getElementById("downloadButton");
const downloadSkippedButton = document.getElementById("downloadSkippedButton");
const toggleOutputButton = document.getElementById("toggleOutputButton");
const rowsRead = document.getElementById("rowsRead");
const rowsWritten = document.getElementById("rowsWritten");
const rowsSkipped = document.getElementById("rowsSkipped");
const conversionStatus = document.getElementById("conversionStatus");
const mappingLoaded = document.getElementById("mappingLoaded");

export function bindInputFileChange(handler) {
	inputFileInput.addEventListener("change", () => {
		handler(inputFileInput.files[0] || null);
	});
}

export function bindConvertClick(handler) {
	convertButton.addEventListener("click", handler);
}

export function bindDirectionButtonClick(handler) {
	directionEvoToSdmx.addEventListener("click", () => handler("evoToSdmx"));
	directionSdmxToEvo.addEventListener("click", () => handler("sdmxToEvo"));
}

export function bindDownloadClick(handler) {
	downloadButton.addEventListener("click", handler);
}

export function bindDownloadSkippedClick(handler) {
	downloadSkippedButton.addEventListener("click", handler);
}

export function bindToggleOutputClick(handler) {
	toggleOutputButton.addEventListener("click", handler);
}

export function setVersion(version) {
	versionInfo.textContent = `Version: ${version}`;
}

export function setMappingStatus(text) {
	mappingStatus.textContent = text;
	mappingStatus.classList.remove("hidden");
}

export function setInputStatus(text) {
	inputStatus.textContent = text;
}

export function setResultStatus(text) {
	resultStatus.textContent = text;
	resultStatus.classList.remove("hidden");
}

export function setRowsRead(value) {
	rowsRead.textContent = value;
}

export function setRowsWritten(value) {
	rowsWritten.textContent = value;
}

export function setRowsSkipped(value) {
	rowsSkipped.textContent = value;
}

export function setConversionStatus(text) {
	conversionStatus.textContent = text;
}

export function setDirectionButtons(direction) {
	directionEvoToSdmx.classList.toggle("active", direction === "evoToSdmx");
	directionSdmxToEvo.classList.toggle("active", direction === "sdmxToEvo");
}

export function setMappingLoadedCount(count) {
	mappingLoaded.textContent = `${count} rows`;
}

export function setOutputText(text) {
	outputText.value = text;
}

export function setConvertEnabled(enabled) {
	convertButton.disabled = !enabled;
}

export function setDownloadReady() {
	downloadButton.classList.remove("hidden");
	downloadButton.disabled = false;
}

export function setSkippedDownloadReady() {
	downloadSkippedButton.classList.remove("hidden");
	downloadSkippedButton.disabled = false;
}

export function setToggleOutputReady(label) {
	toggleOutputButton.classList.remove("hidden");
	toggleOutputButton.disabled = false;
	toggleOutputButton.textContent = label;
}

export function hideDownloadButton() {
	downloadButton.classList.add("hidden");
	downloadButton.disabled = true;
}

export function hideSkippedDownloadButton() {
	downloadSkippedButton.classList.add("hidden");
	downloadSkippedButton.disabled = true;
}

export function hideToggleOutputButton() {
	toggleOutputButton.classList.add("hidden");
	toggleOutputButton.disabled = true;
}

export function getSelectedDirection() {
	return document.querySelector('input[name="direction"]:checked').value;
}
