// @ts-check

(function registerShareActions(globalObject) {
	/**
	 * 共有リンクの読み込みと生成をUIへ結線する。
	 *
	 * URL解釈と圧縮そのものは share-link.js が持つ。ここが受け持つのは
	 * 「ネットワークから取ってくる」「ユーザーに確認する」「画面へ出す」の3つ。
	 *
	 * @param {{
	 *   shareLink: any,
	 *   getCurrentData: () => any,
	 *   openDocumentFile: (file: File) => Promise<boolean>,
	 *   hasAutosaveSnapshot: () => boolean,
	 *   setFormStatus: (message: string) => void,
	 *   setTopbarSaveStatus: (message: string) => void,
	 *   renderFileLoadError: (message: string) => void
	 * }} deps
	 */
	function createAppShareActions(deps) {
		/** @type {string} 現在のドキュメントの取得元URL。共有ダイアログの初期値に使う */
		let currentSourceUrl = "";

		/**
		 * @param {string} message
		 */
		function reportLoadFailure(message) {
			deps.renderFileLoadError(message);
			deps.setFormStatus(message);
			deps.setTopbarSaveStatus("共有リンクの読み込み失敗");
		}

		/**
		 * 取得失敗の理由を、利用者が次に何をすればよいか分かる言葉にする。
		 *
		 * CORS拒否は fetch の TypeError としてしか観測できず、レスポンスも
		 * ステータスコードも得られない。ここで「MITOの不具合ではなく置き場所の
		 * 制約である」ことを伝えないと、原因不明の失敗に見えてしまう。
		 *
		 * @param {any} source
		 * @param {unknown} error
		 * @returns {string}
		 */
		function describeFetchFailure(source, error) {
			if (error instanceof TypeError) {
				return `${source.displayUrl} を読み込めませんでした。`
					+ "この置き場所はブラウザからの直接読み込み（CORS）を許可していない可能性があります。"
					+ `${deps.shareLink.listSupportedProviderLabels().join(" / ")}の共有リンク、`
					+ "またはCORSを許可したサーバー上のファイルをお使いください。";
			}

			const detail = error instanceof Error ? error.message : String(error);
			return `${source.displayUrl} を読み込めませんでした: ${detail}`;
		}

		/**
		 * HTTPエラーを、置き場所の事情を踏まえた説明にする。
		 *
		 * Googleドライブは「非公開のファイル」も「存在しないファイル」も同じ404を返す
		 * （存在の有無を漏らさないため）。共有設定の変更忘れが最も起きやすい失敗なので、
		 * 404を素通しせずそこへ誘導する。
		 *
		 * @param {any} source
		 * @param {number} status
		 * @returns {string}
		 */
		function describeHttpFailure(source, status) {
			if (source.provider === "googledrive") {
				if (status === 404) {
					return "ファイルが見つかりません。共有設定が「リンクを知っている全員」になっているか確認してください"
						+ "（非公開のままのファイルも、存在しないファイルと同じ404になります）。";
				}
				if (status === 403) {
					return "Googleドライブへのアクセスが拒否されました（HTTP 403）。"
						+ "APIキーの制限設定、または利用量の上限を確認してください。";
				}
			}

			if (status === 404) {
				return "ファイルが見つかりません（HTTP 404）。"
					+ "URLと、リンクを知っていれば閲覧できる状態になっているかを確認してください。";
			}

			if (status === 401 || status === 403) {
				return `アクセスが拒否されました（HTTP ${status}）。ファイルの公開設定を確認してください。`;
			}

			return `HTTP ${status}`;
		}

		/**
		 * @param {any} source
		 * @returns {Promise<string>}
		 */
		async function fetchSourceText(source) {
			// 認証情報は一切送らない。共有リンクは「リンクを知っていれば読める」ファイルだけを対象にする。
			const response = await fetch(source.fetchUrl, {
				credentials: "omit",
				redirect: "follow",
				headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
			});

			if (!response.ok) {
				throw new Error(describeHttpFailure(source, response.status));
			}

			const declaredLength = Number(response.headers.get("content-length"));
			if (Number.isFinite(declaredLength) && declaredLength > deps.shareLink.MAX_SOURCE_BYTES) {
				throw new Error("ファイルが大きすぎます");
			}

			const text = await response.text();
			if (text.length > deps.shareLink.MAX_SOURCE_BYTES) {
				throw new Error("ファイルが大きすぎます");
			}

			return text;
		}

		/**
		 * 取得したJSON文字列を、通常のファイル読み込みと同じ経路へ流す。
		 *
		 * File を作って既存の読み込み処理へ渡すことで、正規化・描画・未保存フラグの
		 * 扱いを共有リンク用に作り直さずに済ませる。ファイルハンドルは持てないため、
		 * 保存操作は自動的に「名前を付けて保存」になる。
		 *
		 * @param {string} jsonText
		 * @param {string} fileName
		 * @returns {Promise<boolean>}
		 */
		async function openJsonText(jsonText, fileName) {
			const file = new File([jsonText], fileName, { type: "application/json" });
			return deps.openDocumentFile(file);
		}

		/**
		 * 参照モード。外部URLからJSONを取得して開く。
		 * @param {string} rawUrl
		 * @param {{ confirmBeforeFetch: boolean }} options
		 * @returns {Promise<boolean>}
		 */
		async function loadFromSourceUrl(rawUrl, options) {
			const source = deps.shareLink.resolveSourceUrl(rawUrl);
			if (!source.ok) {
				reportLoadFailure(source.reason);
				return false;
			}

			// 他人から受け取ったリンクを黙って取りに行かない。
			// 自分の文書と見分けがつかないまま外部の内容が開くのを防ぐ。
			if (options.confirmBeforeFetch) {
				const accepted = window.confirm(
					`共有リンクです。次のURLからドキュメントを読み込みます。\n\n${source.displayUrl}\n\n読み込みますか？`,
				);
				if (!accepted) {
					deps.setFormStatus("共有リンクの読み込みをキャンセルしました。");
					deps.setTopbarSaveStatus("未保存");
					return false;
				}
			}

			deps.setFormStatus(`読み込み中: ${source.displayUrl}`);
			deps.setTopbarSaveStatus("読み込み中");

			/** @type {string} */
			let jsonText;
			try {
				jsonText = await fetchSourceText(source);
			} catch (error) {
				console.error("Failed to fetch shared document", error);
				reportLoadFailure(describeFetchFailure(source, error));
				return false;
			}

			if (!await openJsonText(jsonText, source.fileName)) {
				return false;
			}

			currentSourceUrl = source.displayUrl;
			deps.setFormStatus(`共有リンクから読み込みました（${source.providerLabel}）: ${source.displayUrl}`);
			deps.setTopbarSaveStatus(`共有: ${source.fileName}`);
			return true;
		}

		/**
		 * 埋め込みモード。URLのフラグメントに入ったドキュメントを復元して開く。
		 * @param {string} encodedData
		 * @returns {Promise<boolean>}
		 */
		async function loadFromInlineData(encodedData) {
			/** @type {string} */
			let jsonText;
			try {
				jsonText = await deps.shareLink.decodeInlineDocument(encodedData);
			} catch (error) {
				console.error("Failed to decode inline shared document", error);
				reportLoadFailure("共有URLに埋め込まれたデータを復元できませんでした。URLが途中で切れている可能性があります。");
				return false;
			}

			if (!await openJsonText(jsonText, "shared.json")) {
				return false;
			}

			currentSourceUrl = "";
			deps.setFormStatus("共有URLに埋め込まれたドキュメントを読み込みました。保存するとファイルになります。");
			deps.setTopbarSaveStatus("共有: shared.json");
			return true;
		}

		/**
		 * 起動時に現在のURLを見て、共有リンクなら読み込む。
		 *
		 * 戻り値は「共有リンクとして処理したか」であって、成否ではない。
		 * 失敗した場合に下書き復元へ流れると、失敗の表示が上書きされて
		 * 何が起きたのか分からなくなるため、処理した時点で呼び出し側を止める。
		 *
		 * @returns {Promise<boolean>}
		 */
		async function loadFromLocation() {
			const params = deps.shareLink.readShareParams(window.location.href);
			if (!params.sourceUrl && !params.inlineData) {
				return false;
			}

			// 下書きが残っている状態で共有リンクを開くと、以降の編集で下書きが
			// 上書きされる。どちらを優先するかは利用者にしか決められない。
			if (deps.hasAutosaveSnapshot()) {
				const accepted = window.confirm(
					"未保存の下書きが残っています。共有リンクを開きますか？\n\n"
					+ "「キャンセル」を選ぶと、共有リンクを開かずに下書きの復元へ進みます。",
				);
				if (!accepted) {
					deps.setFormStatus("共有リンクを開かずに下書きの確認へ進みます。");
					return false;
				}
			}

			if (params.sourceUrl) {
				await loadFromSourceUrl(params.sourceUrl, { confirmBeforeFetch: true });
				return true;
			}

			await loadFromInlineData(params.inlineData);
			return true;
		}

		/**
		 * 共有ダイアログの部品をまとめて引く。
		 * @returns {any}
		 */
		function getShareDialogElements() {
			return {
				dialog: /** @type {HTMLDialogElement | null} */ (document.getElementById("share-dialog")),
				status: document.getElementById("share-dialog-status"),
				sourceInput: /** @type {HTMLInputElement | null} */ (document.getElementById("share-source-input")),
				sourceBuild: document.getElementById("share-source-build"),
				sourceResult: document.getElementById("share-source-result"),
				sourceOutput: /** @type {HTMLTextAreaElement | null} */ (document.getElementById("share-source-output")),
				sourceCopy: document.getElementById("share-source-copy"),
				inlineSection: /** @type {HTMLDetailsElement | null} */ (document.getElementById("share-inline-section")),
				inlineBuild: document.getElementById("share-inline-build"),
				inlineResult: document.getElementById("share-inline-result"),
				inlineOutput: /** @type {HTMLTextAreaElement | null} */ (document.getElementById("share-inline-output")),
				inlineCopy: document.getElementById("share-inline-copy"),
			};
		}

		/**
		 * @param {HTMLTextAreaElement} output
		 * @param {HTMLElement} container
		 * @param {string} shareUrl
		 */
		function showShareResult(output, container, shareUrl) {
			output.value = shareUrl;
			container.hidden = false;
		}

		/**
		 * @param {HTMLTextAreaElement | null} output
		 * @param {HTMLElement | null} container
		 */
		function clearShareResult(output, container) {
			if (output) {
				output.value = "";
			}
			if (container) {
				container.hidden = true;
			}
		}

		/**
		 * @param {HTMLTextAreaElement} output
		 * @param {(message: string) => void} setStatus
		 * @returns {Promise<void>}
		 */
		async function copyShareUrl(output, setStatus) {
			if (!output.value) {
				return;
			}

			// コピーできなかった場合に手で拾えるよう、必ず選択状態にしてから試す
			output.focus();
			output.select();

			if (!navigator.clipboard) {
				setStatus("この環境では自動コピーができません。選択されているURLを手動でコピーしてください。");
				return;
			}

			try {
				await navigator.clipboard.writeText(output.value);
				setStatus("クリップボードにコピーしました。");
			} catch (error) {
				console.error("Failed to copy share URL", error);
				setStatus("コピーできませんでした。選択されているURLを手動でコピーしてください。");
			}
		}

		/**
		 * トップバーの「URLで開く」「共有」と共有ダイアログを結線する。
		 */
		function setupShareUi() {
			const openUrlButton = document.getElementById("open-url");
			const shareButton = document.getElementById("share-document");
			const elements = getShareDialogElements();

			// 貼れる置き場所は配信環境の設定で変わるため、案内文はここで組み立てる
			const providersElement = document.getElementById("share-source-providers");
			if (providersElement) {
				providersElement.textContent
					= `${deps.shareLink.listSupportedProviderLabels().join(" / ")}の共有リンクはそのまま貼れます。`;
			}

			/** @param {string} message */
			const setDialogStatus = (message) => {
				if (elements.status) {
					elements.status.textContent = message;
				}
			};

			if (openUrlButton) {
				openUrlButton.addEventListener("click", () => {
					const rawUrl = window.prompt("読み込むJSONのURLを入力してください。", currentSourceUrl);
					if (rawUrl === null || rawUrl.trim() === "") {
						return;
					}

					// 利用者自身が入力したURLなので、取得前の確認は挟まない
					void loadFromSourceUrl(rawUrl, { confirmBeforeFetch: false });
				});
			}

			if (shareButton && elements.dialog) {
				shareButton.addEventListener("click", () => {
					setDialogStatus("");
					clearShareResult(elements.sourceOutput, elements.sourceResult);
					clearShareResult(elements.inlineOutput, elements.inlineResult);
					// 開いたままだと次回も展開されたまま出てしまうので、毎回畳んだ状態に戻す
					if (elements.inlineSection) {
						elements.inlineSection.open = false;
					}
					if (elements.sourceInput) {
						elements.sourceInput.value = currentSourceUrl;
					}
					elements.dialog.showModal();
				});
			}

			if (elements.sourceBuild && elements.sourceInput && elements.sourceOutput && elements.sourceResult) {
				elements.sourceBuild.addEventListener("click", () => {
					const source = deps.shareLink.resolveSourceUrl(elements.sourceInput.value);
					if (!source.ok) {
						clearShareResult(elements.sourceOutput, elements.sourceResult);
						setDialogStatus(source.reason);
						return;
					}

					// 共有URLには利用者が貼った元のURLを載せる。取得用URLへの変換は
					// 開く側で毎回行うので、変換規則を直しても配布済みのリンクが古びない。
					const shareUrl = deps.shareLink.buildSourceShareUrl(window.location.href, source.displayUrl);
					showShareResult(elements.sourceOutput, elements.sourceResult, shareUrl);
					setDialogStatus(`共有URLを生成しました（${source.providerLabel}）。`);
				});
			}

			if (elements.sourceCopy && elements.sourceOutput) {
				elements.sourceCopy.addEventListener("click", () => {
					void copyShareUrl(elements.sourceOutput, setDialogStatus);
				});
			}

			if (elements.inlineBuild && elements.inlineOutput && elements.inlineResult) {
				elements.inlineBuild.addEventListener("click", () => {
					void (async () => {
						const currentData = deps.getCurrentData();
						if (!currentData) {
							clearShareResult(elements.inlineOutput, elements.inlineResult);
							setDialogStatus("共有するドキュメントがありません。先に新規作成か読み込みを行ってください。");
							return;
						}

						setDialogStatus("生成中…");
						try {
							// URLへ載せるので整形はしない（圧縮しても短いほうが確実）
							const encoded = await deps.shareLink.encodeInlineDocument(JSON.stringify(currentData));
							const shareUrl = deps.shareLink.buildInlineShareUrl(window.location.href, encoded);
							showShareResult(elements.inlineOutput, elements.inlineResult, shareUrl);
							const length = shareUrl.length.toLocaleString();
							setDialogStatus(shareUrl.length > deps.shareLink.INLINE_URL_LENGTH_LIMIT
								? `生成しました（${length}文字）。長いURLはメールやチャットで途中で切られることがあります。上の「ファイルのURLを参照する」方式をおすすめします。`
								: `生成しました（${length}文字）。`);
						} catch (error) {
							console.error("Failed to build inline share URL", error);
							clearShareResult(elements.inlineOutput, elements.inlineResult);
							setDialogStatus("共有URLの生成に失敗しました。");
						}
					})();
				});
			}

			if (elements.inlineCopy && elements.inlineOutput) {
				elements.inlineCopy.addEventListener("click", () => {
					void copyShareUrl(elements.inlineOutput, setDialogStatus);
				});
			}
		}

		return {
			setupShareUi,
			loadFromLocation,
			loadFromSourceUrl,
			loadFromInlineData,
			getCurrentSourceUrl: () => currentSourceUrl,
			setCurrentSourceUrl: (/** @type {string} */ sourceUrl) => {
				currentSourceUrl = sourceUrl;
			},
		};
	}

	/** @type {any} */ (globalObject).createAppShareActions = createAppShareActions;
})(window);
