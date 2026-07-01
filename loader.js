import {
	parseDataSetMappingCsv,
	parseProductFlowsMappingCsv,
} from "./mappings.js";

async function fetchResource(path) {
	const response = await fetch(path);
	if (!response.ok) {
		throw new Error(
			`Unable to fetch resource at ${path}: ${response.status} ${response.statusText}`
		);
	}
	return response;
}

export async function fetchJson(path) {
	const response = await fetchResource(path);
	return response.json();
}

export async function fetchText(path) {
	const response = await fetchResource(path);
	return response.text();
}

export async function loadVersion(path = "version.json") {
	try {
		const data = await fetchJson(path);

		const version = typeof data?.version === "string" ? data.version : null;
		const mapping = typeof data?.mapping === "string" ? data.mapping : null;

		if (!version || !mapping) {
			return "unknown(unknown)";
		}

		return `${version}(${mapping})`;
	} catch {
		return "unknown(unknown)";
	}
}

export async function loadDateConstants(path = "constants/date.json") {
	return fetchJson(path);
}

export async function loadOutputColumnHead(
	path = "constants/outputColumns.json"
) {
	return fetchJson(path);
}

export async function loadDefaultValues(path = "constants/defaultValues.json") {
	const data = await fetchJson(path);
	return data?.evoToSdmx || {};
}

export async function loadCountryMapping(path = "constants/countries.json") {
	return fetchJson(path);
}

export async function loadDataSetMapping(path = "mappings/datasets.csv") {
	const text = await fetchText(path);
	return parseDataSetMappingCsv(text);
}

export async function loadProductFlowsMapping(
	path = "mappings/product_flows.csv"
) {
	const text = await fetchText(path);
	return parseProductFlowsMappingCsv(text);
}

export function buildReverseMap(mapObject) {
	return Object.entries(mapObject).reduce((reverse, [key, value]) => {
		reverse[value] = key;
		return reverse;
	}, {});
}
