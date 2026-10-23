# Bettervest: committee pitch and demo case

## 45 second speech (about 120 words)

> A single AI asked "should I buy this?" tends to agree with whoever is asking. So Bettervest doesn't ask one AI. It runs an investment committee.
>
> A **Bull** analyst builds the case for, a **Bear** analyst builds the case against, and they never see each other's work. Then they cross examine each other for two rounds, and every claim must cite a real figure from filings, prices or news. Our code checks every number.
>
> Before any verdict, a **circuit breaker** runs. If a stock breaks the client's rules, if an analyst stops responding, or if anyone quotes a number that isn't in the data, the run is killed and the stock is rejected.
>
> Only then does a neutral **Judge** rule Buy, Hold or Sell, and that verdict actually moves the client's money. Every argument is on the record in Backstage.

## Demo case (about 3 minutes of the 8)

**Client:** John Doe (`john.doe@bettervest.app`), investing **$100,000 for 9 years**, wants income later.

**Their words (click "Use an example"):** *"I need this money to last. I can't stomach losing more than about 15% in a bad year. No gambling or tobacco. I like companies that pay dividends, and I'm interested in healthcare."*

**Before presenting:** run the committee once with these exact preferences so the review loads instantly (it's cached for 3 hours), and open Backstage in a second tab.

| Step | Do | Say |
|---|---|---|
| 1 | Build the portfolio. Point at the **Committee review** card when it finishes. | "The committee reviewed every holding, the closest misses and two rule breakers. These are the companies its verdicts moved." |
| 2 | Open a holding with a **Judge: BUY** or **SELL** badge, click **Show committee review**. | "Phase 1: the Bull and Bear theses, written independently, every claim with its source." |
| 3 | Scroll to **Phase 2**. | "Two rounds of cross examination. Green is the Bull, red is the Bear. No citation, no claim." |
| 4 | Scroll to **Phase 4**, then click **Question the Judge** and ask *"Why not hold more of it?"* | "The Judge weighs only cited evidence, names who argued better, and its verdict changed this holding from X to Y." |
| 5 | Switch to **Backstage**, open a **tobacco or gambling company**. | "Here the circuit breaker tripped: COMPLIANCE_BLOCK. It breaks John's own rule, so no debate was even run. A flat No Go." |
| 6 | Point at the phase bar and checks. | "Every run, every claim and every rejection is recorded. That's an audit trail a compliance officer can actually read." |

**If asked "what if the AI makes a number up?"** The number check compares every figure to the evidence. A mismatch in the debate is a `DATA_INTEGRITY_FAIL`, which kills the run for that stock rather than letting a made up figure reach a decision.

**If asked "what if one agent fails?"** That's an `ARCHITECTURE_FAIL`. We reject the stock rather than let one side argue unopposed, because a one-sided debate is just bias.
