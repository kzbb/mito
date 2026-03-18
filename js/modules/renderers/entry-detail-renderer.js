// @ts-check

(function registerEntryDetailRenderer(globalObject) {
	/**
	 * @param {{
	 *   onMoveEntryToDeletedFromDetail: (entry: any) => any | null,
	 *   onSetFormStatus: (message: string) => void,
	 *   onSetTopbarSaveStatus: (message: string) => void,
	 *   getCurrentData: () => any,
	 *   resolveEntryName: (entry: any) => string,
	 *   onOpenEntryView: (entry: any) => void,
	 *   onOpenFileLink: (filePath: string) => Promise<boolean>,
	 *   onPreviewFileLink?: (filePath: string) => Promise<{ title: string, body: string, imageUrl?: string } | null>
	 * }} deps
	 */
	function createEntryDetailRenderer(deps) {
		const createLinkPreviewHandler = /** @type {any} */ (globalObject).createLinkPreviewHandler;
		const createRendererFallbacks = /** @type {any} */ (globalObject).createRendererFallbacks;
		const rendererFallbacks = typeof createRendererFallbacks === "function"
			? createRendererFallbacks()
			: null;
		const resolveCalendarSchema = rendererFallbacks?.resolveCalendarSchema ?? (() => ({ headers: [], rows: [] }));
		const resolveTimelineValues = rendererFallbacks?.resolveTimelineValues
			?? ((/** @type {any} */ _entry, /** @type {string} */ _key, /** @type {string[]} */ headers) => {
				/** @type {Record<string, string>} */
				const values = {};
				for (const header of headers) {
					values[header] = "";
				}
				return values;
			});
		const renderMarkdownToHtml = rendererFallbacks?.renderMarkdownToHtml
			?? ((/** @type {string} */ source) => source
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/\"/g, "&quot;")
				.replace(/'/g, "&#39;")
				.replace(/\n/g, "<br>"));
		const resolveEntryByName = rendererFallbacks?.makeEntryByNameResolver(deps.getCurrentData, deps.resolveEntryName)
			?? (() => null);

		const linkPreviewHandler = typeof createLinkPreviewHandler === "function"
			? createLinkPreviewHandler({
				onOpenFileLink: deps.onOpenFileLink,
				onOpenEntryView: deps.onOpenEntryView,
				onPreviewFileLink: deps.onPreviewFileLink,
				resolveEntryByName,
				resolveEntryName: deps.resolveEntryName,
				onMissingEntryLink: (/** @type {string} */ name) => {
					deps.onSetFormStatus(`リンク先が見つかりません: ${name}`);
				},
			})
			: null;

		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} entry
		 */
		function renderEntryDetail(mainElement, entry) {
			linkPreviewHandler?.hide();
			mainElement.classList.remove("dashboard-view");
			mainElement.classList.remove("settings-view");
			mainElement.classList.remove("calendar-editor-view");
			mainElement.innerHTML = "";

			const article = document.createElement("article");
			article.className = "entry-wiki";

			const header = document.createElement("header");
			header.className = "entry-wiki-header";

			const title = document.createElement("h1");
			title.className = "entry-wiki-title";
			title.textContent = deps.resolveEntryName(entry);

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

			const category = typeof entry?.category === "string" ? entry.category.trim() || "未分類" : "未分類";
			const metaRow = document.createElement("div");
			metaRow.className = "entry-wiki-meta-row";
			metaRow.appendChild(createMetaTag(category, "カテゴリ"));
			const dateGroup = document.createElement("div");
			dateGroup.className = "entry-wiki-meta-group entry-wiki-meta-group-date";

			const schema = resolveCalendarSchema(deps.getCurrentData());
			if (schema.headers.length > 0) {
				appendTimelineMetaTags(dateGroup, "date", schema, entry);
			}

			if (dateGroup.childElementCount > 0) {
				metaRow.appendChild(dateGroup);
			}
			header.appendChild(metaRow);

			article.appendChild(header);

			const body = document.createElement("section");
			body.className = "entry-wiki-body";

			const descriptionText = typeof entry?.description === "string" ? entry.description : "";
			if (descriptionText.trim().length > 0) {
				const summaryHtml = document.createElement("div");
				summaryHtml.className = "entry-description";
				summaryHtml.innerHTML = renderMarkdownToHtml(descriptionText.trim());
				summaryHtml.addEventListener("click", (event) => {
					void linkPreviewHandler?.handleClick(event);
				});
				summaryHtml.addEventListener("mouseover", (event) => {
					linkPreviewHandler?.handleHover(event);
				});
				summaryHtml.addEventListener("mousemove", (event) => {
					linkPreviewHandler?.handleHoverMove(event);
				});
				summaryHtml.addEventListener("mouseout", (event) => {
					linkPreviewHandler?.handleHoverOut(event);
				});
				summaryHtml.addEventListener("focusin", (event) => {
					linkPreviewHandler?.handleFocusIn(event);
				});
				summaryHtml.addEventListener("focusout", (event) => {
					linkPreviewHandler?.handleFocusOut(event);
				});
				body.appendChild(summaryHtml);
			} else {
				const empty = document.createElement("p");
				empty.className = "entry-description";
				empty.textContent = "説明は未入力です。左下の入力欄から編集できます。";
				body.appendChild(empty);
			}

			article.appendChild(body);
			mainElement.appendChild(article);
		}

		/**
		 * @param {string} value
		 * @param {string} label
		 * @returns {HTMLElement}
		 */
		function createMetaTag(value, label) {
			const field = document.createElement("div");
			field.className = "entry-wiki-meta-field";

			const labelElement = document.createElement("span");
			labelElement.className = "entry-wiki-meta-label";
			labelElement.textContent = label;
			field.appendChild(labelElement);

			const text = document.createElement("span");
			text.className = "entry-wiki-meta-input";
			text.textContent = value;
			field.appendChild(text);
			return field;
		}

		/**
		 * @param {HTMLElement} metaRow
		 * @param {string} key
		 * @param {{ headers: string[], rows: Record<string, string>[] }} schema
		 * @param {any} entry
		 */
		function appendTimelineMetaTags(metaRow, key, schema, entry) {
			const values = resolveTimelineValues(entry, key, schema.headers);
			for (const header of schema.headers) {
				const currentValue = String(values[header] ?? "").trim() || "-";
				metaRow.appendChild(createMetaTag(currentValue, header));
			}
		}

		return {
			renderEntryDetail,
		};
	}

	/** @type {any} */ (globalObject).createEntryDetailRenderer = createEntryDetailRenderer;
})(window);
