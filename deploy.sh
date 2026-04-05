#!/bin/bash
# Deploy GMAnt's Hero of the People to live Foundry modules directory
# Usage: bash deploy.sh

SRC="R:/Foundry/Modules/Hero_of_the_People"
DEST="R:/Foundry/Data/modules/gmants-hero-of-the-people"

mkdir -p "$DEST"

cp "$SRC/module.json" "$DEST/"
cp -r "$SRC/scripts" "$DEST/"
cp -r "$SRC/styles" "$DEST/"
cp -r "$SRC/templates" "$DEST/"
cp -r "$SRC/lang" "$DEST/"
[ -d "$SRC/assets" ] && cp -r "$SRC/assets" "$DEST/"
[ -d "$SRC/packs" ] && cp -r "$SRC/packs" "$DEST/"

echo "Deployed gmants-hero-of-the-people to $DEST"
echo "Refresh your browser (F5) to pick up changes."
