// @ts-check

(function registerMarkdownEngine(globalObject) {
	/**
	 * @returns {{ renderToHtml: (source: string) => string }}
	 */
	function createMarkdownEngine() {
		/**
		 * @param {string} value
		 * @returns {string}
		 */
		function escapeHtml(value) {
			return value
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/\"/g, "&quot;")
				.replace(/'/g, "&#39;");
		}

		/**
		 * @param {string} source
		 * @returns {string}
		 */
		function renderInline(source) {
			let value = escapeHtml(source);

			/** @type {string[]} */
			const codeTokens = [];
			value = value.replace(/`([^`]+)`/g, (_full, codeText) => {
				const token = `__MITO_CODE_${codeTokens.length}__`;
				codeTokens.push(`<code>${codeText}</code>`);
				return token;
			});

			value = value.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_full, rawTarget, rawLabel) => {
				const target = String(rawTarget ?? "").trim();
				if (!target) {
					return "";
				}

				const label = String(rawLabel ?? target).trim() || target;
				return `<a href="#" data-mito-link="${target}">${label}</a>`;
			});

			value = value.replace(/\[(file:[^\s\]]+)(?:\s+([^\]]+))?\]/g, (_full, rawHref, rawLabel) => {
				const fileSpecifier = String(rawHref ?? "").trim();
				const filePath = fileSpecifier.slice("file:".length).trim();
				if (!filePath) {
					return "";
				}

				const label = String(rawLabel ?? filePath).trim() || filePath;
				return `<a href="#" data-mito-file-path="${filePath}">${label}</a>`;
			});

			value = value.replace(/\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]/g, (_full, rawHref, rawLabel) => {
				const href = String(rawHref ?? "").trim();
				if (!/^https?:\/\//i.test(href)) {
					return "";
				}

				const label = String(rawLabel ?? href).trim() || href;
				return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
			});

			value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
			value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
			value = value.replace(/__MITO_CODE_(\d+)__/g, (_full, indexText) => {
				const index = Number.parseInt(indexText, 10);
				return codeTokens[index] ?? "";
			});
			return value;
		}

		/**
		 * Markdownテキストを1行ずつ処理してHTMLブロック列に変換する。
		 * コードブロック・見出し・リスト・引用・段落の各ブロック要素に対応する。
		 * インライン要素（リンク・太字・斜体・コード）は renderInline に委譲する。
		 * @param {string} source
		 * @returns {string}
		 */
		function renderToHtml(source) {
			const normalized = String(source ?? "").replace(/\r\n?/g, "\n").trim();
			if (!normalized) {
				return "";
			}

			const lines = normalized.split("\n");
			/** @type {string[]} 完成したHTMLブロック要素の配列。最後に結合して返す */
			const blocks = [];
			/** コードブロック（```）内にいるかどうか */
			let inCode = false;
			/** @type {string[]} コードブロック内で蓄積中の行 */
			let codeLines = [];
			/** @type {string[]} 段落として蓄積中の行 */
			let paragraphLines = [];
			/** @type {string[]} リストアイテムとして蓄積中のテキスト */
			let listItems = [];
			/** @type {"ul" | "ol" | null} 現在処理中のリスト種別 */
			let listMode = null;
			/** @type {number | null} 番号付きリストの開始番号 */
			let orderedListStart = null;
			/** @type {string[]} 引用ブロックとして蓄積中の行 */
			let quoteLines = [];
			/** 連続した空行のカウント（2行以上で明示的な改行ブロックを挿入） */
			let blankLineStreak = 0;

			// 蓄積中の段落行を <p> ブロックに変換して blocks へ追加する
			const flushParagraph = () => {
				if (paragraphLines.length === 0) {
					return;
				}
				const body = paragraphLines.map((line) => renderInline(line)).join("<br>");
				blocks.push(`<p>${body}</p>`);
				paragraphLines = [];
			};

			// 蓄積中のリストアイテムを <ul> または <ol> ブロックに変換して blocks へ追加する
			const flushList = () => {
				if (listItems.length === 0) {
					return;
				}
				const tag = listMode === "ol" ? "ol" : "ul";
				const startAttr = tag === "ol" && orderedListStart !== null && orderedListStart > 1
					? ` start="${orderedListStart}"`
					: "";
				blocks.push(`<${tag}${startAttr}>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`);
				listItems = [];
				listMode = null;
				orderedListStart = null;
			};

			// 蓄積中の引用行を <blockquote> ブロックに変換して blocks へ追加する
			const flushQuote = () => {
				if (quoteLines.length === 0) {
					return;
				}
				const body = quoteLines.map((line) => renderInline(line)).join("<br>");
				blocks.push(`<blockquote>${body}</blockquote>`);
				quoteLines = [];
			};

			for (const line of lines) {
				if (line.trim().startsWith("```")) {
					blankLineStreak = 0;
					flushParagraph();
					flushList();
					flushQuote();
					if (inCode) {
						blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
						codeLines = [];
						inCode = false;
					} else {
						inCode = true;
					}
					continue;
				}

				if (inCode) {
					codeLines.push(line);
					continue;
				}

				const trimmed = line.trim();
				if (!trimmed) {
					blankLineStreak += 1;
					flushParagraph();
					flushList();
					flushQuote();
					if (blankLineStreak > 1) {
						blocks.push("<br>");
					}
					continue;
				}

				blankLineStreak = 0;

				const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
				if (headingMatch) {
					flushParagraph();
					flushList();
					flushQuote();
					const depth = headingMatch[1].length;
					const headingText = renderInline(headingMatch[2]);
					blocks.push(`<h${depth}>${headingText}</h${depth}>`);
					continue;
				}

				const quoteMatch = trimmed.match(/^>\s?(.*)$/);
				if (quoteMatch) {
					flushParagraph();
					flushList();
					quoteLines.push(quoteMatch[1]);
					continue;
				}

				const unorderedListMatch = trimmed.match(/^[-*]\s+(.+)$/);
				if (unorderedListMatch) {
					flushParagraph();
					flushQuote();
					if (listMode && listMode !== "ul") {
						flushList();
					}
					listMode = "ul";
					listItems.push(unorderedListMatch[1]);
					continue;
				}

				const orderedListMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
				if (orderedListMatch) {
					flushParagraph();
					flushQuote();
					if (listMode && listMode !== "ol") {
						flushList();
					}
					listMode = "ol";
					if (orderedListStart === null) {
						orderedListStart = Number.parseInt(orderedListMatch[1], 10);
					}
					listItems.push(orderedListMatch[2]);
					continue;
				}

				flushList();
				flushQuote();
				paragraphLines.push(trimmed);
			}

			if (inCode) {
				blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
			}
			flushParagraph();
			flushList();
			flushQuote();

			return blocks.join("");
		}

		return { renderToHtml };
	}

	/** @type {any} */ (globalObject).createMarkdownEngine = createMarkdownEngine;
})(window);
