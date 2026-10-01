# Design loop: live progress

**Goal:** revamp Pixel Town's lobby and town screens into the Discord-led hybrid, including new fonts.
**Bar:** [bar.md](bar.md) · **System:** [design-system.md](design-system.md)
**References:** discord.com hero, themekaverse.com world-map hero

| # | Piece | Status | Round | Brief | System | Craft |
| - | --- | --- | - | - | - | - |
| 1 | Typography | ⏹ stopped by user (round 8 unfinished) | 7 | ❌ r7 | ✅ r7 | ✅ r7 |
| 2 | Lobby hero | ⏹ not started | – | – | – | – |
| 3 | Town chrome | ⏹ not started | – | – | – | – |
| 4 | Town side panels | ⏹ not started | – | – | – | – |

## Gap history

_(Each failed round records the single biggest gap handed back to the builder.)_

### Typography: round 1 (Archivo 125/900 display, Archivo body, Geist Mono chrome)
- **Brief ❌** Text drawn on the map collides (bubbles overlap bubbles, name tags cover zone labels), and in-map text shrinks to unreadable specks in the lobby preview and on mobile.
- **System ❌** Hero lines "CHAT THAT / LIVES" are rendered in near-Dim-grey. Primary text must be Snow/Fog. Side-panel headings sit off the scale (26–32px vs heading-sm 36).
- **Craft ✅** Beat the Discord hero on the bar (it wins on rules 6 and 7). Weakest point: the headline block is looser than line-height 0.9, and there are too many small sizes in the hero.

### Typography: round 2 (collision-free in-map labels, Fog→white headline, 36px panel headings)
- **Brief ❌** Display lines now collide: the É accent in "CAFÉ" notches the T above it, and each headline rule touches the next line's caps. Lobby-preview name tags use a blurrier face than in town.
- **System ❌** The three-step headline fade reads as forbidden gradient text. Mono falls under the 10px floor (emote key digits, timestamps, name tags).
- **Craft ✅** Ours beat Discord again. Weakest point: ~7 text sizes in the hero, and rules crowd the cap tops of the next line.
- **Orchestrator ruling:** bar rule 6 vs the system's "no gradient text" is resolved as solid colour per line, at most 2 distinct colours, no ramp.

### Typography: round 3 (accent clearance, two solid headline tones, crisp DPR canvases, mono ≥10px)
- **Brief ❌** In the 375px lobby preview, in-map labels pile up: tags overlap, the "Room chat + video" pill covers the map near "WAR ROOM", and "LANTERN CAFÉ" drifts away from the café.
- **System ✅** Soft notes: in-canvas bubbles at ~12–13px sit off the body scale, and the emote key digits still look ~8px.
- **Craft ✅** Ours won for the third time. Weakest point: headline pitch is ~1.0 because of the rules, and there are many form sizes.

### Typography: round 4 (fewer labels at mobile preview size, chip moved off-map, emote digits 11px)
- **Brief ❌** When two players stand close, bubbles stack on each other, detach from their speaker and point their tails at the wrong person. Zone labels drift off their rooms onto the walls.
- **System ❌** Secondary copy is 14px, off the documented scale. In-canvas text doesn't map to any system tier (bubbles 11–12px body, zone signs in the display face at ~11px).
- **Craft ✅** Ours won for the fourth time. Weakest point: the rules open the headline leading to ~1.05.
- **Doc correction (orchestrator):** design-system.md omitted the source's 14px base step. Restored body-sm 14 as a faithful fix to the transcription, not a loosening of the rules.

### Typography: round 5 (leader lines, zone signs inside rooms, bubbles body-14 / tags mono-11)
- **Brief ❌** Bubbles near the map edge jam into the frame and walls (town-room, town-whisper), and on mobile the key hint wraps, splitting "1-5" from "EMOTE".
- **System ❌** The "GO FOR A / WANDER" title is at ~0.75 line-height, below the 0.86 minimum.
- **Craft ✅** Ours won for the fifth time.

### Typography: round 6 (12px frame inset, unsplittable key-hint groups, Wander leading 0.95)
- **Brief ❌** On the 375px town map, bubbles cram together (Ana's covers Bo's; tails are ambiguous), and the "↑↓←→" keycap glyph renders as a smudge.
- **System ✅** Soft notes: the hint strip in Greyple reads close to primary guidance, and mono tracking looks positive.
- **Craft ✅** Ours won for the sixth time.
- **Orchestrator ruling:** the root cause is a 960px world squeezed to ~340px. The builder may fix it structurally with a mobile camera that zooms and follows the player, even though that goes beyond typography.

### Typography: round 7 (mobile follow-camera at native scale, arrow keycaps)
- **Brief ❌** The mobile hint row still wraps with a dangling "·". Bubbles are shifted sideways off their speaker to dodge other labels (town-room "right??…" jammed left, lobby preview "psst…" hugging the LANTERN CAFÉ pill).
- **System ✅** Soft notes: the headline rules differ from the panel titles, the hint strip is in Greyple, and mono tracking looks positive.
- **Craft ✅** Ours won for the seventh time.

### Run stopped by user during typography round 8
The round-8 builder was halted mid-edit. The only leftover (an unused constant) was removed, and all checks are green.
