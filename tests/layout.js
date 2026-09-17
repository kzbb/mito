// レイアウト回帰テスト。tests/smoke.js と同じPlaywright実行環境を使用する。
// NODE_PATH=/tmp/mito-test/node_modules node tests/layout.js
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
	const browser = await chromium.launch({ executablePath: process.env.MITO_CHROMIUM_EXECUTABLE || undefined });
	try {
		const page = await browser.newPage();
		page.on("dialog", (dialog) => dialog.accept());
		await page.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href);
		await page.setInputFiles("#json-file-input", path.resolve(__dirname, "../sample/sample_space_race.json"));
		await page.waitForFunction(() => currentData?.active?.length > 10);

		for (const size of [{ width: 1235, height: 694 }, { width: 1440, height: 900 }, { width: 900, height: 500 }]) {
			await page.setViewportSize(size);
			// Media-query change handlers run on the next rendering update.
			await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
			for (const collapsed of [false, true, false]) {
				const isCollapsed = await page.locator("#toggle-left-panel").getAttribute("aria-expanded") === "false";
				if (isCollapsed !== collapsed) await page.click(size.width < 1024 && collapsed ? "#close-left-panel" : "#toggle-left-panel");
				const layout = await page.evaluate(() => {
					window.scrollTo(0, 10000);
					document.body.scrollTop = 10000;
					const top = document.querySelector(".topbar").getBoundingClientRect();
					const footer = document.querySelector(".footer").getBoundingClientRect();
					const table = document.querySelector(".dashboard-table-wrap");
					table.scrollTop = 500;
					return {
						pageScroll: scrollY, bodyScroll: document.body.scrollTop,
						rootHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight,
						top: top.top, footerBottom: footer.bottom, tableScroll: table.scrollTop,
						lastRow: document.querySelector(".dashboard-table tbody tr:last-child").getBoundingClientRect().bottom,
					};
				});
				assert.equal(layout.pageScroll, 0, "ページ全体が縦スクロールしない");
				assert.equal(layout.bodyScroll, 0, "bodyも縦スクロールしない");
				assert.equal(layout.rootHeight, layout.viewportHeight, "画面の下に余分な領域を作らない");
				assert.equal(layout.top, 0, "操作バーを上端に保つ");
				assert.ok(Math.abs(layout.footerBottom - size.height) <= 16, "フッターを下端に保つ（横スクロールバーの高さを許容）");
				assert.ok(layout.tableScroll > 0 && layout.lastRow > size.height, "長い年表を内部スクロールできる");
				console.log(`OK ${size.width}x${size.height} 左パネル${collapsed ? "閉" : "開"}`);
			}
		}

		// 色選択はキーボードで操作でき、フォーカスしても外側へスクロールしない。
		await page.locator('input[name="color"][value="#ffffff"]').focus();
		await page.keyboard.press("ArrowRight");
		assert.ok(await page.locator('input[name="color"][value="#ffeef3"]').isChecked());
		assert.equal(await page.evaluate(() => scrollY + document.body.scrollTop), 0);
		console.log("OK 色選択のキーボード操作");

		await page.emulateMedia({ media: "print" });
		const print = await page.evaluate(() => ({
			height: document.querySelector(".app-layout").getBoundingClientRect().height,
			viewport: innerHeight,
			overflow: getComputedStyle(document.querySelector(".dashboard-table-wrap")).overflow,
		}));
		assert.ok(print.height > print.viewport, "印刷時は画面の高さで文書を切り捨てない");
		assert.equal(print.overflow, "visible");
		console.log("OK 印刷時は年表全体を展開");
	} finally {
		await browser.close();
	}
})().catch((error) => { console.error(error); process.exitCode = 1; });
