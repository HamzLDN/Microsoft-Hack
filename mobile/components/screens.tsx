import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, money } from "../lib/api";
import { colors } from "../lib/theme";
import {
  AppRule,
  DEFAULT_FORM,
  DEMO_TEXT,
  EXCLUDE_GROUPS,
  FormInput,
  Portfolio,
  THEMES,
  User,
} from "../lib/types";
import { Bold, Btn, Chip, Field, Label, NumField, Paper, Title } from "./ui";

const RISK = ["", "Very careful", "Very careful", "Careful", "Careful", "Balanced", "Balanced", "Adventurous", "Adventurous", "Very adventurous", "Very adventurous"];
const PURPOSES = ["Grow it", "Income later", "Income now", "A one off goal"];

export function AuthScreen({ onDone }: { onDone: (u: User, token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const submit = async () => {
    setErr("");
    try {
      const r = await api<{ user: User; token?: string }>("/api/auth", { action: mode, email, password });
      if (!r.token) throw new Error("No session token");
      onDone(r.user, r.token);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Label>Mandate</Label>
      <Text style={styles.hero}>
        Your rules.{"\n"}Your portfolio.{"\n"}
        <Text style={{ color: colors.accent }}>Every reason shown.</Text>
      </Text>
      <Text style={styles.heroSub}>Tell us what you want and what you won&apos;t accept. We build a $100,000 portfolio around it.</Text>
      <Paper style={{ marginTop: 20 }}>
        <Text style={styles.cardTitle}>{mode === "login" ? "Log in" : "Create your account"}</Text>
        <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
        <Field label="Password" value={password} onChange={setPassword} />
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <View style={{ marginTop: 16, gap: 10 }}>
          <Btn label={mode === "login" ? "Log in" : "Create account"} onPress={submit} />
          <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
            <Text style={styles.link}>{mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}</Text>
          </Pressable>
        </View>
      </Paper>
    </ScrollView>
  );
}

export function AboutScreen({ form, setForm, onNext }: { form: FormInput; setForm: (f: FormInput) => void; onNext: () => void }) {
  const set = (patch: Partial<FormInput>) => {
    const next = { ...form, ...patch };
    if ("age" in patch || "retireAge" in patch) next.horizon = Math.max(1, next.retireAge - next.age);
    setForm(next);
  };
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Title sub="This sets how long your money is invested for.">About you</Title>
      <Paper>
        <NumField label="Your age" value={form.age} onChange={(age) => set({ age })} />
        <NumField label="Age you plan to retire" value={form.retireAge} onChange={(retireAge) => set({ retireAge })} />
        <NumField label="Years invested" value={form.horizon} onChange={(horizon) => set({ horizon: Math.max(1, horizon) })} />
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>What is the money for?</Text>
        <View style={styles.chipRow}>
          {PURPOSES.map((p) => (
            <Chip key={p} label={p} on={form.purpose === p} onPress={() => set({ purpose: p })} />
          ))}
        </View>
      </Paper>
      <View style={{ marginTop: 16 }}>
        <Btn label="Continue" onPress={onNext} />
      </View>
    </ScrollView>
  );
}

export function PrefsScreen({ form, setForm, onBack, onNext }: { form: FormInput; setForm: (f: FormInput) => void; onBack: () => void; onNext: () => void }) {
  const [preview, setPreview] = useState<{ badYearLoss: number; typicalRange: [number, number]; split: { stocks: number; bonds: number } } | null>(null);
  useEffect(() => {
    const t = setTimeout(
      () =>
        api<{ badYearLoss: number; typicalRange: [number, number]; split: { stocks: number; bonds: number } }>("/api/data/risk-preview", {
          horizon: form.horizon,
          risk: form.risk,
        })
          .then(setPreview)
          .catch(() => setPreview(null)),
      300,
    );
    return () => clearTimeout(t);
  }, [form.horizon, form.risk]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Title sub="Set the basics, then add anything else in your own words.">What matters to you</Title>
      <Paper style={{ marginBottom: 12 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.fieldLabel}>How much ups and downs can you take?</Text>
          <Text style={{ color: colors.accent, fontWeight: "700" }}>
            {form.risk}/10 · {RISK[form.risk]}
          </Text>
        </View>
        <View style={styles.sliderRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Pressable key={n} onPress={() => setForm({ ...form, risk: n })} style={[styles.sliderDot, form.risk >= n && styles.sliderDotOn]} />
          ))}
        </View>
        {preview && (
          <View style={styles.preview}>
            <Text style={{ color: colors.muted }}>
              {preview.split.stocks}% shares, {preview.split.bonds}% bonds. Bad year (about 1 in 20): roughly {money(preview.badYearLoss)}.
            </Text>
          </View>
        )}
      </Paper>
      <Paper style={{ marginBottom: 12 }}>
        <Text style={styles.fieldLabel}>Areas to favour</Text>
        <View style={styles.chipRow}>
          {THEMES.map((t) => (
            <Chip key={t} label={t} on={form.favour.includes(t)} onPress={() => setForm({ ...form, favour: toggle(form.favour, t) })} />
          ))}
        </View>
      </Paper>
      <Paper style={{ marginBottom: 12 }}>
        <Text style={styles.fieldLabel}>Leave out (hard rules)</Text>
        {Object.entries(EXCLUDE_GROUPS).map(([g, tags]) => (
          <View key={g} style={{ marginTop: 10 }}>
            <Label>{g}</Label>
            <View style={styles.chipRow}>
              {tags.map((t) => (
                <Chip key={t} label={t} on={form.exclude.includes(t)} danger onPress={() => setForm({ ...form, exclude: toggle(form.exclude, t) })} />
              ))}
            </View>
          </View>
        ))}
      </Paper>
      <Paper>
        <View style={styles.rowBetween}>
          <Text style={styles.fieldLabel}>Anything else, in your own words</Text>
          <Pressable onPress={() => setForm({ ...form, freeText: DEMO_TEXT })}>
            <Text style={styles.link}>Example</Text>
          </Pressable>
        </View>
        <TextInput multiline value={form.freeText} onChangeText={(freeText) => setForm({ ...form, freeText })} placeholder="No tobacco, steady income…" style={[styles.textarea, { marginTop: 8 }]} />
      </Paper>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Btn label="Back" ghost onPress={onBack} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Understand my preferences" onPress={onNext} />
        </View>
      </View>
    </ScrollView>
  );
}

export function LoadingScreen({ title, lines }: { title: string; lines: string[] }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.loadTitle, { marginTop: 16, textAlign: "center" }]}>{title}</Text>
      {lines.map((l) => (
        <Text key={l} style={styles.loadLine}>
          ✓ {l}
        </Text>
      ))}
    </View>
  );
}

