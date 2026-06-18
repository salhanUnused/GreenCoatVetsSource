import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { PET_SPECIES_BOOKING_OPTIONS } from "@saasclinics/lib";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { loadAppBranding, type AppBranding } from "../lib/app-branding";
import {
  completeOwnerProfileWithPet,
  getPetOwnerProfileStatus,
  loadOwnerProfilePrefill,
  syncWebsiteAccountForMobile,
} from "../lib/owner-profile";
import { PET_GENDER_OPTIONS } from "../lib/petDemographics";
import { theme } from "../theme/theme";
import { PawCircularLoader } from "../components/PawCircularLoader";

export function CompleteProfileScreen({ onComplete }: { onComplete: () => void }) {
  const [branding, setBranding] = useState<AppBranding | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("canine");
  const [breed, setBreed] = useState("");
  const [gender, setGender] = useState("");
  const [hasExistingPets, setHasExistingPets] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        await syncWebsiteAccountForMobile(supabase, user);
        const status = await getPetOwnerProfileStatus(supabase, user.id, user.email);
        if (!status.needsCompletion) {
          onComplete();
          return;
        }

        const prefill = await loadOwnerProfilePrefill(supabase, user);
        if (!cancelled) {
          setFullName(prefill.fullName);
          setPhone(prefill.phone);
          setHasExistingPets(prefill.hasPets);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("profile bootstrap", e instanceof Error ? e.message : e);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    loadAppBranding().then((b) => {
      if (!cancelled) setBranding(b);
    });

    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired. Sign in again.");

      await completeOwnerProfileWithPet(supabase, user, {
        fullName,
        phone,
        petName: hasExistingPets ? "Existing pet" : petName,
        species,
        breed: breed || undefined,
        gender: gender || null,
      });
      onComplete();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save profile.";
      setError(message);
      Alert.alert("Profile incomplete", message);
    }
    setLoading(false);
  }

  if (bootstrapping) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.bootWrap}>
          <PawCircularLoader size={72} message="Loading your account…" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            {branding?.logo_url ? (
              <Image source={{ uri: branding.logo_url }} style={styles.logo} resizeMode="contain" />
            ) : (
              <MaterialIcons name="pets" size={40} color={theme.primary} />
            )}
            <Text style={styles.title}>{hasExistingPets ? "Confirm your profile" : "Finish your profile"}</Text>
            <Text style={styles.subtitle}>
              {hasExistingPets
                ? "We found your website account. Confirm your details to open the app — no new account is created."
                : `Add your contact details and first pet so your account is linked to ${branding?.product_name ?? "GreenCoatVets"}.`}
            </Text>
          </View>

          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={theme.outline} />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+91…"
            placeholderTextColor={theme.outline}
            keyboardType="phone-pad"
          />

          {!hasExistingPets ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>First pet</Text>
              <Text style={styles.label}>Pet name</Text>
              <TextInput style={styles.input} value={petName} onChangeText={setPetName} placeholder="e.g. Luna" placeholderTextColor={theme.outline} />

              <Text style={styles.label}>Species</Text>
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

              <Text style={styles.label}>Breed (optional)</Text>
              <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="Optional" placeholderTextColor={theme.outline} />

              <Text style={styles.label}>Gender (optional)</Text>
              <View style={styles.chipRow}>
                {PET_GENDER_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.chip, gender === opt.value && styles.chipOn]}
                    onPress={() => setGender(opt.value)}
                  >
                    <Text style={[styles.chipText, gender === opt.value && styles.chipTextOn]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.existingPetsNote}>Your pets from the website are already on this account.</Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={() => void onSubmit()} disabled={loading} style={{ marginTop: 20 }}>
            <LinearGradient colors={[theme.gradientStart, theme.gradientEnd]} style={styles.cta}>
              {loading ? <PawCircularLoader size={32} /> : <Text style={styles.ctaText}>{hasExistingPets ? "Continue" : "Save and continue"}</Text>}
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.signOut} onPress={() => void supabase.auth.signOut()}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.surface },
  flex: { flex: 1 },
  bootWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 20, paddingBottom: 40 },
  brandRow: { alignItems: "center", marginBottom: 24 },
  logo: { width: 64, height: 64, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "800", color: theme.onSurface, textAlign: "center" },
  subtitle: { marginTop: 8, fontSize: 14, color: theme.onSurfaceVariant, textAlign: "center", lineHeight: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: theme.onSurface },
  existingPetsNote: {
    marginTop: 16,
    fontSize: 14,
    color: theme.primary,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    color: theme.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceBright,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.onSurface,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
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
  error: { marginTop: 12, color: theme.error, fontWeight: "600" },
  cta: { borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  ctaText: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
  signOut: { marginTop: 20, alignItems: "center", padding: 12 },
  signOutText: { color: theme.primary, fontWeight: "700" },
});
