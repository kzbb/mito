// @ts-check

(function registerAppDocumentActions(globalObject) {
	/**
	 * 現在時刻をJSTのISO文字列で返す。
	 * スクリプトの読み込み順に依存しないよう、参照は呼び出し時まで遅延させる。
	 * @returns {string}
	 */
	function nowJST() {
		const resolved = /** @type {any} */ (window).nowJST;
		if (typeof resolved !== "function") {
			console.error("Data model module is not available");
			return new Date().toISOString();
		}

		return resolved();
	}

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
			const calendarHeaders = resolveCalendarHeaders(normalizedCalendar);
			const normalizedActive = normalizeEntryArray(root.active, false, calendarHeaders);
			const normalizedDeleted = normalizeEntryArray(root.deleted, true, calendarHeaders);

			return {
				project: normalizedProject,
				generatedAt: typeof root.generatedAt === "string" ? root.generatedAt : nowJST(),
				updatedAt: typeof root.updatedAt === "string" ? root.updatedAt : nowJST(),
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
		 * カレンダーCSVの先頭行からヘッダー名を取り出す。
		 * 旧スキーマ（`from`）を `dateCalendar` へ移行する際の列名決定に使う。
		 * @param {null | { csvText: string }} calendar
		 * @returns {string[]}
		 */
		function resolveCalendarHeaders(calendar) {
			if (!calendar) {
				return [];
			}

			const createCalendarUtils = /** @type {any} */ (window).createCalendarUtils;
			if (typeof createCalendarUtils !== "function") {
				return [];
			}

			const schema = createCalendarUtils().resolveCalendarSchema({ calendar });
			return Array.isArray(schema?.headers) ? schema.headers : [];
		}

		/**
		 * @param {any} list
		 * @param {boolean} allowEmpty
		 * @param {string[]} calendarHeaders
		 * @returns {any[]}
		 */
		function normalizeEntryArray(list, allowEmpty, calendarHeaders) {
			const source = Array.isArray(list) ? list : [];
			const normalized = source
				.filter((item) => item && typeof item === "object")
				.map((item, index) => normalizeEntry(item, index + 1, calendarHeaders));

			if (normalized.length === 0 && !allowEmpty) {
				// 他の経路と同じ形（dateCalendar / dashboardOrder を持つ）に揃えるため
				// normalizeEntry を通す。
				return [normalizeEntry({ category: "出来事", name: "新規エントリ", dateCalendar: {} }, 1, calendarHeaders)];
			}

			return normalized;
		}

		/**
		 * @param {any} entry
		 * @param {number} fallbackId
		 * @param {string[]} calendarHeaders
		 * @returns {any}
		 */
		function normalizeEntry(entry, fallbackId, calendarHeaders) {
			const rawId = Number.parseInt(String(entry?.id ?? ""), 10);
			const normalizedId = Number.isFinite(rawId) && rawId > 0 ? rawId : fallbackId;
			const normalizedCategory = typeof entry?.category === "string" && entry.category.trim().length > 0
				? entry.category.trim()
				: "未分類";
			const normalizedName = typeof entry?.name === "string" && entry.name.trim().length > 0
				? entry.name.trim()
				: `項目${normalizedId}`;

			return {
				...migrateLegacyFromField(entry, calendarHeaders),
				id: normalizedId,
				category: normalizedCategory,
				name: normalizedName,
				dashboardOrder: normalizeDashboardOrder(entry?.dashboardOrder),
				description: typeof entry?.description === "string" ? entry.description : "",
			};
		}

		/**
		 * 旧スキーマの `from`（カレンダー導入前の単一日付フィールド）を
		 * `dateCalendar` の先頭列へ移し、`from` を落とす。
		 *
		 * 読み込み時に一度だけ変換することで、描画やフォームの側に
		 * 旧フィールドを知っている分岐を残さずに済む。
		 * カレンダー未設定（列名が決まらない）場合は、値を失わないよう
		 * `from` をそのまま残す。この場合そもそも日付UIは表示されない。
		 *
		 * @param {any} entry
		 * @param {string[]} calendarHeaders
		 * @returns {any}
		 */
		function migrateLegacyFromField(entry, calendarHeaders) {
			const primaryHeader = calendarHeaders[0] ?? "";
			const legacyFrom = typeof entry?.from === "string" ? entry.from.trim() : "";
			if (!primaryHeader || legacyFrom.length === 0) {
				return entry;
			}

			const existing = entry.dateCalendar && typeof entry.dateCalendar === "object" && !Array.isArray(entry.dateCalendar)
				? entry.dateCalendar
				: {};
			const currentPrimary = typeof existing[primaryHeader] === "string" ? existing[primaryHeader].trim() : "";

			const migrated = { ...entry, dateCalendar: { ...existing } };
			// 既に先頭列に値があるなら、そちらを正とする（fromは捨てる）
			if (currentPrimary.length === 0) {
				migrated.dateCalendar[primaryHeader] = legacyFrom;
			}
			delete migrated.from;
			return migrated;
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
		 * @param {any | null} [fileHandle] showOpenFilePicker で得たハンドル。未対応環境ではnull
		 * @returns {Promise<boolean>}
		 */
		async function handleOpenFile(file, fileHandle) {
			try {
				const text = await file.text();
				const parsed = JSON.parse(text);
				const normalized = normalizeDocument(parsed);
				const fileName = file.name || "data.json";
				deps.setCurrentFileName(fileName);
				// ハンドルを保持できた場合、以降の保存は保存先を聞かずに上書きできる
				deps.setCurrentFileHandle(fileHandle ?? null);
				deps.renderOutlineFromData(normalized);
				deps.setFormStatus(fileHandle
					? `読み込み完了: ${fileName}（保存で上書きします）`
					: `読み込み完了: ${fileName}`);
				deps.setTopbarSaveStatus(`読み込み: ${fileName}`);
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
				generatedAt: nowJST(),
				updatedAt: nowJST(),
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
			normalizeDocument,
		};
	}

	/** @type {any} */ (globalObject).createAppDocumentActions = createAppDocumentActions;
})(window);
