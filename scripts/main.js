import { MODULE_ID, SOCKET_EVENTS } from "./const.js";
import { registerSettings } from "./settings.js";
import { HeroSocket } from "./socket.js";
import { ReminderTimer } from "./timer.js";
import { ReminderDialog } from "./dialog/ReminderDialog.js";
import { HeroOfThePeopleDialog } from "./dialog/HeroOfThePeopleDialog.js";
import { ResultsDialog } from "./dialog/ResultsDialog.js";
import { VoteMonitorDialog } from "./dialog/VoteMonitorDialog.js";
import { VoteCollector } from "./voting/vote-collector.js";
import { awardHeroPoint, postWinnerChat, trackSessionWinner } from "./awarding.js";
import { HeroOfThePeopleAPI } from "./api.js";
import { CompendiumSeeder } from "./seeding/CompendiumSeeder.js";
import { getPlayerCharacter } from "./utils.js";

/** @type {HeroSocket} */
let heroSocket;

/** @type {ReminderTimer} */
let reminderTimer;

/** @type {VoteCollector|null} */
let activeCollector = null;

/** @type {HeroOfThePeopleDialog|null} */
let activeVotingDialog = null;

/** @type {VoteMonitorDialog|null} */
let activeMonitorDialog = null;

/** @type {object[]} Collected hype entries for the current vote round */
let collectedHype = [];

