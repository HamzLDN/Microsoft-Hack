// Plain English meanings for every metric and term on screen. Written by hand, not generated.
export const GLOSSARY: Record<string, string> = {
  "Share price": "What one share costs right now.",
  "1 year return": "How much the price rose or fell over the last 12 months, including dividends reinvested.",
  Volatility: "How much the price usually swings in a year. Higher means a bumpier ride; 15% is calm, 40% is very jumpy.",
  "Largest fall": "The biggest drop from a high point to a low point in the last year. It shows how bad things got at the worst moment.",
  Beta: "How much the share tends to move when the whole market moves. 1 means in step with the market; below 1 means calmer.",
  "P/E": "Price to earnings: how many years of today's profit you are paying for. High numbers mean investors expect a lot of growth.",
  "Dividend yield": "The cash paid out to shareholders each year, as a percentage of the price. Useful if you want income.",
  "Revenue growth": "How much the company's sales grew compared with a year earlier.",
  "Free cash flow margin": "The share of sales left as spare cash after running and investing in the business. Positive means it pays its own way.",
  "Gross margin": "The share of each sale left after the direct cost of making it.",
  "Market value": "The total value of all the company's shares. Bigger companies tend to be steadier.",
  "Debt to equity": "How much the company owes compared with what its owners have put in. Above 2 is a lot of debt.",
  "Bad year loss": "How much this mix could lose in a bad year, roughly one year in twenty. It is an estimate from past price swings, not a promise.",
  "Typical range": "Where the value usually lands after a normal year, based on past swings.",
  Split: "How your money is divided between shares (growth, more ups and downs), bonds (steadier, pay interest) and cash.",
  Score: "A 0 to 100 rating built from six parts you can see: growth, profitability, stability, income, value and news. Your preferences add or remove points.",
  Growth: "Score part: how fast sales are growing compared with the other companies we looked at.",
  Profitability: "Score part: how much spare cash the company makes compared with the others.",
  Stability: "Score part: how calm the share price has been. Smaller swings and smaller falls score higher.",
  Income: "Score part: how much it pays out in dividends compared with the others.",
  Valuation: "Score part: how cheap the share is compared with its profits. Cheaper scores higher.",
  News: "Score part: whether recent headlines were mostly good or bad.",
  "Hard rule": "Something you will not compromise on. Any company that breaks it is left out, whatever its score.",
  Preference: "Something you would like. It adds or removes points but never rules a company out on its own.",
  Evidence: "Every number the AI analysts use, with where it came from and when. They may only use these numbers.",
  ETF: "A fund you can buy like a share. It holds many companies or bonds at once, so it spreads your risk.",
  "Bond fund": "A fund holding loans to governments or companies. It pays interest and usually moves much less than shares.",
  Horizon: "How many years until you need the money. Longer horizons can take more ups and downs.",
  "Max per holding": "The most of your money that can go into any one company, so one bad result can't sink the portfolio.",
  Inflation: "How fast prices in the shops are rising. Your money needs to grow faster than this to keep its value.",
  "10 year yield": "The interest the US government pays to borrow for 10 years. It affects what bonds pay.",
  "Fed funds rate": "The US central bank's main interest rate.",
  "What would get it in": "The smallest change to your rules or choices that would bring a left out company into your portfolio.",
  "Correction rate": "How often people had to fix a rule the app understood from their words. Lower means it understands better.",
};

export function lookup(term: string): string | undefined {
  const t = term.toLowerCase();
  const key = Object.keys(GLOSSARY).find((k) => k.toLowerCase() === t) || Object.keys(GLOSSARY).find((k) => t.includes(k.toLowerCase()));
  return key ? GLOSSARY[key] : undefined;
}

export const METRIC_TERMS: Record<string, string> = {
  price: "Share price", ret1y: "1 year return", vol: "Volatility", dd: "Largest fall", beta: "Beta", pe: "P/E", divYield: "Dividend yield",
  revGrowth: "Revenue growth", fcfMargin: "Free cash flow margin", grossMargin: "Gross margin", mcap: "Market value", debtToEquity: "Debt to equity",
};
