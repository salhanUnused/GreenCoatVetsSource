import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialIcons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { isDoctorRole } from "../lib/membership";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

type StaffRole = "doctor" | "senior_doctor" | "lab_technician" | "pharmacist";

const ROLE_LABEL: Record<StaffRole, string> = {
  doctor: "Veterinarian",
  senior_doctor: "Senior veterinarian",
  lab_technician: "Laboratory",
  pharmacist: "Pharmacy",
};

type StaffProfileRow = {
  id: string;
  role: StaffRole;
  full_name: string | null;
  phone: string | null;
  specialization: string | null;
  experience_years: number | null;
  bio: string | null;
  photo_url: string | null;
};

async function loadOrCreateStaffProfile(clinicId: string, staffRoleHint: StaffRole): Promise<StaffProfileRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("user_clinic_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("clinic_id", clinicId)
    .eq("is_active", true);

  const membershipRole =
    (memberships ?? []).find((m) => (m.role as string) === staffRoleHint)?.role ??
    (memberships ?? []).find((m) => isDoctorRole(m.role as string) && isDoctorRole(staffRoleHint))?.role ??
    (memberships ?? []).find((m) => ["doctor", "senior_doctor", "lab_technician", "pharmacist"].includes(m.role as string))
      ?.role;

  let query = supabase
    .from("staff_profiles")
    .select("id, role, full_name, phone, specialization, experience_years, bio, photo_url")
    .eq("clinic_id", clinicId)
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (isDoctorRole(staffRoleHint)) {
    query = query.in("role", ["doctor", "senior_doctor"]);
  } else {
    query = query.eq("role", staffRoleHint);
  }

  const { data: rows, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const existing = ((rows as StaffProfileRow[] | null) ?? [])[0];
  if (existing) return existing;

  const roleToCreate = (membershipRole as StaffRole | undefined) ?? staffRoleHint;
  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  const fullName = meta?.full_name?.trim() || meta?.name?.trim() || "Staff member";

  const { data: created, error: createErr } = await supabase
    .from("staff_profiles")
    .insert({
      clinic_id: clinicId,
      user_id: user.id,
      role: roleToCreate,
      full_name: fullName,
      phone: meta?.phone?.trim() || null,
      is_active: true,
    })
    .select("id, role, full_name, phone, specialization, experience_years, bio, photo_url")
    .single();

  if (createErr) throw new Error(createErr.message);
  return created as StaffProfileRow;
}

export function StaffProfileScreen({
  clinicId,
  staffRole,
  onSaved,
}: {
  clinicId: string;
  staffRole: StaffRole;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [staffProfileId, setStaffProfileId] = useState<string | null>(null);
  const [resolvedRole, setResolvedRole] = useState<StaffRole>(staffRole);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const data = await loadOrCreateStaffProfile(clinicId, staffRole);
        if (!data) {
          setLoading(false);
          setRefreshing(false);
          return;
        }
        setStaffProfileId(data.id);
        setResolvedRole(data.role);
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setSpecialization(data.specialization ?? "");
        setExperienceYears(data.experience_years != null ? String(data.experience_years) : "");
        setBio(data.bio ?? "");
        setPhotoUrl(data.photo_url ?? null);
      } catch (e) {
        Alert.alert("Could not load profile", e instanceof Error ? e.message : "Unknown error");
      }
      setLoading(false);
      setRefreshing(false);
    },
    [clinicId, staffRole],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load({ silent: true });
  }

  async function pickPhoto(fromCamera: boolean) {
    if (!staffProfileId) {
      Alert.alert("Wait", "Profile is still loading.");
      return;
    }
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow camera or photo library to set your profile photo.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
    const path = `${clinicId}/staff/${staffProfileId}/avatar.${ext}`;
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: upErr } = await supabase.storage.from("clinic-assets").upload(path, blob, {
        contentType: asset.mimeType ?? "image/jpeg",
        upsert: true,
      });
      if (upErr) {
        Alert.alert("Upload failed", upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from("clinic-assets").getPublicUrl(path);
      setPhotoUrl(pub.publicUrl);
      Alert.alert("Photo updated", "Save profile to publish this photo on the clinic website.");
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function save() {
    if (!fullName.trim()) {
      Alert.alert("Name required", "Enter your display name.");
      return;
    }
    let exp: number | null = null;
    if (experienceYears.trim()) {
      const n = Number.parseInt(experienceYears.trim(), 10);
      if (Number.isNaN(n) || n < 0) {
        Alert.alert("Experience", "Enter years as a number, or leave blank.");
        return;
      }
      exp = n;
    }
    setSaving(true);
    const { error } = await supabase.rpc("update_my_staff_profile", {
      p_full_name: fullName.trim(),
      p_phone: phone.trim() || null,
      p_specialization: specialization.trim() || null,
      p_experience_years: exp,
      p_bio: bio.trim() || null,
      p_photo_url: photoUrl?.trim() || null,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Could not save", error.message);
      return;
    }
    Alert.alert("Saved", "Your profile will appear on the clinic website where enabled.");
    onSaved?.();
    await load({ silent: true });
  }

  if (loading) {
    return (
      <View style={[commonStyles.screen, styles.center]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[commonStyles.muted, { marginTop: 12 }]}>Loading your profile…</Text>
      </View>
    );
  }

  if (!staffProfileId) {
    return (
      <View style={[commonStyles.screen, styles.center]}>
        <Text style={commonStyles.emptyState}>Could not set up your staff profile. Pull to refresh or contact your admin.</Text>
        <Pressable style={[commonStyles.btnPrimary, { marginTop: 16 }]} onPress={() => void onRefresh()}>
          <Text style={commonStyles.btnPrimaryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Your public profile</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>
          {ROLE_LABEL[resolvedRole]} · This information can be shown on the clinic website (team / doctors pages).
        </Text>

        <View style={styles.photoRow}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <MaterialIcons name="person" size={48} color={theme.outline} />
            </View>
          )}
          <View style={{ flex: 1, gap: 8 }}>
            <Pressable style={commonStyles.btnOutline} onPress={() => void pickPhoto(false)}>
              <Text style={commonStyles.btnOutlineText}>Choose from library</Text>
            </Pressable>
            <Pressable style={commonStyles.btnOutline} onPress={() => void pickPhoto(true)}>
              <Text style={commonStyles.btnOutlineText}>Take photo</Text>
            </Pressable>
            {photoUrl ? (
              <Pressable
                onPress={() =>
                  Alert.alert("Remove photo?", "", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => setPhotoUrl(null) },
                  ])
                }
              >
                <Text style={styles.removeLink}>Remove photo</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={commonStyles.sectionLabel}>Display name</Text>
        <TextInput
          style={commonStyles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
          placeholderTextColor={theme.outline}
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Phone (internal)</Text>
        <TextInput
          style={commonStyles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Optional"
          placeholderTextColor={theme.outline}
          keyboardType="phone-pad"
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>
          {isDoctorRole(resolvedRole) ? "Specialization" : "Title / focus"}
        </Text>
        <TextInput
          style={commonStyles.input}
          value={specialization}
          onChangeText={setSpecialization}
          placeholder={isDoctorRole(resolvedRole) ? "e.g. Small animal surgery" : "e.g. Clinical pathology"}
          placeholderTextColor={theme.outline}
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Years of experience</Text>
        <TextInput
          style={commonStyles.input}
          value={experienceYears}
          onChangeText={setExperienceYears}
          placeholder="Optional"
          placeholderTextColor={theme.outline}
          keyboardType="number-pad"
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Bio (website)</Text>
        <TextInput
          style={[commonStyles.input, styles.bio]}
          value={bio}
          onChangeText={setBio}
          placeholder="Short bio for patients and visitors"
          placeholderTextColor={theme.outline}
          multiline
          textAlignVertical="top"
        />

        <Pressable
          style={[commonStyles.btnPrimary, saving && { opacity: 0.7 }]}
          disabled={saving}
          onPress={() => void save()}
        >
          {saving ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Text style={commonStyles.btnPrimaryText}>Save profile</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center", alignItems: "center", flex: 1, padding: 24 },
  photoRow: { flexDirection: "row", gap: 14, marginBottom: 16, alignItems: "flex-start" },
  photo: { width: 112, height: 112, borderRadius: 56, backgroundColor: theme.surfaceContainer },
  photoPlaceholder: { justifyContent: "center", alignItems: "center" },
  bio: { minHeight: 100 },
  removeLink: { color: theme.error, fontWeight: "600", fontSize: 13 },
});
