import { MODULE_ID } from "./const.js";

/**
 * Award a hero point, inspiration, or announce-only based on the game system.
 * @param {string} actorId - The winning actor's ID
 * @returns {Promise<string>} The award type: "heroPoint", "inspiration", or "none"
 */
export async function awardHeroPoint(actorId) {
  const actor = game.actors.get(actorId);
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
 * Add a winner to the session winners list (by actor ID).
 * @param {string} actorId
 */
export async function trackSessionWinner(actorId) {
  const current = game.settings.get(MODULE_ID, "sessionWinners");
  if (!current.includes(actorId)) {
    await game.settings.set(MODULE_ID, "sessionWinners", [...current, actorId]);
  }
}
