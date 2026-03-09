import { MODULE_ID } from "./const.js";

/**
 * Public API for Hero of the People, exposed as `game.heroOfThePeople`.
 * Called by the compendium macro and available for external use.
 */
export class HeroOfThePeopleAPI {
  /** @type {Function} Bound reference to the main.js initiateVote function */
  #initiateVoteFn;

  /** @type {Function} Bound reference to the main.js openReminderDialog function */
  #openReminderFn;

  /** @type {Function} Opens the hype dialog for players (or GM reminder for GM) */
  #openHypeDialogFn;

  /** @type {number} Timestamp (ms) when the module was loaded or last vote completed */
  #lastVoteTime;

  /**
   * @param {object} callbacks
   * @param {Function} callbacks.initiateVote - Triggers the full vote flow
   * @param {Function} callbacks.openReminder - Opens the GM reminder dialog
   * @param {Function} callbacks.openHypeDialog - Opens the hype-only dialog for players
   */
  constructor({ initiateVote, openReminder, openHypeDialog }) {
    this.#initiateVoteFn = initiateVote;
    this.#openReminderFn = openReminder;
    this.#openHypeDialogFn = openHypeDialog;
    this.#lastVoteTime = Date.now();
  }

  /** Record that a vote just completed (resets elapsed timer). */
  markVoteCompleted() {
    this.#lastVoteTime = Date.now();
  }

  /**
   * Open the module dialog.
   * - GM: opens the reminder dialog (with elapsed time and initiate/snooze)
   * - Player: opens the Hero Hype dialog to submit kudos
   */
  open() {
    if (game.user.isGM) {
      this.#openReminderFn();
    } else {
      this.#openHypeDialogFn();
    }
  }

  /**
   * Directly initiate a vote without showing the reminder dialog.
   * Only works for the GM.
   */
  initiateVote() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("HERO_OF_THE_PEOPLE.Status.GMOnly"));
      return;
    }
    this.#initiateVoteFn();
  }

  /**
   * Get a human-readable string of elapsed time since the last vote (or module load).
   * @returns {string} e.g. "12m 34s", "1h 5m", "just now"
   */
  getElapsedTime() {
    const elapsed = Date.now() - this.#lastVoteTime;
    const totalSeconds = Math.floor(elapsed / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    if (seconds > 10) return `${seconds}s`;
    return game.i18n.localize("HERO_OF_THE_PEOPLE.Time.JustNow");
  }
}
