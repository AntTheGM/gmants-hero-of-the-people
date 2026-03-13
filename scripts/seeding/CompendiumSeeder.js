import { MODULE_ID } from "../const.js";

/**
 * Seeds the Hero of the People compendium with the GM macro on first load.
 */
export class CompendiumSeeder {
  static SEED_VERSION = 4;

  static async seedMacro() {
    if (!game.user.isGM) return;

    const packId = `${MODULE_ID}.hero-of-the-people-macros`;
    const pack = game.packs.get(packId);
    if (!pack) {
      console.warn(`${MODULE_ID} | Macro pack not found: ${packId}`);
      return;
    }

    const index = await pack.getIndex();

    // Check if we need to re-seed (version bump)
    if (index.size > 0) {
      const existing = await pack.getDocuments();
      const coreMacro = existing.find((m) => m.flags?.[MODULE_ID]?.core);
      if (coreMacro && coreMacro.flags[MODULE_ID].seedVersion >= CompendiumSeeder.SEED_VERSION) {
        return; // Already up to date
      }
      // Delete old macro to re-seed
      const wasLocked = pack.locked;
      if (wasLocked) await pack.configure({ locked: false });
      for (const doc of existing) {
        if (doc.flags?.[MODULE_ID]?.core) await doc.delete();
      }
      if (wasLocked) await pack.configure({ locked: true });
    }

    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });

    await Macro.create(
      {
        name: "Hero of the People",
        type: "script",
        img: "icons/sundries/flags/banner-symbol-axe-red.webp",
        command: `// Hero of the People — Open the Hero dialog
// GM: Opens the reminder/initiate dialog with elapsed time
// Players: Opens the Hero Hype dialog to send kudos
if (!game.heroOfThePeople) {
  ui.notifications.error("Hero of the People module is not active.");
} else {
  game.heroOfThePeople.open();
}`,
        flags: { [MODULE_ID]: { core: true, seedVersion: CompendiumSeeder.SEED_VERSION } },
      },
      { pack: packId }
    );

    if (wasLocked) await pack.configure({ locked: true });
    console.log(`${MODULE_ID} | Seeded "Hero of the People" macro (v${CompendiumSeeder.SEED_VERSION})`);
  }
}
