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
	 *   getLinkBaseDirectoryHandle: () => FileSystemDirectoryHandle | null,
	 *   setLinkBaseDirectoryHandle: (directoryHandle: FileSystemDirectoryHandle | null) => void,
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
	 *   renderOutlineFromData: (data: any) => void,
	 *   setFormStatus: (message: string) => void,
	 *   setTopbarSaveStatus: (message: string) => void,
	 *   renderFileLoadError: (message: string) => void
	 * }} deps
	 */
	function createAppModuleInitializers(deps) {
		const FILE_PREVIEW_MAX_SIZE_BYTES = 512_000;
		const FILE_PREVIEW_MAX_CHARS = 260;
		const IMAGE_PREVIEW_MAX_SIZE_BYTES = 5_242_880;

		const createDocumentMutations = /** @type {any} */ (globalObject).createDocumentMutations;
		const documentMutations = typeof createDocumentMutations === "function"
			? createDocumentMutations({ getCurrentData: deps.getCurrentData })
			: null;

		if (!documentMutations) {
			console.error("Document mutations module is not available");
		}

		/** @type {(mutator: (data: any) => void) => boolean} */
		const mutateDocument = documentMutations?.mutateDocument ?? (() => false);
		/** @type {() => void} */
		const notifyDocumentChanged = documentMutations?.notifyDocumentChanged ?? (() => {});

		/**
		 * モジュールAPIへの遅延バインド呼び出し口を作る。
		 *
		 * モジュールは初期化順の都合で後から差し込まれるため、参照は呼び出し時に解決する。
		 * 目的の関数が無い場合は、黙って代替値を返さず、どのAPIのどの関数が欠けているかを
		 * コンソールへ出す。配線ミスが「画面上で何も起きない」に化けると原因追跡が
		 * 極端に難しくなるため、必ず声を上げさせる。
		 *
		 * 呼び出し側が値を必要とする場合は `?? 既定値` を添えるが、そこには
		 * 実装のコピーを置かない（劣化コピーが二重管理になるため、中立な空値だけを使う）。
		 *
		 * @param {string} apiName 診断メッセージ用のAPI名
		 * @param {() => any} getApi
		 * @returns {(methodName: string, ...args: any[]) => any}
		 */
		function createModuleCaller(apiName, getApi) {
			/** @type {Set<string>} 同じ欠落を何度も報告しないための記録 */
			const reportedMethods = new Set();

			return function callModuleMethod(methodName, ...args) {
				const api = getApi();
				const method = api?.[methodName];
				if (typeof method !== "function") {
					if (!reportedMethods.has(methodName)) {
						reportedMethods.add(methodName);
						console.error(`[mito] ${apiName}.${methodName}() が利用できません。モジュールの読み込みを確認してください。`);
					}
					return undefined;
				}

				return method.apply(api, args);
			};
		}

		const callRenderer = createModuleCaller("rendererApi", deps.getRendererApi);
		const callTree = createModuleCaller("treeApi", deps.getTreeApi);
		const callForm = createModuleCaller("formApi", deps.getFormApi);
		const callModel = createModuleCaller("modelApi", deps.getModelApi);

		/**
		 * エントリー詳細を表示し、あわせて入力フォームを同じエントリーの編集状態にする。
		 * 描画とフォーム同期を必ず対で行うため、呼び出し側で取り違えないよう1箇所にまとめる。
		 * @param {HTMLElement} mainElement
		 * @param {any} entry
		 */
		function renderEntryDetail(mainElement, entry) {
			callRenderer("renderEntryDetail", mainElement, entry);
			callForm("enterEditMode", entry);
		}

		/**
		 * @param {string} filePath
		 * @returns {boolean}
		 */
		function isAbsolutePath(filePath) {
			return filePath.startsWith("file://") || /^\//.test(filePath) || /^[A-Za-z]:[\\/]/.test(filePath);
		}

		/**
		 * @param {string} filePath
		 * @returns {string}
		 */
		function toFileHref(filePath) {
			if (filePath.startsWith("file://")) {
				return filePath;
			}

			if (/^[A-Za-z]:[\\/]/.test(filePath)) {
				const normalized = filePath.replace(/\\/g, "/");
				return `file:///${encodeURI(normalized)}`;
			}

			return `file://${encodeURI(filePath)}`;
		}

		/**
		 * @returns {Promise<FileSystemDirectoryHandle | null>}
		 */
		async function resolveBaseDirectoryHandle() {
			const existing = deps.getLinkBaseDirectoryHandle();
			if (existing) {
				return existing;
			}

			const windowAny = /** @type {any} */ (window);
			if (typeof windowAny.showDirectoryPicker !== "function") {
				deps.setFormStatus("相対パスリンクには基準フォルダが必要ですが、この環境はフォルダ選択APIに未対応です。");
				return null;
			}

			try {
				const picked = await windowAny.showDirectoryPicker({ id: "mito-link-base" });
				deps.setLinkBaseDirectoryHandle(picked);
				deps.setFormStatus(`リンク基準フォルダを設定しました: ${picked.name}`);
				return picked;
			} catch (error) {
				if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
					return null;
				}

				console.error("Failed to pick base directory", error);
				deps.setFormStatus("リンク基準フォルダの選択に失敗しました。");
				return null;
			}
		}

		/**
		 * @param {FileSystemDirectoryHandle} baseDirectory
		 * @param {string} relativePath
		 * @returns {Promise<FileSystemFileHandle | null>}
		 */
		async function resolveRelativeFileHandle(baseDirectory, relativePath) {
			const cleaned = relativePath.replace(/\\/g, "/").trim();
			const segments = cleaned.split("/").filter((segment) => segment.length > 0 && segment !== ".");
			if (segments.length === 0 || segments.some((segment) => segment === "..")) {
				return null;
			}

			let currentDirectory = baseDirectory;
			for (let index = 0; index < segments.length - 1; index += 1) {
				currentDirectory = await currentDirectory.getDirectoryHandle(segments[index]);
			}

			const fileName = segments[segments.length - 1];
			return await currentDirectory.getFileHandle(fileName);
		}

		/**
		 * @param {string} mimeType
		 * @returns {boolean}
		 */
		function isTextLikeMimeType(mimeType) {
			if (!mimeType) {
				return true;
			}

			return mimeType.startsWith("text/")
				|| mimeType === "application/json"
				|| mimeType === "application/xml"
				|| mimeType === "application/javascript"
				|| mimeType === "application/x-javascript";
		}

		/**
		 * @param {FileSystemFileHandle} fileHandle
		 * @param {string} labelPath
		 * @returns {Promise<{ title: string, body: string, imageUrl?: string } | null>}
		 */
		async function buildFilePreviewFromHandle(fileHandle, labelPath) {
			const file = await fileHandle.getFile();
			if (file.type.startsWith("image/")) {
				if (file.size > IMAGE_PREVIEW_MAX_SIZE_BYTES) {
					return {
						title: `画像ファイル: ${labelPath}`,
						body: `画像サイズが大きいためプレビューを省略しました (${Math.round(file.size / 1024)}KB)。`,
					};
				}

				return {
					title: `画像ファイル: ${labelPath}`,
					body: labelPath,
					imageUrl: URL.createObjectURL(file),
				};
			}

			if (!isTextLikeMimeType(file.type)) {
				return {
					title: `ファイル: ${labelPath}`,
					body: "バイナリ形式のため本文プレビューは表示できません。",
				};
			}

			if (file.size > FILE_PREVIEW_MAX_SIZE_BYTES) {
				return {
					title: `ファイル: ${labelPath}`,
					body: `ファイルサイズが大きいためプレビューを省略しました (${Math.round(file.size / 1024)}KB)。`,
				};
			}

			const text = (await file.text()).replace(/\r\n?/g, "\n").trim();
			if (!text) {
				return {
					title: `ファイル: ${labelPath}`,
					body: "空ファイルです。",
				};
			}

			const excerpt = text.slice(0, FILE_PREVIEW_MAX_CHARS);
			const suffix = text.length > FILE_PREVIEW_MAX_CHARS ? "..." : "";
			return {
				title: `ファイル: ${labelPath}`,
				body: `${excerpt}${suffix}`,
			};
		}

		/**
		 * 外部モジュールからデータモデルヘルパーを初期化する。
		 */
		function initializeDataModel() {
			const createDataModel = /** @type {any} */ (globalObject).createDataModel;
			if (typeof createDataModel !== "function") {
				return;
			}

			deps.setModelApi(createDataModel());
		}

		/**
		 * 外部モジュールからファイル保存ヘルパーを初期化する。
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
		 * 外部モジュールからアウトライン描画ヘルパーを初期化する。
		 */
		function initializeOutlineViewModule() {
			const createAppOutlineView = /** @type {any} */ (globalObject).createAppOutlineView;
			if (typeof createAppOutlineView !== "function") {
				return;
			}

			deps.setOutlineViewApi(createAppOutlineView({
				getEditingEntryId: deps.getEditingEntryId,
				notifyDocumentChanged,
				resolveProjectName: (data) => callModel("resolveProjectName", data) ?? "プロジェクト",
				groupActiveEntriesByCategory: (data) => callModel("groupActiveEntriesByCategory", data) ?? new Map(),
				findActiveEntryById: (data, entryId) => callModel("findActiveEntryById", data, entryId) ?? null,
				captureOpenCategories: (treeElement) => callTree("captureOpenCategories", treeElement) ?? null,
				renderDashboardItem: (treeElement, data, onSelect) => callTree("renderDashboardItem", treeElement, data, onSelect) ?? null,
				renderCategoryTree: (treeElement, grouped, onEntrySelect, openCategories) => callTree("renderCategoryTree", treeElement, grouped, onEntrySelect, openCategories) ?? null,
				selectTreeLeaf: (treeElement, button) => callTree("selectTreeLeaf", treeElement, button),
				clearTreeSelection: (treeElement) => callTree("clearTreeSelection", treeElement),
				setTreeMessage: (treeElement, message) => callTree("setTreeMessage", treeElement, message),
				renderDashboardOverview: (mainElement, data) => callRenderer("renderDashboardOverview", mainElement, data),
				renderSettingsButton: (data, onSelect) => callRenderer("renderSettingsButton", data, onSelect) ?? null,
				renderSettingsOverview: (mainElement, data) => callRenderer("renderSettingsOverview", mainElement, data),
				renderMainMessage: (mainElement, message) => callRenderer("renderMainMessage", mainElement, message),
				renderEntryDetail,
				setFormModeAdd: () => callForm("setFormModeAdd"),
				setCurrentData: deps.setCurrentData,
			}));
		}

		/**
		 * 外部モジュールからドキュメント操作ヘルパーを初期化する。
		 */
		function initializeDocumentActionsModule() {
			const createAppDocumentActions = /** @type {any} */ (globalObject).createAppDocumentActions;
			if (typeof createAppDocumentActions !== "function") {
				return;
			}

			deps.setDocumentActionsApi(createAppDocumentActions({
				renderOutlineFromData: deps.renderOutlineFromData,
				setFormModeAdd: () => {
					callForm("setFormModeAdd");
				},
				setFormStatus: deps.setFormStatus,
				setTopbarSaveStatus: deps.setTopbarSaveStatus,
				setCurrentFileName: deps.setCurrentFileName,
				setCurrentFileHandle: deps.setCurrentFileHandle,
				renderFileLoadError: deps.renderFileLoadError,
			}));
		}

		/**
		 * 外部モジュールからレンダラーを初期化する。
		 */
		function initializeRenderers() {
			const createRendererComposer = /** @type {any} */ (globalObject).createRendererComposer;
			if (typeof createRendererComposer !== "function") {
				return;
			}

			deps.setRendererApi(createRendererComposer({
				getCurrentData: deps.getCurrentData,
				getEditingEntryId: deps.getEditingEntryId,
				mutateDocument,
				onEnterEditMode: (/** @type {any} */ entry) => {
					callForm("enterEditMode", entry);
				},
				onStartNewEntry: () => {
					callForm("setFormModeAdd");
				},
				onOpenEntryView: (/** @type {any} */ entry) => {
					const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));
					if (!mainElement) {
						return;
					}

					callTree("focusNewEntryInTree", entry);
					renderEntryDetail(mainElement, entry);
				},
				onOpenFileLink: async (/** @type {string} */ filePath) => {
					const normalizedPath = filePath.trim();
					if (!normalizedPath) {
						return false;
					}

					if (isAbsolutePath(normalizedPath)) {
						window.open(toFileHref(normalizedPath), "_blank", "noopener,noreferrer");
						deps.setFormStatus(`リンクを開きました: ${normalizedPath}`);
						return true;
					}

					const baseDirectory = await resolveBaseDirectoryHandle();
					if (!baseDirectory) {
						return false;
					}

					try {
						const fileHandle = await resolveRelativeFileHandle(baseDirectory, normalizedPath);
						if (!fileHandle) {
							deps.setFormStatus(`相対パスが不正です: ${normalizedPath}`);
							return false;
						}

						const file = await fileHandle.getFile();
						const blobUrl = URL.createObjectURL(file);
						window.open(blobUrl, "_blank", "noopener,noreferrer");
						window.setTimeout(() => {
							URL.revokeObjectURL(blobUrl);
						}, 60_000);
						deps.setFormStatus(`リンクを開きました: ${normalizedPath}`);
						return true;
					} catch (error) {
						console.error("Failed to resolve relative file link", error);
						deps.setFormStatus(`リンク先が見つかりません: ${normalizedPath}`);
						return false;
					}
				},
				onPreviewFileLink: async (/** @type {string} */ filePath) => {
					const normalizedPath = filePath.trim();
					if (!normalizedPath) {
						return null;
					}

					if (isAbsolutePath(normalizedPath)) {
						return {
							title: "ファイルリンク",
							body: normalizedPath,
						};
					}

					const baseDirectory = deps.getLinkBaseDirectoryHandle();
					if (!baseDirectory) {
						return {
							title: "ファイルリンク",
							body: `${normalizedPath}\n(プレビューには基準フォルダの設定が必要です)`,
						};
					}

					try {
						const fileHandle = await resolveRelativeFileHandle(baseDirectory, normalizedPath);
						if (!fileHandle) {
							return {
								title: "ファイルリンク",
								body: `${normalizedPath}\n(相対パスが不正です)`,
							};
						}

						return await buildFilePreviewFromHandle(fileHandle, normalizedPath);
					} catch (_error) {
						return {
							title: "ファイルリンク",
							body: `${normalizedPath}\n(プレビューの取得に失敗しました)`,
						};
					}
				},
				onUpdateEntryFromDetail: (/** @type {any} */ entry, /** @type {Record<string, any>} */ payload) => {
					const currentData = deps.getCurrentData();
					if (!currentData) {
						return null;
					}

					const entryId = String(entry?.id ?? "");
					const targetIndex = callModel("findActiveEntryIndexById", currentData, entryId) ?? -1;
					if (targetIndex < 0) {
						return null;
					}

					const updatedEntry = { ...currentData.active[targetIndex], ...payload };
					currentData.active[targetIndex] = updatedEntry;
					deps.renderOutlineFromData(currentData);
					callTree("focusNewEntryInTree", updatedEntry);

					const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));
					if (mainElement) {
						renderEntryDetail(mainElement, updatedEntry);
					}

					if (deps.getEditingEntryId() && deps.getEditingEntryId() === entryId) {
						callForm("enterEditMode", updatedEntry);
					}

					return updatedEntry;
				},
				onMoveEntryToDeletedFromDetail: (/** @type {any} */ entry) => {
					const currentData = deps.getCurrentData();
					if (!currentData) {
						return null;
					}

					const entryId = String(entry?.id ?? "");
					const targetIndex = callModel("findActiveEntryIndexById", currentData, entryId) ?? -1;
					if (targetIndex < 0) {
						return null;
					}

					if (!Array.isArray(currentData.deleted)) {
						currentData.deleted = [];
					}

					const [deletedEntry] = currentData.active.splice(targetIndex, 1);
					if (!deletedEntry) {
						return null;
					}

					currentData.deleted.unshift(deletedEntry);
					if (deps.getEditingEntryId() === entryId) {
						deps.setEditingEntryId(null);
					}

					deps.renderOutlineFromData(currentData);
					return deletedEntry;
				},
				onPermanentlyDeleteDeletedEntry: (/** @type {any} */ entry) => {
					const currentData = deps.getCurrentData();
					if (!currentData || !Array.isArray(currentData.deleted)) {
						return false;
					}

					const entryId = String(entry?.id ?? "");
					const index = currentData.deleted.findIndex((/** @type {any} */ item) => String(item?.id ?? "") === entryId);
					if (index < 0) {
						return false;
					}

					return mutateDocument((documentData) => {
						documentData.deleted.splice(index, 1);
					});
				},
				onRestoreDeletedEntry: (/** @type {any} */ entry) => {
					const currentData = deps.getCurrentData();
					if (!currentData || !Array.isArray(currentData.deleted)) {
						return null;
					}

					const entryId = String(entry?.id ?? "");
					const index = currentData.deleted.findIndex((/** @type {any} */ item) => String(item?.id ?? "") === entryId);
					if (index < 0) {
						return null;
					}

					if (!Array.isArray(currentData.active)) {
						currentData.active = [];
					}

					const [restoredEntry] = currentData.deleted.splice(index, 1);
					if (!restoredEntry) {
						return null;
					}

					currentData.active.unshift(restoredEntry);
					deps.renderOutlineFromData(currentData);
					return restoredEntry;
				},
				onSetFormStatus: deps.setFormStatus,
				onSetTopbarSaveStatus: deps.setTopbarSaveStatus,
				onProjectNameInput: (/** @type {string} */ nextProject) => {
					const applied = mutateDocument((documentData) => {
						documentData.project = nextProject;
					});
					if (!applied) {
						return;
					}

					document.title = nextProject.trim() ? `${nextProject.trim()} - MITO` : "MITO";
					callRenderer("updateOutlineProjectName", nextProject);
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
		 * 外部モジュールからツリーレンダラーを初期化する。
		 */
		function initializeTreeRenderer() {
			const createTreeRenderer = /** @type {any} */ (globalObject).createTreeRenderer;
			if (typeof createTreeRenderer !== "function") {
				return;
			}

			deps.setTreeApi(createTreeRenderer({
				resolveEntryName: (/** @type {any} */ entry) => callRenderer("resolveEntryName", entry) ?? `項目${entry?.id ?? ""}`,
				resolveDashboardLabel: (/** @type {any} */ data) => callRenderer("resolveDashboardLabel", data) ?? "ダッシュボード",
			}));
		}

		/**
		 * 外部モジュールからエントリフォームモジュールを初期化する。
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
				notifyDocumentChanged,
				resolveDashboardLabel: (/** @type {any} */ data) => callRenderer("resolveDashboardLabel", data) ?? "ダッシュボード",
				setFormStatus: deps.setFormStatus,
				findActiveEntryIndexById: (/** @type {any} */ data, /** @type {string | null} */ entryId) => callModel("findActiveEntryIndexById", data, entryId) ?? -1,
				getNextActiveId: (/** @type {any} */ data) => callModel("getNextActiveId", data) ?? 1,
				renderOutlineFromData: deps.renderOutlineFromData,
				renderDashboardOverview: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ data) => {
					callRenderer("renderDashboardOverview", mainElement, data);
				},
				focusNewEntryInTree: (/** @type {any} */ entry) => {
					callTree("focusNewEntryInTree", entry);
				},
				renderEntryDetail: (/** @type {HTMLElement} */ mainElement, /** @type {any} */ entry) => {
					renderEntryDetail(mainElement, entry);
				},
			}));
		}

		/**
		 * 全モジュールを依存関係の順序に従って初期化する。
		 * 各モジュールへ渡す呼び出し口（callRenderer など）は呼び出し時に解決するため、
		 * ここでの順序は「生成時点で他モジュールの実体が必要か」だけで決めてよい。
		 */
		function initializeAllModules() {
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
