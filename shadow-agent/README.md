# ছায়ার এজেন্ট — SHADOW AGENT

An original 2D spy-stealth game that runs entirely in the browser. You play a
young hacker whose life changes when a file lands in the wrong hands. Three
missions, hand-to-hand combat, shadows, vision cones, alarms, takedowns and a
final boss — with the story told in Bengali cutscenes.

This is original IP. Nothing is copied from any existing film or game; the
"spy origin" *feel* is there, but every character, name and event is new.

## Play

Open `index.html` in any modern browser, or serve the folder:

```bash
python3 -m http.server 12000
# then open http://localhost:12000/
```

## Controls

| Action | Keyboard / Mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | `WASD` / arrows | Left stick / D-pad | Left virtual stick |
| Sneak | `Shift` | `B` / `L1` | Sneak button |
| Light punch | `J` / left click | `X` | 👊 button |
| Heavy kick | `K` / right click | `Y` | 🦵 button |
| Dodge | `Space` | `A` | ↩ button |
| Takedown | `E` | `R1` | 🎯 button |
| Pause | `P` / `Esc` | `Start` | ⏸ button |

Dark tiles are shadow: enemies cannot see you while you stand in them.

## Missions

1. **আকাদেমি (The Academy)** — steal the encrypted file, reach the safe point.
2. **রাতের দূতাবাস (Night Consulate)** — no bodies, get the dossier.
3. **ঢাল ভাঙা (Shield Breaker)** — take down the traitor's protector.

## Tests

The gameplay logic is covered by a headless suite (`node tests/game.test.js`),
which loads the real `<script>` out of `index.html` in a `vm` sandbox and
exercises movement, walls, vision, combat, takedowns, objectives, win flow,
all three levels and the renderer.
