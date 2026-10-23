import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { money } from "../lib/api";
import { colors } from "../lib/theme";
import { AppRule, Candidate, Portfolio } from "../lib/types";
import { Bold, Btn, Chip, Label, Paper, Pill, Title } from "./ui";

const COLORS = ["#2F7FC1", "#5AA2DB", "#86BCE6", "#3E8E7E", "#6FB3A3", "#7A86C8", "#A39BD8", "#C48BA6", "#D2A26B", "#8FA65A", "#5E9FB8", "#B7C9D8"];
const VERB: Record<string, string> = { added: "Added", dropped: "Dropped", increased: "Increased", decreased: "Trimmed" };

export type CommitteeChange = { ticker: string; name: string; kind: string; before: number; after: number; reason: string; speaker: string };
export type CommitteeItem = { ticker: string; debate: { finalStances: Record<string, string> } };
export type Committee = {
  status: "idle" | "running" | "done" | "failed";
  changes?: CommitteeChange[];
  items?: CommitteeItem[];
  reviewed?: number;
  adjustments?: Record<string, number>;
};
export type Trust = { learned: { notes: string[] } | null };

function dissent(committee: Committee, ticker: string) {
  const it = committee.items?.find((x) => x.ticker === ticker);
  if (!it) return null;
  const st = Object.values(it.debate.finalStances);
  const against = st.filter((s) => s === "exclude").length;
  if (against) return <Pill label={`${against} of 3 analysts against`} tone="warn" />;
  if (st.length && st.every((s) => s === "include")) return <Pill label="Committee agrees" tone="good" />;
  return null;
}

