// @ts-check

(function registerDataModel(globalObject) {
	/**
	 * Create pure data helpers for active entries and project metadata.
	 */
	function createDataModel() {
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

			return grouped;
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
