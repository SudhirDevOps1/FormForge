# Changelog

All notable changes to FormForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
`release-please` writes a dated section for every release
([`.github/workflows/release-please.yml`](../.github/workflows/release-please.yml)),
and the `Release` workflow extracts the section matching each `v*` tag to build
the GitHub Release notes.

## [1.3.0](https://github.com/SudhirDevOps1/FormForge/compare/v1.2.0...v1.3.0) (2026-11-13)


### Features

* **db:** automate kv setup, zero-loss d1 migrations & account recovery ([#37](https://github.com/SudhirDevOps1/FormForge/issues/37)) ([543683b](https://github.com/SudhirDevOps1/FormForge/commit/543683b2e83c012fe26096852d209a20ef9c0b9d))
* **ui:** add signature pad, quiz scores, email customizer & svg icons ([#35](https://github.com/SudhirDevOps1/FormForge/issues/35)) ([4c38488](https://github.com/SudhirDevOps1/FormForge/commit/4c38488ffc210f0da4a6c1d32aa97e6f5b956298))
* **workflows:** add visual automations engine, merge tags, embed wizard and harden CI workflows ([#32](https://github.com/SudhirDevOps1/FormForge/issues/32)) ([97af31a](https://github.com/SudhirDevOps1/FormForge/commit/97af31ae8967ac36d6475a8c7b0b4c2b1db1392a))


### Bug Fixes

* **workflows:** resolve new workflow auto-reload and add forge loader ([#36](https://github.com/SudhirDevOps1/FormForge/issues/36)) ([97a7c8d](https://github.com/SudhirDevOps1/FormForge/commit/97a7c8d53d3990db0c573680d5d8a413a757b165))
* **workflows:** resolve workflow state wipe on save and add env wizard ([#38](https://github.com/SudhirDevOps1/FormForge/issues/38)) ([8b49b23](https://github.com/SudhirDevOps1/FormForge/commit/8b49b231da83f180f3bfad54501c67b7c6dcca4a))

## [1.2.0](https://github.com/SudhirDevOps1/FormForge/compare/v1.1.1...v1.2.0) (2026-11-13)


### Features

* add 11 quick-add field preset buttons to form fields generator UI ([3d8d884](https://github.com/SudhirDevOps1/FormForge/commit/3d8d884e7575a4ba4facbf47b94abf8114b5027f))
* add Backblaze B2 storage, attachment rules, and hosted forms ([3eba54d](https://github.com/SudhirDevOps1/FormForge/commit/3eba54d48cd129553808389e13007263b55cf85c))
* add beautiful form submissions analytics panel and Slack/Discord webhook auto-formatting ([f18db57](https://github.com/SudhirDevOps1/FormForge/commit/f18db57133ede72972c53c1357a52b99384c4744))
* add beautiful showcase landing page index.html with comparison limits and live simulator ([3ad1c26](https://github.com/SudhirDevOps1/FormForge/commit/3ad1c2683f82ce898c73377c4eb1a76f7b942644))
* add copy-to-clipboard button and integration guide for newly generated API keys ([553c69b](https://github.com/SudhirDevOps1/FormForge/commit/553c69b40f17f4539be38660050a3b6602b5d114))
* add custom SMTP settings with smart gmail configuration ([84b9518](https://github.com/SudhirDevOps1/FormForge/commit/84b95188595f85b90e663da4f8bc5d35adb5ade9))
* add document upload presets and auto-adaptation in Connect & Snippets ([d9cd866](https://github.com/SudhirDevOps1/FormForge/commit/d9cd8668a67548224c7ed6831e028ec1ee3d0bb4))
* add dynamic redirect URL variables and form embed templates selector to dashboard ([171f918](https://github.com/SudhirDevOps1/FormForge/commit/171f918e5fb1a6a1d575158335c8037a9fde47d5))
* add form setting to collect and show raw Client IP address and render on dashboard ([0043aee](https://github.com/SudhirDevOps1/FormForge/commit/0043aeea08bdb6cd6adf7e3766846bc6f5285386))
* add global environment SMTP variables fallback support in notifications ([6c05bbf](https://github.com/SudhirDevOps1/FormForge/commit/6c05bbf08dbd59f33d33d4ce56b7eda9eda77ff8))
* add Go to App button in docs.html navbar ([fe5e048](https://github.com/SudhirDevOps1/FormForge/commit/fe5e048a8ff74107b80587f254466ee010da5133))
* add interactive iframe form preview and dynamic color customizers in dashboard code panel ([40a69ed](https://github.com/SudhirDevOps1/FormForge/commit/40a69ed688ef6aada0d50b29a01a56066e26ed5f))
* add magic bytes file signature validation and secure download headers ([06f1732](https://github.com/SudhirDevOps1/FormForge/commit/06f1732c6683ffa659f9b6ae5e97116caa4f6681))
* add magic link support for password reset and passwordless sign-in ([b321991](https://github.com/SudhirDevOps1/FormForge/commit/b321991e7fe9077f2cdc6ea5af86e64dd89291a5))
* add mobile drawer TOC and pure client-side regex syntax highlighter for CSP compliance in docs.html ([1acc59b](https://github.com/SudhirDevOps1/FormForge/commit/1acc59b88203b63a000f6ec01a3e937279a98190))
* add multi-platform support, turso db, gas relay, otp, and duckdb analytics ([0220986](https://github.com/SudhirDevOps1/FormForge/commit/02209861e71c0165006e7f6fb5a1f601c38ed0c6))
* add Next.js rewrites configuration to map /docs to /docs.html and /guide to /guide.html ([e274274](https://github.com/SudhirDevOps1/FormForge/commit/e274274fd42649d0561494cd27dffa2d3131e4e5))
* add PDF Report (print-friendly HTML layout) format option to dashboard export dropdown ([0df7788](https://github.com/SudhirDevOps1/FormForge/commit/0df778896a80b82d6a3699ce549cdcf4c7654408))
* add privacypolicybanao.html page and bind navigation links in header & footer ([961c370](https://github.com/SudhirDevOps1/FormForge/commit/961c370ed266233789986eec1f02b33e0807ed14))
* add support for JSON and TXT format exports in dashboard dropdown menu ([123c942](https://github.com/SudhirDevOps1/FormForge/commit/123c942fff9c32c34e816fa885f685994aaa4db8))
* add tabbed syntax-highlighted code snippets and timezone display fix for form creation ([92693a0](https://github.com/SudhirDevOps1/FormForge/commit/92693a067fc50fabafb3f3ed985138384d6befb2))
* add universal account-level integrations, admin login alerts, and 1-line drop-in otp script ([203cdea](https://github.com/SudhirDevOps1/FormForge/commit/203cdea84ea6fe7d4f3c5f199be20c2c080f9cbd))
* add user-friendly variable descriptions for cloudflare deploy page ([e204f61](https://github.com/SudhirDevOps1/FormForge/commit/e204f61f3f1c5b1b31e590a0a5583ae90be0bad5))
* add webhook delivery logs, intent triage, multi-step forms and live feed ([01a6051](https://github.com/SudhirDevOps1/FormForge/commit/01a6051134f30c11d78240a67b7ee6718465d76e))
* complete dashboard UI/UX overhaul, add table/JSON toggles, Turnstile, and Autoresponder support ([a5671e4](https://github.com/SudhirDevOps1/FormForge/commit/a5671e434d4acb87187fb47f729990d70164e442))
* **dashboard:** add duckdb studio, live webhook tester and widget ([2042cbd](https://github.com/SudhirDevOps1/FormForge/commit/2042cbd912c6bfe6138440512337dcaba87508d2))
* **dashboard:** add interactive api docs hub, bulk deletion, and db payload optimization ([1f27d32](https://github.com/SudhirDevOps1/FormForge/commit/1f27d32de27e4ca05fa5ec31b966475ee636ef38))
* **dashboard:** replace browser confirm alert with native dark-mode in-app modal ([3b3bd25](https://github.com/SudhirDevOps1/FormForge/commit/3b3bd2536e2949108446c2e037a22cc749c33629))
* design hybrid UI supporting dropdown presets and custom days inputs for data retention limit ([42d34c8](https://github.com/SudhirDevOps1/FormForge/commit/42d34c8f41a53413c365e63344f6caa859205efd))
* **gas:** add GAS_SECRET env variable support for Google Apps Script webhook ([c92b65f](https://github.com/SudhirDevOps1/FormForge/commit/c92b65f3987c5775acada93bf419afdf428ba5af))
* implement custom spam words blocklist, api key expiration options, and document all changes in markdown files ([bd777a3](https://github.com/SudhirDevOps1/FormForge/commit/bd777a373da75120bbf81157468947fea1c2bba6))
* implement double opt-in email verification and live MX records DNS lookup checks ([6d30389](https://github.com/SudhirDevOps1/FormForge/commit/6d303899311fff69209642511e282a46288d4440))
* implement interactive form-selection and tabbed code snippets inside API Key warning card ([d51bc71](https://github.com/SudhirDevOps1/FormForge/commit/d51bc7112cdeb9c196172128b2938a2173d12da6))
* integrate global formColor state in all snippet code generator tabs and iframe templates ([4b57eff](https://github.com/SudhirDevOps1/FormForge/commit/4b57eff6031448f04d7c493cbb574e8c988db8d7))
* make data retention period fully custom using a number input ([11d5edf](https://github.com/SudhirDevOps1/FormForge/commit/11d5edf55c071938096c8ac4cf55d5d5d4cbd426))
* merge remote updates and preserve all custom SMTP, Webhooks, encryption and documentation features ([a8b6f9c](https://github.com/SudhirDevOps1/FormForge/commit/a8b6f9cfd1a1eceb8d73931d075f15cd8ae84a1c))
* replace all remaining github repository links with SudhirDevOps1/FormForge on landing page ([e94e0eb](https://github.com/SudhirDevOps1/FormForge/commit/e94e0eb0cc4b384fc06e52c8d99abd3f75a6f3a3))
* replace unicode form template emojis with real professional inline SVG vector icons in dashboard UI ([2da68ac](https://github.com/SudhirDevOps1/FormForge/commit/2da68aca9c18ca5179e6deb72e6c659d3516020f))
* **security:** integrate free self-hosted ALTCHA proof-of-work spam protection ([8f8e299](https://github.com/SudhirDevOps1/FormForge/commit/8f8e299a6856d8877a6375e8d6e2c340e1193532))
* **security:** replace turnstile with free self-hosted altcha pow ([ca67ab2](https://github.com/SudhirDevOps1/FormForge/commit/ca67ab2f4800c01ec88503b152a5d2e15b0873d5))
* **settings:** add alert recipient email input to universal integrations ([52dd61c](https://github.com/SudhirDevOps1/FormForge/commit/52dd61c520232d315538d32dd978d58df98dc38d))
* **settings:** add show/hide toggle for GAS secret token ([3e5f33b](https://github.com/SudhirDevOps1/FormForge/commit/3e5f33b56f38f2cea8b585eb966d06b5734afba5))
* **settings:** allow configuring GAS and Webhook secrets directly from browser dashboard UI ([ec44465](https://github.com/SudhirDevOps1/FormForge/commit/ec44465740298051b4e5e8977255dd97892360c9))
* **submissions:** add lifecycle management, search, and dynamic redirect ([d6a2d9e](https://github.com/SudhirDevOps1/FormForge/commit/d6a2d9ed2792c80ac0e6b171cca23769be27a675))
* support unified single endpoint for altcha challenge and submission ([284edd2](https://github.com/SudhirDevOps1/FormForge/commit/284edd2e0b62726431a603fb6ef1ce4e2b4a1b1e))
* **ui:** add turnstile-style altcha widget with solve time display ([6c7b31d](https://github.com/SudhirDevOps1/FormForge/commit/6c7b31d2908013cee445b43e8ab3b9929324b9e7))
* **ui:** overhaul dashboard navigation and modern glassmorphic theme ([40c2823](https://github.com/SudhirDevOps1/FormForge/commit/40c28239708fa1b8177e330463cb9ea307b6b76e))
* v1.0.0 Universal with TOTP 2FA, settings and analytics ([10d5601](https://github.com/SudhirDevOps1/FormForge/commit/10d56012e253710bef3a911b188abafe1bd6b99b))
* v1.1 Aurora - premium UI/UX, motion system, 10 new features, hardened security ([d15a8dd](https://github.com/SudhirDevOps1/FormForge/commit/d15a8dd8b45905195259f96c65d58f905f44ea1f))
* **v1.2.0:** Enterprise extensions - Multi-email APIs, S3/R2 uploads, owner-only mode, OpenAPI docs, styled templates, updated all markdown docs ([fda4b48](https://github.com/SudhirDevOps1/FormForge/commit/fda4b485d2fc0a93e810d447fa15ecf8db1fb4a3))


### Bug Fixes

* add floating print control bar to prevent browser print dialog errors ([9e13748](https://github.com/SudhirDevOps1/FormForge/commit/9e13748e25cf8e2c4d96fba99f7b490484e16c43))
* add ipHash property to local Submission typescript type definition inside dashboard page ([8a03a11](https://github.com/SudhirDevOps1/FormForge/commit/8a03a11fb97e45baaf4ba302e0d0cb3d87c2b308))
* add storeIpHash to local Form typescript interface in dashboard page ([98e864a](https://github.com/SudhirDevOps1/FormForge/commit/98e864a713ce6ea4023ddd2921e5510e471b3627))
* **auth:** fix foreign key constraint violation on password reset and magic link OTPs ([78942d7](https://github.com/SudhirDevOps1/FormForge/commit/78942d706373ce88180bceda0b798aaa8fa2479e))
* auto-solve altcha in api testing playground ([78e2ba6](https://github.com/SudhirDevOps1/FormForge/commit/78e2ba6e8a8bd810fd29bba6d9aa3e355a05071f))
* **build:** configure serverExternalPackages for [@libsql](https://github.com/libsql) workerd ([5f0792e](https://github.com/SudhirDevOps1/FormForge/commit/5f0792ec54c0d2c74dd7a7bca14cc66f2c0af494))
* **db:** auto-migrate all tables and columns seamlessly, add webhook & GAS secret generators ([d37666b](https://github.com/SudhirDevOps1/FormForge/commit/d37666b663b7e40054260565a9988db0ecb83b69))
* enforce explicit UTC ISO 8601 string timestamps on insertion across all routes to resolve timezone display offsets ([fef048b](https://github.com/SudhirDevOps1/FormForge/commit/fef048bdc07efa1397c62c832a0828700137471f))
* enforce strict email validation checking on submissions to reject invalid emails like admin@gmailcom ([2ce76cd](https://github.com/SudhirDevOps1/FormForge/commit/2ce76cde24723fde95c3c186d6578b0d2b67c441))
* ensure users universal columns in schema and add resilient settings error handling ([28fad78](https://github.com/SudhirDevOps1/FormForge/commit/28fad7874bbec5af1463c4bd56ab6075e6e5571e))
* **gas:** add template secret fallback so blank token in UI works seamlessly ([b51cf61](https://github.com/SudhirDevOps1/FormForge/commit/b51cf6197a69aa4c970fa1828946762ddd498858))
* **gas:** auto-fallback to admin Gmail when recipient blank and fix secret bypass ([ef8dd81](https://github.com/SudhirDevOps1/FormForge/commit/ef8dd8174189680007456eefd21bd8dc07e6b6d0))
* **gas:** improve secret mismatch error message with clear deployment instructions ([38f81a9](https://github.com/SudhirDevOps1/FormForge/commit/38f81a902a4371bf6813bad9eadb7e1ea4eb9a82))
* **gas:** support query param token extraction and parse GAS error responses ([a26d461](https://github.com/SudhirDevOps1/FormForge/commit/a26d4618f68ccb5f299561da6d7a08508483d419))
* gracefully classify missing altcha as spam without breaking client endpoints ([87be25e](https://github.com/SudhirDevOps1/FormForge/commit/87be25e15dff49120f47cc6c8aa6106d38015904))
* harden rate limiting, altcha anti-replay, and idor file access ([9c39ec0](https://github.com/SudhirDevOps1/FormForge/commit/9c39ec073d50631faef6de3f7263a059ebce6296))
* implement form hard deletion, fix code syntax highlight regex bugs, and add editable form slug field in settings ([16de2c7](https://github.com/SudhirDevOps1/FormForge/commit/16de2c7239500d7ce3669dbac1c9c3666de48b0e))
* make submit OTP verification idempotent and recognize pre-verified session ([dcd0c3a](https://github.com/SudhirDevOps1/FormForge/commit/dcd0c3a4969ee46b7bad9762e4b82939d820e816))
* **notifications:** block OTP bypass, fix silent OTP fail, fix GAS/SMTP fallbacks ([a9536e8](https://github.com/SudhirDevOps1/FormForge/commit/a9536e87edff00cfba3f94f47ed7afdce3d2248e))
* **notifications:** fix password reset GAS fallback + add GAS relay to email verification ([64f4171](https://github.com/SudhirDevOps1/FormForge/commit/64f41715118694df4e5847c58688ce4900932776))
* **notifications:** fix Stoat 401 bug and await login alerts ([d4b0681](https://github.com/SudhirDevOps1/FormForge/commit/d4b0681292fbfd62069ce762eb13a993d222b4ef))
* production release fixes, registration rate limits, and deployment optimization ([3c007b8](https://github.com/SudhirDevOps1/FormForge/commit/3c007b850f0b85d9dd1a1c60c8d027d84fc7ffef))
* remove duplicate contentLength declaration and keep the original strict 64KB limit ([3c91982](https://github.com/SudhirDevOps1/FormForge/commit/3c91982868ab14a42948cd9e647a1bde1dd17b60))
* repair the blank page, the broken local database and encrypted submissions ([fda4314](https://github.com/SudhirDevOps1/FormForge/commit/fda431461fab61c03c83ecb8c985fa39b86e026b))
* repair the blank page, the broken local database and five dead CI workflows ([#26](https://github.com/SudhirDevOps1/FormForge/issues/26)) ([d6084e9](https://github.com/SudhirDevOps1/FormForge/commit/d6084e9285de090ca1c23a057b1651288ed6abc1))
* replace docs.html with fully self-contained Vanilla CSS layout to prevent Content Security Policy violations ([0d8e56d](https://github.com/SudhirDevOps1/FormForge/commit/0d8e56d2fe57217406961e4a348e3598f4244e06))
* replace hardcoded demo stats with real dynamic counts ([16dfc88](https://github.com/SudhirDevOps1/FormForge/commit/16dfc88a5c063bb31bba97ed0d5108a61f010e90))
* replace next/server waitUntil with getCloudflareContext ctx.waitUntil to resolve build compilation error ([1661e2b](https://github.com/SudhirDevOps1/FormForge/commit/1661e2b036e8be13d53ef05c8c18f47083a10a76))
* resolve 2fa altcha replay, add forgot password flow, and fix submit otp verification ([a50229d](https://github.com/SudhirDevOps1/FormForge/commit/a50229daa5571587a675afc15a1a27ecde7f9154))
* resolve email fallback, subject template, autoresponder reply-to, and altcha submission guards ([5538b23](https://github.com/SudhirDevOps1/FormForge/commit/5538b2397fbcbb8982f83a061527a693ed8d4431))
* resolve file upload input types and form enctype parameters inside dashboard generator templates ([f60bdfa](https://github.com/SudhirDevOps1/FormForge/commit/f60bdfaf61891f07502f6caf4350f5b51d8972dd))
* resolve Stoat chat webhook URL normalization and OTP verification feedback ([4aa21ef](https://github.com/SudhirDevOps1/FormForge/commit/4aa21ef0086c6aa89c6d594adc8d374b06f611c3))
* resolve stoat webhook endpoint normalization and improve tab switching UX ([3c4a9ae](https://github.com/SudhirDevOps1/FormForge/commit/3c4a9ae2d31bf408c9c6e9bda04a9a96627eb280))
* restore missing style tag in guide.html and verify HTML structures ([69ca454](https://github.com/SudhirDevOps1/FormForge/commit/69ca454681ab3a973784f7a91d42ce3b9b3af052))
* **security:** audit fixes for universal notifications, gas relay payload & credential sanitization ([db3ca0e](https://github.com/SudhirDevOps1/FormForge/commit/db3ca0e08fbe23da5c9ff58d6f160e43ced0397c))
* **security:** clear the open CodeQL alerts and add owner recovery ([#27](https://github.com/SudhirDevOps1/FormForge/issues/27)) ([758fa26](https://github.com/SudhirDevOps1/FormForge/commit/758fa26d5dd6e61022ce0a5359c78ce00be840c8))
* **security:** sanitize all personal domains and app urls from codebase ([736f42c](https://github.com/SudhirDevOps1/FormForge/commit/736f42cdba08e2ecb03b2d07fd8dbaa778f5f451))
* switch docs.html from Tailwind v4 browser CDN to stable Tailwind v3 CDN ([626b99d](https://github.com/SudhirDevOps1/FormForge/commit/626b99de829094a7166216c1fa09827ff94914dc))
* track package-lock.json so CI can actually run ([58209de](https://github.com/SudhirDevOps1/FormForge/commit/58209deaa1ca6fcb0940ad789777deb227ea289f))
* **ui:** remove text overlaps and ship approval-gated releases ([#29](https://github.com/SudhirDevOps1/FormForge/issues/29)) ([80d2783](https://github.com/SudhirDevOps1/FormForge/commit/80d27834f850fd27c7de8ab80608d6406a2f6bda))


### Performance Improvements

* **cache:** cut D1/Worker load, fix UI overlaps, add release automation ([#30](https://github.com/SudhirDevOps1/FormForge/issues/30)) ([c7fd9a9](https://github.com/SudhirDevOps1/FormForge/commit/c7fd9a9905b454dc659f9e01ec6e7e7a6249edb7))
* optimize D1 database query caching, prevent browser caching on GET APIs, defer submission notification delivery, and add UI refresh button ([2508e6d](https://github.com/SudhirDevOps1/FormForge/commit/2508e6d49fc215c0770b356c5a6165dc5ee08132))

## [1.1.1] - 2026-11-11

### Fixed
- **The deployed Cloudflare Worker answered `Error 1101` on every request** — after the jump to Next.js 16, the Worker crashed at startup before serving a single page. Next 16's server constructor calls `getPreviewProps()`, which reads `/.next/server/preview-props.json` through `loadManifest`. `@opennextjs/cloudflare@1.20.6` did not inline that manifest into its build-time manifest map, so the adapter's patched loader threw `Unexpected loadManifest(/.next/server/preview-props.json) call!` and every route became a 500. Upgraded to `@opennextjs/cloudflare@1.20.16` (upstream `#1356`, first released in 1.20.12), which inlines the manifest. Verified by booting the real bundle under `wrangler dev`: `/`, `/dashboard`, `/f/:slug`, `/api/health` and `/api/static` all answer 200, and the failing request is gone from the Worker log.
- **A green `next build` no longer implies a working Worker** — added `tests/worker-smoke.mjs` (`npm run test:worker`), which boots `.open-next/worker.js` under `wrangler dev` and asserts that the marketing page, the dashboard, the health endpoint and the OpenAPI document actually serve. It runs in the Cloudflare Build job after the bundle is produced, so a runtime-manifest regression fails CI instead of production.
- **The secret-leak sweep reported its own definition as a secret** — the pattern literal lived in `security.yml`, `security-scan.yml` and `security-scan-local.sh`, so `grep -rE` matched those files and every run failed with "Potential committed secret detected". The pattern is now assembled from adjacent shell fragments, which keeps the detector scanning `.github/` while no longer matching itself.
- **`Secret Leak Detection` failed on an unescaped pattern** — the old inline quoting produced a pattern wrapped in literal single quotes; combined with the self-match above the job could never pass. Rewritten as a variable, and `package-lock.json` is excluded.
- **Lighthouse CI never ran an audit** — the job started `next start` without ever running `next build`, so LHCI aborted during collection with "Could not find a production build in the '.next' directory". The job now builds first, waits for Next 16's `Ready in` banner, and treats score thresholds as advisory (runner CPU variance makes them flaky) while still publishing the reports.
- **The Cloudflare Build job failed after a successful build** — `.open-next` starts with a dot, and `upload-artifact` skips hidden paths by default, so the job reported "No files were found with the provided path: .open-next/". The step now sets `include-hidden-files: true`.
- **Semgrep crashed before scanning** — `semgrep/semgrep-action@v1.1.0` (2021) bundles a Semgrep too old to parse current registry metadata and died with `ValueError: invalid rule severity value: MEDIUM`, which then made the SARIF upload fail with "Path does not exist: semgrep.sarif". Replaced with the current CLI, scoped to `src/`, gating on `ERROR` severity, and the SARIF upload is skipped when no report was produced.
- **`tsconfig.tsbuildinfo` was committed** — a machine-specific incremental-build artefact that churned on every run. Untracked and ignored (along with `*.tsbuildinfo` and local `.tmp-*` verification output).
- **`npm run lint` failed locally after a build** — `eslint .` descended into generated output (`.next/`, `.open-next/`, `.tmp-feature-tests/`) and reported 24 errors and 12 warnings against minified bundles; line numbers in the twenty-thousands were the giveaway. Build output is now excluded in both the config and the lint script, so the check means what it says regardless of whether a build has run.

### Security
- **`drizzle-orm` 0.38.3 → 0.45.4** — `GHSA-gpj5-g38j-94v9` (high): SQL injection through improperly escaped identifiers.
- **`nodemailer` 7.0.13 → 10.5.0** — clears the `<=10.1.3` advisory set: SMTP command injection via `envelope.size`, CRLF injection in the transport name and `List-*` header comments, `jsonTransport` / message-level `raw` / `resolveContent()` bypasses of `disableFileAccess` and `disableUrlAccess` (arbitrary file read and SSRF), IDN allow-list bypass, and several quadratic-parsing denial-of-service vectors in `addressparser`, SMTP reply parsing and DKIM unfolding.
- **The dependency gate now measures what ships** — `npm audit --omit=dev` is the blocking check, because the remaining advisories live in CLI-only build tooling (`@opennextjs/cloudflare` → `@node-minify/core` → `glob` → `minimatch`, `drizzle-kit` → `esbuild`) that never enters the Worker bundle. The full tree is still audited, summarised in the job log and uploaded as an artefact, and Dependabot keeps it current — a minifier advisory should not force a runtime downgrade.
- **`@opennextjs/cloudflare` moved to `devDependencies`** — it is a build CLI, not a runtime import, so it belongs there; this is also what makes the `--omit=dev` gate meaningful.

### Changed
- `next.config.ts` now explicitly disables `cacheComponents` and `partialPrefetching`, the two Next 16 features the OpenNext adapter does not yet support (they can leave the Worker hanging on concurrent renders). Documented inline so nobody re-enables them without checking the adapter first.

## [1.1.0] - 2026-11-11

### Added
- **Optional encryption of submission payloads at rest** — a per-form toggle seals every new payload with AES-256-GCM. The envelope is self-describing (`ffenc:v1:…`), so a database that mixes encrypted and plaintext rows stays readable and turning the setting on never orphans an existing row. Search, exports, webhook deliveries and notifications all work on the readable body.
- **End-to-end integration suite** — `tests/run-e2e-tests.mjs` drives the real HTTP surface of a running server: registration, form creation, conditional logic (a hidden field is stripped from storage, a required field is enforced), URL prefill (a hidden value cannot be forged), UTM capture, partial submissions and resume, the submission workflow, internal notes, encrypted payloads at rest, search inside an encrypted form, the flattened CSV export, the password gate, duplicate detection, session listing and the audit trail. 24 assertions, wired into `npm run test:e2e` and a new CI job.
- **New feature-behaviour suite** — `tests/run-feature-tests.mjs` compiles the new engines to CommonJS and exercises the real implementations: all thirteen conditional-logic operators, show/hide/require semantics, hidden-field stripping, prototype-pollution rejection, prefill mapping and UTM capture, hidden-value injection, the webhook backoff schedule and terminal-failure rule, duplicate fingerprinting, the form-password token scheme (cross-form, tampering and expiry), the password-strength policy and the encryption envelope. 40 assertions.
- **Conditional Logic & Branching Engine** — per-form rules (`show` / `hide` / `require`) evaluated server-side on every submission. Hidden fields are stripped from the stored payload and are never counted as required, so a crafted request cannot bypass the form's logic. Thirteen operators (equals, contains, greater-than, `in`, empty checks, …). Managed from a new **Logic & Prefill** tab in the dashboard.
- **URL Prefill & Server-Side Hidden Fields** — map a query parameter onto a form field. Visible prefills pre-fill an input; hidden fields are injected server-side after the client payload is parsed, so the respondent can neither read nor forge them. Optional automatic UTM capture (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`).
- **Partial Submissions & Save-and-Resume** — respondents can save progress and continue later with a signed resume link. The resume token is stored only as a SHA-256 hash, so a leaked database row cannot be replayed.
- **Drop-off Funnel Analytics** — per-field completion rates derived from saved partial submissions, with a started/completed/completion-rate summary in the analytics panel.
- **Submission Workflow & Internal Notes** — triage every submission through `new → in_progress → resolved → spam`, attach private internal notes, and reply by email. Notes are excluded from exports, webhooks and notifications; a reply can only target the address captured with the submission.
- **Webhook Auto-Retry with Exponential Backoff** — failed deliveries are scheduled for another attempt on a human-scale backoff (1m → 5m → 30m → 2h → 12h), capped at five attempts. Every attempt is logged with its status code and latency. A scheduler-safe endpoint (`POST /api/webhooks/retry-due`) processes the due queue using a `CRON_SECRET`.
- **Native Slack & Discord Channels** — dedicated form fields for Slack and Discord incoming webhook URLs. The dispatcher renders native Block Kit / embed payloads; no OAuth app and no relay service involved.
- **Password-Protected Forms** — a shared access password gates the hosted page. Stored as a PBKDF2-SHA256 hash and compared in constant time; unlocking returns a short-lived HMAC token bound to the form id.
- **Duplicate Detection** — submissions are fingerprinted on a canonical, order-independent payload. A repeat is flagged and linked to the original instead of silently inflating the response count.
- **Tags & Cross-Form Search** — per-form tags plus `?search=` and `?tag=` filtering across every form the owner owns.
- **Scheduled Form Closure & Per-Form Rate Limits** — close a form on a given date, and set the per-IP submissions-per-minute ceiling for each form (default 60).
- **Session Management & Audit Trail UI** — list every active session with a device label and a daily-rotating IP hash, revoke one or all of them, and read the administrative audit trail that was previously write-only.
- **Command Palette (⌘K / Ctrl+K)** — a keyboard-driven surface for every dashboard action, with fuzzy matching, arrow-key navigation and focus trapping.
- **Premium "Aurora" Design System & Motion Engine** — a token-based design system (colour, type, spacing, radius, shadow, motion) shared by the marketing site and the dashboard, plus a scroll-reveal system, animated counters, magnetic buttons, an aurora backdrop, a trust marquee, and an interactive product preview.
- **Dynamic Hosted Form Engine** — the hosted page now renders owner-defined field lists (text, email, number, tel, url, date, textarea, select, radio, checkbox, file) with live conditional logic, prefills and save-and-resume, while keeping the classic and conversational layouts.
- **Flattened CSV Export** — one column per field instead of a single JSON blob, plus `workflow_status` and `duplicate_of` columns, so exports open directly in a spreadsheet.

### Fixed
- **A client-side failure could leave the whole page blank** — the scroll-reveal system hid every section behind a class that an inline script added before first paint. If the React runtime then failed to boot (a blocked script, a CSP violation, a network error), nothing ever revealed the content and the visitor saw an empty page. A hydration failsafe now removes the class again when the client runtime never reports in, and a `HydrationGuard` component cancels the timer as soon as the runtime is healthy.
- **Encrypted payloads broke notifications** — `deliverNotifications` and the email-verification route parsed the stored payload as JSON, so a form with encryption enabled answered every submission with a 500. Both now read the decrypted body, and the submit route logs the cause instead of swallowing it.
- **Local development could never reach a database** — the database layer imports `createClient` from `@libsql/client/web`, which cannot open `file:` URLs, so the documented `npm run dev` flow always answered `503 DATABASE_NOT_CONFIGURED`. The Node build of the client is now resolved lazily through `process.getBuiltinModule()`, which does not exist in a Worker — the production bundle is unaffected.
- **Raw client IP could be persisted** — when the "store IP hash" option was disabled, the submit route fell back to writing the *plaintext* IP address into `submissions.ip_hash`. The value is now omitted entirely when hashing is off, and the stored hash is salted with the current UTC day so it cannot be correlated across days.
- **Dependency drift in the Cloudflare toolchain** — `@opennextjs/cloudflare@1.20.6` requires `next >= 15.5.24` and `wrangler ^4.125.0`, but the repository pinned `next@15.5.18` / `wrangler@^4.108.0`, which made a clean `npm install` fail with `ERESOLVE`. Bumped to `next@15.5.29`, `eslint-config-next@15.5.29` and `wrangler@^4.125.0`.
- **Missing CI workflows** — the security suite mandates `.github/workflows/ci.yml`, `security-scan.yml` and `release.yml`, but the `.github` directory had been untracked, leaving the suite at 49/53. Restored from history, and the remaining floating action tags in `security-scan.yml` are now SHA-pinned.

### Security
- **Content-Security-Policy** — a strict CSP is now shipped from a single source of truth (`src/lib/security-headers.ts`) and applied by `next.config.ts`: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` were added alongside it. The hosted form page (`/f/*`) is the only route that permits framing, because embedding it is a documented feature.
- **`__Host-` session cookie** — the session cookie is now issued as `__Host-ff_session` on secure origins, which the browser enforces as `Secure; Path=/` with no `Domain` attribute. A sibling subdomain can no longer set or overwrite it. The legacy name is still read so existing deployments survive the upgrade.
- **Password strength policy** — registration and password reset now enforce length, character-class diversity and a common-password blocklist. The client additionally offers a breach check against the Pwned Passwords **k-anonymity** API: only the first five characters of the SHA-1 digest leave the browser.
- **Per-address throttling** — `forgot-password` now has a second rate-limit bucket keyed on the target address, so a single attacker cannot rotate IPs to hammer one inbox.
- **Extended security suite** — the test suite grew from 53 to 64 assertions, adding a new `P7` pillar covering the raw-IP regression, the CSP, the `__Host-` cookie, rule-engine prototype-pollution defence, authorization on every new dashboard API, form-password hashing, the backoff schedule, reply-target confinement, resume-token hashing and hidden-prefill injection.
- **New feature-behaviour suite** — `tests/run-feature-tests.mjs` compiles the new engines to CommonJS and exercises the real implementations: all thirteen conditional-logic operators, show/hide/require semantics, hidden-field stripping, prototype-pollution rejection, prefill mapping and UTM capture, hidden-value injection, the webhook backoff schedule and terminal-failure rule, duplicate fingerprinting, the form-password token scheme (cross-form, tampering and expiry) and the password-strength policy. 35 assertions, wired into `npm test` and CI.

### Changed
- **Next.js 15 → 16.4.6** — the Next.js 15 line left the two-year support window on 2026-10-21, so the Cloudflare build refused to run against it. The upgrade also satisfies `@opennextjs/cloudflare@1.20.6`'s peer range (`next >= 16.3.3`). React was moved to `19.3.1` and `eslint-config-next` to `16.4.6`.
- **ESLint flat config** — `eslint-config-next@16` ships native flat config, so `eslint.config.mjs` consumes it directly instead of routing it through the `FlatCompat` shim, which crashed on the v16 plugin graph.
- **`.github/` is tracked again** — it had been added to `.gitignore`, which silently disabled CI and failed the repository's own security suite. The workflows are restored, SHA-pinned, and the ignore rule was removed.
- **Windows build support** — `build-cf.js` preloads `scripts/windows-symlink-fallback.cjs`, which falls back to junction points when OpenNext recreates the standalone `node_modules` layout. The Cloudflare bundle can now be produced on a normal Windows workstation without Developer Mode or Administrator rights.
- **Content-Security-Policy in development** — `'unsafe-eval'` is granted in development only, because React's dev build calls `eval()` to reconstruct component stacks. The production policy remains strict.

---

## [1.0.0] - 2026-09-08

### Added
- **Universal Multi-Database Engine** — Native support for Cloudflare D1, Neon Serverless Postgres (`@neondatabase/serverless` & `drizzle-orm/neon-http`), Turso libSQL, and local SQLite with automated zero-downtime startup schema migrations (`autoMigrate`).
- **Native ALTCHA Proof-of-Work Anti-Spam** — 100% free, privacy-first, self-hosted anti-spam verification powered by native WebCrypto HMAC-SHA256 challenges (`/api/altcha/challenge`) and client-side PoW solver. Completely zero cookies and GDPR/CCPA compliant.
- **Native In-App Confirmation Modals** — Eliminated browser-native `window.confirm()` popup alerts in favor of responsive dark glassmorphic confirmation dialogs with keyboard accessibility (`Escape`/`Enter`).
- **In-Dashboard Interactive API Documentation Hub** — Interactive live sandbox tester with real-time latency benchmark (ms), response payload viewer, parameter reference, and integration recipes.
- **Database Storage & Payload Pruning** — Automatically strip transient anti-spam fields (`altcha`, `honeypotField`, PoW challenge tokens) prior to Cloudflare D1 insertion, saving 40–60% database row size.
- **In-Browser DuckDB Live SQL Query Studio** — Zero-cost client-side analytical SQL query studio with 1-click execution over local datasets, DuckDB CLI query generator, and MotherDuck integration.
- **Zero-Dependency Floating Embed Widget (`/widget.js`)** — Ultra-lightweight (<3KB) floating feedback/contact popup widget for WordPress, Webflow, Shopify, Framer, Wix, Astro, and static HTML sites.
- **Real-Time Integration & Webhook Tester (`/api/forms/[formId]/test-webhook`)** — Interactive live delivery test and latency benchmark for Webhooks (with HMAC-SHA256 signatures), Google Apps Script (GAS), Telegram Bot, and ntfy.sh.
- **Zero-Card Free Tier Notifications** — Google Apps Script (GAS) Gmail relay (500–1,500 free emails/day + Google Sheets auto-logging), Telegram Bot instant mobile alerts, and ntfy.sh push topics.
- **Submission Lifecycle Management** — Full-featured `/api/submissions/[submissionId]` endpoint supporting real-time search (`?q=...`), status filtering (`all`, `inbox`, `spam`), bulk deletion, single deletion, and 1-click "Clear All Spam".
- **Dynamic Non-AJAX HTML Form Redirection** — Native support for `_next`, `_redirect`, and `next` hidden form fields with SSRF-safe redirect validation and glassmorphic browser thank-you pages.
- **Military-Grade Cryptographic Security** — AES-256-GCM encryption for SMTP passwords and secrets at rest, PBKDF2 (100,000 iterations) for password hashing, and HMAC-signed API keys and session tokens.
- **Multi-Format Submissions Export** — Direct 1-click exports in CSV, structured JSON, raw TXT reports, and PDF print formats.
- **Modern Kinetic F SVG Brand Assets** — Redesigned `logo.svg` and `favicon.svg` with modern obsidian squircle, cyber shield watermark, and high-contrast kinetic F monogram.
- **OpenAPI v3 Documentation** — Full interactive API specification published at `/api/openapi.json`.
- **Native RFC 6238 TOTP Two-Factor Authentication (2FA)** — Zero-dependency WebCrypto implementation with QR-ready `otpauth://` URI generator and constant-time HMAC-SHA1 verification.
- **Backblaze B2 & S3 Object Storage Integration** — 10GB free permanent storage on Backblaze B2 or Cloudflare R2 with binary magic-bytes signature verification to block disguised executables.
- **Webhook Observability & HMAC Delivery Logs** — Dedicated `webhook_logs` table, latency tracking (ms), HMAC-SHA256 headers (`X-FormForge-Signature`), and authenticated 1-click redelivery.
- **Smart Intent & Urgency Triage** — Zero-cost synchronous heuristic classifier automatically tagging submissions into 🚨 Urgent, 💼 Sales, 🛠️ Support, 💡 Feedback, and 💬 General.
- **Conversational Multi-Step Form Mode** — Standalone `/f/[slug]` support for interactive step-by-step questions with progress bar and keyboard shortcuts.
- **Real-Time Live Feed Ingestion Stream** — 25-second background polling stream in the dashboard with glowing live alerts and instant table updates.
- **AI-Ready Integration Architecture (`INTEGRATION_GUIDE.md`)** — One-shot prompt and complete recipes for Cursor, ChatGPT, Claude, Copilot, v0 across Next.js, React, Vue, Svelte, Astro, and HTML.

---

> **FormForge** — Developed by [Sudhir Singh](https://github.com/SudhirDevOps1)
> © 2024-2026 Sudhir Singh. All rights reserved.
