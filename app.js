// @ts-check

/** @type {any | null} */
let currentData = null;

/** @type {string | null} */
let editingEntryId = null;

/** @type {string} */
let currentFileName = "data.json";

/** @type {any | null} */
let currentFileHandle = null;

/** @type {any | null} */
let rendererApi = null;

/** @type {any | null} */
let treeApi = null;

/** @type {any | null} */
let formApi = null;

/** @type {any | null} */
let modelApi = null;

/** @type {any | null} */
let persistenceApi = null;

/** @type {any | null} */
let documentActionsApi = null;

/** @type {any | null} */
let outlineViewApi = null;

/** @type {any | null} */
let bridgeApi = null;

/**
 * @typedef {{ type: "dashboard", data: any, button: HTMLButtonElement }} DashboardSelection
 * @typedef {{ type: "active", entry: any, button: HTMLButtonElement }} ActiveSelection
 * @typedef {{ type: "setting", data: any, button: HTMLButtonElement }} SettingSelection
 * @typedef {{ type: "archived", entry: any, button: HTMLButtonElement }} ArchivedSelection
 * @typedef {DashboardSelection | ActiveSelection | SettingSelection | ArchivedSelection} SidebarSelection
 */

initializeBridgeModule();
initializeRenderers();
initializeTreeRenderer();
initializeEntryFormModule();
initializeDataModel();
initializePersistenceModule();
initializeOutlineViewModule();
initializeDocumentActionsModule();

/**
 * Initialize tree/renderer/model/form bridge helpers from external module.
 */
function initializeBridgeModule() {
	const createAppBridge = /** @type {any} */ (window).createAppBridge;
	if (typeof createAppBridge !== "function") {
		return;
	}

	bridgeApi = createAppBridge({
		getRendererApi: () => rendererApi,
		getTreeApi: () => treeApi,
		getFormApi: () => formApi,
		getModelApi: () => modelApi,
		getCurrentData: () => currentData,
	});
}

/**
 * Initialize pure data helpers from external module.
 */
function initializeDataModel() {
	const createDataModel = /** @type {any} */ (window).createDataModel;
	if (typeof createDataModel !== "function") {
		return;
	}

	modelApi = createDataModel();
}

/**
 * Initialize persistence helpers from external module.
 */
function initializePersistenceModule() {
	const createPersistenceModule = /** @type {any} */ (window).createPersistenceModule;
	if (typeof createPersistenceModule !== "function") {
		return;
	}

	persistenceApi = createPersistenceModule({
		getCurrentData: () => currentData,
		getCurrentFileName: () => currentFileName,
		getCurrentFileHandle: () => currentFileHandle,
		setCurrentFileName: (/** @type {string} */ fileName) => {
			currentFileName = fileName;
		},
		setCurrentFileHandle: (/** @type {any | null} */ fileHandle) => {
			currentFileHandle = fileHandle;
		},
	});
}

/**
 * Initialize outline rendering helpers from external module.
 */
function initializeOutlineViewModule() {
	const createAppOutlineView = /** @type {any} */ (window).createAppOutlineView;
	if (typeof createAppOutlineView !== "function") {
		return;
	}

	outlineViewApi = createAppOutlineView({
		getEditingEntryId: () => editingEntryId,
		normalizeSettingsKeys: (/** @type {any} */ data) => {
			normalizeSettingsKeys(data);
		},
		resolveProjectName: (/** @type {any} */ data) => bridgeApi?.resolveProjectName?.(data) ?? (typeof data?.project === "string" ? data.project : "プロジェクト"),
		groupActiveEntriesByCategory: (/** @type {any} */ data) => bridgeApi?.groupActiveEntriesByCategory?.(data) ?? new Map(),
		captureOpenCategories: (/** @type {HTMLElement} */ treeElement) => bridgeApi?.captureOpenCategories?.(treeElement) ?? null,
		renderDashboardItem: (/** @type {HTMLElement} */ treeElement, /** @type {any} */ data, /** @type {(item: any, button: HTMLButtonElement) => void} */ onSelect) => bridgeApi?.renderDashboardItem?.(treeElement, data, onSelect) ?? null,
		selectTreeLeaf: (/** @type {HTMLElement} */ treeElement, /** @type {HTMLButtonElement} */ button) => {
			bridgeApi?.selectTreeLeaf?.(treeElement, button);
		},
		renderDashboardOverview: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ data) => {
			bridgeApi?.renderDashboardOverview?.(mainElement, data);
		},
		renderCategoryTree: (/** @type {HTMLElement} */ treeElement, /** @type {Map<string, any[]>} */ grouped, /** @type {(entry: any, button: HTMLButtonElement) => void} */ onEntrySelect, /** @type {Set<string> | null} */ openCategories) => bridgeApi?.renderCategoryTree?.(treeElement, grouped, onEntrySelect, openCategories) ?? null,
		renderEntryDetail: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ entry) => {
			bridgeApi?.renderEntryDetail?.(mainElement, entry);
		},
		renderSettingsButton: (/** @type {any} */ data, /** @type {(item: any) => void} */ onSelect) => bridgeApi?.renderSettingsButton?.(data, onSelect) ?? null,
		clearTreeSelection: (/** @type {HTMLElement} */ treeElement) => {
			bridgeApi?.clearTreeSelection?.(treeElement);
		},
		renderSettingsOverview: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ data) => {
			bridgeApi?.renderSettingsOverview?.(mainElement, data);
		},
		setTreeMessage: (/** @type {HTMLElement} */ treeElement, /** @type {string} */ message) => {
			bridgeApi?.setTreeMessage?.(treeElement, message);
		},
		renderMainMessage: (/** @type {HTMLElement} */ mainElement, /** @type {string} */ message) => {
			bridgeApi?.renderMainMessage?.(mainElement, message);
		},
		findActiveEntryById: (/** @type {any} */ data, /** @type {string | null} */ entryId) => bridgeApi?.findActiveEntryById?.(data, entryId) ?? null,
		setFormModeAdd: () => {
			bridgeApi?.setFormModeAdd?.();
		},
		setCurrentData: (/** @type {any} */ data) => {
			currentData = data;
		},
	});
}

