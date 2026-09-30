# Zhuge A local integration, publication pending

Base main: c14a5a45451e5666f77d4058339229aa01c84aa6 (v0.383).
Isolated branch: zhuge-a-v384. Intended release: v0.384, Zhuge l4 A only.
Version/cache strings remain v0.383 until the real playback gate is completed. No push performed.

User-provided local input: ../user_assets/zhuge_l4_A_runtime_v2.zip.
Verified size: 3411033 bytes.
Verified SHA256: bda3e7b93a0d9a1654833808e112258405db9fc3bfb29626a46dbcf77ce3de22.
The earlier missing-file report came from checking user-assets; the actual folder uses an underscore, user_assets. Found by the authorized exact-name search of Downloads and task/task-2 plus immediate child folders only.

Installed the four unchanged l4 runtime files (meta.json, summon.webm, sfx.mp3, sfx.ogg), registered l4, and updated manifest entries/count. Existing Red video renderer is reused; no prior native l4, Green, Zhang, combat-prep or match-prep code was imported. No gameplay data changed. l4 supplies enemyUids=[] and has no enemyMute, damage, silence or deferred enemy views.

Automated validation: 156 frontend tests pass, including both sides' l4 state preservation, enemyUids=[], input/overlay lock release on failed assets, manifest sizes, real metadata dimensions and a synthetic repeat/opaque-decoder test. Existing f15 and Red regressions remain passing. Tests simulate video events: they do not decode or display the real WebM.

Remaining publication gate: real browser alpha and actual player/AI slot alignment, vertical flip/offset, 2-second sound/video synchronization, repeat and screen/state cancellation, hidden tab, missing-video fallback and sound settings. No supported PC browser/computer QA tool is exposed in this session; no real playback success is claimed. After that gate, update GAME_VERSION and cache URLs to 0.384, write release notes, rerun checks, verify remote main has not moved, then use an ordinary fast-forward push.

Transfer diagnosis (no helper execution or workaround in this task):
- Current official Library SKILL.md and materialization.md still require metadata/xattr preservation; no Windows sidecar or alternate metadata route is documented there. Helper implementation was not inspected or changed.
- Current interpreter is Python 3.12.14 on Windows; hasattr(os,'setxattr') is false. This confirms the missing platform API behind the previously reported metadata failure. No new transfer/error traceback was generated.
- A Library HTTP 403 is a file-access/scope rejection, distinct from the Python metadata compatibility failure. No denied file was retried.
- The user's cloud message says environment creation is unavailable for the current workspace; it does not establish a file permission denial or the workspace type. No security/account settings were changed.
- wsl.exe exists, but its read-only list command reports WSL is not installed. docker was not found on PATH. No alternate Linux runtime was provisioned.

The Library skill explicitly routes user-provided local files to local tools. This input did not use a Library URL, helper patch, omitted transfer metadata, or a credential workaround.
