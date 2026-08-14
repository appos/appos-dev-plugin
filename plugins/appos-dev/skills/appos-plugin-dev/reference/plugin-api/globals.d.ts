/**
 * `@appos.space/plugin-types/globals` — OPT-IN ambient declarations for
 * globals the AppOS host injects into the JavaScriptCore plugin runtime.
 *
 * This subpath is deliberately NOT re-exported from the package's main
 * entry. Importing `@appos.space/plugin-types` declares nothing global;
 * the declarations below apply ONLY to compilations that reference this
 * subpath explicitly, e.g. from a plugin entry file:
 *
 *     /// <reference types="@appos.space/plugin-types/globals" />
 *
 * or from `tsconfig.json`:
 *
 *     { "compilerOptions": { "types": ["@appos.space/plugin-types/globals"] } }
 *
 * Reference it ONLY from plugin-runtime (JSC) tsconfigs, and that tsconfig
 * MUST use a DOM-free `lib` (e.g. `"lib": ["ES2020"]`). Webview code
 * compiled against `lib.dom` already has a (mutable, `searchParams`-bearing)
 * `URL`. These declarations conflict with lib.dom's, but do NOT rely on
 * that conflict as a safeguard: with `skipLibCheck` enabled (the default
 * in most scaffolds) TypeScript suppresses declaration-file conflicts and
 * silently MERGES the interfaces, so browser-only surface (`searchParams`,
 * mutable accessors, unguarded construction) can type-check against the
 * narrower JSC contract. The DOM-free `lib` is the only reliable isolation.
 */
