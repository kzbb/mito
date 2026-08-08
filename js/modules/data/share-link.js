// @ts-check

(function registerShareLink(globalObject) {
	/**
	 * 共有URLの組み立てと解釈。
	 *
	 * MITOはサーバーを持たないので、共有手段は2つある。
	 *
	 *   1. 参照モード `?src=<JSONのURL>`
	 *      どこかに置いたJSONを、開いた側のブラウザが直接取りに行く。
	 *      取得元が `Access-Control-Allow-Origin` を返さないと読めないため、
	 *      主要な置き場所については取得可能な形へURLを変換する。
	 *
	 *   2. 埋め込みモード `#d=<gzip+base64urlのJSON>`
	 *      JSON本体をURLのフラグメントに入れる。取得先が存在しないので
	 *      CORSとも取得元の寿命とも無縁だが、URLが長くなる。
	 *
	 * このモジュールはDOMもfetchも触らない。URL文字列とバイト列だけを扱う。
	 *
	 * @param {{ getGoogleDriveApiKey: () => string }} deps
	 */
	function createShareLinkModule(deps) {
		/**
		 * @typedef {{
		 *   ok: true,
		 *   provider: string,
		 *   providerLabel: string,
		 *   fetchUrl: string,
		 *   displayUrl: string,
		 *   fileName: string
		 * }} ResolvedSource
		 * @typedef {{ ok: false, reason: string }} UnresolvedSource
		 */

		/** 参照モードで取得を許す最大サイズ（バイト） */
		const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

		/**
		 * 埋め込みモードで作るURLの推奨上限（文字）。
		 * これを超えると、メールやチャットの折り返し・短縮で壊れる可能性が上がるため、
		 * UI側で参照モードを案内する。技術的な上限ではない。
		 */
		const INLINE_URL_LENGTH_LIMIT = 8000;

		/**
		 * @param {Uint8Array} bytes
		 * @returns {string}
		 */
		function bytesToBase64Url(bytes) {
			let binary = "";
			// 一度に渡す引数が多すぎると呼び出しスタックが溢れるため分割する
			const chunkSize = 0x8000;
			for (let offset = 0; offset < bytes.length; offset += chunkSize) {
				binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
			}

			return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
		}

		/**
		 * @param {string} text
		 * @returns {Uint8Array}
		 */
		function base64UrlToBytes(text) {
			const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
			const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
			const binary = atob(padded);
			const bytes = new Uint8Array(binary.length);
			for (let index = 0; index < binary.length; index += 1) {
				bytes[index] = binary.charCodeAt(index);
			}

			return bytes;
		}

		/**
		 * @param {string} text
		 * @returns {string}
		 */
		function textToBase64Url(text) {
			return bytesToBase64Url(new TextEncoder().encode(text));
		}

		/**
		 * URLの末尾セグメントからファイル名を推測する。
		 * @param {URL} parsed
		 * @param {string} fallback
		 * @returns {string}
		 */
		function resolveFileNameFromUrl(parsed, fallback) {
			const segments = parsed.pathname.split("/").filter(Boolean);
			if (segments.length === 0) {
				return fallback;
			}

			let last = segments[segments.length - 1];
			try {
				last = decodeURIComponent(last);
			} catch {
				// 壊れたパーセントエンコードはそのまま扱う
			}

			return last.toLowerCase().endsWith(".json") ? last : fallback;
		}

		/**
		 * GoogleドライブのURLからファイルIDを取り出す。
		 * @param {URL} parsed
		 * @returns {string}
		 */
		function extractGoogleDriveFileId(parsed) {
			const fromQuery = parsed.searchParams.get("id");
			if (fromQuery) {
				return fromQuery;
			}

			// https://drive.google.com/file/d/{id}/view
			const segments = parsed.pathname.split("/").filter(Boolean);
			const markerIndex = segments.indexOf("d");
			if (markerIndex >= 0 && segments.length > markerIndex + 1) {
				return segments[markerIndex + 1];
			}

			return "";
		}

		/**
		 * 共有リンクを、ブラウザから取得できる形のURLへ変換する。
		 *
		 * 変換できない置き場所（CORSを返さないもの）は、理由を添えて拒否する。
		 * 黙って失敗させると「MITOのバグ」に見えてしまうため。
		 *
		 * @param {string} rawUrl
		 * @returns {ResolvedSource | UnresolvedSource}
		 */
		function resolveSourceUrl(rawUrl) {
			const trimmed = String(rawUrl ?? "").trim();
			if (!trimmed) {
				return { ok: false, reason: "URLが空です。" };
			}

			/** @type {URL} */
			let parsed;
			try {
				parsed = new URL(trimmed);
			} catch {
				return { ok: false, reason: "URLとして解釈できませんでした。" };
			}

			// javascript: や data: を弾く。http: も混在コンテンツで読めないため許可しない。
			if (parsed.protocol !== "https:") {
				return { ok: false, reason: "httpsで始まるURLだけを読み込めます。" };
			}

			const host = parsed.hostname.toLowerCase();
			const displayUrl = parsed.href;

			if (host === "github.com") {
				// https://github.com/{owner}/{repo}/blob/{ref}/{path}
				const segments = parsed.pathname.split("/").filter(Boolean);
				if (segments[2] !== "blob" || segments.length < 5) {
					return {
						ok: false,
						reason: "GitHubのファイルページのURL（.../blob/...）を指定してください。",
					};
				}

				const rawPath = [segments[0], segments[1], ...segments.slice(3)].join("/");
				return {
					ok: true,
					provider: "github",
					providerLabel: "GitHub",
					fetchUrl: `https://raw.githubusercontent.com/${rawPath}`,
					displayUrl,
					fileName: resolveFileNameFromUrl(parsed, "shared.json"),
				};
			}

			if (host === "www.dropbox.com" || host === "dropbox.com") {
				// 共有リンクのホストを差し替えると、CORSヘッダー付きで本体が返る
				const target = new URL(parsed.href);
				target.hostname = "dl.dropboxusercontent.com";
				target.searchParams.set("dl", "1");
				return {
					ok: true,
					provider: "dropbox",
					providerLabel: "Dropbox",
					fetchUrl: target.href,
					displayUrl,
					fileName: resolveFileNameFromUrl(parsed, "shared.json"),
				};
			}

			if (host === "1drv.ms" || host === "onedrive.live.com") {
				// 共有URL自体をbase64urlにして shares API へ渡す形式
				return {
					ok: true,
					provider: "onedrive",
					providerLabel: "OneDrive",
					fetchUrl: `https://api.onedrive.com/v1.0/shares/u!${textToBase64Url(parsed.href)}/root/content`,
					displayUrl,
					fileName: resolveFileNameFromUrl(parsed, "shared.json"),
				};
			}

			if (host === "drive.google.com" || host === "drive.usercontent.google.com") {
				const fileId = extractGoogleDriveFileId(parsed);
				if (!fileId) {
					return {
						ok: false,
						reason: "GoogleドライブのURLからファイルIDを読み取れませんでした。共有リンクをそのまま貼り付けてください。",
					};
				}

				const apiKey = deps.getGoogleDriveApiKey();
				if (!apiKey) {
					return {
						ok: false,
						reason: "Googleドライブの読み込みにはAPIキーの設定が必要です（js/config.js）。設定されていないため読み込めません。",
					};
				}

				return {
					ok: true,
					provider: "googledrive",
					providerLabel: "Googleドライブ",
					fetchUrl: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`,
					displayUrl,
					fileName: "shared.json",
				};
			}

			// 変換規則を持たない置き場所。CORSを返すサーバーならそのまま読める。
			return {
				ok: true,
				provider: "direct",
				providerLabel: "外部URL",
				fetchUrl: parsed.href,
				displayUrl,
				fileName: resolveFileNameFromUrl(parsed, "shared.json"),
			};
		}

		/**
		 * 共有リンクをそのまま貼れる置き場所の名前。
		 *
		 * Googleドライブだけは配信環境の設定（APIキー）次第で使えたり使えなかったり
		 * するため、案内文とエラーメッセージが食い違わないよう、判定をここに集約する。
		 *
		 * @returns {string[]}
		 */
		function listSupportedProviderLabels() {
			const labels = ["GitHub", "Dropbox", "OneDrive"];
			if (deps.getGoogleDriveApiKey()) {
				labels.push("Googleドライブ");
			}

			return labels;
		}

		/**
		 * 現在のURLから共有パラメーターを読み取る。
		 * @param {string} href
		 * @returns {{ sourceUrl: string, inlineData: string }}
		 */
		function readShareParams(href) {
			/** @type {URL} */
			let parsed;
			try {
				parsed = new URL(href);
			} catch {
				return { sourceUrl: "", inlineData: "" };
			}

			const fragment = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
			return {
				sourceUrl: parsed.searchParams.get("src") ?? "",
				inlineData: new URLSearchParams(fragment).get("d") ?? "",
			};
		}

		/**
		 * 参照モードの共有URLを組み立てる。
		 * @param {string} baseHref MITO自身のURL
		 * @param {string} sourceUrl
		 * @returns {string}
		 */
		function buildSourceShareUrl(baseHref, sourceUrl) {
			const url = new URL(baseHref);
			url.search = "";
			url.hash = "";
			url.searchParams.set("src", sourceUrl);
			return url.href;
		}

		/**
		 * 埋め込みモードの共有URLを組み立てる。
		 *
		 * クエリではなくフラグメントに置く。フラグメントはサーバーへ送られないので、
		 * 配信元のアクセスログにドキュメント本体が残らない。
		 *
		 * @param {string} baseHref
		 * @param {string} encodedData
		 * @returns {string}
		 */
		function buildInlineShareUrl(baseHref, encodedData) {
			const url = new URL(baseHref);
			url.search = "";
			url.hash = `d=${encodedData}`;
			return url.href;
		}

		/**
		 * @param {Uint8Array} bytes
		 * @param {"gzip" | "deflate"} format
		 * @param {"compress" | "decompress"} direction
		 * @returns {Promise<Uint8Array>}
		 */
		async function transformBytes(bytes, format, direction) {
			const source = new Blob([/** @type {BlobPart} */ (/** @type {unknown} */ (bytes))]).stream();
			const transform = direction === "compress"
				? new CompressionStream(format)
				: new DecompressionStream(format);
			const transformed = await new Response(source.pipeThrough(transform)).arrayBuffer();
			return new Uint8Array(transformed);
		}

		/**
		 * JSON文字列を圧縮してURLに載せられる文字列にする。
		 * @param {string} jsonText
		 * @returns {Promise<string>}
		 */
		async function encodeInlineDocument(jsonText) {
			const compressed = await transformBytes(new TextEncoder().encode(jsonText), "gzip", "compress");
			return bytesToBase64Url(compressed);
		}

		/**
		 * 埋め込みモードの文字列をJSON文字列へ戻す。
		 * @param {string} encodedData
		 * @returns {Promise<string>}
		 */
		async function decodeInlineDocument(encodedData) {
			const decompressed = await transformBytes(base64UrlToBytes(encodedData), "gzip", "decompress");
			return new TextDecoder().decode(decompressed);
		}

		return {
			MAX_SOURCE_BYTES,
			INLINE_URL_LENGTH_LIMIT,
			resolveSourceUrl,
			listSupportedProviderLabels,
			readShareParams,
			buildSourceShareUrl,
			buildInlineShareUrl,
			encodeInlineDocument,
			decodeInlineDocument,
		};
	}

	/** @type {any} */ (globalObject).createShareLinkModule = createShareLinkModule;
})(window);
