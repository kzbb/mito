// @ts-check

(function registerAppOutlineView(globalObject) {
	/**
	 * @param {{
	 *   getEditingEntryId: () => string | null,
	 *   normalizeSettingsKeys: (data: any) => void,
	 *   resolveProjectName: (data: any) => string,
	 *   groupActiveEntriesByCategory: (data: any) => Map<string, any[]>,
	 *   captureOpenCategories: (treeElement: HTMLElement) => Set<string> | null,
	 *   renderDashboardItem: (treeElement: HTMLElement, data: any, onSelect: (item: any, button: HTMLButtonElement) => void) => any,
	 *   selectTreeLeaf: (treeElement: HTMLElement, button: HTMLButtonElement) => void,
	 *   renderDashboardOverview: (mainElement: HTMLElement, data: any) => void,
	 *   renderCategoryTree: (treeElement: HTMLElement, grouped: Map<string, any[]>, onEntrySelect: (entry: any, button: HTMLButtonElement) => void, openCategories: Set<string> | null) => any,
	 *   renderEntryDetail: (mainElement: HTMLElement, entry: any) => void,
	 *   renderSettingsButton: (data: any, onSelect: (item: any) => void) => any,
	 *   clearTreeSelection: (treeElement: HTMLElement) => void,
	 *   renderSettingsOverview: (mainElement: HTMLElement, data: any) => void,
	 *   setTreeMessage: (treeElement: HTMLElement, message: string) => void,
	 *   renderMainMessage: (mainElement: HTMLElement, message: string) => void,
	 *   findActiveEntryById: (data: any, entryId: string | null) => any,
	 *   setFormModeAdd: () => void,
	 *   setCurrentData: (data: any) => void
	 * }} deps
	 */
	function createAppOutlineView(deps) {
		/**
		 * Fill category suggestions in the form from existing JSON categories.
		 * @param {any} data
		 */
		function populateCategoryOptions(data) {
			const datalist = /** @type {HTMLDataListElement | null} */ (document.getElementById("category-options"));
			if (!datalist) {
				return;
			}

			const categories = new Set();
			const activeEntries = Array.isArray(data?.active) ? data.active : [];
			const archivedEntries = Array.isArray(data?.archived) ? data.archived : [];

			for (const entry of [...activeEntries, ...archivedEntries]) {
				if (!entry || typeof entry !== "object") {
					continue;
				}

				if (typeof entry.category === "string" && entry.category.trim().length > 0) {
					categories.add(entry.category.trim());
				}
			}

			datalist.innerHTML = "";
			for (const category of Array.from(categories).sort((a, b) => a.localeCompare(b, "ja"))) {
				const option = document.createElement("option");
				option.value = category;
				datalist.appendChild(option);
			}
		}

		/**
		 * Hide the settings button when no file is loaded.
		 */
		function hideSettingsButton() {
			const button = /** @type {HTMLButtonElement | null} */ (document.getElementById("outline-settings"));
			if (!button) {
				return;
			}

			button.hidden = true;
			button.onclick = null;
		}

		/**
		 * Render project outline from loaded JSON into the left panel.
		 * @param {any} data
		 */
		function renderOutlineFromData(data) {
			const scopeElement = document.getElementById("outline-scope");
			const treeElement = /** @type {HTMLElement | null} */ (document.getElementById("explorer-tree"));
			const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));

			if (!scopeElement || !treeElement || !mainElement) {
				return;
			}

			deps.setCurrentData(data);
			deps.normalizeSettingsKeys(data);
			scopeElement.textContent = deps.resolveProjectName(data);
			populateCategoryOptions(data);
			const openCategories = deps.captureOpenCategories(treeElement);
			treeElement.innerHTML = "";

			const grouped = deps.groupActiveEntriesByCategory(data);
			const dashboardSelection = deps.renderDashboardItem(treeElement, data, (item, button) => {
				deps.selectTreeLeaf(treeElement, button);
				deps.renderDashboardOverview(mainElement, item.data);
			});
			const firstSelection = deps.renderCategoryTree(treeElement, grouped, (entry, button) => {
				deps.selectTreeLeaf(treeElement, button);
				deps.renderEntryDetail(mainElement, entry);
			}, openCategories);
			const settingsSelection = deps.renderSettingsButton(data, (item) => {
				deps.clearTreeSelection(treeElement);
				deps.renderSettingsOverview(mainElement, item.data);
			});

			const initialSelection = dashboardSelection ?? firstSelection;
			if (initialSelection) {
				deps.selectTreeLeaf(treeElement, initialSelection.button);
				if (initialSelection.type === "dashboard") {
					deps.renderDashboardOverview(mainElement, initialSelection.data);
				} else if (initialSelection.type === "active") {
					deps.renderEntryDetail(mainElement, initialSelection.entry);
				} else {
					deps.renderMainMessage(mainElement, "表示できるデータがありません");
				}
			}

			if (grouped.size === 0 && !settingsSelection && !dashboardSelection) {
				deps.setTreeMessage(treeElement, "表示できるデータがありません");
				deps.renderMainMessage(mainElement, "表示できるデータがありません");
			}

			const editingEntryId = deps.getEditingEntryId();
			if (editingEntryId && !deps.findActiveEntryById(data, editingEntryId)) {
				deps.setFormModeAdd();
			}
		}

		/**
		 * Reset UI before a file is loaded.
		 */
		function renderWaitingForFile() {
			const scopeElement = document.getElementById("outline-scope");
			const treeElement = /** @type {HTMLElement | null} */ (document.getElementById("explorer-tree"));
			const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));

			if (!scopeElement || !treeElement || !mainElement) {
				return;
			}

			scopeElement.textContent = "未選択";
			hideSettingsButton();
			deps.setTreeMessage(treeElement, "「新規作成」または「開く」で開始してください");
			deps.renderMainMessage(mainElement, "");
			populateCategoryOptions({ active: [], archived: [] });
			deps.setFormModeAdd();
		}

		/**
		 * Show file loading error.
		 * @param {string} message
		 */
		function renderFileLoadError(message) {
			const scopeElement = document.getElementById("outline-scope");
			const treeElement = /** @type {HTMLElement | null} */ (document.getElementById("explorer-tree"));
			const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));

			if (!scopeElement || !treeElement || !mainElement) {
				return;
			}

			scopeElement.textContent = "読み込みエラー";
			deps.setTreeMessage(treeElement, message);
			deps.renderMainMessage(mainElement, message);
		}

		return {
			renderOutlineFromData,
			renderWaitingForFile,
			renderFileLoadError,
		};
	}

	/** @type {any} */ (globalObject).createAppOutlineView = createAppOutlineView;
})(window);
