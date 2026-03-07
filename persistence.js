// @ts-check

(function registerPersistence(globalObject) {
	/**
	 * @param {{
	 *   getCurrentData: () => any,
	 *   getCurrentFileName: () => string,
	 *   getCurrentFileHandle: () => any | null,
	 *   setCurrentFileName: (fileName: string) => void,
	 *   setCurrentFileHandle: (fileHandle: any | null) => void
	 * }} deps
	 */
	function createPersistenceModule(deps) {
		/**
		 * @param {string} message
		 */
		function setFormStatus(message) {
			const statusElement = document.getElementById("entry-form-status");
			if (!statusElement) {
				return;
			}

			statusElement.textContent = message;
		}

		/**
		 * @param {string} message
		 */
		function setTopbarSaveStatus(message) {
			const statusElement = document.getElementById("topbar-save-status");
			if (!statusElement) {
				return;
			}

			statusElement.textContent = message;
		}

		/**
		 * @param {string} fileName
		 * @returns {string}
		 */
		function ensureJsonExtension(fileName) {
			if (fileName.toLowerCase().endsWith(".json")) {
				return fileName;
			}

			return `${fileName}.json`;
		}

		/**
		 * @param {string} jsonText
		 * @param {string} fileName
		 */
		function downloadJson(jsonText, fileName) {
			const blob = new Blob([jsonText], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = fileName;
			anchor.click();
			URL.revokeObjectURL(url);
		}

		/**
		 * @returns {Promise<void>}
		 */
		async function saveCurrentData() {
			const currentData = deps.getCurrentData();
			if (!currentData) {
				setFormStatus("保存するデータがありません。先に「開く」でJSONを読み込んでください。");
				setTopbarSaveStatus("保存対象なし");
				return;
			}

			const jsonText = JSON.stringify(currentData, null, 2);
			const suggestedName = ensureJsonExtension(deps.getCurrentFileName());
			const currentFileHandle = deps.getCurrentFileHandle();
			const windowAny = /** @type {any} */ (window);

			try {
				if (currentFileHandle && typeof currentFileHandle.createWritable === "function") {
					const writable = await currentFileHandle.createWritable();
					await writable.write(jsonText);
					await writable.close();
					const handleName = ensureJsonExtension(currentFileHandle.name || suggestedName);
					deps.setCurrentFileName(handleName);
					setFormStatus(`上書き保存しました: ${handleName}`);
					setTopbarSaveStatus(`上書き保存: ${handleName}`);
					return;
				}

				if (typeof windowAny.showSaveFilePicker === "function") {
					const handle = await windowAny.showSaveFilePicker({
						suggestedName,
						types: [
							{
								description: "JSON Files",
								accept: { "application/json": [".json"] },
							},
						],
					});
					const writable = await handle.createWritable();
					await writable.write(jsonText);
					await writable.close();
					deps.setCurrentFileHandle(handle);
					const handleName = ensureJsonExtension(handle.name || suggestedName);
					deps.setCurrentFileName(handleName);
					setFormStatus(`ファイルとして保存しました: ${handleName}`);
					setTopbarSaveStatus(`保存: ${handleName}`);
					return;
				}

				downloadJson(jsonText, suggestedName);
				deps.setCurrentFileName(suggestedName);
				setFormStatus(`保存しました: ${suggestedName}`);
				setTopbarSaveStatus(`ダウンロード保存: ${suggestedName}`);
			} catch (error) {
				if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
					return;
				}

				console.error("Failed to save JSON", error);
				setFormStatus("保存に失敗しました。");
				setTopbarSaveStatus("保存失敗");
			}
		}

		return {
			setFormStatus,
			setTopbarSaveStatus,
			saveCurrentData,
		};
	}

	/** @type {any} */ (globalObject).createPersistenceModule = createPersistenceModule;
})(window);
