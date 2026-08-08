// @ts-check

(function registerCalendarUtils(globalObject) {
	/**
	 * 直近に解析したカレンダースキーマのキャッシュ。
	 *
	 * resolveCalendarSchema はフォーム入力1文字ごとに複数箇所から呼ばれ、
	 * そのたびCSV全文を1文字ずつ解析し直すため、実データ（数万文字）では
	 * 入力の体感遅延に直結する。csvText が変わらない限り結果を再利用する。
	 *
	 * IIFEのスコープに置くことで、createCalendarUtils を複数回呼んでも
	 * キャッシュは1つに保たれる。
	 *
	 * @type {{ csvText: string, schema: { headers: string[], rows: Record<string, string>[] } } | null}
	 */
	let cachedSchema = null;

	function createCalendarUtils() {
		/**
		 * @param {any} data
		 * @returns {string}
		 */
		function resolveCsvText(data) {
			return typeof data?.calendar?.csvText === "string" ? data.calendar.csvText : "";
		}

		/**
		 * 編集用の可変グリッドを返す。呼び出し側が splice などで書き換えるため、
		 * 毎回新しい配列を組み立てる（キャッシュしてはいけない）。
		 * @param {any} data
		 * @returns {string[][]}
		 */
		function resolveInitialGrid(data) {
			const csvText = resolveCsvText(data);
			if (csvText.length === 0) {
				return [[""]];
			}

			const parsed = parseCsv(csvText);
			return parsed.length > 0 ? parsed : [[""]];
		}

		/**
		 * 読み取り専用のスキーマ（ヘッダーと行レコード）を返す。
		 * 戻り値は呼び出し側で共有されるため、書き換えてはいけない。
		 * @param {any} data
		 * @returns {{ headers: string[], rows: Record<string, string>[] }}
		 */
		function resolveCalendarSchema(data) {
			const csvText = resolveCsvText(data);
			if (cachedSchema && cachedSchema.csvText === csvText) {
				return cachedSchema.schema;
			}

			const schema = parseCalendarSchema(data);
			cachedSchema = { csvText, schema };
			return schema;
		}

		/**
		 * @param {any} data
		 * @returns {{ headers: string[], rows: Record<string, string>[] }}
		 */
		function parseCalendarSchema(data) {
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
			const comparableValue = normalizeComparableText(normalizedValue);
			if (!key || normalizedValue.length === 0) {
				return null;
			}

			for (const row of rows) {
				if (!row || typeof row !== "object") {
					continue;
				}

				const candidate = String(row[key] ?? "").trim();
				if (candidate === normalizedValue) {
					return row;
				}

				if (normalizeComparableText(candidate) === comparableValue) {
					return row;
				}
			}

			return null;
		}

		/**
		 * カレンダー値の表記ゆれを吸収するためにテキストを正規化する。
		 * @param {string} value
		 * @returns {string}
		 */
		function normalizeComparableText(value) {
			return String(value ?? "")
				.normalize("NFKC")
				.replace(/[\u0020\u3000]+/g, "")
				.toLowerCase();
		}

		/**
		 * エントリーのカレンダー値を、ヘッダー名をキーにした形で取り出す。
		 *
		 * 旧スキーマ（`entry.from`）の読み替えはここでは行わない。
		 * 読み込み時に normalizeDocument が `dateCalendar` へ移行済みのため、
		 * 描画時点では常に `dateCalendar` だけを見ればよい。
		 *
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
			// ExcelなどがUTF-8で書き出したCSVは先頭にBOM(U+FEFF)が付く。
			// 残すと最初のヘッダー名が不可視文字付きになり、エントリー側の
			// dateCalendar のキーと一致しなくなるため、ここで落とす。
			const source = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;

			/** @type {string[][]} */
			const rows = [];
			/** @type {string[]} */
			let row = [];
			let cell = "";
			let quoted = false;

			for (let index = 0; index < source.length; index += 1) {
				const ch = source[index];
				const next = source[index + 1] ?? "";

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
