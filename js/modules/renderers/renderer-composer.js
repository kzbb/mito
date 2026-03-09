// @ts-check

(function registerRendererComposer(globalObject) {
	/**
	 * Create renderer helpers with app-level callbacks.
	 * @param {{
	 *   getCurrentData: () => any,
	 *   onEnterEditMode: (entry: any) => void,
	 *   onUpdateEntryFromDetail: (entry: any, payload: Record<string, string>) => any | null,
	 *   onSetFormStatus: (message: string) => void,
	 *   onSetTopbarSaveStatus: (message: string) => void,
	 *   onProjectNameInput: (nextProject: string) => void
	 * }} deps
	 */
	function createRendererComposer(deps) {
		/**
		 * @param {any} entry
		 * @returns {string}
		 */
		function resolveEntryName(entry) {
			if (typeof entry?.name === "string" && entry.name.length > 0) {
				return entry.name;
			}

			return `項目${entry?.id ?? ""}`;
		}

		/**
		 * @param {any} data
		 * @returns {string}
		 */
		function resolveDashboardLabel(data) {
			if (typeof data?.settings?.dashboardLabel === "string" && data.settings.dashboardLabel.length > 0) {
				return data.settings.dashboardLabel;
			}

			if (typeof data?.settings?.masterCategoryDashboard === "string" && data.settings.masterCategoryDashboard.length > 0) {
				return data.settings.masterCategoryDashboard;
			}

			return "ダッシュボード";
		}

		/**
		 * @param {HTMLElement} mainElement
		 * @param {string} message
		 */
		function renderMainMessage(mainElement, message) {
			mainElement.classList.remove("settings-view");
			mainElement.innerHTML = "";
			const title = document.createElement("h2");
			title.textContent = "Main Content";
			const paragraph = document.createElement("p");
			paragraph.textContent = message;
			mainElement.appendChild(title);
			mainElement.appendChild(paragraph);
		}

		const createEntryDetailRenderer = /** @type {any} */ (globalObject).createEntryDetailRenderer;
		const createSettingsRenderer = /** @type {any} */ (globalObject).createSettingsRenderer;
		const createDashboardRenderer = /** @type {any} */ (globalObject).createDashboardRenderer;

		const entryDetailApi = typeof createEntryDetailRenderer === "function"
			? createEntryDetailRenderer({
				onUpdateEntryFromDetail: deps.onUpdateEntryFromDetail,
				onSetFormStatus: deps.onSetFormStatus,
				onSetTopbarSaveStatus: deps.onSetTopbarSaveStatus,
				resolveEntryName,
			})
			: null;

		const settingsApi = typeof createSettingsRenderer === "function"
			? createSettingsRenderer({
				getCurrentData: deps.getCurrentData,
				onSetFormStatus: deps.onSetFormStatus,
				onSetTopbarSaveStatus: deps.onSetTopbarSaveStatus,
				onProjectNameInput: deps.onProjectNameInput,
				resolveEntryName,
				resolveDashboardLabel,
			})
			: null;

		const dashboardApi = typeof createDashboardRenderer === "function"
			? createDashboardRenderer({
				onEnterEditMode: deps.onEnterEditMode,
				resolveEntryName,
				resolveDashboardLabel,
			})
			: null;

		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} entry
		 */
		function renderEntryDetail(mainElement, entry) {
			if (entryDetailApi && typeof entryDetailApi.renderEntryDetail === "function") {
				entryDetailApi.renderEntryDetail(mainElement, entry);
				return;
			}

			renderMainMessage(mainElement, "個別表示モジュールの読み込みに失敗しました。");
		}

		/**
		 * @param {any} data
		 * @param {(item: any) => void} onSelect
		 * @returns {any}
		 */
		function renderSettingsButton(data, onSelect) {
			if (settingsApi && typeof settingsApi.renderSettingsButton === "function") {
				return settingsApi.renderSettingsButton(data, onSelect);
			}

			return null;
		}

		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} data
		 */
		function renderSettingsOverview(mainElement, data) {
			if (settingsApi && typeof settingsApi.renderSettingsOverview === "function") {
				settingsApi.renderSettingsOverview(mainElement, data);
				return;
			}

			renderMainMessage(mainElement, "設定表示モジュールの読み込みに失敗しました。");
		}

		/**
		 * @param {string} projectName
		 */
		function updateOutlineProjectName(projectName) {
			if (settingsApi && typeof settingsApi.updateOutlineProjectName === "function") {
				settingsApi.updateOutlineProjectName(projectName);
			}
		}

		/**
		 * @param {any} data
		 */
		function updateDashboardButtonLabel(data) {
			if (settingsApi && typeof settingsApi.updateDashboardButtonLabel === "function") {
				settingsApi.updateDashboardButtonLabel(data);
			}
		}

		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} data
		 */
		function renderDashboardOverview(mainElement, data) {
			if (dashboardApi && typeof dashboardApi.renderDashboardOverview === "function") {
				dashboardApi.renderDashboardOverview(mainElement, data);
				return;
			}

			renderMainMessage(mainElement, "ダッシュボード表示モジュールの読み込みに失敗しました。");
		}

		return {
			resolveEntryName,
			resolveDashboardLabel,
			renderMainMessage,
			renderEntryDetail,
			renderSettingsButton,
			renderSettingsOverview,
			updateOutlineProjectName,
			updateDashboardButtonLabel,
			renderDashboardOverview,
		};
	}

	/** @type {any} */ (globalObject).createRendererComposer = createRendererComposer;
})(window);