export {};
declare global {
    /**
     * A parsed, immutable URL produced by the AppOS host's Foundation-bridged
     * `URL` constructor (see the {@link URL} global for availability and the
     * full contract).
     *
     * All accessors are readonly: the runtime exposes non-enumerable getter
     * properties, so assignment is a sloppy-mode no-op / strict-mode
     * `TypeError`. Setters are a possible v2 addition.
     *
     * `searchParams` is deliberately ABSENT from this type. The v1 runtime has
     * no `URLSearchParams`; at runtime the `searchParams` getter THROWS a
     * `TypeError` ("URLSearchParams is not available in the AppOS plugin
     * runtime v1 — parse url.search manually"). Parse `url.search` yourself.
     */
    interface URL {
        /**
         * The absolute URL string (Foundation's serialization). Also returned by
         * `toString()` and `toJSON()`, so template literals, `String(u)` and
         * `JSON.stringify(u)` all yield the href.
         *
         * Pre-percent-encoded query values round-trip VERBATIM (`%3A` stays
         * `%3A`) — no double-encoding on the href path. See the {@link URL} var
         * declaration's divergence notes.
         */
        readonly href: string;
        /** Lowercased scheme followed by `":"` (e.g. `"https:"`). */
        readonly protocol: string;
        /**
         * The host, lowercased, WITHOUT brackets for IPv6 literals — this is
         * Foundation's `URL.host` verbatim (lowercased), i.e. the exact host
         * string that enters the AppOS host's own security normalizers for the
         * same input. Example: `https://[::1]:8443/x` → hostname `"::1"`.
         */
        readonly hostname: string;
        /**
         * `hostname`, plus `":" + port` when a port is present. IPv6 literals
         * are RE-bracketed here so the concatenation is unambiguous:
         * `https://[::1]:8443/x` → host `"[::1]:8443"`;
         * `https://[2001:db8::1]/` → host `"[2001:db8::1]"`.
         */
        readonly host: string;
        /**
         * The port as a string, `""` when absent.
         *
         * Pinned divergences: default ports are RETAINED (`https://x:443/` keeps
         * port `"443"`; WHATWG would drop it) and out-of-range ports are
         * accepted.
         */
        readonly port: string;
        /**
         * The path component. Pinned divergence: an empty path stays `""`
         * (WHATWG would normalize `https://example.com` to pathname `"/"`).
         */
        readonly pathname: string;
        /** The query: `""`, or `"?"`-prefixed when present. */
        readonly search: string;
        /** The fragment: `""`, or `"#"`-prefixed when present. */
        readonly hash: string;
        /**
         * `scheme://host` (with the re-bracketed, port-bearing {@link URL.host})
         * for `http`/`https`/`ws`/`wss`/`ftp`; the literal string `"null"` for
         * every other scheme. Example: `https://[::1]:8443/x` → origin
         * `"https://[::1]:8443"`.
         */
        readonly origin: string;
        /** The username component, `""` when absent. */
        readonly username: string;
        /** The password component, `""` when absent. */
        readonly password: string;
        /** The absolute URL string — same value as {@link URL.href}. */
        toString(): string;
        /** The absolute URL string — same value as {@link URL.href}. */
        toJSON(): string;
    }
    /**
     * Constructor/static surface of the host-injected `URL` global. See the
     * {@link URL} var declaration for availability, semantics and the pinned
     * Foundation-vs-WHATWG divergences.
     */
    interface URLConstructor {
        /**
         * Parses `url` (resolving against `base` when given) with Foundation's
         * RFC 3986 parser. Requires `new` (a bare `URL(...)` call throws a
         * `TypeError`).
         *
         * Throws `TypeError` (`e instanceof TypeError === true`) when:
         * - `url` has no scheme or is scheme-relative (`//host/x`) and no valid
         *   absolute `base` is supplied;
         * - `base` is supplied but does not itself parse as an absolute URL
         *   (the base is validated FIRST, matching WHATWG ordering);
         * - the input does not parse at all.
         *
         * Arguments are coerced via `toString`; a throwing `toString` propagates
         * out of the constructor (unlike {@link URLConstructor.canParse}).
         */
        new (url: string | URL, base?: string | URL): URL;
        /**
         * `true` iff `new URL(url, base)` would succeed. NEVER throws and never
         * leaves a pending exception — even when argument coercion itself throws
         * (e.g. an object whose `toString` throws), `canParse` suppresses the
         * exception fully and returns `false`.
         */
        canParse(url: string | URL, base?: string | URL): boolean;
        readonly prototype: URL;
    }
    /**
     * Host-injected `URL` constructor for the AppOS JavaScriptCore plugin
     * runtime — a native, Foundation-bridged implementation (macOS 14+
     * `URL(string:)`, RFC 3986), NOT a WHATWG spec polyfill.
     *
     * Coherence guarantee: for the same input, `url.hostname` is the same
     * (lowercased) host string that enters the AppOS host's own security
     * normalizers (permission validation, initial-hop network checks) — so
     * plugin-side URL validation parses identically to host-side enforcement.
     *
     * ## Why the type is optional (`URLConstructor | undefined`)
     *
     * - Hosts OLDER than the injecting release (targeted for AppOS host
     *   1.1.0) do not provide the global.
     * - Menu-bar raw `JSContext` pools do not carry it in v1 — only the main
     *   plugin contexts do.
     * - Users can disable the injection with the host kill switch
     *   (`appos.jsc.urlGlobal.disabled`).
     *
     * ALWAYS guard before use — `if (typeof URL === "function") { ... }`.
     * Setting `minHostVersion` to an injecting host release removes only the
     * older-host reason for absence; it does NOT override the user kill
     * switch or the menu-bar context limitation, so unguarded use (e.g. a
     * non-null assertion) can still crash at runtime.
     *
     * ## Pinned Foundation-vs-WHATWG divergences (intended — do not "fix")
     *
     * - Default ports are RETAINED in `href`/`port` (`:443` is not dropped).
     * - An empty path stays `""` (WHATWG would give `"/"`).
     * - Out-of-range ports are accepted.
     * - `hostname` is lowercased and IPv6 literals come WITHOUT brackets;
     *   `host`/`origin` re-bracket them (`https://[::1]:8443/x` → hostname
     *   `"::1"`, host `"[::1]:8443"`, origin `"https://[::1]:8443"`).
     * - Invalid characters are auto percent-/IDNA-encoded by Foundation
     *   (scheme-less inputs like `"not a url"` are rejected by the validity
     *   predicate, not by Foundation's parser).
     *
     * NOT a divergence: pre-percent-encoded query values round-trip VERBATIM
     * on href (`%3A` stays `%3A`, matching WHATWG). The widely-reported
     * `%3A` → `%253A` double-encode reproduces only via Foundation's
     * `URLComponents.queryItems` construction path, which this API never
     * uses — the host parses with `URL(string:)` and serializes with
     * `absoluteString`, and pins the verbatim round-trip in its coherence
     * tests.
     *
     * ## Out-of-subset surface (fails loudly, never silently wrong)
     *
     * - `url.searchParams`: absent from these types; the runtime getter
     *   throws a `TypeError` — parse `url.search` manually.
     * - `URL.parse(...)` static: absent in v1.
     * - Accessor setters: absent in v1 (all accessors readonly).
     */
    var URL: URLConstructor | undefined;
}
//# sourceMappingURL=globals.d.ts.map