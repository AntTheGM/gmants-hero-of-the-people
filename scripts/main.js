import { MODULE_ID, SOCKET_EVENTS } from "./const.js";
import { registerSettings } from "./settings.js";
import { HeroSocket } from "./socket.js";
import { ReminderTimer } from "./timer.js";
import { ReminderDialog } from "./dialog/ReminderDialog.js";
import { HeroOfThePeopleDialog } from "./dialog/HeroOfThePeopleDialog.js";
import { ResultsDialog } from "./dialog/ResultsDialog.js";
import { VoteMonitorDialog } from "./dialog/VoteMonitorDialog.js";
import { VoteCollector } from "./voting/vote-collector.js";
import { awardHeroPoint, trackSessionWinner } from "./awarding.js";
import { postStartupChat } from "./chat/startup-message.js";
import { postWinnerChat } from "./chat/winner-message.js";
import { HeroOfThePeopleAPI } from "./api.js";
import { CompendiumSeeder } from "./seeding/CompendiumSeeder.js";
import { getPlayerCharacter, getEligibleActors } from "./utils.js";
import { onRenderChatMessage as injectRerollButton } from "./reroll/reroll-button.js";

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

  // On first GM login, set session start time and reset winners
  if (game.user.isGM) {
    const existingStart = game.settings.get(MODULE_ID, "sessionStartTime");
    if (!existingStart) {
      await game.settings.set(MODULE_ID, "sessionStartTime", Date.now());
      await game.settings.set(MODULE_ID, "sessionWinners", []);
      await game.settings.set(MODULE_ID, "lastVoteTime", 0);
    }
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
  const tab = html[0]?.querySelector?.(`.tab[data-tab="${MODULE_ID}"]`)
    ?? html.querySelector?.(`.tab[data-tab="${MODULE_ID}"]`);
  if (!tab || tab.querySelector(`.${MODULE_ID}-settings-promo`)) return;
  const note = document.createElement("p");
  note.className = `${MODULE_ID}-settings-promo`;
  note.style.cssText = "text-align:center; font-style:italic; opacity:0.6; font-size:0.8rem; margin-top:0.5rem;";
  note.innerHTML = `Visit <a href="https://roleplayr.com/gmant" target="_blank" rel="noopener">roleplayr.com/gmant</a> for updates, more virtual tabletop tools, and online RPG tools.`;
  tab.appendChild(note);
});

// Bind click handler for the "Open" link in chat messages + inject reroll buttons
Hooks.on("renderChatMessage", (message, html) => {
  const link = html[0]?.querySelector?.(".hero-of-the-people-chat-open-link")
    ?? html.querySelector?.(".hero-of-the-people-chat-open-link");
  if (link) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      game.heroOfThePeople?.open();
    });
  }

  // Inject hero point reroll button on PF2e check cards
  injectRerollButton(message, html);
});

// ==================== GM SETUP ====================

