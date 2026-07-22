import { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { PET_SPECIES_BOOKING_OPTIONS } from "@saasclinics/lib";
import { SignaturePad } from "../components/SignaturePad";
import { APPOINTMENT_BOOKING_CONSENT_TEXT } from "../lib/appointmentConsent";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

export type WalkInInput = {
  ownerName: string;
  phone: string;
  email: string;
  petName: string;
  species: string;
  breed: string;
  ageMonths: string;
  weightKg: string;
  branchId: string;
  notes: string;
  createAppointment: boolean;
  bookingConsent: boolean;
  consentSignaturePng: string | null;
};

export function WalkInScreen({
  branches,
  onWalkIn,
  refreshing,
  onRefresh,
}: {
  branches: Array<{ id: string; name: string }>;
  onWalkIn: (input: WalkInInput) => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("canine");
  const [breed, setBreed] = useState("");
  const [ageMonths, setAgeMonths] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [notes, setNotes] = useState("");
  const [createAppointment, setCreateAppointment] = useState(true);
  const [bookingConsent, setBookingConsent] = useState(false);
  const [consentSignaturePng, setConsentSignaturePng] = useState<string | null>(null);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!branchId && branches[0]?.id) setBranchId(branches[0].id);
  }, [branches, branchId]);

  function resetForm() {
    setOwnerName("");
    setPhone("");
    setEmail("");
    setPetName("");
    setSpecies("canine");
    setBreed("");
    setAgeMonths("");
    setWeightKg("");
    setNotes("");
    setCreateAppointment(true);
    setBookingConsent(false);
    setConsentSignaturePng(null);
  }

  async function submit() {
    if (!phone.trim() || !petName.trim()) {
      Alert.alert("Missing details", "Phone and pet name are required.");
      return;
    }
    if (createAppointment && !branchId) {
      Alert.alert("Branch required", "Select a branch for the appointment.");
      return;
    }
    if (!bookingConsent) {
      Alert.alert("Consent required", "Owner must accept the consent statement.");
      return;
    }
    if (!consentSignaturePng?.startsWith("data:image/png")) {
      Alert.alert("Signature required", "Capture the owner signature before saving.");
      return;
    }
    setSaving(true);
    try {
      await onWalkIn({
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        petName: petName.trim(),
        species,
        breed: breed.trim(),
        ageMonths: ageMonths.trim(),
        weightKg: weightKg.trim(),
        branchId,
        notes: notes.trim(),
        createAppointment,
        bookingConsent: true,
        consentSignaturePng,
      });
      resetForm();
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
      keyboardShouldPersistTaps="handled"
    >
      <View style={commonStyles.card}>
        <View style={styles.hero}>
          <MaterialIcons name="person-add-alt-1" size={28} color={theme.primary} />
          <Text style={commonStyles.cardTitle}>Walk-in guest</Text>
        </View>

        <Text style={commonStyles.sectionLabel}>Owner name</Text>
        <TextInput
          style={commonStyles.input}
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="First Last (optional)"
          placeholderTextColor={theme.outline}
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Phone *</Text>
        <TextInput
          style={commonStyles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+91…"
          placeholderTextColor={theme.outline}
          keyboardType="phone-pad"
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Email</Text>
        <TextInput
          style={commonStyles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="owner@email.com"
          placeholderTextColor={theme.outline}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Patient name *</Text>
        <TextInput
          style={commonStyles.input}
          value={petName}
          onChangeText={setPetName}
          placeholder="Pet name"
          placeholderTextColor={theme.outline}
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Species *</Text>
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

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Breed</Text>
        <TextInput
          style={commonStyles.input}
          value={breed}
          onChangeText={setBreed}
          placeholder="Breed (optional)"
          placeholderTextColor={theme.outline}
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Age (months)</Text>
        <TextInput
          style={commonStyles.input}
          value={ageMonths}
          onChangeText={setAgeMonths}
          placeholder="e.g. 18"
          placeholderTextColor={theme.outline}
          keyboardType="number-pad"
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Weight (kg)</Text>
        <TextInput
          style={commonStyles.input}
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="e.g. 12.5"
          placeholderTextColor={theme.outline}
          keyboardType="decimal-pad"
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Primary branch</Text>
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

        <Pressable style={styles.checkRow} onPress={() => setCreateAppointment((v) => !v)}>
          <MaterialIcons
            name={createAppointment ? "check-box" : "check-box-outline-blank"}
            size={22}
            color={theme.primary}
          />
          <Text style={styles.checkLabel}>Also create a same-day appointment</Text>
        </Pressable>

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Desk notes</Text>
        <TextInput
          style={[commonStyles.input, styles.notes]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          placeholderTextColor={theme.outline}
          multiline
        />

        <Pressable style={styles.checkRow} onPress={() => setBookingConsent((v) => !v)}>
          <MaterialIcons
            name={bookingConsent ? "check-box" : "check-box-outline-blank"}
            size={22}
            color={theme.primary}
          />
          <Text style={styles.checkLabel}>{APPOINTMENT_BOOKING_CONSENT_TEXT}</Text>
        </Pressable>

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Owner signature</Text>
        <SignaturePad onChange={setConsentSignaturePng} />
        {consentSignaturePng ? <Text style={[commonStyles.muted, { marginTop: 4 }]}>Signature captured.</Text> : null}

        <Pressable
          onPress={() => void submit()}
          disabled={saving}
          style={[commonStyles.btnPrimary, { marginTop: 20, opacity: saving ? 0.7 : 1 }]}
        >
          <Text style={commonStyles.btnPrimaryText}>{saving ? "Saving…" : "Save walk-in"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
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
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  checkLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: theme.onSurface },
  notes: { minHeight: 72, textAlignVertical: "top" },
});
