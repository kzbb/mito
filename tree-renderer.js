// @ts-check

(function registerTreeRenderer(globalObject) {
	/**
	 * @param {{
	 *   resolveEntryName: (entry: any) => string,
	 *   resolveDashboardLabel: (data: any) => string
	 * }} deps
	 */
	function createTreeRenderer(deps) {
		/**
		 * @param {HTMLElement} treeElement
		 * @returns {Set<string> | null}
		 */
		function captureOpenCategories(treeElement) {
			const groups = treeElement.querySelectorAll(".tree-group[data-category]");
			if (groups.length === 0) {
				return null;
			}

			const opened = new Set();
			for (const group of groups) {
				if (!(group instanceof HTMLDetailsElement) || !group.open) {
					continue;
				}

				const category = group.dataset.category;
				if (typeof category === "string" && category.length > 0) {
					opened.add(category);
				}
			}

			return opened;
		}

		/**
		 * @param {HTMLElement} treeElement
		 * @param {Map<string, any[]>} grouped
		 * @param {(entry: any, button: HTMLButtonElement) => void} onEntrySelect
		 * @param {Set<string> | null} openCategories
		 * @returns {any}
		 */
		function renderCategoryTree(treeElement, grouped, onEntrySelect, openCategories) {
			/** @type {any} */
			let firstSelection = null;

			for (const [category, entries] of grouped.entries()) {
				const details = document.createElement("details");
				details.className = "tree-group";
				details.open = openCategories ? openCategories.has(category) : false;
				details.dataset.category = category;

				const summary = document.createElement("summary");
				const label = document.createElement("span");
				label.className = "tree-label";
				label.textContent = category;
				summary.appendChild(label);
				details.appendChild(summary);

				const list = document.createElement("ul");
				for (const entry of entries) {
					const listItem = document.createElement("li");
					const leafButton = document.createElement("button");
					leafButton.type = "button";
					leafButton.className = "tree-leaf tree-leaf-button";
					leafButton.dataset.entryId = String(entry?.id ?? "");
					leafButton.dataset.category = category;
					leafButton.textContent = deps.resolveEntryName(entry);
					leafButton.addEventListener("click", () => {
						onEntrySelect(entry, leafButton);
					});
					listItem.appendChild(leafButton);
					list.appendChild(listItem);

					if (!firstSelection) {
						firstSelection = { type: "active", entry, button: leafButton };
					}
				}

				details.appendChild(list);
				treeElement.appendChild(details);
			}

			return firstSelection;
		}

		/**
		 * @param {HTMLElement} treeElement
		 * @param {any} data
		 * @param {(item: any, button: HTMLButtonElement) => void} onSelect
		 * @returns {any}
		 */
		function renderDashboardItem(treeElement, data, onSelect) {
			const dashboardLabel = deps.resolveDashboardLabel(data);
			if (!dashboardLabel) {
				return null;
			}

			const itemContainer = document.createElement("div");
			itemContainer.className = "tree-item";

			const button = createTreeLeafButton(dashboardLabel);
			button.dataset.role = "dashboard";
			const item = { type: "dashboard", data, button };
			button.addEventListener("click", () => onSelect(item, button));

			itemContainer.appendChild(button);
			treeElement.appendChild(itemContainer);
			return item;
		}

		/**
		 * @param {HTMLElement} treeElement
		 * @param {HTMLButtonElement} button
		 */
		function selectTreeLeaf(treeElement, button) {
			const selected = treeElement.querySelector(".tree-leaf-button.is-selected");
			if (selected instanceof HTMLElement) {
				selected.classList.remove("is-selected");
			}

			button.classList.add("is-selected");
		}

		/**
		 * @param {HTMLElement} treeElement
		 */
		function clearTreeSelection(treeElement) {
			const selected = treeElement.querySelector(".tree-leaf-button.is-selected");
			if (selected instanceof HTMLElement) {
				selected.classList.remove("is-selected");
			}
		}

		/**
		 * @param {any} entry
		 */
		function focusNewEntryInTree(entry) {
			const treeElement = /** @type {HTMLElement | null} */ (document.getElementById("explorer-tree"));
			if (!treeElement) {
				return;
			}

			const category = typeof entry?.category === "string" ? entry.category : "";
			if (category) {
				const details = treeElement.querySelector(`.tree-group[data-category="${cssEscape(category)}"]`);
				if (details instanceof HTMLDetailsElement) {
					details.open = true;
				}
			}

			const entryId = String(entry?.id ?? "");
			if (!entryId) {
				return;
			}

			const button = treeElement.querySelector(`.tree-leaf-button[data-entry-id="${cssEscape(entryId)}"]`);
			if (!(button instanceof HTMLButtonElement)) {
				return;
			}

			selectTreeLeaf(treeElement, button);
			button.scrollIntoView({ block: "nearest" });
		}

		/**
		 * @param {HTMLElement} treeElement
		 * @param {string} message
		 */
		function setTreeMessage(treeElement, message) {
			treeElement.innerHTML = `<div class="tree-item"><span class="tree-leaf">${message}</span></div>`;
		}

		/**
		 * @param {string} label
		 * @returns {HTMLButtonElement}
		 */
		function createTreeLeafButton(label) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "tree-leaf tree-leaf-button";
			button.textContent = label;
			return button;
		}

		/**
		 * @param {string} value
		 * @returns {string}
		 */
		function cssEscape(value) {
			if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
				return CSS.escape(value);
			}

			return value.replace(/(["\\])/g, "\\$1");
		}

		return {
			captureOpenCategories,
			renderCategoryTree,
			renderDashboardItem,
			selectTreeLeaf,
			clearTreeSelection,
			focusNewEntryInTree,
			setTreeMessage,
		};
	}

	/** @type {any} */ (globalObject).createTreeRenderer = createTreeRenderer;
})(window);
