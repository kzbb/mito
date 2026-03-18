// @ts-check

(function registerRendererFallbacks(globalObject) {
	/**
	 * @returns {{
	 *   resolveCalendarSchema: (data: any) => { headers: string[], rows: Record<string, string>[] },
	 *   resolveTimelineValues: (entry: any, key: string, headers: string[]) => Record<string, string>,
	 *   renderMarkdownToHtml: (source: string) => string,
	 *   makeEntryByNameResolver: (getCurrentData: () => any, resolveEntryName: (entry: any) => string) => (name: string) => any | null
	 * }}
	 */
	function createRendererFallbacks() {
		const createCalendarUtils = /** @type {any} */ (globalObject).createCalendarUtils;
		const calendarUtils = typeof createCalendarUtils === "function" ? createCalendarUtils() : null;
		const createMarkdownEngine = /** @type {any} */ (globalObject).createMarkdownEngine;
		const markdownEngine = typeof createMarkdownEngine === "function" ? createMarkdownEngine() : null;

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
		const renderMarkdownToHtml = markdownEngine?.renderToHtml
			?? ((/** @type {string} */ source) => source
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/\"/g, "&quot;")
				.replace(/'/g, "&#39;")
				.replace(/\n/g, "<br>"));

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

		return {
			resolveCalendarSchema,
			resolveTimelineValues,
			renderMarkdownToHtml,
			makeEntryByNameResolver,
		};
	}

	/** @type {any} */ (globalObject).createRendererFallbacks = createRendererFallbacks;
})(window);
