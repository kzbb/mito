// @ts-check

(function registerFileActions(globalObject) {
	/**
	 * @typedef {{
	 *   onNew: () => void,
	 *   onOpenFile: (file: File, fileHandle: any | null) => Promise<void> | void,
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

		if (openButton) {
			openButton.addEventListener("click", () => {
				void openDocument();
			});
		}

		if (input) {
			// ファイル選択後にハンドラへ渡し、input の値をリセットして再選択を可能にする。
			// この経路はファイルハンドルを取得できないため、保存時は保存先の指定が必要になる。
			input.addEventListener("change", async () => {
				const [file] = Array.from(input.files ?? []);
				if (!file) {
					return;
				}

				await handlers.onOpenFile(file, null);
				input.value = "";
			});
		}

		/**
		 * ファイルを開く。
		 *
		 * showOpenFilePicker が使える環境ではそちらを優先する。ファイルハンドルが
		 * 得られると、以降の Ctrl+S / Cmd+S が保存先を聞かずに同じファイルへ
		 * 上書き保存できるようになる。未対応環境では隠しファイル入力へ委ねる。
		 *
		 * @returns {Promise<void>}
		 */
		async function openDocument() {
			const windowAny = /** @type {any} */ (window);
			if (typeof windowAny.showOpenFilePicker !== "function") {
				input?.click();
				return;
			}

			try {
				const [fileHandle] = await windowAny.showOpenFilePicker({
					multiple: false,
					types: [
						{
							description: "JSON Files",
							accept: { "application/json": [".json"] },
						},
					],
				});
				if (!fileHandle) {
					return;
				}

				const file = await fileHandle.getFile();
				await handlers.onOpenFile(file, fileHandle);
			} catch (error) {
				if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
					return;
				}

				// ピッカーが使えない状況（未対応の呼び出し文脈など）では入力要素へ退避する
				console.error("Failed to open file with picker", error);
				input?.click();
			}
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
