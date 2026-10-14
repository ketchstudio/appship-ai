---
format: 1920x1080
duration: 30s
message: "Code xong app rồi? appship lo phần đưa lên App Store và Google Play."
arc: PAS with feature-benefit progression — hook → pain → product intro → 4 features → benefits montage → CTA
audience: "Viber coder và dev web BE/FE muốn làm app mobile nhưng bí ở khâu publish"
mode: autonomous
music: none
captions: skipped (silent video, no narration)
---

## Video direction

- **Silent, text-driven.** No voiceover, no music, no SFX. The on-screen text IS the script; each frame's `onscreen:` lists its text cues in order, and reveals are paced to those cues exactly as they would be to a voiceover — one cue at a time, spread across the frame, never front-loaded.
- **Tempo: fast.** Short frames (3–4s), snappy entrances (short `power3.out`/`power4.out` settles, ~0.25–0.4s), hard cuts and velocity-matched seams. A viewer must still be able to read every cue: each text cue holds ≥ 0.6s after it lands. Final cue of each frame holds at least 0.5s.
- **Palette (from `frame.md`).** Two registers only: DARK (ink-black `#0b1826` ground, cream `#e4ecf3` text, signal yellow `#ffc530` as the single accent) and YELLOW (yellow ground, ink-black text). Frames 3 and 9 are the YELLOW register; every other frame is DARK. Terminal windows (DARK frames) sit on `ink-black-alt` `#13283d` with a 1px `border-dark` `#20384f` edge, 0 radius, and may use `term-green` ✓ / `term-red` ✗ / `term-cyan` for paths — these semantic colors live ONLY inside terminal windows.
- **Type.** Archivo for all display/body, lowercase display weight 800–900 negative-tracked (Vietnamese diacritics must render — load Archivo with the vietnamese subset). IBM Plex Mono for terminal text and kickers (kickers uppercase, 0.14em). CLI commands are always mono and keep their exact spelling.
- **Motion grammar.** Long-tail `power3` default; no bounce/elastic. Kinetic type swaps by hard cut or zoom-through seam. Terminal lines appear line-by-line (type-on for commands, instant line drop for output). Only aliveness during a hold: subtle jitter at most, usually nothing. No lazy breathing, no slow back-half push/pan.
- **Rhythm / holds.** Frame 2 (pain) is the densest and builds to a claustrophobic crowd; frame 3 (product intro) is the release — a clean yellow field. Frame 8 is the staccato peak; frame 9 is the held landing (longest still read).
- **Negative list.** No Apple/Google logos (write "App Store", "Google Play" as text). No invented stats or user counts. No gradients, shadows, rounded cards, bokeh, purple-blue AI glow. No slideshow (everything at t=0 then frozen), no screensaver (independent floating). No infinite loops, no randomness.
- **Keep-out.** Plan important content in the top ~83% of the frame.

## Frame 1 — Hook

- scene: "app chạy ngon trên máy" lands, then hard-cuts to "rồi bạn bấm publish…"
- duration: 3s
- transition_in: cut
- type: hook
- status: animated
- src: compositions/frames/01-hook.html
- onscreen: "app chạy ngon trên máy." · [small terminal chip: "$ flutter run  ✓"] · "rồi bạn bấm publish…"
- blueprint: kinetic-type-beats (Adapt)
- focal: the hook line
- roles: terminal chip = supporting

Adapt: sub-shape B (multi-beat statement build), two beats, DARK register; beat 2 keeps the signature hard-cut swap and lands the key word in yellow.
Scene 1 (0.0–1.3s): DARK field. `h1` "app chạy ngon trên máy." enters left-anchored at upper-third via per-word staggered reveal, fast. At ~0.6s a small mono terminal chip "$ flutter run" types on beneath it and a green ✓ snaps in at the end (`discrete-text-sequence`). Asymmetric 70/30, headline dominant.
Scene 2 (1.3–3.0s): hard cut (`discrete-text-sequence`) — headline and chip gone; `display`-scale "rồi bạn bấm" on line 1, "publish…" on line 2 in yellow, scale-down slam from oversized to rest (`kinetic-beat-slam`), left-anchored. The ellipsis dots appear one by one (~0.15s apart). Holds still to the end.

