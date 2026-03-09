import { MODULE_ID } from "./const.js";
import { getPlayerCharacter } from "./utils.js";

/**
 * Award a hero point, inspiration, or announce-only based on the game system.
 * @param {string} userId - The winning user's ID
 * @returns {Promise<string>} The award type: "heroPoint", "inspiration", or "none"
 */
export async function awardHeroPoint(userId) {
  const user = game.users.get(userId);
  const actor = user ? getPlayerCharacter(user) : null;
  if (!actor) return "none";

  const systemId = game.system.id;

  if (systemId === "pf2e") {
    const hp = actor.system?.resources?.heroPoints;
    if (hp && hp.value < hp.max) {
      await actor.update({ "system.resources.heroPoints.value": hp.value + 1 });
      return "heroPoint";
    }
    return "heroPoint"; // Already at max, still counts as the award type
  }

  if (systemId === "dnd5e") {
    await actor.update({ "system.attributes.inspiration": true });
    return "inspiration";
  }

  return "none";
}

/**
 * Post the winner announcement as a chat message.
 * @param {object} options
 * @param {string} options.winnerId - User ID of the winner
 * @param {string} options.winnerName - Character name
 * @param {string} options.awardType - "heroPoint", "inspiration", or "none"
 */
export async function postWinnerChat({ winnerId, winnerName, awardType }) {
  const quoteIndex = Math.floor(Math.random() * 6) + 1;
  const quote = game.i18n.localize(`HERO_OF_THE_PEOPLE.Quote.${quoteIndex}`);

  let awardText = "";
  if (awardType === "heroPoint") {
    awardText = game.i18n.format("HERO_OF_THE_PEOPLE.Chat.HeroPointAwarded", { name: winnerName });
  } else if (awardType === "inspiration") {
    awardText = game.i18n.format("HERO_OF_THE_PEOPLE.Chat.InspirationAwarded", { name: winnerName });
  }

  const announcement = game.i18n.format("HERO_OF_THE_PEOPLE.Chat.HeroAnnouncement", { name: winnerName });

  const content = `
    <div class="hero-of-the-people-chat-card">
      <div class="hero-of-the-people-chat-header">
        <i class="fas fa-medal"></i>
        <strong>${announcement}</strong>
      </div>
      ${awardText ? `<div class="hero-of-the-people-chat-award">${awardText}</div>` : ""}
      <div class="hero-of-the-people-chat-quote"><em>${quote}</em></div>
    </div>
  `;

  await ChatMessage.create({
    content,
    speaker: { alias: game.i18n.localize("HERO_OF_THE_PEOPLE.Dialog.Title") },
    flags: { [MODULE_ID]: { type: "winner-announcement", winnerId } },
  });
}

/**
 * Add a winner to the session winners list.
 * @param {string} userId
 */
export async function trackSessionWinner(userId) {
  const current = game.settings.get(MODULE_ID, "sessionWinners");
  if (!current.includes(userId)) {
    await game.settings.set(MODULE_ID, "sessionWinners", [...current, userId]);
  }
}
