// @ts-check

(function registerRendererFallbacks(globalObject) {
	/**
	 * @returns {{
	 *   resolveCalendarSchema: (data: any) => { headers: string[], rows: Record<string, string>[] },
	 *   resolveTimelineValues: (entry: any, key: string, headers: string[]) => Record<string, string>,
	 *   renderMarkdownToHtml: (source: string) => string,
	 *   makeEntryByNameResolver: (getCurrentData: () => any, resolveEntryName: (entry: any) => string) => (name: string) => any | null,
	 *   cssEscape: (value: string) => string
	 * }}
	 */
	/**
	 * 生成済みのフォールバック群。
	 * 中身は状態を持たない純粋なヘルパーのみなので、レンダラーごとに
	 * 作り直す必要がない（カレンダー解析キャッシュを共有したいため、
	 * むしろ1つに保つほうが望ましい）。
	 * @type {any}
	 */
	let sharedFallbacks = null;

	/**
	 * 共有ヘルパーを取得する。
	 * 各レンダラーは `createRendererFallbacks()` を呼んで、返ってきたものを
	 * そのまま使えばよい（`?? 代替` を各所で書く必要はない。代替はこの中にある）。
	 */
	function createRendererFallbacks() {
		if (sharedFallbacks) {
			return sharedFallbacks;
		}

		const createCalendarUtils = /** @type {any} */ (globalObject).createCalendarUtils;
		const calendarUtils = typeof createCalendarUtils === "function" ? createCalendarUtils() : null;
		const createMarkdownEngine = /** @type {any} */ (globalObject).createMarkdownEngine;
		const markdownEngine = typeof createMarkdownEngine === "function" ? createMarkdownEngine() : null;

		if (!calendarUtils) {
			console.error("[mito] createCalendarUtils が利用できません。カレンダー関連の表示は空になります。");
		}
		if (!markdownEngine) {
			console.error("[mito] createMarkdownEngine が利用できません。説明欄はプレーンテキストとして表示します。");
		}

		// 各モジュールが同じ代替実装を持ち回ると劣化コピーの二重管理になるため、
		// 代替は必ずここに1つだけ置く。中身は「安全な空の結果」に留め、
		// 本来の実装を写さない（写すと本体を直したときに片方だけ古くなる）。
		const resolveCalendarSchema = calendarUtils?.resolveCalendarSchema ?? (() => ({ headers: [], rows: [] }));
		const resolveTimelineValues = calendarUtils?.resolveTimelineValues
			?? ((/** @type {any} */ _entry, /** @type {string} */ _key, /** @type {string[]} */ headers) => {
				/** @type {Record<string, string>} */
				const values = {};
				for (const header of headers) {
					values[header] = "";
				}
				return values;
			});
		// Markdownエンジンが無い場合は、最低限エスケープしてそのまま出す。
		// innerHTML に渡されるため、エスケープを省くとHTMLが注入されうる。
		const renderMarkdownToHtml = markdownEngine?.renderToHtml
			?? ((/** @type {string} */ source) => String(source ?? "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;")
				.replace(/\n/g, "<br>"));

		/**
		 * 属性セレクタに値を埋め込むためにエスケープする。
		 * @param {string} value
		 * @returns {string}
		 */
		function cssEscape(value) {
			if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
				return CSS.escape(value);
			}

			return String(value ?? "").replace(/(["\\])/g, "\\$1");
		}

		/**
		 * @param {() => any} getCurrentData
		 * @param {(entry: any) => string} resolveEntryName
		 * @returns {(name: string) => any | null}
		 */
		function makeEntryByNameResolver(getCurrentData, resolveEntryName) {
			return function (name) {
				if (!name) {
					return null;
				}
				const normalized = name.trim().toLocaleLowerCase("ja");
				const currentData = getCurrentData();
				const activeEntries = Array.isArray(currentData?.active) ? currentData.active : [];
				for (const candidate of activeEntries) {
					const candidateName = resolveEntryName(candidate).trim().toLocaleLowerCase("ja");
					if (candidateName === normalized) {
						return candidate;
					}
				}
				return null;
			};
		}

		sharedFallbacks = {
			resolveCalendarSchema,
			resolveTimelineValues,
			renderMarkdownToHtml,
			makeEntryByNameResolver,
			cssEscape,
		};
		return sharedFallbacks;
	}

	/** @type {any} */ (globalObject).createRendererFallbacks = createRendererFallbacks;
})(window);
