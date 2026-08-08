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
	 *   onPreviewFileLink?: (filePath: string) => Promise<{ title: string, body: string, imageUrl?: string } | null>,
	 *   onBackToDashboard: (mainElement: HTMLElement) => void
	 * }} deps
	 */
	function createEntryDetailRenderer(deps) {
		const createLinkPreviewHandler = /** @type {any} */ (globalObject).createLinkPreviewHandler;
		// 共有ヘルパー。代替実装は renderer-fallbacks.js 側に集約されている。
		// 読み込まれていないのは配置ミスなので、黙って劣化させず即座に失敗させる。
		const createRendererFallbacks = /** @type {any} */ (globalObject).createRendererFallbacks;
		if (typeof createRendererFallbacks !== "function") {
			throw new Error("[mito] renderer-fallbacks.js が読み込まれていません");
		}
		const shared = createRendererFallbacks();
		const resolveCalendarSchema = shared.resolveCalendarSchema;
		const resolveTimelineValues = shared.resolveTimelineValues;
		const renderMarkdownToHtml = shared.renderMarkdownToHtml;
		const resolveEntryByName = shared.makeEntryByNameResolver(deps.getCurrentData, deps.resolveEntryName);

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

			const backButton = document.createElement("button");
			backButton.type = "button";
			backButton.className = "entry-wiki-back-button";
			backButton.textContent = "← 戻る";
			backButton.addEventListener("click", () => {
				deps.onBackToDashboard(mainElement);
			});
			header.appendChild(backButton);

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
				// md-body: Markdown本文の共通スタイル（styles/markdown.css）
				summaryHtml.className = "entry-description md-body";
				summaryHtml.innerHTML = renderMarkdownToHtml(descriptionText.trim());
				// リンクのクリック・ホバー・フォーカスをすべて linkPreviewHandler に委譲する
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
