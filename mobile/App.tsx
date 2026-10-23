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
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import {
  AboutScreen,
  AuthScreen,
  HelpModal,
  LoadingScreen,
  PortfolioScreen,
  PrefsScreen,
  RulesScreen,
} from "./components/screens";
import { api, apiBase, setToken } from "./lib/api";
import { colors } from "./lib/theme";
import { AppRule, DEFAULT_FORM, FormInput, Portfolio, User } from "./lib/types";

type Step = "boot" | "auth" | "about" | "prefs" | "loading" | "rules" | "building" | "portfolio";

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
  const [help, setHelp] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<{ user: User | null }>("/api/auth")
      .then(({ user: u }) => {
        if (u) {
          setUser(u);
          setStep("about");
        } else setStep("auth");
      })
      .catch(() => setStep("auth"));
  }, []);

  const onAuth = async (u: User, token: string) => {
    await setToken(token);
    setUser(u);
    setStep("about");
  };

  const animateLines = async (list: string[], work: Promise<unknown>) => {
    setLines([]);
    for (const l of list) {
      await sleep(320);
      setLines((x) => [...x, l]);
    }
    await work;
  };

  const parse = async () => {
    setErr("");
    setStep("loading");
    const words = form.freeText.trim() ? form.freeText.trim().split(/\s+/).length : 0;
    const work = api<{ rules: AppRule[] }>("/api/parse", { form });
    await animateLines(
      ["Read your form", `Read ${words} words of your own text`, "Matched your words to rules", "Checked earlier corrections", "Marked hard rules and preferences"],
      work,
    );
    try {
      const r = await work;
      setRules(r.rules);
      api("/api/preferences", { form }, "PUT").catch(() => null);
      setStep("rules");
    } catch (e) {
      setErr((e as Error).message);
      setStep("prefs");
    }
  };

  const build = useCallback(async () => {
    setStep("building");
    setLines(["Scoring companies and funds", "Applying your hard rules", "Balancing weights", "Building the portfolio"]);
    const res = await api<Portfolio>("/api/portfolio", {
      rules,
      horizon: form.horizon,
      risk: form.risk,
      maxHolding: form.maxHolding,
    });
    setPortfolio(res);
    setStep("portfolio");
  }, [rules, form]);

  if (!newsreaderLoaded || !sansLoaded) {
    return (
      <View style={styles.boot}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  const context = user ? `Logged in as ${user.email}. Step: ${step}.` : "Mandate mobile";

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      {step === "auth" && <AuthScreen onDone={onAuth} />}
      {step === "about" && <AboutScreen form={form} setForm={setForm} onNext={() => setStep("prefs")} />}
      {step === "prefs" && (
        <>
          {err ? <Text style={styles.banner}>{err}</Text> : null}
          <PrefsScreen form={form} setForm={setForm} onBack={() => setStep("about")} onNext={parse} />
        </>
      )}
      {(step === "loading" || step === "building") && (
        <LoadingScreen title={step === "loading" ? "Understanding you" : "Building your portfolio"} lines={lines} />
      )}
      {step === "rules" && <RulesScreen rules={rules} onBack={() => setStep("prefs")} onNext={build} />}
      {step === "portfolio" && portfolio && <PortfolioScreen p={portfolio} onHelp={() => setHelp(true)} />}
      {step !== "auth" && step !== "boot" && (
        <Text style={styles.apiHint} numberOfLines={1}>
          {apiBase()}
        </Text>
      )}
      <HelpModal open={help} onClose={() => setHelp(false)} context={context} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  banner: { backgroundColor: colors.badsoft, color: colors.bad, padding: 10, textAlign: "center" },
  apiHint: { fontSize: 10, color: colors.muted, textAlign: "center", paddingBottom: 6, paddingHorizontal: 8 },
});
