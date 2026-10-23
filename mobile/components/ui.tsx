import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { colors, shadow } from "../lib/theme";

export function Bold({ text, light }: { text: string; light?: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={{ color: light ? "#fff" : colors.ink }}>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <Text key={i} style={{ fontWeight: "700", color: light ? "#fff" : colors.ink }}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={styles.titleWrap}>
      <Text style={styles.title}>{children}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Paper({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.paper, style]}>{children}</View>;
}

export function Btn({ label, onPress, ghost, disabled }: { label: string; onPress: () => void; ghost?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [ghost ? styles.btnGhost : styles.btn, pressed && { opacity: 0.9 }, disabled && { opacity: 0.5 }]}>
      <Text style={[ghost ? styles.btnGhostText : styles.btnText]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, danger }: { label: string; on?: boolean; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && (danger ? styles.chipDanger : styles.chipOn)]}>
      <Text style={[styles.chipText, on && (danger ? styles.chipDangerText : styles.chipOnText)]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChange, keyboard }: { label: string; value: string; onChange: (v: string) => void; keyboard?: "default" | "email-address" | "numeric" }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={keyboard} autoCapitalize={keyboard === "email-address" ? "none" : "sentences"} style={styles.input} />
    </View>
  );
}

export function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <Field label={label} value={String(value)} keyboard="numeric" onChange={(v) => onChange(Number(v.replace(/\D/g, "")) || 0)} />
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: colors.muted, marginBottom: 8 },
  titleWrap: { marginBottom: 20 },
  title: { fontFamily: "Newsreader_600SemiBold", fontSize: 32, lineHeight: 38, color: colors.ink },
  sub: { marginTop: 8, fontSize: 17, lineHeight: 24, color: colors.muted, fontFamily: "SourceSans3_400Regular" },
  paper: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, ...shadow.paper },
  btn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16, fontFamily: "SourceSans3_600SemiBold" },
  btnGhost: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  btnGhostText: { color: colors.ink, fontWeight: "700", fontSize: 16, fontFamily: "SourceSans3_600SemiBold" },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.baby },
  chipDanger: { borderColor: colors.bad, backgroundColor: colors.badsoft },
  chipText: { fontSize: 14, color: colors.ink, fontFamily: "SourceSans3_400Regular" },
  chipOnText: { color: colors.accent, fontWeight: "600" },
  chipDangerText: { color: colors.bad, fontWeight: "600" },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.ink, marginBottom: 4, fontFamily: "SourceSans3_600SemiBold" },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, borderRadius: 10, padding: 10, fontSize: 16, color: colors.ink, fontFamily: "SourceSans3_400Regular" },
});
