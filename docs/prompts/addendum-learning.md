# Addendum: learning from user refinements (paste into Agent B and Agent C)

Mandate learns from every correction a user makes. No model training: we store corrections and feed them back at run time (in-context learning with memory), and we measure the effect. Never claim the model was trained, and never show an accuracy number that the eval script or the database did not produce.

## Agent B (API, `web/lib/ai`, `web/prisma`)
1. Prisma tables:
   * `Feedback { id, userId, kind, before Json, after Json, context Json, createdAt }` where kind is one of `rule_kind_toggle`, `rule_edit`, `rule_removed`, `rule_added`, `swipe`, `weight_change`.
   * `CorrectionExample { id, phrase String, ruleJson Json, timesConfirmed Int, updatedAt }`. One row per corrected phrase (the rule's `quote`).
   * Add `learned Json` to Preferences: `{ weightAdjust: {Growth, Profitability, Stability, Income, Valuation, News}, notes: string[] }`.
2. `POST /api/feedback` stores a Feedback row. For rule edits and toggles it also upserts a CorrectionExample (same phrase and same corrected rule increments `timesConfirmed`).
3. Parser memory in `POST /api/parse`:
   * Exact match: if a quote matches a CorrectionExample phrase with `timesConfirmed >= 2`, apply the corrected rule directly and set `kindReason` to "Learned from N earlier corrections".
   * Similar phrases: retrieve the 5 CorrectionExamples with the highest word overlap (Jaccard on lowercased words, no embeddings needed) and add them to the LLM prompt as few-shot examples: "Earlier users wrote <phrase> and confirmed it means <rule>".
4. Personal weights: on each `swipe` feedback, compare the swiped company's score parts with the universe average (Flask returns parts in `score.parts`). Own means move each part's weight adjustment by +0.5 × (part minus 50) / 50 points; Drop moves it the other way. Clamp each adjustment to ±10. Send `weights` (defaults plus adjustments) to Flask `POST /portfolio`. Write a plain note per change, for example "You value Stability more (+4)".
5. `GET /api/learning` returns `{ correctionRate, correctionsStored, examplesUsedLastParse, weightAdjust, notes }`. Correction rate = rules edited, toggled or removed divided by rules parsed, over the last 50 parses.
6. Evals: `npm run eval` runs the 12 sentence set twice, without and with stored CorrectionExamples, and writes both accuracies to `eval-results.json`. The before and after numbers in the UI come only from this file.
7. Tests: an exact match with `timesConfirmed >= 2` overrides the LLM; Jaccard retrieval returns the closest phrase; swipe updates stay within ±10; correction rate maths.

## Agent C (frontend)
1. Send `POST /api/feedback` on: switching Hard rule and Preference, editing, removing or adding a rule, every swipe, and every weight change in "Change how we score".
2. On "Here's what we understood", rule cards that came from memory show a small badge: "Learned from 6 earlier corrections".
3. Portfolio screen: a "Learned from you" card listing the notes from `/api/learning` (for example "You value Stability more (+4)"), with a Reset button.
4. Trust panel: correction rate, corrections stored, and the eval before and after accuracy from `eval-results.json`. If a number is missing, hide it rather than show a placeholder.

## Demo beat (adds about 20 seconds)
Before the demo, log in as a second user, type a phrase like "I'd like some tech exposure", switch it from Hard rule to Preference, and repeat once. In the demo, type a similar phrase: the card shows "Learned from 2 earlier corrections" and is already a Preference. Then point at the correction rate and the eval before and after numbers.

## Pitch line
"It doesn't need retraining. Every correction is stored and fed back, so it gets your meaning right first time, and we measure that: here is the correction rate and the before and after accuracy."
