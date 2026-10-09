# Elowen’s Last Stand

A side-on browser defence prototype built with TypeScript, Phaser, and Vite. Elowen protects refugees through a ten-level campaign, with three waves per level, from Greyfall Town to her final stand at the river crossing.

## Run

Requires Node.js 22.12+ (validated on Node 24).

```sh
npm ci
npm run dev
```

## Controls

A/D: move. W: jump. S: crouch. J: sword. W + J: rising attack. Press J again in the air: suspended spinning slash. S + J in the air: downward slash. L: hold shield. E: Ember Strike. 1: Ice Lance. 2: Warrior’s Shield. 3: Hunter’s Volley. 4: Stoneshard Barrage. 5: Wall of Vines. U/I/O/K: Champion abilities after unlocking. K can hold Shield Bash, Sentinel Initiate, or a fourth general active ability. Escape: pause. Touch controls are available on narrow screens. Sound is optional and enabled by the header button.

Sword attacks hit enemies in front of Elowen. Blocking frontal strikes consumes stamina; Ember Strike consumes regenerating Chaos Energy. Zombies reaching the bridge cause health loss. Each wave evacuates five survivors. Clear all three waves of a level to choose one spell, Champion ability, or rank upgrade. Clear level ten’s final wave to reach Elowen’s sacrifice ending; health reaching zero ends the run.

All six spells are separate casts with Chaos costs and individual cooldowns, shown on the clickable spell bar. Ember Strike starts unlocked. After each of the first nine levels, choose one new spell, Champion ability, or rank upgrade. All choices are permanent for that run.

General Champion abilities fill U, I, O, then K. If K is empty, it can instead hold Shield Bash or Sentinel Initiate; those two choices exclude each other. Once K is committed, it cannot be replaced. Skipping both shield talents leaves K available for a fourth general active, so no button is wasted. Protector is passive and does not consume a button. Owned Champion abilities can be upgraded to rank three without changing their identity or assigned key. There are no loadout swaps between waves or levels.

Ice Lance deals piercing impact damage and explodes at impact or maximum range. Warrior’s Shield is a six-second magical ward that halves enemy attack damage. Hunter’s Volley distributes four guaranteed radiant hits to enemies ahead. Stoneshard Barrage hits a short forward cone. Wall of Vines creates a physical barrier with health that zombies can destroy. Champion abilities use stamina without cooldowns, except Rallying Cry, which costs no stamina and has a 10-second cooldown (8 and 6 seconds at higher ranks). Sentinel Initiate can be thrown again once the shield returns. Reusing Battle Focus or Strike Through refreshes its duration. Shield Bash shoves and staggers targets in front, spending stamina rather than Chaos. Values and timings are real-time adaptations rather than tabletop dice rules.

Elowen starts at level one and gains a level after completing all three waves of the previous level. Champion progression adds 12 maximum SP (health) per level, reaching 208 at level ten. Extra weapon dice at levels 2, 8, and 10 become fixed average damage bonuses; armour milestones reduce enemy attack damage. The HUD shows health/stamina/Chaos bars and Elowen’s level/title, alongside location and wave. The level-up screen shows health and sword changes; PB, AR, and dice statistics are not shown during play. [Character progression](docs/character-progression.md) records the source table and real-time adaptations.

[Champion ability research](docs/champion-abilities.md) records printed effects, proposed adaptations, and path restrictions. The selected Champion abilities are implemented with the game-specific changes requested by the user.

## Campaign

| Character levels | Environment | Objective |
| --- | --- | --- |
| 1–2 | Greyfall Town | Help refugees flee the attacking dead. |
| 3–5 | Grasslands | Protect the caravan across open country. |
| 6–8 | River Road | Keep the route to the crossing clear. |
| 9–10 | Greyfall Crossing | Hold the bridge until the last refugees escape. |

There are three waves in every level (30 in total) and nine character upgrade choices. Waves two and three add two and four enemies respectively to that level’s base count. Enemy types and baseline speed scale with character level. Wave breaks refill stamina/Chaos; health carries over. A character level adds 12 current/maximum SP plus the existing 22 SP recovery, capped at maximum health.

Clearing the final wave starts a short scripted ending: Elowen destroys the bridge and sacrifices herself, then the campaign epilogue appears. This is a completed campaign rather than a combat defeat. Restart clears the story state and returns to level one in town.

## Validation

```sh
npm run build
# Keep the development server running in another terminal:
npm test
```

