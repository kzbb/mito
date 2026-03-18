// @ts-check

(function registerAppDocumentActions(globalObject) {
	/**
	 * @param {{
	 *   renderOutlineFromData: (data: any) => void,
	 *   setFormModeAdd: () => void,
	 *   setFormStatus: (message: string) => void,
	 *   setTopbarSaveStatus: (message: string) => void,
	 *   setCurrentFileName: (fileName: string) => void,
	 *   setCurrentFileHandle: (fileHandle: any | null) => void,
	 *   renderFileLoadError: (message: string) => void
	 * }} deps
	 */
	function createAppDocumentActions(deps) {
		/**
		 * @param {any} parsed
		 * @returns {any}
		 */
		function normalizeDocument(parsed) {
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
				throw new Error("Document root must be an object.");
			}

			const root = /** @type {Record<string, any>} */ (parsed);
			const normalizedProject = typeof root.project === "string" && root.project.trim().length > 0
				? root.project.trim()
				: "プロジェクト";
			const normalizedSettings = normalizeSettings(root.settings);
			const normalizedCalendar = normalizeCalendar(root.calendar);
			const normalizedActive = normalizeEntryArray(root.active, false);
			const normalizedDeleted = normalizeEntryArray(root.deleted, true);

			return {
				project: normalizedProject,
				generatedAt: typeof root.generatedAt === "string" ? root.generatedAt : new Date().toISOString(),
				updatedAt: typeof root.updatedAt === "string" ? root.updatedAt : new Date().toISOString(),
				version: Number.isFinite(Number(root.version)) ? Number(root.version) : 1,
				calendar: normalizedCalendar,
				settings: normalizedSettings,
				active: normalizedActive,
				deleted: normalizedDeleted,
			};
		}

		/**
		 * @param {any} settings
		 * @returns {Record<string, any>}
		 */
		function normalizeSettings(settings) {
			const base = settings && typeof settings === "object" && !Array.isArray(settings)
				? { ...settings }
				: {};

			if (typeof base.focusCategory !== "string" || base.focusCategory.trim().length === 0) {
				base.focusCategory = "出来事";
			}

			if (typeof base.dashboardLabel !== "string" || base.dashboardLabel.trim().length === 0) {
				base.dashboardLabel = "年表";
			}

			return base;
		}

		/**
		 * @param {any} calendar
		 * @returns {null | { csvText: string }}
		 */
		function normalizeCalendar(calendar) {
			if (!calendar || typeof calendar !== "object" || Array.isArray(calendar)) {
				return null;
			}

			const csvText = typeof calendar.csvText === "string"
				? calendar.csvText
				: typeof calendar.csv === "string"
					? calendar.csv
					: "";
			if (!csvText) {
				return null;
			}

			return { csvText };
		}

		/**
		 * @param {any} list
		 * @param {boolean} allowEmpty
		 * @returns {any[]}
		 */
		function normalizeEntryArray(list, allowEmpty) {
			const source = Array.isArray(list) ? list : [];
			const normalized = source
				.filter((item) => item && typeof item === "object")
				.map((item, index) => normalizeEntry(item, index + 1));

			if (normalized.length === 0 && !allowEmpty) {
				return [
					{
						id: 1,
						category: "出来事",
						name: "新規エントリ",
						description: "",
						timeline: {},
					},
				];
			}

			return normalized;
		}

		/**
		 * @param {any} entry
		 * @param {number} fallbackId
		 * @returns {any}
		 */
		function normalizeEntry(entry, fallbackId) {
			const rawId = Number.parseInt(String(entry?.id ?? ""), 10);
			const normalizedId = Number.isFinite(rawId) && rawId > 0 ? rawId : fallbackId;
			const normalizedCategory = typeof entry?.category === "string" && entry.category.trim().length > 0
				? entry.category.trim()
				: "未分類";
			const normalizedName = typeof entry?.name === "string" && entry.name.trim().length > 0
				? entry.name.trim()
				: `項目${normalizedId}`;

			return {
				...entry,
				id: normalizedId,
				category: normalizedCategory,
				name: normalizedName,
				dashboardOrder: normalizeDashboardOrder(entry?.dashboardOrder),
				description: typeof entry?.description === "string" ? entry.description : "",
			};
		}

		/**
		 * @param {unknown} value
		 * @returns {number}
		 */
		function normalizeDashboardOrder(value) {
			const parsed = Number.parseInt(String(value ?? ""), 10);
			return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
		}

		/**
		 * トップバーの「開く」から選択されたJSONファイルを処理する。
		 * @param {File} file
		 * @returns {Promise<boolean>}
		 */
		async function handleOpenFile(file) {
			try {
				const text = await file.text();
				const parsed = JSON.parse(text);
				const normalized = normalizeDocument(parsed);
				deps.setCurrentFileName(file.name || "data.json");
				deps.setCurrentFileHandle(null);
				deps.renderOutlineFromData(normalized);
				deps.setFormStatus(`読み込み完了: ${file.name || "data.json"}`);
				deps.setTopbarSaveStatus(`読み込み: ${file.name || "data.json"}`);
				return true;
			} catch (error) {
				console.error("Failed to load selected JSON", error);
				deps.renderFileLoadError("JSONの読み込みに失敗しました。形式を確認してください。");
				deps.setFormStatus("JSONの読み込みに失敗しました。形式を確認してください。");
				deps.setTopbarSaveStatus("読み込み失敗");
				return false;
			}
		}

		/**
		 * 新しいドキュメントを作成して描画する。
		 * @returns {boolean}
		 */
		function handleNewFile() {
			const template = createNewDocumentTemplate();
			deps.setCurrentFileName("untitled.json");
			deps.setCurrentFileHandle(null);
			deps.renderOutlineFromData(template);
			deps.setFormModeAdd();
			deps.setFormStatus("新規ドキュメントを作成しました。必要に応じて保存してください。");
			deps.setTopbarSaveStatus("未保存: 新規ドキュメント");
			return true;
		}

		/**
		 * @returns {any}
		 */
		function createNewDocumentTemplate() {
			return {
				project: "新規プロジェクト",
				generatedAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				version: 1,
				calendar: null,
				settings: {
					focusCategory: "出来事",
					dashboardLabel: "年表",
				},
				active: [
					{
						id: 1,
						category: "出来事",
						name: "新規エントリ",
						dashboardOrder: 0,
						dateCalendar: {},
						description: "まずは設定からカレンダーを追加してください。",
					},
				],
				deleted: [],
			};
		}

		return {
			handleOpenFile,
			handleNewFile,
		};
	}

	/** @type {any} */ (globalObject).createAppDocumentActions = createAppDocumentActions;
})(window);
