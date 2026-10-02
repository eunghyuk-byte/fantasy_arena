# Card effect and description changes

When a card effect changes, update and verify its explanations in the same patch.

- Treat implemented effects and the user's approved specification as authoritative. Never change gameplay solely to match stale wording.
- Check `fantasy_arena/js/cards-data.js` card text and `CARD_LORE`, `js/game.js` ability help, card detail, catalogue hover and hand/board peek paths, and `index.html` rules help.
- Reuse current card text through the shared description path instead of copying effect text into another UI store. Flavor lore must not imply a removed effect.
- Render every regular card in a real browser. Card-face effect descriptions must fit within two lines at the existing font size. Do not clip, hide, or shrink text to conceal overflow. Report any wording decision that needs user approval. Detailed explanations may wrap and must remain readable in full.
- Preserve stats, card pool, artwork, frame geometry and effect rules outside the approved scope. Run the client regression suite and relevant server tests when mechanics/data compatibility changes.
- Include regression checks for affected descriptions and inspect desktop/mobile detail, hover, hand and zoom displays. Publication requires the user's applicable authorization.

- Keep the effect summary below the card name short and focused (at most two lines). Put full inclusion rules and exceptions in shared detailed descriptions used by detail/tooltip/peek views. Apply wording changes only within the approved card scope.
