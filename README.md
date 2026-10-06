# Elowen’s Last Stand

A side-on browser defence prototype built with TypeScript, Phaser, and Vite. Elowen holds Greyfall’s bridge through three increasingly difficult waves while survivors escape.

## Run

Requires Node.js 22.12+ (validated on Node 24).

```sh
npm ci
npm run dev
```

## Controls

A/D: move. Space: jump. S: crouch. J: sword. K: hold shield. L: Ember Strike. Escape: pause. Touch controls are available on narrow screens. Sound is optional and enabled by the header button.

Sword attacks hit enemies in front of Elowen. Blocking frontal strikes consumes stamina; Ember Strike consumes regenerating Chaos Energy. Zombies reaching the bridge cause health loss. Each wave evacuates five survivors. Between rounds select one of three upgrades. Clear the third wave to win; health reaching zero ends the run.

Chaosbound adaptations include Warrior’s Shield, Ice Lance and Hunter’s Volley. These prototype effects use real-time damage, costs and durations rather than the tabletop dice rules. Ice Lance adds a cold explosion every third ranged cast; Hunter’s Volley adds nearby radiant hits. Balance and character animation are still prototype work.

## Validation

```sh
npm run build
# Keep the development server running in another terminal:
npm test
```

The browser smoke test uses `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installation. It exercises movement, jumping, sword hits, shield defence, ranged damage and resource use, survivor escape, pause/resume, round upgrades, victory, defeat and restart. Wave transition scenarios are arranged by the test; this is not an autonomous full gameplay balance test.

Scene and character artwork are generated specifically for this prototype. Detailed character poses currently use simple movement effects; full frame-by-frame combat animation is a later art pass. The uploaded reference images are visual direction and are not redistributed in the game. No backend, accounts or secret keys are required.

## Browser hosting

The GitHub Pages workflow builds and deploys the game when main is updated. Before the first deployment, choose GitHub Actions as the source under repository Settings → Pages. The game uses relative asset paths so it works beneath the repository URL. Publication has not yet been performed.
