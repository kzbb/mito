// @ts-check

(function registerCalendarUtils(globalObject) {
	function createCalendarUtils() {
		/**
		 * @param {any} data
		 * @returns {string[][]}
		 */
		function resolveInitialGrid(data) {
			const csvText = typeof data?.calendar?.csvText === "string" ? data.calendar.csvText : "";
			if (csvText.length === 0) {
				return [[""]];
			}

			const parsed = parseCsv(csvText);
			return parsed.length > 0 ? parsed : [[""]];
		}

		/**
		 * @param {any} data
		 * @returns {{ headers: string[], rows: Record<string, string>[] }}
		 */
		function resolveCalendarSchema(data) {
			const grid = resolveInitialGrid(data);
			if (!Array.isArray(grid) || grid.length < 2) {
				return { headers: [], rows: [] };
			}

			const headerRow = Array.isArray(grid[0]) ? grid[0] : [];
			const headers = headerRow
				.map((cell) => String(cell ?? "").trim())
				.filter((cell) => cell.length > 0);

			if (headers.length === 0) {
				return { headers: [], rows: [] };
			}

			/** @type {Record<string, string>[]} */
			const rows = [];
			for (let rowIndex = 1; rowIndex < grid.length; rowIndex += 1) {
				const sourceRow = Array.isArray(grid[rowIndex]) ? grid[rowIndex] : [];
				/** @type {Record<string, string>} */
				const rowRecord = {};
				let hasValue = false;

				for (let colIndex = 0; colIndex < headers.length; colIndex += 1) {
					const header = headers[colIndex];
					const value = String(sourceRow[colIndex] ?? "").trim();
					rowRecord[header] = value;
					if (value.length > 0) {
						hasValue = true;
					}
				}

				if (hasValue) {
					rows.push(rowRecord);
				}
			}

			return { headers, rows };
		}

		/**
		 * @param {Record<string, string>[]} rows
		 * @param {string} key
		 * @param {string} value
		 * @returns {Record<string, string> | null}
		 */
		function findCalendarRowByValue(rows, key, value) {
			const normalizedValue = String(value ?? "").trim();
			if (!key || normalizedValue.length === 0) {
				return null;
			}

			for (const row of rows) {
				if (!row || typeof row !== "object") {
					continue;
				}

				if (String(row[key] ?? "").trim() === normalizedValue) {
					return row;
				}
			}

			return null;
		}

		/**
		 * @param {any} entry
		 * @param {string} key
		 * @param {string[]} headers
		 * @returns {Record<string, string>}
		 */
		function resolveTimelineValues(entry, key, headers) {
			/** @type {Record<string, string>} */
			const values = {};
			for (const header of headers) {
				values[header] = "";
			}

			if (!entry || typeof entry !== "object") {
				return values;
			}

			const compoundKey = key === "date" ? "dateCalendar" : `${key}Calendar`;
			const source = entry?.[compoundKey];
			if (source && typeof source === "object") {
				for (const header of headers) {
					const currentValue = source[header];
					if (typeof currentValue === "string") {
						values[header] = currentValue;
					}
				}
			}

			const primaryHeader = headers[0] ?? "";
			if (primaryHeader && values[primaryHeader].length === 0) {
				const fallback = key === "date"
					? (typeof entry?.date === "string" ? entry.date : typeof entry?.from === "string" ? entry.from : "")
					: entry?.[key];
				if (typeof fallback === "string") {
					values[primaryHeader] = fallback;
				}
			}

			return values;
		}

		/**
		 * @param {any} data
		 * @param {string} csvText
		 */
		function persistCalendar(data, csvText) {
			if (!data || typeof data !== "object") {
				return;
			}

			data.calendar = {
				csvText,
			};
		}

		/**
		 * @param {string[][]} grid
		 * @returns {number}
		 */
		function getGridWidth(grid) {
			let width = 1;
			for (const row of grid) {
				if (Array.isArray(row)) {
					width = Math.max(width, row.length || 1);
				}
			}
			return width;
		}

		/**
		 * @param {string[][]} grid
		 * @param {number} width
		 * @returns {string[][]}
		 */
		function normalizeGridShape(grid, width) {
			if (grid.length === 0) {
				return [[""]];
			}
			for (const row of grid) {
				while (row.length < width) {
					row.push("");
				}
			}
			return grid;
		}

		/**
		 * @param {string} csvText
		 * @returns {string[][]}
		 */
		function parseCsv(csvText) {
			/** @type {string[][]} */
			const rows = [];
			/** @type {string[]} */
			let row = [];
			let cell = "";
			let quoted = false;

			for (let index = 0; index < csvText.length; index += 1) {
				const ch = csvText[index];
				const next = csvText[index + 1] ?? "";

				if (quoted) {
					if (ch === '"' && next === '"') {
						cell += '"';
						index += 1;
						continue;
					}
					if (ch === '"') {
						quoted = false;
						continue;
					}
					cell += ch;
					continue;
				}

				if (ch === '"') {
					quoted = true;
					continue;
				}
				if (ch === ",") {
					row.push(cell);
					cell = "";
					continue;
				}
				if (ch === "\n") {
					row.push(cell);
					rows.push(row);
					row = [];
					cell = "";
					continue;
				}
				if (ch === "\r") {
					continue;
				}
				cell += ch;
			}

			if (cell.length > 0 || row.length > 0) {
				row.push(cell);
				rows.push(row);
			}
			return rows;
		}

		/**
		 * @param {string[][]} grid
		 * @returns {string}
		 */
		function gridToCsv(grid) {
			return grid
				.map((row) => row.map(escapeCsvCell).join(","))
				.join("\n");
		}

		/**
		 * @param {string} value
		 * @returns {string}
		 */
		function escapeCsvCell(value) {
			const needsQuotes = /[",\n\r]/.test(value);
			if (!needsQuotes) {
				return value;
			}
			return `"${value.replace(/"/g, '""')}"`;
		}

		/**
		 * @param {number} index
		 * @returns {string}
		 */
		function resolveColumnLabel(index) {
			let value = index;
			let result = "";
			do {
				result = String.fromCharCode(65 + (value % 26)) + result;
				value = Math.floor(value / 26) - 1;
			} while (value >= 0);
			return result;
		}

		/**
		 * @param {string} csvText
		 * @param {string} fileName
		 */
		function downloadCsv(csvText, fileName) {
			const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = fileName;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
		}

		/**
		 * @param {any} data
		 * @returns {string}
		 */
		function resolveExportFileName(data) {
			const projectName = typeof data?.project === "string" ? data.project.trim() : "";
			if (projectName.length === 0) {
				return "calendar.csv";
			}

			const normalized = projectName.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "");
			return normalized.length > 0 ? `${normalized}-calendar.csv` : "calendar.csv";
		}

		/**
		 * @param {number} value
		 * @param {number} max
		 * @returns {number}
		 */
		function clampIndex(value, max) {
			if (max < 0) {
				return 0;
			}
			if (value < 0) {
				return 0;
			}
			if (value > max) {
				return max;
			}
			return value;
		}

		return {
			resolveInitialGrid,
			resolveCalendarSchema,
			persistCalendar,
			findCalendarRowByValue,
			resolveTimelineValues,
			getGridWidth,
			normalizeGridShape,
			parseCsv,
			gridToCsv,
			resolveColumnLabel,
			downloadCsv,
			resolveExportFileName,
			clampIndex,
		};
	}

	/** @type {any} */ (globalObject).createCalendarUtils = createCalendarUtils;
})(window);
