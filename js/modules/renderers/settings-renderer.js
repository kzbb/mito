// @ts-check

(function registerSettingsRenderer(globalObject) {
	/**
	 * @param {{
	 *   getCurrentData: () => any,
	 *   createPrintDashboard: () => HTMLElement,
	 *   onBackToDashboard: (mainElement: HTMLElement) => void,
	 *   mutateDocument: (mutator: (data: any) => void) => boolean,
	 *   onPermanentlyDeleteDeletedEntry: (entry: any) => boolean,
	 *   onRestoreDeletedEntry: (entry: any) => any | null,
	 *   onSetFormStatus: (message: string) => void,
	 *   onSetTopbarSaveStatus: (message: string) => void,
	 *   onProjectNameInput: (nextProject: string) => void,
	 *   onOpenCalendarEditor: () => void,
	 *   resolveEntryName: (entry: any) => string,
	 *   resolveDashboardLabel: (data: any) => string
	 * }} deps
	 */
	function createSettingsRenderer(deps) {
        /** @type {WeakMap<object, { excluded: Set<string>, name: boolean, description: boolean }>} */
        const printPreferences = new WeakMap();
        function preference() {
            const data = deps.getCurrentData();
            if (!printPreferences.has(data)) printPreferences.set(data, { excluded: new Set(), name: true, description: true });
            return printPreferences.get(data);
        }
        function preparePrint() {
            document.getElementById("mito-print-view")?.remove();
            if (!deps.getCurrentData()) return;
            const view = deps.createPrintDashboard();
            const prefs = preference();
            if (!prefs) return;
            view.id = "mito-print-view";
            const headers = Array.from(view.querySelectorAll("thead th"));
            const keys = headers.map((header, index) => `${header.classList.contains("dashboard-calendar-header") ? "calendar" : "category"}:${header.textContent}`);
            // Keep at least one column if the document structure changed since selection.
            const excluded = keys.every(key => prefs.excluded.has(key)) ? new Set() : prefs.excluded;
            for (const row of view.querySelectorAll("tr, colgroup")) {
                Array.from(row.children).forEach((cell, index) => {
                    if (excluded.has(keys[index])) cell.remove();
                });
            }
            // Measure the longest printed line, including the bold column heading.
            const context = document.createElement("canvas").getContext("2d");
            if (context) {
                const family = getComputedStyle(document.body).fontFamily;
                const rows = Array.from(view.querySelectorAll("tr"));
                view.querySelectorAll("col").forEach((col, index) => {
                    if (!col.classList.contains("dashboard-calendar-col")) return;
                    let width = 0;
                    for (const row of rows) {
                        const cell = row.children[index];
                        context.font = `${cell?.tagName === "TH" ? "700" : "400"} 9pt ${family}`;
                        for (const line of (cell?.textContent ?? "").split(/\r?\n/)) {
                            width = Math.max(width, context.measureText(line).width);
                        }
                    }
                    // 4pt padding on either side, rounded up to avoid fractional clipping.
                    col.style.setProperty("--print-date-width", `${Math.ceil(width + 8 * 96 / 72 + 1)}px`);
                });
            }
            const shared = /** @type {any} */ (globalObject).createRendererFallbacks();
            for (const card of view.querySelectorAll(".dashboard-entry-card")) {
                if (!prefs.name) card.querySelector(".dashboard-entry-card-name")?.remove();
                const description = card.querySelector(".dashboard-entry-card-description");
                if (!prefs.description) description?.remove();
                else if (description) {
                    const entry = deps.getCurrentData().active?.find(item => String(item.id) === /** @type {HTMLElement} */ (card).dataset.entryId);
                    description.innerHTML = shared.renderMarkdownToHtml(String(entry?.description ?? ""));
                }
            }
            view.querySelector(".entry-meta")?.remove();
            document.body.appendChild(view);
        }
        window.addEventListener("beforeprint", preparePrint);
        window.addEventListener("afterprint", () => document.getElementById("mito-print-view")?.remove());

        /** @param {HTMLElement} mainElement */
        function renderPrintSettings(mainElement) {
            const preview = deps.createPrintDashboard();
            const headers = Array.from(preview.querySelectorAll("thead th"));
            const prefs = preference();
            if (!prefs) return;
            const section = document.createElement("section");
            section.className = "settings-section print-settings";
            const heading = document.createElement("h3");
            heading.className = "settings-section-title";
            heading.textContent = "印刷設定";
            section.appendChild(heading);
            const hint = document.createElement("p");
            hint.className = "settings-section-hint";
            hint.textContent = "現在の年表の列から選びます。画面の表示は変わりません。選択はこの文書を開いている間だけ保持します。";
            section.appendChild(hint);
            const message = document.createElement("p");
            message.className = "settings-section-hint print-settings-message";
            message.setAttribute("role", "status");
            const columns = document.createElement("fieldset");
            const legend = document.createElement("legend");
            legend.className = "settings-field-name";
            legend.textContent = "印刷する列";
            columns.appendChild(legend);
            headers.forEach((header, index) => {
                const key = `${header.classList.contains("dashboard-calendar-header") ? "calendar" : "category"}:${header.textContent}`;
                const label = document.createElement("label");
                const input = document.createElement("input");
                input.type = "checkbox";
                input.checked = !prefs.excluded.has(key);
                input.addEventListener("change", () => {
                    if (!columns.querySelector("input:checked")) {
                        input.checked = true;
                        message.textContent = "列は少なくとも1つ選んでください。";
                        return;
                    }
                    if (input.checked) prefs.excluded.delete(key); else prefs.excluded.add(key);
                    message.textContent = "";
                });
                label.append(input, document.createTextNode(header.textContent ?? ""));
                columns.appendChild(label);
            });
            if (headers.length && !columns.querySelector("input:checked")) {
                prefs.excluded.clear();
                columns.querySelectorAll("input").forEach(input => { input.checked = true; });
            }
            section.appendChild(columns);
            const content = document.createElement("fieldset");
            const contentLegend = document.createElement("legend");
            contentLegend.className = "settings-field-name";
            contentLegend.textContent = "カードに含める内容（全カード共通）";
            content.appendChild(contentLegend);
            for (const [key, text] of [["name", "名称"], ["description", "説明"]]) {
                const label = document.createElement("label");
                const input = document.createElement("input");
                input.type = "checkbox";
                input.checked = prefs[key];
                input.addEventListener("change", () => {
                    if (!content.querySelector("input:checked")) {
                        input.checked = true;
                        message.textContent = "名称か説明を少なくとも1つ選んでください。";
                        return;
                    }
                    prefs[key] = input.checked;
                    message.textContent = "";
                });
                label.append(input, document.createTextNode(text));
                content.appendChild(label);
            }
            const print = document.createElement("button");
            print.type = "button";
            print.className = "settings-calendar-button print-preview-button";
            print.textContent = "印刷プレビューを開く";
            print.disabled = headers.length === 0;
            print.addEventListener("click", () => { preparePrint(); window.print(); });
            section.append(content, message, print);
            mainElement.appendChild(section);
        }

		/**
		 * @param {any} data
		 * @param {(item: any) => void} onSelect
		 * @returns {any}
		 */
		function renderSettingsButton(data, onSelect) {
			const settings = data?.settings && typeof data.settings === "object" ? data.settings : null;
			const calendar = data?.calendar && typeof data.calendar === "object" ? data.calendar : null;
			const deletedEntries = Array.isArray(data?.deleted) ? data.deleted : [];

			if (!settings && !calendar && deletedEntries.length === 0) {
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
			mainElement.classList.remove("dashboard-view");
			mainElement.classList.add("settings-view");
			mainElement.classList.remove("calendar-editor-view");

			const title = document.createElement("h2");
			title.className = "settings-page-title";
			title.textContent = "設定";
			const navigation = document.createElement("div");
			navigation.className = "settings-navigation";
			const back = document.createElement("button");
			back.type = "button";
			back.className = "settings-back-button";
			back.textContent = "← 戻る";
			back.addEventListener("click", () => {
				deps.onBackToDashboard(mainElement);
				document.getElementById(matchMedia("(max-width: 639px)").matches ? "topbar-menu-toggle" : "outline-settings")?.focus();
			});
			navigation.append(back, title);
			mainElement.appendChild(navigation);
			mainElement.scrollTop = 0;

			const settings = data?.settings && typeof data.settings === "object" ? data.settings : {};
			const deletedEntries = Array.isArray(data?.deleted) ? data.deleted : [];
			const projectName = typeof data?.project === "string" ? data.project : "";

			renderPrintSettings(mainElement);
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
			// カレンダー編集画面を開く
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
			// プロジェクト名が変わるたびにブリッジ経由でツリー見出しをリアルタイム更新する
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
				if (key === "language" || key === "focusCategory") {
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
				// 設定値の型（数値・真偽値・null）を保ちながらデータを更新する。
				// dashboardLabel / masterCategoryDashboard はダッシュボードボタンにも即時反映する。
				input.addEventListener("input", () => {
					const nextValue = parseSettingValue(input.value, value);
					const applied = deps.mutateDocument((documentData) => {
						if (!documentData.settings || typeof documentData.settings !== "object") {
							documentData.settings = {};
						}

						documentData.settings[key] = nextValue;
					});
					if (!applied) {
						return;
					}

					if (key === "dashboardLabel" || key === "masterCategoryDashboard") {
						updateDashboardButtonLabel(deps.getCurrentData());
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
			archivedTitle.textContent = "削除されたアイテム";
			archivedSection.appendChild(archivedTitle);

			if (deletedEntries.length === 0) {
				const empty = document.createElement("p");
				empty.className = "settings-section-hint";
				empty.textContent = "削除されたアイテムはありません。";
				archivedSection.appendChild(empty);
				mainElement.appendChild(archivedSection);
				return;
			}

			const archivedList = document.createElement("ul");
			archivedList.className = "settings-archived-list";
			for (const entry of deletedEntries) {
				const li = document.createElement("li");
				li.className = "settings-archived-item";

				const name = document.createElement("span");
				name.className = "settings-archived-name";
				name.textContent = deps.resolveEntryName(entry);
				li.appendChild(name);

				const actions = document.createElement("div");
				actions.className = "settings-archived-actions";

				const restoreButton = document.createElement("button");
				restoreButton.type = "button";
				restoreButton.className = "settings-archived-restore";
				restoreButton.textContent = "復元";
				restoreButton.setAttribute("aria-label", `${deps.resolveEntryName(entry)} を復元`);
				// アイテムをアクティブリストに戻し、設定画面を再描画する
				restoreButton.addEventListener("click", () => {
					const restoredEntry = deps.onRestoreDeletedEntry(entry);
					if (!restoredEntry) {
						deps.onSetFormStatus("削除されたアイテムの復元に失敗しました。");
						return;
					}

					deps.onSetFormStatus("削除されたアイテムを復元しました。");
					deps.onSetTopbarSaveStatus("未保存: 復元あり");
					renderSettingsOverview(mainElement, deps.getCurrentData());
				});
				actions.appendChild(restoreButton);

				const deleteButton = document.createElement("button");
				deleteButton.type = "button";
				deleteButton.className = "settings-archived-delete";
				deleteButton.textContent = "完全に削除";
				deleteButton.setAttribute("aria-label", `${deps.resolveEntryName(entry)} を完全削除`);
				// 削除済みリストからも除去し、復元不能にする
				deleteButton.addEventListener("click", () => {
					const deleted = deps.onPermanentlyDeleteDeletedEntry(entry);
					if (!deleted) {
						deps.onSetFormStatus("削除されたアイテムの完全削除に失敗しました。");
						return;
					}

					deps.onSetFormStatus("削除されたアイテムを完全に削除しました。");
					deps.onSetTopbarSaveStatus("未保存: 完全削除あり");
					renderSettingsOverview(mainElement, deps.getCurrentData());
				});
				actions.appendChild(deleteButton);

				li.appendChild(actions);
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
		 * 編集された設定値を、元の型（数値・真偽値・nullなど）を保ちながらパースする。
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
