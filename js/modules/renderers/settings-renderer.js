// @ts-check

(function registerSettingsRenderer(globalObject) {
	/**
	 * @param {{
	 *   getCurrentData: () => any,
	 *   onSetFormStatus: (message: string) => void,
	 *   onSetTopbarSaveStatus: (message: string) => void,
	 *   onProjectNameInput: (nextProject: string) => void,
	 *   onOpenCalendarEditor: () => void,
	 *   resolveEntryName: (entry: any) => string,
	 *   resolveDashboardLabel: (data: any) => string
	 * }} deps
	 */
	function createSettingsRenderer(deps) {
		/**
		 * @param {any} data
		 * @param {(item: any) => void} onSelect
		 * @returns {any}
		 */
		function renderSettingsButton(data, onSelect) {
			const settings = data?.settings && typeof data.settings === "object" ? data.settings : null;
			const calendar = data?.calendar && typeof data.calendar === "object" ? data.calendar : null;
			const archivedEntries = Array.isArray(data?.archived) ? data.archived : [];

			if (!settings && !calendar && archivedEntries.length === 0) {
				setSettingsButtonState(null, null);
				return null;
			}

			/** @type {any} */
			const item = { type: "setting", data, button: null };
			const button = setSettingsButtonState("設定", () => {
				onSelect(item);
			});
			if (!button) {
				return null;
			}

			item.button = button;
			return item;
		}

		/**
		 * @param {string | null} label
		 * @param {(() => void) | null} onClick
		 * @returns {HTMLButtonElement | null}
		 */
		function setSettingsButtonState(label, onClick) {
			const button = /** @type {HTMLButtonElement | null} */ (document.getElementById("outline-settings"));
			if (!button) {
				return null;
			}

			button.hidden = !label;
			if (!label) {
				button.onclick = null;
				return button;
			}

			button.textContent = label;
			button.onclick = onClick;
			return button;
		}

		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} data
		 */
		function renderSettingsOverview(mainElement, data) {
			mainElement.innerHTML = "";
			mainElement.classList.add("settings-view");
			mainElement.classList.remove("calendar-editor-view");

			const title = document.createElement("h2");
			title.className = "settings-page-title";
			title.textContent = "設定";
			mainElement.appendChild(title);

			const settings = data?.settings && typeof data.settings === "object" ? data.settings : {};
			const archivedEntries = Array.isArray(data?.archived) ? data.archived : [];
			const projectName = typeof data?.project === "string" ? data.project : "";

			const calendarSection = document.createElement("section");
			calendarSection.className = "settings-section";
			const calendarTitle = document.createElement("h3");
			calendarTitle.className = "settings-section-title";
			calendarTitle.textContent = "カレンダー";
			calendarSection.appendChild(calendarTitle);

			const calendarField = document.createElement("div");
			calendarField.className = "settings-field";
			const calendarButton = document.createElement("button");
			calendarButton.type = "button";
			calendarButton.className = "settings-calendar-button";
			calendarButton.textContent = "カレンダーの編集";
			calendarButton.addEventListener("click", () => {
				deps.onOpenCalendarEditor();
			});

			calendarField.appendChild(calendarButton);
			calendarSection.appendChild(calendarField);
			mainElement.appendChild(calendarSection);

			const settingsSection = document.createElement("section");
			settingsSection.className = "settings-section";
			const settingsTitle = document.createElement("h3");
			settingsTitle.className = "settings-section-title";
			settingsTitle.textContent = "プロジェクト設定";
			settingsSection.appendChild(settingsTitle);
			const settingsHint = document.createElement("p");
			settingsHint.className = "settings-section-hint";
			settingsHint.textContent = "プロジェクト名を含む設定値を編集できます。";
			settingsSection.appendChild(settingsHint);

			const settingsFields = document.createElement("div");
			settingsFields.className = "settings-fields";

			const projectField = document.createElement("div");
			projectField.className = "settings-field";
			const projectLabel = document.createElement("label");
			projectLabel.className = "settings-field-name";
			projectLabel.textContent = "project";
			const projectInput = document.createElement("input");
			projectInput.type = "text";
			projectInput.className = "settings-value-input";
			projectInput.value = projectName;
			projectInput.placeholder = "プロジェクト名";
			projectInput.setAttribute("aria-label", "project");
			projectInput.addEventListener("input", () => {
				const nextProject = projectInput.value.trim();
				deps.onProjectNameInput(nextProject);
				deps.onSetFormStatus("設定を更新しました: project");
				deps.onSetTopbarSaveStatus("未保存: 設定変更あり");
			});
			projectField.appendChild(projectLabel);
			projectField.appendChild(projectInput);
			settingsFields.appendChild(projectField);

			for (const [key, value] of Object.entries(settings)) {
				if (key === "language") {
					continue;
				}

				const field = document.createElement("div");
				field.className = "settings-field";

				const label = document.createElement("label");
				label.className = "settings-field-name";
				label.textContent = key;

				const input = document.createElement("input");
				input.type = "text";
				input.className = "settings-value-input";
				input.value = String(value ?? "");
				input.setAttribute("aria-label", key);
				input.addEventListener("input", () => {
					const nextData = deps.getCurrentData();
					if (!nextData || !nextData.settings || typeof nextData.settings !== "object") {
						return;
					}

					const nextValue = parseSettingValue(input.value, value);
					nextData.settings[key] = nextValue;

					if (key === "dashboardLabel" || key === "masterCategoryDashboard") {
						updateDashboardButtonLabel(nextData);
					}

					deps.onSetFormStatus(`設定を更新しました: ${key}`);
					deps.onSetTopbarSaveStatus("未保存: 設定変更あり");
				});

				field.appendChild(label);
				field.appendChild(input);
				settingsFields.appendChild(field);
			}

			if (settingsFields.children.length > 0) {
				settingsSection.appendChild(settingsFields);
			}
			mainElement.appendChild(settingsSection);

			const archivedSection = document.createElement("section");
			archivedSection.className = "settings-section";
			const archivedTitle = document.createElement("h3");
			archivedTitle.className = "settings-section-title";
			archivedTitle.textContent = "Archived";
			archivedSection.appendChild(archivedTitle);

			if (archivedEntries.length === 0) {
				const empty = document.createElement("p");
				empty.className = "settings-section-hint";
				empty.textContent = "Archived itemはありません。";
				archivedSection.appendChild(empty);
				mainElement.appendChild(archivedSection);
				return;
			}

			const archivedList = document.createElement("ul");
			archivedList.className = "settings-archived-list";
			for (const entry of archivedEntries) {
				const li = document.createElement("li");
				li.className = "settings-archived-item";
				li.textContent = deps.resolveEntryName(entry);
				archivedList.appendChild(li);
			}
			archivedSection.appendChild(archivedList);
			mainElement.appendChild(archivedSection);
		}

		/**
		 * @param {string} projectName
		 */
		function updateOutlineProjectName(projectName) {
			const scopeElement = document.getElementById("outline-scope");
			if (!scopeElement) {
				return;
			}

			scopeElement.textContent = projectName || "プロジェクト";
		}

		/**
		 * @param {any} data
		 */
		function updateDashboardButtonLabel(data) {
			const treeElement = /** @type {HTMLElement | null} */ (document.getElementById("explorer-tree"));
			if (!treeElement) {
				return;
			}

			const dashboardButton = treeElement.querySelector('.tree-leaf-button[data-role="dashboard"]');
			if (!(dashboardButton instanceof HTMLButtonElement)) {
				return;
			}

			dashboardButton.textContent = deps.resolveDashboardLabel(data);
		}

		/**
		 * Parse edited setting value while preserving simple primitive types.
		 * @param {string} rawValue
		 * @param {unknown} originalValue
		 * @returns {unknown}
		 */
		function parseSettingValue(rawValue, originalValue) {
			if (typeof originalValue === "number") {
				const numeric = Number(rawValue);
				return Number.isFinite(numeric) ? numeric : originalValue;
			}

			if (typeof originalValue === "boolean") {
				const normalized = rawValue.trim().toLowerCase();
				if (normalized === "true") {
					return true;
				}
				if (normalized === "false") {
					return false;
				}
				return originalValue;
			}

			if (originalValue === null) {
				const normalized = rawValue.trim().toLowerCase();
				return normalized === "null" ? null : rawValue;
			}

			return rawValue;
		}

		return {
			renderSettingsButton,
			renderSettingsOverview,
			updateOutlineProjectName,
			updateDashboardButtonLabel,
		};
	}

	/** @type {any} */ (globalObject).createSettingsRenderer = createSettingsRenderer;
})(window);
