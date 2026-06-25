const inputFileInput = document.getElementById("inputFile");
const convertButton = document.getElementById("convertButton");
const versionInfo = document.getElementById("versionInfo");
const mappingStatus = document.getElementById("mappingStatus");
const inputStatus = document.getElementById("inputStatus");
const resultStatus = document.getElementById("resultStatus");
const outputText = document.getElementById("outputText");
const downloadButton = document.getElementById("downloadButton");

export function bindInputFileChange(handler) {
	inputFileInput.addEventListener("change", () => {
		handler(inputFileInput.files[0] || null);
	});
}

export function bindConvertClick(handler) {
	convertButton.addEventListener("click", handler);
}

export function bindDownloadClick(handler) {
	downloadButton.addEventListener("click", handler);
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

export function hideDownloadButton() {
	downloadButton.classList.add("hidden");
	downloadButton.disabled = true;
}

export function getSelectedDirection() {
	return document.querySelector('input[name="direction"]:checked').value;
}