function setupGM() {
  // GM listens for votes from players
  heroSocket.on(SOCKET_EVENTS.CAST_VOTE, (payload) => {
    // Collect hype before adding vote (vote may trigger immediate resolve)
    if (payload.hype) {
      collectedHype.push(payload.hype);
      if (activeMonitorDialog && payload.voterId) {
        activeMonitorDialog.onHypeReceived(payload.voterId);
      }
    }
    if (activeCollector) {
      activeCollector.addVote(payload.voterId, payload.targetId);
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
  if (fromTimer && getEligibleActors().length === 0) {
    reminderTimer.start();
    return;
  }

  // Get elapsed time from API
  const elapsed = game.heroOfThePeople?.getElapsedTime() ?? "";
  const hasVoted = game.heroOfThePeople?.hasVoted ?? false;

  new ReminderDialog({
    elapsed,
    hasVoted,
    nextFireTime: reminderTimer.nextFireTime,
    onInitiate: () => initiateVote(),
    onSnooze: (minutes) => reminderTimer.snooze(minutes),
    onSkip: () => reminderTimer.skipSession(),
  }).render(true);
}

function initiateVote() {
  try {
    const eligible = getEligibleActors();
    console.log(`${MODULE_ID} | Initiating vote. Eligible actors:`, eligible.map((a) => a.name));

    // Edge case: no eligible players
    if (eligible.length === 0) {
      ui.notifications.info(game.i18n.localize("HERO_OF_THE_PEOPLE.Status.NoEligible"));
      reminderTimer.start();
      return;
    }

    // Reset hype collection for this round
    collectedHype = [];

    // Read timer settings
    const timerEnabled = game.settings.get(MODULE_ID, "voteTimerEnabled");
    const timerDuration = game.settings.get(MODULE_ID, "voteTimerDuration");
    const timeoutSeconds = timerEnabled ? timerDuration : null;

    // Broadcast to all players to open their voting dialogs
    heroSocket.emitInitiateVote({ timerEnabled, timerDuration });

    // Build expected voter list: active non-GM users with a character + the GM
    // Offline players' characters are eligible to be voted FOR, but only online players vote
    const expectedVoterIds = game.users
      .filter((u) => !u.isGM && u.active && getPlayerCharacter(u))
      .map((u) => u.id);
    // Include GM in the expected voters so the collector waits for the GM's vote too
    expectedVoterIds.push(game.user.id);

    // Open the same voting dialog for the GM so they can vote + submit hype
    if (activeVotingDialog) {
      activeVotingDialog.close();
      activeVotingDialog = null;
    }
    activeVotingDialog = new HeroOfThePeopleDialog({
      timeoutSeconds,
      onVote: (voterId, targetId, hypeData) => {
        // GM vote goes directly to collector (no socket needed)
        if (hypeData) {
          collectedHype.push(hypeData);
        }
        if (activeCollector) {
          activeCollector.addVote(voterId, targetId);
        }
        // Update monitor to show GM has voted
        if (activeMonitorDialog) {
          activeMonitorDialog.onVoteReceived(voterId);
        }
      },
    });
    activeVotingDialog.render(true);

    // Open the GM's vote monitor dialog
    if (activeMonitorDialog) {
      activeMonitorDialog.close();
      activeMonitorDialog = null;
    }

    activeMonitorDialog = new VoteMonitorDialog({
      expectedCount: expectedVoterIds.length,
      timeoutSeconds,
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
      timeoutSeconds,
    });
  } catch (err) {
    console.error(`${MODULE_ID} | Error in initiateVote:`, err);
    ui.notifications.error(game.i18n.localize("HERO_OF_THE_PEOPLE.Error.InitiateVote"));
  }
}

function openVotingDialog({ timerEnabled = true, timerDuration = 120 } = {}) {
  if (activeVotingDialog) {
    activeVotingDialog.close();
    activeVotingDialog = null;
  }

  const timeoutSeconds = timerEnabled ? timerDuration : null;
  activeVotingDialog = new HeroOfThePeopleDialog({
    timeoutSeconds,
    onVote: (voterId, targetId, hypeData) => {
      // Player sends vote + hype in one socket message
      heroSocket.emitCastVote(voterId, targetId, hypeData);
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

async function finalizeWinner(actorId) {
  const actor = game.actors.get(actorId);
  const winnerName = actor?.name ?? "Unknown";

  const awardType = await awardHeroPoint(actorId);
  await trackSessionWinner(actorId);
  await postWinnerChat({ winnerId: actorId, winnerName, awardType });
  heroSocket.emitVoteResults({ winnerId: actorId, winnerName, awardType });

  game.heroOfThePeople?.markVoteCompleted();
  reminderTimer.start();

  // Clean up monitor dialog reference
  activeMonitorDialog = null;

  // Clear collected hype
  collectedHype = [];
}

// ==================== PLAYER SETUP ====================

function setupPlayer() {
  heroSocket.on(SOCKET_EVENTS.INITIATE_VOTE, (payload) => {
    openVotingDialog(payload);
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

