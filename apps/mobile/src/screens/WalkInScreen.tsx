import { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { PET_SPECIES_BOOKING_OPTIONS } from "@saasclinics/lib";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

export function WalkInScreen({
  branches,
  onWalkIn,
  refreshing,
  onRefresh,
}: {
  branches: Array<{ id: string; name: string }>;
  onWalkIn: (input: {
    ownerName: string;
    phone: string;
    petName: string;
    species: string;
    branchId: string;
  }) => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("canine");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!branchId && branches[0]?.id) setBranchId(branches[0].id);
  }, [branches, branchId]);

  async function submit() {
    if (!ownerName.trim() || !phone.trim() || !petName.trim()) {
      Alert.alert("Missing details", "Owner name, phone, and pet name are required.");
      return;
    }
    if (!branchId) {
      Alert.alert("Branch required", "Select a branch for this walk-in.");
      return;
    }
    setSaving(true);
    try {
      await onWalkIn({
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        petName: petName.trim(),
        species,
        branchId,
      });
      setOwnerName("");
      setPhone("");
      setPetName("");
      setSpecies("canine");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <View style={commonStyles.card}>
        <View style={styles.hero}>
          <MaterialIcons name="person-add-alt-1" size={32} color={theme.primary} />
          <Text style={commonStyles.cardTitle}>Walk-in appointment</Text>
        </View>
        <Text style={[commonStyles.muted, { marginBottom: 16 }]}>
          Register a guest at the desk and queue a consultation. No portal account is created for the owner.
        </Text>

        <Text style={commonStyles.sectionLabel}>Owner name</Text>
        <TextInput
          style={commonStyles.input}
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="Guest full name"
          placeholderTextColor={theme.outline}
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Phone</Text>
        <TextInput
          style={commonStyles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+91…"
          placeholderTextColor={theme.outline}
          keyboardType="phone-pad"
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Pet name</Text>
        <TextInput
          style={commonStyles.input}
          value={petName}
          onChangeText={setPetName}
          placeholder="Patient name"
          placeholderTextColor={theme.outline}
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Species</Text>
        <View style={styles.chipRow}>
          {PET_SPECIES_BOOKING_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.chip, species === opt.value && styles.chipOn]}
              onPress={() => setSpecies(opt.value)}
            >
              <Text style={[styles.chipText, species === opt.value && styles.chipTextOn]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Branch</Text>
        <View style={styles.chipRow}>
          {branches.map((b) => (
            <Pressable
              key={b.id}
              style={[styles.chip, branchId === b.id && styles.chipOn]}
              onPress={() => setBranchId(b.id)}
            >
              <Text style={[styles.chipText, branchId === b.id && styles.chipTextOn]}>{b.name}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => void submit()} disabled={saving} style={{ marginTop: 20, opacity: saving ? 0.7 : 1 }}>
          <LinearGradient colors={[theme.gradientStart, theme.gradientEnd]} style={styles.cta}>
            <Text style={styles.ctaText}>{saving ? "Saving…" : "Create walk-in appointment"}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceContainer,
  },
  chipOn: { borderColor: theme.primary, backgroundColor: `${theme.primary}18` },
  chipText: { fontSize: 12, fontWeight: "600", color: theme.onSurface },
  chipTextOn: { color: theme.primary, fontWeight: "800" },
  cta: { borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  ctaText: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
});
