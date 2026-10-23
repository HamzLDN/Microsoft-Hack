# Bettervest: 8 minute presentation

**Structure:** 1:30 on the client base, 5:30 live demo from the login page, 1:00 close.
**Roles:** the **Speaker** talks and faces the judge; the **Driver** clicks and never talks over the Speaker.
Each section notes which "10: Outstanding" box on the judging grid it ticks.

**Links:** site http://localhost:3000 · Backstage http://localhost:3000/backstage

---

## Before you go on (15 minutes before)

1. Run `./start.sh` and leave that terminal open. Check http://localhost:3000/api/llm-health shows `ok: true`.
2. **Rehearse the exact demo once** with a throwaway account (**New here? Create an account**, any email like `rehearsal1@bettervest.app`). Use the same clicks as below: amount **100000**, horizon **9**, **Use an example**, default everything else. Wait for the **Committee review** card to finish (about 2 minutes). This caches the committee, so on stage it loads instantly.
3. Log out. Leave the **login page** on screen.
4. Open **Backstage** in a second tab (it will show the rehearsal session).
5. Browser zoom about 115%. Larger text off.
6. Backup: screenshots of the dashboard, a committee review and a COMPLIANCE_BLOCK, in case the Wi‑Fi or AI drops.

---

## Part 1 · The client base (0:00 to 1:30, no clicking)

**Speaker:**
> "Our client is the everyday individual investor, and especially people approaching or in retirement.
>
> In the UK and US, millions of people are moving from a salary to living off their savings. Someone with $100,000 doesn't get a private wealth manager. Their options are a robo adviser, which gives them a risk score and a pie chart, or a chatbot that tells them what they want to hear.
>
> What they actually need is three things:
> first, **their own rules respected**: 'I can't lose more than 15% in a bad year', 'no tobacco', 'I need income';
> second, **an honest view of the downside**, not just the upside;
> and third, **reasons they can understand and check**, because it's their life savings.
>
> So we built Bettervest: an investment committee for one person. Let us show you with John."

✅ **Client focus:** a clearly defined client need, stated before any tech.

---

## Part 2 · Live demo from the login page (1:30 to 7:00)

### 1:30 · Sign up (20 seconds)
**Driver:** on the login page click **New here? Create an account**, enter `john@bettervest.app` and a password, then **Create account**.

**Speaker:** "John signs up. His preferences are saved, so next time he goes straight to his portfolio."

### 1:50 · About you (25 seconds)
**Driver:** type **100000** in **Amount you plan to invest**, **9** in **Investment horizon (years)**, pick **Income later**, then **Continue**.

**Speaker:** "Two numbers to start: how much, and for how long. John has $100,000 and needs it in 9 years."

### 2:15 · His preferences, in his own words (45 seconds)
**Driver:** drag the risk slider a little so the bad year loss line changes, then click **Use an example** and **Continue**.

**Speaker:**
> "As he moves the slider, it tells him in dollars what a bad year could cost, not an abstract risk score.
> Then he just talks: *'I can't stomach losing more than about 15% in a bad year. No gambling or tobacco. I like companies that pay dividends.'*"

✅ **Client focus:** built around his objectives, in his language.

### 3:00 · Here's what we understood (30 seconds)
**Driver:** point at the loss limit rule and the tobacco rule.

**Speaker:**
> "Our AI turns his words into numbered rules, and every rule quotes him: *'Hard rule, because you said can't.'* If it misread him, he taps to switch it. And it learns from those corrections."

✅ **Data and AI:** language turned into structured, checkable rules.

### 3:30 · The recommendation (40 seconds)
**Driver:** **Build my portfolio**. The dashboard opens. Point at the holdings list, then the bad year loss.

**Speaker:**
> "Here's exactly where his $100,000 goes, company by company, in dollars. Real public data: SEC filings, prices, news and Federal Reserve figures.
> His $15,000 loss limit is checked against a year of real price swings: about $14,900, so he's inside it.
> And every holding shows a pro **and** a con. We never hide the downside."

✅ **Quality of recommendation:** specific and well reasoned.

### 4:10 · The AI investment committee (1:30, the centrepiece)
**Driver:** point at the **Committee review** card. Then click a holding with a **Judge: BUY** badge (Prologis in rehearsal), then **Show committee review**.