The browser checks include rendered-pixel comparisons for material motion, stationary masonry, ground alignment, animated bridge destruction, pause/resume and texture cleanup. The browser smoke test uses `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installation. It exercises movement, jumping, sword hits, shield defence, ranged damage and resource use, survivor escape, pause/resume, round upgrades, all six spells and their unlock/cooldown/resource gates, permanent Champion choices, rank upgrades, all Champion effects, a flexible K slot, all 30 waves, four environment sections, Elowen’s sacrifice ending, all ten character levels, health growth and recovery, weapon/armour milestones, victory, defeat and restart. Wave transition scenarios are arranged by the test; this is not an autonomous full gameplay balance test.

Elowen’s playable sprite is adapted from the user-supplied pixel sprite and character design sheet: golden hair, pointed ears, silver armour, navy-and-gold cloak and kite shield, and blue jewellery. The bridge backdrop and enemy artwork were generated for the prototype. All five detailed scene backgrounds in `public/scene-art/` are now used in play. Their walking surfaces are aligned to the shared gameplay floor. Both town stages have an open cobblestone market square with a well and market awnings in the foreground. The walking lane meets the square without a boundary wall, and the town foreground has no river effects. Clouds drift; separate transparent bough sprites in `public/scene-art/wind-bough.png` sway around fixed attachment points while trunks stay still. Small grass sprites pivot at their roots. The river artwork stays completely still: sparse four-frame foam and sunlight sprites drift slowly towards the viewer over it, with no full-water displacement, crossfade or brightness pulse. Town fires flicker with rising smoke and embers, with more fires in the level-two variant. A masked WebGL pass animates clouds and town fires on a crisp two-pixel grid while fixed architecture retains full display detail. Pausing freezes ambient motion. Scene transitions release temporary render textures. Canvas-only browsers retain the artwork, foliage/grass/ripple sprites, smoke, embers and a simple fire flicker; cloud and detailed fire effects require WebGL. Procedural scenery remains as a fallback if an art texture is unavailable.

Elowen’s idle animation uses the supplied six-frame sheet in `public/elowen-idle/`: 192 × 208 pixel cells, 220 ms per frame, looping while standing still. A shared transparent-margin crop keeps her feet and 96-pixel display height consistent. Facing left mirrors the sheet; pausing freezes the animation. The supplied action sheets in `public/elowen-jump/`, `public/elowen-sword-attack/`, `public/elowen-sword-thrust/` and `public/elowen-strike-through/` now animate jumping and sword attacks. Normal attacks alternate slash and thrust. Their relative frame timings are fitted to the existing 0.42-second sword cadence, with hit timing and damage unchanged. Each clip has one body-based scale, excluding transparent padding and overhead swords, so Elowen stays close to her existing 96-pixel standing height. Jump poses follow the physics ascent/apex/descent and play a brief landing; their baked vertical motion is compensated with per-frame foot anchors. Strike Through uses the matching slash poses and supplied separate energy layers on effect frames 3 and 4. Only the energy width extends to the actual 230-pixel hit limit in either direction, using the range and facing captured at attack start. Pausing freezes every pose and effect; a new wave/run clears them and resets the slash/thrust cycle. Normal movement and movement with a raised shield use separate six-frame walking loops. Holding S lowers Elowen through six crouch poses and holds the final stance; releasing S reverses the transition. Crouch poses retain a fixed character scale and planted feet. Pause freezes every transition. The original upload is also available as `public/Elowen-idle-assets.zip`. The full character reference sheet is not included in the published game. No backend, accounts or secret keys are required.

## Browser hosting

The GitHub Pages workflow builds and deploys the game when main is updated. Before the first deployment, choose GitHub Actions as the source under repository Settings → Pages. The game uses relative asset paths so it works beneath the repository URL. The game is published at https://jrdickson30-oss.github.io/elowens-last-stand/.

Startup shows artwork-loading progress. Startup exceptions show the error with reload and basic graphics options. Add `?renderer=canvas` to force the Canvas renderer when GPU initialization fails; gameplay and supplied hero animations still work, with the Canvas scenery effects described above. If an older page stays blank after a deployment, try Ctrl + Shift + R.

Elowen’s six-frame shield-block sheet in public/elowen-block/ raises the shield when L is held, settles into a sustained brace, and plays recoil/recovery only when an enemy attack is successfully blocked. It mirrors with facing, keeps a fixed body scale and foot anchors, freezes when paused, and clears on release, shield throw, wave change or restart. Existing damage checks and stamina costs are unchanged.

Holding S while pressing J uses a dedicated six-frame crouching sword slash matching the standing slash sequence. Its bent-knee poses use a fixed body scale and measured foot anchors, and recover into the held crouch. The sword cadence, damage and 115/230-pixel normal/Strike Through ranges are unchanged. Strike Through retains its separate energy effect while crouched.

Holding S + L uses a dedicated six-frame crouching block: raise, brace, impact recoil, recover and hold. It stays crouched during movement, mirrors with facing, keeps a fixed body scale and measured foot anchors, and transitions back to standing block or crouch when S or L is released. Damage checks and stamina costs are unchanged.

Holding S with A or D plays a six-frame crouched walk after lowering into the crouch. It loops with fixed scale and measured foot anchors, mirrors with facing, and returns to crouch on stopping. Crouched blocks and sword attacks take priority. Standing up restores normal walking. The existing 90 px/s crouched movement speed is unchanged.

The standard Zombie uses a dedicated six-frame walk in public/zombie-walk/: one arm outstretched and a stiff trailing leg dragged behind. Each enemy advances its own walk clock only while moving; pause, stun, roots, walls and contact with Elowen hold the current pose. Per-frame belt and ground anchors keep the body and feet aligned at a fixed 104-pixel display height. Other enemy types retain their existing artwork. The slow shuffle is isolated in ZombieAnimator for a later two-arm fast gait. Open /zombie-walk/ for a looping preview; generation prompts and clip timings are saved beside the sheet. Run node tests/zombie-animation.mjs against the dev server to check the animation and stopping conditions.

Press W + J together for Elowen’s rising sword attack. A 100ms allowance accepts either input order; upgrading a just-started sword swing preserves its hit list to avoid duplicate damage. Nine poses turn her whole body through 360 degrees during the physics jump, showing front, side and back views before returning to her original facing. The sword and cape follow the rising spin. Front melee contact resolves immediately, then a swept vertical-capsule hit test follows the arc through enemies above and behind, once per target. Strike Through selects a separate blue-energy sheet and doubles the range. Direction, damage, roots and range are captured at launch; block or Ember cancels the attack, and pause freezes it. New waves, death and restart clear the state. The normal and blue spin sheets are in public/elowen-spiral-attack/ and public/elowen-spiral-strike-through/.

One fresh attack press per jump while airborne starts another full-body spin, suspending vertical motion for 0.4 seconds and using the direction captured at jump launch. Presses during the rising attack or follow-up spin buffer the next move until the current animation completes. Further normal attack presses are ignored until she lands, including presses during the spin; a queued downward slash remains available. Holding attack does not automatically chain spins. Afterwards the normal falling pose and downward velocity resume. Crouch + attack instead selects a six-pose overhead downward slash: a brief suspended windup, fast descent, then a ground impact and recovery. The impact hits every ground enemy within 45 pixels behind or the normal forward sword range, once each; Strike Through doubles forward reach and adds blue streaks. Blocking, casting Ember, wave transitions, death and restart clear the combo. Touch Sword/Crouch buttons use the same inputs. The normal and blue downward-slash sheets are in public/elowen-downward-slash/ and public/elowen-downward-strike-through/.

Zombies now recoil when damaged. The standard Zombie plays a dedicated six-frame hit reaction in public/zombie-hit/ (0.42 seconds): impact, backward stagger and recovery into its saved walking pose. Repeat hits restart the reaction in the new impact direction. Other enemy types recoil using their own artwork. Pause freezes the reaction; stun and roots do not prevent recovery. Damage, knockback distance and combat timing are unchanged. The /zombie-walk/ preview includes a Hit Zombie button. Run node tests/zombie-hit.mjs to verify sword and spell hits, recovery, pause and impact direction.

Zombie deaths now play a 0.7-second backward fall, settle on the floor, dissolve into bones over 1.2 seconds, leave the skeleton visible for 1.5 seconds, then fade out. The standard Zombie uses dedicated six-frame sheets in public/zombie-fall/ and public/zombie-decompose/. Other enemies fall using their own artwork and dissolve to bones. Remains are separate from living enemies, cannot attack or take damage, freeze on pause, and clear on restart/location change. Wave completion waits until the last corpse reaches its bones stage. Airborne kills land on the gameplay floor. The /zombie-walk/ preview includes a Kill Zombie button. Run node tests/zombie-death.mjs for the death sequence and lifecycle checks.

Standard Zombie deaths alternate between the normal fall and a severed-head/arm fall with blood splatter. The detached arm lands beside the feet and stays on the ground through decomposition; the skull and arm remain separate as bones. The new sheets and generation prompts are in public/zombie-severed-fall/ and public/zombie-severed-decompose/. Per-frame crop rectangles preserve the full falling poses and isolate neighbouring sprites; ground anchors keep resting hands supported on the floor. The cycle continues across waves, advances only on a standard Zombie kill, and resets on a new run. The preview's Kill Zombie button alternates between the same two deaths. Run node tests/zombie-death-variants.mjs for cycling, clip selection and floor alignment.
