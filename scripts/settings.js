import { MODULE_ID } from "./const.js";
import { QuoteConfig } from "./settings/QuoteConfig.js";

export function registerSettings() {
  game.settings.registerMenu(MODULE_ID, "quoteConfig", {
    name: "HERO_OF_THE_PEOPLE.Settings.QuoteConfig",
    label: "HERO_OF_THE_PEOPLE.Settings.QuoteConfigLabel",
    hint: "HERO_OF_THE_PEOPLE.Settings.QuoteConfigHint",
    icon: "fas fa-quote-left",
    type: QuoteConfig,
    restricted: true,
  });

  game.settings.register(MODULE_ID, "quoteOverrides", {
    scope: "world",
    config: false,
    default: { added: [], deleted: [] },
    type: Object,
  });

  game.settings.register(MODULE_ID, "reminderInterval", {
    name: "HERO_OF_THE_PEOPLE.Settings.ReminderInterval",
    hint: "HERO_OF_THE_PEOPLE.Settings.ReminderIntervalHint",
    scope: "world",
    config: true,
    type: Number,
    default: 90,
    range: {
      min: 5,
      max: 180,
      step: 5,
    },
  });

  game.settings.register(MODULE_ID, "voteTimerEnabled", {
    name: "HERO_OF_THE_PEOPLE.Settings.VoteTimerEnabled",
    hint: "HERO_OF_THE_PEOPLE.Settings.VoteTimerEnabledHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "voteTimerDuration", {
    name: "HERO_OF_THE_PEOPLE.Settings.VoteTimerDuration",
    hint: "HERO_OF_THE_PEOPLE.Settings.VoteTimerDurationHint",
    scope: "world",
    config: true,
    type: Number,
    default: 120,
    range: {
      min: 15,
      max: 300,
      step: 15,
    },
  });

  game.settings.register(MODULE_ID, "hideSessionWinners", {
    name: "HERO_OF_THE_PEOPLE.Settings.HideSessionWinners",
    hint: "HERO_OF_THE_PEOPLE.Settings.HideSessionWinnersHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "enableRerollButton", {
    name: "HERO_OF_THE_PEOPLE.Settings.EnableRerollButton",
    hint: "HERO_OF_THE_PEOPLE.Settings.EnableRerollButtonHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "excludedActors", {
    name: "HERO_OF_THE_PEOPLE.Settings.ExcludedActors",
    hint: "HERO_OF_THE_PEOPLE.Settings.ExcludedActorsHint",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_ID, "dialogPosition", {
    scope: "client",
    config: false,
    default: {},
    type: Object,
  });

  game.settings.register(MODULE_ID, "monitorPosition", {
    scope: "client",
    config: false,
    default: {},
    type: Object,
  });

  game.settings.register(MODULE_ID, "reminderPosition", {
    scope: "client",
    config: false,
    default: {},
    type: Object,
  });

  game.settings.register(MODULE_ID, "spotlightDismissed", {
    scope: "world",
    config: false,
    default: false,
    type: Boolean,
  });

  game.settings.register(MODULE_ID, "spotlightPosition", {
    scope: "client",
    config: false,
    default: {},
    type: Object,
  });

  game.settings.register(MODULE_ID, "sessionWinners", {
    scope: "world",
    config: false,
    default: [],
    type: Array,
  });

  game.settings.register(MODULE_ID, "sessionStartTime", {
    scope: "world",
    config: false,
    default: 0,
    type: Number,
  });

  game.settings.register(MODULE_ID, "lastVoteTime", {
    scope: "world",
    config: false,
    default: 0,
    type: Number,
  });
}

/**
 * Get the set of excluded actor names (lowercased) from the comma-separated setting.
 * @returns {Set<string>}
 */
export function getExcludedActorNames() {
  const raw = game.settings.get(MODULE_ID, "excludedActors");
  if (!raw) return new Set();
  return new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}
