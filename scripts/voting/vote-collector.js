import { MODULE_ID } from "../const.js";
import { getEligibleActors, getOwnerName } from "../utils.js";

/**
 * Collects and tallies votes from all players (GM-side only).
 * Vote targets are actor IDs.
 */
export class VoteCollector {
  /** @type {Map<string, string>} voterId → actorId */
  #votes = new Map();

  /** @type {Set<string>} Expected voter user IDs */
  #expectedVoters;

  /** @type {Function} Called when all votes are in */
  #onComplete;

  /** @type {Function|null} Called each time a vote is received */
  #onVoteReceived;

  /** @type {number|null} Auto-timeout ID */
  #timeoutId = null;

  /**
   * @param {object} options
   * @param {string[]} options.expectedVoterIds - User IDs expected to vote
   * @param {Function} options.onComplete - Called with results when voting ends
   * @param {Function} [options.onVoteReceived] - Called with (voterId, currentCount, expectedCount) on each vote
   * @param {number|null} [options.timeoutSeconds=120] - Auto-close seconds, or null to disable
   */
  constructor({ expectedVoterIds, onComplete, onVoteReceived, timeoutSeconds = 120 }) {
    this.#expectedVoters = new Set(expectedVoterIds);
    this.#onComplete = onComplete;
    this.#onVoteReceived = onVoteReceived ?? null;

    // Start auto-timeout (only if enabled)
    if (timeoutSeconds != null) {
      this.#timeoutId = setTimeout(() => {
        console.log(`${MODULE_ID} | Vote timeout reached, resolving with current votes`);
        this.resolve();
      }, timeoutSeconds * 1000);
    }
  }

  /**
   * Record a vote.
   * @param {string} voterId - User ID of the voter
   * @param {string} targetId - Actor ID or "random"
   */
  addVote(voterId, targetId) {
    if (this.#votes.has(voterId)) return; // No double-voting

    this.#votes.set(voterId, targetId);
    console.log(`${MODULE_ID} | Vote recorded: ${voterId} → ${targetId} (${this.#votes.size}/${this.#expectedVoters.size})`);

    if (this.#onVoteReceived) {
      this.#onVoteReceived(voterId, this.#votes.size, this.#expectedVoters.size);
    }

    // Check if all expected voters have voted (auto-resolve)
    const expectedIn = [...this.#expectedVoters].every((id) => this.#votes.has(id));
    if (expectedIn && this.#expectedVoters.size > 0) {
      this.resolve();
    }
  }

  /** @returns {number} Number of votes received so far */
  get voteCount() {
    return this.#votes.size;
  }

  /** @returns {number} Total expected votes */
  get expectedCount() {
    return this.#expectedVoters.size;
  }

  /** Resolve the vote early (GM closes voting or timeout). */
  resolve() {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }

    const results = this.#tally();
    this.#onComplete(results);
  }

  /** Cancel the vote without resolving. */
  cancel() {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
  }

  /**
   * Tally votes and determine the winner.
   * @returns {object} Results with winner and vote breakdown
   */
  #tally() {
    const eligibleTargets = getEligibleActors().map((a) => a.id);

    // Resolve "random" votes
    const resolvedVotes = new Map();
    for (const [voterId, targetId] of this.#votes) {
      if (targetId === "random" && eligibleTargets.length > 0) {
        const randomTarget = eligibleTargets[Math.floor(Math.random() * eligibleTargets.length)];
        resolvedVotes.set(voterId, randomTarget);
      } else {
        resolvedVotes.set(voterId, targetId);
      }
    }

    // Count votes per target (actor ID)
    const tallies = new Map();
    for (const [, targetId] of resolvedVotes) {
      tallies.set(targetId, (tallies.get(targetId) || 0) + 1);
    }

    // Find winner (most votes, random tiebreak)
    let maxVotes = 0;
    const candidates = [];
    for (const [targetId, count] of tallies) {
      if (count > maxVotes) {
        maxVotes = count;
        candidates.length = 0;
        candidates.push(targetId);
      } else if (count === maxVotes) {
        candidates.push(targetId);
      }
    }

    const winnerId = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : (eligibleTargets.length > 0 ? eligibleTargets[Math.floor(Math.random() * eligibleTargets.length)] : null);

    // Build vote breakdown for GM view
    const breakdown = [];
    for (const [voterId, targetId] of resolvedVotes) {
      const voter = game.users.get(voterId);
      const targetActor = game.actors.get(targetId);
      breakdown.push({
        voterId,
        voterName: voter?.name ?? "GM",
        targetId,
        targetName: targetActor?.name ?? "Unknown",
      });
    }

    const winnerActor = game.actors.get(winnerId);
    return {
      winnerId,
      winnerName: winnerActor?.name ?? "Unknown",
      winnerPlayerName: getOwnerName(winnerActor),
      winnerImg: winnerActor?.img ?? "",
      voteCount: maxVotes,
      totalVotes: resolvedVotes.size,
      breakdown,
      tallies: Object.fromEntries(tallies),
    };
  }

}
