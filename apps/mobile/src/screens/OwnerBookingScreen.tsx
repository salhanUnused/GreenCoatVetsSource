import { useEffect, useMemo, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import { DEFAULT_PET_SPECIES_BOOKING_VALUE, formatClinicDateTime, PET_SPECIES_BOOKING_OPTIONS } from "@saasclinics/lib";
import { Appointment } from "../types/app";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";
import { PetAvatar } from "../components/PetAvatar";
import { OwnerNeonCard } from "../components/OwnerNeonCard";
import { BookingDoctorSlotPicker, type BookingDoctor } from "../components/BookingDoctorSlotPicker";
import { SignaturePad } from "../components/SignaturePad";
import { handleDateTimePickerChange } from "../lib/dateTimePickerBridge";
import {
  APPOINTMENT_BOOKING_CONSENT_TEXT,
} from "../lib/appointmentConsent";
import {
  monthsToAgeYearsInput,
  normalizeBookingPetGender,
  parseBookingAgeYearsToMonths,
  PET_GENDER_OPTIONS,
  type PetGenderValue,
} from "../lib/petDemographics";

const APPOINTMENT_TYPES = [
  ["consultation", "Consult"],
  ["vaccination", "Vaccine"],
  ["surgery", "Surgery"],
  ["grooming", "Grooming"],
  ["emergency", "Emergency"],
] as const;

export function OwnerBookingScreen({
  clinicId,
  petOptions,
  branchOptions,
  bookingDoctors,
  appointments,
  ownerFullName,
  ownerNeedsName,
  ownerPhone,
  ownerEmail,
  clinicTimezone,
  onCreate,
  onCancelAppointment,
  onRequestTimeChange,
  timeChangeRequests,
  onOpenConsentPdf,
  onDownloadConsentPdf,
}: {
  clinicId: string;
  petOptions: Array<{
    id: string;
    name: string;
    photo_url?: string | null;
    gender?: string | null;
    age_months?: number | null;
  }>;
  branchOptions: Array<{ id: string; name: string }>;
  bookingDoctors: BookingDoctor[];
  appointments: Appointment[];
  ownerFullName?: string | null;
  ownerNeedsName?: boolean;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  clinicTimezone?: string | null;
  onCreate: (input: {
    petId?: string;
    branchId: string;
    appointmentType: string;
    doctorId?: string | null;
    startsAt: string;
    notes: string;
    chiefComplaint?: string;
    allergies?: string;
    currentMedications?: string;
    contactFullName: string;
    contactPhone: string;
    contactEmail?: string;
    petGender?: string | null;
    petAgeYears?: string;
    bookingConsent: boolean;
    consentSignaturePng?: string | null;
    newPetName?: string;
    newPetSpecies?: string;
    newPetBreed?: string;
    newPetGender?: string | null;
    newPetAgeMonths?: number | null;
  }) => Promise<void>;
  onCancelAppointment: (appointmentId: string) => Promise<void>;
  onRequestTimeChange: (appointmentId: string, startsAtIso: string, notes?: string) => Promise<void>;
  timeChangeRequests: Array<{ appointment_id: string; requested_starts_at: string; status: string }>;
  onOpenConsentPdf?: (appointmentId: string) => Promise<void>;
  onDownloadConsentPdf?: (appointmentId: string) => Promise<void>;
}) {
  const hasPets = petOptions.length > 0;
  const hasBookingDoctors = bookingDoctors.length > 0;
  const [petId, setPetId] = useState(() => (hasPets ? petOptions[0]?.id ?? "" : ""));
  const [branchId, setBranchId] = useState("");
  const [appointmentType, setAppointmentType] = useState("consultation");
  const [doctorId, setDoctorId] = useState("");
  const [startsAt, setStartsAt] = useState(new Date());
  const [slotStartsAt, setSlotStartsAt] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [notes, setNotes] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [allergies, setAllergies] = useState("");
  const [currentMedications, setCurrentMedications] = useState("");

  const [contactFullName, setContactFullName] = useState(ownerFullName ?? "");
  const [contactPhone, setContactPhone] = useState(ownerPhone ?? "");
  const [contactEmail, setContactEmail] = useState(ownerEmail ?? "");
  const [bookingConsent, setBookingConsent] = useState(false);
  const [consentSignaturePng, setConsentSignaturePng] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const [petGender, setPetGender] = useState<PetGenderValue | "">("");
  const [petAgeYears, setPetAgeYears] = useState("");

  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState(DEFAULT_PET_SPECIES_BOOKING_VALUE);
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newPetGender, setNewPetGender] = useState<PetGenderValue | "">("");
  const [newPetAgeYears, setNewPetAgeYears] = useState("");

  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState(new Date());
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [rescheduleNotes, setRescheduleNotes] = useState("");

  useEffect(() => {
    setContactPhone(ownerPhone ?? "");
    setContactEmail(ownerEmail ?? "");
  }, [ownerPhone, ownerEmail]);

  useEffect(() => {
    if (!ownerNeedsName) setContactFullName(ownerFullName ?? "");
  }, [ownerFullName, ownerNeedsName]);

  useEffect(() => {
    if (petOptions.length && !petId) setPetId(petOptions[0]?.id ?? "");
  }, [petOptions, petId]);

  useEffect(() => {
    if (!hasPets || !petId) return;
    const pet = petOptions.find((p) => p.id === petId);
    if (!pet) return;
    setPetGender((normalizeBookingPetGender(pet.gender) ?? "") as PetGenderValue | "");
    setPetAgeYears(monthsToAgeYearsInput(pet.age_months));
  }, [hasPets, petId, petOptions]);

  const useManualDateTime = !hasBookingDoctors || !doctorId;

  function onChangeTime(event: DateTimePickerEvent, selectedDate?: Date) {
    const evType = "type" in event ? event.type : "set";
    if (evType === "dismissed") {
      setShowTimePicker(false);
      return;
    }
    if (!selectedDate) {
      setShowTimePicker(false);
      return;
    }
    const next = new Date(startsAt);
    next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    setStartsAt(next);
    setShowTimePicker(false);
  }

  function onChangeReschedule(event: DateTimePickerEvent, selectedDate?: Date) {
    handleDateTimePickerChange(event, selectedDate, {
      onSet: setRescheduleAt,
      setVisible: setShowReschedulePicker,
    });
  }

  const mine = useMemo(
    () => [...appointments].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [appointments],
  );

  function pendingFor(apptId: string) {
    return timeChangeRequests.find((r) => r.appointment_id === apptId && r.status === "pending");
  }

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

  const [calendarYear, setCalendarYear] = useState(startsAt.getFullYear());
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(startsAt.getMonth());

  const monthLabel = useMemo(() => {
    const d = new Date(calendarYear, calendarMonthIndex, 1);
    return d.toLocaleString(undefined, { month: "long" });
  }, [calendarYear, calendarMonthIndex]);

  const firstDayOfMonth = new Date(calendarYear, calendarMonthIndex, 1);
  const firstDayIndexMon0 = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const totalCells = 42;

  function shiftMonth(delta: number) {
    const d = new Date(calendarYear, calendarMonthIndex + delta, 1);
    setCalendarYear(d.getFullYear());
    setCalendarMonthIndex(d.getMonth());
  }

  function isSameDay(d: Date, y: number, m: number, day: number) {
    return d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;
  }

  function pickDay(day: number) {
    const next = new Date(startsAt);
    next.setFullYear(calendarYear, calendarMonthIndex, day);
    next.setHours(startsAt.getHours(), startsAt.getMinutes(), 0, 0);
    setStartsAt(next);
  }

  const selectedDateLabel = startsAt.toLocaleDateString();
  const resolvedStartsAtIso = useManualDateTime ? startsAt.toISOString() : slotStartsAt;

  function submitBooking() {
    if (!branchId.trim()) {
      Alert.alert("Select a branch", "Choose a clinic location.");
      return;
    }
    if (!contactPhone.trim()) {
      Alert.alert("Contact phone required", "Add a phone number so the clinic can reach you.");
      return;
    }
    const fullName = (ownerNeedsName ? contactFullName : ownerFullName ?? contactFullName).trim();
    if (!fullName) {
      Alert.alert("Full name required", "Enter your full name for this booking.");
      return;
    }
    if (!bookingConsent) {
      Alert.alert("Consent required", "Please accept the booking consent before submitting.");
      return;
    }
    if (!consentSignaturePng?.startsWith("data:image/png")) {
      Alert.alert("Signature required", "Please sign in the signature box.");
      return;
    }
    if (hasBookingDoctors && doctorId && !slotStartsAt) {
      Alert.alert("Select a time slot", "Choose an available slot for the selected doctor.");
      return;
    }
    if (useManualDateTime && !startsAt) {
      Alert.alert("Select date & time", "Choose when you would like to visit.");
      return;
    }

    if (hasPets) {
      if (!petId.trim()) {
        Alert.alert("Select a pet", "Choose which pet this appointment is for.");
        return;
      }
    } else {
      if (!newPetName.trim()) {
        Alert.alert("Pet name required", "Enter the name for your new pet.");
        return;
      }
      if (!newPetSpecies.trim()) {
        Alert.alert("Species required", "Select a species for your new pet.");
        return;
      }
      if (!newPetGender) {
        Alert.alert("Pet gender required", "Select a gender for your new pet.");
        return;
      }
      if (!parseBookingAgeYearsToMonths(newPetAgeYears)) {
        Alert.alert("Pet age required", "Enter your pet's age in years (e.g. 3 or 0.5).");
        return;
      }
    }

    void onCreate({
      petId: hasPets ? petId : undefined,
      newPetName: hasPets ? undefined : newPetName.trim(),
      newPetSpecies: hasPets ? undefined : newPetSpecies.trim(),
      newPetBreed: hasPets ? undefined : newPetBreed.trim() || undefined,
      newPetGender: hasPets ? undefined : newPetGender || null,
      newPetAgeMonths: hasPets ? undefined : parseBookingAgeYearsToMonths(newPetAgeYears),
      branchId,
      appointmentType,
      doctorId: doctorId || null,
      startsAt: resolvedStartsAtIso,
      notes,
      chiefComplaint: chiefComplaint.trim() || undefined,
      allergies: allergies.trim() || undefined,
      currentMedications: currentMedications.trim() || undefined,
      contactFullName: fullName,
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim() || undefined,
      petGender: hasPets ? petGender || null : undefined,
      petAgeYears: hasPets ? petAgeYears.trim() || undefined : undefined,
      bookingConsent: true,
      consentSignaturePng,
    });
  }

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={[commonStyles.scrollContent, { paddingBottom: 40 }]}
      scrollEnabled={scrollEnabled}
      nestedScrollEnabled={scrollEnabled}
      keyboardShouldPersistTaps="handled"
    >
      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>Book appointment</Text>

        <View style={styles.typeRow}>
          {APPOINTMENT_TYPES.map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.typeChip, appointmentType === value && styles.typeChipOn]}
              onPress={() => setAppointmentType(value)}
            >
              <Text style={[styles.typeChipText, appointmentType === value && styles.typeChipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={commonStyles.sectionLabel}>Pet</Text>
        {hasPets ? (
          <>
            <View style={styles.chipRow}>
              {petOptions.map((pet) => (
                <Pressable
                  key={pet.id}
                  style={[styles.chip, petId === pet.id && styles.chipActive]}
                  onPress={() => setPetId(pet.id)}
                >
                  <PetAvatar uri={pet.photo_url} size={24} />
                  <Text style={[styles.chipText, petId === pet.id && styles.chipTextActive]}>{pet.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Pet gender</Text>
            <View style={styles.speciesChipWrap}>
              <Pressable
                style={[styles.speciesChip, petGender === "" && styles.speciesChipOn]}
                onPress={() => setPetGender("")}
              >
                <Text style={[styles.speciesChipText, petGender === "" && styles.speciesChipTextOn]}>Keep existing</Text>
              </Pressable>
              {PET_GENDER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.speciesChip, petGender === opt.value && styles.speciesChipOn]}
                  onPress={() => setPetGender(opt.value)}
                >
                  <Text style={[styles.speciesChipText, petGender === opt.value && styles.speciesChipTextOn]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[commonStyles.sectionLabel, { marginTop: 8 }]}>Pet age (years)</Text>
            <TextInput
              style={commonStyles.input}
              value={petAgeYears}
              onChangeText={setPetAgeYears}
              placeholder="Optional for existing pet"
              placeholderTextColor={theme.outline}
              keyboardType="decimal-pad"
            />
          </>
        ) : (
          <View>
            <Text style={[commonStyles.muted, { marginTop: 2, marginBottom: 10 }]}>
              No pets found in your profile. Create one here to book.
            </Text>
            <TextInput
              style={commonStyles.input}
              value={newPetName}
              onChangeText={setNewPetName}
              placeholder="Pet name"
              placeholderTextColor={theme.outline}
            />
            <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Species</Text>
            <View style={styles.speciesChipWrap}>
              {PET_SPECIES_BOOKING_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.speciesChip, newPetSpecies === opt.value && styles.speciesChipOn]}
                  onPress={() => setNewPetSpecies(opt.value)}
                >
                  <Text style={[styles.speciesChipText, newPetSpecies === opt.value && styles.speciesChipTextOn]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[commonStyles.input, { marginTop: 8 }]}
              value={newPetBreed}
              onChangeText={setNewPetBreed}
              placeholder="Breed (optional)"
              placeholderTextColor={theme.outline}
            />
            <Text style={[commonStyles.sectionLabel, { marginTop: 12 }]}>Sex</Text>
            <View style={styles.speciesChipWrap}>
              {PET_GENDER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.speciesChip, newPetGender === opt.value && styles.speciesChipOn]}
                  onPress={() => setNewPetGender(opt.value)}
                >
                  <Text style={[styles.speciesChipText, newPetGender === opt.value && styles.speciesChipTextOn]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[commonStyles.sectionLabel, { marginTop: 8 }]}>Age (years)</Text>
            <TextInput
              style={commonStyles.input}
              value={newPetAgeYears}
              onChangeText={setNewPetAgeYears}
              placeholder="e.g. 3"
              placeholderTextColor={theme.outline}
              keyboardType="decimal-pad"
            />
          </View>
        )}

        <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Branch</Text>
        <View style={styles.chipRow}>
          {branchOptions.map((branch) => (
            <Pressable
              key={branch.id}
              style={[styles.chip, branchId === branch.id && styles.chipActive]}
              onPress={() => setBranchId(branch.id)}
            >
              <Text style={[styles.chipText, branchId === branch.id && styles.chipTextActive]}>{branch.name}</Text>
            </Pressable>
          ))}
        </View>

        {hasBookingDoctors && clinicId ? (
          <BookingDoctorSlotPicker
            clinicId={clinicId}
            branchId={branchId}
            doctors={bookingDoctors}
            optionalDoctor
            doctorId={doctorId}
            onDoctorIdChange={setDoctorId}
            startsAt={slotStartsAt}
            onStartsAtChange={setSlotStartsAt}
          />
        ) : null}

        {useManualDateTime ? (
          <>
            <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Date</Text>
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <Pressable onPress={() => shiftMonth(-1)} style={styles.calendarNavBtn}>
                  <MaterialIcons name="chevron-left" size={22} color={theme.onSurface} />
                </Pressable>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={styles.calendarHeaderText}>
                    {monthLabel} {calendarYear}
                  </Text>
                </View>
                <Pressable onPress={() => shiftMonth(1)} style={styles.calendarNavBtn}>
                  <MaterialIcons name="chevron-right" size={22} color={theme.onSurface} />
                </Pressable>
              </View>

              <View style={styles.weekRow}>
                {weekdayLabels.map((w) => (
                  <Text key={w} style={styles.weekCellText}>
                    {w}
                  </Text>
                ))}
              </View>

              <View style={styles.grid}>
                {Array.from({ length: totalCells }).map((_, i) => {
                  const dayNum = i - firstDayIndexMon0 + 1;
                  const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                  if (!isValid) return <View key={`empty-${i}`} />;

                  const selected = isSameDay(startsAt, calendarYear, calendarMonthIndex, dayNum);
                  return (
                    <Pressable
                      key={`d-${dayNum}-${i}`}
                      style={[styles.dayCell, selected && styles.dayCellSelected]}
                      onPress={() => pickDay(dayNum)}
                    >
                      <Text style={[styles.dayCellText, selected && styles.dayCellTextSelected]}>{dayNum}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Text style={[commonStyles.sectionLabel, { marginTop: 14 }]}>Time</Text>
            <Pressable style={styles.dateBtn} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.dateBtnText}>
                {selectedDateLabel} · {startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </Pressable>
            {showTimePicker ? (
              <DateTimePicker
                value={startsAt}
                mode="time"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={onChangeTime}
              />
            ) : null}
          </>
        ) : null}

        <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Chief complaint / main concern</Text>
        <TextInput
          style={[commonStyles.input, { minHeight: 80, textAlignVertical: "top" }]}
          value={chiefComplaint}
          onChangeText={setChiefComplaint}
          placeholder="What should the clinic know?"
          placeholderTextColor={theme.outline}
          multiline
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Known allergies</Text>
        <TextInput
          style={[commonStyles.input, { minHeight: 56, textAlignVertical: "top" }]}
          value={allergies}
          onChangeText={setAllergies}
          placeholder="None / food, drugs, environmental…"
          placeholderTextColor={theme.outline}
          multiline
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Current medications / supplements</Text>
        <TextInput
          style={[commonStyles.input, { minHeight: 56, textAlignVertical: "top" }]}
          value={currentMedications}
          onChangeText={setCurrentMedications}
          placeholder="None or list as prescribed"
          placeholderTextColor={theme.outline}
          multiline
        />

        {ownerNeedsName ? (
          <>
            <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Owner full name</Text>
            <TextInput
              style={commonStyles.input}
              value={contactFullName}
              onChangeText={setContactFullName}
              placeholder="Enter your full name"
              placeholderTextColor={theme.outline}
              autoComplete="name"
            />
          </>
        ) : null}

        <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Contact phone (confirm)</Text>
        <TextInput
          style={commonStyles.input}
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="+91 98765 43210"
          placeholderTextColor={theme.outline}
          keyboardType="phone-pad"
        />
        <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Contact email (confirm)</Text>
        <TextInput
          style={commonStyles.input}
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="Email address"
          placeholderTextColor={theme.outline}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Notes (optional)</Text>
        <TextInput
          style={[commonStyles.input, { minHeight: 72, textAlignVertical: "top" }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything else for the team"
          placeholderTextColor={theme.outline}
          multiline
        />

        <Pressable
          style={[styles.consentBox, bookingConsent && styles.consentBoxOn]}
          onPress={() => setBookingConsent((v) => !v)}
        >
          <MaterialIcons
            name={bookingConsent ? "check-box" : "check-box-outline-blank"}
            size={22}
            color={bookingConsent ? theme.primary : theme.outline}
          />
          <Text style={styles.consentText}>{APPOINTMENT_BOOKING_CONSENT_TEXT}</Text>
        </Pressable>

        <Text style={[commonStyles.sectionLabel, { marginTop: 14 }]}>Your signature</Text>
        <SignaturePad onChange={setConsentSignaturePng} onDrawActiveChange={(active) => setScrollEnabled(!active)} />
        {consentSignaturePng ? <Text style={[commonStyles.muted, { marginTop: 4 }]}>Signature captured.</Text> : null}

        <Pressable onPress={submitBooking} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, marginTop: 20 }]}>
          <LinearGradient
            colors={[theme.gradientStart, theme.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Confirm appointment</Text>
          </LinearGradient>
        </Pressable>
      </OwnerNeonCard>

      <OwnerNeonCard>
        <Text style={commonStyles.cardTitle}>My appointments</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>
          To change the time, send a request — reception will confirm or suggest another slot.
        </Text>
        {mine.map((a) => {
          const pending = pendingFor(a.id);
          return (
            <View key={a.id} style={styles.apptRow}>
              <PetAvatar uri={a.pets?.photo_url} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.apptTime}>{formatClinicDateTime(a.starts_at, clinicTimezone)}</Text>
                <Text style={commonStyles.muted}>
                  {a.pets?.name ?? "Pet"} · {a.branches?.name ?? "Branch"} · {(a.appointment_type ?? "").replace(/_/g, " ")}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  <View style={commonStyles.pill}>
                    <Text style={commonStyles.pillText}>{a.status}</Text>
                  </View>
                  {pending ? (
                    <View style={[commonStyles.pill, { backgroundColor: `${theme.tertiary}22` }]}>
                      <Text style={[commonStyles.pillText, { color: theme.tertiary }]}>Time change pending</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.apptActions}>
                {a.consent_pdf_path?.trim() && onOpenConsentPdf ? (
                  <>
                    <Pressable style={commonStyles.btnOutline} onPress={() => void onOpenConsentPdf(a.id)}>
                      <Text style={commonStyles.btnOutlineText}>Consent</Text>
                    </Pressable>
                    {onDownloadConsentPdf ? (
                      <Pressable style={commonStyles.btnOutline} onPress={() => void onDownloadConsentPdf(a.id)}>
                        <Text style={commonStyles.btnOutlineText}>Save</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
                {a.status === "scheduled" || a.status === "checked_in" ? (
                  <>
                    <Pressable
                      style={[commonStyles.btnOutline, pending ? { opacity: 0.45 } : undefined]}
                      disabled={!!pending}
                      onPress={() => {
                        setRescheduleId(a.id);
                        setRescheduleAt(new Date(a.starts_at));
                        setRescheduleNotes("");
                      }}
                    >
                      <Text style={commonStyles.btnOutlineText}>{pending ? "Requested" : "Move"}</Text>
                    </Pressable>
                    <Pressable
                      style={commonStyles.btnOutline}
                      onPress={() =>
                        Alert.alert("Cancel appointment?", "This will free the slot.", [
                          { text: "No", style: "cancel" },
                          { text: "Yes", onPress: () => void onCancelAppointment(a.id) },
                        ])
                      }
                    >
                      <Text style={commonStyles.btnOutlineText}>Cancel</Text>
                    </Pressable>
                  </>
                ) : (
                  <MaterialIcons name="check" size={20} color={theme.outline} />
                )}
              </View>
            </View>
          );
        })}
        {!mine.length ? <Text style={commonStyles.emptyState}>No appointments yet.</Text> : null}
      </OwnerNeonCard>

      {rescheduleId ? (
        <OwnerNeonCard>
          <Text style={commonStyles.cardTitle}>Request new time</Text>
          <Text style={[commonStyles.muted, { marginBottom: 12 }]}>
            The clinic will review your preferred time and confirm. Your appointment stays at the current time until they approve.
          </Text>
          <Text style={commonStyles.sectionLabel}>Preferred date & time</Text>
          <Pressable style={styles.dateBtn} onPress={() => setShowReschedulePicker(true)}>
            <Text style={styles.dateBtnText}>{rescheduleAt.toLocaleString()}</Text>
          </Pressable>
          {showReschedulePicker ? (
            <DateTimePicker value={rescheduleAt} mode="datetime" display="default" onChange={onChangeReschedule} />
          ) : null}
          <Text style={[commonStyles.sectionLabel, { marginTop: 14 }]}>Note to clinic (optional)</Text>
          <TextInput
            style={[commonStyles.input, { minHeight: 56, textAlignVertical: "top" }]}
            value={rescheduleNotes}
            onChangeText={setRescheduleNotes}
            placeholder="e.g. After school hours only"
            placeholderTextColor={theme.outline}
            multiline
          />
          <View style={[commonStyles.actionRow, { marginTop: 12 }]}>
            <Pressable style={commonStyles.btnOutline} onPress={() => setRescheduleId(null)}>
              <Text style={commonStyles.btnOutlineText}>Close</Text>
            </Pressable>
            <Pressable
              style={commonStyles.btnPrimary}
              onPress={() =>
                void onRequestTimeChange(rescheduleId, rescheduleAt.toISOString(), rescheduleNotes.trim() || undefined).then(
                  () => setRescheduleId(null),
                )
              }
            >
              <Text style={commonStyles.btnPrimaryText}>Submit request</Text>
            </Pressable>
          </View>
        </OwnerNeonCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceContainer,
  },
  typeChipOn: { borderColor: theme.error, backgroundColor: `${theme.error}18` },
  typeChipText: { fontWeight: "700", fontSize: 12, color: theme.onSurface },
  typeChipTextOn: { color: theme.error },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.surfaceContainer,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
  },
  chipActive: {
    backgroundColor: `${theme.primary}22`,
    borderColor: theme.primary,
  },
  chipText: { color: theme.onSurface, fontWeight: "600", fontSize: 14 },
  chipTextActive: { color: theme.primary, fontWeight: "800" },
  dateBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: theme.surfaceContainer,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
  },
  dateBtnText: { fontWeight: "600", color: theme.onSurface, fontSize: 15 },
  speciesChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
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
  consentBox: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${theme.primary}33`,
    backgroundColor: `${theme.primary}0D`,
  },
  consentBoxOn: { borderColor: theme.primary, backgroundColor: `${theme.primary}18` },
  consentText: { flex: 1, fontSize: 13, lineHeight: 19, color: theme.onSurface },
  calendarCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.surfaceContainer,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
  },
  calendarHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  calendarNavBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  calendarHeaderText: { fontWeight: "900", color: theme.onSurface },
  weekRow: { flexDirection: "row" as const, justifyContent: "space-between", marginBottom: 6 },
  weekCellText: { flex: 1, textAlign: "center", fontWeight: "800", color: theme.outline, fontSize: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap" as const },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 6,
  },
  dayCellSelected: {
    backgroundColor: `${theme.primary}22`,
    borderColor: theme.primary,
  },
  dayCellText: { fontWeight: "800", color: theme.onSurface, fontSize: 12 },
  dayCellTextSelected: { color: theme.primary },
  cta: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
  apptRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  apptTime: { fontWeight: "800", color: theme.onSurface, fontSize: 14 },
  apptActions: { flexDirection: "row", flexWrap: "wrap", gap: 6, maxWidth: 160, justifyContent: "flex-end" },
});
