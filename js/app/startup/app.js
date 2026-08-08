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

/** @type {any | null} 共有リンクモジュールのAPI */
let shareActionsApi = null;

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

/**
 * 起動時の初期化失敗を画面に出す。
 * モジュールの配置ミスは真っ白な画面になって原因が分からなくなりやすいので、
 * コンソールだけでなく本文にも理由を残す。
 * @param {unknown} error
 */
function renderStartupFailure(error) {
	console.error("Failed to initialize MITO", error);
	const mainElement = document.querySelector(".main-window");
	if (!mainElement) {
		return;
	}

	mainElement.textContent = "";
	const message = document.createElement("p");
	message.textContent = `起動に失敗しました: ${error instanceof Error ? error.message : String(error)}`;
	mainElement.appendChild(message);
}

function initializeModules() {
	const createAppModuleInitializers = /** @type {any} */ (window).createAppModuleInitializers;
	if (typeof createAppModuleInitializers !== "function") {
		renderStartupFailure(new Error("app-module-initializers.js が読み込まれていません"));
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
		getShareActionsApi: () => shareActionsApi,
		setShareActionsApi: (/** @type {any | null} */ api) => {
			shareActionsApi = api;
		},
		openDocumentFile: (/** @type {File} */ file) => handleOpenFile(file, null),
		hasAutosaveSnapshot,
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

	try {
		moduleInitializersApi?.initializeAllModules?.();
	} catch (error) {
		renderStartupFailure(error);
	}
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
		const nowJST = /** @type {any} */ (window).nowJST;
		const snapshot = {
			fileName: currentFileName,
			updatedAt: nowJST(),
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
 *
 * デバウンス待ちのタイマーも必ず解除する。解除しないと、保存直前の変更で
 * 予約されたタイマーが保存後に発火し、保存済みデータのスナップショットを
 * 書き戻してしまう（次回起動で不要な復元確認が出る原因になる）。
 */
function clearAutosaveSnapshot() {
	if (autosaveTimerId !== null) {
		window.clearTimeout(autosaveTimerId);
		autosaveTimerId = null;
	}

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
 * localStorageに未保存の下書きが残っているかを返す。
 * 共有リンクを開く前に、下書きを失う可能性を知らせるために使う。
 * @returns {boolean}
 */
function hasAutosaveSnapshot() {
	try {
		return Boolean(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY));
	} catch (error) {
		console.error("Failed to read autosave snapshot", error);
		return false;
	}
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
	const shouldRestore = window.confirm(
		`未保存の下書きが見つかりました（${updatedAt}）。復元しますか？\n\n「キャンセル」を選ぶとこの下書きは破棄されます。`,
	);
	if (!shouldRestore) {
		// 破棄しないと、以降リロードするたびに同じ確認が出続けてしまう。
		// 破棄されることはダイアログ本文で明示している。
		clearAutosaveSnapshot();
		setFormStatus("未保存の下書きを破棄しました。");
		return;
	}

	// 読み込み経路と同じ正規化を通す。localStorageの内容は壊れている可能性があるため、
	// 生のまま描画側へ渡さない。
	const normalized = normalizeLoadedDocument(snapshot.data);
	if (!normalized) {
		clearAutosaveSnapshot();
		setFormStatus("下書きデータが壊れていたため復元できませんでした。");
		setTopbarSaveStatus("復元失敗");
		return;
	}

	currentFileHandle = null;
	currentFileName = typeof snapshot.fileName === "string" && snapshot.fileName.length > 0
		? snapshot.fileName
		: "recovered.json";
	queueNextDataChangeDirtyState(true);
	renderOutlineFromData(normalized);
	setFormStatus("下書きデータを復元しました。保存して確定してください。");
	setTopbarSaveStatus("未保存: 復元データ");
	setDirty(true);
}

/**
 * 読み込んだJSONを、ファイル読み込みと同じ規則で正規化する。
 * 正規化に失敗した場合はnullを返す。
 * @param {any} rawData
 * @returns {any | null}
 */
function normalizeLoadedDocument(rawData) {
	if (!documentActionsApi || typeof documentActionsApi.normalizeDocument !== "function") {
		return rawData;
	}

	try {
		return documentActionsApi.normalizeDocument(rawData);
	} catch (error) {
		console.error("Failed to normalize document", error);
		return null;
	}
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
 * @param {any | null} fileHandle showOpenFilePicker で得たハンドル。未対応環境ではnull
 * @returns {Promise<boolean>}
 */
async function handleOpenFile(file, fileHandle) {
	if (!requestDiscardUnsavedChanges("別ファイルを開く操作")) {
		setFormStatus("ファイルを開く操作をキャンセルしました。");
		return false;
	}

	// 相対パスリンクの基準フォルダーは開いていた文書に紐づくため、
	// 別の文書を開く時点で必ず捨てる。
	linkBaseDirectoryHandle = null;
	// 取得元URLも開いていた文書に紐づく。共有リンク経由の場合は読み込み後に付け直される。
	shareActionsApi?.setCurrentSourceUrl?.("");

	if (!documentActionsApi || typeof documentActionsApi.handleOpenFile !== "function") {
		return false;
	}

	queueNextDataChangeDirtyState(false);
	const opened = await documentActionsApi.handleOpenFile(file, fileHandle);
	if (!opened) {
		queueNextDataChangeDirtyState(null);
	}

	return Boolean(opened);
}

/**
 * 新しいドキュメントを作成して描画する。
 */
function handleNewFile() {
	if (!requestDiscardUnsavedChanges("新規作成")) {
		setFormStatus("新規作成をキャンセルしました。");
		return;
	}

	shareActionsApi?.setCurrentSourceUrl?.("");

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
		onOpenFile: (/** @type {File} */ file, /** @type {any | null} */ fileHandle) => {
			void handleOpenFile(file, fileHandle);
		},
		onSave: () => {
			void saveCurrentData();
		},
	});
}

/**
 * 起動時に開くドキュメントを決める。
 *
 * 共有リンクで開かれた場合はそれを優先し、下書き復元は行わない。
 * 両方を続けて処理すると、後から出た確認ダイアログや状態表示が
 * 前の結果を上書きしてしまうため、どちらか一方だけを実行する。
 *
 * @returns {Promise<void>}
 */
async function bootstrapInitialDocument() {
	const handledShareLink = await (shareActionsApi?.loadFromLocation?.() ?? false);
	if (handledShareLink) {
		return;
	}

	tryRestoreAutosaveSnapshot();
}

renderWaitingForFile();
formApi?.setupEntryForm?.();
shareActionsApi?.setupShareUi?.();
setTopbarSaveStatus("未保存");
void bootstrapInitialDocument();
