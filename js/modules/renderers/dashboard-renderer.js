// @ts-check

(function registerDashboardRenderer(globalObject) {
	/**
	 * @param {{
	 *   onEnterEditMode: (entry: any) => void,
	 *   resolveEntryName: (entry: any) => string,
	 *   resolveDashboardLabel: (data: any) => string
	 * }} deps
	 */
	function createDashboardRenderer(deps) {
		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} data
		 */
		function renderDashboardOverview(mainElement, data) {
			mainElement.classList.remove("settings-view");
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
			).sort(compareEntriesByFrom);

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
			for (const entry of targetEntries) {
				list.appendChild(createDashboardCard(entry));
			}
			mainElement.appendChild(list);
		}

		/**
		 * @param {any} entry
		 * @returns {HTMLElement}
		 */
		function createDashboardCard(entry) {
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
			const fromValue = formatFieldValue(entry?.from) || "-";
			const toValue = formatFieldValue(entry?.to) || "-";
			timeRail.appendChild(createDashboardTimeRow("from", fromValue));
			timeRail.appendChild(createDashboardTimeRow("to", toValue));
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
		 * @param {string} label
		 * @param {string} value
		 * @returns {HTMLElement}
		 */
		function createDashboardTimeRow(label, value) {
			const row = document.createElement("div");
			row.className = "dashboard-time-row";

			const rowLabel = document.createElement("span");
			rowLabel.className = "dashboard-time-label";
			rowLabel.textContent = label;
			row.appendChild(rowLabel);

			const rowValue = document.createElement("span");
			rowValue.className = "dashboard-time-value";
			rowValue.textContent = value;
			row.appendChild(rowValue);

			return row;
		}

		/**
		 * @param {any} left
		 * @param {any} right
		 * @returns {number}
		 */
		function compareEntriesByFrom(left, right) {
			const leftFrom = resolveSortFrom(left);
			const rightFrom = resolveSortFrom(right);

			if (leftFrom === rightFrom) {
				return deps.resolveEntryName(left).localeCompare(deps.resolveEntryName(right), "ja");
			}

			return leftFrom.localeCompare(rightFrom, "ja");
		}

		/**
		 * @param {any} entry
		 * @returns {string}
		 */
		function resolveSortFrom(entry) {
			if (typeof entry?.from === "string" && entry.from.length > 0) {
				return entry.from;
			}

			return "9999-99-99T99:99:99";
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
