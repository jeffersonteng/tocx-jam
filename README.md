# ToCX JAM 🏀🤖

A Mega Man × NBA Jam style 1-on-1 robot basketball game for phone browsers.
Pick your Tournament of Champions robot master, take on the CPU, and JAM.

**Play it:** open `index.html` on any static host (GitHub Pages works great).
Best played on a phone in **landscape**.

## How to play

90-second games. 2 points inside the arc, 3 beyond it. Ties go to sudden
death — next basket wins. Score 3 in a row and you're **ON FIRE**.
Goaltending is 100% legal.

### Touch (phone)

| Button | With the ball | Without the ball |
|---|---|---|
| **SHOOT / STEAL** | Hold to jump, release at the apex to shoot. Tap near the rim to **dunk**. | Swipe at the carrier up close to steal. |
| **JUMP** | Jump | Jump to block or goaltend shots |
| **PWR** | — | Fire your signature weapon: hit the carrier to stun them and knock the ball loose (has a cooldown) |
| **◀ ▶** | Move | Move |

### Keyboard (desktop)

- **← →** move
- **Z** jump
- **X** shoot / steal (hold X to jump with the ball, release to shoot)
- **C** power

## The roster

| Robot Master | Power | Specialty |
|---|---|---|
| Space Man | Cosmic Ball | Highest jump in the league |
| Hurt Man | Medi-Sphere | Pain Boost: stronger when trailing |
| Nail Man | Rusty Nail | Shrugs off stuns twice as fast |
| Old Man | Loose Screw | Deadly from three, hard to strip |
| No-Cut Man | No-Cut Saw | Massive knockback on hit |
| Blind Man | Sonic Ball | Best steal hands in the game |
| Lock Man | Lock Ball | His hits stun extra long |

## Development

No build step — plain HTML5 canvas + vanilla JS.

```sh
python3 -m http.server 8123
# open http://localhost:8123
```

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The game goes live at `https://<username>.github.io/<repo>/`.