export function RulesScreen({ rules, onBack, onNext }: { rules: AppRule[]; onBack: () => void; onNext: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Title sub="Each line is a rule your portfolio must follow.">Here&apos;s what we understood</Title>
      {rules.map((r) => (
        <Paper key={r.id + r.text} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={styles.ruleId}>{r.id}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", color: colors.ink }}>{r.text}</Text>
              <Text style={styles.mutedSm}>{r.kind === "hard" ? "Hard rule" : "Preference"} · {r.kindReason}</Text>
            </View>
          </View>
        </Paper>
      ))}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Btn label="Back" ghost onPress={onBack} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Build my portfolio" onPress={onNext} />
        </View>
      </View>
    </ScrollView>
  );
}

export function PortfolioScreen({ p, onHelp }: { p: Portfolio; onHelp: () => void }) {
  const total = p.holdings.reduce((s, h) => s + h.amount, 0);
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Title sub={`${p.holdings.length} holdings · $${Math.round(total).toLocaleString()}`}>Your portfolio</Title>
      {p.holdings.map((h) => (
        <Paper key={h.ticker} style={{ marginBottom: 10 }}>
          <View style={styles.rowBetween}>
            <Text style={{ fontWeight: "700", fontSize: 17 }}>{h.name}</Text>
            <Text style={{ color: colors.accent, fontWeight: "700" }}>{total ? ((h.amount / total) * 100).toFixed(1) : 0}%</Text>
          </View>
          <Text style={styles.mutedSm}>{h.ticker} · {money(h.amount)}</Text>
          <Text style={{ marginTop: 6, color: colors.muted, fontSize: 14 }}>{h.mainReason}</Text>
        </Paper>
      ))}
      <Btn label="Ask about this portfolio" ghost onPress={onHelp} />
    </ScrollView>
  );
}

export function HelpModal({ open, onClose, context }: { open: boolean; onClose: () => void; context: string }) {
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Ask about any metric, or a **live price** (try **iShares TIPS Bond**)." },
  ]);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const text = q.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setQ("");
    setBusy(true);
    try {
      const r = await api<{ reply: string }>("/api/chat", { mode: "help", context, messages: next.slice(1) });
      setMsgs([...next, { role: "assistant", content: r.reply }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Could not reach the server. Check EXPO_PUBLIC_API_URL and that the web app is running." }]);
    }
    setBusy(false);
  };
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.help}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Help</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.link}>Close</Text>
          </Pressable>
        </View>
        <ScrollView style={{ flex: 1, marginTop: 12 }}>
          {msgs.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleBot]}>
              <Bold text={m.content} />
            </View>
          ))}
          {busy ? <Text style={styles.mutedSm}>Thinking…</Text> : null}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TextInput value={q} onChangeText={setQ} placeholder="What does this mean?" style={[styles.input, { flex: 1 }]} />
          <Btn label="Send" onPress={send} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 40, backgroundColor: colors.paper },
  hero: { fontFamily: "Newsreader_600SemiBold", fontSize: 36, lineHeight: 40, color: colors.ink },
  heroSub: { marginTop: 12, fontSize: 17, color: colors.muted, fontFamily: "SourceSans3_400Regular", lineHeight: 24 },
  cardTitle: { fontFamily: "Newsreader_600SemiBold", fontSize: 22, color: colors.ink },
  err: { marginTop: 8, color: colors.bad, fontSize: 14 },
  link: { color: colors.accent, fontWeight: "700", textAlign: "center", padding: 8 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.ink, fontFamily: "SourceSans3_600SemiBold" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  sliderRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, marginBottom: 8 },
  sliderDot: { width: 24, height: 8, borderRadius: 4, backgroundColor: colors.baby },
  sliderDotOn: { backgroundColor: colors.accent },
  preview: { backgroundColor: colors.sky, padding: 12, borderRadius: 10, marginTop: 8 },
  textarea: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 10, padding: 12, minHeight: 88, textAlignVertical: "top", fontFamily: "SourceSans3_400Regular", color: colors.ink },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: colors.paper },
  loadTitle: { fontFamily: "Newsreader_600SemiBold", fontSize: 28, color: colors.ink },
  loadLine: { marginTop: 6, color: colors.muted, fontFamily: "SourceSans3_400Regular" },
  ruleId: { backgroundColor: colors.baby, color: colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontWeight: "600", overflow: "hidden" },
  mutedSm: { marginTop: 4, fontSize: 13, color: colors.muted },
  help: { flex: 1, padding: 16, paddingTop: 48, backgroundColor: colors.paper },
  bubble: { padding: 10, borderRadius: 10, marginBottom: 8, maxWidth: "90%" },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: colors.sky },
  bubbleBot: { alignSelf: "flex-start", backgroundColor: colors.baby },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, backgroundColor: colors.card },
});
