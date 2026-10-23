# Bettervest: 7 minute presentation script

## Click path at a glance (login to the end)

1. **Login screen** → email `john.doe@bettervest.app`, password from the README → **Log in**. John's dashboard opens.
2. **Edit details** → **About you** (amount, investment horizon) → **Continue**.
3. **Preferences** → move the risk slider → **Use an example** → **Continue**.
4. **Here's what we understood** → point at a rule's quote ("Hard because you said can't") → **Build my portfolio**.
5. **Dashboard** → point at the dollar amounts, the bad year loss line and the **Committee review** card.
6. Click a holding with a **Judge: BUY** badge → drawer opens → **Show committee review** → phases 1 to 4 → **Question the Judge**.
7. **Close** the drawer → switch to the **Backstage** tab → latest session → a company tagged **COMPLIANCE_BLOCK** → **Show transcript**.
8. Back to the main site → sidebar **Assistant** tab → ask about Pfizer vs Johnson & Johnson volatility.
9. Top bar **A+ Larger text** (then switch it back).
10. Optional: **Challenge it** → **Own** a company → watch the toast. Then close on the dashboard.

Two people: **Speaker** (talks, faces the judge) and **Driver** (clicks, never talks over the Speaker).
Target 7:00. Hard stop 8:00. Each section says what to click, what to say, and which "10: Outstanding" box it ticks.

---

## Before you go on (10 minutes before)

