# Stage data sources

`js/stages.js` holds only map and enemy-order data, which are facts about the original game. No program code was copied. Each cell was decided by majority vote across independent transcriptions, using the script described under Method.

## Sources (all fetched via `gh api`, 2026-10-29)

| Source | Used for | License |
|---|---|---|
| https://github.com/feichao93/battle-city, `src/stages/stage-N.json` | Maps (all 35, 8px-quadrant bit flags), enemy groups | MIT |
| https://github.com/dogballs/cattle-bity, `data/maps/original/NN.json` | Maps (all 35, rectangle regions in 32-unit steps), explicit 20-entry enemy order | MIT (LICENSE.md) |
| https://github.com/krystiankaluzny/Tanks, `resources/stages/N` | Maps (all 35, 26x26 text; has no enemy lists) | MIT |
| https://github.com/newagebegins/BattleCity, `src/Stages.js` | Maps and enemy order, **stages 1-4 only** (the file holds only 4 stages) | MIT |
| https://strategywiki.org/wiki/Battle_City/Walkthrough (via search snippet only; the page returned 403 / Cloudflare to fetch) | Stage 26 enemy counts (6 fast, 6 armor, 4 basic, 4 power) | Stated as CC BY-SA on StrategyWiki; only a single count line was used, not copied text |

## Method
1. Each source was converted to a 26x26 grid. The feichao93 4px brick bits were folded to 8px quadrants, and every bit pattern was aligned, so there were no partial quadrants.
2. For every cell, the majority value across the sources was taken (3 sources for stages 5-35, 4 for stages 1-4). The script asserted there were no ties.
3. The base area (rows 23-25, cols 11-14) was rewritten uniformly: `B` wall and `E` at rows 24-25, cols 12-13. In cattle-bity the base is not part of the terrain, so it is not compared.

## Enemy order
The original spawns each stage's tanks in grouped sequences. cattle-bity gives an explicit per-tank order and newagebegins does too (stages 1-4). feichao93 gives groups in the same order. All three agree wherever they overlap, except the three stages below, so the order in `stages.js` is the order the clones use. It was not checked against the ROM.

## Disagreements and choices
- Enemies, stage 9: feichao93 says `6*fast, 4*fast` (an obvious typo). I used cattle-bity: 6 basic, 4 fast, 7 power, 3 armor.
- Enemies, stage 17: feichao93 says `2 armor, 2 fast, 8 armor, 8 basic` (a typo; it would be 10 armor). I used cattle-bity: 2 armor, 2 fast, 8 power, 8 basic.
- Enemies, stage 26: feichao93 says 6 fast, 6 armor, 4 basic, 4 power. cattle-bity says 6 fast, 6 armor, 5 basic, 3 power. I chose 4/4 because it matches StrategyWiki. **This is the one enemy-count stage that is uncertain**, and feichao93 and StrategyWiki may share an origin.
- Map cells that differ from the majority:
  - Stage 2: (3,2-3) brick, (4,12-13) brick, (18-19,20-21) steel, (21,10-15) brick, and trees at rows 8-11, cols 0-1.
  - Stage 3: (14,6-7) and (17,10) empty, (16,11) brick, (20,14-17) brick.
  - Stage 5: (3,4-5) brick, with cattle-bity outvoted 2 to 1. (12-13,17) empty, with feichao93 outvoted 2 to 1.
  - Stage 10: (8-9,7) and (8-9,20) brick.
  - Stage 13: (6-7,2-3) steel.
  - Stage 15: this stage has the most disagreement. The kk source is messy, and several cells here are 2 to 1.
  - Stage 17: kk outvoted.
  - Stage 21: (22,6-7) brick.
  - Stage 32: the ice at row 9, cols 20-23 (only kk) was dropped.
  - Stage 34: (19,18) brick.
  - Tied or 2-to-1 cells are the least certain, especially in stages 5 and 15. Everything else had full agreement.
- Not verified from two independent sources: no stage is single-sourced for the map. Stages 5 and 15 have the weakest margins (one 2-vs-1 decision each, or more). No cell was guessed outright.

## Spawn areas
Stage 32 has ice (`I`) in both top-corner enemy spawn areas (rows 0-1, cols 0-1 and 24-25). feichao93 and kk agree on this, cattle-bity has it empty. I kept the ice, since ice is passable. The checker accepts `I` in spawn cells and prints a warning. All other stages have empty spawn areas.
