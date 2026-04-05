# GMAnt's Hero of the People

![License](https://img.shields.io/github/license/AntTheGM/gmants-hero-of-the-people)
![Foundry](https://img.shields.io/badge/Foundry-v13-informational)
![Release](https://img.shields.io/github/v/release/AntTheGM/gmants-hero-of-the-people)
![Downloads](https://img.shields.io/github/downloads/AntTheGM/gmants-hero-of-the-people/total)

A voting-based hero point and inspiration award system for Foundry VTT. The GM gets periodic reminders, all players vote for the hero of the day, and the winner is awarded a Hero Point (PF2e) or Inspiration (D&D 5e) automatically.

## Features

- **Timed GM Reminders** — configurable interval (5-180 minutes) with snooze options
- **Player Voting** — all players vote simultaneously with an optional countdown timer
- **GM Vote Monitor** — live progress tracking, vote with your players, end voting early
- **Hero Hype** — players send tagged kudos (Great Roleplay, Tactical Genius, Puzzle Solver, Player Helper) with optional messages
- **System Auto-Detection** — awards Hero Points on PF2e, Inspiration on D&D 5e, or just announces on other systems
- **GM Override** — accept the vote result or pick a different winner
- **Hero Point Reroll Button** — adds a reroll button to PF2e d20 check chat cards (optional)
- **Customizable Quotes** — heroic quotes in winner announcements, add your own or remove defaults
- **Session Tracking** — previous winners are greyed out or hidden to spread the love
- **Excluded Characters** — filter out companions, NPCs, or test characters
- **Compendium Macro** — one-click access for GMs (reminder dialog) and players (hype dialog)

## Installation

### Foundry Module Installer (Recommended)

1. Open Foundry VTT and go to **Add-on Modules**
2. Click **Install Module**
3. Paste this manifest URL:
   ```
   https://github.com/AntTheGM/gmants-hero-of-the-people/releases/latest/download/module.json
   ```
4. Click **Install**

### Manual Download

Download the latest `module.zip` from the [Releases](https://github.com/AntTheGM/gmants-hero-of-the-people/releases) page and extract it to your `Data/modules/` directory.

## Usage

1. **Enable the module** in your world's Module Management screen
2. **A startup message** appears in chat confirming the module is active
3. **The GM gets a reminder** at the configured interval to initiate a hero vote
4. **All players vote** — each picks another player (or Random). Players can also send Hero Hype with tags and messages.
5. **The GM reviews results** in the Vote Monitor, then accepts or overrides the winner
6. **The winner is announced** in chat with a heroic quote and receives their award

Players can open the **Hero Hype** dialog anytime via the compendium macro to send kudos between votes.

## Configuration

All settings are found under **Module Settings > GMAnt's Hero of the People**:

| Setting | Default | Description |
|---------|---------|-------------|
| Reminder Interval | 90 min | How often the GM is prompted to start a vote |
| Vote Timer | Enabled | Auto-submit votes after the timer expires |
| Vote Timer Duration | 120 sec | Countdown length for voting |
| Hide Session Winners | Off | Hide (vs. grey out) players who already won |
| Hero Point Reroll Button | On | Show reroll button on PF2e check cards |
| Excluded Characters | — | Comma-separated names to exclude from voting |
| Heroic Quotes | Configure | Add, remove, or restore winner announcement quotes |

## Compatibility

- **Foundry VTT:** v13+
- **Game Systems:** PF2e (Hero Points), D&D 5e (Inspiration), any system (announcement only)
- **Dependencies:** None
- **Known Conflicts:** None

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

Found a bug or have a feature request? [Open an issue](https://github.com/AntTheGM/gmants-hero-of-the-people/issues).

## License

[MIT](LICENSE)

## Credits

**VTTools by GM Ant** — [roleplayr.com/gmant](https://roleplayr.com/gmant)
