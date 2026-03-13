import { MODULE_ID } from "../const.js";

/**
 * Determine if a chat message should show the hero point reroll button.
 * @param {ChatMessage} message
 * @returns {boolean}
 */
function canShowRerollButton(message) {
  if (game.system.id !== "pf2e") return false;
  if (!game.settings.get(MODULE_ID, "enableRerollButton")) return false;
  if (!message.isRerollable) return false;

  const messageActor = message.actor;
  const actor = messageActor?.isOfType?.("familiar") ? messageActor.master : messageActor;
  if (!actor?.isOfType?.("character")) return false;
  if (actor.heroPoints.value <= 0) return false;
  if (!actor.isOwner) return false;

  return true;
}

/**
 * Post a chat message announcing that a hero point is being spent to reroll.
 * @param {ChatMessage} message - The original check message
 */
async function announceReroll(message) {
  const messageActor = message.actor;
  const actor = messageActor?.isOfType?.("familiar") ? messageActor.master : messageActor;
  const name = actor?.name ?? "Someone";
  const remaining = Math.max((actor?.heroPoints?.value ?? 1) - 1, 0);

  const content = `
    <div class="${MODULE_ID}-chat-card">
      <div class="${MODULE_ID}-chat-header">
        <i class="fa-regular fa-award"></i>
        <strong>${game.i18n.format("HERO_OF_THE_PEOPLE.Reroll.Announcement", { name })}</strong>
      </div>
      <div class="${MODULE_ID}-reroll-remaining">
        ${game.i18n.format("HERO_OF_THE_PEOPLE.Reroll.Remaining", { count: remaining })}
      </div>
    </div>
  `;

  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: { [MODULE_ID]: { type: "reroll-announcement" } },
  });
}

/**
 * Execute a hero point reroll by finding and calling PF2e's context menu callback.
 * Multiple modules (e.g., Monk's TokenBar) register entries with the same name,
 * so we collect all matches and try each until one succeeds.
 * @param {ChatMessage} message
 */
async function executeHeroPointReroll(message) {
  const contextOptions = ui.chat._getEntryContextOptions();
  const candidates = contextOptions.filter((e) => e.name === "PF2E.RerollMenu.HeroPoint");

  if (candidates.length === 0) {
    console.warn(`${MODULE_ID} | No PF2E.RerollMenu.HeroPoint context entry found`);
    ui.notifications.error(game.i18n.localize("HERO_OF_THE_PEOPLE.Reroll.Error"));
    return;
  }

  // Build a fake <li> with dataset.messageId — what PF2e's callback expects
  const fakeLi = document.createElement("li");
  fakeLi.dataset.messageId = message.id;

  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i];
    try {
      // Test condition with raw element (PF2e uses li.dataset.messageId)
      if (entry.condition && !entry.condition(fakeLi)) {
        console.log(`${MODULE_ID} | Candidate ${i} condition failed`);
        continue;
      }
      console.log(`${MODULE_ID} | Calling hero point reroll callback (candidate ${i})`);
      // Post announcement before the reroll
      await announceReroll(message);
      // Try raw element first (PF2e source uses li.dataset), fall back to jQuery
      try {
        await entry.callback(fakeLi);
      } catch (rawErr) {
        console.log(`${MODULE_ID} | Raw call failed: ${rawErr.message}, trying jQuery`);
        if (typeof jQuery !== "undefined") {
          await entry.callback(jQuery(fakeLi));
        } else {
          throw rawErr;
        }
      }
      return;
    } catch (err) {
      console.log(`${MODULE_ID} | Candidate ${i} failed:`, err.message, err.stack);
    }
  }

  console.warn(`${MODULE_ID} | All hero point reroll candidates failed`);
  ui.notifications.error(game.i18n.localize("HERO_OF_THE_PEOPLE.Reroll.Error"));
}

/**
 * Inject a small hero point reroll icon button into a rendered PF2e check chat card.
 * Placed inline next to the dice formula row.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
export function onRenderChatMessage(message, html) {
  if (!canShowRerollButton(message)) return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Don't inject if already present
  if (el.querySelector(`.${MODULE_ID}-reroll-btn`)) return;

  // Get hero point count for tooltip
  const messageActor = message.actor;
  const actor = messageActor?.isOfType?.("familiar") ? messageActor.master : messageActor;
  const hpCount = actor?.heroPoints?.value ?? 0;

  // Build button
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `${MODULE_ID}-reroll-btn`;
  btn.innerHTML = `<i class="fa-regular fa-award"></i>`;
  btn.title = game.i18n.format("HERO_OF_THE_PEOPLE.Reroll.Tooltip", { count: hpCount });

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await executeHeroPointReroll(message);
  });

  // Place alongside Damage/Critical buttons if they exist, otherwise after dice result
  const messageButtons = el.querySelector(".message-buttons, .card-buttons");
  if (messageButtons) {
    messageButtons.appendChild(btn);
  } else {
    const diceTotal = el.querySelector(".dice-total");
    const target = diceTotal?.closest(".dice-roll") ?? diceTotal?.parentElement;
    if (target) {
      target.insertAdjacentElement("afterend", btn);
    }
  }
}