export function DashboardScreen({
  p,
  rules,
  committee,
  trust,
  onOpen,
  onEdit,
  onConsidered,
  onChallenge,
  onRerun,
  onReset,
}: {
  p: Portfolio;
  rules: AppRule[];
  committee: Committee;
  trust: Trust | null;
  onOpen: (ticker: string) => void;
  onEdit: () => void;
  onConsidered: () => void;
  onChallenge: () => void;
  onRerun: () => void;
  onReset: () => void;
}) {
  const total = p.holdings.reduce((s, h) => s + h.amount, 0) || 1;
  const checked = p.considered.length;
  const pass = p.considered.filter((c) => !c.mainReason.startsWith("Fails")).length;
  const loss = rules.find((r) => r.field === "max_bad_year_loss");
  const sectors = new Map<string, number>();
  for (const h of p.holdings) sectors.set(h.sector || "Other", (sectors.get(h.sector || "Other") ?? 0) + h.amount);
  const sectorRows = [...sectors.entries()].sort((a, b) => b[1] - a[1]);
  const sectorMax = Math.max(...sectorRows.map(([, v]) => v), 1);

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Label>Dashboard</Label>
      <Title sub={`${money(total)} built from the budget you entered. Allocation, performance and the reason for every holding.`}>Your portfolio</Title>
      <View style={styles.row}>
        <View style={{ flex: 1 }}><Btn label="Everything considered" ghost onPress={onConsidered} /></View>
      </View>
      <View style={[styles.row, { marginTop: 8 }]}>
        <View style={{ flex: 1 }}><Btn label="Challenge it" ghost onPress={onChallenge} /></View>
        <View style={{ flex: 1 }}><Btn label="Edit details" onPress={onEdit} /></View>
      </View>

      <View style={styles.funnel}>
        {[[checked, "checked"], [pass, "pass your rules"], [p.holdings.length, "in your portfolio"]].map(([n, label]) => (
          <View key={String(label)} style={styles.funnelItem}>
            <Text style={styles.funnelNum}>{n}</Text>
            <Text style={styles.muted}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.stats}>
        <Paper style={styles.stat}><Label>Invested</Label><Text style={styles.statNum}>{money(total)}</Text><Text style={styles.muted}>{p.holdings.length} holdings</Text></Paper>
        <Paper style={styles.stat}>
          <Label>Bad year loss</Label>
          <Text style={styles.statNum}>{money(p.badYearLoss)}</Text>
          {loss ? <Pill label={p.badYearLoss <= Number(loss.value) ? `Within ${loss.id}` : `Above ${loss.id}`} tone={p.badYearLoss <= Number(loss.value) ? "good" : "bad"} /> : null}
        </Paper>
        <Paper style={styles.stat}><Label>Typical year</Label><Text style={styles.statSm}>{money(p.typicalRange[0])} to plus {money(p.typicalRange[1])}</Text></Paper>
        <Paper style={styles.stat}><Label>Your rules</Label><Text style={styles.statNum}>{p.ruleSummary.length}</Text><Text style={styles.muted}>checked against this mix</Text></Paper>
      </View>

      <Paper style={{ marginTop: 12 }}>
        <Text style={styles.h2}>Asset allocation</Text>
        <Text style={styles.muted}>{p.split.stocks}% shares, {p.split.bonds}% bonds{p.split.cash ? `, ${p.split.cash}% cash` : ""}</Text>
        <View style={styles.bar}>
          {p.holdings.map((h, i) => (
            <View key={h.ticker} style={{ width: `${(h.amount / total) * 100}%`, backgroundColor: COLORS[i % COLORS.length], height: 14 }} />
          ))}
        </View>
        {p.holdings.map((h, i) => (
          <Pressable key={h.ticker} onPress={() => onOpen(h.ticker)} style={styles.legend}>
            <View style={[styles.swatch, { backgroundColor: COLORS[i % COLORS.length] }]} />
            <Text style={{ flex: 1 }} numberOfLines={1}>{h.name}</Text>
            <Text style={styles.muted}>{((h.amount / total) * 100).toFixed(1)}%</Text>
          </Pressable>
        ))}
      </Paper>

      <Paper style={{ marginTop: 12 }}>
        <Text style={styles.h2}>Shares, bonds and cash</Text>
        {([
          ["Shares", p.split.stocks, COLORS[0]],
          ["Bonds", p.split.bonds, COLORS[2]],
          ["Cash", p.split.cash, "#D2A26B"],
        ] as [string, number, string][]).filter(([, v]) => v > 0).map(([label, value, color]) => (
          <View key={label} style={{ marginTop: 8 }}>
            <View style={styles.legend}><Text>{label}</Text><Text style={{ fontWeight: "700" }}>{value}%</Text></View>
            <View style={styles.track}><View style={{ width: `${value}%`, height: 8, borderRadius: 4, backgroundColor: color }} /></View>
          </View>
        ))}
      </Paper>

      <Paper style={{ marginTop: 12 }}>
        <Text style={styles.h2}>By sector</Text>
        {sectorRows.map(([label, value], i) => (
          <View key={label} style={{ marginTop: 8 }}>
            <View style={styles.legend}><Text style={{ flex: 1 }} numberOfLines={1}>{label}</Text><Text style={styles.muted}>{money(value)}</Text></View>
            <View style={styles.track}><View style={{ width: `${(value / sectorMax) * 100}%`, height: 8, borderRadius: 4, backgroundColor: COLORS[i % COLORS.length] }} /></View>
          </View>
        ))}
      </Paper>

      <Paper style={{ marginTop: 12 }}>
        <Text style={styles.h2}>Holdings and the reason</Text>
        {p.holdings.map((h, i) => (
          <Pressable key={h.ticker} onPress={() => onOpen(h.ticker)} style={styles.holding}>
            <View style={[styles.swatch, { backgroundColor: COLORS[i % COLORS.length], marginTop: 4 }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", color: colors.ink }}>{h.name}</Text>
              <Text style={styles.muted}>{h.ticker} · {h.sector}</Text>
              {dissent(committee, h.ticker)}
              <Text style={{ color: colors.good, marginTop: 4 }}>+ <Bold text={h.pros[0]?.text ?? ""} /></Text>
              <Text style={{ color: colors.bad }}>minus <Bold text={h.cons[0]?.text ?? ""} /></Text>
            </View>
            <View>
              <Text style={{ fontWeight: "700" }}>{money(h.amount)}</Text>
              <Text style={styles.muted}>{((h.amount / total) * 100).toFixed(1)}%</Text>
            </View>
          </Pressable>
        ))}
      </Paper>

      <CommitteeCard committee={committee} onOpen={onOpen} onRerun={onRerun} />

      <Paper style={{ marginTop: 12 }}>
        <Label>Your rules</Label>
        {p.ruleSummary.map((s) => (
          <View key={s.ruleId} style={[styles.legend, { marginTop: 6 }]}>
            <Text style={styles.ruleId}>{s.ruleId}</Text>
            <Text style={{ flex: 1, color: colors.ink }}>{s.status}</Text>
          </View>
        ))}
      </Paper>

      {trust?.learned?.notes?.length ? (
        <Paper style={{ marginTop: 12 }}>
          <View style={styles.legend}>
            <Label>Learned from you</Label>
            <Pressable onPress={onReset}><Text style={styles.link}>Reset</Text></Pressable>
          </View>
          {trust.learned.notes.map((n) => <Text key={n} style={{ marginTop: 6, color: colors.ink }}>{n}</Text>)}
        </Paper>
      ) : null}
    </ScrollView>
  );
}

function CommitteeCard({ committee, onOpen, onRerun }: { committee: Committee; onOpen: (t: string) => void; onRerun: () => void }) {
  return (
    <Paper style={{ marginTop: 12, borderColor: colors.accent }}>
      <Label>Committee review</Label>
      {committee.status === "running" && <Text style={styles.muted}>Three analysts are reviewing each holding and the closest misses, then debating them…</Text>}
      {committee.status === "failed" && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: colors.bad }}>The review could not finish.</Text>
          <View style={{ marginTop: 8 }}><Btn label="Try again" ghost onPress={onRerun} /></View>
        </View>
      )}
      {committee.status === "idle" && <View style={{ marginTop: 8 }}><Btn label="Run committee review" onPress={onRerun} /></View>}
      {committee.status === "done" && (
        <>
          <Text style={[styles.muted, { marginTop: 6 }]}>
            Reviewed {committee.reviewed ?? 0} companies. {committee.changes?.length ? `The discussion changed ${committee.changes.length}.` : "The discussion confirmed every holding."}
          </Text>
          {committee.changes?.map((x) => (
            <Pressable key={x.ticker} onPress={() => onOpen(x.ticker)} style={{ marginTop: 10 }}>
              <View style={styles.legend}>
                <Pill label={VERB[x.kind] ?? x.kind} tone={x.kind === "added" || x.kind === "increased" ? "good" : "bad"} />
                <Text style={{ fontWeight: "700", flex: 1 }}>{x.name}</Text>
              </View>
              <Text style={styles.muted}>{money(x.before)} to {money(x.after)}</Text>
              <Text style={{ marginTop: 4 }}><Text style={{ fontWeight: "700" }}>{x.speaker}: </Text><Bold text={x.reason} /></Text>
            </Pressable>
          ))}
        </>
      )}
    </Paper>
  );
}

