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
	 *   getBridgeApi: () => any,
	 *   setBridgeApi: (api: any | null) => void,
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
				onOpenEntryView: (/** @type {any} */ entry) => {
					const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));
					if (!mainElement) {
						return;
					}

					deps.getBridgeApi()?.focusNewEntryInTree?.(entry);
					deps.getBridgeApi()?.renderEntryDetail?.(mainElement, entry);
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
				onMoveEntryToDeletedFromDetail: (/** @type {any} */ entry) => {
					const currentData = deps.getCurrentData();
					if (!currentData) {
						return null;
					}

					const entryId = String(entry?.id ?? "");
					const targetIndex = deps.getBridgeApi()?.findActiveEntryIndexById?.(currentData, entryId) ?? -1;
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

					currentData.deleted.splice(index, 1);
					return true;
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
