// @ts-check

(function registerAppModuleInitializers(globalObject) {
	/**
	 * @param {{
	 *   getCurrentData: () => any,
	 *   setCurrentData: (data: any) => void,
	 *   getEditingEntryId: () => string | null,
	 *   setEditingEntryId: (entryId: string | null) => void,
	 *   getCurrentFileName: () => string,
	 *   setCurrentFileName: (fileName: string) => void,
	 *   getCurrentFileHandle: () => any | null,
	 *   setCurrentFileHandle: (fileHandle: any | null) => void,
	 *   getRendererApi: () => any,
	 *   setRendererApi: (api: any | null) => void,
	 *   getTreeApi: () => any,
	 *   setTreeApi: (api: any | null) => void,
	 *   getFormApi: () => any,
	 *   setFormApi: (api: any | null) => void,
	 *   getModelApi: () => any,
	 *   setModelApi: (api: any | null) => void,
	 *   getPersistenceApi: () => any,
	 *   setPersistenceApi: (api: any | null) => void,
	 *   getDocumentActionsApi: () => any,
	 *   setDocumentActionsApi: (api: any | null) => void,
	 *   getOutlineViewApi: () => any,
	 *   setOutlineViewApi: (api: any | null) => void,
	 *   getBridgeApi: () => any,
	 *   setBridgeApi: (api: any | null) => void,
	 *   normalizeSettingsKeys: (data: any) => void,
	 *   renderOutlineFromData: (data: any) => void,
	 *   setFormStatus: (message: string) => void,
	 *   setTopbarSaveStatus: (message: string) => void,
	 *   renderFileLoadError: (message: string) => void
	 * }} deps
	 */
	function createAppModuleInitializers(deps) {
		/**
		 * Initialize tree/renderer/model/form bridge helpers from external module.
		 */
		function initializeBridgeModule() {
			const createAppBridge = /** @type {any} */ (globalObject).createAppBridge;
			if (typeof createAppBridge !== "function") {
				return;
			}

			deps.setBridgeApi(createAppBridge({
				getRendererApi: deps.getRendererApi,
				getTreeApi: deps.getTreeApi,
				getFormApi: deps.getFormApi,
				getModelApi: deps.getModelApi,
				getCurrentData: deps.getCurrentData,
			}));
		}

		/**
		 * Initialize pure data helpers from external module.
		 */
		function initializeDataModel() {
			const createDataModel = /** @type {any} */ (globalObject).createDataModel;
			if (typeof createDataModel !== "function") {
				return;
			}

			deps.setModelApi(createDataModel());
		}

		/**
		 * Initialize persistence helpers from external module.
		 */
		function initializePersistenceModule() {
			const createPersistenceModule = /** @type {any} */ (globalObject).createPersistenceModule;
			if (typeof createPersistenceModule !== "function") {
				return;
			}

			deps.setPersistenceApi(createPersistenceModule({
				getCurrentData: deps.getCurrentData,
				getCurrentFileName: deps.getCurrentFileName,
				getCurrentFileHandle: deps.getCurrentFileHandle,
				setCurrentFileName: deps.setCurrentFileName,
				setCurrentFileHandle: deps.setCurrentFileHandle,
			}));
		}

		/**
		 * Initialize outline rendering helpers from external module.
		 */
		function initializeOutlineViewModule() {
			const createAppOutlineView = /** @type {any} */ (globalObject).createAppOutlineView;
			if (typeof createAppOutlineView !== "function") {
				return;
			}

			deps.setOutlineViewApi(createAppOutlineView({
				getEditingEntryId: deps.getEditingEntryId,
				normalizeSettingsKeys: deps.normalizeSettingsKeys,
				resolveProjectName: (/** @type {any} */ data) => deps.getBridgeApi()?.resolveProjectName?.(data) ?? (typeof data?.project === "string" ? data.project : "プロジェクト"),
				groupActiveEntriesByCategory: (/** @type {any} */ data) => deps.getBridgeApi()?.groupActiveEntriesByCategory?.(data) ?? new Map(),
				captureOpenCategories: (/** @type {HTMLElement} */ treeElement) => deps.getBridgeApi()?.captureOpenCategories?.(treeElement) ?? null,
				renderDashboardItem: (/** @type {HTMLElement} */ treeElement, /** @type {any} */ data, /** @type {(item: any, button: HTMLButtonElement) => void} */ onSelect) => deps.getBridgeApi()?.renderDashboardItem?.(treeElement, data, onSelect) ?? null,
				selectTreeLeaf: (/** @type {HTMLElement} */ treeElement, /** @type {HTMLButtonElement} */ button) => {
					deps.getBridgeApi()?.selectTreeLeaf?.(treeElement, button);
				},
				renderDashboardOverview: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ data) => {
					deps.getBridgeApi()?.renderDashboardOverview?.(mainElement, data);
				},
				renderCategoryTree: (/** @type {HTMLElement} */ treeElement, /** @type {Map<string, any[]>} */ grouped, /** @type {(entry: any, button: HTMLButtonElement) => void} */ onEntrySelect, /** @type {Set<string> | null} */ openCategories) => deps.getBridgeApi()?.renderCategoryTree?.(treeElement, grouped, onEntrySelect, openCategories) ?? null,
				renderEntryDetail: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ entry) => {
					deps.getBridgeApi()?.renderEntryDetail?.(mainElement, entry);
				},
				renderSettingsButton: (/** @type {any} */ data, /** @type {(item: any) => void} */ onSelect) => deps.getBridgeApi()?.renderSettingsButton?.(data, onSelect) ?? null,
				clearTreeSelection: (/** @type {HTMLElement} */ treeElement) => {
					deps.getBridgeApi()?.clearTreeSelection?.(treeElement);
				},
				renderSettingsOverview: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ data) => {
					deps.getBridgeApi()?.renderSettingsOverview?.(mainElement, data);
				},
				setTreeMessage: (/** @type {HTMLElement} */ treeElement, /** @type {string} */ message) => {
					deps.getBridgeApi()?.setTreeMessage?.(treeElement, message);
				},
				renderMainMessage: (/** @type {HTMLElement} */ mainElement, /** @type {string} */ message) => {
					deps.getBridgeApi()?.renderMainMessage?.(mainElement, message);
				},
				findActiveEntryById: (/** @type {any} */ data, /** @type {string | null} */ entryId) => deps.getBridgeApi()?.findActiveEntryById?.(data, entryId) ?? null,
				setFormModeAdd: () => {
					deps.getBridgeApi()?.setFormModeAdd?.();
				},
				setCurrentData: deps.setCurrentData,
			}));
		}

		/**
		 * Initialize open/new/template helpers from external module.
		 */
		function initializeDocumentActionsModule() {
			const createAppDocumentActions = /** @type {any} */ (globalObject).createAppDocumentActions;
			if (typeof createAppDocumentActions !== "function") {
				return;
			}

			deps.setDocumentActionsApi(createAppDocumentActions({
				renderOutlineFromData: deps.renderOutlineFromData,
				setFormModeAdd: () => {
					deps.getBridgeApi()?.setFormModeAdd?.();
				},
				setFormStatus: deps.setFormStatus,
				setTopbarSaveStatus: deps.setTopbarSaveStatus,
				setCurrentFileName: deps.setCurrentFileName,
				setCurrentFileHandle: deps.setCurrentFileHandle,
				renderFileLoadError: deps.renderFileLoadError,
			}));
		}

		/**
		 * Initialize rendering helpers from external module.
		 */
		function initializeRenderers() {
			const createRendererComposer = /** @type {any} */ (globalObject).createRendererComposer;
			if (typeof createRendererComposer !== "function") {
				return;
			}

			deps.setRendererApi(createRendererComposer({
				getCurrentData: deps.getCurrentData,
				onEnterEditMode: (/** @type {any} */ entry) => {
					deps.getBridgeApi()?.enterEditMode?.(entry);
				},
				onUpdateEntryFromDetail: (/** @type {any} */ entry, /** @type {Record<string, any>} */ payload) => {
					const currentData = deps.getCurrentData();
					if (!currentData) {
						return null;
					}

					const entryId = String(entry?.id ?? "");
					const targetIndex = deps.getBridgeApi()?.findActiveEntryIndexById?.(currentData, entryId) ?? -1;
					if (targetIndex < 0) {
						return null;
					}

					const updatedEntry = { ...currentData.active[targetIndex], ...payload };
					currentData.active[targetIndex] = updatedEntry;
					deps.renderOutlineFromData(currentData);
					deps.getBridgeApi()?.focusNewEntryInTree?.(updatedEntry);

					const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));
					if (mainElement) {
						deps.getBridgeApi()?.renderEntryDetail?.(mainElement, updatedEntry);
					}

					if (deps.getEditingEntryId() && deps.getEditingEntryId() === entryId) {
						deps.getBridgeApi()?.enterEditMode?.(updatedEntry);
					}

					return updatedEntry;
				},
				onSetFormStatus: deps.setFormStatus,
				onSetTopbarSaveStatus: deps.setTopbarSaveStatus,
				onProjectNameInput: (/** @type {string} */ nextProject) => {
					const currentData = deps.getCurrentData();
					if (!currentData || typeof currentData !== "object") {
						return;
					}

					currentData.project = nextProject;
					deps.getBridgeApi()?.updateOutlineProjectName?.(nextProject);
				},
				onOpenCalendarEditor: () => {
					const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));
					const currentData = deps.getCurrentData();
					if (!mainElement || !currentData) {
						return;
					}

					const rendererApi = deps.getRendererApi();
					if (rendererApi && typeof rendererApi.renderCalendarEditor === "function") {
						rendererApi.renderCalendarEditor(mainElement, currentData);
					}
				},
			}));
		}

		/**
		 * Initialize tree rendering helpers from external module.
		 */
		function initializeTreeRenderer() {
			const createTreeRenderer = /** @type {any} */ (globalObject).createTreeRenderer;
			if (typeof createTreeRenderer !== "function") {
				return;
			}

			deps.setTreeApi(createTreeRenderer({
				resolveEntryName: (/** @type {any} */ entry) => deps.getBridgeApi()?.resolveEntryName?.(entry) ?? `項目${entry?.id ?? ""}`,
				resolveDashboardLabel: (/** @type {any} */ data) => deps.getBridgeApi()?.resolveDashboardLabel?.(data) ?? "ダッシュボード",
			}));
		}

		/**
		 * Initialize entry form helpers from external module.
		 */
		function initializeEntryFormModule() {
			const createEntryFormModule = /** @type {any} */ (globalObject).createEntryFormModule;
			if (typeof createEntryFormModule !== "function") {
				return;
			}

			deps.setFormApi(createEntryFormModule({
				getCurrentData: deps.getCurrentData,
				getEditingEntryId: deps.getEditingEntryId,
				setEditingEntryId: deps.setEditingEntryId,
				resolveDashboardLabel: (/** @type {any} */ data) => deps.getBridgeApi()?.resolveDashboardLabel?.(data) ?? "ダッシュボード",
				setFormStatus: deps.setFormStatus,
				findActiveEntryIndexById: (/** @type {any} */ data, /** @type {string | null} */ entryId) => deps.getBridgeApi()?.findActiveEntryIndexById?.(data, entryId) ?? -1,
				getNextActiveId: (/** @type {any} */ data) => deps.getBridgeApi()?.getNextActiveId?.(data) ?? 1,
				renderOutlineFromData: deps.renderOutlineFromData,
				renderDashboardOverview: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ data) => {
					deps.getBridgeApi()?.renderDashboardOverview?.(mainElement, data);
				},
				focusNewEntryInTree: (/** @type {any} */ entry) => {
					deps.getBridgeApi()?.focusNewEntryInTree?.(entry);
				},
				renderEntryDetail: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ entry) => {
					deps.getBridgeApi()?.renderEntryDetail?.(mainElement, entry);
				},
			}));
		}

		function initializeAllModules() {
			initializeBridgeModule();
			initializeRenderers();
			initializeTreeRenderer();
			initializeEntryFormModule();
			initializeDataModel();
			initializePersistenceModule();
			initializeOutlineViewModule();
			initializeDocumentActionsModule();
		}

		return {
			initializeAllModules,
			initializeBridgeModule,
			initializeRenderers,
			initializeTreeRenderer,
			initializeEntryFormModule,
			initializeDataModel,
			initializePersistenceModule,
			initializeOutlineViewModule,
			initializeDocumentActionsModule,
		};
	}

	/** @type {any} */ (globalObject).createAppModuleInitializers = createAppModuleInitializers;
})(window);
