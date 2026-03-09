import { MODULE_ID } from "./const.js";

/**
 * Manages the GM reminder timer for initiating hero votes.
 * Uses setTimeout loops based on the configured reminder interval.
 */
export class ReminderTimer {
  /** @type {number|null} */
  #timeoutId = null;

  /** @type {boolean} */
  #skippedSession = false;

  /** @type {Function} */
  #onFire;

  /**
   * @param {Function} onFire - Callback when the timer fires
   */
  constructor(onFire) {
    this.#onFire = onFire;
  }

  /** Start the timer using the configured interval. */
  start() {
    if (this.#skippedSession) return;
    this.stop();
    const minutes = game.settings.get(MODULE_ID, "reminderInterval");
    const ms = minutes * 60 * 1000;
    console.log(`${MODULE_ID} | Timer started: ${minutes} minutes`);
    this.#timeoutId = setTimeout(() => this.#fire(), ms);
  }

  /** Stop the current timer. */
  stop() {
    if (this.#timeoutId !== null) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
  }

  /**
   * Snooze for a specified number of minutes, then fire.
   * @param {number} minutes
   */
  snooze(minutes) {
    this.stop();
    const ms = minutes * 60 * 1000;
    console.log(`${MODULE_ID} | Timer snoozed: ${minutes} minutes`);
    this.#timeoutId = setTimeout(() => this.#fire(), ms);
  }

  /** Skip reminders for the rest of this session (until world reload). */
  skipSession() {
    this.stop();
    this.#skippedSession = true;
    console.log(`${MODULE_ID} | Timer skipped for rest of session`);
  }

  #fire() {
    this.#timeoutId = null;
    console.log(`${MODULE_ID} | Timer fired`);
    this.#onFire();
  }
}
