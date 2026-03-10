// @ts-check

(function registerEntryDetailRenderer(globalObject) {
	/**
	 * @param {{
	 *   onUpdateEntryFromDetail: (entry: any, payload: Record<string, any>) => any | null,
	 *   onMoveEntryToDeletedFromDetail: (entry: any) => any | null,
	 *   onSetFormStatus: (message: string) => void,
	 *   onSetTopbarSaveStatus: (message: string) => void,
	 *   getCurrentData: () => any,
	 *   resolveEntryName: (entry: any) => string
	 * }} deps
	 */
	function createEntryDetailRenderer(deps) {
		const createCalendarUtils = /** @type {any} */ (globalObject).createCalendarUtils;
		const calendarUtils = typeof createCalendarUtils === "function" ? createCalendarUtils() : null;
		const resolveCalendarSchema = calendarUtils?.resolveCalendarSchema ?? (() => ({ headers: [], rows: [] }));
		const findCalendarRowByValue = calendarUtils?.findCalendarRowByValue ?? (() => null);
		const resolveTimelineValues = calendarUtils?.resolveTimelineValues
			?? ((/** @type {any} */ _entry, /** @type {string} */ _key, /** @type {string[]} */ headers) => {
				/** @type {Record<string, string>} */
				const values = {};
				for (const header of headers) {
					values[header] = "";
				}
				return values;
			});

		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} entry
		 */
		function renderEntryDetail(mainElement, entry) {
			mainElement.classList.remove("settings-view");
			mainElement.classList.remove("calendar-editor-view");
			mainElement.innerHTML = "";

			const article = document.createElement("article");
			article.className = "entry-wiki";

			const header = document.createElement("header");
			header.className = "entry-wiki-header";

			const title = document.createElement("input");
			title.type = "text";
			title.className = "entry-wiki-title entry-wiki-title-input";
			title.value = deps.resolveEntryName(entry);
			title.setAttribute("aria-label", "名称");

			const commitNameEdit = () => {
				const nextName = title.value.trim();
				if (!nextName) {
					title.value = deps.resolveEntryName(entry);
					deps.onSetFormStatus("名称は空にできません。");
					return;
				}

				if (nextName === deps.resolveEntryName(entry)) {
					return;
				}

				const updatedEntry = deps.onUpdateEntryFromDetail(entry, { name: nextName });
				if (!updatedEntry) {
					title.value = deps.resolveEntryName(entry);
					deps.onSetFormStatus("名称の更新に失敗しました。");
					return;
				}

				deps.onSetFormStatus("名称を更新しました。");
				deps.onSetTopbarSaveStatus("未保存: 名称変更あり");
			};

			title.addEventListener("blur", commitNameEdit);
			title.addEventListener("keydown", /** @param {KeyboardEvent} event */ (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					title.blur();
				}

				if (event.key === "Escape") {
					title.value = deps.resolveEntryName(entry);
					title.blur();
				}
			});

			const headerTitleRow = document.createElement("div");
			headerTitleRow.className = "entry-wiki-header-row";
			headerTitleRow.appendChild(title);

			const archiveButton = document.createElement("button");
			archiveButton.type = "button";
			archiveButton.className = "entry-wiki-archive-button";
			archiveButton.textContent = "削除";
			archiveButton.setAttribute("aria-label", "このエントリを削除済みへ移動");
			archiveButton.addEventListener("click", () => {
				const movedEntry = deps.onMoveEntryToDeletedFromDetail(entry);
				if (!movedEntry) {
					deps.onSetFormStatus("削除済みへの移動に失敗しました。");
					return;
				}

				deps.onSetFormStatus("削除済みへ移動しました。");
				deps.onSetTopbarSaveStatus("未保存: 削除移動あり");
			});
			headerTitleRow.appendChild(archiveButton);
			header.appendChild(headerTitleRow);

			const category = typeof entry?.category === "string" ? entry.category : "未分類";
			const metaRow = document.createElement("div");
			metaRow.className = "entry-wiki-meta-row";

			/**
			 * @param {"category" | "date"} key
			 * @param {string} currentValue
			 * @param {string} placeholder
			 * @param {boolean} required
			 * @param {string | null} labelText
			 * @returns {HTMLDivElement}
			 */
			const createMetaField = (key, currentValue, placeholder, required, labelText) => {
				const field = document.createElement("div");
				field.className = labelText ? "entry-wiki-meta-field" : "entry-wiki-meta-item";

				if (labelText) {
					const label = document.createElement("span");
					label.className = "entry-wiki-meta-label";
					label.textContent = labelText;
					field.appendChild(label);
				}

				const input = document.createElement("input");
				input.type = "text";
				input.className = "entry-wiki-meta-input";
				const baseValue = currentValue === "-" ? "" : currentValue;
				input.value = baseValue;
				input.placeholder = placeholder;
				input.setAttribute("aria-label", placeholder);

				const commit = () => {
					const nextValue = input.value.trim();
					if (required && !nextValue) {
						input.value = baseValue;
						deps.onSetFormStatus(`${placeholder}は空にできません。`);
						return;
					}

					if (nextValue === baseValue) {
						return;
					}

					const updatedEntry = deps.onUpdateEntryFromDetail(entry, { [key]: nextValue });
					if (!updatedEntry) {
						input.value = baseValue;
						deps.onSetFormStatus(`${placeholder}の更新に失敗しました。`);
						return;
					}

					deps.onSetFormStatus(`${placeholder}を更新しました。`);
					deps.onSetTopbarSaveStatus("未保存: エントリ更新あり");
				};

				input.addEventListener("blur", commit);
				input.addEventListener("keydown", /** @param {KeyboardEvent} event */ (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						input.blur();
					}

					if (event.key === "Escape") {
						input.value = baseValue;
						input.blur();
					}
				});

				field.appendChild(input);
				return field;
			};

			metaRow.appendChild(createMetaField("category", category, "カテゴリ", true, null));

			const schema = resolveCalendarSchema(deps.getCurrentData());
			if (schema.headers.length > 0) {
				metaRow.appendChild(createTimelineStack("date", "", schema, entry));
			} else if (typeof entry?.date === "string" && entry.date.trim().length > 0) {
				metaRow.appendChild(createMetaField("date", entry.date, "date", false, "date"));
			}
			header.appendChild(metaRow);

			article.appendChild(header);

			const body = document.createElement("section");
			body.className = "entry-wiki-body";

			const summaryText = document.createElement("p");
			summaryText.className = "entry-description entry-wiki-description-input";
			summaryText.setAttribute("contenteditable", "true");
			summaryText.setAttribute("role", "textbox");
			summaryText.setAttribute("aria-multiline", "true");
			summaryText.setAttribute("aria-label", "説明");
			const descriptionText = typeof entry?.description === "string" ? entry.description : "";
			summaryText.textContent = descriptionText;

			const commitDescriptionEdit = () => {
				const nextDescription = (summaryText.textContent ?? "").trim();
				if (nextDescription === descriptionText) {
					if (!nextDescription) {
						summaryText.textContent = "";
					}
					return;
				}

				const updatedEntry = deps.onUpdateEntryFromDetail(entry, { description: nextDescription });
				if (!updatedEntry) {
					summaryText.textContent = descriptionText;
					deps.onSetFormStatus("説明の更新に失敗しました。");
					return;
				}

				deps.onSetFormStatus("説明を更新しました。");
				deps.onSetTopbarSaveStatus("未保存: 説明変更あり");
			};

			summaryText.addEventListener("blur", commitDescriptionEdit);
			summaryText.addEventListener("keydown", /** @param {KeyboardEvent} event */ (event) => {
				if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
					event.preventDefault();
					summaryText.blur();
				}

				if (event.key === "Escape") {
					event.preventDefault();
					summaryText.textContent = descriptionText;
					summaryText.blur();
				}
			});
			body.appendChild(summaryText);

			article.appendChild(body);
			mainElement.appendChild(article);
		}

		/**
		 * @param {string} key
		 * @param {string} titleLabel
		 * @param {{ headers: string[], rows: Record<string, string>[] }} schema
		 * @param {any} entry
		 * @returns {HTMLElement}
		 */
		function createTimelineStack(key, titleLabel, schema, entry) {
			const stack = document.createElement("div");
			stack.className = "entry-wiki-meta-stack";

			const title = document.createElement("div");
			title.className = "entry-wiki-meta-stack-title";
			title.textContent = titleLabel;
			stack.appendChild(title);

			const values = resolveTimelineValues(entry, key, schema.headers);

			for (const header of schema.headers) {
				const field = document.createElement("div");
				field.className = "entry-wiki-meta-field";

				const label = document.createElement("span");
				label.className = "entry-wiki-meta-label";
				label.textContent = header;
				field.appendChild(label);

				const select = document.createElement("select");
				select.className = "entry-wiki-meta-input";
				select.dataset.timelineHeader = header;
				select.dataset.timelineKey = key;
				select.setAttribute("aria-label", `${key} ${header}`);

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

				for (const optionValue of Array.from(options).sort((a, b) => a.localeCompare(b, "ja"))) {
					const option = document.createElement("option");
					option.value = optionValue;
					option.textContent = optionValue;
					select.appendChild(option);
				}

				select.value = currentValue;
				field.appendChild(select);

				select.addEventListener("change", () => {
					const matched = findCalendarRowByValue(schema.rows, header, select.value.trim());
					if (matched) {
						applyTimelineValues(stack, schema.headers, matched);
					}
					commitTimelineUpdate(entry, key, stack, schema.headers);
				});

				select.addEventListener("blur", () => {
					commitTimelineUpdate(entry, key, stack, schema.headers);
				});

				select.addEventListener("keydown", /** @param {KeyboardEvent} event */ (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						select.blur();
					}

					if (event.key === "Escape") {
						select.value = values[header] ?? "";
						select.blur();
					}
				});

				stack.appendChild(field);
			}

			return stack;
		}

		/**
		 * @param {HTMLElement} stack
		 * @param {string[]} headers
		 * @param {Record<string, string>} row
		 */
		function applyTimelineValues(stack, headers, row) {
			for (const header of headers) {
				const field = /** @type {HTMLSelectElement | HTMLInputElement | null} */ (
					stack.querySelector(`[data-timeline-header="${cssEscapeAttr(header)}"]`)
				);
				if (field) {
					field.value = String(row[header] ?? "");
				}
			}
		}

		/**
		 * @param {any} entry
		 * @param {string} key
		 * @param {HTMLElement} stack
		 * @param {string[]} headers
		 */
		function commitTimelineUpdate(entry, key, stack, headers) {
			/** @type {Record<string, string>} */
			const values = {};
			for (const header of headers) {
				const field = /** @type {HTMLSelectElement | HTMLInputElement | null} */ (
					stack.querySelector(`[data-timeline-header="${cssEscapeAttr(header)}"]`)
				);
				values[header] = field ? field.value.trim() : "";
			}

			const primaryHeader = headers[0] ?? "";
			const baseline = resolveTimelineValues(entry, key, headers);
			if (
				headers.every((header) => String(values[header] ?? "") === String(baseline[header] ?? ""))
			) {
				return;
			}

			const payload = {
				[`${key}Calendar`]: values,
				[key]: primaryHeader ? String(values[primaryHeader] ?? "") : "",
			};

			const updatedEntry = deps.onUpdateEntryFromDetail(entry, payload);
			if (!updatedEntry) {
				deps.onSetFormStatus("日付の更新に失敗しました。");
				return;
			}

			deps.onSetFormStatus("日付を更新しました。");
			deps.onSetTopbarSaveStatus("未保存: エントリ更新あり");
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

		return {
			renderEntryDetail,
		};
	}

	/** @type {any} */ (globalObject).createEntryDetailRenderer = createEntryDetailRenderer;
})(window);
