import { MODULE_ID } from "../const.js";
import { getPlayerCharacter } from "../utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Tag display info for hype entries */
const HYPE_TAG_DISPLAY = {
  roleplay: { icon: "fas fa-theater-masks", label: "HERO_OF_THE_PEOPLE.Hype.Roleplay" },
  tactical: { icon: "fas fa-chess-knight", label: "HERO_OF_THE_PEOPLE.Hype.Tactical" },
  puzzle: { icon: "fas fa-puzzle-piece", label: "HERO_OF_THE_PEOPLE.Hype.Puzzle" },
  helper: { icon: "fas fa-hands-helping", label: "HERO_OF_THE_PEOPLE.Hype.Helper" },
};

/**
 * GM-only dialog that monitors an active vote and then displays results.
 * Phase 1: Shows live vote progress, lets GM vote, and end voting early.
 * Phase 2: Shows results with accept/override after voting completes.
 */
export class VoteMonitorDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-vote-monitor`,
    classes: [MODULE_ID],
    window: {
      title: "HERO_OF_THE_PEOPLE.Monitor.Title",
      icon: "fas fa-poll",
      resizable: false,
    },
    position: { width: 420, height: "auto" },
    actions: {
      castGMVote: VoteMonitorDialog.#onCastGMVote,
      endVoting: VoteMonitorDialog.#onEndVoting,
      accept: VoteMonitorDialog.#onAccept,
      override: VoteMonitorDialog.#onOverride,
      postHype: VoteMonitorDialog.#onPostHype,
      backToMonitor: VoteMonitorDialog.#onBackToMonitor,
      done: VoteMonitorDialog.#onDone,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/vote-monitor-dialog.hbs`,
    },
  };

  /** @type {"monitoring"|"results"} Current dialog phase */
  #phase = "monitoring";

  /** @type {Set<string>} IDs of users who have voted */
  #votedIds = new Set();

  /** @type {Set<string>} IDs of users who submitted hype */
  #hypeVoterIds = new Set();

  /** @type {number} Expected number of voters */
  #expectedCount = 0;

  /** @type {boolean} Whether the GM has cast their vote */
  #gmVoted = false;

  /** @type {object|null} Results from VoteCollector */
  #results = null;

  /** @type {object[]} Collected hype entries */
  #hypeEntries = [];

  /** @type {number} Countdown seconds */
  #secondsLeft = 60;

  /** @type {number|null} Countdown interval ID */
  #countdownInterval = null;

  /** @type {Function} Called with (targetId) when GM casts their vote */
  #onGMVoteCallback;

  /** @type {Function} Called when GM ends voting early */
  #onEndVotingCallback;

  /** @type {Function} Called with (winnerId) when GM accepts/overrides */
  #onAcceptCallback;

  /**
   * @param {object} options
   * @param {number} options.expectedCount - Number of expected voters
   * @param {number} [options.timeoutSeconds=60] - Voting timeout
   * @param {Function} options.onGMVote - Called with target user ID when GM votes
   * @param {Function} options.onEndVoting - Called when GM ends voting early
   * @param {Function} options.onAccept - Called with final winner user ID
   */
  constructor({ expectedCount, timeoutSeconds = 60, onGMVote, onEndVoting, onAccept }) {
    super();
    this.#expectedCount = expectedCount;
    this.#secondsLeft = timeoutSeconds;
    this.#onGMVoteCallback = onGMVote;
    this.#onEndVotingCallback = onEndVoting;
    this.#onAcceptCallback = onAccept;
  }

  /**
   * Called by main.js when a vote is received (from VoteCollector callback).
   * @param {string} voterId - The user who voted
   */
  onVoteReceived(voterId) {
    this.#votedIds.add(voterId);
    this.#updateVoteProgress();
  }

  /**
   * Called by main.js when hype is received for a voter.
   * @param {string} voterId - The user who submitted hype
   */
  onHypeReceived(voterId) {
    this.#hypeVoterIds.add(voterId);
    this.#updateHypeIndicator(voterId);
  }

  /**
   * Transition to the results phase.
   * @param {object} results - Results from VoteCollector
   * @param {object[]} hypeEntries - Collected hype
   */
  showResults(results, hypeEntries = []) {
    this.#phase = "results";
    this.#results = results;
    this.#hypeEntries = hypeEntries;
    if (this.#countdownInterval) {
      clearInterval(this.#countdownInterval);
      this.#countdownInterval = null;
    }
    this.render(true);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.phase = this.#phase;
    context.isMonitoring = this.#phase === "monitoring";
    context.isResults = this.#phase === "results";

    if (this.#phase === "monitoring") {
      context.voteCount = this.#votedIds.size;
      context.expectedCount = this.#expectedCount;
      context.secondsLeft = this.#secondsLeft;
      context.gmVoted = this.#gmVoted;
      context.progressPct = this.#expectedCount > 0
        ? Math.round((this.#votedIds.size / this.#expectedCount) * 100)
        : 0;

      // Build expected voter list with status (non-GM players only)
      context.voters = game.users
        .filter((u) => !u.isGM && u.active && getPlayerCharacter(u))
        .map((u) => {
          const pc = getPlayerCharacter(u);
          return {
            userId: u.id,
            name: pc?.name ?? u?.name ?? "Unknown",
            playerName: u?.name ?? "Unknown",
            voted: this.#votedIds.has(u.id),
            hasHype: this.#hypeVoterIds.has(u.id),
          };
        });

      // Build candidate list for GM vote (non-GM active players with characters)
      const sessionWinners = game.settings.get(MODULE_ID, "sessionWinners");
      context.candidates = game.users
        .filter((u) => !u.isGM && u.active && getPlayerCharacter(u))
        .map((u) => {
          const actor = getPlayerCharacter(u);
          const isSessionWinner = sessionWinners.includes(u.id);
          const isMaxed = this.#isAtMax(actor);
          const greyed = isSessionWinner || isMaxed;
          let reason = "";
          if (isSessionWinner) reason = game.i18n.localize("HERO_OF_THE_PEOPLE.Status.AlreadyWon");
          else if (isMaxed) reason = game.i18n.localize("HERO_OF_THE_PEOPLE.Status.AtMax");
          return {
            userId: u.id,
            characterName: actor.name,
            playerName: u.name,
            greyed,
            reason,
          };
        });
    } else {
      // Results phase
      context.results = this.#results;

      // Override candidates
      context.overrideCandidates = game.users
        .filter((u) => !u.isGM && getPlayerCharacter(u))
        .map((u) => {
          const pc = getPlayerCharacter(u);
          return {
            userId: u.id,
            name: `${pc.name} (${u.name})`,
            isWinner: u.id === this.#results.winnerId,
          };
        });

      // Process hype entries
      context.hypeEntries = this.#hypeEntries.map((entry) => {
        const target = game.users.get(entry.targetId);
        const tagLabels = (entry.tags || []).map((key) => {
          const info = HYPE_TAG_DISPLAY[key];
          return info ? { icon: info.icon, label: game.i18n.localize(info.label) } : null;
        }).filter(Boolean);
        return {
          targetName: target?.character?.name ?? target?.name ?? "Someone",
          tags: tagLabels,
          message: entry.message || "",
        };
      });
      context.hasHype = context.hypeEntries.length > 0;
    }

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#injectBranding();
    if (this.#phase === "monitoring") {
      this.#startCountdown();
    }
  }

  /** Check if an actor is at max hero points/inspiration. */
  #isAtMax(actor) {
    const systemId = game.system.id;
    if (systemId === "pf2e") {
      const hp = actor.system?.resources?.heroPoints;
      return hp && hp.value >= hp.max;
    } else if (systemId === "dnd5e") {
      return !!actor.system?.attributes?.inspiration;
    }
    return false;
  }

  /** Update the vote progress indicators in the DOM without re-rendering. */
  #updateVoteProgress() {
    if (this.#phase !== "monitoring" || !this.element) return;

    // Update count text
    const countEl = this.element.querySelector(".hero-of-the-people-monitor-count");
    if (countEl) countEl.textContent = `${this.#votedIds.size} / ${this.#expectedCount}`;

    // Update progress bar
    const barEl = this.element.querySelector(".hero-of-the-people-monitor-bar-fill");
    if (barEl) {
      const pct = this.#expectedCount > 0 ? (this.#votedIds.size / this.#expectedCount) * 100 : 0;
      barEl.style.width = `${pct}%`;
    }

    // Update voter status icons
    for (const uid of this.#votedIds) {
      const row = this.element.querySelector(`.hero-of-the-people-voter-row[data-voter-id="${uid}"]`);
      if (row) {
        const statusEl = row.querySelector(".hero-of-the-people-voter-status");
        if (statusEl && !statusEl.classList.contains("voted")) {
          statusEl.classList.remove("waiting");
          statusEl.classList.add("voted");
          statusEl.innerHTML = `<i class="fas fa-check-circle"></i>`;
        }
      }
    }

    // Update hype indicators
    for (const uid of this.#hypeVoterIds) {
      this.#updateHypeIndicator(uid);
    }
  }

  /** Add a fire icon to a voter row to indicate they submitted hype. */
  #updateHypeIndicator(voterId) {
    if (this.#phase !== "monitoring" || !this.element) return;
    const row = this.element.querySelector(`.hero-of-the-people-voter-row[data-voter-id="${voterId}"]`);
    if (row && !row.querySelector(".hero-of-the-people-hype-icon")) {
      const icon = document.createElement("i");
      icon.className = "fas fa-fire hero-of-the-people-hype-icon";
      icon.title = game.i18n.localize("HERO_OF_THE_PEOPLE.Hype.Title");
      const statusEl = row.querySelector(".hero-of-the-people-voter-status");
      if (statusEl) row.insertBefore(icon, statusEl);
    }
  }

  #startCountdown() {
    if (this.#countdownInterval) clearInterval(this.#countdownInterval);
    const timerEl = this.element?.querySelector(".hero-of-the-people-monitor-timer");
    if (!timerEl) return;

    this.#countdownInterval = setInterval(() => {
      this.#secondsLeft--;
      if (timerEl) timerEl.textContent = `${this.#secondsLeft}s`;
      if (this.#secondsLeft <= 0) {
        clearInterval(this.#countdownInterval);
        this.#countdownInterval = null;
      }
    }, 1000);
  }

  // ==================== ACTIONS ====================

  static #onCastGMVote(event, target) {
    if (this.#gmVoted) return;
    const select = this.element.querySelector(".hero-of-the-people-gm-vote-select");
    const targetId = select?.value || "random";
    this.#gmVoted = true;
    this.#votedIds.add(game.user.id);
    this.#onGMVoteCallback(targetId);
    this.#updateVoteProgress();

    // Disable the vote section
    const section = this.element.querySelector(".hero-of-the-people-gm-vote-section");
    if (section) {
      section.classList.add("hero-of-the-people-disabled");
      const btn = section.querySelector('[data-action="castGMVote"]');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize("HERO_OF_THE_PEOPLE.Monitor.VoteCast")}`;
      }
    }
  }

  static #onEndVoting(event, target) {
    this.#onEndVotingCallback();
  }

  static #onBackToMonitor(event, target) {
    this.#phase = "monitoring";
    this.render(true);
  }

  static #onAccept(event, target) {
    this.#onAcceptCallback(this.#results.winnerId);
    this.#markAwarded();
  }

  static #onOverride(event, target) {
    const select = this.element.querySelector(".hero-of-the-people-override-select");
    const overrideId = select?.value;
    if (overrideId) {
      this.#onAcceptCallback(overrideId);
      this.#markAwarded();
    }
  }

  static #onDone(event, target) {
    this.close();
  }

  /** Disable accept/override after awarding and show the Done button. */
  #markAwarded() {
    const acceptBtn = this.element.querySelector('[data-action="accept"]');
    if (acceptBtn) {
      acceptBtn.disabled = true;
      acceptBtn.innerHTML = `<i class="fas fa-check"></i> ${game.i18n.localize("HERO_OF_THE_PEOPLE.Monitor.Awarded")}`;
    }
    const overrideBtn = this.element.querySelector('[data-action="override"]');
    if (overrideBtn) overrideBtn.disabled = true;
    const overrideSelect = this.element.querySelector(".hero-of-the-people-override-select");
    if (overrideSelect) overrideSelect.disabled = true;

    // Show the Done button
    const doneBtn = this.element.querySelector('[data-action="done"]');
    if (doneBtn) doneBtn.style.display = "";
  }

  static async #onPostHype(event, target) {
    if (this.#hypeEntries.length === 0) return;

    for (const entry of this.#hypeEntries) {
      const targetUser = game.users.get(entry.targetId);
      const targetName = targetUser?.character?.name ?? targetUser?.name ?? "Someone";

      const tagLabels = (entry.tags || []).map((key) => {
        const info = HYPE_TAG_DISPLAY[key];
        return info ? `<i class="${info.icon}"></i> ${game.i18n.localize(info.label)}` : null;
      }).filter(Boolean);

      const tagsHtml = tagLabels.length > 0
        ? `<div class="hero-of-the-people-chat-hype-tags">${tagLabels.join(" &middot; ")}</div>`
        : "";
      const messageHtml = entry.message
        ? `<div class="hero-of-the-people-chat-hype-message">&ldquo;${entry.message}&rdquo;</div>`
        : "";

      if (!tagsHtml && !messageHtml) continue;

      const content = `
        <div class="hero-of-the-people-chat-card">
          <div class="hero-of-the-people-chat-header">
            <i class="fas fa-fire"></i>
            <strong>${game.i18n.format("HERO_OF_THE_PEOPLE.Hype.ChatHeader", { name: targetName })}</strong>
          </div>
          ${tagsHtml}
          ${messageHtml}
        </div>
      `;

      await ChatMessage.create({
        content,
        speaker: { alias: game.i18n.localize("HERO_OF_THE_PEOPLE.Hype.Anonymous") },
        flags: { [MODULE_ID]: { type: "hype" } },
      });
    }

    ui.notifications.info(game.i18n.localize("HERO_OF_THE_PEOPLE.Hype.Posted"));
    const btn = this.element.querySelector('[data-action="postHype"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = game.i18n.localize("HERO_OF_THE_PEOPLE.Hype.Posted");
    }
  }

  async close(options) {
    if (this.#countdownInterval) {
      clearInterval(this.#countdownInterval);
      this.#countdownInterval = null;
    }
    return super.close(options);
  }

  #injectBranding() {
    const header = this.element.querySelector(".window-header");
    if (!header || header.querySelector(`.${MODULE_ID}-branding`)) return;
    const brand = document.createElement("a");
    brand.className = `${MODULE_ID}-branding`;
    brand.textContent = "VTTools by GM Ant";
    brand.href = "https://roleplayr.com/gmant";
    brand.target = "_blank";
    brand.rel = "noopener";
    header.insertBefore(brand, header.lastElementChild);
  }
}
