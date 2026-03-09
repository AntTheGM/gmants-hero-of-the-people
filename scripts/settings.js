import { MODULE_ID } from "./const.js";

export function registerSettings() {
  game.settings.register(MODULE_ID, "reminderInterval", {
    name: "HERO_OF_THE_PEOPLE.Settings.ReminderInterval",
    hint: "HERO_OF_THE_PEOPLE.Settings.ReminderIntervalHint",
    scope: "world",
    config: true,
    type: Number,
    default: 60,
    choices: {
      30: "30 minutes",
      60: "1 hour",
      90: "1.5 hours",
      120: "2 hours",
    },
  });

  game.settings.register(MODULE_ID, "dialogPosition", {
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
}
