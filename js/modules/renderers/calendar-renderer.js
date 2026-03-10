// @ts-check

(function registerCalendarRenderer(globalObject) {
	/**
	 * @param {{
	 *   onSetFormStatus: (message: string) => void,
	 *   onSetTopbarSaveStatus: (message: string) => void
	 * }} deps
	 */
	function createCalendarRenderer(deps) {
		const createCalendarUtils = /** @type {any} */ (globalObject).createCalendarUtils;
		const calendarUtils = typeof createCalendarUtils === "function" ? createCalendarUtils() : null;

		if (!calendarUtils) {
			console.error("Calendar utilities module is not available");
		}

		const resolveInitialGrid = calendarUtils?.resolveInitialGrid ?? (() => [[""]]);
		const parseCsv = calendarUtils?.parseCsv ?? (() => [[""]]);
		const persistCalendar = calendarUtils?.persistCalendar ?? (() => {});
		const gridToCsv = calendarUtils?.gridToCsv ?? (() => "");
		const getGridWidth = calendarUtils?.getGridWidth ?? (() => 1);
		const normalizeGridShape = calendarUtils?.normalizeGridShape ?? ((/** @type {string[][]} */ grid) => grid);
		const resolveColumnLabel = calendarUtils?.resolveColumnLabel ?? ((/** @type {number} */ index) => String(index + 1));
		const downloadCsv = calendarUtils?.downloadCsv ?? (() => {});
		const resolveExportFileName = calendarUtils?.resolveExportFileName ?? (() => "calendar.csv");
		const clampIndex = calendarUtils?.clampIndex ?? ((/** @type {number} */ value) => Math.max(0, value));

		/**
		 * @param {HTMLElement} mainElement
		 * @param {any} data
		 */
		function renderCalendarEditor(mainElement, data) {
			mainElement.classList.remove("settings-view");
			mainElement.classList.add("calendar-editor-view");
			mainElement.innerHTML = "";

			const title = document.createElement("h2");
			title.className = "calendar-editor-title";
			title.textContent = "カレンダー編集";
			mainElement.appendChild(title);

			const toolbar = document.createElement("div");
			toolbar.className = "calendar-toolbar";
			const ioGroup = document.createElement("div");
			ioGroup.className = "calendar-toolbar-group";
			const ioGroupLabel = document.createElement("span");
			ioGroupLabel.className = "calendar-toolbar-group-label";
			ioGroupLabel.textContent = "CSV入出力";

			const loadLabel = document.createElement("label");
			loadLabel.className = "calendar-toolbar-label";
			loadLabel.textContent = "CSVを読み込む";

			const fileInput = document.createElement("input");
			fileInput.type = "file";
			fileInput.accept = ".csv,text/csv";
			fileInput.className = "calendar-file-input";
			fileInput.setAttribute("aria-label", "CSVを読み込む");

			const exportButton = document.createElement("button");
			exportButton.type = "button";
			exportButton.className = "calendar-tool-button";
			exportButton.textContent = "CSVとして書き出す";

			const deleteRowButton = document.createElement("button");
			deleteRowButton.type = "button";
			deleteRowButton.className = "calendar-tool-button";
			deleteRowButton.textContent = "行を削除";

			const deleteColumnButton = document.createElement("button");
			deleteColumnButton.type = "button";
			deleteColumnButton.className = "calendar-tool-button";
			deleteColumnButton.textContent = "列を削除";

			const operationGroup = document.createElement("div");
			operationGroup.className = "calendar-toolbar-group";
			const operationGroupLabel = document.createElement("span");
			operationGroupLabel.className = "calendar-toolbar-group-label";
			operationGroupLabel.textContent = "表操作";

			ioGroup.appendChild(ioGroupLabel);
			ioGroup.appendChild(loadLabel);
			ioGroup.appendChild(fileInput);
			ioGroup.appendChild(exportButton);

			operationGroup.appendChild(operationGroupLabel);
			operationGroup.appendChild(deleteRowButton);
			operationGroup.appendChild(deleteColumnButton);

			toolbar.appendChild(ioGroup);
			toolbar.appendChild(operationGroup);
			mainElement.appendChild(toolbar);

			const info = document.createElement("p");
			info.className = "calendar-info";
			mainElement.appendChild(info);

			const gridWrap = document.createElement("div");
			gridWrap.className = "calendar-grid-wrap";
			mainElement.appendChild(gridWrap);

			let grid = resolveInitialGrid(data);
			let selectedRowIndex = 0;
			let selectedColumnIndex = 0;

			fileInput.addEventListener("change", async () => {
				const selectedFile = fileInput.files?.[0] ?? null;
				if (!selectedFile) {
					return;
				}

				try {
					const csvText = await selectedFile.text();
					grid = parseCsv(csvText);
					if (grid.length === 0) {
						grid = [[""]];
					}
					selectedRowIndex = 0;
					selectedColumnIndex = 0;
					persistCalendar(data, gridToCsv(grid));
					renderGrid();
					deps.onSetFormStatus(`CSVを読み込みました: ${selectedFile.name}`);
					deps.onSetTopbarSaveStatus("未保存: カレンダー変更あり");
				} catch (error) {
					console.error("Failed to load calendar CSV", error);
					deps.onSetFormStatus("CSVの読み込みに失敗しました。形式を確認してください。");
					deps.onSetTopbarSaveStatus("読み込み失敗");
				}
			});

			deleteRowButton.addEventListener("click", () => {
				if (grid.length <= 1) {
					deps.onSetFormStatus("行は1行未満にできません。");
					return;
				}

				const targetRow = clampIndex(selectedRowIndex, grid.length - 1);
				grid.splice(targetRow, 1);
				selectedRowIndex = Math.max(0, Math.min(selectedRowIndex, grid.length - 1));
				persistCalendar(data, gridToCsv(grid));
				renderGrid();
				deps.onSetFormStatus(`行${targetRow + 1}を削除しました。`);
				deps.onSetTopbarSaveStatus("未保存: カレンダー変更あり");
			});

			deleteColumnButton.addEventListener("click", () => {
				const width = getGridWidth(grid);
				if (width <= 1) {
					deps.onSetFormStatus("列は1列未満にできません。");
					return;
				}

				const targetColumn = clampIndex(selectedColumnIndex, width - 1);
				for (const row of grid) {
					row.splice(targetColumn, 1);
				}
				selectedColumnIndex = Math.max(0, Math.min(selectedColumnIndex, getGridWidth(grid) - 1));
				persistCalendar(data, gridToCsv(grid));
				renderGrid();
				deps.onSetFormStatus(`列${resolveColumnLabel(targetColumn)}を削除しました。`);
				deps.onSetTopbarSaveStatus("未保存: カレンダー変更あり");
			});

			exportButton.addEventListener("click", () => {
				const csvText = gridToCsv(grid);
				downloadCsv(csvText, resolveExportFileName(data));
				deps.onSetFormStatus("CSVを書き出しました。");
			});

			function renderGrid() {
				gridWrap.innerHTML = "";
				const table = document.createElement("table");
				table.className = "calendar-grid";

				const thead = document.createElement("thead");
				const headRow = document.createElement("tr");
				const corner = document.createElement("th");
				corner.className = "calendar-corner-cell";

				const insertTopHandle = document.createElement("button");
				insertTopHandle.type = "button";
				insertTopHandle.className = "calendar-insert-top-handle";
				insertTopHandle.textContent = "+";
				insertTopHandle.setAttribute("aria-label", "先頭に行を挿入");
				insertTopHandle.addEventListener("click", (event) => {
					event.stopPropagation();
					insertRowAt(0);
				});

				const insertLeftHandle = document.createElement("button");
				insertLeftHandle.type = "button";
				insertLeftHandle.className = "calendar-insert-left-handle";
				insertLeftHandle.textContent = "+";
				insertLeftHandle.setAttribute("aria-label", "先頭に列を挿入");
				insertLeftHandle.addEventListener("click", (event) => {
					event.stopPropagation();
					insertColumnAt(0);
				});

				corner.appendChild(insertTopHandle);
				corner.appendChild(insertLeftHandle);
				headRow.appendChild(corner);

				const tbody = document.createElement("tbody");
				const width = getGridWidth(grid);
				const safeGrid = normalizeGridShape(grid, width);

				for (let colIndex = 0; colIndex < width; colIndex += 1) {
					const columnHeader = document.createElement("th");
					columnHeader.className = "calendar-column-header";
					if (colIndex === selectedColumnIndex) {
						columnHeader.classList.add("is-selected");
					}
					columnHeader.scope = "col";
					columnHeader.textContent = resolveColumnLabel(colIndex);
					columnHeader.addEventListener("click", () => {
						selectedColumnIndex = colIndex;
						renderGrid();
					});

					const insertColumnHandle = document.createElement("button");
					insertColumnHandle.type = "button";
					insertColumnHandle.className = "calendar-insert-col-handle";
					insertColumnHandle.textContent = "+";
					insertColumnHandle.setAttribute("aria-label", `${resolveColumnLabel(colIndex)}列の右に列を挿入`);
					insertColumnHandle.addEventListener("click", (event) => {
						event.stopPropagation();
						insertColumnAt(colIndex + 1);
					});
					columnHeader.appendChild(insertColumnHandle);
					headRow.appendChild(columnHeader);
				}
				thead.appendChild(headRow);

				for (let rowIndex = 0; rowIndex < safeGrid.length; rowIndex += 1) {
					const tr = document.createElement("tr");

					const headerCell = document.createElement("th");
					headerCell.scope = "row";
					headerCell.className = "calendar-row-header";
					if (rowIndex === selectedRowIndex) {
						headerCell.classList.add("is-selected");
					}
					headerCell.textContent = String(rowIndex + 1);
					headerCell.addEventListener("click", () => {
						selectedRowIndex = rowIndex;
						renderGrid();
					});

					const insertRowHandle = document.createElement("button");
					insertRowHandle.type = "button";
					insertRowHandle.className = "calendar-insert-row-handle";
					insertRowHandle.textContent = "+";
					insertRowHandle.setAttribute("aria-label", `${rowIndex + 1}行の下に行を挿入`);
					insertRowHandle.addEventListener("click", (event) => {
						event.stopPropagation();
						insertRowAt(rowIndex + 1);
					});
					headerCell.appendChild(insertRowHandle);
					tr.appendChild(headerCell);

					for (let colIndex = 0; colIndex < width; colIndex += 1) {
						const td = document.createElement("td");
						const input = document.createElement("input");
						input.type = "text";
						input.className = "calendar-cell-input";
						input.value = safeGrid[rowIndex][colIndex] ?? "";
						if (rowIndex === selectedRowIndex && colIndex === selectedColumnIndex) {
							input.classList.add("is-selected");
						}
						input.setAttribute("aria-label", `R${rowIndex + 1}C${colIndex + 1}`);
						input.addEventListener("focus", () => {
							selectedRowIndex = rowIndex;
							selectedColumnIndex = colIndex;
							renderGrid();
						});
						input.addEventListener("input", () => {
							grid[rowIndex][colIndex] = input.value;
							persistCalendar(data, gridToCsv(grid));
							info.textContent = `${grid.length}行 x ${getGridWidth(grid)}列`;
							deps.onSetTopbarSaveStatus("未保存: カレンダー変更あり");
						});
						td.appendChild(input);
						tr.appendChild(td);
					}

					tbody.appendChild(tr);
				}

				const tailRow = document.createElement("tr");
				tailRow.className = "calendar-insert-tail-row";
				const tailHead = document.createElement("th");
				tailHead.className = "calendar-row-header calendar-row-tail";
				const insertBottomHandle = document.createElement("button");
				insertBottomHandle.type = "button";
				insertBottomHandle.className = "calendar-insert-bottom-handle";
				insertBottomHandle.textContent = "+";
				insertBottomHandle.setAttribute("aria-label", "末尾に行を挿入");
				insertBottomHandle.addEventListener("click", (event) => {
					event.stopPropagation();
					insertRowAt(safeGrid.length);
				});
				tailHead.appendChild(insertBottomHandle);
				tailRow.appendChild(tailHead);

				const tailCell = document.createElement("td");
				tailCell.className = "calendar-tail-cell";
				tailCell.colSpan = width;
				tailRow.appendChild(tailCell);
				tbody.appendChild(tailRow);

				table.appendChild(thead);
				table.appendChild(tbody);
				gridWrap.appendChild(table);
				info.textContent = `${grid.length}行 x ${width}列`;
			}

			/**
			 * @param {number} index
			 */
			function insertRowAt(index) {
				const width = getGridWidth(grid);
				const targetRow = clampIndex(index, grid.length);
				grid.splice(targetRow, 0, Array.from({ length: width }, () => ""));
				selectedRowIndex = targetRow;
				persistCalendar(data, gridToCsv(grid));
				renderGrid();
				deps.onSetFormStatus(`行${targetRow + 1}に行を挿入しました。`);
				deps.onSetTopbarSaveStatus("未保存: カレンダー変更あり");
			}

			/**
			 * @param {number} index
			 */
			function insertColumnAt(index) {
				const width = getGridWidth(grid);
				const targetColumn = clampIndex(index, width);
				for (const row of grid) {
					row.splice(targetColumn, 0, "");
				}
				selectedColumnIndex = targetColumn;
				persistCalendar(data, gridToCsv(grid));
				renderGrid();
				deps.onSetFormStatus(`列${resolveColumnLabel(targetColumn)}に列を挿入しました。`);
				deps.onSetTopbarSaveStatus("未保存: カレンダー変更あり");
			}

		}

		return {
			renderCalendarEditor,
		};
	}

	/** @type {any} */ (globalObject).createCalendarRenderer = createCalendarRenderer;
})(window);
