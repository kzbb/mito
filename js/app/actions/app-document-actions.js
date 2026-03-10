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
		 * Handle selected JSON file from top bar open action.
		 * @param {File} file
		 * @returns {Promise<void>}
		 */
		async function handleOpenFile(file) {
			try {
				const text = await file.text();
				const parsed = JSON.parse(text);
				deps.setCurrentFileName(file.name || "data.json");
				deps.setCurrentFileHandle(null);
				deps.renderOutlineFromData(parsed);
				deps.setFormStatus(`読み込み完了: ${file.name || "data.json"}`);
				deps.setTopbarSaveStatus(`読み込み: ${file.name || "data.json"}`);
			} catch (error) {
				console.error("Failed to load selected JSON", error);
				deps.renderFileLoadError("JSONの読み込みに失敗しました。形式を確認してください。");
				deps.setFormStatus("JSONの読み込みに失敗しました。形式を確認してください。");
				deps.setTopbarSaveStatus("読み込み失敗");
			}
		}

		/**
		 * Create a new document and render it.
		 */
		function handleNewFile() {
			const template = createNewDocumentTemplate();
			deps.setCurrentFileName("untitled.json");
			deps.setCurrentFileHandle(null);
			deps.renderOutlineFromData(template);
			deps.setFormModeAdd();
			deps.setFormStatus("新規ドキュメントを作成しました。必要に応じて保存してください。");
			deps.setTopbarSaveStatus("未保存: 新規ドキュメント");
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
						date: "",
						dateCalendar: {},
						description: "まずは設定からカレンダーを追加してください。",
					},
				],
				archived: [],
			};
		}

		/**
		 * Normalize old setting keys to new names for compatibility.
		 * @param {any} data
		 */
		function normalizeSettingsKeys(data) {
			if (!data || typeof data !== "object") {
				return;
			}

			if (
				(!data.calendar || typeof data.calendar !== "object")
				&& data.settings
				&& typeof data.settings === "object"
				&& data.settings.calendar
				&& typeof data.settings.calendar === "object"
			) {
				data.calendar = data.settings.calendar;
			}

			if (!data.settings || typeof data.settings !== "object") {
				return;
			}

			const settings = data.settings;
			if (typeof settings.focusCategory !== "string" && typeof settings.masterCategory === "string") {
				settings.focusCategory = settings.masterCategory;
			}

			if (typeof settings.dashboardLabel !== "string" && typeof settings.masterCategoryDashboard === "string") {
				settings.dashboardLabel = settings.masterCategoryDashboard;
			}

			delete settings.masterCategory;
			delete settings.masterCategoryDashboard;
			delete settings.language;
			delete settings.calendar;

			normalizeEntryDateFields(data.active);
			normalizeEntryDateFields(data.archived);
		}

		/**
		 * @param {any} entries
		 */
		function normalizeEntryDateFields(entries) {
			if (!Array.isArray(entries)) {
				return;
			}

			for (const entry of entries) {
				if (!entry || typeof entry !== "object") {
					continue;
				}

				if (typeof entry.date !== "string") {
					if (typeof entry.from === "string") {
						entry.date = entry.from;
					} else if (typeof entry.to === "string") {
						entry.date = entry.to;
					} else {
						entry.date = "";
					}
				}

				if (!entry.dateCalendar || typeof entry.dateCalendar !== "object") {
					if (entry.fromCalendar && typeof entry.fromCalendar === "object") {
						entry.dateCalendar = { ...entry.fromCalendar };
					} else if (entry.toCalendar && typeof entry.toCalendar === "object") {
						entry.dateCalendar = { ...entry.toCalendar };
					} else {
						entry.dateCalendar = {};
					}
				}

				delete entry.from;
				delete entry.to;
				delete entry.fromCalendar;
				delete entry.toCalendar;
			}
		}

		return {
			handleOpenFile,
			handleNewFile,
			normalizeSettingsKeys,
		};
	}

	/** @type {any} */ (globalObject).createAppDocumentActions = createAppDocumentActions;
})(window);