/**
 * Initialize open/new/template helpers from external module.
 */
function initializeDocumentActionsModule() {
	const createAppDocumentActions = /** @type {any} */ (window).createAppDocumentActions;
	if (typeof createAppDocumentActions !== "function") {
		return;
	}

	documentActionsApi = createAppDocumentActions({
		renderOutlineFromData: (/** @type {any} */ data) => {
			renderOutlineFromData(data);
		},
		setFormModeAdd: () => {
			bridgeApi?.setFormModeAdd?.();
		},
		setFormStatus: (/** @type {string} */ message) => {
			setFormStatus(message);
		},
		setTopbarSaveStatus: (/** @type {string} */ message) => {
			setTopbarSaveStatus(message);
		},
		setCurrentFileName: (/** @type {string} */ fileName) => {
			currentFileName = fileName;
		},
		setCurrentFileHandle: (/** @type {any | null} */ fileHandle) => {
			currentFileHandle = fileHandle;
		},
		renderFileLoadError: (/** @type {string} */ message) => {
			renderFileLoadError(message);
		},
	});
}

/**
 * Initialize rendering helpers from external module.
 */
function initializeRenderers() {
	const createRenderers = /** @type {any} */ (window).createRenderers;
	if (typeof createRenderers !== "function") {
		return;
	}

	rendererApi = createRenderers({
		getCurrentData: () => currentData,
		onEnterEditMode: (/** @type {any} */ entry) => {
			bridgeApi?.enterEditMode?.(entry);
		},
		onUpdateEntryFromDetail: (/** @type {any} */ entry, /** @type {Record<string, string>} */ payload) => {
			if (!currentData) {
				return null;
			}

			const entryId = String(entry?.id ?? "");
			const targetIndex = bridgeApi?.findActiveEntryIndexById?.(currentData, entryId) ?? -1;
			if (targetIndex < 0) {
				return null;
			}

			const updatedEntry = { ...currentData.active[targetIndex], ...payload };
			currentData.active[targetIndex] = updatedEntry;
			renderOutlineFromData(currentData);
			bridgeApi?.focusNewEntryInTree?.(updatedEntry);

			const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));
			if (mainElement) {
				bridgeApi?.renderEntryDetail?.(mainElement, updatedEntry);
			}

				// Keep left form independent unless it is already editing this exact entry.
			if (editingEntryId && editingEntryId === entryId) {
				bridgeApi?.enterEditMode?.(updatedEntry);
			}

			return updatedEntry;
		},
		onSetFormStatus: (/** @type {string} */ message) => {
			setFormStatus(message);
		},
		onSetTopbarSaveStatus: (/** @type {string} */ message) => {
			setTopbarSaveStatus(message);
		},
		onProjectNameInput: (/** @type {string} */ nextProject) => {
			if (!currentData || typeof currentData !== "object") {
				return;
			}

			currentData.project = nextProject;
			bridgeApi?.updateOutlineProjectName?.(nextProject);
		},
	});
}

/**
 * Initialize tree rendering helpers from external module.
 */
