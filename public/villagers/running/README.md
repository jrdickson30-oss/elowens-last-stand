# Chaosbound villager running animations

34 characters: one male and one female for each of the 17 Kin variants in the original villager set. Each clip has six poses in a three-column, two-row PNG sheet, with transparent alpha and a 100 ms frame duration (10 fps, 600 ms per loop). Read frames from left to right, then top to bottom.

Open `index.html` to preview the loops. Characters face and travel screen-left. Pause, speed, travel and Kin controls are available. The page works directly from disk and embeds its manifest, so no web server is required.

`manifest.json` lists the selected sheet for every character. Use its `image` field rather than guessing a filename: corrected sheets have a `-v2 or -v3` suffix. Per-character `*-run.json` files include grid dimensions, alpha bounds, frame durations, ground anchor, display scale and frame orientation. Honor `frameFlipX` when drawing each frame. The selected loops use leftward travel.

Render each cell relative to `anchor.x` and `frameGroundY[frame] (or anchor.groundY as a fallback)`. Natural bounce remains in the poses. `displayHeight / bodyHeight` gives the preview's scale, including smaller Kin and larger Ursa Major. All sheets preserve the supplied characters' clothes, colouring and species anatomy as generation references.

The source PNGs are AI-generated using the built-in ImageGen tool. Exact prompts are stored in `generation-prompts.json`; correction prompts are recorded in `correction-prompts.json` and `spacing-prompts.json`. `review.json` records the selected assets after visual inspection. `package.py` checks all 34 assets, their alpha channels, six distinct cells, frame bounds and identical public copies, then writes metadata and the standalone gallery.

Public copies are under `game/public/villagers/running/`. Gameplay uses these loops for rescued villagers. Each wave randomly selects five distinct appearances from all 34 characters and varies their starting animation phase. Movement, rescue and combat rules remain the same.
