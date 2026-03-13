import { MODULE_ID } from "../const.js";
import { getRandomQuote } from "./quotes.js";

/**
 * Post the winner announcement as a chat message.
 * @param {object} options
 * @param {string} options.winnerId - Actor ID of the winner
 * @param {string} options.winnerName - Character name
 * @param {string} options.awardType - "heroPoint", "inspiration", or "none"
 */
export async function postWinnerChat({ winnerId, winnerName, awardType }) {
  const quote = getRandomQuote();

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
      <div class="hero-of-the-people-chat-quote">
        <em>&ldquo;${quote.text}&rdquo;</em>
        <span class="hero-of-the-people-chat-author">&mdash; ${quote.author}</span>
      </div>
    </div>
  `;

  await ChatMessage.create({
    content,
    speaker: { alias: game.i18n.localize("HERO_OF_THE_PEOPLE.Dialog.Title") },
    flags: { [MODULE_ID]: { type: "winner-announcement", winnerId } },
  });
}
