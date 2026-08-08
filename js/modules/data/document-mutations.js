// @ts-check

(function registerDocumentMutations(globalObject) {
	/** ドキュメントの内容が変わったことを知らせるカスタムイベント名。 */
	const DATA_CHANGED_EVENT = "mito:data-changed";

	/**
	 * ドキュメントへの変更を1箇所に集約するヘルパーを生成する。
	 *
	 * 変更と通知を必ず対で行うことが目的。通知を忘れると未保存フラグが立たず、
	 * 離脱警告もオートセーブも働かないまま編集内容が失われるため、
	 * データを書き換える処理は原則 mutateDocument を経由させる。
	 *
	 * @param {{ getCurrentData: () => any }} deps
	 */
	function createDocumentMutations(deps) {
		/**
		 * ドキュメント全体が差し替わった場合など、
		 * 変更処理を伴わずに通知だけ行いたい場合に使う。
		 */
		function notifyDocumentChanged() {
			document.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
		}

		/**
		 * 現在のドキュメントを変更し、変更通知を発火する。
		 * ドキュメント未読み込みの場合は何もせず false を返す。
		 * @param {(data: any) => void} mutator
		 * @returns {boolean} 変更を適用したかどうか
		 */
		function mutateDocument(mutator) {
			const data = deps.getCurrentData();
			if (!data || typeof data !== "object") {
				return false;
			}

			mutator(data);
			notifyDocumentChanged();
			return true;
		}

		return {
			mutateDocument,
			notifyDocumentChanged,
		};
	}

	/** @type {any} */ (globalObject).createDocumentMutations = createDocumentMutations;
})(window);