1. Run `./start.sh` and leave that terminal open. Check http://localhost:3000/api/llm-health says `ok: true`.
2. Log in as **John Doe** (`john.doe@bettervest.app`, password in the README).
3. Go through About you and preferences with **Use an example**, build the portfolio, and **wait for the Committee review card to finish** (about 2 minutes). This caches the run so it loads instantly on stage.
4. Log out. On stage, logging back in as John opens his dashboard straight away, and the committee result loads instantly because the inputs are the same.
5. Open **Backstage** (http://localhost:3000/backstage) in a second tab.
6. Browser zoom 110 to 125% so the back row can read it. Larger text toggle off.
7. Backup: screenshots of the dashboard, a committee transcript and a COMPLIANCE_BLOCK in Backstage, in case the Wi‑Fi or AI drops.

---

## 0:00 to 0:40 · The client and the problem

**Driver:** login screen showing "Your rules. Your portfolio. Every reason shown."

**Speaker:**
> "Meet John. He's 58, he has **$100,000**, and he needs it to last until he retires in 9 years. He doesn't want a black box telling him what to buy. He wants his own rules followed, and he wants to know *why*.
> Today's robo advisers give him a risk score and a pie chart. Bettervest gives him an investment committee that argues about every company, follows his rules exactly, and shows its working."

✅ **Client focus:** a specific client with a specific need, from the first sentence.

---

## 0:40 to 1:50 · His rules, in his own words

**Driver:** log in as John Doe. His dashboard opens. Click **Edit details** to show how he set it up: **About you**. Point at **Amount you plan to invest** and **Investment horizon (years)**.

**Speaker:** "Two numbers to start: how much, and for how long."

**Driver:** **Continue**. On preferences, drag the risk slider so the bad year loss line updates, then click **Use an example** and **Continue**. The "Here's what we understood" screen appears.

**Speaker:**
> "Now he just talks: *I can't stomach losing more than about 15% in a bad year. No gambling or tobacco. I like dividends.*
> The AI turns that into numbered rules. Look: *'Hard rule, because you said **can't**.'* Every rule quotes his exact words, and he can switch any of them between a hard rule and a preference with one tap.
> And it learns: when people correct a rule, the next person gets it right first time."

✅ **Client focus:** designed around *his* objectives, in his language.
✅ **Data and AI:** language turned into structured, checkable rules.

---

## 1:50 to 2:40 · The recommendation

**Driver:** **Build my portfolio**. The dashboard appears (instantly, because the same inputs were rehearsed).

**Speaker:**
> "Here's the recommendation: exactly where his $100,000 goes, company by company, in dollars.
> His $15,000 loss limit is checked against a year of real price data: we estimate a bad year at about $14,900, so we're inside it.
> Every holding shows a pro **and** a con. We never hide the downside."

✅ **Quality of recommendation:** specific (dollar amounts), well reasoned (pros, cons, the loss check), easy to follow.

---

## 2:40 to 4:30 · The investment committee (the centrepiece)

**Driver:** point at the **Committee review** card: added, dropped or resized holdings, each with a reason.

**Speaker:**
> "A single AI asked 'should I buy this?' tends to agree with whoever's asking. So we don't ask one AI. We run a committee, on Microsoft's model, gpt 6.1 sol."

**Driver:** open a holding with a **Judge: BUY** or **SELL** badge (Prologis was a BUY in rehearsal). Click **Show committee review**. Point at the phase bar.

**Speaker:**
> "Phase one: a **Bull** writes the case for, a **Bear** writes the case against. They never see each other's work.
> Phase two: two rounds of cross examination. Green is the Bull, red is the Bear. **Every claim has to cite a real figure**: these little tags are the sources, from filings, prices and news. Here the Bear says it's not cheap at 28 times earnings; the Bull answers with its cash flow.
> Our code checks every number they write against the data. No citation, no claim."

**Driver:** scroll to **Phase 4**. Click **Question the Judge** and type *"Why not hold more of it?"*

**Speaker:**
> "Then a neutral **Judge**, our Chief Compliance Officer, weighs only the cited evidence and rules Buy, Hold or Sell. And that verdict actually moves John's money: this one went from $7,800 to $9,000.
> And John can question any of them, in plain English."

✅ **Data and AI:** analysis that would be hard to do manually: two adversarial analysts, cited evidence, number checking, across every holding.
✅ **Originality:** an adversarial committee, not a chatbot.
✅ **Quality of recommendation:** the logic is visible and easy to follow.

---

## 4:30 to 5:30 · The circuit breaker (why you can trust it)

**Driver:** switch to the **Backstage** tab. Open the latest session, then a company tagged **COMPLIANCE_BLOCK** (the tobacco or gambling one).

**Speaker:**
> "Before any verdict, a circuit breaker runs.
> If a stock breaks the client's rules, it's blocked instantly. This tobacco company never even got a debate: a flat No Go, because John said no tobacco.
> If one of the analysts stops responding, we reject the stock rather than let one side argue unopposed. That's an **ARCHITECTURE_FAIL**.
> If anyone quotes a number that isn't in the data, that's a **DATA_INTEGRITY_FAIL**, and the run is killed.
> In finance, one invented number can cost real money. Our system would rather say no than guess."

**Driver:** scroll the session list.

**Speaker:** "And every argument, every chat and every rejection is recorded here. A compliance officer can audit exactly why the AI recommended what it did."

✅ **Quality of recommendation:** credible, auditable.
✅ **Originality:** a fault-tolerant, compliance-first design that stands out.

---

## 5:30 to 6:20 · Built for real people

**Driver:** back to the main site. In the sidebar, open the **Assistant** tab and type *"Is Pfizer more volatile than Johnson and Johnson?"*

**Speaker:** "Any term on screen has an info button, and the help assistant looks up live data to answer." *(It answers with both volatility figures.)*

**Driver:** click **A+ Larger text** in the top bar (click it again after, to switch back).

**Speaker:** "And we designed for older investors like John: bigger buttons, higher contrast text, and one tap for larger text."

**Driver (optional, if time):** open **Challenge it**, swipe one company in. A toast shows how the bad year loss changes.

**Speaker:** "And if John disagrees, he can challenge the portfolio himself and see the consequence instantly."

✅ **Client focus:** accessible, explains itself.
✅ **Execution:** polished, live, real data.

---

## 6:20 to 7:00 · Close

**Driver:** back to the dashboard.

**Speaker:**
> "So: one client, his rules in his words, real public data, and an AI committee that argues, cites its sources, refuses to guess, and shows every reason.
> Bettervest: your rules, your portfolio, every reason shown. Thank you."

---

## Likely judge questions

| Question | Answer |
|---|---|
| "Where does the data come from?" | Free public sources: yfinance and Finnhub for prices and news, SEC EDGAR filings for financials, FRED for inflation and interest rates. Every figure on screen shows its source and date. |
| "What if the AI makes a number up?" | Code compares every number to the evidence. In the debate that's a `DATA_INTEGRITY_FAIL` and the run is killed. In chat, the answer is retried or replaced with the real figure. Backstage shows how many were checked and blocked. |
| "Isn't this just a chatbot?" | No. The chat is the interface. The work is a pipeline: rules from language, a portfolio engine, an adversarial committee with cited evidence, a circuit breaker and a verdict that changes the portfolio. |
| "Why three agents and not one?" | One model tends to agree with the user. Splitting into Bull and Bear forces both sides to be argued, and a separate Judge decides. That's how real investment committees avoid confirmation bias. |
| "Which Microsoft tech?" | The whole committee runs on Microsoft's gpt 6.1 sol through the hackathon's Azure OpenAI gateway. |
| "Can it give personal advice?" | It's an educational tool, not financial advice; the footer says so. The Judge also checks suitability against the client's own rules. |

## If something breaks

- **AI slow or down:** the committee falls back to clearly labelled data rules; say "this is the data-only mode, and it still follows every rule and check."
- **Site down:** run `./start.sh` again (it clears old servers itself), or switch to the backup screenshots and keep talking.
