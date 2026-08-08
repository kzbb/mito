// @ts-check

(function registerFileDownload(globalObject) {
	/**
	 * テキストをファイルとしてダウンロードさせる。
	 *
	 * アンカーを一度DOMへ追加してからクリックする必要がある点に注意。
	 * 未追加のアンカーに対する click() は一部ブラウザ（Firefoxなど）で無視される。
	 * また revokeObjectURL はダウンロード開始前に呼ぶと転送が中断されるため、
	 * 次のタスクまで遅延させる。
	 *
	 * @param {string} text
	 * @param {string} mimeType
	 * @param {string} fileName
	 */
	function downloadTextFile(text, mimeType, fileName) {
		const blob = new Blob([text], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = fileName;
		anchor.rel = "noopener";
		anchor.style.display = "none";
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		window.setTimeout(() => {
			URL.revokeObjectURL(url);
		}, 0);
	}

	/** @type {any} */ (globalObject).downloadTextFile = downloadTextFile;
})(window);
