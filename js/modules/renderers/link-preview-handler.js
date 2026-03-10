// @ts-check

(function registerLinkPreviewHandler(globalObject) {
	/**
	 * @param {{
	 *   onOpenFileLink: (filePath: string) => Promise<boolean>,
	 *   onOpenEntryView: (entry: any) => void,
	 *   onPreviewFileLink?: (filePath: string) => Promise<{ title: string, body: string, imageUrl?: string } | null>,
	 *   resolveEntryByName: (name: string) => any | null,
	 *   resolveEntryName: (entry: any) => string,
	 *   onMissingEntryLink?: (name: string) => void
	 * }} deps
	 */
	function createLinkPreviewHandler(deps) {
		/** @type {HTMLDivElement | null} */
		let linkPreviewPopover = null;
		/** @type {HTMLAnchorElement | null} */
		let linkPreviewAnchor = null;
		let activePreviewImageUrl = "";
		let linkPreviewRequestId = 0;

		/**
		 * @param {MouseEvent} event
		 * @returns {Promise<void>}
		 */
		async function handleClick(event) {
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
			const linkedEntry = deps.resolveEntryByName(linkTarget);
			if (!linkedEntry) {
				if (typeof deps.onMissingEntryLink === "function") {
					deps.onMissingEntryLink(linkTarget);
				}
				return;
			}

			deps.onOpenEntryView(linkedEntry);
		}

		/**
		 * @param {MouseEvent} event
		 */
		function handleHover(event) {
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
		function handleHoverMove(event) {
			if (!linkPreviewPopover || !linkPreviewAnchor) {
				return;
			}

			positionLinkPreview(event.clientX, event.clientY);
		}

		/**
		 * @param {MouseEvent} event
		 */
		function handleHoverOut(event) {
			const relatedTarget = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
			if (resolvePreviewAnchor(relatedTarget) === linkPreviewAnchor) {
				return;
			}

			hide();
		}

		/**
		 * @param {FocusEvent} event
		 */
		function handleFocusIn(event) {
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
		function handleFocusOut(event) {
			const relatedTarget = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
			if (resolvePreviewAnchor(relatedTarget) === linkPreviewAnchor) {
				return;
			}

			hide();
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
				const linkedEntry = deps.resolveEntryByName(mitoTarget);
				if (!linkedEntry) {
					hide();
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

		function hide() {
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

		return {
			handleClick,
			handleHover,
			handleHoverMove,
			handleHoverOut,
			handleFocusIn,
			handleFocusOut,
			hide,
		};
	}

	/** @type {any} */ (globalObject).createLinkPreviewHandler = createLinkPreviewHandler;
})(window);