**Speaker:**
> "One AI asked 'should I buy this?' tends to agree with whoever is asking. So we don't ask one AI. We run a committee, on Microsoft's gpt 6.1 sol.
>
> **Phase 1:** a **Bull** builds the case for, a **Bear** builds the case against, and they never see each other's work.
> **Phase 2:** two rounds of cross examination. Green is the Bull, red is the Bear. Every claim must cite a real figure; these tags are the sources. Here the Bear says it isn't cheap at 28 times earnings, and the Bull answers with its cash flow. Our code checks every single number against the data.
> **Phase 4:** a neutral **Judge**, our Chief Compliance Officer, weighs only cited evidence and rules Buy, Hold or Sell. And it moves real money: this holding went from $7,800 to $9,000."

**Driver:** click **Question the Judge**, type *"Why not hold more of it?"*

**Speaker:** "And John can question any of them in plain English."

✅ **Data and AI:** analysis that would be hard to do manually, across every holding.
✅ **Originality:** an adversarial committee, not a chatbot.

### 5:40 · The circuit breaker (50 seconds)
**Driver:** **Close** the drawer, switch to the **Backstage** tab, open the latest session, then a company tagged **COMPLIANCE_BLOCK** → **Show transcript**.

**Speaker:**
> "That was Phase 3: the circuit breaker. Before any verdict, three checks.
> Break the client's rules and it's blocked instantly: this tobacco company never even got a debate, a flat No Go.
> If an analyst stops responding, we reject the stock rather than let one side argue unopposed.
> If anyone quotes a number that isn't in the data, the run is killed.
> In finance, one invented number costs real money, so our system would rather say no than guess. And everything is recorded here, so a compliance officer can audit exactly why."

✅ **Quality of recommendation:** credible and auditable.
✅ **Originality:** compliance first, fault tolerant.

### 6:30 · Built for real people (30 seconds)
**Driver:** back to the main site. In the sidebar, open **Assistant** and ask *"Is Pfizer more volatile than Johnson and Johnson?"* Then click **A+ Larger text** in the top bar.

**Speaker:** "The assistant looks up live data to answer him. And because many of our clients are older, there are bigger buttons, higher contrast text, and one tap for larger text."

✅ **Execution:** polished, live, real data.

---

## Part 3 · Close (7:00 to 8:00)

**Driver:** click **A+ Larger text** again to switch it back. Leave the dashboard on screen.

**Speaker:**
> "So: a real client need, his rules in his own words, real public data, and an AI committee that argues both sides, cites its sources, refuses to guess, and shows every reason.
> For John, that means he understands and trusts what happens to his savings.
> Bettervest: your rules, your portfolio, every reason shown. Thank you, we'd love your questions."

---

## Likely judge questions

| Question | Answer |
|---|---|
| "Where does the data come from?" | Free public sources: yfinance and Finnhub for prices and news, SEC EDGAR filings for financials, FRED for inflation and rates. Every figure shows its source and date. |
| "What if the AI makes a number up?" | Code compares every number to the evidence. In the debate that's a DATA_INTEGRITY_FAIL and the run is killed. Backstage shows the checks. |
| "Isn't this just a chatbot?" | The chat is the interface. The work is a pipeline: rules from language, a portfolio engine, an adversarial committee with cited evidence, a circuit breaker, and a verdict that changes the portfolio. |
| "Why three agents?" | One model drifts toward agreeing with the user. A Bull and a Bear force both sides to be argued, and a separate Judge decides, like a real investment committee. |
| "Microsoft tech?" | The whole committee runs on Microsoft's gpt 6.1 sol through the hackathon's Azure OpenAI gateway. |
| "Is this financial advice?" | No, it's an educational tool, and the footer says so. The Judge also checks suitability against the client's own rules. |

## If something breaks

- **AI slow or down:** the app falls back to clearly labelled data rules. Say: "this is the data only mode; it still follows every rule and check."
- **Site down:** run `./start.sh` again (it clears old servers itself), or switch to the backup screenshots and keep talking.
- **Committee card still running:** open the drawer on a holding instead and narrate Phase 1 while it finishes.
