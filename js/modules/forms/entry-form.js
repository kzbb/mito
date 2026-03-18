// @ts-check

(function registerEntryForm(globalObject) {
	/**
	 * @param {{
	 *   getCurrentData: () => any,
	 *   getEditingEntryId: () => string | null,
	 *   setEditingEntryId: (entryId: string | null) => void,
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
		const createRendererFallbacks = /** @type {any} */ (globalObject).createRendererFallbacks;
		const rendererFallbacks = typeof createRendererFallbacks === "function"
			? createRendererFallbacks()
			: null;
		const resolveCalendarSchema = rendererFallbacks?.resolveCalendarSchema ?? (() => ({ headers: [], rows: [] }));
		const findCalendarRowByValue = calendarUtils?.findCalendarRowByValue ?? (() => null);
		const resolveTimelineValues = rendererFallbacks?.resolveTimelineValues
			?? ((/** @type {any} */ _entry, /** @type {string} */ _key, /** @type {string[]} */ headers) => {
				/** @type {Record<string, string>} */
				const values = {};
				for (const header of headers) {
					values[header] = "";
				}
				return values;
			});

		/** @type {((entry: any | null) => void) | null} */
		let syncDateInputs = null;
		/**
		 * Initialize the data entry form in the lower left pane.
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

			formElement.addEventListener("keydown", (event) => {
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

			const handleRealtimeEdit = () => {
				applyRealtimeEdit(formElement, mainElement);
			};
			formElement.addEventListener("input", handleRealtimeEdit);
			formElement.addEventListener("change", handleRealtimeEdit);

			formElement.addEventListener("submit", (event) => {
				event.preventDefault();

				const editingEntryId = deps.getEditingEntryId();
				if (editingEntryId !== null) {
					deps.setFormStatus("編集中は自動反映されます。新規追加する場合は「新規作成」を押してください。");
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
				const entryPayload = {
					category,
					name,
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

				deps.renderOutlineFromData(currentData);
				if (wasDashboardView) {
					deps.renderDashboardOverview(mainElement, currentData);
					deps.setFormStatus("新しいエントリを追加し、年表表示を維持しました。");
					return;
				}

				deps.focusNewEntryInTree(targetEntry);
				deps.renderEntryDetail(mainElement, targetEntry);
				deps.setFormStatus("新しいエントリを追加し、該当カテゴリへ反映しました。");
			});

			formElement.addEventListener("reset", () => {
				setFormModeAdd();
				syncDateInputs?.(null);
				deps.setFormStatus("新しいエントリの作成を開始できます。入力後「追加」を押してください。");
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
			const nextPayload = {
				category: nextCategory,
				name: nextName,
				dashboardOrder,
				description: descriptionInput.value.trim(),
				...timelinePayload,
			};

			const activeView = captureActiveMainView(mainElement);
			const nextEntry = { ...targetEntry, ...nextPayload };
			const changed = JSON.stringify(nextEntry) !== JSON.stringify(targetEntry);
			if (!changed) {
				return;
			}

			const treeAffectingChange = nextEntry.category !== targetEntry.category
				|| nextEntry.name !== targetEntry.name;

			currentData.active[targetIndex] = nextEntry;

			if (treeAffectingChange) {
				deps.renderOutlineFromData(currentData);
				deps.focusNewEntryInTree(nextEntry);
			} else {
				document.dispatchEvent(new CustomEvent("mito:data-changed"));
			}

			if (activeView === "dashboard") {
				const previousScrollTop = mainElement.scrollTop;
				deps.renderDashboardOverview(mainElement, currentData);
				mainElement.scrollTop = previousScrollTop;
				window.requestAnimationFrame(() => {
					keepEntryCardInView(mainElement, nextEntry);
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
		 * @param {string} value
		 * @returns {string}
		 */
		function cssEscapeAttr(value) {
			if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
				return CSS.escape(value);
			}
			return value.replace(/(["\\])/g, "\\$1");
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
		 * Keep the edited dashboard card visible after a dashboard rerender.
		 * @param {HTMLElement} mainElement
		 * @param {any} entry
		 */
		function keepEntryCardInView(mainElement, entry) {
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
			const visibleTop = containerRect.top;
			const visibleBottom = containerRect.bottom;
			const isVisible = cardRect.top >= visibleTop && cardRect.bottom <= visibleBottom;
			if (isVisible) {
				return;
			}

			const nextTop = tableWrap.scrollTop
				+ (cardRect.top - containerRect.top)
				- ((tableWrap.clientHeight - cardRect.height) / 2);
			const maxScrollTop = Math.max(0, tableWrap.scrollHeight - tableWrap.clientHeight);
			const clampedTop = Math.min(Math.max(0, nextTop), maxScrollTop);

			tableWrap.scrollTo({
				top: clampedTop,
				behavior: "smooth",
			});
		}

		/**
		 * Reflect selected entry to form and switch submit mode to update.
		 * @param {any} entry
		 */
		function enterEditMode(entry) {
			const formElement = /** @type {HTMLFormElement | null} */ (document.getElementById("entry-form"));
			const submitButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("preview-entry"));
			const resetButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("start-new-entry"));

			if (!formElement || !submitButton || !resetButton) {
				return;
			}

			const categoryInput = /** @type {(HTMLInputElement | HTMLSelectElement | null)} */ (formElement.elements.namedItem("category"));
			const nameInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("name"));
			const orderInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("dashboardOrder"));
			const descriptionInput = /** @type {HTMLTextAreaElement | null} */ (formElement.elements.namedItem("description"));

			if (!categoryInput || !nameInput || !orderInput || !descriptionInput) {
				return;
			}

			deps.setEditingEntryId(String(entry?.id ?? ""));
			categoryInput.value = typeof entry?.category === "string" ? entry.category : "";
			nameInput.value = typeof entry?.name === "string" ? entry.name : "";
			orderInput.value = Number.isFinite(Number(entry?.dashboardOrder))
				? String(Math.max(0, Number.parseInt(String(entry.dashboardOrder), 10)))
				: "0";
			descriptionInput.value = typeof entry?.description === "string" ? entry.description : "";
			syncDateInputs?.(entry);

			submitButton.hidden = true;
			resetButton.hidden = false;
			deps.setFormStatus("編集中: 入力内容はリアルタイムで反映されます。新規追加する場合は「新規作成」を押してください。");
		}

		/**
		 * Switch form back to add mode.
		 */
		function setFormModeAdd() {
			deps.setEditingEntryId(null);
			syncDateInputs?.(null);
			const formElement = /** @type {HTMLFormElement | null} */ (document.getElementById("entry-form"));
			if (formElement) {
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
			}

			const submitButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("preview-entry"));
			const resetButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("start-new-entry"));
			if (submitButton) {
				submitButton.textContent = "追加";
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
