// @ts-check

(function registerDashboardRenderer(globalObject) {
	/**
	 * @param {{
	 *   getCurrentData: () => any,
	 *   onEnterEditMode: (entry: any) => void,
	 *   resolveEntryName: (entry: any) => string,
	 *   resolveDashboardLabel: (data: any) => string
	 * }} deps
	 */
	function createDashboardRenderer(deps) {
		const createCalendarUtils = /** @type {any} */ (globalObject).createCalendarUtils;
		const calendarUtils = typeof createCalendarUtils === "function" ? createCalendarUtils() : null;
		const resolveCalendarSchema = calendarUtils?.resolveCalendarSchema ?? (() => ({ headers: [], rows: [] }));
		const resolveTimelineValues = calendarUtils?.resolveTimelineValues
			?? ((/** @type {any} */ _entry, /** @type {string} */ _key, /** @type {string[]} */ headers) => {
				/** @type {Record<string, string>} */
				const values = {};
				for (const header of headers) {
					values[header] = "";
				}
				return values;
			});
		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} data
		 */
		function renderDashboardOverview(mainElement, data) {
			mainElement.classList.remove("settings-view");
			mainElement.classList.remove("calendar-editor-view");
			mainElement.innerHTML = "";

			const title = document.createElement("h2");
			title.textContent = deps.resolveDashboardLabel(data);
			mainElement.appendChild(title);

			const focusCategory = typeof data?.settings?.focusCategory === "string"
				? data.settings.focusCategory
				: typeof data?.settings?.masterCategory === "string"
					? data.settings.masterCategory
					: "出来事";
			const activeEntries = Array.isArray(data?.active) ? data.active : [];
			const targetEntries = activeEntries.filter(
				/** @param {any} entry */
				(entry) => entry?.category === focusCategory,
			).sort(compareEntriesByDate);

			const meta = document.createElement("p");
			meta.className = "entry-meta";
			meta.textContent = `${focusCategory}: ${targetEntries.length}件`;
			mainElement.appendChild(meta);

			if (targetEntries.length === 0) {
				const empty = document.createElement("p");
				empty.textContent = `${focusCategory}の項目はありません。`;
				mainElement.appendChild(empty);
				return;
			}

			const list = document.createElement("div");
			list.className = "dashboard-cards";
			const schema = resolveCalendarSchema(data);
			for (const entry of targetEntries) {
				list.appendChild(createDashboardCard(entry, schema.headers));
			}
			mainElement.appendChild(list);
		}

		/**
		 * @param {any} entry
		 * @param {string[]} headers
		 * @returns {HTMLElement}
		 */
		function createDashboardCard(entry, headers) {
			const card = document.createElement("article");
			card.className = "dashboard-card";
			card.tabIndex = 0;
			card.role = "button";
			card.setAttribute("aria-label", `${deps.resolveEntryName(entry)} を編集`);

			const openEditor = () => {
				deps.onEnterEditMode(entry);
			};

			card.addEventListener("click", openEditor);
			card.addEventListener("keydown", /** @param {KeyboardEvent} event */ (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					openEditor();
				}
			});

			const timeRail = document.createElement("div");
			timeRail.className = "dashboard-card-time";
			const dateValues = resolveTimelineValueParts(entry, headers);
			timeRail.appendChild(createDashboardTimeRow(dateValues));
			card.appendChild(timeRail);

			const body = document.createElement("div");
			body.className = "dashboard-card-body";

			const title = document.createElement("h3");
			title.className = "dashboard-card-title";
			title.textContent = deps.resolveEntryName(entry);
			body.appendChild(title);

			if (typeof entry?.description === "string" && entry.description.length > 0) {
				const description = document.createElement("p");
				description.className = "dashboard-card-description";
				description.textContent = entry.description;
				body.appendChild(description);
			}

			card.appendChild(body);

			return card;
		}

		/**
		 * @param {string[]} values
		 * @returns {HTMLElement}
		 */
		function createDashboardTimeRow(values) {
			const row = document.createElement("div");
			row.className = "dashboard-time-row";

			for (const value of values) {
				const item = document.createElement("div");
				item.className = "dashboard-time-value";
				item.textContent = value;
				row.appendChild(item);
			}

			return row;
		}

		/**
		 * @param {any} left
		 * @param {any} right
		 * @returns {number}
		 */
		function compareEntriesByDate(left, right) {
			const currentData = deps.getCurrentData?.() ?? null;
			const schema = resolveCalendarSchema(currentData);
			const leftDate = resolveSortDate(left, schema.headers);
			const rightDate = resolveSortDate(right, schema.headers);

			if (leftDate === rightDate) {
				return deps.resolveEntryName(left).localeCompare(deps.resolveEntryName(right), "ja");
			}

			return leftDate.localeCompare(rightDate, "ja");
		}

		/**
		 * @param {any} entry
		 * @param {string[]} headers
		 * @returns {string}
		 */
		function resolveSortDate(entry, headers) {
			if (Array.isArray(headers) && headers.length > 0) {
				const firstHeader = headers[0];
				const timelineValues = resolveTimelineValues(entry, "date", headers);
				const dateValue = String(timelineValues[firstHeader] ?? "").trim();
				if (dateValue.length > 0) {
					return dateValue;
				}
			}

			if (typeof entry?.date === "string" && entry.date.length > 0) {
				return entry.date;
			}

			if (typeof entry?.from === "string" && entry.from.length > 0) {
				return entry.from;
			}

			return "9999-99-99T99:99:99";
		}

		/**
		 * @param {any} entry
		 * @param {string[]} headers
		 * @returns {string[]}
		 */
		function resolveTimelineValueParts(entry, headers) {
			if (Array.isArray(headers) && headers.length > 0) {
				const values = resolveTimelineValues(entry, "date", headers);
				const parts = headers
					.map((header) => {
						const value = String(values[header] ?? "").trim();
						return value.length > 0 ? value : "";
					})
					.filter((part) => part.length > 0);
				if (parts.length > 0) {
					return parts;
				}
			}

			if (typeof entry?.date === "string" && entry.date.length > 0) {
				return [entry.date];
			}

			const fallback = formatFieldValue(entry?.from);
			return [fallback || "-"];
		}

		/**
		 * @param {unknown} value
		 * @returns {string}
		 */
		function formatFieldValue(value) {
			if (typeof value === "string") {
				return value;
			}

			if (value === null || value === undefined) {
				return "";
			}

			return String(value);
		}

		return {
			renderDashboardOverview,
		};
	}

	/** @type {any} */ (globalObject).createDashboardRenderer = createDashboardRenderer;
})(window);
