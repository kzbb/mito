// @ts-check

(function registerEntryDetailRenderer(globalObject) {
	/**
	 * @param {{
	 *   onUpdateEntryFromDetail: (entry: any, payload: Record<string, string>) => any | null,
	 *   onSetFormStatus: (message: string) => void,
	 *   onSetTopbarSaveStatus: (message: string) => void,
	 *   resolveEntryName: (entry: any) => string
	 * }} deps
	 */
	function createEntryDetailRenderer(deps) {
		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} entry
		 */
		function renderEntryDetail(mainElement, entry) {
			mainElement.classList.remove("settings-view");
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
			header.appendChild(headerTitleRow);

			const category = typeof entry?.category === "string" ? entry.category : "未分類";
			const fromValue = typeof entry?.from === "string" && entry.from.length > 0 ? entry.from : "-";
			const toValue = typeof entry?.to === "string" && entry.to.length > 0 ? entry.to : "-";
			const metaRow = document.createElement("div");
			metaRow.className = "entry-wiki-meta-row";

			/**
			 * @param {"category" | "from" | "to"} key
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

			const dateStack = document.createElement("div");
			dateStack.className = "entry-wiki-meta-stack";
			dateStack.appendChild(createMetaField("from", fromValue, "YYYY-MM-DD", false, "from"));
			dateStack.appendChild(createMetaField("to", toValue, "YYYY-MM-DD", false, "to"));
			metaRow.appendChild(dateStack);
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

		return {
			renderEntryDetail,
		};
	}

	/** @type {any} */ (globalObject).createEntryDetailRenderer = createEntryDetailRenderer;
})(window);
