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
	 * Wire topbar file actions and save shortcuts.
	 * @param {FileActionHandlers} handlers
	 */
	function setupFileActions(handlers) {
		const newButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("new-file"));
		const openButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("open-file"));
		const saveButton = /** @type {HTMLButtonElement | null} */ (document.getElementById("save-file"));
		const input = /** @type {HTMLInputElement | null} */ (document.getElementById("json-file-input"));

		if (newButton) {
			newButton.addEventListener("click", () => {
				handlers.onNew();
			});
		}

		if (openButton && input) {
			openButton.addEventListener("click", () => {
				input.click();
			});

			input.addEventListener("change", async () => {
				const [file] = Array.from(input.files ?? []);
				if (!file) {
					return;
				}

				await handlers.onOpenFile(file);
				input.value = "";
			});
		}

		if (saveButton) {
			saveButton.addEventListener("click", () => {
				void handlers.onSave();
			});
		}

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
