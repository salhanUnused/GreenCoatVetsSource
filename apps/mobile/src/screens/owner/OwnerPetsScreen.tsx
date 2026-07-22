import { useState } from "react";
import {
  DEFAULT_PET_SPECIES_BOOKING_VALUE,
  formatClinicDateTime,
  formatSpeciesLabel,
  normalizeLegacySpeciesToCanonical,
  PET_SPECIES_BOOKING_OPTIONS,
  visitReportPdfSourceLabel,
} from "@saasclinics/lib";
import * as ImagePicker from "expo-image-picker";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { commonStyles } from "../../theme/commonStyles";
import { theme } from "../../theme/theme";
import {
  formatPetAgeGenderSubtitle,
  monthsToAgeYearsInput,
  parseAgeYearsToMonths,
  PET_GENDER_OPTIONS,
  type PetGenderValue,
} from "../../lib/petDemographics";
import { Pet, OwnerPrescription, VisitSummary } from "../../types/app";
import { PetAvatar } from "../../components/PetAvatar";
import { OwnerNeonCard } from "../../components/OwnerNeonCard";

export function OwnerPetsScreen({
  pets,
  visitsByPet,
  prescriptionsByVisit,
  clinicTimezone,
  refreshing,
  onRefresh,
  onAddPet,
  onUpdatePet,
  onUploadPetPhoto,
  onOpenVisitReport,
  onDownloadVisitReport,
  onOpenPrescriptionPdf,
}: {
  pets: Pet[];
  visitsByPet: Record<string, VisitSummary[]>;
  prescriptionsByVisit: Record<string, OwnerPrescription[]>;
  clinicTimezone?: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onAddPet: (input: {
    name: string;
    species: string;
    breed?: string;
    allergies?: string;
    gender?: string | null;
    ageMonths?: number | null;
  }) => Promise<void>;
  onUpdatePet: (
    petId: string,
    patch: Partial<Pick<Pet, "name" | "species" | "breed" | "gender" | "age_months" | "allergies">>,
  ) => Promise<void>;
  onUploadPetPhoto: (petId: string, uri: string, mimeType?: string, base64?: string | null) => Promise<void>;
  onOpenVisitReport?: (visitId: string) => Promise<void>;
  onDownloadVisitReport?: (visitId: string) => Promise<void>;
  onOpenPrescriptionPdf?: (prescriptionId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState(DEFAULT_PET_SPECIES_BOOKING_VALUE);
  const [breed, setBreed] = useState("");
  const [gender, setGender] = useState<PetGenderValue>("unknown");
  const [ageYears, setAgeYears] = useState("");
  const [allergies, setAllergies] = useState("");

  const [editName, setEditName] = useState("");
  const [editSpecies, setEditSpecies] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editGender, setEditGender] = useState<PetGenderValue>("unknown");
  const [editAgeYears, setEditAgeYears] = useState("");
  const [editAllergies, setEditAllergies] = useState("");

  function openEdit(p: Pet) {
    setExpanded(p.id);
    setEditName(p.name);
    setEditSpecies(normalizeLegacySpeciesToCanonical(p.species));
    setEditBreed(p.breed ?? "");
    const g = p.gender?.trim();
    setEditGender(g === "male" || g === "female" || g === "unknown" ? g : "unknown");
    setEditAgeYears(monthsToAgeYearsInput(p.age_months));
    setEditAllergies(p.allergies ?? "");
  }

  async function pickPetPhoto(petId: string, fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow camera or photo library access to upload pet photos.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, base64: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await onUploadPetPhoto(petId, asset.uri, asset.mimeType ?? "image/jpeg", asset.base64 ?? null);
  }

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Pet profiles</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>Medical history timeline, vaccines, and prescriptions are linked per pet.</Text>
        {pets.map((pet) => {
          const visits = visitsByPet[pet.id] ?? [];
          const isOpen = expanded === pet.id;
          return (
            <View key={pet.id} style={styles.petBlock}>
              <Pressable style={styles.petHeader} onPress={() => (isOpen ? setExpanded(null) : openEdit(pet))}>
                <PetAvatar uri={pet.photo_url} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  <Text style={commonStyles.muted}>
                    {formatSpeciesLabel(pet.species)}
                    {pet.breed ? ` · ${pet.breed}` : ""}
                    {formatPetAgeGenderSubtitle(pet) ? ` · ${formatPetAgeGenderSubtitle(pet)}` : ""}
                  </Text>
                </View>
                <MaterialIcons name={isOpen ? "expand-less" : "expand-more"} size={24} color={theme.outline} />
              </Pressable>
              {isOpen ? (
                <View style={styles.detail}>
                  <Text style={commonStyles.sectionLabel}>Photo</Text>
                  <View style={commonStyles.actionRow}>
                    <Pressable style={commonStyles.btnOutline} onPress={() => void pickPetPhoto(pet.id, true)}>
                      <Text style={commonStyles.btnOutlineText}>Camera</Text>
                    </Pressable>
                    <Pressable style={commonStyles.btnOutline} onPress={() => void pickPetPhoto(pet.id, false)}>
                      <Text style={commonStyles.btnOutlineText}>Gallery</Text>
                    </Pressable>
                  </View>
                  <Text style={commonStyles.sectionLabel}>Edit</Text>
                  <TextInput style={commonStyles.input} value={editName} onChangeText={setEditName} placeholder="Name" placeholderTextColor={theme.outline} />
                  <Text style={[commonStyles.sectionLabel, { marginTop: 8 }]}>Species</Text>
                  <View style={styles.speciesChipWrap}>
                    {PET_SPECIES_BOOKING_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={[styles.speciesChip, editSpecies === opt.value && styles.speciesChipOn]}
                        onPress={() => setEditSpecies(opt.value)}
                      >
                        <Text style={[styles.speciesChipText, editSpecies === opt.value && styles.speciesChipTextOn]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput style={[commonStyles.input, { marginTop: 8 }]} value={editBreed} onChangeText={setEditBreed} placeholder="Breed (optional)" placeholderTextColor={theme.outline} />
                  <Text style={[commonStyles.sectionLabel, { marginTop: 8 }]}>Sex</Text>
                  <View style={styles.speciesChipWrap}>
                    {PET_GENDER_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={[styles.speciesChip, editGender === opt.value && styles.speciesChipOn]}
                        onPress={() => setEditGender(opt.value)}
                      >
                        <Text style={[styles.speciesChipText, editGender === opt.value && styles.speciesChipTextOn]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={[commonStyles.sectionLabel, { marginTop: 8 }]}>Approx. age (years)</Text>
                  <TextInput
                    style={commonStyles.input}
                    value={editAgeYears}
                    onChangeText={setEditAgeYears}
                    placeholder="e.g. 2 or 0.5 (optional)"
                    placeholderTextColor={theme.outline}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[commonStyles.input, { marginTop: 8, minHeight: 64, textAlignVertical: "top" }]}
                    value={editAllergies}
                    onChangeText={setEditAllergies}
                    placeholder="Allergies / alerts"
                    placeholderTextColor={theme.outline}
                    multiline
                  />
                  <Pressable
                    style={[commonStyles.btnPrimary, { marginTop: 10 }]}
                    onPress={() =>
                      void onUpdatePet(pet.id, {
                        name: editName.trim(),
                        species: (editSpecies.trim() || DEFAULT_PET_SPECIES_BOOKING_VALUE).trim(),
                        breed: editBreed.trim() || null,
                        gender: editGender,
                        age_months: parseAgeYearsToMonths(editAgeYears),
                        allergies: editAllergies.trim() || null,
                      })
                    }
                  >
                    <Text style={commonStyles.btnPrimaryText}>Save pet</Text>
                  </Pressable>

                  <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Medical history</Text>
                  {visits.length ? (
                    visits.map((v) => {
                      const rxForVisit = prescriptionsByVisit[v.id] ?? [];
                      const pdfLabel = visitReportPdfSourceLabel(v.visit_report_pdf_source);
                      const hasPdf = Boolean(v.visit_report_pdf_path?.trim());
                      return (
                        <View key={v.id} style={styles.timelineRow}>
                          <Text style={styles.tlDate}>
                            {v.started_at ? formatClinicDateTime(v.started_at, clinicTimezone) : "—"}
                          </Text>
                          <Text style={styles.tlDiagnosis}>{v.diagnosis?.trim() || "Visit"}</Text>
                          {v.symptoms?.trim() ? (
                            <Text style={commonStyles.muted}>Symptoms: {v.symptoms.trim()}</Text>
                          ) : null}
                          {v.treatment_plan?.trim() ? (
                            <Text style={commonStyles.muted}>Plan: {v.treatment_plan.trim()}</Text>
                          ) : null}
                          {rxForVisit.length ? (
                            <View style={styles.rxMini}>
                              {rxForVisit.map((rx) => (
                                <View key={rx.id} style={styles.rxMiniRow}>
                                  <Text style={commonStyles.muted}>
                                    Rx · {formatClinicDateTime(rx.issued_at, clinicTimezone)}
                                  </Text>
                                  {onOpenPrescriptionPdf && rx.pdf_url?.trim() ? (
                                    <Pressable style={styles.miniBtn} onPress={() => void onOpenPrescriptionPdf(rx.id)}>
                                      <Text style={styles.miniBtnText}>Rx PDF</Text>
                                    </Pressable>
                                  ) : null}
                                </View>
                              ))}
                            </View>
                          ) : null}
                          {hasPdf && onOpenVisitReport ? (
                            <View style={styles.pdfRow}>
                              <Pressable style={styles.miniBtnPrimary} onPress={() => void onOpenVisitReport(v.id)}>
                                <Text style={styles.miniBtnPrimaryText}>Open {pdfLabel}</Text>
                              </Pressable>
                              {onDownloadVisitReport ? (
                                <Pressable style={styles.miniBtn} onPress={() => void onDownloadVisitReport(v.id)}>
                                  <Text style={styles.miniBtnText}>Download</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={commonStyles.emptyState}>No visits recorded yet.</Text>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
        {!pets.length ? <Text style={commonStyles.emptyState}>No pets yet — add your first pet below.</Text> : null}
      </OwnerNeonCard>

      <OwnerNeonCard>
        <Pressable style={styles.addHeader} onPress={() => setAdding((a) => !a)}>
          <Text style={commonStyles.cardTitle}>Add pet</Text>
          <MaterialIcons name={adding ? "expand-less" : "add-circle-outline"} size={26} color={theme.primary} />
        </Pressable>
        {adding ? (
          <>
            <TextInput style={commonStyles.input} value={name} onChangeText={setName} placeholder="Pet name" placeholderTextColor={theme.outline} />
            <Text style={[commonStyles.sectionLabel, { marginTop: 8 }]}>Species</Text>
            <View style={styles.speciesChipWrap}>
              {PET_SPECIES_BOOKING_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.speciesChip, species === opt.value && styles.speciesChipOn]}
                  onPress={() => setSpecies(opt.value)}
                >
                  <Text style={[styles.speciesChipText, species === opt.value && styles.speciesChipTextOn]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={[commonStyles.input, { marginTop: 8 }]} value={breed} onChangeText={setBreed} placeholder="Breed (optional)" placeholderTextColor={theme.outline} />
            <Text style={[commonStyles.sectionLabel, { marginTop: 8 }]}>Sex</Text>
            <View style={styles.speciesChipWrap}>
              {PET_GENDER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.speciesChip, gender === opt.value && styles.speciesChipOn]}
                  onPress={() => setGender(opt.value)}
                >
                  <Text style={[styles.speciesChipText, gender === opt.value && styles.speciesChipTextOn]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[commonStyles.sectionLabel, { marginTop: 8 }]}>Approx. age (years)</Text>
            <TextInput
              style={commonStyles.input}
              value={ageYears}
              onChangeText={setAgeYears}
              placeholder="e.g. 2 or 0.5 (optional)"
              placeholderTextColor={theme.outline}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[commonStyles.input, { marginTop: 8, minHeight: 56, textAlignVertical: "top" }]}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="Known allergies"
              placeholderTextColor={theme.outline}
              multiline
            />
            <Pressable
              style={[commonStyles.btnPrimary, { marginTop: 12 }]}
              onPress={() =>
                void onAddPet({
                  name: name.trim(),
                  species: species.trim() || DEFAULT_PET_SPECIES_BOOKING_VALUE,
                  breed: breed.trim() || undefined,
                  gender,
                  ageMonths: parseAgeYearsToMonths(ageYears),
                  allergies: allergies.trim() || undefined,
                }).then(() => {
                  setName("");
                  setSpecies(DEFAULT_PET_SPECIES_BOOKING_VALUE);
                  setBreed("");
                  setGender("unknown");
                  setAgeYears("");
                  setAllergies("");
                  setAdding(false);
                })
              }
            >
              <Text style={commonStyles.btnPrimaryText}>Create pet profile</Text>
            </Pressable>
          </>
        ) : (
          <Text style={commonStyles.muted}>Tap to register a new pet at this clinic.</Text>
        )}
      </OwnerNeonCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  petBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
    paddingBottom: 12,
    marginBottom: 12,
  },
  petHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  petName: { fontWeight: "800", fontSize: 16, color: theme.onSurface },
  detail: { marginTop: 12 },
  timelineRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant, gap: 4 },
  tlDate: { fontWeight: "700", color: theme.onSurface, marginBottom: 2 },
  tlDiagnosis: { fontWeight: "600", color: theme.onSurface },
  pdfRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  rxMini: { marginTop: 4, gap: 4 },
  rxMiniRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  miniBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.surfaceContainer,
  },
  miniBtnText: { fontSize: 11, fontWeight: "700", color: theme.onSurface },
  miniBtnPrimary: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.primary,
  },
  miniBtnPrimaryText: { fontSize: 11, fontWeight: "800", color: theme.onPrimary },
  addHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  speciesChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  speciesChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.surfaceContainer,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
  },
  speciesChipOn: { borderColor: theme.primary, backgroundColor: `${theme.primary}18` },
  speciesChipText: { fontSize: 11, fontWeight: "600", color: theme.onSurface },
  speciesChipTextOn: { color: theme.primary, fontWeight: "800" },
});
