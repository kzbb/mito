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
		const createCalendarUtils = /** @type {any} */ (globalObject).createCalendarUtils;
		const calendarUtils = typeof createCalendarUtils === "function" ? createCalendarUtils() : null;
		const createMarkdownEngine = /** @type {any} */ (globalObject).createMarkdownEngine;
		const markdownEngine = typeof createMarkdownEngine === "function" ? createMarkdownEngine() : null;
		const resolveCalendarSchema = calendarUtils?.resolveCalendarSchema ?? (() => ({ headers: [], rows: [] }));
		const resolveTimelineValues = calendarUtils?.resolveTimelineValues
			?? ((/** @type {any} */ _entry, /** @type {string} */ _key, /** @type {string[]} */ headers) => {
				/** @type {Record<string, string>} */
				const values = {};
				for (const header of headers) {
					values[header] = "";
				}
				return values;
			});
		const renderMarkdownToHtml = markdownEngine?.renderToHtml
			?? ((/** @type {string} */ source) => source
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/\"/g, "&quot;")
				.replace(/'/g, "&#39;")
				.replace(/\n/g, "<br>"));

		/** @type {HTMLDivElement | null} */
		let linkPreviewPopover = null;
		/** @type {HTMLAnchorElement | null} */
		let linkPreviewAnchor = null;
		let activePreviewImageUrl = "";
		let linkPreviewRequestId = 0;

		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} entry
		 */
		function renderEntryDetail(mainElement, entry) {
			hideLinkPreview();
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
			} else if (typeof entry?.date === "string" && entry.date.trim().length > 0) {
				dateGroup.appendChild(createMetaTag(entry.date.trim(), "日付"));
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
					void handleDescriptionLinkClick(event);
				});
				summaryHtml.addEventListener("mouseover", handleDescriptionLinkHover);
				summaryHtml.addEventListener("mousemove", handleDescriptionLinkHoverMove);
				summaryHtml.addEventListener("mouseout", handleDescriptionLinkHoverOut);
				summaryHtml.addEventListener("focusin", handleDescriptionLinkFocusIn);
				summaryHtml.addEventListener("focusout", handleDescriptionLinkFocusOut);
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

		/**
		 * @param {MouseEvent} event
		 * @returns {Promise<void>}
		 */
		async function handleDescriptionLinkClick(event) {
			const target = event.target instanceof HTMLElement ? event.target : null;
			const fileAnchor = target?.closest("a[data-mito-file-path]");
			if (fileAnchor instanceof HTMLAnchorElement) {
				event.preventDefault();
				event.stopPropagation();
				const filePath = String(fileAnchor.dataset.mitoFilePath ?? "").trim();
				await deps.onOpenFileLink(filePath);
				return;
			}

			const anchor = target?.closest("a[data-mito-link]");
			if (!(anchor instanceof HTMLAnchorElement)) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			const linkTarget = String(anchor.dataset.mitoLink ?? "").trim();
			const linkedEntry = resolveEntryByName(linkTarget);
			if (!linkedEntry) {
				deps.onSetFormStatus(`リンク先が見つかりません: ${linkTarget}`);
				return;
			}

			deps.onOpenEntryView(linkedEntry);
		}

		/**
		 * @param {MouseEvent} event
		 */
		function handleDescriptionLinkHover(event) {
			const target = event.target instanceof HTMLElement ? event.target : null;
			const anchor = resolvePreviewAnchor(target);
			if (!anchor) {
				return;
			}

			void showResolvedLinkPreview(anchor, event.clientX, event.clientY);
		}

		/**
		 * @param {MouseEvent} event
		 */
		function handleDescriptionLinkHoverMove(event) {
			if (!linkPreviewPopover || !linkPreviewAnchor) {
				return;
			}

			positionLinkPreview(event.clientX, event.clientY);
		}

		/**
		 * @param {MouseEvent} event
		 */
		function handleDescriptionLinkHoverOut(event) {
			const relatedTarget = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
			if (resolvePreviewAnchor(relatedTarget) === linkPreviewAnchor) {
				return;
			}

			hideLinkPreview();
		}

		/**
		 * @param {FocusEvent} event
		 */
		function handleDescriptionLinkFocusIn(event) {
			const target = event.target instanceof HTMLElement ? event.target : null;
			const anchor = resolvePreviewAnchor(target);
			if (!anchor) {
				return;
			}

			const rect = anchor.getBoundingClientRect();
			void showResolvedLinkPreview(anchor, rect.left + (rect.width / 2), rect.bottom);
		}

		/**
		 * @param {FocusEvent} event
		 */
		function handleDescriptionLinkFocusOut(event) {
			const relatedTarget = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
			if (resolvePreviewAnchor(relatedTarget) === linkPreviewAnchor) {
				return;
			}

			hideLinkPreview();
		}

		/**
		 * @param {HTMLElement | null} element
		 * @returns {HTMLAnchorElement | null}
		 */
		function resolvePreviewAnchor(element) {
			if (!element) {
				return null;
			}

			const anchor = element.closest("a[data-mito-link], a[data-mito-file-path], a[href^='http://'], a[href^='https://']");
			return anchor instanceof HTMLAnchorElement ? anchor : null;
		}

		/**
		 * @param {HTMLElement | null} element
		 * @returns {Promise<{ anchor: HTMLAnchorElement, title: string, body: string, imageUrl?: string } | null>}
		 */
		async function resolveLinkPreviewPayload(element) {
			const anchor = resolvePreviewAnchor(element);
			if (!anchor) {
				return null;
			}

			const mitoTarget = String(anchor.dataset.mitoLink ?? "").trim();
			if (mitoTarget) {
				const linkedEntry = resolveEntryByName(mitoTarget);
				if (!linkedEntry) {
					hideLinkPreview();
					return null;
				}

				const description = typeof linkedEntry?.description === "string" ? linkedEntry.description.trim() : "";
				const previewText = description.length > 0 ? description.slice(0, 180) : "説明なし";
				const suffix = description.length > 180 ? "..." : "";
				return {
					anchor,
					title: deps.resolveEntryName(linkedEntry),
					body: `${previewText}${suffix}`,
				};
			}

			const filePath = String(anchor.dataset.mitoFilePath ?? "").trim();
			if (filePath) {
				if (typeof deps.onPreviewFileLink === "function") {
					try {
						const preview = await deps.onPreviewFileLink(filePath);
						if (preview && typeof preview.title === "string" && typeof preview.body === "string") {
							return {
								anchor,
								title: preview.title,
								body: preview.body,
								imageUrl: typeof preview.imageUrl === "string" ? preview.imageUrl : undefined,
							};
						}
					} catch (error) {
						console.error("Failed to resolve file preview", error);
					}
				}

				return {
					anchor,
					title: "ファイルリンク",
					body: filePath,
				};
			}

			const href = String(anchor.getAttribute("href") ?? "").trim();
			if (/^https?:\/\//i.test(href)) {
				return {
					anchor,
					title: "外部リンク",
					body: href,
				};
			}

			return null;
		}

		/**
		 * @returns {HTMLDivElement}
		 */
		function ensureLinkPreviewPopover() {
			if (linkPreviewPopover) {
				return linkPreviewPopover;
			}

			const popover = document.createElement("div");
			popover.className = "dashboard-link-preview";
			popover.hidden = true;
			popover.setAttribute("role", "tooltip");
			document.body.appendChild(popover);
			linkPreviewPopover = popover;
			return popover;
		}

		/**
		 * @param {HTMLAnchorElement} anchor
		 * @param {number} clientX
		 * @param {number} clientY
		 * @returns {Promise<void>}
		 */
		async function showResolvedLinkPreview(anchor, clientX, clientY) {
			const requestId = linkPreviewRequestId + 1;
			linkPreviewRequestId = requestId;
			const preview = await resolveLinkPreviewPayload(anchor);
			if (!preview || requestId !== linkPreviewRequestId) {
				return;
			}

			showLinkPreview(preview.anchor, preview.title, preview.body, preview.imageUrl, clientX, clientY);
		}

		/**
		 * @param {HTMLAnchorElement} anchor
		 * @param {string} title
		 * @param {string} bodyText
		 * @param {string | undefined} imageUrl
		 * @param {number} clientX
		 * @param {number} clientY
		 */
		function showLinkPreview(anchor, title, bodyText, imageUrl, clientX, clientY) {
			const popover = ensureLinkPreviewPopover();
			revokePreviewImageUrl();

			popover.innerHTML = "";
			const heading = document.createElement("div");
			heading.className = "dashboard-link-preview-title";
			heading.textContent = title;
			popover.appendChild(heading);
			if (typeof imageUrl === "string" && imageUrl.length > 0) {
				const image = document.createElement("img");
				image.className = "dashboard-link-preview-image";
				image.src = imageUrl;
				image.alt = title;
				popover.appendChild(image);
				activePreviewImageUrl = imageUrl;
			}
			const body = document.createElement("div");
			body.className = "dashboard-link-preview-body";
			body.textContent = bodyText;
			popover.appendChild(body);

			popover.hidden = false;
			linkPreviewAnchor = anchor;
			positionLinkPreview(clientX, clientY);
		}

		/**
		 * @param {number} clientX
		 * @param {number} clientY
		 */
		function positionLinkPreview(clientX, clientY) {
			if (!linkPreviewPopover) {
				return;
			}

			const offset = 14;
			const viewportMargin = 8;
			const rect = linkPreviewPopover.getBoundingClientRect();
			const maxX = Math.max(viewportMargin, window.innerWidth - rect.width - viewportMargin);
			const maxY = Math.max(viewportMargin, window.innerHeight - rect.height - viewportMargin);
			const left = Math.min(Math.max(viewportMargin, clientX + offset), maxX);
			const top = Math.min(Math.max(viewportMargin, clientY + offset), maxY);

			linkPreviewPopover.style.left = `${left}px`;
			linkPreviewPopover.style.top = `${top}px`;
		}

		function hideLinkPreview() {
			linkPreviewRequestId += 1;
			linkPreviewAnchor = null;
			revokePreviewImageUrl();
			if (!linkPreviewPopover) {
				return;
			}

			linkPreviewPopover.hidden = true;
		}

		function revokePreviewImageUrl() {
			if (!activePreviewImageUrl.startsWith("blob:")) {
				activePreviewImageUrl = "";
				return;
			}

			URL.revokeObjectURL(activePreviewImageUrl);
			activePreviewImageUrl = "";
		}

		/**
		 * @param {string} name
		 * @returns {any | null}
		 */
		function resolveEntryByName(name) {
			const normalized = name.trim();
			if (!normalized) {
				return null;
			}

			const currentData = deps.getCurrentData();
			const activeEntries = Array.isArray(currentData?.active) ? currentData.active : [];
			return activeEntries.find((/** @type {any} */ candidate) => deps.resolveEntryName(candidate) === normalized) ?? null;
		}

		return {
			renderEntryDetail,
		};
	}

	/** @type {any} */ (globalObject).createEntryDetailRenderer = createEntryDetailRenderer;
})(window);