function initializeTreeRenderer() {
	const createTreeRenderer = /** @type {any} */ (window).createTreeRenderer;
	if (typeof createTreeRenderer !== "function") {
		return;
	}

	treeApi = createTreeRenderer({
		resolveEntryName: (/** @type {any} */ entry) => bridgeApi?.resolveEntryName?.(entry) ?? `項目${entry?.id ?? ""}`,
		resolveDashboardLabel: (/** @type {any} */ data) => bridgeApi?.resolveDashboardLabel?.(data) ?? "ダッシュボード",
	});
}

/**
 * Initialize entry form helpers from external module.
 */
function initializeEntryFormModule() {
	const createEntryFormModule = /** @type {any} */ (window).createEntryFormModule;
	if (typeof createEntryFormModule !== "function") {
		return;
	}

	formApi = createEntryFormModule({
		getCurrentData: () => currentData,
		getEditingEntryId: () => editingEntryId,
		setEditingEntryId: (/** @type {string | null} */ entryId) => {
			editingEntryId = entryId;
		},
		resolveDashboardLabel: (/** @type {any} */ data) => bridgeApi?.resolveDashboardLabel?.(data) ?? "ダッシュボード",
		findActiveEntryIndexById: (/** @type {any} */ data, /** @type {string | null} */ entryId) => bridgeApi?.findActiveEntryIndexById?.(data, entryId) ?? -1,
		getNextActiveId: (/** @type {any} */ data) => bridgeApi?.getNextActiveId?.(data) ?? 1,
		renderOutlineFromData: (/** @type {any} */ data) => {
			renderOutlineFromData(data);
		},
		renderDashboardOverview: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ data) => {
			bridgeApi?.renderDashboardOverview?.(mainElement, data);
		},
		focusNewEntryInTree: (/** @type {any} */ entry) => {
			bridgeApi?.focusNewEntryInTree?.(entry);
		},
		renderEntryDetail: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ entry) => {
			bridgeApi?.renderEntryDetail?.(mainElement, entry);
		},
	});
}

/**
 * Render project outline from loaded JSON into the left panel.
 * @param {any} data
 */
function renderOutlineFromData(data) {
	if (outlineViewApi && typeof outlineViewApi.renderOutlineFromData === "function") {
		outlineViewApi.renderOutlineFromData(data);
	}
}


/**
 * Reset UI before a file is loaded.
 */
function renderWaitingForFile() {
	if (outlineViewApi && typeof outlineViewApi.renderWaitingForFile === "function") {
		outlineViewApi.renderWaitingForFile();
	}
}

/**
 * Show file loading error.
 * @param {string} message
 */
function renderFileLoadError(message) {
	if (outlineViewApi && typeof outlineViewApi.renderFileLoadError === "function") {
		outlineViewApi.renderFileLoadError(message);
	}
}

/**
 * Handle selected JSON file from top bar open action.
 * @param {File} file
 * @returns {Promise<void>}
 */
async function handleOpenFile(file) {
	if (documentActionsApi && typeof documentActionsApi.handleOpenFile === "function") {
		await documentActionsApi.handleOpenFile(file);
	}
}

/**
 * Create a new document and render it.
 */
function handleNewFile() {
	if (documentActionsApi && typeof documentActionsApi.handleNewFile === "function") {
		documentActionsApi.handleNewFile();
	}
}

/**
 * Normalize old setting keys to new names for compatibility.
 * @param {any} data
 */
function normalizeSettingsKeys(data) {
	if (documentActionsApi && typeof documentActionsApi.normalizeSettingsKeys === "function") {
		documentActionsApi.normalizeSettingsKeys(data);
	}
}

/**
 * Save currently loaded JSON to a file.
 * @returns {Promise<void>}
 */
async function saveCurrentData() {
	if (persistenceApi && typeof persistenceApi.saveCurrentData === "function") {
		await persistenceApi.saveCurrentData();
	}
}

/**
 * @param {string} message
 */
function setFormStatus(message) {
	if (persistenceApi && typeof persistenceApi.setFormStatus === "function") {
		persistenceApi.setFormStatus(message);
	}
}

/**
 * @param {string} message
 */
function setTopbarSaveStatus(message) {
	if (persistenceApi && typeof persistenceApi.setTopbarSaveStatus === "function") {
		persistenceApi.setTopbarSaveStatus(message);
	}
}


const layoutSetup = /** @type {any} */ (window).setupLayoutResizers;
const fileActionSetup = /** @type {any} */ (window).setupFileActions;

if (typeof layoutSetup === "function") {
	layoutSetup();
}

if (typeof fileActionSetup === "function") {
	fileActionSetup({
		onNew: handleNewFile,
		onOpenFile: (/** @type {File} */ file) => {
			void handleOpenFile(file);
		},
		onSave: () => {
			void saveCurrentData();
		},
	});
}

renderWaitingForFile();
bridgeApi?.setupEntryForm?.();
setTopbarSaveStatus("未保存");