## Frame 2 — Pain: buried in store paperwork

- scene: store requirements pile in from every side around the word "publish" until it is buried, then "kẹt." lands
- duration: 4s
- transition_in: cut
- type: pain_point
- status: animated
- src: compositions/frames/02-pain.html
- onscreen: center "publish" · tags in order: "AGE RATING", "APP PRIVACY", "DATA SAFETY", "SCREENSHOT 6.9\"", "EXPORT COMPLIANCE", "CONTENT RATING", ".P8 KEY", "SERVICE ACCOUNT JSON", "REVIEWER CONTACT", "FEATURE GRAPHIC", "TARGET AUDIENCE", "STAGED ROLLOUT", "App Store Connect", "Play Console" · final: "kẹt ở khâu publish."
- blueprint: overwhelm-surround (Adapt)
- focal: the closing crowd of requirement tags
- roles: tags = supporting · center word = cutout

Adapt: keep the accumulation-then-close-in signature (surrounded, not zoomed into); no avatar morph — the center word "publish" is the viewer's stand-in; tags are flat mono boxes (1px `border-dark`, 0 radius, cream text, two of them — "App Store Connect" and "Play Console" — rendered larger as console "windows" with a title bar line).
Scene 1 (0.0–0.4s): DARK field; small cream "publish" sits dead-center (continuing the previous beat's word, now small).
Scene 2 (0.4–2.6s): requirement tags pop in one after another (~0.15s apart, deterministic positions ringing the center, varied sizes, slight fixed rotations −4°..+4°) via `waterfall-entry`; the two console windows land at left and right edges. Density climbs to fill the frame.
Scene 3 (2.6–3.2s): everything closes in toward the center in lockstep (inverse of `center-outward-expansion`), tags overlapping and dimming to ~35% opacity; "publish" is buried.
Scene 4 (3.2–4.0s): `h1` "kẹt ở khâu publish." slams in over the dimmed crowd, left-anchored at upper-third, "kẹt" in yellow (`kinetic-beat-slam`). Holds still.

## Frame 3 — Product intro

- scene: yellow field; "appship." slams in, then "một file config. hai store."
- duration: 3s
- transition_in: zoom-through
- type: product_intro
- status: animated
- src: compositions/frames/03-intro.html
- onscreen: kicker "APPSHIP-AI · CLI · CHẠY TRÊN FASTLANE" · "appship." · "một file config. hai store." · "App Store + Google Play"
- blueprint: kinetic-type-beats (Adapt)
- focal: wordmark "appship."
- roles: wordmark = cutout

Adapt: Product_Intro name-drop on the YELLOW register (frame.md Cover treatment): ink on yellow, left-anchored, rule stub + mono kicker. Signature: the name lands as the resolve.
Scene 1 (0.0–0.9s): YELLOW field. `display` "appship." in ink slams in from oversized to rest (`kinetic-beat-slam`), left-anchored slightly above center; the final "." snaps in a beat later.
Scene 2 (0.9–1.8s): 36×2 ink rule stub draws left→right above the wordmark and the mono kicker "APPSHIP-AI · CLI · CHẠY TRÊN FASTLANE" types on next to it, 55% ink.
Scene 3 (1.8–3.0s): lead line "một file config. hai store." reveals per word beneath the wordmark, 75% ink, then a mono sub-line "App Store + Google Play" follows. Holds.

## Frame 4 — Feature: appship init

- scene: terminal window; `appship init` types, detection output lines drop in, release/ folder tree appears
- duration: 3.5s
- transition_in: push-slide
- type: feature_showcase
- status: animated
- src: compositions/frames/04-init.html
- onscreen: kicker "01 / TỰ NHẬN DIỆN DỰ ÁN" · h2 "init một lần là xong." · terminal: "$ appship init" → "✓ framework  flutter" → "✓ bundle id  com.you.app" → "✓ package    com.you.app" → "✓ release/ created" → tree "release/ ├ release.yml ├ questionnaire.yml └ ios/ android/ metadata"
- blueprint: prompt-type-submit-generate (Adapt)
- focal: terminal window
- roles: terminal = cutout · headline = supporting

Adapt: keep "watch me ask, watch it answer" — command types into the terminal and the machine answers with an action log; no chat UI, the terminal is the product input.
Scene 1 (0.0–0.6s): DARK field. Left column (~35%): mono kicker "01 / TỰ NHẬN DIỆN DỰ ÁN" in yellow + `h2` "init một lần là xong." (per-word reveal). Right (~60%): terminal window slides in from right and settles.
Scene 2 (0.6–1.3s): "$ appship init" types on with caret (`discrete-text-sequence`, fast ~25 chars/s).
Scene 3 (1.3–2.6s): output lines drop in one by one (~0.25s apart), each ✓ green, labels cream-muted, values cream (`dynamic-content-sequencing`).
Scene 4 (2.6–3.5s): the release/ tree prints beneath in term-cyan/cream; `release.yml` highlighted with a yellow left bar. Holds.

## Frame 5 — Feature: answer the store questions once

- scene: questionnaire.yml in the middle feeds two panels: App Store (filled via API ✓✓✓) and Google Play (CHECKLIST.md ready to paste)
- duration: 3.5s
- transition_in: cut
- type: feature_showcase
- status: animated
- src: compositions/frames/05-questionnaire.html
- onscreen: kicker "02 / QUESTIONNAIRE.YML" · h2 "trả lời câu hỏi của store một lần." · left panel "App Store" — "tự điền qua API": "age rating ✓", "app privacy ✓", "export compliance ✓" · right panel "Google Play" — "CHECKLIST.md": "data safety → copy", "content rating → copy", "target audience → copy" · pills: "TỰ ĐỘNG" (left), "CÓ SẴN ĐÁP ÁN" (right)
- blueprint: comparison-split (Adapt)
- focal: the two panels
- roles: panels = cutout · headline = supporting

Adapt: keep the mirrored split-tilt entry from opposite wings + inner-edge pill spring signature (`split-tilt-cards`); panels are flat sharp rectangles (frame.md compare-panel): left dark panel with 1px border, right panel YELLOW payoff fill with ink text.
Scene 1 (0.0–0.7s): DARK field. Kicker + `h2` "trả lời câu hỏi của store một lần." reveal at upper area, left-anchored (per-word).
Scene 2 (0.7–1.5s): two panels enter from opposite wings with mirrored rotationY tilts and flatten side by side (`split-tilt-cards`), titles "App Store" / "Google Play" visible.
Scene 3 (1.5–2.8s): rows fill in both panels in alternating order (~0.2s apart); left rows end with green ✓, right rows end with "→ copy" (`dynamic-content-sequencing`).
Scene 4 (2.8–3.5s): inner-edge pills "TỰ ĐỘNG" and "CÓ SẴN ĐÁP ÁN" pop on each panel's inner edge (short spring, no wobble). Holds.

## Frame 6 — Feature: appship doctor

- scene: `appship doctor` runs; check rows land; one ✗ flips to ✓; ends "0 errors"
- duration: 3.5s
- transition_in: push-slide
- type: feature_showcase
- status: animated
- src: compositions/frames/06-doctor.html
- onscreen: kicker "03 / APPSHIP DOCTOR" · h2 "bắt lỗi trước khi store bắt." · terminal: "$ appship doctor" → "✓ ios title ≤ 30 chars" → "✓ screenshots 1320×2868" → "✗ TODO placeholder in description" → "✓ keys not committed to git" → "✓ android locales valid" → then the ✗ row flips to "✓ no placeholder text" → summary "ready to release · 0 errors"
- blueprint: agent-progress-theater (Adapt)
- focal: terminal check list
- roles: terminal = cutout · headline = supporting

Adapt: keep the receipt cascade whose rows CHECK OFF (badge flips) signature; trigger is the typed command; the working theater is a short mono spinner line "checking…" (finite, deterministic frame steps).
Scene 1 (0.0–0.6s): DARK field; terminal (left ~60%) already settled; right column kicker + `h2` "bắt lỗi trước khi store bắt." reveal (per-word). "$ appship doctor" types on.
Scene 2 (0.6–2.3s): rows drop in one by one (~0.3s apart) — ✓ green, the ✗ row red with a red left bar.
Scene 3 (2.3–2.9s): the ✗ row flips: red ✗ → green ✓, text swaps to "no placeholder text" (`scale-swap-transition`), red bar turns green.
Scene 4 (2.9–3.5s): summary line "ready to release · 0 errors" lands in yellow under a 1px rule. Holds.

## Frame 7 — Feature: upload and submit

- scene: `appship upload --build` → TestFlight ✓ and Google Play internal ✓ with rollout bar; then `appship submit` → sent to App Review ✓
- duration: 3.5s
- transition_in: cut
- type: feature_showcase
- status: animated
- src: compositions/frames/07-ship.html
- onscreen: kicker "04 / BUILD → UPLOAD → SUBMIT" · h2 "một lệnh đẩy lên cả hai store." · terminal: "$ appship upload --build" → "▸ ios      .ipa  → TestFlight   ✓" → "▸ android  .aab  → internal     ✓" → rollout bar "rollout 20%" → "$ appship submit" → "✓ iOS sent to App Review" → "✓ Android promoted to production"
- blueprint: prompt-type-submit-generate (Adapt)
- focal: terminal
- roles: terminal = cutout · headline = supporting

Adapt: two quick command→answer round trips in one terminal; the second command starts right after the first answer (the blueprint's "second command before the cut").
Scene 1 (0.0–0.5s): DARK field; kicker + `h2` top-left (per-word); full-width terminal below (~80% width) already present.
Scene 2 (0.5–1.0s): "$ appship upload --build" types on (fast).
Scene 3 (1.0–2.0s): ios line then android line drop in; each ✓ snaps green; a thin yellow rollout bar fills 0→20% with a mono "rollout 20%" label (`stat-bars-and-fills`).
Scene 4 (2.0–2.5s): "$ appship submit" types on.
Scene 5 (2.5–3.5s): two ✓ result lines drop in. Holds.

## Frame 8 — Benefits montage

- scene: staccato benefit phrases flash one after another at high tempo, alternating dark/yellow ground
- duration: 3s
- transition_in: cut
- type: benefit_highlight
- status: animated
- src: compositions/frames/08-benefits.html
- onscreen: "--dry-run trước khi gửi." · "key an toàn, không lọt git." · "flutter · react native · cocos · native" · "skill cho claude code, codex, antigravity" · "sẵn sàng cho CI."
- blueprint: kinetic-type-beats (Adapt)
- focal: the current phrase
- roles: phrases = cutout

Adapt: Benefits staccato variant, slowed to 5 beats (~0.6s each) so Vietnamese stays readable; keep in-place hard-cut beats + bg flips with inverted text color as the signature. This is the one frame allowed to alternate registers beat-by-beat (dark → yellow → dark → yellow → dark).
Scene 1..5 (0.0–3.0s, 0.6s each): each phrase lands centered at `h1`/`h2` scale (fit-to-measure, ≤78cqw) with a short scale-down slam (`kinetic-beat-slam`), hard cut to the next with the ground flipping register; mono parts ("--dry-run") rendered in IBM Plex Mono. Last phrase holds.

## Frame 9 — CTA

- scene: yellow field; "appship." with install command block and site URL
- duration: 3.5s
- transition_in: zoom-through
- type: cta
- status: animated
- src: compositions/frames/09-cta.html
- onscreen: "ship app của bạn." · install block "$ npm i -g appship-ai" · "appship.ketchsoft.com" · "mã nguồn mở · MIT · v0.2.0"
- blueprint: prompt-type-submit-generate (Adapt)
- focal: install command block
- roles: command block = cutout · headline = supporting

Adapt: the install-command CTA end card variant: the ask itself is the show — the command types into an ink block and the clip holds at the submit.
Scene 1 (0.0–0.8s): YELLOW field. `h1` "ship app của bạn." lands left-anchored at upper third (per-word, fast).
Scene 2 (0.8–2.0s): an ink-black block (0 radius) slides up beneath; inside, "$ npm i -g appship-ai" types on in yellow mono with a caret (`discrete-text-sequence`, `context-sensitive-cursor`).
Scene 3 (2.0–2.8s): mono "appship.ketchsoft.com" (ink, uppercase not required for URL) and sub-line "mã nguồn mở · MIT · v0.2.0" (55% ink) reveal beneath.
Scene 4 (2.8–3.5s): caret keeps a deterministic blink (finite steps) — everything else still. Final hold.
