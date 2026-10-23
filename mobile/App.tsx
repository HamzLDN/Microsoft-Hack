import {
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  useFonts as useNewsreader,
} from "@expo-google-fonts/newsreader";
import {
  SourceSans3_400Regular,
  SourceSans3_600SemiBold,
  useFonts as useSans,
} from "@expo-google-fonts/source-sans-3";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { ChallengeScreen, Committee, ConsideredScreen, DashboardScreen, HoldingModal, Trust } from "./components/dashboard";
import { AboutScreen, AuthScreen, HelpModal, LoadingScreen, PrefsScreen, RulesScreen } from "./components/screens";
import { api, setToken } from "./lib/api";
import { colors } from "./lib/theme";
import { AppRule, Candidate, DEFAULT_FORM, FormInput, Portfolio, savingsOf, User } from "./lib/types";

type Step = "boot" | "auth" | "about" | "prefs" | "reading" | "understood" | "opening" | "portfolio" | "considered" | "challenge";
type SavedPrefs = { savedAt: string; data: { form: FormInput; rules?: AppRule[] } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [newsreaderLoaded] = useNewsreader({ Newsreader_500Medium, Newsreader_600SemiBold });
  const [sansLoaded] = useSans({ SourceSans3_400Regular, SourceSans3_600SemiBold });
  const [step, setStep] = useState<Step>("boot");
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormInput>(DEFAULT_FORM);
  const [rules, setRules] = useState<AppRule[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [overrides, setOverrides] = useState<Record<string, "in" | "out">>({});
  const [weights, setWeights] = useState<Record<string, number> | undefined>();
  const [committee, setCommittee] = useState<Committee>({ status: "idle" });
  const [trust, setTrust] = useState<Trust | null>(null);
  const [help, setHelp] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [learnedNote, setLearnedNote] = useState("");

  const flash = (t: string) => {
    setToast(t.replace(/\*\*/g, ""));
    setTimeout(() => setToast(""), 3800);
  };

  const animateLines = async (list: string[], work: Promise<unknown>) => {
    setLines([]);
    for (const l of list) {
      await sleep(320);
      setLines((x) => [...x, l]);
    }
    await work;
  };

  const build = async (useRules: AppRule[], f: FormInput, ov: Record<string, "in" | "out">, w?: Record<string, number>, adjustments?: Record<string, number>) => {
    const res = await api<Portfolio>("/api/portfolio", {
      rules: useRules,
      horizon: f.horizon,
      risk: f.risk,
      maxHolding: f.maxHolding,
      overrides: ov,
      weights: w,
      adjustments,
      amount: savingsOf(f),
    });
    setPortfolio(res);
    api<Trust>("/api/learning").then(setTrust).catch(() => null);
    return res;
  };

  const runCommittee = async (useRules: AppRule[], f: FormInput, ov: Record<string, "in" | "out">, quiet = false) => {
    const brief = `Age ${f.age}, retiring at ${f.retireAge}, investing $${savingsOf(f).toLocaleString("en-US")} for ${f.horizon} years. Goal: ${f.purpose}. Rules: ${useRules.map((r) => `${r.id} ${r.text} (${r.kind === "hard" ? "hard rule" : "preference"})`).join("; ")}`;
    setCommittee({ status: "running" });
    try {
      const r = await api<{ portfolio: Portfolio; changes: Committee["changes"]; items: Committee["items"]; adjustments?: Record<string, number> }>("/api/committee", {
        request: { rules: useRules, horizon: f.horizon, risk: f.risk, maxHolding: f.maxHolding, overrides: ov, weights, amount: savingsOf(f) },
        client: brief,
      });
      setPortfolio(r.portfolio);
      setCommittee({ status: "done", changes: r.changes, items: r.items, adjustments: r.adjustments, reviewed: r.items?.length ?? 0 });
      if (!quiet) flash(r.changes?.length ? `The committee changed ${r.changes.length} holdings after discussing them.` : "The committee reviewed every holding and kept the portfolio as it was.");
    } catch {
      setCommittee({ status: "failed" });
    }
  };

  const openDashboard = async (f: FormInput, knownRules?: AppRule[], quiet = false) => {
    setErr("");
    setForm(f);
    setStep("opening");
    let nextRules = knownRules;
    if (knownRules === undefined) {
      const words = f.freeText.trim() ? f.freeText.trim().split(/\s+/).length : 0;
      const work = api<{ rules: AppRule[] }>("/api/parse", { form: f });
      await animateLines(["Read your preferences", `Read ${words} words of your own text`, "Matched your words to rules"], work);
      const parsed = await work.catch((e) => {
        setErr((e as Error).message);
        return null;
      });
      if (!parsed) return setStep("prefs");
      nextRules = parsed.rules;
    }
    if (!nextRules) return;
    setRules(nextRules);
    setOverrides({});
    setCommittee({ status: "idle" });
    const result = await api<Portfolio>("/api/portfolio", {
      rules: nextRules,
      horizon: f.horizon,
      risk: f.risk,
      maxHolding: f.maxHolding,
      overrides: {},
      amount: savingsOf(f),
    }).catch((e) => {
      setErr((e as Error).message);
      return null;
    });
    if (!result) return setStep(knownRules === undefined ? "prefs" : "understood");
    setPortfolio(result);
    api("/api/preferences", { form: f, rules: nextRules, onboarded: true }, "PUT").catch(() => null);
    setStep("portfolio");
    void runCommittee(nextRules, f, {}, quiet);
  };

  useEffect(() => {
    let cancelled = false;
    api<{ user: User | null }>("/api/auth")
      .then(async ({ user: u }) => {
        if (cancelled) return;
        if (!u) return setStep("auth");
        setUser(u);
        const { latest } = await api<{ latest: SavedPrefs | null }>("/api/preferences").catch(() => ({ latest: null }));
        if (cancelled) return;
        if (latest?.data?.form) void openDashboard(latest.data.form, latest.data.rules, true);
        else setStep("about");
      })
      .catch(() => {
        if (!cancelled) setStep("auth");
      });
    return () => {
      cancelled = true;
    };
    // Boot once. openDashboard from this render loads the saved form it is given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAuth = async (u: User, token: string) => {
    await setToken(token);
    setUser(u);
    const { latest } = await api<{ latest: SavedPrefs | null }>("/api/preferences").catch(() => ({ latest: null }));
    if (latest?.data?.form) void openDashboard(latest.data.form, latest.data.rules, true);
    else {
      setForm(DEFAULT_FORM);
      setStep("about");
    }
  };

  const reviewRules = async () => {
    setErr("");
    setStep("reading");
    const words = form.freeText.trim() ? form.freeText.trim().split(/\s+/).length : 0;
    const work = api<{ rules: AppRule[] }>("/api/parse", { form });
    await animateLines(["Read your preferences", `Read ${words} words of your own text`, "Matched your words to rules"], work);
    const parsed = await work.catch((e) => {
      setErr((e as Error).message);
      return null;
    });
    if (!parsed) return setStep("prefs");
    setRules(parsed.rules);
    setStep("understood");
  };

  const onSwipe = async (c: Candidate, own: boolean) => {
    if (!portfolio) return;
    const before = portfolio;
    const ov = { ...overrides, [c.ticker]: own ? ("in" as const) : ("out" as const) };
    setOverrides(ov);
    const fb = await api<{ learned?: { notes?: string[] } }>("/api/feedback", {
      kind: "swipe",
      before: c.status,
      after: { own, ticker: c.ticker },
      context: { parts: c.score.parts.map((x) => ({ name: x.name, value: x.value })) },
    }).catch(() => null);
    if (fb?.learned?.notes?.[0]) setLearnedNote(`Learned: ${fb.learned.notes[0]}`);
    const after = await build(rules, form, ov, weights, committee.adjustments).catch(() => null);
    if (!after) return;
    const lossRule = rules.find((r) => r.field === "max_bad_year_loss");
    flash(`${own ? "Added" : "Dropped"} ${c.name}. Bad year loss ${moneyLabel(before.badYearLoss)} to ${moneyLabel(after.badYearLoss)}, shares ${before.split.stocks}% to ${after.split.stocks}%${lossRule && after.split.stocks < before.split.stocks ? `, to stay within ${lossRule.id}` : ""}.`);
  };

  const logout = async () => {
    await api("/api/auth", { action: "logout" }).catch(() => null);
    await setToken(null);
    setUser(null);
    setPortfolio(null);
    setStep("auth");
  };

  if (!newsreaderLoaded || !sansLoaded || step === "boot") {
    return (
      <View style={styles.boot}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  const portfolioContext = portfolio
    ? `Bad year loss ${portfolio.badYearLoss}. Typical year ${portfolio.typicalRange[0]} to ${portfolio.typicalRange[1]}. Split ${portfolio.split.stocks}% shares, ${portfolio.split.bonds}% bonds, ${portfolio.split.cash}% cash. Holdings: ${portfolio.holdings.map((h) => `${h.name} (${h.ticker}) $${Math.round(h.amount)}`).join(", ")}.`
    : "";
  const context = `Screen: ${step}. ${drawer ? `Looking at ${drawer}.` : ""} ${portfolioContext}`;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>BETTERVEST</Text>
        {user ? (
          <Pressable onPress={logout}>
            <Text style={styles.logout}>Log out</Text>
          </Pressable>
        ) : null}
      </View>
      {err ? <Text style={styles.banner}>{err}</Text> : null}
      {step === "auth" && <AuthScreen onDone={onAuth} />}
      {step === "about" && <AboutScreen form={form} setForm={setForm} onNext={() => setStep("prefs")} />}
      {step === "prefs" && <PrefsScreen form={form} setForm={setForm} onBack={() => (portfolio ? setStep("portfolio") : setStep("about"))} onNext={reviewRules} />}
      {step === "reading" && <LoadingScreen title="Reading what you asked for" lines={lines} step={2} />}
      {step === "understood" && <RulesScreen rules={rules} setRules={setRules} onBack={() => setStep("prefs")} onNext={() => openDashboard(form, rules)} />}
      {step === "opening" && <LoadingScreen title="Opening your dashboard" lines={lines} step={2} />}
      {step === "portfolio" && portfolio && (
        <DashboardScreen
          p={portfolio}
          rules={rules}
          committee={committee}
          trust={trust}
          onOpen={setDrawer}
          onEdit={() => setStep("about")}
          onConsidered={() => setStep("considered")}
          onChallenge={() => setStep("challenge")}
          onRerun={() => runCommittee(rules, form, overrides)}
          onReset={async () => {
            await api("/api/learning", undefined, "DELETE");
            setWeights(undefined);
            await build(rules, form, overrides, undefined, committee.adjustments);
          }}
        />
      )}
      {step === "considered" && portfolio && (
        <ConsideredScreen p={portfolio} rules={rules} onOpen={setDrawer} onBack={() => setStep("portfolio")} onChallenge={() => setStep("challenge")} />
      )}
      {step === "challenge" && portfolio && (
        <ChallengeScreen p={portfolio} onDecide={onSwipe} onOpen={setDrawer} onDone={() => setStep("portfolio")} learnedNote={learnedNote} />
      )}
      {step !== "auth" && <Text style={styles.disclaimer}>Educational hackathon project. Not financial advice.</Text>}
      {user && step !== "auth" && (
        <Pressable style={styles.ask} onPress={() => setHelp(true)}>
          <Text style={styles.askText}>Ask</Text>
        </Pressable>
      )}
      {toast ? <Text style={styles.toast}>{toast}</Text> : null}
      <HoldingModal ticker={drawer} p={portfolio} onClose={() => setDrawer(null)} />
      <HelpModal open={help} onClose={() => setHelp(false)} context={context} />
    </SafeAreaView>
  );
}

function moneyLabel(n: number) {
  return `${n < 0 ? "minus " : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  brand: { fontFamily: "Newsreader_600SemiBold", fontSize: 22, letterSpacing: 1, color: colors.ink },
  logout: { color: colors.muted, fontSize: 14 },
  banner: { backgroundColor: colors.badsoft, color: colors.bad, padding: 10, textAlign: "center" },
  disclaimer: { fontSize: 11, color: colors.muted, textAlign: "center", paddingBottom: 8, paddingHorizontal: 12 },
  ask: { position: "absolute", right: 16, bottom: 28, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
  askText: { color: "#fff", fontWeight: "700" },
  toast: { position: "absolute", left: 16, right: 16, bottom: 84, backgroundColor: colors.ink, color: "#fff", padding: 12, borderRadius: 12, overflow: "hidden" },
});
