// @ts-check

(function registerEntryForm(globalObject) {
	/**
	 * @param {{
	 *   getCurrentData: () => any,
	 *   getEditingEntryId: () => string | null,
	 *   setEditingEntryId: (entryId: string | null) => void,
	 *   notifyDocumentChanged: () => void,
	 *   resolveDashboardLabel: (data: any) => string,
	 *   setFormStatus: (message: string) => void,
	 *   findActiveEntryIndexById: (data: any, entryId: string | null) => number,
	 *   getNextActiveId: (data: any) => number,
	 *   renderOutlineFromData: (data: any) => void,
	 *   renderDashboardOverview: (mainElement: HTMLElement, data: any) => void,
	 *   focusNewEntryInTree: (entry: any) => void,
	 *   renderEntryDetail: (mainElement: HTMLElement, entry: any) => void
	 * }} deps
	 */
	function createEntryFormModule(deps) {
		const createCalendarUtils = /** @type {any} */ (globalObject).createCalendarUtils;
		const calendarUtils = typeof createCalendarUtils === "function" ? createCalendarUtils() : null;
		// 共有ヘルパー。代替実装は renderer-fallbacks.js 側に集約されている。
		// 読み込まれていないのは配置ミスなので、黙って劣化させず即座に失敗させる。
		const createRendererFallbacks = /** @type {any} */ (globalObject).createRendererFallbacks;
		if (typeof createRendererFallbacks !== "function") {
			throw new Error("[mito] renderer-fallbacks.js が読み込まれていません");
		}
		const shared = createRendererFallbacks();
		const resolveCalendarSchema = shared.resolveCalendarSchema;
		const findCalendarRowByValue = calendarUtils?.findCalendarRowByValue ?? (() => null);
		const cssEscapeAttr = shared.cssEscape;
		const resolveTimelineValues = shared.resolveTimelineValues;

		/** カードの色として選択できるポストイット風の5色（16進カラーコード、style.cssの配色に準拠） */
		const ENTRY_CARD_COLORS = ["#ffffff", "#ffeef3", "#fffde7", "#eaf8ec", "#e9f2fb"];
		const DEFAULT_ENTRY_CARD_COLOR = ENTRY_CARD_COLORS[0];

		/** 直近に選択されたカード色。新規エントリ作成時の初期値として引き継ぐ。 */
		let lastUsedEntryColor = DEFAULT_ENTRY_CARD_COLOR;

		/** @type {((entry: any | null) => void) | null} */
		let syncDateInputs = null;
		/**
		 * 左下ペインのエントリ入力フォームを初期化する。
		 */
		function setupEntryForm() {
			const formElement = /** @type {HTMLFormElement | null} */ (document.getElementById("entry-form"));
			const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));
			const submitButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("preview-entry"));
			const resetButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("start-new-entry"));

			if (!formElement || !mainElement || !submitButton || !resetButton) {
				return;
			}

			syncDateInputs = setupTimelineFields(formElement);
			syncDateInputs(null);
			resetButton.hidden = true;
			ensureEditingStatusBadge(formElement);

			// データ変更イベント発火時、編集中エントリの日付フィールドを最新状態に同期する
			document.addEventListener("mito:data-changed", () => {
				const currentData = deps.getCurrentData();
				const editingEntryId = deps.getEditingEntryId();
				if (!currentData || !editingEntryId || !Array.isArray(currentData.active)) {
					syncDateInputs?.(null);
					return;
				}

				const targetIndex = deps.findActiveEntryIndexById(currentData, editingEntryId);
				if (targetIndex < 0) {
					syncDateInputs?.(null);
					return;
				}

				syncDateInputs?.(currentData.active[targetIndex] ?? null);
			});

			// Tab キーによるフォーカス移動をカスタム制御し、フォーム内で循環させる
			formElement.addEventListener("keydown", (event) => {
				// input要素でEnterキーを押したとき、SafariではsubmitのpreventDefaultだけでは
				// スクロール位置が変わる問題が起きる。keydownで先に抑止して完全に防ぐ。
				// isComposingチェックでIME変換確定（日本語入力など）は除外する。
				if (event.key === "Enter" && !event.isComposing && event.target instanceof HTMLInputElement) {
					event.preventDefault();
					return;
				}

				// 編集中にEscキーを押すと、「新規カード」ボタンと同じ操作で追加モードに戻る。
				// 誤って前のカードへの上書きを続けてしまう事故を、キー一つで抜けられるようにして防ぐ。
				if (event.key === "Escape") {
					if (deps.getEditingEntryId() !== null) {
						event.preventDefault();
						formElement.reset();
					}
					return;
				}

				if (event.key !== "Tab") {
					return;
				}

				const focusables = getFormTabStops(formElement);
				if (focusables.length === 0) {
					return;
				}

				const active = document.activeElement;
				const currentIndex = focusables.findIndex((element) => element === active);
				const offset = event.shiftKey ? -1 : 1;
				const normalizedIndex = currentIndex < 0 ? 0 : currentIndex;
				const nextIndex = (normalizedIndex + offset + focusables.length) % focusables.length;

				event.preventDefault();
				focusables[nextIndex].focus();
			});

			// input / change どちらのイベントでもリアルタイム編集を反映する
			// （select は input を発火しないブラウザがあるため change も購読する）
			const handleRealtimeEdit = () => {
				applyRealtimeEdit(formElement, mainElement);
			};
			formElement.addEventListener("input", handleRealtimeEdit);
			formElement.addEventListener("change", handleRealtimeEdit);

			// フォーム送信 = 新規エントリの追加。編集中の場合はリアルタイム反映済みのため何もしない
			formElement.addEventListener("submit", (event) => {
				event.preventDefault();

				const editingEntryId = deps.getEditingEntryId();
				if (editingEntryId !== null) {
					deps.setFormStatus("編集中は自動反映されます。次のカードを追加する場合は「新規カード」を押してください。");
					return;
				}

				const formData = new FormData(formElement);
				const category = readTrimmedFormValue(formData, "category");
				const name = readTrimmedFormValue(formData, "name");

				if (!category || !name) {
					deps.setFormStatus("カテゴリと名称は必須です。");
					return;
				}

				const currentData = deps.getCurrentData();
				if (!currentData) {
					deps.setFormStatus("先に「開く」でJSONを読み込んでください。");
					return;
				}

				const currentTitle = mainElement.querySelector("h2")?.textContent?.trim() ?? "";
				const dashboardLabel = deps.resolveDashboardLabel(currentData);
				const wasDashboardView = currentTitle === dashboardLabel;

				const timelinePayload = buildTimelinePayload(formElement);
				const dashboardOrder = readDashboardOrder(formElement);
				const color = readEntryColor(formElement);
				const entryPayload = {
					category,
					name,
					color,
					dashboardOrder,
					description: readTrimmedFormValue(formData, "description"),
					...timelinePayload,
				};

				if (!Array.isArray(currentData.active)) {
					currentData.active = [];
				}

				const nextId = deps.getNextActiveId(currentData);
				const targetEntry = { id: nextId, ...entryPayload };
				currentData.active.push(targetEntry);

				// 追加直後にそのカードを編集状態にはせず、何も選択していない状態に戻す。
				setFormModeAdd();
				deps.renderOutlineFromData(currentData);
				if (wasDashboardView) {
					window.requestAnimationFrame(() => {
						scrollToBalancedCardPosition(mainElement, targetEntry);
					});
					deps.setFormStatus("新しいエントリを追加し、年表表示を維持しました。");
					return;
				}

				deps.focusNewEntryInTree(targetEntry);
				deps.renderEntryDetail(mainElement, targetEntry);
				deps.setFormStatus("新しいエントリを追加し、該当カテゴリへ反映しました。");
			});

				// フォームリセット（「新規カード」ボタン）で追加モードに戻す
				// reset イベントはネイティブのフォームリセットより先に発火するため、
				// 色選択の引き継ぎ処理はリセット完了後（次フレーム）まで遅延させる。
			formElement.addEventListener("reset", () => {
				window.requestAnimationFrame(() => {
					setFormModeAdd();
					syncDateInputs?.(null);
				});
				deps.setFormStatus("新しいエントリの作成を開始できます。入力後「新規カード」を押してください。");
			});
		}

		/**
		 * @param {HTMLFormElement} formElement
		 * @param {HTMLElement} mainElement
		 */
		function applyRealtimeEdit(formElement, mainElement) {
			const editingEntryId = deps.getEditingEntryId();
			if (!editingEntryId) {
				return;
			}

			const currentData = deps.getCurrentData();
			if (!currentData || !Array.isArray(currentData.active)) {
				return;
			}

			const targetIndex = deps.findActiveEntryIndexById(currentData, editingEntryId);
			if (targetIndex < 0) {
				return;
			}

			const targetEntry = currentData.active[targetIndex];
			const categoryInput = /** @type {(HTMLInputElement | HTMLSelectElement | null)} */ (formElement.elements.namedItem("category"));
			const nameInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("name"));
			const descriptionInput = /** @type {HTMLTextAreaElement | null} */ (formElement.elements.namedItem("description"));
			if (!targetEntry || !categoryInput || !nameInput || !descriptionInput) {
				return;
			}

			const nextCategory = categoryInput.value.trim();
			const nextName = nameInput.value.trim();
			if (!nextCategory || !nextName) {
				return;
			}

			const timelinePayload = buildTimelinePayload(formElement);
			const dashboardOrder = readDashboardOrder(formElement);
			const color = readEntryColor(formElement);
			const nextPayload = {
				category: nextCategory,
				name: nextName,
				color,
				dashboardOrder,
				description: descriptionInput.value.trim(),
				...timelinePayload,
			};

			// 再描画前に現在のビューを確認しておく（描画後は DOM が変わるため）
			const activeView = captureActiveMainView(mainElement);
			const nextEntry = { ...targetEntry, ...nextPayload };
			// JSON 比較で実際に変化があった場合のみ描画を行い、不要な再描画を避ける
			const changed = JSON.stringify(nextEntry) !== JSON.stringify(targetEntry);
			if (!changed) {
				return;
			}

			// カテゴリや名前が変わった場合はツリーも再描画が必要。それ以外は変更通知のみ発火する。
			// どちらの経路でも変更通知はちょうど1回に保つ（renderOutlineFromData が内部で発火する）。
			const treeAffectingChange = nextEntry.category !== targetEntry.category
				|| nextEntry.name !== targetEntry.name;

			currentData.active[targetIndex] = nextEntry;

			if (treeAffectingChange) {
				deps.renderOutlineFromData(currentData);
				deps.focusNewEntryInTree(nextEntry);
			} else {
				deps.notifyDocumentChanged();
			}

			if (activeView === "dashboard") {
				// 再描画後にカードの実際の画面座標を取得し、バランスの良い位置に調整する。
				// スクロール位置の保存・復元は行わない（Safari での競合を回避するため）。
				deps.renderDashboardOverview(mainElement, currentData);
				window.requestAnimationFrame(() => {
					scrollToBalancedCardPosition(mainElement, nextEntry);
				});
			} else if (activeView === "detail") {
				deps.renderEntryDetail(mainElement, nextEntry);
			}

			deps.setFormStatus("編集中: 入力内容をリアルタイム反映しました。");
		}

		/**
		 * @param {HTMLElement} mainElement
		 * @returns {"dashboard" | "detail" | "other"}
		 */
		function captureActiveMainView(mainElement) {
			if (mainElement.classList.contains("dashboard-view")) {
				return "dashboard";
			}

			if (mainElement.querySelector(".entry-wiki")) {
				return "detail";
			}

			return "other";
		}

		/**
		 * @param {string | null} entryId
		 */
		function syncDashboardCardSelection(entryId) {
			const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));
			if (!mainElement || !mainElement.classList.contains("dashboard-view")) {
				return;
			}

			const normalizedEntryId = typeof entryId === "string" ? entryId.trim() : "";
			const selector = normalizedEntryId.length > 0
				? `.dashboard-entry-card[data-entry-id="${cssEscapeAttr(normalizedEntryId)}"]`
				: "";
			const selectedCard = selector.length > 0
				? /** @type {HTMLElement | null} */ (mainElement.querySelector(selector))
				: null;

			for (const card of mainElement.querySelectorAll(".dashboard-entry-card")) {
				if (!(card instanceof HTMLElement)) {
					continue;
				}

				const isSelected = selectedCard === card;
				card.classList.toggle("is-editing", isSelected);
				if (!isSelected) {
					card.blur();
				}
			}

			const activeElement = document.activeElement;
			if (
				activeElement instanceof HTMLElement
				&& mainElement.contains(activeElement)
				&& (!selectedCard || (activeElement !== selectedCard && !selectedCard.contains(activeElement)))
			) {
				activeElement.blur();
			}
		}

		/**
		 * @param {HTMLFormElement} formElement
		 * @returns {(entry: any | null) => void}
		 */
		function setupTimelineFields(formElement) {
			const staticDateGrid = /** @type {HTMLElement | null} */ (formElement.querySelector(".form-grid-2"));
			let dynamicTimelineHost = /** @type {HTMLElement | null} */ (formElement.querySelector(".timeline-field-groups"));
			let emptyHint = /** @type {HTMLElement | null} */ (formElement.querySelector(".timeline-empty-hint"));
			if (!dynamicTimelineHost) {
				dynamicTimelineHost = document.createElement("div");
				dynamicTimelineHost.className = "timeline-field-groups";
				const descriptionField = formElement.querySelector("textarea[name='description']")?.closest(".form-field");
				if (descriptionField && descriptionField.parentElement) {
					descriptionField.parentElement.insertBefore(dynamicTimelineHost, descriptionField);
				} else {
					formElement.appendChild(dynamicTimelineHost);
				}
			}

			if (!emptyHint) {
				emptyHint = document.createElement("p");
				emptyHint.className = "timeline-empty-hint";
				emptyHint.textContent = "カレンダー未設定です。設定から追加してください。";
				const descriptionField = formElement.querySelector("textarea[name='description']")?.closest(".form-field");
				if (descriptionField && descriptionField.parentElement) {
					descriptionField.parentElement.insertBefore(emptyHint, descriptionField);
				} else {
					formElement.appendChild(emptyHint);
				}
			}

			return (entry) => {
				const currentData = deps.getCurrentData();
				const schema = resolveCalendarSchema(currentData);
				dynamicTimelineHost.innerHTML = "";

				if (!Array.isArray(schema.headers) || schema.headers.length === 0) {
					emptyHint.hidden = false;
					if (staticDateGrid) {
						staticDateGrid.hidden = true;
					}
					return;
				}

				emptyHint.hidden = true;
				if (staticDateGrid) {
					staticDateGrid.hidden = true;
				}

				dynamicTimelineHost.appendChild(createTimelineGroup("date", "", schema, entry));
			};
		}

		/**
		 * @param {string} key
		 * @param {string} legendLabel
		 * @param {{ headers: string[], rows: Record<string, string>[] }} schema
		 * @param {any | null} entry
		 * @returns {HTMLElement}
		 */
		function createTimelineGroup(key, legendLabel, schema, entry) {
			const fieldset = document.createElement("fieldset");
			fieldset.className = "timeline-fieldset";
			fieldset.dataset.timelineKey = key;

			if (legendLabel.trim().length > 0) {
				const legend = document.createElement("legend");
				legend.className = "timeline-legend";
				legend.textContent = legendLabel;
				fieldset.appendChild(legend);
			}

			const values = resolveTimelineValues(entry, key, schema.headers);

			for (const header of schema.headers) {
				const wrapper = document.createElement("label");
				wrapper.className = "form-field";

				const label = document.createElement("span");
				label.textContent = header;
				wrapper.appendChild(label);

				const select = document.createElement("select");
				select.name = `${key}Calendar.${header}`;
				select.dataset.timelineField = header;
				select.setAttribute("aria-label", header);

				const options = new Set();
				for (const row of schema.rows) {
					const candidate = String(row[header] ?? "").trim();
					if (candidate.length > 0) {
						options.add(candidate);
					}
				}

				const currentValue = String(values[header] ?? "").trim();
				if (currentValue.length > 0) {
					options.add(currentValue);
				}

				const emptyOption = document.createElement("option");
				emptyOption.value = "";
				emptyOption.textContent = "";
				select.appendChild(emptyOption);

				for (const optionValue of options) {
					const option = document.createElement("option");
					option.value = optionValue;
					option.textContent = optionValue;
					select.appendChild(option);
				}

				select.value = currentValue;
				wrapper.appendChild(select);

				const syncRowSelection = () => {
					const row = findCalendarRowByValue(schema.rows, header, select.value.trim());
					if (!row) {
						return;
					}
					applyTimelineRowSelection(fieldset, schema.headers, row);
				};

				select.addEventListener("input", syncRowSelection);
				select.addEventListener("change", syncRowSelection);

				fieldset.appendChild(wrapper);
			}

			return fieldset;
		}

		/**
		 * @param {HTMLElement} groupElement
		 * @param {string[]} headers
		 * @param {Record<string, string>} row
		 */
		function applyTimelineRowSelection(groupElement, headers, row) {
			for (const header of headers) {
				const selector = `[data-timeline-field="${cssEscapeAttr(header)}"]`;
				const field = /** @type {(HTMLInputElement | HTMLSelectElement | null)} */ (groupElement.querySelector(selector));
				if (field) {
					field.value = String(row[header] ?? "");
				}
			}
		}

		/**
		 * @param {HTMLFormElement} formElement
		 * @returns {Record<string, unknown>}
		 */
		function buildTimelinePayload(formElement) {
			const currentData = deps.getCurrentData();
			const schema = resolveCalendarSchema(currentData);
			if (!Array.isArray(schema.headers) || schema.headers.length === 0) {
				return { dateCalendar: {} };
			}

			/** @type {Record<string, string>} */
			const values = {};
			for (const header of schema.headers) {
				const inputName = `dateCalendar.${header}`;
				const field = /** @type {(HTMLInputElement | HTMLSelectElement | null)} */ (formElement.elements.namedItem(inputName));
				values[header] = field ? field.value.trim() : "";
			}

			return {
				dateCalendar: values,
			};
		}

		/**
		 * @param {HTMLFormElement} formElement
		 * @returns {HTMLElement[]}
		 */
		function getFormTabStops(formElement) {
			const selector = [
				"input:not([type='hidden']):not([disabled])",
				"textarea:not([disabled])",
				"select:not([disabled])",
				"button:not([disabled])",
				"[tabindex]:not([tabindex='-1'])",
			].join(",");

			return Array.from(formElement.querySelectorAll(selector))
				.filter((element) => element instanceof HTMLElement)
				.filter((element) => !element.hasAttribute("hidden"))
				.filter((element) => element.tabIndex >= 0);
		}

		/**
		 * @param {FormData} formData
		 * @param {string} key
		 * @returns {string}
		 */
		function readTrimmedFormValue(formData, key) {
			const value = formData.get(key);
			return typeof value === "string" ? value.trim() : "";
		}

		/**
		 * @param {HTMLFormElement} formElement
		 * @returns {number}
		 */
		function readDashboardOrder(formElement) {
			const field = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("dashboardOrder"));
			const raw = field?.value?.trim() ?? "";
			if (raw.length === 0) {
				return 0;
			}

			const parsed = Number.parseInt(raw, 10);
			return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
		}

		/**
		 * @param {HTMLFormElement} formElement
		 * @returns {string}
		 */
		function readEntryColor(formElement) {
			const checked = /** @type {HTMLInputElement | null} */ (
				formElement.querySelector("input[name='color']:checked")
			);
			const value = checked?.value?.trim() ?? "";
			const color = ENTRY_CARD_COLORS.includes(value) ? value : DEFAULT_ENTRY_CARD_COLOR;
			lastUsedEntryColor = color;
			return color;
		}

		/**
		 * フォームの色選択ラジオボタンを指定の色に合わせる（一覧にない色は既定色扱い）。
		 * @param {HTMLFormElement} formElement
		 * @param {string} color
		 */
		function applyEntryColorSelection(formElement, color) {
			const targetColor = ENTRY_CARD_COLORS.includes(color) ? color : DEFAULT_ENTRY_CARD_COLOR;
			for (const input of formElement.querySelectorAll("input[name='color']")) {
				if (input instanceof HTMLInputElement) {
					input.checked = input.value === targetColor;
				}
			}
		}

		/**
		 * フォームの色選択ラジオボタンを、指定エントリの色（未指定時は既定色）に合わせる。
		 * @param {HTMLFormElement} formElement
		 * @param {any} entry
		 */
		function syncEntryColorInputs(formElement, entry) {
			const rawColor = typeof entry?.color === "string" ? entry.color.trim() : "";
			applyEntryColorSelection(formElement, rawColor || DEFAULT_ENTRY_CARD_COLOR);
		}

		/**
		 * ダッシュボード再描画後、編集中カードの実際の画面座標を取得し、
		 * バランスの良い位置（コンテナ上端から1/3付近）にスクロール調整する。
		 * カードが既に快適ゾーン（上15%〜下25%の範囲に完全表示）にある場合は何もしない。
		 * @param {HTMLElement} mainElement
		 * @param {any} entry
		 */
		function scrollToBalancedCardPosition(mainElement, entry) {
			const entryId = String(entry?.id ?? "").trim();
			if (entryId.length === 0) {
				return;
			}

			const tableWrap = /** @type {HTMLElement | null} */ (mainElement.querySelector(".dashboard-table-wrap"));
			if (!tableWrap) {
				return;
			}

			const selector = `.dashboard-entry-card[data-entry-id="${cssEscapeAttr(entryId)}"]`;
			const card = /** @type {HTMLElement | null} */ (tableWrap.querySelector(selector));
			if (!card) {
				return;
			}

			const containerRect = tableWrap.getBoundingClientRect();
			const cardRect = card.getBoundingClientRect();

			// カードがコンテナの可視範囲に完全に収まっていれば何もしない。
			// コンフォートゾーン判定（上下%の閾値）は使わない。
			// 理由: refreshEntryBucketLayoutsによるカード高さの変化で座標がわずかにずれると
			// 閾値を跨ぎやすく、入力のたびに繰り返しスクロールが発生するため。
			const isFullyVisible = cardRect.top >= containerRect.top && cardRect.bottom <= containerRect.bottom;
			if (isFullyVisible) {
				return;
			}

			// カードをコンテナ上端から1/3の位置に揃える（即時適用）。
			// behavior: "smooth" は使わない。スムーズスクロール中に次の入力が来ると
			// 中間座標を読み取ってしまい、再スクロールが繰り返されるジッターが生じるため。
			const targetOffset = tableWrap.clientHeight * 0.33;
			const nextTop = tableWrap.scrollTop + (cardRect.top - containerRect.top) - targetOffset;
			const maxScrollTop = Math.max(0, tableWrap.scrollHeight - tableWrap.clientHeight);
			tableWrap.scrollTop = Math.min(Math.max(0, nextTop), maxScrollTop);
		}

		/**
		 * 見出し（データ入力）の隣に「編集中」バッジ要素を一度だけ用意する。
		 * 表示・非表示はCSS側（.bottom-pane.is-editing-entry）に任せ、ここでは要素の存在だけ保証する。
		 * @param {HTMLFormElement} formElement
		 * @returns {HTMLElement | null}
		 */
		function ensureEditingStatusBadge(formElement) {
			const title = formElement.closest(".bottom-pane")?.querySelector(".entry-pane-header .pane-title");
			if (!title) {
				return null;
			}

			let badge = /** @type {HTMLElement | null} */ (title.querySelector(".entry-pane-status-badge"));
			if (!badge) {
				badge = document.createElement("span");
				badge.className = "entry-pane-status-badge";
				badge.textContent = "編集中";
				title.appendChild(badge);
			}

			return badge;
		}

		/**
		 * 入力パネル全体に編集中の状態クラスを付け外しする。
		 * ステータス文言はフッターにあり目に入りにくいため、パネル自体の見た目を変えて
		 * 「今どのモードか」を入力中の視線の近くで一目で分かるようにする。
		 * @param {HTMLFormElement} formElement
		 * @param {boolean} isEditing
		 */
		function setEditingPaneVisualState(formElement, isEditing) {
			const pane = formElement.closest(".bottom-pane");
			pane?.classList.toggle("is-editing-entry", isEditing);
		}

		/**
		 * 選択エントリをフォームに反映し、送信モードを「更新」に切り替える。
		 * @param {any} entry
		 */
		function enterEditMode(entry) {
			const formElement = /** @type {HTMLFormElement | null} */ (document.getElementById("entry-form"));
			const submitButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("preview-entry"));
			const resetButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("start-new-entry"));

			if (!formElement || !submitButton || !resetButton) {
				return;
			}

			setEditingPaneVisualState(formElement, true);

			const categoryInput = /** @type {(HTMLInputElement | HTMLSelectElement | null)} */ (formElement.elements.namedItem("category"));
			const nameInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("name"));
			const orderInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("dashboardOrder"));
			const descriptionInput = /** @type {HTMLTextAreaElement | null} */ (formElement.elements.namedItem("description"));

			if (!categoryInput || !nameInput || !orderInput || !descriptionInput) {
				return;
			}

			deps.setEditingEntryId(String(entry?.id ?? ""));
			syncDashboardCardSelection(String(entry?.id ?? ""));
			categoryInput.value = typeof entry?.category === "string" ? entry.category : "";
			nameInput.value = typeof entry?.name === "string" ? entry.name : "";
			orderInput.value = Number.isFinite(Number(entry?.dashboardOrder))
				? String(Math.max(0, Number.parseInt(String(entry.dashboardOrder), 10)))
				: "0";
			descriptionInput.value = typeof entry?.description === "string" ? entry.description : "";
			syncEntryColorInputs(formElement, entry);
			syncDateInputs?.(entry);

			// type="button"にすることで、Safariを含む全ブラウザで
			// input要素でのEnterキーがフォーム送信を引き起こさないようにする
			submitButton.type = "button";
			submitButton.hidden = true;
			resetButton.hidden = false;
			deps.setFormStatus("編集中: 入力内容はリアルタイムで反映されます。次のカードを追加する場合は「新規カード」を押してください。");
		}

		/**
		 * フォームを新規追加モードに戻す。
		 */
		function setFormModeAdd() {
			deps.setEditingEntryId(null);
			syncDashboardCardSelection(null);
			syncDateInputs?.(null);
			const formElement = /** @type {HTMLFormElement | null} */ (document.getElementById("entry-form"));
			if (formElement) {
				setEditingPaneVisualState(formElement, false);
				const categoryInput = /** @type {(HTMLInputElement | HTMLSelectElement | null)} */ (formElement.elements.namedItem("category"));
				const nameInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("name"));
				const orderInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("dashboardOrder"));
				const descriptionInput = /** @type {HTMLTextAreaElement | null} */ (formElement.elements.namedItem("description"));
				if (categoryInput) {
					categoryInput.value = "";
				}
				if (nameInput) {
					nameInput.value = "";
				}
				if (orderInput) {
					orderInput.value = "0";
				}
				if (descriptionInput) {
					descriptionInput.value = "";
				}
				// カード色は前回選択した色を引き継ぐ（承前）
				applyEntryColorSelection(formElement, lastUsedEntryColor);
			}

			const submitButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("preview-entry"));
			const resetButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("start-new-entry"));
			if (submitButton) {
				submitButton.textContent = "新規カード";
				submitButton.type = "submit";
				submitButton.hidden = false;
			}
			if (resetButton) {
				resetButton.hidden = true;
			}

		}

		return {
			setupEntryForm,
			enterEditMode,
			setFormModeAdd,
		};
	}

	/** @type {any} */ (globalObject).createEntryFormModule = createEntryFormModule;
})(window);
