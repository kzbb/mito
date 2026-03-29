// @ts-check

(function registerLayout(globalObject) {
	/**
	 * カラム幅と左パネルの上下高さを変えるスプリッターのドラッグ操作を有効にする。
	 */
	function setupLayoutResizers() {
		enableColumnResize();
		enableLeftPaneResize();
	}

	/**
	 * 左カラムの幅を変えるスプリッターのドラッグを有効にする。
	 */
	function enableColumnResize() {
		const root = document.documentElement;
		const columns = /** @type {HTMLElement | null} */ (document.querySelector(".columns"));
		const leftSplitter = /** @type {HTMLElement | null} */ (document.querySelector(".splitter-left"));

		if (!columns || !leftSplitter) {
			return;
		}

		/** 左カラムの最小幅（px） */
		const MIN_LEFT = 240;
		/** メインエリアの最小幅（px）。左カラムがこれ以上広がらないよう制限する */
		const MIN_MAIN = 380;

		/**
		 * ドラッグ開始時に呼ばれる。pointermove / pointerup をドキュメント全体で購読し、
		 * 移動量に応じて CSS 変数 --left-width を更新する。
		 * @param {number} startX ドラッグ開始時の clientX
		 */
		const startDragging = (startX) => {
			const rect = columns.getBoundingClientRect();
			const leftStart = Number.parseFloat(getComputedStyle(root).getPropertyValue("--left-width"));

			/** @param {PointerEvent} event */
			const onMove = (event) => {
				const delta = event.clientX - startX;
				const maxLeft = rect.width - MIN_MAIN;
				const nextLeft = Math.min(Math.max(leftStart + delta, MIN_LEFT), maxLeft);
				root.style.setProperty("--left-width", `${nextLeft}px`);
			};

			// ドラッグ終了時にリスナーを解除し is-dragging クラスを外す
			const onUp = () => {
				leftSplitter.classList.remove("is-dragging");
				document.removeEventListener("pointermove", onMove);
				document.removeEventListener("pointerup", onUp);
			};

			document.addEventListener("pointermove", onMove);
			document.addEventListener("pointerup", onUp);
		};

		leftSplitter.addEventListener("pointerdown", /** @param {PointerEvent} event */ (event) => {
			leftSplitter.classList.add("is-dragging");
			startDragging(event.clientX);
		});
	}

	/**
	 * 左パネル内の水平スプリッターのドラッグを有効にする。
	 * また、データ読み込み時に下ペインが全表示されるよう高さを自動調整する。
	 * ユーザーが一度でも手動でスプリッターを動かした後は自動調整を行わない。
	 */
	function enableLeftPaneResize() {
		const root = document.documentElement;
		const leftWindow = /** @type {HTMLElement | null} */ (document.querySelector(".left-window"));
		const paneSplitter = /** @type {HTMLElement | null} */ (document.querySelector(".left-pane-splitter"));

		if (!leftWindow || !paneSplitter) {
			return;
		}

		/** ツリーペインの最小高さ（px） */
		const MIN_TOP = 170;
		/** フォームペインの最小高さ（px）。ツリーがこれ以上伸びないよう制限する */
		const MIN_BOTTOM = 190;

		/**
		 * ユーザーが手動でスプリッターを操作したかどうか。
		 * true になると mito:data-changed による自動調整を停止する。
		 */
		let userHasResized = false;

		/**
		 * 下ペインのコンテンツが全て表示されるよう --left-top-height を調整する。
		 * 上ペインは最低 3rem の高さを確保する。
		 */
		const adjustSplitToFormHeight = () => {
			requestAnimationFrame(() => {
				const bottomPane = /** @type {HTMLElement | null} */ (document.querySelector(".bottom-pane"));
				if (!bottomPane) {
					return;
				}

				const splitterHeight = Number.parseFloat(getComputedStyle(root).getPropertyValue("--left-pane-splitter-height")) || 6;
				const minTopPx = 3 * Number.parseFloat(getComputedStyle(root).fontSize);

				// left-window の padding を除いた実際にグリッドに使える高さ
				const windowStyle = getComputedStyle(leftWindow);
				const windowPaddingY = (Number.parseFloat(windowStyle.paddingTop) || 0)
					+ (Number.parseFloat(windowStyle.paddingBottom) || 0);
				const availableHeight = leftWindow.getBoundingClientRect().height - windowPaddingY;

				// bottom-pane の内在的なコンテンツ高さを子要素から計算する。
				// bottomPane.scrollHeight は 1fr で大きなスペースが割り当てられている場合に
				// clientHeight と同値になるため、内在高さを正しく返さない。
				const paneStyle = getComputedStyle(bottomPane);
				const panePaddingY = (Number.parseFloat(paneStyle.paddingTop) || 0)
					+ (Number.parseFloat(paneStyle.paddingBottom) || 0);
				let childrenHeight = 0;
				for (const child of bottomPane.children) {
					const childStyle = getComputedStyle(child);
					childrenHeight += child.offsetHeight
						+ (Number.parseFloat(childStyle.marginTop) || 0)
						+ (Number.parseFloat(childStyle.marginBottom) || 0);
				}
				const bottomContentHeight = panePaddingY + childrenHeight　* 1.01; // 予備スペースとして1%増し

				const desiredTop = availableHeight - splitterHeight - bottomContentHeight;
				const topHeight = Math.max(minTopPx, desiredTop);
				root.style.setProperty("--left-top-height", `${topHeight}px`);
			});
		};

		// データ読み込みのたびに自動調整（ユーザーが手動操作するまで）
		document.addEventListener("mito:data-changed", () => {
			if (!userHasResized) {
				adjustSplitToFormHeight();
			}
		});

		/**
		 * ドラッグ開始時に呼ばれる。pointermove / pointerup をドキュメント全体で購読し、
		 * 移動量に応じて CSS 変数 --left-top-height を更新する。
		 * @param {number} startY ドラッグ開始時の clientY
		 */
		const startDragging = (startY) => {
			const rect = leftWindow.getBoundingClientRect();
			const splitterHeight = Number.parseFloat(getComputedStyle(root).getPropertyValue("--left-pane-splitter-height")) || 6;
			// --left-top-height が未設定の場合は高さの55%をデフォルトとして使う
			const topStartRaw = Number.parseFloat(getComputedStyle(root).getPropertyValue("--left-top-height"));
			const topStart = Number.isFinite(topStartRaw) && topStartRaw > 0 ? topStartRaw : rect.height * 0.55;

			/** @param {PointerEvent} event */
			const onMove = (event) => {
				const delta = event.clientY - startY;
				const maxTop = Math.max(MIN_TOP, rect.height - splitterHeight - MIN_BOTTOM);
				const nextTop = Math.min(Math.max(topStart + delta, MIN_TOP), maxTop);
				root.style.setProperty("--left-top-height", `${nextTop}px`);
			};

			// ドラッグ終了時にリスナーを解除し is-dragging クラスを外す
			const onUp = () => {
				paneSplitter.classList.remove("is-dragging");
				document.removeEventListener("pointermove", onMove);
				document.removeEventListener("pointerup", onUp);
			};

			document.addEventListener("pointermove", onMove);
			document.addEventListener("pointerup", onUp);
		};

		paneSplitter.addEventListener("pointerdown", /** @param {PointerEvent} event */ (event) => {
			userHasResized = true;
			paneSplitter.classList.add("is-dragging");
			startDragging(event.clientY);
		});
	}

	/** @type {any} */ (globalObject).setupLayoutResizers = setupLayoutResizers;
})(window);