export function ConsideredScreen({ p, rules, onOpen, onBack, onChallenge }: { p: Portfolio; rules: AppRule[]; onOpen: (t: string) => void; onBack: () => void; onChallenge: () => void }) {
  const [hi, setHi] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Title sub="Tap a rule to highlight what it affected. Tap a company for the full reason.">Everything we considered</Title>
      <View style={styles.chips}>
        {rules.map((r) => (
          <Chip key={r.id} label={`${r.id} · ${r.text.length > 28 ? `${r.text.slice(0, 28)}…` : r.text}`} on={hi === r.id} onPress={() => setHi(hi === r.id ? null : r.id)} />
        ))}
      </View>
      {p.considered.map((c) => {
        const hit = !hi || c.checks.some((ch) => ch.ruleId === hi && (!ch.pass || rules.find((r) => r.id === hi)?.field === "favour_sector"));
        return (
          <Pressable key={c.ticker} onPress={() => onOpen(c.ticker)} style={{ opacity: hit ? 1 : 0.35, marginBottom: 10 }}>
            <Paper>
              <View style={styles.legend}>
                <Text style={{ fontWeight: "700", flex: 1 }}>{c.name}</Text>
                <Pill label={c.status === "included" ? "Included" : "Excluded"} tone={c.status === "included" ? "good" : "bad"} />
              </View>
              <Text style={styles.muted}>{c.ticker} · {c.sector}</Text>
              <Text style={{ marginTop: 6 }}><Bold text={c.mainReason} /></Text>
              {c.whatWouldGetItIn ? <Text style={{ marginTop: 4, color: colors.warn }}>{c.whatWouldGetItIn}</Text> : null}
              {c.status === "included" ? <Text style={[styles.muted, { marginTop: 4 }]}>{money(c.amount)}</Text> : null}
            </Paper>
          </Pressable>
        );
      })}
      <View style={styles.row}>
        <View style={{ flex: 1 }}><Btn label="Back to portfolio" ghost onPress={onBack} /></View>
        <View style={{ flex: 1 }}><Btn label="Challenge it" onPress={onChallenge} /></View>
      </View>
    </ScrollView>
  );
}

