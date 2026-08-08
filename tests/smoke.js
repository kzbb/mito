// @ts-nocheck
//
// 主要フローをヘッドレスChromiumで通すスモークテスト。
// 「データを変更したのに未保存フラグが立たない」類の回帰を検出することが主目的。
//
// playwright が必要（リポジトリ自体はビルド不要のまま保つため、依存は入れていない）:
//
//   mkdir -p /tmp/mito-test && cd /tmp/mito-test
//   npm init -y && npm i playwright && npx playwright install chromium
//   NODE_PATH=/tmp/mito-test/node_modules node /path/to/mito/tests/smoke.js
//
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const repo = path.join(__dirname, "..");
const url = "file://" + path.join(repo, "index.html");

let failures = 0;
function check(label, ok, detail) {
	console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
	if (!ok) failures++;
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();

	const errors = [];
	page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
	page.on("console", (m) => {
		if (m.type() === "error") errors.push("console.error: " + m.text());
	});
	// 起動時の下書き復元だけ「キャンセル」、
	// 「未保存の変更を破棄して続行しますか」系は「OK」を返す
	const dialogs = [];
	page.on("dialog", (d) => {
		dialogs.push(d.message());
		if (d.message().includes("下書き")) {
			d.dismiss();
		} else {
			d.accept();
		}
	});

	await page.goto(url);
	await page.evaluate(() => localStorage.clear());
	await page.waitForTimeout(300);

	// --- モジュールが全部読み込めているか ---
	const globals = await page.evaluate(() => [
		"createAppModuleInitializers", "createDataModel",
		"createPersistenceModule", "createAppOutlineView", "createAppDocumentActions",
		"createRendererComposer", "createTreeRenderer", "createEntryFormModule",
		"createDocumentMutations", "downloadTextFile", "createCalendarUtils",
		"createMarkdownEngine", "createRendererFallbacks", "nowJST",
		"createShareLinkModule", "createAppShareActions",
	].filter((n) => typeof window[n] !== "function"));
	check("全モジュールがグローバル登録済み", globals.length === 0, globals.length ? `未登録: ${globals}` : "");

	// --- 新規作成 ---
	await page.click("#new-file");
	await page.waitForTimeout(200);
	check("新規作成でダッシュボードが出る", await page.locator(".main-window h2").count() > 0,
		await page.locator(".main-window h2").first().textContent());

	// --- 左パネルの開閉 ---
	await page.click("#toggle-left-panel");
	check("左パネルを閉じられる", await page.locator(".columns.is-left-panel-collapsed").count() === 1);
	await page.click("#toggle-left-panel");
	check("左パネルを再表示できる", await page.locator(".columns.is-left-panel-collapsed").count() === 0);

	const dirty = () => page.evaluate(() => ({ isDirty, status: document.getElementById("topbar-save-status").textContent }));

	// --- showOpenFilePicker 経路: ハンドルを保持し、上書き保存できること ---
	{
		const sample = fs.readFileSync(path.join(repo, "sample/sample_rubric-1.json"), "utf8");
		const pickerResult = await page.evaluate(async (text) => {
			const written = [];
			let permissionAsked = 0;
			const handle = {
				name: "picked.json",
				// showOpenFilePicker のハンドルは読み取り専用で始まる
				queryPermission: async () => "prompt",
				requestPermission: async () => { permissionAsked += 1; return "granted"; },
				getFile: async () => new File([text], "picked.json", { type: "application/json" }),
				createWritable: async () => ({
					write: async (t) => { written.push(t); },
					close: async () => {},
				}),
			};
			window.showOpenFilePicker = async () => [handle];
			// 保存先ダイアログが呼ばれたら失敗とみなせるようにする
			let savePickerCalls = 0;
			const realSavePicker = window.showSaveFilePicker;
			window.showSaveFilePicker = async (...args) => { savePickerCalls += 1; return realSavePicker?.(...args); };

			document.getElementById("open-file").click();
			await new Promise((r) => setTimeout(r, 400));
			const handleKept = currentFileHandle === handle;

			currentData.project = "上書きテスト";
			await saveCurrentData();
			await new Promise((r) => setTimeout(r, 200));

			return {
				handleKept,
				savePickerCalls,
				permissionAsked,
				writeCount: written.length,
				wroteProject: written.length > 0 ? JSON.parse(written[0]).project : null,
				isDirtyAfter: isDirty,
				status: document.getElementById("topbar-save-status").textContent,
			};
		}, sample);
		check("showOpenFilePicker でハンドルを保持する", pickerResult.handleKept === true, JSON.stringify(pickerResult));
		check("書き込み権限を昇格させる", pickerResult.permissionAsked === 1, `requestPermission ${pickerResult.permissionAsked}回`);
		check("保存先を聞かずに上書きする", pickerResult.savePickerCalls === 0, `showSaveFilePicker ${pickerResult.savePickerCalls}回`);
		check("開いたファイルへ書き込まれる", pickerResult.writeCount === 1 && pickerResult.wroteProject === "上書きテスト",
			JSON.stringify(pickerResult));
		check("上書き保存後は未保存フラグが下がる", pickerResult.isDirtyAfter === false, pickerResult.status);
	}

	// 権限が拒否された場合は保存先の指定へフォールバックする
	{
		const fallbackResult = await page.evaluate(async () => {
			let savePickerCalls = 0;
			currentFileHandle = {
				name: "denied.json",
				queryPermission: async () => "denied",
				requestPermission: async () => "denied",
				createWritable: async () => { throw new Error("should not be called"); },
			};
			window.showSaveFilePicker = async () => {
				savePickerCalls += 1;
				return {
					name: "fallback.json",
					createWritable: async () => ({ write: async () => {}, close: async () => {} }),
				};
			};
			currentData.project = "権限拒否テスト";
			// boolean を返すのは persistence 側（app.js のラッパーは戻り値を持たない）
			const ok = await persistenceApi.saveCurrentData();
			return { ok, savePickerCalls, handleReplaced: currentFileHandle?.name === "fallback.json" };
		});
		check("権限が拒否されたら保存先の指定へ退避する",
			fallbackResult.ok === true && fallbackResult.savePickerCalls === 1, JSON.stringify(fallbackResult));
		check("退避後は新しいハンドルに差し替わる", fallbackResult.handleReplaced === true);
	}

	// --- 隠しファイル入力の経路（showOpenFilePicker 未対応環境相当）---
	await page.evaluate(() => { delete window.showOpenFilePicker; });
	await page.setInputFiles("#json-file-input", path.join(repo, "sample/sample_space_race.json"));
	await page.waitForTimeout(500);
	check("入力要素経路ではハンドルを持たない",
		await page.evaluate(() => currentFileHandle) === null);
	const afterLoad = await dirty();
	check("読み込み直後は未変更(isDirty=false)", afterLoad.isDirty === false, JSON.stringify(afterLoad));
	const cardCount = await page.locator(".dashboard-entry-card").count();
	check("年表にカードが描画される", cardCount > 0, `${cardCount}枚`);

	// --- 保存済み状態を作る（isDirty=false にリセット） ---
	await page.evaluate(() => { setDirty(false); });

	// ============ ここが今回の本題: 設定画面の変更 ============
	await page.click("#outline-settings");
	await page.waitForTimeout(200);
	check("設定画面が開く", await page.locator(".settings-view").count() > 0);

	// プロジェクト名を変更
	await page.fill('.settings-value-input[aria-label="project"]', "改名テスト");
	await page.waitForTimeout(100);
	const afterProject = await dirty();
	check("プロジェクト名の変更で未保存になる", afterProject.isDirty === true, JSON.stringify(afterProject));
	check("データにも反映されている",
		await page.evaluate(() => currentData.project) === "改名テスト");

	// settings の他の値（dashboardLabel）を変更
	await page.evaluate(() => { setDirty(false); });
	const labelInput = page.locator('.settings-value-input[aria-label="dashboardLabel"]');
	if (await labelInput.count() > 0) {
		await labelInput.fill("年代記");
		await page.waitForTimeout(100);
		const afterLabel = await dirty();
		check("settings値の変更で未保存になる", afterLabel.isDirty === true, JSON.stringify(afterLabel));
		check("dashboardLabelがデータに入る",
			await page.evaluate(() => currentData.settings.dashboardLabel) === "年代記");
	} else {
		check("dashboardLabel入力欄が存在する", false, "見つからない");
	}

	// --- オートセーブのスナップショットが書かれるか（デバウンス1200ms） ---
	await page.waitForTimeout(1600);
	const snap = await page.evaluate(() => {
		const raw = localStorage.getItem("mito:autosave:v1");
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		return { project: parsed?.data?.project, label: parsed?.data?.settings?.dashboardLabel };
	});
	check("設定変更がオートセーブされる", snap !== null && snap.project === "改名テスト", JSON.stringify(snap));

	// ============ 完全削除 ============
	// 入力欄でカードを編集状態にし、削除済みへ送る
	await page.click('[data-role="dashboard"]');
	await page.locator(".dashboard-entry-card").first().click();
	await page.waitForTimeout(200);
	check("編集中は入力欄に削除ボタンが出る", await page.locator("#delete-entry:visible").count() === 1);
	check("個別ページへ遷移しない", await page.locator(".entry-wiki").count() === 0);
	await page.click("#delete-entry");
	await page.waitForTimeout(300);
	const deletedCount = await page.evaluate(() => currentData.deleted.length);
	check("削除で deleted に移動する", deletedCount === 1, `${deletedCount}件`);

	await page.click("#outline-settings");
	await page.waitForTimeout(200);
	await page.evaluate(() => { setDirty(false); });
	await page.click(".settings-archived-delete");
	await page.waitForTimeout(200);
	const afterPurge = await dirty();
	check("完全削除で未保存になる", afterPurge.isDirty === true, JSON.stringify(afterPurge));
	check("deleted が空になる", await page.evaluate(() => currentData.deleted.length) === 0);

	// ============ カレンダー編集 + 保存後の参照ずれ ============
	await page.click(".settings-calendar-button");
	await page.waitForTimeout(300);
	check("カレンダー編集が開く", await page.locator(".calendar-grid").count() > 0);

	// 保存の「成功パス」を確実に通すため showSaveFilePicker を差し替える。
	// ヘッドレスでは本物はユーザー操作を要求して失敗するため、
	// スタブなしでは保存完了後の挙動を検証できない。
	const saveResult = await page.evaluate(async () => {
		let written = "";
		window.showSaveFilePicker = async () => ({
			name: "smoke.json",
			createWritable: async () => ({
				write: async (text) => { written = text; },
				close: async () => {},
			}),
		});
		const before = currentData;
		const ok = await persistenceApi.saveCurrentData();
		return {
			ok,
			sameObject: before === currentData,
			isDirtyAfter: isDirty,
			wroteBytes: written.length,
			updatedAtBumped: JSON.parse(written).updatedAt === currentData.updatedAt,
		};
	});
	check("保存が成功する", saveResult.ok === true, JSON.stringify(saveResult));
	check("保存でファイルに書き込まれる", saveResult.wroteBytes > 100, `${saveResult.wroteBytes}バイト`);
	check("保存で currentData が差し替わらない", saveResult.sameObject === true);
	check("保存した内容と updatedAt が一致する", saveResult.updatedAtBumped === true);
	// app.js 側の後処理（isDirty=false / スナップショット破棄）も通す
	await page.evaluate(async () => { await saveCurrentData(); });
	await page.waitForTimeout(200);
	const afterSave = await dirty();
	check("保存後は未保存フラグが下がる", afterSave.isDirty === false, JSON.stringify(afterSave));
	check("保存後にオートセーブが破棄される",
		await page.evaluate(() => localStorage.getItem("mito:autosave:v1")) === null);

	// 保存直前の変更で予約されたデバウンスタイマーが、保存後に発火して
	// スナップショットを書き戻さないこと（次回起動の余計な復元確認を防ぐ）
	const raceResult = await page.evaluate(async () => {
		localStorage.removeItem("mito:autosave:v1");
		document.dispatchEvent(new CustomEvent("mito:data-changed")); // タイマー予約
		await saveCurrentData();
		await new Promise((r) => setTimeout(r, 1600)); // デバウンス時間を超えて待つ
		return localStorage.getItem("mito:autosave:v1");
	});
	check("保存後にタイマーがスナップショットを書き戻さない", raceResult === null,
		raceResult === null ? "" : "書き戻された");
	await page.waitForTimeout(200);

	// 保存後にセルを編集し、currentData に届くか
	const cell = page.locator(".calendar-cell-input").first();
	await cell.fill("保存後編集");
	await page.waitForTimeout(200);
	const reachedDocument = await page.evaluate(() =>
		(currentData.calendar?.csvText || "").startsWith("保存後編集"));
	check("保存後のカレンダー編集が currentData に反映される", reachedDocument,
		await page.evaluate(() => (currentData.calendar?.csvText || "").slice(0, 30)));
	const afterCell = await dirty();
	check("カレンダー編集で未保存になる", afterCell.isDirty === true, JSON.stringify(afterCell));

	// ============ エントリー追加とリアルタイム編集 ============
	await page.evaluate(() => {
		const main = document.querySelector(".main-window");
		rendererApi.renderDashboardOverview(main, currentData);
		formApi.setFormModeAdd();
	});
	await page.waitForTimeout(200);
	await page.fill("#category-select", "ソ連");
	await page.fill('input[name="name"]', "スモークテスト項目");
	await page.fill('textarea[name="description"]', "本文 `code` と **強調**");
	await page.click("#preview-entry");
	await page.waitForTimeout(300);
	const added = await page.evaluate(() =>
		currentData.active.some((e) => e.name === "スモークテスト項目"));
	check("エントリーを追加できる", added);

	// 追加直後は編集状態にせず追加モードへ戻る（続けて次のカードを入力できる）
	check("追加後は編集モードに入らない",
		await page.evaluate(() => editingEntryId) === null,
		`editingEntryId=${await page.evaluate(() => editingEntryId)}`);
	check("追加後は入力欄がクリアされる",
		await page.evaluate(() => document.querySelector('input[name="name"]').value) === "");

	// 追加したカードを選び直してから、リアルタイム編集を確認する
	// （ダッシュボードのカードを mousedown したときと同じ経路）
	await page.evaluate(() => {
		const entry = currentData.active.find((e) => e.name === "スモークテスト項目");
		formApi.enterEditMode(entry);
	});
	await page.waitForTimeout(200);
	check("カード選択で編集モードに入る",
		await page.evaluate(() => editingEntryId) !== null);
	check("編集モードで入力パネルに状態クラスが付く",
		await page.evaluate(() => document.querySelector(".bottom-pane")?.classList.contains("is-editing-entry")) === true);

	await page.fill('input[name="name"]', "スモークテスト項目2");
	await page.waitForTimeout(300);
	const renamed = await page.evaluate(() =>
		currentData.active.some((e) => e.name === "スモークテスト項目2"));
	check("リアルタイム編集が反映される", renamed);

	// Escキーで追加モードへ抜けられる
	await page.locator('input[name="name"]').press("Escape");
	await page.waitForTimeout(300);
	check("Escキーで編集モードを抜ける",
		await page.evaluate(() => editingEntryId) === null,
		`editingEntryId=${await page.evaluate(() => editingEntryId)}`);
	check("編集モードを抜けると状態クラスが外れる",
		await page.evaluate(() => document.querySelector(".bottom-pane")?.classList.contains("is-editing-entry")) === false);

	// ============ フォーカスチップ ============
	await page.evaluate(() => {
		const main = document.querySelector(".main-window");
		rendererApi.renderDashboardOverview(main, currentData);
	});
	await page.waitForTimeout(200);
	const chips = page.locator(".dashboard-focus-chip");
	const chipCount = await chips.count();
	if (chipCount > 1) {
		await page.evaluate(() => { setDirty(false); });
		await chips.nth(1).click();
		await page.waitForTimeout(300);
		const afterChip = await dirty();
		check("フォーカス切替で未保存になる", afterChip.isDirty === true, JSON.stringify(afterChip));
	} else {
		check("フォーカスチップが2つ以上ある", false, `${chipCount}個`);
	}

	// ============ Markdown が描画されているか ============
	await page.evaluate(() => {
		const main = document.querySelector(".main-window");
		const entry = currentData.active.find((e) => e.name === "スモークテスト項目2");
		rendererApi.renderEntryDetail(main, entry);
	});
	await page.waitForTimeout(200);
	const html = await page.locator(".entry-description").first().innerHTML();
	check("インラインコードが<code>になる", html.includes("<code>code</code>"), html.slice(0, 120));
	check("強調が<strong>になる", html.includes("<strong>強調</strong>"));
	check("プレースホルダが漏れていない", !html.includes("MITO_CODE"));

	// ============ 共有リンク ============
	// 外部への通信はテストの前提にしたくないので fetch を差し替える。
	// URL変換と圧縮の中身は tests/unit.js が見ているため、ここでは
	// 「取得したものが通常の読み込み経路へ流れるか」だけを確かめる。
	{
		const shared = await page.evaluate(async () => {
			const realFetch = window.fetch;
			let requestedUrl = "";
			window.fetch = async (input) => {
				requestedUrl = String(input);
				return new Response(JSON.stringify({
					project: "共有ドキュメント",
					calendar: { csvText: "年\n1900\n" },
					active: [{ id: 1, category: "出来事", name: "共有エントリー", dateCalendar: { 年: "1900" } }],
				}), { status: 200, headers: { "content-type": "application/json" } });
			};

			setDirty(false);
			const ok = await shareActionsApi.loadFromSourceUrl(
				"https://github.com/kzbb/mito/blob/main/sample/a.json", { confirmBeforeFetch: false });
			window.fetch = realFetch;

			return {
				ok,
				requestedUrl,
				project: currentData?.project,
				entries: currentData?.active?.length,
				isDirty,
				handle: currentFileHandle,
				fileName: currentFileName,
				cards: document.querySelectorAll(".dashboard-entry-card").length,
			};
		});
		check("共有リンク: 取得したJSONが開く",
			shared.ok === true && shared.project === "共有ドキュメント", JSON.stringify(shared));
		check("共有リンク: 変換後のURLを取りに行く",
			shared.requestedUrl === "https://raw.githubusercontent.com/kzbb/mito/main/sample/a.json", shared.requestedUrl);
		check("共有リンク: 通常の読み込みと同じく描画される", shared.cards > 0, `${shared.cards}枚`);
		check("共有リンク: 読み込み直後は未変更", shared.isDirty === false);
		// ハンドルが無いので、保存すると必ず保存先を聞かれる（他人のファイルを上書きしない）
		check("共有リンク: ファイルハンドルを持たない", shared.handle === null);
		check("共有リンク: ファイル名がURLから決まる", shared.fileName === "a.json", shared.fileName);
	}

	// CORS拒否は fetch の TypeError としてしか観測できない。
	// 「原因は置き場所の制約である」と伝わるかを確かめる。
	{
		const blocked = await page.evaluate(async () => {
			const realFetch = window.fetch;
			window.fetch = async () => { throw new TypeError("Failed to fetch"); };
			const ok = await shareActionsApi.loadFromSourceUrl(
				"https://example.com/a.json", { confirmBeforeFetch: false });
			window.fetch = realFetch;
			return { ok, status: document.getElementById("footer-status").textContent };
		});
		check("共有リンク: CORS拒否の理由が説明される",
			blocked.ok === false && blocked.status.includes("CORS"), blocked.status);

		// Googleドライブは非公開ファイルも存在しないファイルも404を返すため、
		// 最も起きやすい失敗（共有設定の変更忘れ）へ誘導できているか確かめる
		const driveNotFound = await page.evaluate(async () => {
			const realFetch = window.fetch;
			const realKey = window.MITO_CONFIG.googleDriveApiKey;
			window.MITO_CONFIG.googleDriveApiKey = "TEST_KEY";
			window.fetch = async () => new Response("{}", { status: 404 });
			const ok = await shareActionsApi.loadFromSourceUrl(
				"https://drive.google.com/file/d/ABC/view?usp=sharing", { confirmBeforeFetch: false });
			window.fetch = realFetch;
			window.MITO_CONFIG.googleDriveApiKey = realKey;
			return { ok, status: document.getElementById("footer-status").textContent };
		});
		check("共有リンク: ドライブの404は共有設定の確認へ誘導する",
			driveNotFound.ok === false && driveNotFound.status.includes("リンクを知っている全員"),
			driveNotFound.status);

		// 取得失敗をコンソールへ出すのは意図した動作なので、最後の検査からは除く
		for (let i = errors.length - 1; i >= 0; i -= 1) {
			if (errors[i].includes("Failed to fetch shared document")) {
				errors.splice(i, 1);
			}
		}
	}

	// 埋め込みモード: ダイアログで生成したURLを、そのまま読み戻せるか
	{
		const inline = await page.evaluate(async () => {
			document.getElementById("share-document").click();
			// 埋め込みモードは既定で畳まれている（補助的な方法として扱っているため）
			const section = document.getElementById("share-inline-section");
			const collapsedOnOpen = section.open === false;
			section.open = true;
			document.getElementById("share-inline-build").click();
			await new Promise((r) => setTimeout(r, 500));
			const shareUrl = document.getElementById("share-inline-output").value;
			document.getElementById("share-dialog").close();

			const encoded = new URLSearchParams(new URL(shareUrl).hash.slice(1)).get("d");
			currentData.project = "上書きされるはず";
			const ok = await shareActionsApi.loadFromInlineData(encoded);
			return {
				ok, collapsedOnOpen,
				dialogOpened: shareUrl.includes("#d="),
				length: shareUrl.length,
				project: currentData?.project,
			};
		});
		check("共有リンク: 埋め込みモードは既定で畳まれている", inline.collapsedOnOpen === true);
		check("共有リンク: 埋め込みモードのURLを生成できる",
			inline.dialogOpened === true, `${inline.length}文字`);
		check("共有リンク: 埋め込んだドキュメントを読み戻せる",
			inline.ok === true && inline.project === "共有ドキュメント", JSON.stringify(inline));
	}

	// ============ エラーが出ていないか ============
	check("コンソールエラーなし", errors.length === 0, errors.slice(0, 5).join(" | "));

	await browser.close();
	console.log(failures === 0 ? "\n全チェック通過" : `\n${failures}件 失敗`);
	process.exit(failures === 0 ? 0 : 1);
})();
