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

  /** @type {number|null} Epoch ms when the timer will next fire */
  #nextFireAt = null;

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
    this.#nextFireAt = Date.now() + ms;
    console.log(`${MODULE_ID} | Timer started: ${minutes} minutes`);
    this.#timeoutId = setTimeout(() => this.#fire(), ms);
  }

  /**
   * Get the formatted time (h:mm AM/PM) when the next vote will fire, or null.
   * @returns {string|null}
   */
  get nextFireTime() {
    if (!this.#nextFireAt) return null;
    return new Date(this.#nextFireAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  /** Stop the current timer. */
  stop() {
    if (this.#timeoutId !== null) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
    this.#nextFireAt = null;
  }

  /**
   * Snooze for a specified number of minutes, then fire.
   * @param {number} minutes
   */
  snooze(minutes) {
    this.stop();
    const ms = minutes * 60 * 1000;
    this.#nextFireAt = Date.now() + ms;
    console.log(`${MODULE_ID} | Timer snoozed: ${minutes} minutes`);
    this.#timeoutId = setTimeout(() => this.#fire(), ms);
  }

  /** Skip reminders for the rest of this session (until world reload). */
  skipSession() {
    this.stop();
    this.#nextFireAt = null;
    this.#skippedSession = true;
    console.log(`${MODULE_ID} | Timer skipped for rest of session`);
  }

  #fire() {
    this.#timeoutId = null;
    this.#nextFireAt = null;
    console.log(`${MODULE_ID} | Timer fired`);
    this.#onFire();
  }
}
