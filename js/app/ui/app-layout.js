// @ts-check

(function registerLayout(globalObject) {
	/**
	 * カラム幅と左パネルの上下高さを変えるスプリッターのドラッグ操作を有効にする。
	 */
	function setupLayoutResizers() {
		setupLeftPanelToggle();
		enableColumnResize();
		enableLeftPaneResize();
	}

	/** 画面幅ごとに開閉状態を保持し、狭い画面ではモーダルのドロワーにする。 */
	function setupLeftPanelToggle() {
		const columns = document.querySelector(".columns");
		const panel = document.getElementById("left-panel");
		const button = document.getElementById("toggle-left-panel");
		const backdrop = document.getElementById("panel-backdrop");
		const close = document.getElementById("close-left-panel");
		const main = /** @type {HTMLElement | null} */ (document.querySelector(".main-window"));
		const topbar = /** @type {HTMLElement | null} */ (document.querySelector(".topbar"));
		if (!columns || !panel || !button || !backdrop || !close || !main || !topbar) return;
		const compact = matchMedia("(max-width: 1023px)");
		let desktopOpen = true;
		try { desktopOpen = localStorage.getItem("mito.sidebar.open") !== "false"; } catch (_) { /* Storage may be disabled. */ }
		let compactOpen = false;
		/** @type {HTMLElement | null} */
		let returnFocus = null;
		const isOpen = () => compact.matches ? compactOpen : desktopOpen;
		const applyState = () => {
			const open = isOpen();
			const modal = compact.matches && open;
			columns.classList.toggle("is-left-panel-collapsed", !open);
			panel.inert = !open;
			panel.setAttribute("aria-hidden", String(!open));
			button.setAttribute("aria-expanded", String(open));
			const label = open ? "サイドパネルを閉じる" : "サイドパネルを開く";
			button.setAttribute("aria-label", label);
			button.title = label;
			backdrop.hidden = !modal;
			main.inert = modal;
			topbar.inert = modal;
			if (modal) {
				panel.setAttribute("role", "dialog");
				panel.setAttribute("aria-modal", "true");
			} else {
				panel.removeAttribute("role");
				panel.removeAttribute("aria-modal");
			}
		};
		/** @param {boolean} open */
		const setOpen = (open) => {
			if (open && !isOpen()) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : button;
			if (compact.matches) compactOpen = open;
			else {
				desktopOpen = open;
				try { localStorage.setItem("mito.sidebar.open", String(open)); } catch (_) { /* Optional preference. */ }
			}
			applyState();
			if (compact.matches && open) close.focus();
			else if (!open) (returnFocus?.isConnected ? returnFocus : button).focus();
		};
		button.addEventListener("click", () => setOpen(!isOpen()));
		close.addEventListener("click", () => setOpen(false));
		backdrop.addEventListener("click", () => setOpen(false));
		document.addEventListener("mito:open-panel", () => {
			setOpen(true);
			if (compact.matches) {
				const input = /** @type {HTMLElement | null} */ (panel.querySelector('input[name="name"]'));
				input?.focus({ preventScroll: true });
				input?.scrollIntoView({ block: "center" });
			}
		});
		document.addEventListener("mito:close-panel", () => { if (compact.matches && isOpen()) setOpen(false); });
		document.addEventListener("keydown", (event) => {
			if (!compact.matches || !isOpen()) return;
			if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
			if (event.key !== "Tab") return;
			const items = Array.from(panel.querySelectorAll('button, a[href], input, textarea, select, [tabindex="0"]'))
				.filter((item) => item instanceof HTMLElement && item.getClientRects().length && !item.hasAttribute("disabled"));
			const first = /** @type {HTMLElement | undefined} */ (items[0]);
			const last = /** @type {HTMLElement | undefined} */ (items[items.length - 1]);
			if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
			else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
		});
		compact.addEventListener("change", () => {
			applyState();
			if (compact.matches && isOpen()) close.focus();
			else if ((!isOpen() && panel.contains(document.activeElement)) || document.activeElement === close) button.focus();
		});
		applyState();
		setupTopbarMenu();
	}

	function setupTopbarMenu() {
		const phone = matchMedia("(max-width: 639px)");
		const fileActions = document.getElementById("file-actions");
		const mobileActions = document.getElementById("mobile-file-actions");
		const share = document.getElementById("share-document");
		const settings = document.getElementById("outline-settings");
		const status = document.getElementById("topbar-save-status");
		if (!fileActions || !mobileActions || !share || !settings || !status) return;
		const fileButtons = Array.from(fileActions.children);
		const menus = ["file-menu-toggle", "topbar-menu-toggle"].map(id => {
			const button = document.getElementById(id);
			const popup = document.getElementById(button?.getAttribute("aria-controls") ?? "");
			return { button, popup };
		});
		const closeAll = () => {
			for (const {button, popup} of menus) {
				if (!button || !popup) continue;
				popup.hidden = true;
				button.setAttribute("aria-expanded", "false");
			}
		};
		for (const {button, popup} of menus) {
			if (!button || !popup) continue;
			button.addEventListener("click", () => {
				const open = popup.hidden;
				closeAll();
				popup.hidden = !open;
				button.setAttribute("aria-expanded", String(open));
			});
			button.parentElement?.addEventListener("focusout", () => {
				setTimeout(() => {
					if (!button.parentElement?.contains(document.activeElement)) {
						popup.hidden = true;
						button.setAttribute("aria-expanded", "false");
					}
				}, 0);
			});
		}
		document.addEventListener("click", event => {
			if (!(event.target instanceof Node)) return;
			if (menus.some(({button}) => button?.contains(/** @type {Node} */ (event.target)))) return;
			for (const {button, popup} of menus) {
				if (!popup?.hidden && popup?.contains(document.activeElement)) button?.focus();
			}
			closeAll();
		});
		document.addEventListener("keydown", event => {
			if (event.key !== "Escape") return;
			for (const {button, popup} of menus) if (popup && !popup.hidden) button?.focus();
			closeAll();
		});
		const arrange = () => {
			const focused = document.activeElement;
			if (menus.some(({popup}) => popup?.contains(focused)) || focused === share || focused === settings || focused === menus[0].button) {
				menus[1].button?.focus();
			}
			closeAll();
			for (const button of fileButtons) (phone.matches ? mobileActions : fileActions).appendChild(button);
			if (phone.matches) mobileActions.append(share, settings);
			else status.before(share, settings);
		};
		phone.addEventListener("change", arrange);
		arrange();
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
					if (!(child instanceof HTMLElement)) {
						continue;
					}

					const childStyle = getComputedStyle(child);
					childrenHeight += child.offsetHeight
						+ (Number.parseFloat(childStyle.marginTop) || 0)
						+ (Number.parseFloat(childStyle.marginBottom) || 0);
				}
				const bottomContentHeight = panePaddingY + childrenHeight * 1.01; // 予備スペースとして1%増し

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