/** Get the shared socket instance. */
export function getSocket() {
  return heroSocket;
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
  registerSettings();
});

Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | Ready`);

  // Reset session winners on world load
  if (game.user.isGM) {
    await game.settings.set(MODULE_ID, "sessionWinners", []);
  }

  // Initialize socket
  heroSocket = new HeroSocket();

  // Register public API for ALL users (GM and players)
  game.heroOfThePeople = new HeroOfThePeopleAPI({
    initiateVote,
    openReminder: openReminderDialog,
    openHypeDialog: openHypeDialog,
  });

  if (game.user.isGM) {
    // Seed compendium macro
    await CompendiumSeeder.seedMacro();

    // Post startup chat (visible to everyone)
    postStartupChat();

    setupGM();
  } else {
    setupPlayer();
  }

  heroSocket.listen();
  console.log(`${MODULE_ID} | Socket listeners registered (isGM: ${game.user.isGM})`);
});

// --- Settings page promo ---
Hooks.on("renderSettingsConfig", (app, html) => {
  const tab = html[0]?.querySelector?.(`[data-tab="${MODULE_ID}"]`)
    ?? html.querySelector?.(`[data-tab="${MODULE_ID}"]`);
  if (!tab || tab.querySelector(`.${MODULE_ID}-settings-promo`)) return;
  const note = document.createElement("p");
  note.className = `${MODULE_ID}-settings-promo`;
  note.style.cssText = "text-align:center; font-style:italic; opacity:0.6; font-size:0.8rem; margin-top:0.5rem;";
  note.innerHTML = `Visit <a href="https://roleplayr.com/gmant" target="_blank" rel="noopener">roleplayr.com/gmant</a> for updates, more virtual tabletop tools, and online RPG tools.`;
  tab.appendChild(note);
});

// ==================== STARTUP CHAT ====================

function postStartupChat() {
  const interval = game.settings.get(MODULE_ID, "reminderInterval");
  const content = `
    <div class="hero-of-the-people-chat-card">
      <div class="hero-of-the-people-chat-header">
        <i class="fas fa-medal"></i>
        <strong>${game.i18n.localize("HERO_OF_THE_PEOPLE.Chat.Startup")}</strong>
      </div>
      <div class="hero-of-the-people-chat-award">
        ${game.i18n.format("HERO_OF_THE_PEOPLE.Chat.StartupInterval", { interval })}
      </div>
      <div class="hero-of-the-people-chat-quote">
        <em>${game.i18n.localize("HERO_OF_THE_PEOPLE.Chat.StartupHint")}</em>
      </div>
      <a class="hero-of-the-people-chat-open-link" data-action="openHero">
        <i class="fas fa-external-link-alt"></i> ${game.i18n.localize("HERO_OF_THE_PEOPLE.Chat.OpenLink")}
      </a>
    </div>
  `;

  ChatMessage.create({
    content,
    speaker: { alias: game.i18n.localize("HERO_OF_THE_PEOPLE.Dialog.Title") },
    flags: { [MODULE_ID]: { type: "startup" } },
  });
}

// Bind click handler for the "Open" link in chat messages
Hooks.on("renderChatMessage", (message, html) => {
  const link = html[0]?.querySelector?.(".hero-of-the-people-chat-open-link")
    ?? html.querySelector?.(".hero-of-the-people-chat-open-link");
  if (link) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      game.heroOfThePeople?.open();
    });
  }
});

// ==================== GM SETUP ====================

function setupGM() {
  // GM listens for votes from players
  heroSocket.on(SOCKET_EVENTS.CAST_VOTE, (payload) => {
    if (activeCollector) {
      activeCollector.addVote(payload.voterId, payload.targetId);
    }
    // Collect hype if attached
    if (payload.hype) {
      collectedHype.push(payload.hype);
    }
  });

  // GM listens for standalone hype submissions from players
  heroSocket.on(SOCKET_EVENTS.SUBMIT_HYPE, (payload) => {
    collectedHype.push(payload);
    if (activeMonitorDialog && payload.senderId) {
      activeMonitorDialog.onHypeReceived(payload.senderId);
    }
    ui.notifications.info(game.i18n.localize("HERO_OF_THE_PEOPLE.Hype.Received"));
  });

  // Start reminder timer
  reminderTimer = new ReminderTimer(() => openReminderDialog({ fromTimer: true }));
  reminderTimer.start();
}

function openReminderDialog({ fromTimer = false } = {}) {
  // If called from the automatic timer and no players are online, silently retry later
  if (fromTimer && getEligiblePlayers().length === 0) {
    reminderTimer.start();
    return;
  }

  // Get elapsed time from API
  const elapsed = game.heroOfThePeople?.getElapsedTime() ?? "";

  new ReminderDialog({
    elapsed,
    onInitiate: () => initiateVote(),
    onSnooze: (minutes) => reminderTimer.snooze(minutes),
    onSkip: () => reminderTimer.skipSession(),
  }).render(true);
}

function initiateVote() {
  const eligible = getEligiblePlayers();

  // Edge case: no eligible players
  if (eligible.length === 0) {
    ui.notifications.info(game.i18n.localize("HERO_OF_THE_PEOPLE.Status.NoEligible"));
    reminderTimer.start();
    return;
  }

  // Reset hype collection for this round
  collectedHype = [];

  // Broadcast to all players to open their voting dialogs
  heroSocket.emitInitiateVote();

  // Build expected voter list: active non-GM users with a character
  const expectedVoterIds = game.users
    .filter((u) => !u.isGM && u.active && getPlayerCharacter(u))
    .map((u) => u.id);

  // Open the GM's vote monitor dialog
  if (activeMonitorDialog) {
    activeMonitorDialog.close();
    activeMonitorDialog = null;
  }

  activeMonitorDialog = new VoteMonitorDialog({
    expectedCount: expectedVoterIds.length,
    timeoutSeconds: 60,
    onGMVote: (targetId) => {
      if (activeCollector) {
        activeCollector.addVote(game.user.id, targetId);
      }
    },
    onEndVoting: () => {
      if (activeCollector) {
        activeCollector.resolve();
      }
    },
    onAccept: (winnerId) => finalizeWinner(winnerId),
  });
  activeMonitorDialog.render(true);

  // Create vote collector
  activeCollector = new VoteCollector({
    expectedVoterIds,
    onComplete: (results) => {
      activeCollector = null;
      heroSocket.emitCloseVoting();
      // Transition the monitor dialog to results phase
      if (activeMonitorDialog) {
        activeMonitorDialog.showResults(results, [...collectedHype]);
      }
    },
    onVoteReceived: (voterId) => {
      // Update the monitor dialog with live vote progress
      if (activeMonitorDialog) {
        activeMonitorDialog.onVoteReceived(voterId);
      }
    },
    timeoutSeconds: 60,
  });
}

function openVotingDialog() {
  if (activeVotingDialog) {
    activeVotingDialog.close();
    activeVotingDialog = null;
  }

  activeVotingDialog = new HeroOfThePeopleDialog({
    onVote: (voterId, targetId, hypeData) => {
      // GM's vote goes directly to collector
      if (game.user.isGM && activeCollector) {
        activeCollector.addVote(voterId, targetId);
      } else {
        // Player sends vote + hype via socket
        heroSocket.emitCastVote(voterId, targetId);
      }
      // Collect hype locally for GM, or send via socket for players
      if (hypeData) {
        if (game.user.isGM) {
          collectedHype.push(hypeData);
        } else {
          heroSocket.emitSubmitHype(hypeData);
        }
      }
    },
  });
  activeVotingDialog.render(true);
}

/** Open a hype-only dialog for players (no vote, just kudos). */
function openHypeDialog() {
  if (activeVotingDialog) {
    // If a vote is already open, just focus it
    activeVotingDialog.render(true);
    return;
  }

  activeVotingDialog = new HeroOfThePeopleDialog({
    hypeOnly: true,
    onHype: (hypeData) => {
      if (game.user.isGM) {
        collectedHype.push(hypeData);
      } else {
        heroSocket.emitSubmitHype(hypeData);
      }
      activeVotingDialog = null;
    },
  });
  activeVotingDialog.render(true);
}

function openResultsDialog(results) {
  if (activeVotingDialog) {
    activeVotingDialog.close();
    activeVotingDialog = null;
  }

  // Fallback: if the monitor dialog isn't open, show the standalone results dialog
  if (!activeMonitorDialog) {
    new ResultsDialog({
      results,
      hypeEntries: [...collectedHype],
      onAccept: (winnerId) => finalizeWinner(winnerId),
    }).render(true);
  }
}

async function finalizeWinner(winnerId) {
  const user = game.users.get(winnerId);
  const character = user ? getPlayerCharacter(user) : null;
  const winnerName = character?.name ?? user?.name ?? "Unknown";

  const awardType = await awardHeroPoint(winnerId);
  await trackSessionWinner(winnerId);
  await postWinnerChat({ winnerId, winnerName, awardType });
  heroSocket.emitVoteResults({ winnerId, winnerName, awardType });

  game.heroOfThePeople?.markVoteCompleted();
  reminderTimer.start();

  // Clean up monitor dialog reference
  activeMonitorDialog = null;

  // Clear collected hype
  collectedHype = [];
}

// ==================== PLAYER SETUP ====================

function setupPlayer() {
  heroSocket.on(SOCKET_EVENTS.INITIATE_VOTE, () => {
    openVotingDialog();
  });

  heroSocket.on(SOCKET_EVENTS.VOTE_RESULTS, () => {
    if (activeVotingDialog) {
      activeVotingDialog.close();
      activeVotingDialog = null;
    }
  });

  heroSocket.on(SOCKET_EVENTS.CLOSE_VOTING, () => {
    if (activeVotingDialog) {
      activeVotingDialog.close();
      activeVotingDialog = null;
    }
  });
}

// ==================== UTILITIES ====================

function getEligiblePlayers() {
  const sessionWinners = game.settings.get(MODULE_ID, "sessionWinners");
  return game.users.filter((u) => {
    if (u.isGM || !u.active) return false;
    const character = getPlayerCharacter(u);
    if (!character) return false;
    if (sessionWinners.includes(u.id)) return false;
    return !isAtMax(character);
  });
}

function isAtMax(actor) {
  const systemId = game.system.id;
  if (systemId === "pf2e") {
    const hp = actor.system?.resources?.heroPoints;
    return hp && hp.value >= hp.max;
  } else if (systemId === "dnd5e") {
    return !!actor.system?.attributes?.inspiration;
  }
  return false;
}
