// @ts-check

(function registerEntryForm(globalObject) {
	/**
	 * @param {{
	 *   getCurrentData: () => any,
	 *   getEditingEntryId: () => string | null,
	 *   setEditingEntryId: (entryId: string | null) => void,
	 *   resolveDashboardLabel: (data: any) => string,
	 *   findActiveEntryIndexById: (data: any, entryId: string | null) => number,
	 *   getNextActiveId: (data: any) => number,
	 *   renderOutlineFromData: (data: any) => void,
	 *   renderDashboardOverview: (mainElement: HTMLElement, data: any) => void,
	 *   focusNewEntryInTree: (entry: any) => void,
	 *   renderEntryDetail: (mainElement: HTMLElement, entry: any) => void
	 * }} deps
	 */
	function createEntryFormModule(deps) {
		/**
		 * Initialize the data entry form in the lower left pane.
		 */
		function setupEntryForm() {
			const formElement = /** @type {HTMLFormElement | null} */ (document.getElementById("entry-form"));
			const statusElement = /** @type {HTMLElement | null} */ (document.getElementById("entry-form-status"));
			const mainElement = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));

			if (!formElement || !statusElement || !mainElement) {
				return;
			}

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

			formElement.addEventListener("submit", (event) => {
				event.preventDefault();

				const formData = new FormData(formElement);
				const category = readTrimmedFormValue(formData, "category");
				const name = readTrimmedFormValue(formData, "name");

				if (!category || !name) {
					statusElement.textContent = "カテゴリと名称は必須です。";
					return;
				}

				const currentData = deps.getCurrentData();
				if (!currentData) {
					statusElement.textContent = "先に「開く」でJSONを読み込んでください。";
					return;
				}

				const currentTitle = mainElement.querySelector("h2")?.textContent?.trim() ?? "";
				const dashboardLabel = deps.resolveDashboardLabel(currentData);
				const wasDashboardView = currentTitle === dashboardLabel;

				const entryPayload = {
					category,
					name,
					from: readTrimmedFormValue(formData, "from"),
					to: readTrimmedFormValue(formData, "to"),
					description: readTrimmedFormValue(formData, "description"),
				};

				if (!Array.isArray(currentData.active)) {
					currentData.active = [];
				}

				/** @type {any} */
				let targetEntry = null;
				const editingEntryId = deps.getEditingEntryId();
				const isUpdateMode = editingEntryId !== null;

				if (isUpdateMode) {
					const targetIndex = deps.findActiveEntryIndexById(currentData, editingEntryId);
					if (targetIndex >= 0) {
						targetEntry = { ...currentData.active[targetIndex], ...entryPayload };
						currentData.active[targetIndex] = targetEntry;
					} else {
						setFormModeAdd();
					}
				}

				if (!targetEntry) {
					const nextId = deps.getNextActiveId(currentData);
					targetEntry = { id: nextId, ...entryPayload };
					currentData.active.push(targetEntry);
				}

				deps.renderOutlineFromData(currentData);
				if (wasDashboardView) {
					deps.renderDashboardOverview(mainElement, currentData);
					statusElement.textContent = isUpdateMode
						? "選択したエントリを更新し、年表表示を維持しました。"
						: "active に新しいエントリを追加し、年表表示を維持しました。";
					return;
				}

				deps.focusNewEntryInTree(targetEntry);
				deps.renderEntryDetail(mainElement, targetEntry);
				statusElement.textContent = isUpdateMode
					? "選択したエントリを更新し、該当カテゴリへ反映しました。"
					: "active に新しいエントリを追加し、該当カテゴリへ反映しました。";
			});

			formElement.addEventListener("reset", () => {
				setFormModeAdd();
				statusElement.textContent = "入力フォームをクリアしました。";
			});
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
		 * Reflect selected entry to form and switch submit mode to update.
		 * @param {any} entry
		 */
		function enterEditMode(entry) {
			const formElement = /** @type {HTMLFormElement | null} */ (document.getElementById("entry-form"));
			const statusElement = /** @type {HTMLElement | null} */ (document.getElementById("entry-form-status"));
			const submitButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("preview-entry"));

			if (!formElement || !statusElement || !submitButton) {
				return;
			}

			const categoryInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("category"));
			const nameInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("name"));
			const fromInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("from"));
			const toInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem("to"));
			const descriptionInput = /** @type {HTMLTextAreaElement | null} */ (formElement.elements.namedItem("description"));

			if (!categoryInput || !nameInput || !fromInput || !toInput || !descriptionInput) {
				return;
			}

			deps.setEditingEntryId(String(entry?.id ?? ""));
			categoryInput.value = typeof entry?.category === "string" ? entry.category : "";
			nameInput.value = typeof entry?.name === "string" ? entry.name : "";
			fromInput.value = typeof entry?.from === "string" ? entry.from : "";
			toInput.value = typeof entry?.to === "string" ? entry.to : "";
			descriptionInput.value = typeof entry?.description === "string" ? entry.description : "";

			submitButton.textContent = "更新";
			statusElement.textContent = "編集中: 内容を修正して「更新」を押すと反映されます。";
		}

		/**
		 * Switch form back to add mode.
		 */
		function setFormModeAdd() {
			deps.setEditingEntryId(null);
			const submitButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("preview-entry"));
			if (submitButton) {
				submitButton.textContent = "追加";
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
