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

/** @type {any | null} */
let moduleInitializersApi = null;

/**
 * @typedef {{ type: "dashboard", data: any, button: HTMLButtonElement }} DashboardSelection
 * @typedef {{ type: "active", entry: any, button: HTMLButtonElement }} ActiveSelection
 * @typedef {{ type: "setting", data: any, button: HTMLButtonElement }} SettingSelection
 * @typedef {{ type: "deleted", entry: any, button: HTMLButtonElement }} DeletedSelection
 * @typedef {DashboardSelection | ActiveSelection | SettingSelection | DeletedSelection} SidebarSelection
 */

initializeModules();

function initializeModules() {
	const createAppModuleInitializers = /** @type {any} */ (window).createAppModuleInitializers;
	if (typeof createAppModuleInitializers !== "function") {
		return;
	}

	moduleInitializersApi = createAppModuleInitializers({
		getCurrentData: () => currentData,
		setCurrentData: (/** @type {any} */ data) => {
			currentData = data;
		},
		getEditingEntryId: () => editingEntryId,
		setEditingEntryId: (/** @type {string | null} */ entryId) => {
			editingEntryId = entryId;
		},
		getCurrentFileName: () => currentFileName,
		setCurrentFileName: (/** @type {string} */ fileName) => {
			currentFileName = fileName;
		},
		getCurrentFileHandle: () => currentFileHandle,
		setCurrentFileHandle: (/** @type {any | null} */ fileHandle) => {
			currentFileHandle = fileHandle;
		},
		getRendererApi: () => rendererApi,
		setRendererApi: (/** @type {any | null} */ api) => {
			rendererApi = api;
		},
		getTreeApi: () => treeApi,
		setTreeApi: (/** @type {any | null} */ api) => {
			treeApi = api;
		},
		getFormApi: () => formApi,
		setFormApi: (/** @type {any | null} */ api) => {
			formApi = api;
		},
		getModelApi: () => modelApi,
		setModelApi: (/** @type {any | null} */ api) => {
			modelApi = api;
		},
		getPersistenceApi: () => persistenceApi,
		setPersistenceApi: (/** @type {any | null} */ api) => {
			persistenceApi = api;
		},
		getDocumentActionsApi: () => documentActionsApi,
		setDocumentActionsApi: (/** @type {any | null} */ api) => {
			documentActionsApi = api;
		},
		getOutlineViewApi: () => outlineViewApi,
		setOutlineViewApi: (/** @type {any | null} */ api) => {
			outlineViewApi = api;
		},
		getBridgeApi: () => bridgeApi,
		setBridgeApi: (/** @type {any | null} */ api) => {
			bridgeApi = api;
		},
		renderOutlineFromData: (/** @type {any} */ data) => {
			renderOutlineFromData(data);
		},
		setFormStatus: (/** @type {string} */ message) => {
			setFormStatus(message);
		},
		setTopbarSaveStatus: (/** @type {string} */ message) => {
			setTopbarSaveStatus(message);
		},
		renderFileLoadError: (/** @type {string} */ message) => {
			renderFileLoadError(message);
		},
	});

	moduleInitializersApi?.initializeAllModules?.();
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
