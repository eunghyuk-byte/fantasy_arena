# Zhuge A local integration, publication pending

Base main: c14a5a45451e5666f77d4058339229aa01c84aa6 (v0.383).
Isolated branch: zhuge-a-v384. Intended release: v0.384, Zhuge l4 A only.
Version/cache strings are v0.384. Publication approved after the headless real-media QA below.

User-provided local input: ../user_assets/zhuge_l4_A_runtime_v2.zip.
Verified size: 3411033 bytes.
Verified SHA256: bda3e7b93a0d9a1654833808e112258405db9fc3bfb29626a46dbcf77ce3de22.
The earlier missing-file report came from checking user-assets; the actual folder uses an underscore, user_assets. Found by the authorized exact-name search of Downloads and task/task-2 plus immediate child folders only.

Installed the four unchanged l4 runtime files (meta.json, summon.webm, sfx.mp3, sfx.ogg), registered l4, and updated manifest entries/count. Existing Red video renderer is reused; no prior native l4, Green, Zhang, combat-prep or match-prep code was imported. No gameplay data changed. l4 supplies enemyUids=[] and has no enemyMute, damage, silence or deferred enemy views.

Automated validation: 156 frontend tests pass, including both sides' l4 state preservation, enemyUids=[], input/overlay lock release on failed assets, manifest sizes, real metadata dimensions and a synthetic repeat/opaque-decoder test. Existing f15 and Red regressions remain passing. Tests simulate video events: they do not decode or display the real WebM.

Headless real-media QA is now available using the preinstalled Playwright package and Chrome 154.0.8037.58, with a fresh temporary browser context and localhost-only requests. The initially restricted execution stalled during initialization; the authorized local QA run outside that execution restriction completed. No user browser session, credentials, browser/OS installation or settings were used.

Actual WebM decoding: 1280x720, 2 seconds; sampled frame has 614393 fully transparent, 305848 partial-alpha and 1359 opaque pixels. Four real game summons (player/opponent twice each) all returned true. Recorded canvas dimensions were 1500x843.75; player offset -219.375 and opponent +219.375/vertical flip matched actual card-slot centers. Two 1920x1080 screenshots were inspected. Each normal run started one owned audio handle, left enemy state unchanged and ended with no canvas, pending job or input/overlay lock. First summon elapsed about 2.47s including preparation; subsequent runs about 2.04s. Clear and hideScreens during playback and an aborted video request also released ownership. No page errors.

Both MP3 and OGG decode to 2 seconds, mono, 48kHz. Sample peaks are 0.52190/0.53428 and RMS 0.08020/0.08388. These are decode/sample checks, not listening or perceptual audiovisual synchronization approval.

Evidence is stored in task-2/zhuge-headless-evidence (report.json, player.png, opponent.png); reproducible local runner is task-2/zhuge-headless-qa.cjs. The runner uses this isolated worktree, not a remote deployment.

Remaining unverified: human audio listening/perceptual sync, Safari and other browser engines, actual hidden-tab lifecycle, mute/volume settings, non-1920 viewport/device behavior and comparison with the approved preview. Parent approved v0.384 publication after reviewing these results. Intended release scope remains Zhuge l4 A only, v0.384.

Transfer diagnosis (no helper execution or workaround in this task):
- Current official Library SKILL.md and materialization.md still require metadata/xattr preservation; no Windows sidecar or alternate metadata route is documented there. Helper implementation was not inspected or changed.
- Current interpreter is Python 3.12.14 on Windows; hasattr(os,'setxattr') is false. This confirms the missing platform API behind the previously reported metadata failure. No new transfer/error traceback was generated.
- A Library HTTP 403 is a file-access/scope rejection, distinct from the Python metadata compatibility failure. No denied file was retried.
- The user's cloud message says environment creation is unavailable for the current workspace; it does not establish a file permission denial or the workspace type. No security/account settings were changed.
- wsl.exe exists, but its read-only list command reports WSL is not installed. docker was not found on PATH. No alternate Linux runtime was provisioned.

The Library skill explicitly routes user-provided local files to local tools. This input did not use a Library URL, helper patch, omitted transfer metadata, or a credential workaround.
