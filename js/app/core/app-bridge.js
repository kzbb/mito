// @ts-check

(function registerAppBridge(globalObject) {
	/**
	 * @param {{
	 *   getRendererApi: () => any | null,
	 *   getTreeApi: () => any | null,
	 *   getFormApi: () => any | null,
	 *   getModelApi: () => any | null,
	 *   getCurrentData: () => any | null
	 * }} deps
	 */
	function createAppBridge(deps) {
		/** @param {HTMLElement} treeElement */
		function captureOpenCategories(treeElement) {
			const treeApi = deps.getTreeApi();
			if (treeApi && typeof treeApi.captureOpenCategories === "function") {
				return treeApi.captureOpenCategories(treeElement);
			}
			return null;
		}

		/** @param {any} data */
		function resolveProjectName(data) {
			const modelApi = deps.getModelApi();
			if (modelApi && typeof modelApi.resolveProjectName === "function") {
				return modelApi.resolveProjectName(data);
			}
			return typeof data?.project === "string" ? data.project : "プロジェクト";
		}

		/** @param {any} data */
		function groupActiveEntriesByCategory(data) {
			const modelApi = deps.getModelApi();
			if (modelApi && typeof modelApi.groupActiveEntriesByCategory === "function") {
				return modelApi.groupActiveEntriesByCategory(data);
			}
			return new Map();
		}

		/** @param {HTMLElement} treeElement @param {Map<string, any[]>} grouped @param {(entry: any, button: HTMLButtonElement) => void} onEntrySelect @param {Set<string> | null} openCategories */
		function renderCategoryTree(treeElement, grouped, onEntrySelect, openCategories) {
			const treeApi = deps.getTreeApi();
			if (treeApi && typeof treeApi.renderCategoryTree === "function") {
				return treeApi.renderCategoryTree(treeElement, grouped, onEntrySelect, openCategories);
			}
			return null;
		}

		/** @param {HTMLElement} treeElement @param {any} data @param {(item: any, button: HTMLButtonElement) => void} onSelect */
		function renderDashboardItem(treeElement, data, onSelect) {
			const treeApi = deps.getTreeApi();
			if (treeApi && typeof treeApi.renderDashboardItem === "function") {
				return treeApi.renderDashboardItem(treeElement, data, onSelect);
			}
			return null;
		}

		/** @param {any} data */
		function resolveDashboardLabel(data) {
			const rendererApi = deps.getRendererApi();
			if (rendererApi && typeof rendererApi.resolveDashboardLabel === "function") {
				return rendererApi.resolveDashboardLabel(data);
			}
			if (typeof data?.settings?.dashboardLabel === "string" && data.settings.dashboardLabel.length > 0) {
				return data.settings.dashboardLabel;
			}
			if (typeof data?.settings?.masterCategoryDashboard === "string" && data.settings.masterCategoryDashboard.length > 0) {
				return data.settings.masterCategoryDashboard;
			}
			return "ダッシュボード";
		}

		/** @param {HTMLElement} treeElement @param {HTMLButtonElement} button */
		function selectTreeLeaf(treeElement, button) {
			const treeApi = deps.getTreeApi();
			if (treeApi && typeof treeApi.selectTreeLeaf === "function") {
				treeApi.selectTreeLeaf(treeElement, button);
			}
		}

		/** @param {HTMLElement} treeElement */
		function clearTreeSelection(treeElement) {
			const treeApi = deps.getTreeApi();
			if (treeApi && typeof treeApi.clearTreeSelection === "function") {
				treeApi.clearTreeSelection(treeElement);
			}
		}

		/** @param {any} entry */
		function focusNewEntryInTree(entry) {
			const treeApi = deps.getTreeApi();
			if (treeApi && typeof treeApi.focusNewEntryInTree === "function") {
				treeApi.focusNewEntryInTree(entry);
			}
		}

		/** @param {HTMLElement} treeElement @param {string} message */
		function setTreeMessage(treeElement, message) {
			const treeApi = deps.getTreeApi();
			if (treeApi && typeof treeApi.setTreeMessage === "function") {
				treeApi.setTreeMessage(treeElement, message);
			}
		}

		/** @param {any} entry */
		function resolveEntryName(entry) {
			const rendererApi = deps.getRendererApi();
			if (rendererApi && typeof rendererApi.resolveEntryName === "function") {
				return rendererApi.resolveEntryName(entry);
			}
			if (typeof entry?.name === "string" && entry.name.length > 0) {
				return entry.name;
			}
			return `項目${entry?.id ?? ""}`;
		}

		/** @param {HTMLElement} mainElement @param {string} message */
		function renderMainMessage(mainElement, message) {
			const rendererApi = deps.getRendererApi();
			if (rendererApi && typeof rendererApi.renderMainMessage === "function") {
				rendererApi.renderMainMessage(mainElement, message);
				return;
			}
			mainElement.innerHTML = "";
			const paragraph = document.createElement("p");
			paragraph.textContent = message;
			mainElement.appendChild(paragraph);
		}

		/** @param {HTMLElement} mainElement @param {any} entry */
		function renderEntryDetail(mainElement, entry) {
			const rendererApi = deps.getRendererApi();
			if (rendererApi && typeof rendererApi.renderEntryDetail === "function") {
				rendererApi.renderEntryDetail(mainElement, entry);
			}

			const formApi = deps.getFormApi();
			if (formApi && typeof formApi.enterEditMode === "function") {
				formApi.enterEditMode(entry);
			}
		}

		/** @param {any} data @param {(item: any) => void} onSelect */
		function renderSettingsButton(data, onSelect) {
			const rendererApi = deps.getRendererApi();
			if (rendererApi && typeof rendererApi.renderSettingsButton === "function") {
				return rendererApi.renderSettingsButton(data, onSelect);
			}
			return null;
		}

		/** @param {HTMLElement} mainElement @param {any} data */
		function renderSettingsOverview(mainElement, data) {
			const rendererApi = deps.getRendererApi();
			if (rendererApi && typeof rendererApi.renderSettingsOverview === "function") {
				rendererApi.renderSettingsOverview(mainElement, data);
			}
		}

		/** @param {string} projectName */
		function updateOutlineProjectName(projectName) {
			const rendererApi = deps.getRendererApi();
			if (rendererApi && typeof rendererApi.updateOutlineProjectName === "function") {
				rendererApi.updateOutlineProjectName(projectName);
			}
		}

		function updateDashboardButtonLabel() {
			const rendererApi = deps.getRendererApi();
			const currentData = deps.getCurrentData();
			if (rendererApi && typeof rendererApi.updateDashboardButtonLabel === "function" && currentData) {
				rendererApi.updateDashboardButtonLabel(currentData);
			}
		}

		/** @param {HTMLElement} mainElement @param {any} data */
		function renderDashboardOverview(mainElement, data) {
			const rendererApi = deps.getRendererApi();
			if (rendererApi && typeof rendererApi.renderDashboardOverview === "function") {
				rendererApi.renderDashboardOverview(mainElement, data);
			}
		}

		function setupEntryForm() {
			const formApi = deps.getFormApi();
			if (formApi && typeof formApi.setupEntryForm === "function") {
				formApi.setupEntryForm();
			}
		}

		/** @param {any} entry */
		function enterEditMode(entry) {
			const formApi = deps.getFormApi();
			if (formApi && typeof formApi.enterEditMode === "function") {
				formApi.enterEditMode(entry);
			}
		}

		function setFormModeAdd() {
			const formApi = deps.getFormApi();
			if (formApi && typeof formApi.setFormModeAdd === "function") {
				formApi.setFormModeAdd();
			}
		}

		/** @param {any} data */
		function getNextActiveId(data) {
			const modelApi = deps.getModelApi();
			if (modelApi && typeof modelApi.getNextActiveId === "function") {
				return modelApi.getNextActiveId(data);
			}
			return 1;
		}

		/** @param {any} data @param {string | null} entryId */
		function findActiveEntryIndexById(data, entryId) {
			const modelApi = deps.getModelApi();
			if (modelApi && typeof modelApi.findActiveEntryIndexById === "function") {
				return modelApi.findActiveEntryIndexById(data, entryId);
			}
			return -1;
		}

		/** @param {any} data @param {string | null} entryId */
		function findActiveEntryById(data, entryId) {
			const modelApi = deps.getModelApi();
			if (modelApi && typeof modelApi.findActiveEntryById === "function") {
				return modelApi.findActiveEntryById(data, entryId);
			}
			return null;
		}

		return {
			captureOpenCategories,
			resolveProjectName,
			groupActiveEntriesByCategory,
			renderCategoryTree,
			renderDashboardItem,
			resolveDashboardLabel,
			selectTreeLeaf,
			clearTreeSelection,
			focusNewEntryInTree,
			setTreeMessage,
			resolveEntryName,
			renderMainMessage,
			renderEntryDetail,
			renderSettingsButton,
			renderSettingsOverview,
			updateOutlineProjectName,
			updateDashboardButtonLabel,
			renderDashboardOverview,
			setupEntryForm,
			enterEditMode,
			setFormModeAdd,
			getNextActiveId,
			findActiveEntryIndexById,
			findActiveEntryById,
		};
	}

	/** @type {any} */ (globalObject).createAppBridge = createAppBridge;
})(window);