export function ChallengeScreen({ p, onDecide, onOpen, onDone, learnedNote }: { p: Portfolio; onDecide: (c: Candidate, own: boolean) => void; onOpen: (t: string) => void; onDone: () => void; learnedNote: string }) {
  const [seen, setSeen] = useState<string[]>([]);
  const deck = p.considered
    .filter((c) => !c.mainReason.startsWith("Fails") && !seen.includes(c.ticker))
    .sort((a, b) => Number(a.status === "included") - Number(b.status === "included"));
  const top = deck[0];
  const score = (part: string) => Math.round(top?.score.parts.find((x) => x.name === part)?.value ?? 0);
  const decide = (own: boolean) => {
    if (!top) return;
    setSeen((s) => [...s, top.ticker]);
    onDecide(top, own);
  };
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Title sub="Keep it or drop it. Your portfolio rebalances and learns what you care about.">Challenge the AI</Title>
      {top ? (
        <Paper>
          <Pill label={top.status === "included" ? `Currently in · ${money(top.amount)}` : "Currently out"} tone={top.status === "included" ? "good" : "warn"} />
          <Text style={styles.cardName}>{top.name}</Text>
          <Text style={styles.muted}>{top.ticker} · {top.sector}</Text>
          <View style={[styles.row, { marginTop: 12 }]}>
            {["Growth", "Stability", "Income"].map((k) => (
              <View key={k} style={styles.score}>
                <Text style={styles.funnelNum}>{score(k)}</Text>
                <Text style={styles.muted}>{k}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.good, marginTop: 12 }}>+ <Bold text={top.pros[0]?.text ?? ""} /></Text>
          <Text style={{ color: colors.bad, marginTop: 4 }}>minus <Bold text={top.cons[0]?.text ?? ""} /></Text>
        </Paper>
      ) : (
        <Paper>
          <Text style={styles.h2}>All reviewed.</Text>
          <View style={{ marginTop: 12 }}><Btn label="See your updated portfolio" onPress={onDone} /></View>
        </Paper>
      )}
      <View style={[styles.row, { marginTop: 16 }]}>
        <View style={{ flex: 1 }}><Btn label="Drop" ghost onPress={() => decide(false)} disabled={!top} /></View>
        <View style={{ flex: 1 }}><Btn label="Details" ghost onPress={() => top && onOpen(top.ticker)} disabled={!top} /></View>
        <View style={{ flex: 1 }}><Btn label="Own" onPress={() => decide(true)} disabled={!top} /></View>
      </View>
      {learnedNote ? <Text style={{ marginTop: 12, color: colors.accent, textAlign: "center" }}>{learnedNote}</Text> : null}
      <Pressable onPress={onDone} style={{ marginTop: 16 }}><Text style={styles.link}>See updated portfolio</Text></Pressable>
    </ScrollView>
  );
}

export function HoldingModal({ ticker, p, onClose }: { ticker: string | null; p: Portfolio | null; onClose: () => void }) {
  const c = p?.considered.find((x) => x.ticker === ticker) ?? p?.holdings.find((x) => x.ticker === ticker);
  return (
    <Modal visible={!!c} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.legend}>
          <Text style={styles.h2}>{c?.name}</Text>
          <Pressable onPress={onClose}><Text style={styles.link}>Close</Text></Pressable>
        </View>
        {c ? (
          <>
            <Text style={styles.muted}>{c.ticker} · {c.sector}{c.status === "included" ? ` · ${money(c.amount)}` : ""}</Text>
            <Text style={{ marginTop: 12 }}><Bold text={c.mainReason} /></Text>
            {c.pros.map((x, i) => <Text key={`p${i}`} style={{ color: colors.good, marginTop: 8 }}>+ <Bold text={x.text} /></Text>)}
            {c.cons.map((x, i) => <Text key={`c${i}`} style={{ color: colors.bad, marginTop: 8 }}>minus <Bold text={x.text} /></Text>)}
            {c.whatWouldGetItIn ? <Text style={{ marginTop: 12, color: colors.warn }}>{c.whatWouldGetItIn}</Text> : null}
            {c.checks.length ? (
              <View style={{ marginTop: 16 }}>
                <Label>Rule checks</Label>
                {c.checks.map((ch) => (
                  <Text key={ch.ruleId + ch.detail} style={{ marginTop: 6 }}>
                    <Text style={{ fontWeight: "700", color: ch.pass ? colors.good : colors.bad }}>{ch.ruleId} {ch.pass ? "passes" : "fails"}. </Text>
                    {ch.detail}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 48, backgroundColor: colors.paper },
  h2: { fontFamily: "Newsreader_600SemiBold", fontSize: 22, color: colors.ink },
  cardName: { fontFamily: "Newsreader_600SemiBold", fontSize: 28, color: colors.ink, marginTop: 8 },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  row: { flexDirection: "row", gap: 8 },
  funnel: { flexDirection: "row", marginTop: 16, marginBottom: 8 },
  funnelItem: { flex: 1, borderLeftWidth: 4, borderLeftColor: colors.accent, paddingLeft: 8 },
  funnelNum: { fontFamily: "Newsreader_600SemiBold", fontSize: 28, color: colors.ink },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  stat: { width: "48%", flexGrow: 1 },
  statNum: { fontFamily: "Newsreader_600SemiBold", fontSize: 22, color: colors.ink, marginVertical: 4 },
  statSm: { fontSize: 16, color: colors.ink, marginTop: 4 },
  bar: { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", marginTop: 12, backgroundColor: colors.sky },
  legend: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.sky, marginTop: 4, overflow: "hidden" },
  holding: { flexDirection: "row", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
  ruleId: { backgroundColor: colors.baby, color: colors.accent, paddingHorizontal: 6, borderRadius: 4, overflow: "hidden", fontWeight: "700" },
  link: { color: colors.accent, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  score: { flex: 1, backgroundColor: colors.sky, borderRadius: 10, padding: 8, alignItems: "center" },
});
