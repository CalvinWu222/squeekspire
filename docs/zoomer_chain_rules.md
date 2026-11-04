# Zoomie Chain rules

The UI calls this **Zoomie Chain** (also referred to as Zoomer Chain). These rules describe the resolver in `src/game/engine.ts` (`play`, `startTurn`, `endTurn`, and `loseHp`) and the multiplier in `src/game/score.ts` (`scoreMultipliers`). They document the existing mechanics; this copy update does not change them.

## Building and resetting the live Chain

- The live Chain starts at **0**, with no matched card type, at the beginning of every player turn and every battle.
- The first ordinary card establishes its type and leaves the Chain at **0**. Types are **Attack, Skill, Power, and Curse**; the card name, cost, damage, target, and upgrade level do not determine a match.
- Playing another card of the matched type adds **1 Chain**, capped at **20**. For example, three ordinary Attacks in succession give Chain **0 → 1 → 2**.
- Switching to a different card type resets the live Chain to **0**, then establishes the new type. For example, Attack → Attack → Skill → Skill gives **0 → 1 → 0 → 1**.
- Drawing, discarding, exhausting, retaining, or upgrading a card does not count as playing it and does not independently change Chain. An invalid/rejected action leaves the state unchanged.
- Ending your turn resets the live Chain and matched type when the next player turn starts. This happens even if all damage is blocked, the enemy does not attack, or **Spacetime Fold** skips the enemy action and grants a free turn. Retaining cards with Diamond Hands does not retain Chain. **Touch Grass** also ends the turn and therefore resets Chain if combat continues.

**Does taking enemy damage break the Chain? No.** HP loss has no independent Chain-reset effect. Enemy attacks normally occur after End Turn, so the next turn resets Chain whether or not an attack causes damage. The same HP-loss function handles damage from effects such as Insomnia and drawing NYN Sob, without changing Chain. Defeat ends combat rather than adding a separate Chain rule.

## Cards that modify or preserve Chain

| Card | Exact behavior |
| --- | --- |
| **Wheel Brake** | Skips both the normal Chain increment/reset and the matched-type change. It keeps the current count and type unchanged, even though it is a Skill. It adds no Chain, even under WAGMI. Attack → Wheel Brake → Attack continues the Attack match. A later type switch or End Turn still resets Chain. Playing it first leaves Chain 0 and no matched type. This is the sole card whose old text said “Preserve your Chain”; it does **not** preserve Chain across turns. |
| **Seed Snack** | First follows the normal Skill match/reset rule, draws cards, then adds **1 extra Chain**, capped at 20. On a type switch it therefore ends at 1; after a matching Skill it adds 2 in total. The upgrade changes draw count, not Chain. |
| **Double Lap** | First follows the normal Attack match/reset rule, then adds **1 extra Chain**, capped at 20. Its two damage hits do not count as two card plays. On a type switch it ends at 1; after a matching Attack it adds 2 in total. |
| **gm** | Follows the normal Skill rule on every turn. On **turn 1 only**, it also draws 1 and adds **1 extra Chain**, capped at 20. Later turns grant neither extra effect. |
| **WAGMI** | WAGMI itself first follows the normal **Power** match/reset rule. After it resolves, each subsequent ordinary card adds **1 Chain regardless of its type** for the rest of that turn, capped at 20. The matched type still updates to the played card's type. Seed Snack, Double Lap, and turn-1 gm still add their extra point; Wheel Brake still leaves the count/type unchanged. The wildcard expires at End Turn. WAGMI separately sets a run minimum multiplier of at least ×1.5 and clears/prevents FUD; that minimum does not preserve the live Chain. |
| **Freeze for Mint** | Saves the Chain multiplier and full effective multiplier from **immediately before this card is played** as minimums for the remainder of this battle, keeping the largest saved value on repeated uses. The card itself still follows the normal **Skill** match/reset rule. It preserves a **scoring bonus**, not the live count or matched type: switching types and starting another turn still reset the live Chain. Both saved minimums disappear when a new battle creates a new combat state. With Diamond Hands, its separate “Never Selling” combo also raises the run minimum multiplier to at least ×2. |

## Scoring

In an ordinary room the live Chain factor is **1.1^Chain**. In a golden **Zoomies** room it is **2.2^Chain**. Chain is capped at 20 before this calculation. This factor multiplies the additive multiplier and battle trigger multiplier; it is a scoring bonus, not extra attack damage.

Freeze for Mint makes the Chain factor at least its saved Chain factor and makes the full effective multiplier at least its saved full multiplier. The effective multiplier also cannot fall below the run minimum. A frozen floor remains even when the live counter reads 0; the game uses the larger applicable value rather than adding the frozen and live Chain bonuses together.

Regression coverage: `src/game/chain-rules.test.ts`, with broader individual card contracts in `src/game/card-effects.test.ts`.
