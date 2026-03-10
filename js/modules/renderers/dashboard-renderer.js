// @ts-check

(function registerDashboardRenderer(globalObject) {
	/**
	 * @param {{
	 *   getCurrentData: () => any,
	 *   onEnterEditMode: (entry: any) => void,
	 *   onOpenEntryView: (entry: any) => void,
	 *   onOpenFileLink: (filePath: string) => Promise<boolean>,
	 *   onPreviewFileLink?: (filePath: string) => Promise<{ title: string, body: string, imageUrl?: string } | null>,
	 *   resolveEntryName: (entry: any) => string,
	 *   resolveDashboardLabel: (data: any) => string
	 * }} deps
	 */
	function createDashboardRenderer(deps) {
		/** @type {ResizeObserver | null} */
		let bucketResizeObserver = null;
		const CRAMPED_THRESHOLD_REM = 17;

		const createCalendarUtils = /** @type {any} */ (globalObject).createCalendarUtils;
		const calendarUtils = typeof createCalendarUtils === "function" ? createCalendarUtils() : null;
		const createLinkPreviewHandler = /** @type {any} */ (globalObject).createLinkPreviewHandler;
		const createRendererFallbacks = /** @type {any} */ (globalObject).createRendererFallbacks;
		const rendererFallbacks = typeof createRendererFallbacks === "function"
			? createRendererFallbacks()
			: null;
		const resolveCalendarSchema = rendererFallbacks?.resolveCalendarSchema ?? (calendarUtils?.resolveCalendarSchema ?? (() => ({ headers: [], rows: [] })));
		const resolveTimelineValues = rendererFallbacks?.resolveTimelineValues
			?? (calendarUtils?.resolveTimelineValues
				?? ((/** @type {any} */ _entry, /** @type {string} */ _key, /** @type {string[]} */ headers) => {
					/** @type {Record<string, string>} */
					const values = {};
					for (const header of headers) {
						values[header] = "";
					}
					return values;
				}));
		const renderMarkdownToHtml = rendererFallbacks?.renderMarkdownToHtml
			?? ((/** @type {string} */ source) => source
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/\"/g, "&quot;")
				.replace(/'/g, "&#39;")
				.replace(/\n/g, "<br>"));

		/**
		 * @param {string} targetName
		 * @returns {any | null}
		 */
		function resolveEntryByName(targetName) {
			if (!targetName) {
				return null;
			}

			const normalizedTarget = targetName.trim().toLocaleLowerCase("ja");
			const currentData = deps.getCurrentData();
			const activeEntries = Array.isArray(currentData?.active) ? currentData.active : [];
			for (const entry of activeEntries) {
				const name = deps.resolveEntryName(entry).trim().toLocaleLowerCase("ja");
				if (name === normalizedTarget) {
					return entry;
				}
			}

			return null;
		}

		const linkPreviewHandler = typeof createLinkPreviewHandler === "function"
			? createLinkPreviewHandler({
				onOpenFileLink: deps.onOpenFileLink,
				onOpenEntryView: deps.onOpenEntryView,
				onPreviewFileLink: deps.onPreviewFileLink,
				resolveEntryByName,
				resolveEntryName: deps.resolveEntryName,
			})
			: null;

		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} data
		 */
		function renderDashboardOverview(mainElement, data) {
			teardownBucketObserver();
			linkPreviewHandler?.hide();

			mainElement.classList.remove("settings-view");
			mainElement.classList.remove("calendar-editor-view");
			mainElement.classList.add("dashboard-view");
			mainElement.innerHTML = "";

			const title = document.createElement("h2");
			title.textContent = deps.resolveDashboardLabel(data);
			mainElement.appendChild(title);

			const activeEntries = Array.isArray(data?.active) ? data.active : [];
			const focusCategories = resolveFocusCategories(data, activeEntries);
			const targetEntries = activeEntries.filter((/** @type {any} */ entry) => {
				const category = typeof entry?.category === "string" ? entry.category.trim() : "";
				return focusCategories.includes(category);
			});

			const meta = document.createElement("p");
			meta.className = "entry-meta";
			meta.textContent = `focus: ${focusCategories.join(", ")} / ${targetEntries.length}件`;
			mainElement.appendChild(meta);

			if (targetEntries.length === 0) {
				const empty = document.createElement("p");
				empty.textContent = "フォーカス対象カテゴリに該当するエントリーはありません。";
				mainElement.appendChild(empty);
				return;
			}

			const schema = resolveCalendarSchema(data);
			if (!Array.isArray(schema.headers) || schema.headers.length === 0 || schema.rows.length === 0) {
				const fallback = document.createElement("p");
				fallback.textContent = "カレンダーが未設定のため、年表テーブルを表示できません。設定からカレンダーを追加してください。";
				mainElement.appendChild(fallback);
				return;
			}

			const categoryColumns = focusCategories.map((category) => {
				const categoryEntries = targetEntries.filter((/** @type {any} */ entry) => String(entry?.category ?? "").trim() === category);
				return {
					category,
					rowEntryMap: buildRowEntryMap(schema, categoryEntries),
				};
			});

			const visibleRange = resolveVisibleRowRange(
				categoryColumns.map((column) => column.rowEntryMap),
				schema.rows.length,
			);
			if (!visibleRange) {
				const fallback = document.createElement("p");
				fallback.textContent = "フォーカス対象カテゴリのエントリーはカレンダー上の日付に紐づいていません。";
				mainElement.appendChild(fallback);
				return;
			}

			const [startRowIndex, endRowIndex] = visibleRange;
			const rangeLabel = document.createElement("p");
			rangeLabel.className = "dashboard-range";
			rangeLabel.textContent = `表示範囲: 行${startRowIndex + 2} - 行${endRowIndex + 2}`;
			mainElement.appendChild(rangeLabel);

			const tableWrap = createDashboardTable(schema, categoryColumns, startRowIndex, endRowIndex);
			mainElement.appendChild(tableWrap);
			setupBucketObserver(tableWrap);
			window.requestAnimationFrame(() => {
				refreshEntryBucketLayouts(tableWrap);
			});
		}

		/**
		 * @param {{ headers: string[], rows: Record<string, string>[] }} schema
		 * @param {{ category: string, rowEntryMap: Map<number, any[]> }[]} categoryColumns
		 * @param {number} startRowIndex
		 * @param {number} endRowIndex
		 * @returns {HTMLElement}
		 */
		function createDashboardTable(schema, categoryColumns, startRowIndex, endRowIndex) {
			const wrap = document.createElement("div");
			wrap.className = "dashboard-table-wrap";

			const table = document.createElement("table");
			table.className = "dashboard-table";

			const colgroup = document.createElement("colgroup");
			const calendarColumnWidths = resolveCalendarColumnWidths(schema, startRowIndex, endRowIndex);
			for (const width of calendarColumnWidths) {
				const col = document.createElement("col");
				col.style.width = `${width}ch`;
				col.className = "dashboard-calendar-col";
				colgroup.appendChild(col);
			}
			for (const _column of categoryColumns) {
				const entryCol = document.createElement("col");
				entryCol.className = "dashboard-entry-col";
				colgroup.appendChild(entryCol);
			}
			table.appendChild(colgroup);

			const thead = document.createElement("thead");
			const headRow = document.createElement("tr");
			for (const header of schema.headers) {
				const th = document.createElement("th");
				th.scope = "col";
				th.className = "dashboard-calendar-header";
				th.textContent = header;
				headRow.appendChild(th);
			}

			for (const column of categoryColumns) {
				const entryHeader = document.createElement("th");
				entryHeader.scope = "col";
				entryHeader.className = "dashboard-entry-column dashboard-entry-header";
				entryHeader.textContent = column.category;
				headRow.appendChild(entryHeader);
			}
			thead.appendChild(headRow);
			table.appendChild(thead);

			const tbody = document.createElement("tbody");
			for (let rowIndex = startRowIndex; rowIndex <= endRowIndex; rowIndex += 1) {
				const rowRecord = schema.rows[rowIndex] ?? {};
				const row = document.createElement("tr");

				for (const header of schema.headers) {
					const td = document.createElement("td");
					td.className = "dashboard-calendar-cell";
					td.textContent = String(rowRecord[header] ?? "");
					row.appendChild(td);
				}

				for (const column of categoryColumns) {
					const entryCell = document.createElement("td");
					entryCell.className = "dashboard-entry-cell";
					const rowEntries = column.rowEntryMap.get(rowIndex) ?? [];
					if (rowEntries.length > 0) {
						const bucket = document.createElement("div");
						bucket.className = "dashboard-entry-bucket";
						for (const entry of rowEntries) {
							bucket.appendChild(createEntryCard(entry));
						}
						entryCell.appendChild(bucket);
					} else {
						entryCell.classList.add("is-empty");
						entryCell.textContent = "-";
					}
					row.appendChild(entryCell);
				}
				tbody.appendChild(row);
			}

			table.appendChild(tbody);
			wrap.appendChild(table);
			return wrap;
		}

		/**
		 * @param {{ headers: string[], rows: Record<string, string>[] }} schema
		 * @param {number} startRowIndex
		 * @param {number} endRowIndex
		 * @returns {number[]}
		 */
		function resolveCalendarColumnWidths(schema, startRowIndex, endRowIndex) {
			/** @type {number[]} */
			const widths = [];
			for (let colIndex = 0; colIndex < schema.headers.length; colIndex += 1) {
				const header = schema.headers[colIndex];
				let maxLength = String(header ?? "").trim().length;

				for (let rowIndex = startRowIndex; rowIndex <= endRowIndex; rowIndex += 1) {
					const row = schema.rows[rowIndex] ?? {};
					const valueLength = String(row[header] ?? "").trim().length;
					maxLength = Math.max(maxLength, valueLength);
				}

				// Requested width: roughly text length + 2 chars of breathing room.
				widths.push(Math.max(4, maxLength + 2));
			}

			return widths;
		}

		/**
		 * @param {any} entry
		 * @returns {HTMLElement}
		 */
		function createEntryCard(entry) {
			const card = document.createElement("div");
			card.className = "dashboard-entry-card";
			card.tabIndex = 0;
			card.setAttribute("role", "button");
			card.setAttribute("aria-label", `${deps.resolveEntryName(entry)}（クリックで編集、ダブルクリックで個別表示）`);

			const name = document.createElement("span");
			name.className = "dashboard-entry-card-name";
			name.textContent = deps.resolveEntryName(entry);
			card.appendChild(name);

			if (typeof entry?.description === "string" && entry.description.trim().length > 0) {
				const description = document.createElement("div");
				description.className = "dashboard-entry-card-description";
				const preview = buildDashboardDescriptionPreview(entry.description);
				description.innerHTML = renderMarkdownToHtml(preview.source);
				if (preview.truncated) {
					const marker = document.createElement("p");
					marker.className = "dashboard-entry-card-truncation";
					marker.textContent = "...";
					description.appendChild(marker);
				}
				description.addEventListener("click", (event) => {
					void linkPreviewHandler?.handleClick(event);
				});
				description.addEventListener("mouseover", (event) => {
					linkPreviewHandler?.handleHover(event);
				});
				description.addEventListener("mousemove", (event) => {
					linkPreviewHandler?.handleHoverMove(event);
				});
				description.addEventListener("mouseout", (event) => {
					linkPreviewHandler?.handleHoverOut(event);
				});
				description.addEventListener("focusin", (event) => {
					linkPreviewHandler?.handleFocusIn(event);
				});
				description.addEventListener("focusout", (event) => {
					linkPreviewHandler?.handleFocusOut(event);
				});
				card.appendChild(description);
			}

			card.addEventListener("click", (event) => {
				const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target : null);
				if (target?.closest("a")) {
					return;
				}
				deps.onEnterEditMode(entry);
			});

			card.addEventListener("dblclick", (event) => {
				const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target : null);
				if (target?.closest("a")) {
					return;
				}

				event.preventDefault();
				deps.onOpenEntryView(entry);
			});

			card.addEventListener("keydown", (event) => {
				if (event.key !== "Enter" && event.key !== " ") {
					return;
				}
				event.preventDefault();
				deps.onEnterEditMode(entry);
			});

			return card;
		}

		/**
		 * @param {string} source
		 * @returns {{ source: string, truncated: boolean }}
		 */
		function buildDashboardDescriptionPreview(source) {
			const normalized = String(source ?? "").replace(/\r\n?/g, "\n");
			if (!normalized.trim()) {
				return { source: "", truncated: false };
			}

			const lines = normalized.split("\n");
			let blankStreak = 0;
			let truncateFrom = -1;

			for (let index = 0; index < lines.length; index += 1) {
				if (lines[index].trim().length === 0) {
					blankStreak += 1;
					if (blankStreak >= 2) {
						truncateFrom = index - 1;
						break;
					}
					continue;
				}

				blankStreak = 0;
			}

			if (truncateFrom < 0) {
				return { source: normalized.trim(), truncated: false };
			}

			const previewSource = lines.slice(0, Math.max(0, truncateFrom)).join("\n").trimEnd();
			return {
				source: previewSource,
				truncated: true,
			};
		}

		/**
		 * @param {HTMLElement} tableWrap
		 */
		function refreshEntryBucketLayouts(tableWrap) {
			const buckets = tableWrap.querySelectorAll(".dashboard-entry-bucket");
			for (const bucket of buckets) {
				if (!(bucket instanceof HTMLElement)) {
					continue;
				}

				const cards = bucket.querySelectorAll(".dashboard-entry-card");
				if (cards.length <= 1) {
					bucket.classList.remove("is-stacked");
					continue;
				}

				const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
				const thresholdPx = CRAMPED_THRESHOLD_REM * rootFontSize;
				const availableBucketWidth = bucket.clientWidth;

				bucket.classList.remove("is-stacked");
				if (availableBucketWidth < thresholdPx) {
					bucket.classList.add("is-stacked");
				}
			}
		}

		/**
		 * @param {HTMLElement} tableWrap
		 */
		function setupBucketObserver(tableWrap) {
			if (typeof ResizeObserver !== "function") {
				return;
			}

			bucketResizeObserver = new ResizeObserver(() => {
				window.requestAnimationFrame(() => {
					refreshEntryBucketLayouts(tableWrap);
				});
			});
			bucketResizeObserver.observe(tableWrap);
		}

		function teardownBucketObserver() {
			if (!bucketResizeObserver) {
				return;
			}

			bucketResizeObserver.disconnect();
			bucketResizeObserver = null;
		}

		/**
		 * @param {any} data
		 * @param {any[]} activeEntries
		 * @returns {string[]}
		 */
		function resolveFocusCategories(data, activeEntries) {
			const raw = typeof data?.settings?.focusCategory === "string"
				? data.settings.focusCategory
				: typeof data?.settings?.masterCategory === "string"
					? data.settings.masterCategory
					: "";

			const specified = raw
				.split(/[,、]/)
				.map((/** @type {string} */ value) => value.trim())
				.filter((/** @type {string} */ value) => value.length > 0);

			if (specified.length > 0) {
				return Array.from(new Set(specified));
			}

			const fallback = Array.from(new Set(
				activeEntries
					.map((entry) => (typeof entry?.category === "string" ? entry.category.trim() : ""))
					.filter((category) => category.length > 0),
			));

			return fallback.length > 0 ? fallback : ["出来事"];
		}

		/**
		 * @param {{ headers: string[], rows: Record<string, string>[] }} schema
		 * @param {any[]} entries
		 * @returns {Map<number, any[]>}
		 */
		function buildRowEntryMap(schema, entries) {
			/** @type {Map<number, any[]>} */
			const rowMap = new Map();
			for (const entry of entries) {
				const rowIndex = findCalendarRowIndexForEntry(schema, entry);
				if (rowIndex < 0) {
					continue;
				}

				if (!rowMap.has(rowIndex)) {
					rowMap.set(rowIndex, []);
				}
				rowMap.get(rowIndex)?.push(entry);
			}

			for (const bucket of rowMap.values()) {
				bucket.sort((left, right) => deps.resolveEntryName(left).localeCompare(deps.resolveEntryName(right), "ja"));
			}

			return rowMap;
		}

		/**
		 * @param {Map<number, any[]>[]} rowEntryMaps
		 * @param {number} rowCount
		 * @returns {[number, number] | null}
		 */
		function resolveVisibleRowRange(rowEntryMaps, rowCount) {
			if (!Array.isArray(rowEntryMaps) || rowEntryMaps.length === 0 || rowCount <= 0) {
				return null;
			}

			const mergedIndexes = new Set();
			for (const map of rowEntryMaps) {
				for (const index of map.keys()) {
					mergedIndexes.add(index);
				}
			}

			if (mergedIndexes.size === 0) {
				return null;
			}

			const indexes = Array.from(mergedIndexes).sort((a, b) => a - b);
			const minIndex = Math.max(0, Math.min(indexes[0] ?? 0, rowCount - 1));
			const maxIndex = Math.max(0, Math.min(indexes[indexes.length - 1] ?? 0, rowCount - 1));
			if (maxIndex < minIndex) {
				return null;
			}
			return [minIndex, maxIndex];
		}

		/**
		 * @param {{ headers: string[], rows: Record<string, string>[] }} schema
		 * @param {any} entry
		 * @returns {number}
		 */
		function findCalendarRowIndexForEntry(schema, entry) {
			if (!Array.isArray(schema.headers) || schema.headers.length === 0 || !Array.isArray(schema.rows)) {
				return -1;
			}

			const timelineValues = resolveTimelineValues(entry, "date", schema.headers);
			let bestIndex = -1;
			let bestScore = 0;

			for (let rowIndex = 0; rowIndex < schema.rows.length; rowIndex += 1) {
				const row = schema.rows[rowIndex];
				let score = 0;
				for (const header of schema.headers) {
					const rowValue = String(row?.[header] ?? "").trim();
					const entryValue = String(timelineValues[header] ?? "").trim();
					if (rowValue.length === 0 || entryValue.length === 0) {
						continue;
					}
					if (rowValue === entryValue) {
						score += 1;
					}
				}

				if (score > bestScore) {
					bestScore = score;
					bestIndex = rowIndex;
				}
			}

			if (bestIndex >= 0) {
				return bestIndex;
			}

			const firstHeader = schema.headers[0];
			const primaryValue = String(timelineValues[firstHeader] ?? "").trim();
			if (!primaryValue) {
				return -1;
			}

			for (let rowIndex = 0; rowIndex < schema.rows.length; rowIndex += 1) {
				const row = schema.rows[rowIndex];
				if (String(row?.[firstHeader] ?? "").trim() === primaryValue) {
					return rowIndex;
				}
			}

			return -1;
		}

		return {
			renderDashboardOverview,
		};
	}

	/** @type {any} */ (globalObject).createDashboardRenderer = createDashboardRenderer;
})(window);
