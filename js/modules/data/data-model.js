// @ts-check

(function registerDataModel(globalObject) {
	/**
	 * 現在時刻を日本標準時（JST, UTC+9）のISO 8601文字列で返す。
	 * 例: "2026-03-29T19:00:00.000+09:00"
	 * @returns {string}
	 */
	function nowJST() {
		const now = new Date();
		const jstOffsetMs = 9 * 60 * 60 * 1000;
		const jst = new Date(now.getTime() + jstOffsetMs);
		return jst.toISOString().replace("Z", "+09:00");
	}

	/** @type {any} */ (globalObject).nowJST = nowJST;

	/**
	 * アクティブエントリとプロジェクトメタデータを操作する純粋なデータヘルパーを生成する。
	 */
	function createDataModel() {
		const createCalendarUtils = /** @type {any} */ (globalObject).createCalendarUtils;
		const calendarUtils = typeof createCalendarUtils === "function" ? createCalendarUtils() : null;

		/**
		 * @param {any} data
		 * @returns {string}
		 */
		function resolveProjectName(data) {
			return typeof data?.project === "string" ? data.project : "プロジェクト";
		}

		/**
		 * @param {any} data
		 * @returns {Map<string, any[]>}
		 */
		function groupActiveEntriesByCategory(data) {
			const grouped = new Map();
			const activeEntries = Array.isArray(data?.active) ? data.active : [];
			const schema = calendarUtils?.resolveCalendarSchema(data) ?? { headers: [], rows: [] };

			for (const entry of activeEntries) {
				if (!entry || typeof entry !== "object") {
					continue;
				}

				const category = typeof entry.category === "string" && entry.category.length > 0
					? entry.category
					: "未分類";
				if (!grouped.has(category)) {
					grouped.set(category, []);
				}
				grouped.get(category).push(entry);
			}

			// 年表と同じく、カレンダーの行位置 → セル内表示順 → ID → 名称で並べる。
			for (const entries of grouped.values()) {
				entries.sort((left, right) => compareEntriesByDashboardPosition(left, right, schema));
			}

			return grouped;
		}

		/**
		 * @param {any} left
		 * @param {any} right
		 * @param {{ headers: string[], rows: Record<string, string>[] }} schema
		 */
		function compareEntriesByDashboardPosition(left, right, schema) {
			const leftRow = findCalendarRowIndex(left, schema);
			const rightRow = findCalendarRowIndex(right, schema);
			const normalizedLeftRow = leftRow < 0 ? Number.MAX_SAFE_INTEGER : leftRow;
			const normalizedRightRow = rightRow < 0 ? Number.MAX_SAFE_INTEGER : rightRow;
			if (normalizedLeftRow !== normalizedRightRow) return normalizedLeftRow - normalizedRightRow;

			const leftOrder = resolveNonNegativeInteger(left?.dashboardOrder, 0);
			const rightOrder = resolveNonNegativeInteger(right?.dashboardOrder, 0);
			if (leftOrder !== rightOrder) return leftOrder - rightOrder;

			const leftId = resolveNonNegativeInteger(left?.id, Number.MAX_SAFE_INTEGER);
			const rightId = resolveNonNegativeInteger(right?.id, Number.MAX_SAFE_INTEGER);
			if (leftId !== rightId) return leftId - rightId;

			return String(left?.name ?? "").localeCompare(String(right?.name ?? ""), "ja");
		}

		/** 年表と同じく、日付値が最も多く一致するカレンダー行を返す。 */
		function findCalendarRowIndex(entry, schema) {
			if (!calendarUtils || schema.headers.length === 0 || schema.rows.length === 0) return -1;
			const values = calendarUtils.resolveTimelineValues(entry, "date", schema.headers);
			let bestIndex = -1;
			let bestScore = 0;
			for (let index = 0; index < schema.rows.length; index += 1) {
				let score = 0;
				for (const header of schema.headers) {
					const entryValue = String(values[header] ?? "").trim();
					const rowValue = String(schema.rows[index]?.[header] ?? "").trim();
					if (entryValue && entryValue === rowValue) score += 1;
				}
				if (score > bestScore) {
					bestScore = score;
					bestIndex = index;
				}
			}
			return bestIndex;
		}

		function resolveNonNegativeInteger(value, fallback) {
			const parsed = Number.parseInt(String(value ?? ""), 10);
			return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
		}

		/**
		 * @param {any} data
		 * @returns {number}
		 */
		function getNextActiveId(data) {
			const activeEntries = Array.isArray(data?.active) ? data.active : [];
			let maxId = 0;

			for (const entry of activeEntries) {
				const numericId = typeof entry?.id === "number"
					? entry.id
					: Number.parseInt(String(entry?.id ?? ""), 10);

				if (Number.isFinite(numericId)) {
					maxId = Math.max(maxId, numericId);
				}
			}

			return maxId + 1;
		}

		/**
		 * @param {any} data
		 * @param {string | null} entryId
		 * @returns {number}
		 */
		function findActiveEntryIndexById(data, entryId) {
			if (!entryId) {
				return -1;
			}

			const activeEntries = Array.isArray(data?.active) ? data.active : [];
			for (let i = 0; i < activeEntries.length; i += 1) {
				if (String(activeEntries[i]?.id ?? "") === entryId) {
					return i;
				}
			}

			return -1;
		}

		/**
		 * @param {any} data
		 * @param {string | null} entryId
		 * @returns {any | null}
		 */
		function findActiveEntryById(data, entryId) {
			const index = findActiveEntryIndexById(data, entryId);
			if (index < 0) {
				return null;
			}

			return data.active[index];
		}

		return {
			resolveProjectName,
			groupActiveEntriesByCategory,
			getNextActiveId,
			findActiveEntryIndexById,
			findActiveEntryById,
		};
	}

	/** @type {any} */ (globalObject).createDataModel = createDataModel;
})(window);
