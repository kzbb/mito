// @ts-check

/** @type {any | null} 現在開いているJSONドキュメントのデータ本体 */
let currentData = null;

/** @type {string | null} フォームで編集中のエントリID。新規作成時はnull */
let editingEntryId = null;

/** @type {string} 現在のファイル名（保存ダイアログのデフォルト値として使用） */
let currentFileName = "data.json";

/** @type {any | null} File System Access APIのファイルハンドル。フォールバック保存時はnull */
let currentFileHandle = null;

/** @type {FileSystemDirectoryHandle | null} 相対パスリンクの基準ディレクトリ。ファイル閉時にnullへリセット */
let linkBaseDirectoryHandle = null;

/** @type {any | null} レンダラーモジュールのAPI */
let rendererApi = null;

/** @type {any | null} ツリーレンダラーのAPI */
let treeApi = null;

/** @type {any | null} エントリフォームモジュールのAPI */
let formApi = null;

/** @type {any | null} データモデルヘルパーのAPI */
let modelApi = null;

/** @type {any | null} ファイル入出力モジュールのAPI */
let persistenceApi = null;

/** @type {any | null} ドキュメント操作（開く・新規作成）モジュールのAPI */
let documentActionsApi = null;

/** @type {any | null} 左パネル（アウトライン）モジュールのAPI */
let outlineViewApi = null;

/** @type {any | null} モジュール間の橋渡しをするブリッジAPI */
let bridgeApi = null;

/** @type {any | null} モジュール初期化コーディネーターのAPI */
let moduleInitializersApi = null;

/** @type {boolean} 未保存の変更があるかどうか。ページ離脱確認に使用 */
let isDirty = false;

/** @type {number | null} オートセーブのデバウンスタイマーID */
let autosaveTimerId = null;

/**
 * @type {boolean | null}
 * 次回の mito:data-changed イベントで isDirty をどの値にセットするかの予約値。
 * nullの場合はデフォルト動作（true）になる。
 */
let nextDataChangeDirtyState = null;

/** localStorageでオートセーブに使うキー */
const AUTOSAVE_STORAGE_KEY = "mito:autosave:v1";
/** 入力停止後にオートセーブが走るまでの待機時間（ミリ秒） */
const AUTOSAVE_DEBOUNCE_MS = 1200;

/**
 * @typedef {{ type: "dashboard", data: any, button: HTMLButtonElement }} DashboardSelection
 * @typedef {{ type: "active", entry: any, button: HTMLButtonElement }} ActiveSelection
 * @typedef {{ type: "setting", data: any, button: HTMLButtonElement }} SettingSelection
 * @typedef {{ type: "deleted", entry: any, button: HTMLButtonElement }} DeletedSelection
 * @typedef {DashboardSelection | ActiveSelection | SettingSelection | DeletedSelection} SidebarSelection
 */

initializeModules();

// データ変更イベントを受け取ったら dirty フラグを更新しオートセーブを予約する。
// nextDataChangeDirtyState に予約値があればそれを使い、なければ true にする。
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

// 未保存の変更がある状態でページを離脱しようとした場合に確認ダイアログを出す。
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

/**
 * 変更後にオートセーブをデバウンス実行する。
 * 連続した変更でタイマーがリセットされ、最後の変更から一定時間後に保存される。
 */
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

/**
 * 現在のデータをlocalStorageにスナップショットとして書き込む。
 * ページを閉じても下書きが残るため、次回起動時に復元できる。
 */
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

/**
 * localStorageのオートセーブスナップショットを削除する。
 * ファイル保存が成功した後に呼ばれる。
 */
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

/**
 * 起動時にlocalStorageの下書きを確認し、ユーザーの確認後に復元する。
 * 破損したスナップショットは自動的に削除する。
 */
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
 * 読み込んだJSONからプロジェクトのアウトラインを左パネルに描画する。
 * @param {any} data
 */
function renderOutlineFromData(data) {
	if (outlineViewApi && typeof outlineViewApi.renderOutlineFromData === "function") {
		outlineViewApi.renderOutlineFromData(data);
	}
}


/**
 * ファイル読み込み前の待機状態のUIを表示する。
 */
function renderWaitingForFile() {
	if (outlineViewApi && typeof outlineViewApi.renderWaitingForFile === "function") {
		outlineViewApi.renderWaitingForFile();
	}
}

/**
 * ファイル読み込みエラーを左パネルに表示する。
 * @param {string} message
 */
function renderFileLoadError(message) {
	if (outlineViewApi && typeof outlineViewApi.renderFileLoadError === "function") {
		outlineViewApi.renderFileLoadError(message);
	}
}

/**
 * トップバーの「開く」から選択されたJSONファイルを処理する。
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
 * 新しいドキュメントを作成して描画する。
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
 * 現在読み込み中のJSONをファイルに保存する。
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
