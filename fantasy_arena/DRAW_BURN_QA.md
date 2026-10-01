# Full-hand draw presentation

Base: `9826f10168a1b093d8ec9e673e61aa646ddb52d4` (0.395).

## Behavior
- The existing `draw()` consumes each deck card exactly once. At hand size 10 or greater, the hand remains unchanged and the already-existing burn log is retained.
- Every overflow produces a common public presentation event: `{ seat: 1|2, id, name, sequence, source: 'deck' }`. Only the burned card is disclosed. No hand/deck arrays, private owner object, or unit state is serialized in this event.
- Both viewpoints show the owner's deck back traveling for the normal 720ms, reveal that card's front for 260ms, then reuse `CombatFx.play('death')`/`CombatMedia.fragments` for the 900ms torn-card effect. This never invokes `resolveDeath`, `destroyMinion`, deathrattles, rebirth, or kill rewards.
- Repeated and multi-card burns are drained in event order, once each. Ordinary draw animation and match overlays finish before burn playback. Opening draw remains 480ms (1.5x); normal draw remains 720ms.
- Empty-deck fatigue and generated-card overflow preserve their existing separate rules and do not invent a deck draw.
- `drawBurnPending()` includes queued and active events for the turn-ending wait gate. Cancellation uses match identity, game-over, and CombatFx generation/onCancel; ghosts are removed and old queues abandoned.

## Validation
- Node behavioral/DOM-clock tests cover both seats from both viewpoints at 390px and 1280px widths; front source, actual deck consumption, no hand changes, event order, repeated render, multi-draw + fatigue, new match, and cancellation during flight/reveal/tear.
- Focused burn + opening-layout suite: 33 passed, 0 failed.
- The original asset-light check had missing-file failures. Those assets and the exact historical Git blob have now been restored in the integrated checkout; its complete 420-test suite passes.
- Real Chromium candidate fffa9bbde5e86b9901eb41265cba50e555b6a019 passed two sequential burns from both seats, exact deck consumption, stable ten-card hands, queue order, end-turn waiting and restart cleanup. See V396_QA.md for the full integration coverage and platform limitations.

## Future online 1v1 integration contract
The current presentation is local/hotseat/AI. This patch does not claim authoritative server synchronization.
The eventual authoritative draw/burn resolver should broadcast the public burn event to both clients with match ID and the monotonically increasing sequence. Receivers must deduplicate by match/sequence and feed the same presentation queue, without consuming the deck or resolving game effects a second time. Private successful draws remain owner-only. Queue consumption is visual-only and must not determine game rules or disclose other hand cards. Match replacement invalidates the old event stream. Steam, Android and iOS should share this event contract and presentation code.
