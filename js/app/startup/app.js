// @ts-check

/** @type {any | null} */
let currentData = null;

/** @type {string | null} */
let editingEntryId = null;

/** @type {string} */
let currentFileName = "data.json";

/** @type {any | null} */
let currentFileHandle = null;

/** @type {FileSystemDirectoryHandle | null} */
let linkBaseDirectoryHandle = null;

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

/** @type {boolean} */
let isDirty = false;

/** @type {number | null} */
let autosaveTimerId = null;

/** @type {boolean | null} */
let nextDataChangeDirtyState = null;

const AUTOSAVE_STORAGE_KEY = "mito:autosave:v1";
const AUTOSAVE_DEBOUNCE_MS = 1200;

/**
 * @typedef {{ type: "dashboard", data: any, button: HTMLButtonElement }} DashboardSelection
 * @typedef {{ type: "active", entry: any, button: HTMLButtonElement }} ActiveSelection
 * @typedef {{ type: "setting", data: any, button: HTMLButtonElement }} SettingSelection
 * @typedef {{ type: "deleted", entry: any, button: HTMLButtonElement }} DeletedSelection
 * @typedef {DashboardSelection | ActiveSelection | SettingSelection | DeletedSelection} SidebarSelection
 */

initializeModules();

document.addEventListener("mito:data-changed", () => {
	if (!currentData) {
		return;
	}

	if (nextDataChangeDirtyState !== null) {
		setDirty(nextDataChangeDirtyState);
		nextDataChangeDirtyState = null;
	} else {
		setDirty(true);
	}

	if (isDirty) {
		scheduleAutosave();
	}
});

window.addEventListener("beforeunload", (event) => {
	if (!isDirty) {
		return;
	}

	event.preventDefault();
	event.returnValue = "";
});

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
			if (!fileHandle) {
				linkBaseDirectoryHandle = null;
			}
		},
		getLinkBaseDirectoryHandle: () => linkBaseDirectoryHandle,
		setLinkBaseDirectoryHandle: (/** @type {FileSystemDirectoryHandle | null} */ directoryHandle) => {
			linkBaseDirectoryHandle = directoryHandle;
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
 * @param {boolean} nextDirty
 */
function setDirty(nextDirty) {
	isDirty = Boolean(nextDirty);
	if (!isDirty) {
		setTopbarSaveStatus(`保存済み: ${currentFileName}`);
		return;
	}

	setTopbarSaveStatus("未保存: 変更あり");
}

/**
 * @param {boolean | null} nextDirty
 */
function queueNextDataChangeDirtyState(nextDirty) {
	nextDataChangeDirtyState = nextDirty;
}

function scheduleAutosave() {
	if (!currentData) {
		return;
	}

	if (autosaveTimerId !== null) {
		window.clearTimeout(autosaveTimerId);
	}

	autosaveTimerId = window.setTimeout(() => {
		autosaveTimerId = null;
		persistAutosaveSnapshot();
	}, AUTOSAVE_DEBOUNCE_MS);
}

function persistAutosaveSnapshot() {
	if (!currentData) {
		return;
	}

	try {
		const snapshot = {
			fileName: currentFileName,
			updatedAt: new Date().toISOString(),
			data: currentData,
		};
		window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(snapshot));
	} catch (error) {
		console.error("Failed to persist autosave snapshot", error);
	}
}

function clearAutosaveSnapshot() {
	try {
		window.localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
	} catch (error) {
		console.error("Failed to clear autosave snapshot", error);
	}
}

/**
 * @param {string} actionLabel
 */
function requestDiscardUnsavedChanges(actionLabel) {
	if (!isDirty || !currentData) {
		return true;
	}

	return window.confirm(`未保存の変更があります。${actionLabel}を続行しますか？`);
}

function tryRestoreAutosaveSnapshot() {
	let rawSnapshot = "";
	try {
		rawSnapshot = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY) ?? "";
	} catch (error) {
		console.error("Failed to read autosave snapshot", error);
		return;
	}

	if (!rawSnapshot) {
		return;
	}

	/** @type {{ fileName?: string, updatedAt?: string, data?: any } | null} */
	let snapshot = null;
	try {
		snapshot = JSON.parse(rawSnapshot);
	} catch (error) {
		console.error("Failed to parse autosave snapshot", error);
		clearAutosaveSnapshot();
		return;
	}

	if (!snapshot || typeof snapshot !== "object" || !snapshot.data || typeof snapshot.data !== "object") {
		clearAutosaveSnapshot();
		return;
	}

	const updatedAt = typeof snapshot.updatedAt === "string" ? snapshot.updatedAt : "不明";
	const shouldRestore = window.confirm(`未保存の下書きが見つかりました（${updatedAt}）。復元しますか？`);
	if (!shouldRestore) {
		return;
	}

	currentFileHandle = null;
	currentFileName = typeof snapshot.fileName === "string" && snapshot.fileName.length > 0
		? snapshot.fileName
		: "recovered.json";
	queueNextDataChangeDirtyState(true);
	renderOutlineFromData(snapshot.data);
	setFormStatus("下書きデータを復元しました。保存して確定してください。");
	setTopbarSaveStatus("未保存: 復元データ");
	setDirty(true);
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
	if (!requestDiscardUnsavedChanges("別ファイルを開く操作")) {
		setFormStatus("ファイルを開く操作をキャンセルしました。");
		return;
	}

	if (documentActionsApi && typeof documentActionsApi.handleOpenFile === "function") {
		queueNextDataChangeDirtyState(false);
		const opened = await documentActionsApi.handleOpenFile(file);
		if (!opened) {
			queueNextDataChangeDirtyState(null);
		}
	}
}

/**
 * Create a new document and render it.
 */
function handleNewFile() {
	if (!requestDiscardUnsavedChanges("新規作成")) {
		setFormStatus("新規作成をキャンセルしました。");
		return;
	}

	if (documentActionsApi && typeof documentActionsApi.handleNewFile === "function") {
		queueNextDataChangeDirtyState(true);
		const created = documentActionsApi.handleNewFile();
		if (!created) {
			queueNextDataChangeDirtyState(null);
			return;
		}
		setDirty(true);
	}
}

/**
 * Save currently loaded JSON to a file.
 * @returns {Promise<void>}
 */
async function saveCurrentData() {
	if (persistenceApi && typeof persistenceApi.saveCurrentData === "function") {
		const saved = await persistenceApi.saveCurrentData();
		if (saved) {
			setDirty(false);
			clearAutosaveSnapshot();
		}
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
tryRestoreAutosaveSnapshot();
