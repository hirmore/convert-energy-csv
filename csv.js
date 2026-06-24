export function parseCsv(text, delimiter) {
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
				// ignore
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

export function serializeCsv(rows, delimiter) {
	return rows.map((row) => row.map(escapeCsvCell).join(delimiter)).join("\r\n");
}

export function escapeCsvCell(value) {
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

export function arrayToIndex(array) {
	return array.reduce((acc, cell, index) => {
		acc[cell.trim().toUpperCase()] = index;
		return acc;
	}, {});
}

export function getField(row, idx, name) {
	const index = idx[name];

	if (index === undefined || index < 0 || index >= row.length) {
		return "";
	}

	return (row[index] || "").trim();
}
