// @ts-check

(function registerLayout(globalObject) {
	/**
	 * Enable dragging splitters for column width and left pane top/bottom height.
	 */
	function setupLayoutResizers() {
		enableColumnResize();
		enableLeftPaneResize();
	}

	/**
	 * Enable dragging the splitter to resize the left column.
	 */
	function enableColumnResize() {
		const root = document.documentElement;
		const columns = /** @type {HTMLElement | null} */ (document.querySelector(".columns"));
		const leftSplitter = /** @type {HTMLElement | null} */ (document.querySelector(".splitter-left"));

		if (!columns || !leftSplitter) {
			return;
		}

		const MIN_LEFT = 240;
		const MIN_MAIN = 380;

		/** @param {number} startX */
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
	 * Enable dragging the horizontal splitter inside the left panel.
	 */
	function enableLeftPaneResize() {
		const root = document.documentElement;
		const leftWindow = /** @type {HTMLElement | null} */ (document.querySelector(".left-window"));
		const paneSplitter = /** @type {HTMLElement | null} */ (document.querySelector(".left-pane-splitter"));

		if (!leftWindow || !paneSplitter) {
			return;
		}

		const MIN_TOP = 170;
		const MIN_BOTTOM = 190;

		/** @param {number} startY */
		const startDragging = (startY) => {
			const rect = leftWindow.getBoundingClientRect();
			const splitterHeight = Number.parseFloat(getComputedStyle(root).getPropertyValue("--left-pane-splitter-height")) || 6;
			const topStartRaw = Number.parseFloat(getComputedStyle(root).getPropertyValue("--left-top-height"));
			const topStart = Number.isFinite(topStartRaw) && topStartRaw > 0 ? topStartRaw : rect.height * 0.55;

			/** @param {PointerEvent} event */
			const onMove = (event) => {
				const delta = event.clientY - startY;
				const maxTop = Math.max(MIN_TOP, rect.height - splitterHeight - MIN_BOTTOM);
				const nextTop = Math.min(Math.max(topStart + delta, MIN_TOP), maxTop);
				root.style.setProperty("--left-top-height", `${nextTop}px`);
			};

			const onUp = () => {
				paneSplitter.classList.remove("is-dragging");
				document.removeEventListener("pointermove", onMove);
				document.removeEventListener("pointerup", onUp);
			};

			document.addEventListener("pointermove", onMove);
			document.addEventListener("pointerup", onUp);
		};

		paneSplitter.addEventListener("pointerdown", /** @param {PointerEvent} event */ (event) => {
			paneSplitter.classList.add("is-dragging");
			startDragging(event.clientY);
		});
	}

	/** @type {any} */ (globalObject).setupLayoutResizers = setupLayoutResizers;
})(window);
