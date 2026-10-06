# Elowen’s Last Stand

A side-on browser defence prototype built with TypeScript, Phaser, and Vite. Elowen holds Greyfall’s bridge through three increasingly difficult waves while survivors escape.

## Run

Requires Node.js 22.12+ (validated on Node 24).

```sh
npm ci
npm run dev
```

## Controls

A/D: move. Space: jump. S: crouch. J: sword. L: hold shield. E: Ember Strike. 1: Ice Lance. 2: Warrior’s Shield. 3: Hunter’s Volley. 4: Stoneshard Barrage. 5: Wall of Vines. K: Shield Bash after unlocking. Escape: pause. Touch controls are available on narrow screens. Sound is optional and enabled by the header button.

Sword attacks hit enemies in front of Elowen. Blocking frontal strikes consumes stamina; Ember Strike consumes regenerating Chaos Energy. Zombies reaching the bridge cause health loss. Each wave evacuates five survivors. Between rounds select one of three upgrades. Clear the third wave to win; health reaching zero ends the run.

All six spells are separate casts with Chaos costs and individual cooldowns, shown on the clickable spell bar. Ember Strike starts unlocked. After wave one, choose Shield Bash, Warrior’s Shield, or Ice Lance; after wave two, choose Hunter’s Volley, Stoneshard Barrage, or Wall of Vines. The three-wave prototype therefore lets a run unlock two additional actions.

Ice Lance deals piercing impact damage and explodes at impact or maximum range. Warrior’s Shield is a six-second magical ward that halves enemy attack damage. Hunter’s Volley distributes four guaranteed radiant hits to enemies ahead. Stoneshard Barrage hits a short forward cone. Wall of Vines creates a physical barrier with health that zombies can destroy. Shield Bash shoves and staggers targets in front, spending stamina rather than Chaos. Values and timings are real-time adaptations rather than tabletop dice rules.

[Champion ability research](docs/champion-abilities.md) records printed effects, proposed adaptations, and path restrictions. Other Champion abilities remain candidates.

## Validation

```sh
npm run build
# Keep the development server running in another terminal:
npm test
```

The browser smoke test uses `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installation. It exercises movement, jumping, sword hits, shield defence, ranged damage and resource use, survivor escape, pause/resume, round upgrades, all six spells and their unlock/cooldown/resource gates, Shield Bash, victory, defeat and restart. Wave transition scenarios are arranged by the test; this is not an autonomous full gameplay balance test.

Scene and character artwork are generated specifically for this prototype. Detailed character poses currently use simple movement effects; full frame-by-frame combat animation is a later art pass. The uploaded reference images are visual direction and are not redistributed in the game. No backend, accounts or secret keys are required.

## Browser hosting

The GitHub Pages workflow builds and deploys the game when main is updated. Before the first deployment, choose GitHub Actions as the source under repository Settings → Pages. The game uses relative asset paths so it works beneath the repository URL. The game is published at https://jrdickson30-oss.github.io/elowens-last-stand/.
