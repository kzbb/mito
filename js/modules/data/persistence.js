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
			const statusElement = document.getElementById("footer-status") || document.getElementById("entry-form-status");
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
			const downloadTextFile = /** @type {any} */ (window).downloadTextFile;
			if (typeof downloadTextFile !== "function") {
				console.error("File download module is not available");
				return;
			}

			downloadTextFile(jsonText, "application/json", fileName);
		}

		/**
		 * ファイルハンドルに書き込み権限があることを確認し、無ければ昇格を求める。
		 *
		 * showOpenFilePicker で得たハンドルは読み取り専用で始まるため、
		 * これを通さずに createWritable() を呼ぶと NotAllowedError になる。
		 * 権限が得られなかった場合は false を返し、呼び出し側は
		 * 「保存先を指定して保存」へフォールバックする。
		 *
		 * @param {any} fileHandle
		 * @returns {Promise<boolean>}
		 */
		async function ensureWritePermission(fileHandle) {
			if (!fileHandle || typeof fileHandle.queryPermission !== "function") {
				// 権限APIを持たない環境では、そのまま書き込みを試す
				return true;
			}

			const options = { mode: "readwrite" };
			try {
				if (await fileHandle.queryPermission(options) === "granted") {
					return true;
				}

				if (typeof fileHandle.requestPermission !== "function") {
					return false;
				}

				return await fileHandle.requestPermission(options) === "granted";
			} catch (error) {
				console.error("Failed to check write permission", error);
				return false;
			}
		}

		/**
		 * @returns {Promise<boolean>}
		 */
		async function saveCurrentData() {
			const currentData = deps.getCurrentData();
			if (!currentData) {
				setFormStatus("保存するデータがありません。先に「開く」でJSONを読み込んでください。");
				setTopbarSaveStatus("保存対象なし");
				return false;
			}

			const nowJST = /** @type {any} */ (window).nowJST;
			const nextUpdatedAt = nowJST();
			// 直列化のための一時コピーは作るが、currentData 自体は差し替えない。
			// 差し替えると、開いている画面（カレンダー編集など）が保存前のオブジェクトを
			// 掴んだままになり、以降の編集が保存対象から外れてしまう。
			const jsonText = JSON.stringify({ ...currentData, updatedAt: nextUpdatedAt }, null, 2);
			const suggestedName = ensureJsonExtension(deps.getCurrentFileName());
			const currentFileHandle = deps.getCurrentFileHandle();
			const windowAny = /** @type {any} */ (window);

			// 書き込みが成功して初めて updatedAt を確定させる。
			// 保存のキャンセルや失敗で、ファイルより新しい updatedAt が残らないようにする。
			const commitUpdatedAt = () => {
				currentData.updatedAt = nextUpdatedAt;
			};

			try {
				if (currentFileHandle && typeof currentFileHandle.createWritable === "function"
					&& await ensureWritePermission(currentFileHandle)) {
					const writable = await currentFileHandle.createWritable();
					await writable.write(jsonText);
					await writable.close();
					commitUpdatedAt();
					const handleName = ensureJsonExtension(currentFileHandle.name || suggestedName);
					deps.setCurrentFileName(handleName);
					setFormStatus(`上書き保存しました: ${handleName}`);
					setTopbarSaveStatus(`上書き保存: ${handleName}`);
					return true;
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
					commitUpdatedAt();
					deps.setCurrentFileHandle(handle);
					const handleName = ensureJsonExtension(handle.name || suggestedName);
					deps.setCurrentFileName(handleName);
					setFormStatus(`ファイルとして保存しました: ${handleName}`);
					setTopbarSaveStatus(`保存: ${handleName}`);
					return true;
				}

				downloadJson(jsonText, suggestedName);
				commitUpdatedAt();
				deps.setCurrentFileName(suggestedName);
				setFormStatus(`保存しました: ${suggestedName}`);
				setTopbarSaveStatus(`ダウンロード保存: ${suggestedName}`);
				return true;
			} catch (error) {
				if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
					return false;
				}

				console.error("Failed to save JSON", error);
				setFormStatus("保存に失敗しました。");
				setTopbarSaveStatus("保存失敗");
				return false;
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
