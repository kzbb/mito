// @ts-check

(function registerFileActions(globalObject) {
	/**
	 * @typedef {{
	 *   onNew: () => void,
	 *   onOpenFile: (file: File) => Promise<void> | void,
	 *   onSave: () => Promise<void> | void
	 * }} FileActionHandlers
	 */

	/**
	 * トップバーのファイル操作ボタンと保存ショートカットを接続する。
	 * @param {FileActionHandlers} handlers
	 */
	function setupFileActions(handlers) {
		const newButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("new-file"));
		const openButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("open-file"));
		const saveButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("save-file"));
		const input = /** @type {HTMLInputElement | null} */ (document.getElementById("json-file-input"));

		// 「新規作成」ボタン
		if (newButton) {
			newButton.addEventListener("click", () => {
				handlers.onNew();
			});
		}

		if (openButton && input) {
			// 「開く」ボタンをクリックすると隠しファイル入力をトリガーする
			openButton.addEventListener("click", () => {
				input.click();
			});

			// ファイル選択後にハンドラへ渡し、input の値をリセットして再選択を可能にする
			input.addEventListener("change", async () => {
				const [file] = Array.from(input.files ?? []);
				if (!file) {
					return;
				}

				await handlers.onOpenFile(file);
				input.value = "";
			});
		}

		// 「保存」ボタン
		if (saveButton) {
			saveButton.addEventListener("click", () => {
				void handlers.onSave();
			});
		}

		// Ctrl+S / Cmd+S のキーボードショートカットで保存
		document.addEventListener("keydown", (event) => {
			const key = event.key.toLowerCase();
			if ((event.ctrlKey || event.metaKey) && key === "s") {
				event.preventDefault();
				void handlers.onSave();
			}
		});
	}

	/** @type {any} */ (globalObject).setupFileActions = setupFileActions;
})(window);
