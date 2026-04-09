import { MODULE_ID, SOCKET_NAME, SOCKET_EVENTS } from "./const.js";

/**
 * Socket handler for Hero of the People.
 * Wraps game.socket emit/on for the module channel.
 */
export class HeroSocket {
  /** @type {Record<string, Function>} */
  #handlers = {};

  /**
   * Register a callback for a socket event.
   * @param {string} event - One of SOCKET_EVENTS values
   * @param {Function} callback - Handler function
   */
  on(event, callback) {
    this.#handlers[event] = callback;
  }

  /**
   * Start listening on the module socket channel.
   * Call once during ready hook.
   */
  listen() {
    game.socket.on(SOCKET_NAME, (data) => {
      const { event, payload } = data;
      const handler = this.#handlers[event];
      if (handler) {
        console.debug(`${MODULE_ID} | Socket received: ${event}`, payload);
        handler(payload);
      }
    });
  }

  /**
   * Emit a socket event to all other clients.
   * @param {string} event - One of SOCKET_EVENTS values
   * @param {object} [payload={}] - Data to send
   */
  #emit(event, payload = {}) {
    console.debug(`${MODULE_ID} | Socket emit: ${event}`, payload);
    game.socket.emit(SOCKET_NAME, { event, payload });
  }

  /**
   * Broadcast that a vote has been initiated (GM → all players).
   * @param {object} [options={}]
   * @param {boolean} [options.timerEnabled=true] - Whether the countdown timer is active
   * @param {number} [options.timerDuration=120] - Countdown duration in seconds
   */
  emitInitiateVote({ timerEnabled = true, timerDuration = 120 } = {}) {
    this.#emit(SOCKET_EVENTS.INITIATE_VOTE, { timerEnabled, timerDuration });
  }

  /**
   * Send a vote to the GM.
   * @param {string} voterId - The voting user's ID
   * @param {string} targetId - The chosen target's user ID, or "random"
   * @param {object|null} [hype] - Optional hype data to send alongside the vote
   */
  emitCastVote(voterId, targetId, hype = null) {
    this.#emit(SOCKET_EVENTS.CAST_VOTE, { voterId, targetId, hype });
  }

  /**
   * Broadcast vote results to all clients (GM → all).
   * @param {object} results - The vote results payload
   * @param {string} results.winnerId - Winning user's ID
   * @param {string} results.winnerName - Winning character/player name
   * @param {string} results.awardType - "heroPoint", "inspiration", or "none"
   */
  emitVoteResults(results) {
    this.#emit(SOCKET_EVENTS.VOTE_RESULTS, results);
  }

  /** Broadcast that voting is closed (GM → all). */
  emitCloseVoting() {
    this.#emit(SOCKET_EVENTS.CLOSE_VOTING);
  }

  /** Broadcast that the spotlight dialog should open on all players (GM → all). */
  emitSpotlightOpen() {
    this.#emit(SOCKET_EVENTS.SPOTLIGHT_OPEN);
  }

  /**
   * Broadcast a spotlight spin to all players (GM → all).
   * @param {object} options
   * @param {string} options.winnerId - The pre-determined winner's actor ID
   */
  emitSpotlightSpin({ winnerId }) {
    this.#emit(SOCKET_EVENTS.SPOTLIGHT_SPIN, { winnerId });
  }

  /**
   * Send a hype submission to the GM (player → GM).
   * @param {object} hype
   * @param {string} hype.targetId - Who the hype is about
   * @param {string[]} hype.tags - Selected tag keys (e.g. "roleplay", "tactical")
   * @param {string} hype.message - Optional free-text kudos
   */
  emitSubmitHype(hype) {
    this.#emit(SOCKET_EVENTS.SUBMIT_HYPE, { ...hype, senderId: game.user.id });
  }
}
