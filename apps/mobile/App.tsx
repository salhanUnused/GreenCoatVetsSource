import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoLinking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Session } from "@supabase/supabase-js";
import * as DocumentPicker from "expo-document-picker";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { supabase } from "./src/lib/supabase";
import { clearPendingInvite, loadPendingInvite } from "./src/lib/pending-invite";
import { normalizeAppointment } from "./src/lib/normalizeAppointment";
import { ensurePetOwnerRow } from "./src/lib/ensurePetOwner";
import {
  assertAppointmentStartsInFuture,
  DEFAULT_PET_SPECIES_BOOKING_VALUE,
  normalizeLegacySpeciesToCanonical,
} from "@saasclinics/lib";
import type { BookingDoctor } from "./src/components/BookingDoctorSlotPicker";
import {
  APPOINTMENT_BOOKING_CONSENT_TEXT,
  APPOINTMENT_BOOKING_CONSENT_VERSION,
} from "./src/lib/appointmentConsent";
import {
  formatBookingAgeYearsLabel,
  normalizeBookingPetGender,
  parseBookingAgeYearsToMonths,
} from "./src/lib/petDemographics";
import { VetCareTabBar } from "./src/navigation/VetCareTabBar";
import { VetCareTabButton } from "./src/navigation/VetCareTabButton";
import { OwnerInboxScreen } from "./src/screens/OwnerInboxScreen";
import { OwnerHealthScreen } from "./src/screens/OwnerHealthScreen";
import { ReceptionistScreen } from "./src/screens/ReceptionistScreen";
import { OwnerBookingScreen } from "./src/screens/OwnerBookingScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { WelcomeSplashScreen } from "./src/screens/WelcomeSplashScreen";
import { WebOnlyMarketingEditorScreen } from "./src/screens/WebOnlyMarketingEditorScreen";
import { DoctorNavigator } from "./src/screens/DoctorNavigator";
import { OwnerDashboardScreen } from "./src/screens/owner/OwnerDashboardScreen";
import { OwnerPetsScreen } from "./src/screens/owner/OwnerPetsScreen";
import { ReceptionQueueScreen } from "./src/screens/staff/ReceptionQueueScreen";
import { ClinicPrescriptionsScreen } from "./src/screens/staff/ClinicPrescriptionsScreen";
import { SeniorVideoCallsScreen } from "./src/screens/staff/SeniorVideoCallsScreen";
import { AdminMobileStatsScreen } from "./src/screens/AdminMobileStatsScreen";
import { LabPharmacyHubScreen } from "./src/screens/LabPharmacyHubScreen";
import { InviteQrMobileScreen } from "./src/screens/InviteQrMobileScreen";
import { StaffProfileScreen } from "./src/screens/StaffProfileScreen";
import { StaffAppointmentsCalendarScreen } from "./src/screens/staff/StaffAppointmentsCalendarScreen";
import { AdminPatientsScreen } from "./src/screens/staff/AdminPatientsScreen";
import { OwnerReportsScreen } from "./src/screens/owner/OwnerReportsScreen";
import { pickActiveMembership, forceAssignOnlyClinic, isDoctorRole, isRegularDoctorRole, isSeniorDoctorRole, resolveSuperAdminClinicId } from "./src/lib/membership";
import { ProfileMenuSheet } from "./src/components/ProfileMenuSheet";
import {
  AdminMobileStats,
  Appointment,
  DoctorNotification,
  Membership,
  Order,
  OwnerPrescription,
  OwnerVisitReport,
  OwnerVisitSummaryRow,
  Pet,
  ProductListItem,
  StaffDoctorOption,
  VisitSummary,
} from "./src/types/app";
import { theme, shadows } from "./src/theme/theme";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AppAmbientBackground } from "./src/components/AppAmbientBackground";
import { PawCircularLoader } from "./src/components/PawCircularLoader";
import { loadAppBranding, type AppBranding } from "./src/lib/app-branding";
import { promptOpenOrSharePdf } from "./src/lib/open-or-share-document";
import { createSessionFromUrl, isOAuthCallbackUrl } from "./src/lib/google-auth";
import { getPetOwnerProfileStatus, syncWebsiteAccountForMobile } from "./src/lib/owner-profile";
import { notifyAppointmentBookingEmails } from "./src/lib/website-api";
import { CompleteProfileScreen } from "./src/screens/CompleteProfileScreen";
import { WalkInScreen } from "./src/screens/WalkInScreen";
import { generateAppointmentVisitPdf } from "./src/lib/visitReportPdf";

const Tab = createBottomTabNavigator();
const MOBILE_CONSENT_KEY = "saasclinics_mobile_data_consent_v1";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [profileCheckLoading, setProfileCheckLoading] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  useEffect(() => {
    const sub = ExpoLinking.addEventListener("url", ({ url }) => {
      if (!isOAuthCallbackUrl(url)) return;
      void createSessionFromUrl(url).catch((err) => {
        console.warn("OAuth callback", err instanceof Error ? err.message : err);
      });
    });
    void ExpoLinking.getInitialURL().then((url) => {
      if (url && isOAuthCallbackUrl(url)) {
        void createSessionFromUrl(url).catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(MOBILE_CONSENT_KEY)
      .then((v) => setConsentAccepted(v === "1"))
      .catch(() => setConsentAccepted(false));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setNeedsProfileCompletion(false);
      setProfileCheckLoading(false);
      return;
    }
    let cancelled = false;
    setProfileCheckLoading(true);
    void (async () => {
      try {
        const user = session.user;
        const { data: platformAdmin } = await supabase
          .from("platform_super_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (platformAdmin) {
          if (!cancelled) setNeedsProfileCompletion(false);
          return;
        }
        const { data: memberships } = await supabase
          .from("user_clinic_memberships")
          .select("role")
          .eq("user_id", user.id)
          .eq("is_active", true);
        if ((memberships ?? []).some((m) => m.role === "marketing_editor")) {
          if (!cancelled) setNeedsProfileCompletion(false);
          return;
        }
        await syncWebsiteAccountForMobile(supabase, user);
        const status = await getPetOwnerProfileStatus(supabase, user.id, user.email);
        if (!cancelled) setNeedsProfileCompletion(status.needsCompletion);
      } catch {
        if (!cancelled) setNeedsProfileCompletion(false);
      } finally {
        if (!cancelled) setProfileCheckLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return (
    <SafeAreaProvider>
      {!splashDone ? (
        <WelcomeSplashScreen ready={!loading} onFinish={() => setSplashDone(true)} />
      ) : !session ? (
        showAuthScreen ? (
          <AuthScreen />
        ) : (
          <WelcomeScreen
            consentAccepted={consentAccepted}
            onAcceptConsent={async () => {
              await AsyncStorage.setItem(MOBILE_CONSENT_KEY, "1");
              setConsentAccepted(true);
            }}
            onContinue={() => setShowAuthScreen(true)}
          />
        )
      ) : profileCheckLoading ? (
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
          <View style={styles.page}>
            <AppAmbientBackground />
            <View style={styles.center}>
              <PawCircularLoader size={88} message="Loading your account…" />
            </View>
          </View>
        </SafeAreaView>
      ) : needsProfileCompletion ? (
        <CompleteProfileScreen onComplete={() => setNeedsProfileCompletion(false)} />
      ) : (
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
          <StatusBar style="dark" />
          <MobileHome onSignOut={() => supabase.auth.signOut()} userEmail={session.user.email} />
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}

function MobileHome({ onSignOut, userEmail }: { onSignOut: () => void; userEmail?: string | null }) {
  const insets = useSafeAreaInsets();
  const [profileOpen, setProfileOpen] = useState(false);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [prescriptions, setPrescriptions] = useState<OwnerPrescription[]>([]);
  const [ownerVisitReports, setOwnerVisitReports] = useState<OwnerVisitReport[]>([]);
  const [ownerVisitSummaries, setOwnerVisitSummaries] = useState<OwnerVisitSummaryRow[]>([]);
  const [ownerReportsEnabled, setOwnerReportsEnabled] = useState(true);
  const [downloadingAllReports, setDownloadingAllReports] = useState(false);
  const [vaccinations, setVaccinations] = useState<
    Array<{ id: string; vaccine_name: string; due_on: string | null; status: string | null; pets?: { name?: string | null } | null }>
  >([]);
  const [attachments, setAttachments] = useState<
    Array<{ id: string; file_name: string | null; created_at: string; storage_bucket: string; storage_path: string; visit_id: string | null }>
  >([]);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; title: string; message: string; channel: string; created_at: string; read_at: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [ownerFullName, setOwnerFullName] = useState<string | null>(null);
  const [bookingDoctors, setBookingDoctors] = useState<BookingDoctor[]>([]);
  const [doctorStaffId, setDoctorStaffId] = useState<string | null>(null);
  const [doctorNotifications, setDoctorNotifications] = useState<DoctorNotification[]>([]);
  const [doctorMedicineNames, setDoctorMedicineNames] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<StaffDoctorOption[]>([]);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [visitSummaries, setVisitSummaries] = useState<VisitSummary[]>([]);
  const [adminStats, setAdminStats] = useState<AdminMobileStats | null>(null);
  const [adminVisitSummaries, setAdminVisitSummaries] = useState<OwnerVisitSummaryRow[]>([]);
  const [clinicReportsEnabled, setClinicReportsEnabled] = useState(true);
  const [downloadingAdminReports, setDownloadingAdminReports] = useState(false);
  const [clinicRecentPrescriptions, setClinicRecentPrescriptions] = useState<
    Array<{ id: string; issued_at: string; notes: string | null; pdf_url: string | null; pets?: { name?: string | null } | null }>
  >([]);
  const [platformBranding, setPlatformBranding] = useState<AppBranding | null>(null);
  const [ownerTimeChangeRequests, setOwnerTimeChangeRequests] = useState<
    Array<{ appointment_id: string; requested_starts_at: string; status: string }>
  >([]);
  const [pendingTimeChangeRequests, setPendingTimeChangeRequests] = useState<
    Array<{
      id: string;
      appointment_id: string;
      requested_starts_at: string;
      current_starts_at?: string | null;
      pet_name?: string | null;
    }>
  >([]);
  const [announcementPopup, setAnnouncementPopup] = useState<{
    id: string;
    title: string;
    message: string;
    created_at: string;
  } | null>(null);
  const [doctorQueueDate, setDoctorQueueDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const appointmentSelect =
    "id, status, starts_at, appointment_type, branch_id, pet_id, owner_id, doctor_id, branches(name), owners(full_name, phone), pets(name, species, photo_url, breed, age_months, date_of_birth, allergies, chronic_diseases)";

  async function hydratePetImageUrls(rows: Pet[]) {
    if (!rows.length) return rows;
    const next = await Promise.all(
      rows.map(async (pet) => {
        if (!pet.photo_url) return pet;
        if (pet.photo_url.startsWith("http://") || pet.photo_url.startsWith("https://")) return pet;
        const { data, error } = await supabase.storage.from("medical-files").createSignedUrl(pet.photo_url, 60 * 60);
        if (error || !data?.signedUrl) return pet;
        return { ...pet, photo_url: data.signedUrl };
      })
    );
    return next;
  }

  async function loadData(queueDateOverride?: Date) {
    setLoading(true);
    setClinicRecentPrescriptions([]);
    setMembership(null);
    setDoctorStaffId(null);
    setDoctorNotifications([]);
    setDoctorMedicineNames([]);
    setDoctors([]);
    setBookingDoctors([]);
    setOwnerFullName(null);
    setProducts([]);
    setVisitSummaries([]);
    setAdminStats(null);
    setAdminVisitSummaries([]);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setOwnerId(null);
    setOwnerPhone(null);
    setOwnerEmail(null);

    const { data: platformAdmin } = await supabase
      .from("platform_super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isSuperAdmin = Boolean(platformAdmin);

    let { data: membershipRows, error: membershipQueryError } = await supabase
      .from("user_clinic_memberships")
      .select("clinic_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (membershipQueryError) {
      console.warn("membership query", membershipQueryError.message);
    }

    const membershipRowList = (membershipRows as Array<{ clinic_id: string; role: string }> | null) ?? [];
    let membershipData = pickActiveMembership(membershipRowList);

    if (!membershipData) {
      const pending = await loadPendingInvite();
      if (pending?.token) {
        const { error: consumeErr } = await supabase.rpc("consume_clinic_role_invite", {
          p_token: pending.token,
          p_full_name: pending.fullName,
          p_phone: pending.phone,
          p_working_hours: pending.inviteRole === "doctor" ? pending.workingHours : null,
        });
        if (!consumeErr) {
          await clearPendingInvite();
          const retry = await supabase
            .from("user_clinic_memberships")
            .select("clinic_id, role")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("updated_at", { ascending: false });
          membershipData = pickActiveMembership((retry.data as Array<{ clinic_id: string; role: string }> | null) ?? []);
        }
      }
    }

    if (!membershipData) {
      try {
        await syncWebsiteAccountForMobile(supabase, user);
        const retry = await supabase
          .from("user_clinic_memberships")
          .select("clinic_id, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false });
        membershipData = pickActiveMembership((retry.data as Array<{ clinic_id: string; role: string }> | null) ?? []);
      } catch (ensureErr) {
        console.warn("syncWebsiteAccountForMobile", ensureErr instanceof Error ? ensureErr.message : ensureErr);
      }
    }

    if (!membershipData) {
      try {
        await forceAssignOnlyClinic("pet_owner");
        const retry = await supabase
          .from("user_clinic_memberships")
          .select("clinic_id, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false });
        membershipData = pickActiveMembership((retry.data as Array<{ clinic_id: string; role: string }> | null) ?? []);
      } catch (forceErr) {
        console.warn("forceAssignOnlyClinic", forceErr instanceof Error ? forceErr.message : forceErr);
      }
    }

    if (!membershipData) {
      setLoading(false);
      return;
    }

    if (membershipData.role === "marketing_editor") {
      setMembership(membershipData);
      setLoading(false);
      return;
    }

    if (isSuperAdmin) {
      let clinicId: string | null = membershipData.clinic_id;
      if (!clinicId) {
        clinicId = await resolveSuperAdminClinicId();
      }
      if (!clinicId) {
        setLoading(false);
        return;
      }
      membershipData = { role: "super_admin", clinic_id: clinicId };
    }

    setMembership(membershipData);
    const { data: branchData } = await supabase.rpc("get_public_branches_for_clinic", {
      p_clinic_id: membershipData.clinic_id,
    });
    setBranches((branchData as Array<{ id: string; name: string }>) ?? []);
    setDoctorStaffId(null);
    setDoctorNotifications([]);
    setDoctorMedicineNames([]);

    const role = membershipData.role.toLowerCase();
    if (role === "pet_owner") {
      const { ownerId: resolvedOwnerId, error: ownerEnsureErr } = await ensurePetOwnerRow(
        supabase,
        membershipData.clinic_id,
        user
      );
      if (ownerEnsureErr) {
        console.warn("ensurePetOwnerRow", ownerEnsureErr.message);
      }
      setOwnerId(resolvedOwnerId);

      if (resolvedOwnerId) {
        const [
          { data: petsData },
          { data: ordersData },
          { data: appointmentsData },
          { data: productsData },
          { data: notificationData },
          { data: ownerAtcrData },
          { data: ownerContactData },
          { data: bookingDoctorsData },
        ] = await Promise.all([
          supabase
            .from("pets")
            .select("id, name, species, breed, gender, age_months, date_of_birth, allergies, photo_url")
            .eq("clinic_id", membershipData.clinic_id)
            .eq("owner_id", resolvedOwnerId)
            .eq("is_active", true)
            .order("name", { ascending: true })
            .limit(20),
          supabase
            .from("orders")
            .select("id, status, grand_total")
            .eq("clinic_id", membershipData.clinic_id)
            .eq("owner_id", resolvedOwnerId)
            .order("placed_at", { ascending: false })
            .limit(20),
          (() => {
            const from = new Date();
            from.setDate(from.getDate() - 90);
            from.setHours(0, 0, 0, 0);
            return supabase
              .from("appointments")
              .select(appointmentSelect)
              .eq("clinic_id", membershipData.clinic_id)
              .eq("owner_id", resolvedOwnerId)
              .gte("starts_at", from.toISOString())
              .order("starts_at", { ascending: true })
              .limit(100);
          })(),
          supabase
            .from("products")
            .select("id, name, slug, price, stock_quantity, requires_prescription, image_url, summary, description, compare_at_price")
            .eq("clinic_id", membershipData.clinic_id)
            .eq("is_active", true)
            .limit(40),
          supabase
            .from("notifications")
            .select("id, title, message, channel, created_at, read_at, payload")
            .eq("clinic_id", membershipData.clinic_id)
            .eq("owner_id", resolvedOwnerId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("appointment_time_change_requests")
            .select("appointment_id, requested_starts_at, status")
            .eq("clinic_id", membershipData.clinic_id)
            .eq("requested_by", user.id)
            .order("created_at", { ascending: false })
            .limit(40),
          supabase
            .from("owners")
            .select("phone, email, full_name")
            .eq("id", resolvedOwnerId)
            .maybeSingle(),
          supabase.rpc("get_public_booking_doctors", { p_clinic_id: membershipData.clinic_id }),
        ]);
        const hydratedPets = await hydratePetImageUrls((petsData as Pet[]) ?? []);
        setPets(hydratedPets);
        setOrders((ordersData as Order[]) ?? []);
        setAppointments(((appointmentsData as unknown[]) ?? []).map(normalizeAppointment));
        setProducts(
          ((productsData as ProductListItem[]) ?? []).map((p) => ({
            ...p,
            price: typeof p.price === "number" ? p.price : Number(p.price),
          }))
        );
        setNotifications(
          (notificationData as Array<{
            id: string;
            title: string;
            message: string;
            channel: string;
            created_at: string;
            read_at: string | null;
            payload?: { kind?: string; visit_id?: string } | null;
          }>) ?? []
        );
        setOwnerTimeChangeRequests(
          (ownerAtcrData as Array<{ appointment_id: string; requested_starts_at: string; status: string }> | null) ?? [],
        );
        setOwnerPhone((ownerContactData as { phone?: string | null } | null)?.phone ?? null);
        setOwnerEmail((ownerContactData as { email?: string | null } | null)?.email ?? null);
        setOwnerFullName((ownerContactData as { full_name?: string | null } | null)?.full_name ?? null);
        setBookingDoctors((bookingDoctorsData as BookingDoctor[] | null) ?? []);
        setPendingTimeChangeRequests([]);

        const petIds = ((petsData as Pet[]) ?? []).map((pet) => pet.id);
        if (petIds.length) {
          const [{ data: vaccinationData }, { data: prescriptionData }, { data: attachmentData }, { data: visitsData }] =
            await Promise.all([
              supabase
                .from("vaccination_records")
                .select("id, vaccine_name, due_on, status, pets(name)")
                .eq("clinic_id", membershipData.clinic_id)
                .in("pet_id", petIds)
                .order("due_on", { ascending: true })
                .limit(30),
              supabase
                .from("prescriptions")
                .select(
                  "id, issued_at, notes, pdf_url, visit_id, pets(name), prescription_items(id, medicine_name, dosage, frequency, duration, instructions)"
                )
                .eq("clinic_id", membershipData.clinic_id)
                .in("pet_id", petIds)
                .order("issued_at", { ascending: false })
                .limit(30),
              supabase
                .from("file_attachments")
                .select("id, file_name, created_at, storage_bucket, storage_path, visit_id")
                .eq("clinic_id", membershipData.clinic_id)
                .in("pet_id", petIds)
                .order("created_at", { ascending: false })
                .limit(30),
              supabase
                .from("visits")
                .select("id, pet_id, started_at, diagnosis, visit_report_pdf_path, visit_report_pdf_generated_at, pets(name)")
                .eq("clinic_id", membershipData.clinic_id)
                .in("pet_id", petIds)
                .order("started_at", { ascending: false })
                .limit(80),
            ]);
          setVaccinations(
            (
              (vaccinationData ?? []) as Array<{
                id: string;
                vaccine_name: string;
                due_on: string | null;
                status: string | null;
                pets?: { name?: string | null } | { name?: string | null }[] | null;
              }>
            ).map((row) => {
              const p = row.pets;
              const pet = Array.isArray(p) ? p[0] : p ?? null;
              return { id: row.id, vaccine_name: row.vaccine_name, due_on: row.due_on, status: row.status, pets: pet };
            })
          );
          const rawRx = (prescriptionData ?? []) as Array<
            OwnerPrescription & {
              pets?: { name?: string | null } | { name?: string | null }[] | null;
              prescription_items?: OwnerPrescription["prescription_items"];
            }
          >;
          setPrescriptions(
            rawRx.map((row) => {
              const p = row.pets;
              const pet = Array.isArray(p) ? p[0] ?? null : p ?? null;
              const items = row.prescription_items;
              const flat = Array.isArray(items) ? items : [];
              return {
                ...row,
                pets: pet,
                prescription_items: flat,
              };
            })
          );
          setAttachments(
            (attachmentData as Array<{
              id: string;
              file_name: string | null;
              created_at: string;
              storage_bucket: string;
              storage_path: string;
              visit_id: string | null;
            }>) ?? []
          );
          const vRows = (visitsData ?? []) as Array<
            VisitSummary & {
              visit_report_pdf_path?: string | null;
              visit_report_pdf_generated_at?: string | null;
              pets?: { name?: string | null } | { name?: string | null }[] | null;
            }
          >;
          setVisitSummaries(
            vRows.map((v) => ({
              id: v.id,
              pet_id: v.pet_id,
              started_at: v.started_at,
              diagnosis: v.diagnosis,
            }))
          );
          setOwnerVisitReports(
            vRows
              .filter((v) => Boolean(v.visit_report_pdf_path?.trim()))
              .map((v) => {
                const p = v.pets;
                const pet = Array.isArray(p) ? p[0] : p ?? null;
                return {
                  id: v.id,
                  pet_id: v.pet_id,
                  started_at: v.started_at,
                  visit_report_pdf_path: v.visit_report_pdf_path as string,
                  visit_report_pdf_generated_at: v.visit_report_pdf_generated_at ?? null,
                  pet_name: pet?.name?.trim() || "Pet",
                };
              })
          );
        } else {
          setVaccinations([]);
          setPrescriptions([]);
          setAttachments([]);
          setVisitSummaries([]);
          setOwnerVisitReports([]);
        }

        const [{ data: clinicRow }, { data: summaryRows }] = await Promise.all([
          supabase
            .from("clinics")
            .select("website_owner_visit_reports_enabled")
            .eq("id", membershipData.clinic_id)
            .maybeSingle(),
          supabase.rpc("get_owner_portal_visit_summaries", {
            p_clinic_id: membershipData.clinic_id,
            p_limit: 100,
          }),
        ]);
        setOwnerReportsEnabled(
          (clinicRow as { website_owner_visit_reports_enabled?: boolean | null } | null)?.website_owner_visit_reports_enabled ??
            true,
        );
        const summaryList = (summaryRows ?? []) as Array<{
          id: string;
          pet_name: string;
          branch_name: string;
          visited_at: string | null;
          status_label: string | null;
        }>;
        const summaryIds = summaryList.map((row) => row.id);
        const pdfMap = new Map<string, { generated: string | null; path: string | null }>();
        if (summaryIds.length) {
          const { data: pdfRows } = await supabase
            .from("visits")
            .select("id, visit_report_pdf_path, visit_report_pdf_generated_at")
            .eq("clinic_id", membershipData.clinic_id)
            .in("id", summaryIds);
          for (const row of (pdfRows ?? []) as Array<{
            id: string;
            visit_report_pdf_path: string | null;
            visit_report_pdf_generated_at: string | null;
          }>) {
            pdfMap.set(row.id, {
              path: row.visit_report_pdf_path,
              generated: row.visit_report_pdf_generated_at,
            });
          }
        }
        setOwnerVisitSummaries(
          summaryList.map((row) => {
            const pdf = pdfMap.get(row.id);
            const hasPath = Boolean(pdf?.path?.trim());
            const hasGenerated = Boolean(pdf?.generated);
            return {
              id: row.id,
              pet_name: row.pet_name,
              branch_name: row.branch_name,
              visited_at: row.visited_at,
              status_label: row.status_label,
              report_ready: hasPath && hasGenerated,
              visit_report_pdf_generated_at: pdf?.generated ?? null,
            };
          }),
        );
      } else {
        setOwnerTimeChangeRequests([]);
      }
    } else if (isSeniorDoctorRole(role)) {
      const { data: doctor } = await supabase
        .from("staff_profiles")
        .select("id")
        .eq("clinic_id", membershipData.clinic_id)
        .eq("user_id", user.id)
        .eq("role", "senior_doctor")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      setDoctorStaffId(doctor?.id ?? null);

      const { data: doctorList } = await supabase
        .from("staff_profiles")
        .select("id, full_name")
        .eq("clinic_id", membershipData.clinic_id)
        .in("role", ["doctor", "senior_doctor"])
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      setDoctors((doctorList as StaffDoctorOption[]) ?? []);

      const today = new Date().toISOString().slice(0, 10);
      const cid = membershipData.clinic_id;
      const [{ data: appointmentsData }, { data: rxClinic }, { data: pendingAtcr }, { data: notifData }, { data: medsData }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select(appointmentSelect)
            .eq("clinic_id", cid)
            .gte("starts_at", `${today}T00:00:00`)
            .lt("starts_at", `${today}T23:59:59`)
            .order("starts_at", { ascending: true })
            .limit(120),
          supabase
            .from("prescriptions")
            .select("id, issued_at, notes, pdf_url, pets(name)")
            .eq("clinic_id", cid)
            .order("issued_at", { ascending: false })
            .limit(25),
          supabase
            .from("appointment_time_change_requests")
            .select("id, appointment_id, requested_starts_at, appointments(starts_at, pets(name))")
            .eq("clinic_id", cid)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("notifications")
            .select("id, title, message, created_at, read_at")
            .eq("clinic_id", cid)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("inventory_items")
            .select("name")
            .eq("clinic_id", cid)
            .eq("is_active", true)
            .order("name", { ascending: true })
            .limit(200),
        ]);
      setOwnerTimeChangeRequests([]);
      setAppointments(((appointmentsData as unknown[]) ?? []).map(normalizeAppointment));
      const rawRx = (rxClinic ?? []) as Array<{
        id: string;
        issued_at: string;
        notes: string | null;
        pdf_url: string | null;
        pets?: { name?: string | null } | { name?: string | null }[] | null;
      }>;
      setClinicRecentPrescriptions(
        rawRx.map((r) => {
          const p = r.pets;
          const pet = Array.isArray(p) ? p[0] : p ?? null;
          return { id: r.id, issued_at: r.issued_at, notes: r.notes, pdf_url: r.pdf_url, pets: pet };
        }),
      );
      const atcrRows = (pendingAtcr ?? []) as Array<{
        id: string;
        appointment_id: string;
        requested_starts_at: string;
        appointments?:
          | { starts_at: string; pets?: { name?: string | null } | { name?: string | null }[] | null }
          | { starts_at: string; pets?: { name?: string | null } | { name?: string | null }[] | null }[]
          | null;
      }>;
      const pendingRows = atcrRows.map((row) => {
        const ap = row.appointments;
        const a = Array.isArray(ap) ? ap[0] : ap ?? null;
        const pets = a?.pets;
        const pet = Array.isArray(pets) ? pets[0] : pets ?? null;
        return {
          id: row.id,
          appointment_id: row.appointment_id,
          requested_starts_at: row.requested_starts_at,
          current_starts_at: a?.starts_at ?? null,
          pet_name: pet?.name ?? null,
        };
      });
      setPendingTimeChangeRequests(pendingRows);
      setDoctorNotifications((notifData as DoctorNotification[]) ?? []);
      setDoctorMedicineNames(
        Array.from(new Set(((medsData as Array<{ name: string }> | null) ?? []).map((m) => m.name).filter(Boolean))),
      );

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
      const [{ count: apptCount }, { data: invRows }] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", cid)
          .gte("starts_at", dayStart.toISOString())
          .lte("starts_at", dayEnd.toISOString()),
        supabase
          .from("inventory_items")
          .select("stock_quantity, reorder_level")
          .eq("clinic_id", cid)
          .eq("is_active", true)
          .limit(500),
      ]);
      const lowStock = (invRows ?? []).filter((r) => r.stock_quantity <= r.reorder_level).length;
      setAdminStats({
        appointmentsToday: apptCount ?? 0,
        pendingTimeChanges: pendingRows.length,
        lowStockSkus: lowStock,
      });

      const [{ data: clinicRow }, { data: visitsAdmin }] = await Promise.all([
        supabase.from("clinics").select("website_owner_visit_reports_enabled").eq("id", cid).maybeSingle(),
        supabase
          .from("visits")
          .select("id, started_at, status, visit_report_pdf_path, visit_report_pdf_generated_at, pets(name), branches(name)")
          .eq("clinic_id", cid)
          .order("started_at", { ascending: false })
          .limit(150),
      ]);
      setClinicReportsEnabled(
        (clinicRow as { website_owner_visit_reports_enabled?: boolean | null } | null)?.website_owner_visit_reports_enabled ??
          true,
      );
      const visitRows = (visitsAdmin ?? []) as Array<{
        id: string;
        started_at: string | null;
        status: string | null;
        visit_report_pdf_path: string | null;
        visit_report_pdf_generated_at: string | null;
        pets?: { name?: string | null } | { name?: string | null }[] | null;
        branches?: { name?: string | null } | { name?: string | null }[] | null;
      }>;
      setAdminVisitSummaries(
        visitRows.map((v) => {
          const pet = Array.isArray(v.pets) ? v.pets[0] : v.pets ?? null;
          const branch = Array.isArray(v.branches) ? v.branches[0] : v.branches ?? null;
          const hasPath = Boolean(v.visit_report_pdf_path?.trim());
          const hasGenerated = Boolean(v.visit_report_pdf_generated_at);
          return {
            id: v.id,
            pet_name: pet?.name?.trim() || "Pet",
            branch_name: branch?.name?.trim() || "Clinic",
            visited_at: v.started_at,
            status_label: v.status?.replace(/_/g, " ") ?? null,
            report_ready: hasPath && hasGenerated,
            visit_report_pdf_generated_at: v.visit_report_pdf_generated_at,
          };
        }),
      );
    } else if (isRegularDoctorRole(role)) {
      const { data: doctor } = await supabase
        .from("staff_profiles")
        .select("id")
        .eq("clinic_id", membershipData.clinic_id)
        .eq("user_id", user.id)
        .in("role", ["doctor", "senior_doctor"])
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      setDoctorStaffId(doctor?.id ?? null);
      const queueDay = queueDateOverride ?? doctorQueueDate;
      const dayStart = new Date(queueDay);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(queueDay);
      dayEnd.setHours(23, 59, 59, 999);
      let appointmentsQuery = supabase
        .from("appointments")
        .select(appointmentSelect)
        .eq("clinic_id", membershipData.clinic_id)
        .gte("starts_at", dayStart.toISOString())
        .lte("starts_at", dayEnd.toISOString())
        .order("starts_at", { ascending: true })
        .limit(120);
      if (doctor?.id) {
        appointmentsQuery = appointmentsQuery.or(`doctor_id.eq.${doctor.id},doctor_id.is.null`);
      }
      const [{ data: appointmentsData }, { data: notifData }, { data: medsData }] = await Promise.all([
        appointmentsQuery,
        supabase
          .from("notifications")
          .select("id, title, message, created_at, read_at")
          .eq("clinic_id", membershipData.clinic_id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("inventory_items")
          .select("name")
          .eq("clinic_id", membershipData.clinic_id)
          .eq("is_active", true)
          .order("name", { ascending: true })
          .limit(200),
      ]);
      setAppointments(((appointmentsData as unknown[]) ?? []).map(normalizeAppointment));
      setDoctorNotifications((notifData as DoctorNotification[]) ?? []);
      setDoctorMedicineNames(Array.from(new Set(((medsData as Array<{ name: string }> | null) ?? []).map((m) => m.name).filter(Boolean))));
      setOwnerTimeChangeRequests([]);
      setPendingTimeChangeRequests([]);
    } else {
      const { data: doctorList } = await supabase
        .from("staff_profiles")
        .select("id, full_name")
        .eq("clinic_id", membershipData.clinic_id)
        .in("role", ["doctor", "senior_doctor"])
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      setDoctors((doctorList as StaffDoctorOption[]) ?? []);

      const today = new Date().toISOString().slice(0, 10);
      const [{ data: appointmentsData }, { data: rxClinic }, { data: pendingAtcr }] = await Promise.all([
        supabase
          .from("appointments")
          .select(appointmentSelect)
          .eq("clinic_id", membershipData.clinic_id)
          .gte("starts_at", `${today}T00:00:00`)
          .lt("starts_at", `${today}T23:59:59`)
          .order("starts_at", { ascending: true })
          .limit(120),
        supabase
          .from("prescriptions")
          .select("id, issued_at, notes, pdf_url, pets(name)")
          .eq("clinic_id", membershipData.clinic_id)
          .order("issued_at", { ascending: false })
          .limit(25),
        supabase
          .from("appointment_time_change_requests")
          .select("id, appointment_id, requested_starts_at, appointments(starts_at, pets(name))")
          .eq("clinic_id", membershipData.clinic_id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      setOwnerTimeChangeRequests([]);
      setAppointments(((appointmentsData as unknown[]) ?? []).map(normalizeAppointment));
      const rawRx = (rxClinic ?? []) as Array<{
        id: string;
        issued_at: string;
        notes: string | null;
        pdf_url: string | null;
        pets?: { name?: string | null } | { name?: string | null }[] | null;
      }>;
      setClinicRecentPrescriptions(
        rawRx.map((r) => {
          const p = r.pets;
          const pet = Array.isArray(p) ? p[0] : p ?? null;
          return { id: r.id, issued_at: r.issued_at, notes: r.notes, pdf_url: r.pdf_url, pets: pet };
        })
      );

      const atcrRows = (pendingAtcr ?? []) as Array<{
        id: string;
        appointment_id: string;
        requested_starts_at: string;
        appointments?:
          | { starts_at: string; pets?: { name?: string | null } | { name?: string | null }[] | null }
          | { starts_at: string; pets?: { name?: string | null } | { name?: string | null }[] | null }[]
          | null;
      }>;
      setPendingTimeChangeRequests(
        atcrRows.map((row) => {
          const ap = row.appointments;
          const a = Array.isArray(ap) ? ap[0] : ap ?? null;
          const pets = a?.pets;
          const pet = Array.isArray(pets) ? pets[0] : pets ?? null;
          return {
            id: row.id,
            appointment_id: row.appointment_id,
            requested_starts_at: row.requested_starts_at,
            current_starts_at: a?.starts_at ?? null,
            pet_name: pet?.name ?? null,
          };
        }),
      );

      if (role === "clinic_admin" || role === "branch_admin" || role === "super_admin") {
        const cid = membershipData.clinic_id;
        const { data: staffRows } = await supabase
          .from("staff_profiles")
          .select("id, role")
          .eq("clinic_id", cid)
          .eq("user_id", user.id)
          .eq("is_active", true);
        const preferredStaff =
          (staffRows ?? []).find((r: { role: string }) => isDoctorRole(r.role)) ?? (staffRows ?? [])[0];
        setDoctorStaffId(preferredStaff?.id ?? null);

        const [{ data: notifAdmin }, { data: medsAdmin }] = await Promise.all([
          supabase
            .from("notifications")
            .select("id, title, message, created_at, read_at")
            .eq("clinic_id", cid)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("inventory_items")
            .select("name")
            .eq("clinic_id", cid)
            .eq("is_active", true)
            .order("name", { ascending: true })
            .limit(200),
        ]);
        setDoctorNotifications((notifAdmin as DoctorNotification[]) ?? []);
        setDoctorMedicineNames(
          Array.from(new Set(((medsAdmin as Array<{ name: string }> | null) ?? []).map((m) => m.name).filter(Boolean)))
        );

        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date();
        dayEnd.setHours(23, 59, 59, 999);
        const [{ count: apptCount }, { data: invRows }] = await Promise.all([
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("clinic_id", cid)
            .gte("starts_at", dayStart.toISOString())
            .lte("starts_at", dayEnd.toISOString()),
          supabase
            .from("inventory_items")
            .select("stock_quantity, reorder_level")
            .eq("clinic_id", cid)
            .eq("is_active", true)
            .limit(500),
        ]);
        const lowStock = (invRows ?? []).filter((r) => r.stock_quantity <= r.reorder_level).length;
        setAdminStats({
          appointmentsToday: apptCount ?? 0,
          pendingTimeChanges: (pendingAtcr ?? []).length,
          lowStockSkus: lowStock,
        });

        const [{ data: clinicRow }, { data: visitsAdmin }] = await Promise.all([
          supabase
            .from("clinics")
            .select("website_owner_visit_reports_enabled")
            .eq("id", cid)
            .maybeSingle(),
          supabase
            .from("visits")
            .select("id, started_at, status, visit_report_pdf_path, visit_report_pdf_generated_at, pets(name), branches(name)")
            .eq("clinic_id", cid)
            .order("started_at", { ascending: false })
            .limit(150),
        ]);
        setClinicReportsEnabled(
          (clinicRow as { website_owner_visit_reports_enabled?: boolean | null } | null)?.website_owner_visit_reports_enabled ??
            true,
        );
        const visitRows = (visitsAdmin ?? []) as Array<{
          id: string;
          started_at: string | null;
          status: string | null;
          visit_report_pdf_path: string | null;
          visit_report_pdf_generated_at: string | null;
          pets?: { name?: string | null } | { name?: string | null }[] | null;
          branches?: { name?: string | null } | { name?: string | null }[] | null;
        }>;
        setAdminVisitSummaries(
          visitRows.map((v) => {
            const pet = Array.isArray(v.pets) ? v.pets[0] : v.pets ?? null;
            const branch = Array.isArray(v.branches) ? v.branches[0] : v.branches ?? null;
            const hasPath = Boolean(v.visit_report_pdf_path?.trim());
            const hasGenerated = Boolean(v.visit_report_pdf_generated_at);
            return {
              id: v.id,
              pet_name: pet?.name?.trim() || "Pet",
              branch_name: branch?.name?.trim() || "Clinic",
              visited_at: v.started_at,
              status_label: v.status?.replace(/_/g, " ") ?? null,
              report_ready: hasPath && hasGenerated,
              visit_report_pdf_generated_at: v.visit_report_pdf_generated_at,
            };
          }),
        );
      }
    }

    setLoading(false);
  }

  async function refreshData() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAppBranding().then((b) => {
      if (!cancelled) setPlatformBranding(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Auto-dismiss success/info banner so it does not stick under the header */
  useEffect(() => {
    if (!actionMessage) return;
    const t = setTimeout(() => setActionMessage(null), 4200);
    return () => clearTimeout(t);
  }, [actionMessage]);

  /** Unread clinic announcement (staff only): modal popup */
  useEffect(() => {
    if (loading || !membership?.clinic_id) return;
    const rl = membership.role?.toLowerCase();
    if (rl === "pet_owner") return;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("notifications")
        .select("id, title, message, created_at, read_at, payload")
        .eq("clinic_id", membership.clinic_id)
        .eq("user_id", user.id)
        .eq("channel", "push")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled || !data?.length) return;
      const row = data.find((n) => {
        const p = n.payload as { kind?: string } | null;
        return p?.kind === "clinic_announcement";
      });
      if (row && !cancelled) {
        setAnnouncementPopup({
          id: row.id as string,
          title: row.title as string,
          message: row.message as string,
          created_at: row.created_at as string,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, membership?.clinic_id, membership?.role]);

  async function dismissAnnouncementPopup() {
    if (!announcementPopup) return;
    const id = announcementPopup.id;
    setAnnouncementPopup(null);
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }

  async function onStatusChange(appointmentId: string, status: string) {
    if (!membership?.clinic_id) return;
    await supabase.from("appointments").update({ status }).eq("id", appointmentId).eq("clinic_id", membership.clinic_id);

    if (status === "completed") await ensureVisitForAppointment(appointmentId, true);
    await loadData();
  }

  async function ensureVisitForAppointment(appointmentId: string, complete = false, checkIn = false) {
    if (!membership?.clinic_id) return null;
    const nowIso = new Date().toISOString();
    const { data: existing } = await supabase.from("visits").select("id, check_in_at").eq("appointment_id", appointmentId).limit(1).maybeSingle();

    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, branch_id, pet_id, owner_id, doctor_id, status")
      .eq("id", appointmentId)
      .eq("clinic_id", membership.clinic_id)
      .maybeSingle();
    if (!appointment) return null;

    const assignedDoctorId =
      appointment.doctor_id ?? (isDoctorRole(membership.role) ? doctorStaffId : null);

    if (checkIn && assignedDoctorId && !appointment.doctor_id) {
      await supabase
        .from("appointments")
        .update({ doctor_id: assignedDoctorId })
        .eq("id", appointmentId)
        .eq("clinic_id", membership.clinic_id);
    }

    if (existing?.id) {
      if (checkIn) {
        const visitPatch: { check_in_at?: string; started_at?: string; doctor_id?: string } = {};
        if (!existing.check_in_at) visitPatch.check_in_at = nowIso;
        visitPatch.started_at = nowIso;
        if (assignedDoctorId) visitPatch.doctor_id = assignedDoctorId;
        await supabase.from("visits").update(visitPatch).eq("id", existing.id);
        if (appointment.status === "scheduled") {
          await supabase
            .from("appointments")
            .update({ status: "checked_in" })
            .eq("id", appointmentId)
            .eq("clinic_id", membership.clinic_id);
        }
      }
      if (complete) {
        await supabase.from("visits").update({ completed_at: nowIso }).eq("id", existing.id);
      }
      return existing.id;
    }

    const { data: created } = await supabase
      .from("visits")
      .insert({
        clinic_id: membership.clinic_id,
        branch_id: appointment.branch_id,
        appointment_id: appointment.id,
        pet_id: appointment.pet_id,
        owner_id: appointment.owner_id,
        doctor_id: assignedDoctorId,
        check_in_at: checkIn ? nowIso : null,
        started_at: nowIso,
        completed_at: complete ? nowIso : null,
      })
      .select("id")
      .single();

    if (checkIn && appointment.status === "scheduled") {
      await supabase
        .from("appointments")
        .update({ status: "checked_in" })
        .eq("id", appointmentId)
        .eq("clinic_id", membership.clinic_id);
    }

    return created?.id ?? null;
  }

  async function onGenerateVisitPdf(appointmentId: string) {
    if (!membership?.clinic_id) return;
    setActionMessage("Generating report PDF…");
    const result = await generateAppointmentVisitPdf(membership.clinic_id, appointmentId);
    if (result.status === "ok") {
      setActionMessage("Report PDF generated.");
      if (result.url) {
        Alert.alert("Report ready", "A visit report PDF was generated and saved for the owner.", [
          { text: "Close", style: "cancel" },
          { text: "Open PDF", onPress: () => void Linking.openURL(result.url as string) },
        ]);
      } else {
        Alert.alert("Report ready", "A visit report PDF was generated and saved for the owner.");
      }
      await loadData();
    } else if (result.status === "no_data") {
      Alert.alert("Nothing to export yet", "Add symptoms, diagnosis, treatment plan, or a prescription in the consult screen first.");
    } else if (result.status === "no_visit") {
      Alert.alert("No visit data", "Open this appointment in the consult screen and save details before generating a report.");
    } else {
      Alert.alert("PDF failed", result.message);
    }
  }

  async function onUploadDocument(appointmentId: string) {
    if (!membership?.clinic_id) return;
    const picked = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    const visitId = await ensureVisitForAppointment(appointmentId, false);
    if (!visitId) {
      Alert.alert("Unable to prepare visit");
      return;
    }

    const { data: visit } = await supabase
      .from("visits")
      .select("id, branch_id, pet_id")
      .eq("id", visitId)
      .maybeSingle();
    if (!visit) return;

    const response = await fetch(asset.uri);
    const fileData = await response.arrayBuffer();
    const safeName = (asset.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${membership.clinic_id}/${visitId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("medical-files").upload(path, fileData, {
      contentType: asset.mimeType || "application/octet-stream",
    });
    if (uploadError) {
      Alert.alert("Upload failed", uploadError.message);
      return;
    }

    const { error: attachError } = await supabase.from("file_attachments").insert({
      clinic_id: membership.clinic_id,
      branch_id: visit.branch_id,
      pet_id: visit.pet_id,
      visit_id: visitId,
      storage_bucket: "medical-files",
      storage_path: path,
      file_name: asset.name ?? safeName,
      mime_type: asset.mimeType || null,
    });
    if (attachError) {
      Alert.alert("Attachment save failed", attachError.message);
      return;
    }
    setActionMessage("Document uploaded.");
    Alert.alert("Uploaded", "Document attached to visit.");
    await loadData();
  }

  async function onCreateOwnerAppointment(input: {
    petId?: string;
    newPetName?: string;
    newPetSpecies?: string;
    newPetBreed?: string;
    newPetGender?: string | null;
    newPetAgeMonths?: number | null;
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
  }) {
    if (!membership?.clinic_id) return;

    const appointmentTypes = ["consultation", "vaccination", "surgery", "grooming", "emergency"] as const;

    const branchId = input.branchId?.trim();
    const startsAtRaw = input.startsAt?.trim();
    const existingPetId = input.petId?.trim();
    const newPetName = input.newPetName?.trim();
    const newPetSpecies = input.newPetSpecies?.trim();
    const appointmentType = input.appointmentType?.trim();
    const doctorId = input.doctorId?.trim() || null;
    const notes = input.notes?.trim() ?? "";
    const chiefComplaint = input.chiefComplaint?.trim();
    const allergies = input.allergies?.trim();
    const currentMedications = input.currentMedications?.trim();
    const contactFullName = input.contactFullName?.trim();
    const contactPhone = input.contactPhone?.trim();
    const contactEmail = (input.contactEmail?.trim() ?? "").toLowerCase() || null;
    const petGender = normalizeBookingPetGender(input.petGender ?? input.newPetGender);
    const petAgeMonths =
      input.newPetAgeMonths != null
        ? input.newPetAgeMonths
        : input.petAgeYears
          ? parseBookingAgeYearsToMonths(input.petAgeYears)
          : null;
    const patientAgeLabel =
      formatBookingAgeYearsLabel(input.petAgeYears ?? "") ??
      (input.newPetAgeMonths != null
        ? formatBookingAgeYearsLabel(String(input.newPetAgeMonths / 12))
        : null);

    if (!branchId || !startsAtRaw) {
      Alert.alert("Missing details", "Choose a branch and a date & time before booking.");
      return;
    }
    if (!existingPetId && !newPetName) {
      Alert.alert("Missing details", "Branch, pet and time are required.");
      return;
    }
    if (!existingPetId && !petGender) {
      Alert.alert("Pet gender required", "Select a gender for your new pet.");
      return;
    }
    if (!existingPetId && !petAgeMonths) {
      Alert.alert("Pet age required", "Enter your pet's age in years.");
      return;
    }
    if (!appointmentType || !appointmentTypes.includes(appointmentType as (typeof appointmentTypes)[number])) {
      Alert.alert("Invalid appointment type", "Please choose a valid appointment type.");
      return;
    }
    if (!input.bookingConsent) {
      Alert.alert("Consent required", "You must accept the booking consent before submitting.");
      return;
    }
    if (!contactFullName) {
      Alert.alert("Full name required", "Enter your full name for this booking.");
      return;
    }
    if (!contactPhone) {
      Alert.alert("Contact phone required", "Add a phone number so the clinic can reach you.");
      return;
    }

    let startsAtIso: string;
    try {
      startsAtIso = assertAppointmentStartsInFuture(startsAtRaw).toISOString();
    } catch (e) {
      Alert.alert("Invalid time", e instanceof Error ? e.message : "Please choose a future date and time.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Session expired", "Sign in again.");
      return;
    }
    const { ownerId: resolvedOwnerId, error: ownerErr } = await ensurePetOwnerRow(supabase, membership.clinic_id, user);
    if (ownerErr || !resolvedOwnerId) {
      Alert.alert("Owner profile", ownerErr?.message ?? "Could not resolve your owner profile for this clinic.");
      return;
    }
    setOwnerId(resolvedOwnerId);

    let petId = existingPetId;
    if (!petId) {
      const { data: createdPet, error: petError } = await supabase
        .from("pets")
        .insert({
          clinic_id: membership.clinic_id,
          owner_id: resolvedOwnerId,
          primary_branch_id: branchId,
          name: newPetName!,
          species: normalizeLegacySpeciesToCanonical(newPetSpecies || DEFAULT_PET_SPECIES_BOOKING_VALUE),
          breed: input.newPetBreed?.trim() || null,
          gender: petGender,
          age_months: petAgeMonths,
          is_active: true,
        })
        .select("id")
        .single();

      if (petError || !createdPet) {
        Alert.alert("Pet create failed", petError?.message ?? "Unknown error");
        return;
      }
      petId = createdPet.id;
    } else if (petGender || petAgeMonths) {
      const { error: petUpdateError } = await supabase
        .from("pets")
        .update({
          gender: petGender || undefined,
          age_months: petAgeMonths ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", petId)
        .eq("clinic_id", membership.clinic_id)
        .eq("owner_id", resolvedOwnerId);
      if (petUpdateError) {
        Alert.alert("Pet update failed", petUpdateError.message);
        return;
      }
    }

    const ownerIntake = {
      chief_complaint: chiefComplaint || null,
      allergies: allergies || null,
      current_medications: currentMedications || null,
      contact_name: contactFullName || null,
      contact_phone: contactPhone || null,
      contact_email: contactEmail,
      patient_gender: petGender || null,
      patient_age: patientAgeLabel || null,
      consent_accepted: true,
      consent_text: APPOINTMENT_BOOKING_CONSENT_TEXT,
      consent_version: APPOINTMENT_BOOKING_CONSENT_VERSION,
      consent_at: new Date().toISOString(),
    };

    const { error: ownerUpdateError } = await supabase
      .from("owners")
      .update({
        full_name: contactFullName,
        phone: contactPhone,
        email: contactEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resolvedOwnerId)
      .eq("clinic_id", membership.clinic_id);
    if (ownerUpdateError) {
      Alert.alert("Profile update failed", ownerUpdateError.message);
      return;
    }

    const { error } = await supabase.from("appointments").insert({
      clinic_id: membership.clinic_id,
      branch_id: branchId,
      doctor_id: doctorId,
      pet_id: petId,
      owner_id: resolvedOwnerId,
      appointment_type: appointmentType as "consultation" | "vaccination" | "surgery" | "grooming" | "emergency",
      status: "scheduled",
      starts_at: startsAtIso,
      reason: chiefComplaint || null,
      notes: notes || null,
      owner_intake: ownerIntake,
      booking_source: "owner_portal",
      created_by: user.id,
    });
    if (error) {
      Alert.alert("Booking failed", error.message);
      return;
    }

    try {
      await notifyAppointmentBookingEmails({
        clinicId: membership.clinic_id,
        branchId,
        appointmentType,
        startsAtIso,
        petId: petId!,
        chiefComplaint: chiefComplaint || null,
        notes: notes || null,
        contactFullName,
        contactPhone,
        contactEmail,
      });
    } catch (mailErr) {
      console.warn("[booking] notification email failed", mailErr);
    }

    setOwnerFullName(contactFullName);
    setOwnerPhone(contactPhone);
    setOwnerEmail(contactEmail);
    setActionMessage("Appointment booked.");
    Alert.alert("Booked", "Your appointment has been scheduled.");
    await loadData();
  }

  async function onOpenAttachment(attachmentId: string) {
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (!attachment) return;
    const { data, error } = await supabase.storage
      .from(attachment.storage_bucket)
      .createSignedUrl(attachment.storage_path, 60 * 10);
    if (error || !data?.signedUrl) {
      Alert.alert("Unable to open file", error?.message ?? "No URL generated");
      return;
    }
    await Linking.openURL(data.signedUrl);
  }

  async function onOpenPrescriptionPdf(prescriptionId: string) {
    if (!membership?.clinic_id) return;
    let pdfPath: string | null | undefined = prescriptions.find((p) => p.id === prescriptionId)?.pdf_url;
    if (!pdfPath) {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("pdf_url")
        .eq("id", prescriptionId)
        .eq("clinic_id", membership.clinic_id)
        .maybeSingle();
      if (error || !data?.pdf_url) {
        Alert.alert("No PDF", "Prescription PDF is not available yet.");
        return;
      }
      pdfPath = data.pdf_url;
    }
    if (!pdfPath) {
      Alert.alert("No PDF", "Prescription PDF is not available yet.");
      return;
    }
    if (pdfPath.startsWith("http://") || pdfPath.startsWith("https://")) {
      await promptOpenOrSharePdf(pdfPath, `prescription-${prescriptionId}`);
      return;
    }
    const { data, error } = await supabase.storage.from("medical-files").createSignedUrl(pdfPath, 60 * 20);
    if (error || !data?.signedUrl) {
      Alert.alert("Unable to open PDF", error?.message ?? "No URL generated");
      return;
    }
    await promptOpenOrSharePdf(data.signedUrl, `prescription-${prescriptionId}`);
  }

  async function onOpenVisitReport(visitId: string) {
    if (!membership?.clinic_id) return;
    const row = ownerVisitReports.find((v) => v.id === visitId);
    let path: string | null | undefined = row?.visit_report_pdf_path;
    if (!path) {
      const { data, error } = await supabase
        .from("visits")
        .select("visit_report_pdf_path")
        .eq("id", visitId)
        .eq("clinic_id", membership.clinic_id)
        .maybeSingle();
      if (error || !data?.visit_report_pdf_path) {
        Alert.alert("No report", "Visit report PDF is not available yet.");
        return;
      }
      path = data.visit_report_pdf_path;
    }
    if (!path?.trim()) {
      Alert.alert("No report", "Visit report PDF is not available yet.");
      return;
    }
    if (path.startsWith("http://") || path.startsWith("https://")) {
      await promptOpenOrSharePdf(path, `visit-report-${visitId}`);
      return;
    }
    const { data, error } = await supabase.storage.from("medical-files").createSignedUrl(path, 60 * 20);
    if (error || !data?.signedUrl) {
      Alert.alert("Unable to open PDF", error?.message ?? "No URL generated");
      return;
    }
    await promptOpenOrSharePdf(data.signedUrl, `visit-report-${visitId}`);
  }

  async function onDownloadAllVisitReports() {
    const ready = ownerVisitSummaries.filter((v) => v.report_ready);
    if (!ready.length) {
      Alert.alert("No reports", "There are no visit report PDFs ready to download yet.");
      return;
    }
    setDownloadingAllReports(true);
    try {
      for (const row of ready) {
        await onOpenVisitReport(row.id);
      }
    } finally {
      setDownloadingAllReports(false);
    }
  }

  async function onDownloadAllAdminReports() {
    const ready = adminVisitSummaries.filter((v) => v.report_ready);
    if (!ready.length) {
      Alert.alert("No reports", "There are no visit report PDFs ready to download yet.");
      return;
    }
    setDownloadingAdminReports(true);
    try {
      for (const row of ready) {
        await onOpenVisitReport(row.id);
      }
    } finally {
      setDownloadingAdminReports(false);
    }
  }

  async function onOpenLatestPrescriptionForAppointment(appointmentId: string) {
    if (!membership?.clinic_id) return;
    const { data: visit } = await supabase
      .from("visits")
      .select("id")
      .eq("clinic_id", membership.clinic_id)
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!visit?.id) {
      Alert.alert("No consultation", "No visit found for this appointment.");
      return;
    }
    const { data: rx } = await supabase
      .from("prescriptions")
      .select("pdf_url")
      .eq("clinic_id", membership.clinic_id)
      .eq("visit_id", visit.id)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rx?.pdf_url) {
      Alert.alert("No PDF", "No prescription PDF for this visit yet.");
      return;
    }
    const pdfPath = rx.pdf_url;
    if (pdfPath.startsWith("http://") || pdfPath.startsWith("https://")) {
      await Linking.openURL(pdfPath);
      return;
    }
    const { data, error } = await supabase.storage.from("medical-files").createSignedUrl(pdfPath, 60 * 20);
    if (error || !data?.signedUrl) {
      Alert.alert("Unable to open PDF", error?.message ?? "No URL generated");
      return;
    }
    await Linking.openURL(data.signedUrl);
  }

  function base64ToBytes(base64: string) {
    if (!globalThis.atob) throw new Error("Base64 decode not available");
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function onUploadVisitImage(appointmentId: string, uri: string, mimeType?: string, base64?: string | null) {
    if (!membership?.clinic_id) return;
    const visitId = await ensureVisitForAppointment(appointmentId, false);
    if (!visitId) {
      Alert.alert("Unable to prepare visit");
      return;
    }

    const { data: visit } = await supabase.from("visits").select("id, branch_id, pet_id").eq("id", visitId).maybeSingle();
    if (!visit) return;

    let fileData: ArrayBuffer;
    try {
      if (base64) {
        fileData = base64ToBytes(base64).buffer;
      } else {
        const response = await fetch(uri);
        fileData = await response.arrayBuffer();
      }
    } catch (_e) {
      Alert.alert("Image read failed", "Unable to read selected image. Try again.");
      return;
    }
    const ext = mimeType?.includes("png") ? "png" : "jpg";
    const path = `${membership.clinic_id}/${visitId}/${Date.now()}-image.${ext}`;

    const { error: uploadError } = await supabase.storage.from("medical-files").upload(path, fileData, {
      contentType: mimeType || "image/jpeg",
    });
    if (uploadError) {
      Alert.alert("Upload failed", uploadError.message);
      return;
    }

    const { error: attachError } = await supabase.from("file_attachments").insert({
      clinic_id: membership.clinic_id,
      branch_id: visit.branch_id,
      pet_id: visit.pet_id,
      visit_id: visitId,
      storage_bucket: "medical-files",
      storage_path: path,
      file_name: `image.${ext}`,
      mime_type: mimeType || "image/jpeg",
    });
    if (attachError) {
      Alert.alert("Attachment save failed", attachError.message);
      return;
    }
    setActionMessage("Image attached to visit.");
    Alert.alert("Uploaded", "Image saved to visit.");
  }

  async function onCancelOwnerAppointment(appointmentId: string) {
    if (!membership?.clinic_id) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId)
      .eq("clinic_id", membership.clinic_id);
    if (error) {
      Alert.alert("Cancel failed", error.message);
      return;
    }
    setActionMessage("Appointment cancelled.");
    await loadData();
  }

  async function onRequestOwnerAppointmentTimeChange(appointmentId: string, startsAtIso: string, notes?: string) {
    if (!membership?.clinic_id) return;
    const { error } = await supabase.rpc("request_appointment_time_change", {
      p_appointment_id: appointmentId,
      p_requested_starts_at: startsAtIso,
      p_notes: notes ?? null,
    });
    if (error) {
      Alert.alert("Request failed", error.message);
      return;
    }
    setActionMessage("Time change request sent to the clinic.");
    Alert.alert("Request sent", "Reception will review your preferred time and confirm.");
    await loadData();
  }

  async function onApproveTimeChangeRequest(requestId: string) {
    const { error } = await supabase.rpc("approve_appointment_time_change_request", {
      p_request_id: requestId,
    });
    if (error) {
      Alert.alert("Could not approve", error.message);
      return;
    }
    setActionMessage("Appointment time updated.");
    await loadData();
  }

  async function onAddPet(input: {
    name: string;
    species: string;
    breed?: string;
    allergies?: string;
    gender?: string | null;
    ageMonths?: number | null;
  }) {
    if (!membership?.clinic_id) return;
    if (!input.name.trim()) {
      Alert.alert("Name required", "Enter your pet’s name.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Session expired", "Sign in again.");
      return;
    }
    let oid = ownerId;
    if (!oid) {
      const { ownerId: ensured, error: oErr } = await ensurePetOwnerRow(supabase, membership.clinic_id, user);
      if (oErr || !ensured) {
        Alert.alert("Could not create owner profile", oErr?.message ?? "Try again or contact the clinic.");
        return;
      }
      oid = ensured;
      setOwnerId(oid);
    }
    const { error } = await supabase.from("pets").insert({
      clinic_id: membership.clinic_id,
      owner_id: oid,
      name: input.name.trim(),
      species: (input.species || "unknown").trim(),
      breed: input.breed?.trim() || null,
      gender: input.gender?.trim() || null,
      age_months: input.ageMonths != null && Number.isFinite(input.ageMonths) ? Math.round(input.ageMonths) : null,
      allergies: input.allergies?.trim() || null,
    });
    if (error) {
      Alert.alert("Could not add pet", error.message);
      return;
    }
    setActionMessage("Pet profile added.");
    await loadData();
  }

  async function onUploadPetPhoto(petId: string, uri: string, mimeType?: string, base64?: string | null) {
    if (!membership?.clinic_id) return;
    let fileData: ArrayBuffer;
    try {
      if (base64) {
        fileData = base64ToBytes(base64).buffer;
      } else {
        const response = await fetch(uri);
        fileData = await response.arrayBuffer();
      }
    } catch (_e) {
      Alert.alert("Image read failed", "Unable to read selected image. Try again.");
      return;
    }
    const ext = mimeType?.includes("png") ? "png" : "jpg";
    const path = `${membership.clinic_id}/pets/${petId}/${Date.now()}-avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from("medical-files").upload(path, fileData, {
      contentType: mimeType || "image/jpeg",
    });
    if (uploadError) {
      Alert.alert("Upload failed", uploadError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("pets")
      .update({ photo_url: path })
      .eq("id", petId)
      .eq("clinic_id", membership.clinic_id);
    if (updateError) {
      Alert.alert("Save failed", updateError.message);
      return;
    }
    setActionMessage("Pet photo updated.");
    await loadData();
  }

  async function onUpdatePet(
    petId: string,
    patch: Partial<Pick<Pet, "name" | "species" | "breed" | "gender" | "age_months" | "allergies">>
  ) {
    if (!membership?.clinic_id) return;
    const { error } = await supabase.from("pets").update(patch).eq("id", petId).eq("clinic_id", membership.clinic_id);
    if (error) {
      Alert.alert("Update failed", error.message);
      return;
    }
    setActionMessage("Pet updated.");
    await loadData();
  }

  async function onAssignDoctor(appointmentId: string, staffId: string | null) {
    if (!membership?.clinic_id) return;
    const { error } = await supabase
      .from("appointments")
      .update({ doctor_id: staffId })
      .eq("id", appointmentId)
      .eq("clinic_id", membership.clinic_id);
    if (error) {
      Alert.alert("Assign failed", error.message);
      return;
    }
    setActionMessage("Doctor updated.");
    await loadData();
  }

  async function onWalkIn(input: {
    ownerName: string;
    phone: string;
    email: string;
    petName: string;
    species: string;
    branchId: string;
  }) {
    if (!membership?.clinic_id) return;
    if (!input.branchId) {
      Alert.alert("Branch required", "Select a branch for this walk-in.");
      return;
    }
    const rawName = input.ownerName.trim();
    const nameParts = rawName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? "Guest";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Walk-in";
    const fullName =
      rawName.length > 0 ? rawName : `${firstName} ${lastName}`;

    const { data: ownerRow, error: oErr } = await supabase
      .from("owners")
      .insert({
        clinic_id: membership.clinic_id,
        user_id: null,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        phone: input.phone,
        email: input.email ? input.email.trim().toLowerCase() : null,
        contact_type: "customer",
        contact_notes: "Walk-in (mobile front desk) — no portal account yet.",
      })
      .select("id")
      .single();
    if (oErr || !ownerRow) {
      Alert.alert("Owner create failed", oErr?.message ?? "Unknown error");
      return;
    }
    const { data: petRow, error: pErr } = await supabase
      .from("pets")
      .insert({
        clinic_id: membership.clinic_id,
        owner_id: ownerRow.id,
        name: input.petName,
        species: input.species,
        primary_branch_id: input.branchId,
      })
      .select("id")
      .single();
    if (pErr || !petRow) {
      Alert.alert("Pet create failed", pErr?.message ?? "Unknown error");
      return;
    }
    const { error: aErr } = await supabase.from("appointments").insert({
      clinic_id: membership.clinic_id,
      branch_id: input.branchId,
      pet_id: petRow.id,
      owner_id: ownerRow.id,
      appointment_type: "consultation",
      status: "scheduled",
      starts_at: new Date().toISOString(),
      notes: "Walk-in from mobile front desk",
    });
    if (aErr) {
      Alert.alert("Appointment failed", aErr.message);
      return;
    }
    setActionMessage("Walk-in registered.");
    Alert.alert("Walk-in", "Guest and pet created. Appointment queued.");
    await loadData();
  }

  const visitsByPet = useMemo(() => {
    return visitSummaries.reduce<Record<string, VisitSummary[]>>((acc, v) => {
      if (!acc[v.pet_id]) acc[v.pet_id] = [];
      acc[v.pet_id].push(v);
      return acc;
    }, {});
  }, [visitSummaries]);

  const role = membership?.role?.toLowerCase();

  return (
    <View style={styles.page}>
      <AppAmbientBackground />
      <View style={[styles.topInset, { paddingTop: Math.max(insets.top, 4) }]}>
        <View style={styles.headerRowMinimal}>
          <View style={styles.brandHeaderRow}>
            {platformBranding?.logo_url ? (
              <Image source={{ uri: platformBranding.logo_url }} style={styles.headerLogo} resizeMode="contain" />
            ) : null}
            <Text style={styles.headerBrandName} numberOfLines={1}>
              {platformBranding?.product_name ?? "GreenCoatVets"}
            </Text>
          </View>
          <Pressable
            style={styles.profileTrigger}
            onPress={() => setProfileOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open profile menu"
          >
            {platformBranding?.logo_url ? (
              <Image source={{ uri: platformBranding.logo_url }} style={styles.profileTriggerImage} resizeMode="cover" />
            ) : (
              <MaterialIcons name="person" size={22} color={theme.primary} />
            )}
          </Pressable>
        </View>
        {actionMessage ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{actionMessage}</Text>
          </View>
        ) : null}
      </View>

      <ProfileMenuSheet
        visible={profileOpen}
        topInset={insets.top}
        branding={platformBranding}
        roleLabel={membership?.role ?? "guest"}
        clinicMeta={membership?.clinic_id ? `Clinic ${membership.clinic_id.slice(0, 8)}…` : "Platform"}
        userEmail={userEmail}
        onClose={() => setProfileOpen(false)}
        onSignOut={onSignOut}
      />

      <Modal visible={announcementPopup != null} transparent animationType="fade" onRequestClose={dismissAnnouncementPopup}>
        <View style={styles.announcementModalRoot}>
          <Pressable style={styles.profileModalBackdrop} onPress={dismissAnnouncementPopup} />
          <View style={styles.announcementCard}>
            <Text style={styles.announcementOverline}>Announcement</Text>
            <Text style={styles.announcementTitle}>{announcementPopup?.title ?? ""}</Text>
            <Text style={styles.announcementTime}>
              {announcementPopup?.created_at
                ? new Date(announcementPopup.created_at).toLocaleString()
                : ""}
            </Text>
            <ScrollView style={styles.announcementScroll} contentContainerStyle={{ paddingBottom: 8 }}>
              <Text style={styles.announcementBody}>{announcementPopup?.message ?? ""}</Text>
            </ScrollView>
            <Pressable style={styles.announcementOk} onPress={dismissAnnouncementPopup}>
              <Text style={styles.announcementOkText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {loading ? (
        <View style={styles.center}>
          <PawCircularLoader size={88} message="Loading your workspace…" />
        </View>
      ) : membership?.role === "marketing_editor" ? (
        <View style={styles.center}>
          <WebOnlyMarketingEditorScreen onSignOut={onSignOut} />
        </View>
      ) : !membership ? (
        <View style={styles.center}>
          <Text style={styles.noAccessTitle}>No clinic access</Text>
          <Text style={styles.noAccessBody}>
            We could not link your account to the clinic yet. Tap try again — we will assign the clinic automatically when
            only one is configured.
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => void refreshData()}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <NavigationContainer
          theme={{
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              primary: theme.primary,
              background: "transparent",
              card: "transparent",
              text: theme.onSurface,
              border: theme.outlineVariant,
              notification: theme.primaryContainer,
            },
          }}
        >
          <Tab.Navigator
            tabBar={(tabProps) => <VetCareTabBar {...tabProps} />}
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: theme.primary,
              tabBarInactiveTintColor: theme.onSurfaceVariant,
              tabBarButton: (props) => <VetCareTabButton {...props} />,
              tabBarShowLabel: false,
              tabBarStyle: {
                backgroundColor: "transparent",
                borderTopWidth: 0,
                elevation: 0,
                shadowOpacity: 0,
              },
              tabBarIconStyle: { marginBottom: 0 },
            }}
          >
            {role === "pet_owner" ? (
              <>
                <Tab.Screen
                  name="Home"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
                  }}
                >
                  {(props) => (
                    <OwnerDashboardScreen
                      pets={pets}
                      appointments={appointments}
                      vaccinations={vaccinations}
                      prescriptions={prescriptions}
                      attachments={attachments}
                      visitReports={ownerVisitReports}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                      onGoBook={() => props.navigation.navigate("Book")}
                      onGoPets={() => props.navigation.navigate("Pets")}
                      onGoHealth={() => props.navigation.navigate("Health")}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Pets"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="pets" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <OwnerPetsScreen
                      pets={pets}
                      visitsByPet={visitsByPet}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                      onAddPet={onAddPet}
                      onUpdatePet={onUpdatePet}
                      onUploadPetPhoto={onUploadPetPhoto}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Book"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="event" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <OwnerBookingScreen
                      clinicId={membership.clinic_id ?? ""}
                      petOptions={pets.map((p) => ({
                        id: p.id,
                        name: p.name,
                        photo_url: p.photo_url,
                        gender: p.gender,
                        age_months: p.age_months,
                      }))}
                      branchOptions={branches}
                      bookingDoctors={bookingDoctors}
                      appointments={appointments}
                      ownerFullName={ownerFullName}
                      ownerNeedsName={
                        !ownerFullName?.trim() || ownerFullName.trim().length < 2
                      }
                      ownerPhone={ownerPhone}
                      ownerEmail={ownerEmail}
                      onCreate={onCreateOwnerAppointment}
                      onCancelAppointment={onCancelOwnerAppointment}
                      onRequestTimeChange={onRequestOwnerAppointmentTimeChange}
                      timeChangeRequests={ownerTimeChangeRequests}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Health"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="favorite-border" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <OwnerHealthScreen
                      prescriptions={prescriptions}
                      vaccinations={vaccinations}
                      attachments={attachments}
                      visitReports={ownerVisitReports}
                      onOpenAttachment={onOpenAttachment}
                      onOpenPrescriptionPdf={onOpenPrescriptionPdf}
                      onOpenVisitReport={onOpenVisitReport}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Reports"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="description" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <OwnerReportsScreen
                      reportsEnabled={ownerReportsEnabled}
                      visitSummaries={ownerVisitSummaries}
                      onOpenVisitReport={onOpenVisitReport}
                      onDownloadAll={onDownloadAllVisitReports}
                      downloadingAll={downloadingAllReports}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Inbox"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="inbox" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <OwnerInboxScreen
                      notifications={notifications}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                      onOpenVisitReport={onOpenVisitReport}
                    />
                  )}
                </Tab.Screen>
              </>
            ) : isRegularDoctorRole(role) ? (
              <>
                <Tab.Screen
                  name="Appointments"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="event" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership.clinic_id ? (
                      <DoctorNavigator
                        appointments={appointments}
                        clinicId={membership.clinic_id}
                        doctorStaffId={doctorStaffId}
                        queueDate={doctorQueueDate}
                        onQueueDateChange={(date) => {
                          setDoctorQueueDate(date);
                          void loadData(date);
                        }}
                        ensureVisitForAppointment={ensureVisitForAppointment}
                        onUploadVisitImage={onUploadVisitImage}
                        onUploadDocument={onUploadDocument}
                        onStatusChange={onStatusChange}
                        onGeneratePdf={onGenerateVisitPdf}
                        notifications={doctorNotifications}
                        medicineNames={doctorMedicineNames}
                        refreshing={refreshing}
                        onRefresh={refreshData}
                      />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Calendar"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="calendar-month" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership.clinic_id ? (
                      <StaffAppointmentsCalendarScreen
                        clinicId={membership.clinic_id}
                        doctorStaffId={doctorStaffId}
                        onStatusChange={onStatusChange}
                        onUploadDocument={onUploadDocument}
                        onGeneratePdf={onGenerateVisitPdf}
                        refreshing={refreshing}
                        onRefresh={refreshData}
                      />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Walk-in"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="person-add-alt-1" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <WalkInScreen
                      branches={branches}
                      onWalkIn={onWalkIn}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Profile"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="badge" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <StaffProfileScreen
                        clinicId={membership.clinic_id}
                        staffRole={role === "senior_doctor" ? "senior_doctor" : "doctor"}
                        onSaved={refreshData}
                      />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Invites"
                  options={{
                    tabBarLabel: "Walk-in QR",
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="qr-code-2" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <InviteQrMobileScreen clinicId={membership.clinic_id} membershipRole={role} />
                    ) : null
                  }
                </Tab.Screen>
              </>
            ) : isSeniorDoctorRole(role) ? (
              <>
                <Tab.Screen
                  name="Video"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="videocam" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <SeniorVideoCallsScreen clinicId={membership.clinic_id} refreshing={refreshing} onRefresh={refreshData} />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Consult"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="medical-services" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership.clinic_id ? (
                      <DoctorNavigator
                        appointments={appointments}
                        clinicId={membership.clinic_id}
                        doctorStaffId={doctorStaffId}
                        queueDate={doctorQueueDate}
                        onQueueDateChange={(date) => {
                          setDoctorQueueDate(date);
                          void loadData(date);
                        }}
                        ensureVisitForAppointment={ensureVisitForAppointment}
                        onUploadVisitImage={onUploadVisitImage}
                        onUploadDocument={onUploadDocument}
                        onStatusChange={onStatusChange}
                        onGeneratePdf={onGenerateVisitPdf}
                        notifications={doctorNotifications}
                        medicineNames={doctorMedicineNames}
                        refreshing={refreshing}
                        onRefresh={refreshData}
                      />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Calendar"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="calendar-month" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <StaffAppointmentsCalendarScreen
                        clinicId={membership.clinic_id}
                        doctorStaffId={doctorStaffId}
                        onStatusChange={onStatusChange}
                        onUploadDocument={onUploadDocument}
                        onGeneratePdf={onGenerateVisitPdf}
                        refreshing={refreshing}
                        onRefresh={refreshData}
                      />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Reception"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="meeting-room" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <ReceptionQueueScreen
                      appointments={appointments}
                      doctors={doctors}
                      branches={branches}
                      onStatusChange={onStatusChange}
                      onUploadDocument={onUploadDocument}
                      onOpenPrescriptionForAppointment={onOpenLatestPrescriptionForAppointment}
                      onAssignDoctor={onAssignDoctor}
                      onWalkIn={onWalkIn}
                      pendingTimeChangeRequests={pendingTimeChangeRequests}
                      onApproveTimeChangeRequest={onApproveTimeChangeRequest}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Patients"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="groups" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <AdminPatientsScreen clinicId={membership.clinic_id} refreshing={refreshing} onRefresh={refreshData} />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Reports"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="picture-as-pdf" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <OwnerReportsScreen
                      reportsEnabled={clinicReportsEnabled}
                      visitSummaries={adminVisitSummaries}
                      onOpenVisitReport={onOpenVisitReport}
                      onDownloadAll={onDownloadAllAdminReports}
                      downloadingAll={downloadingAdminReports}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Rx"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="medication" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <ClinicPrescriptionsScreen
                      prescriptions={clinicRecentPrescriptions}
                      onOpenPrescriptionPdf={onOpenPrescriptionPdf}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Overview"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <AdminMobileStatsScreen
                      title="Senior veterinarian"
                      subtitle="Senior doctor · clinic overview"
                      stats={adminStats}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Profile"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="badge" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <StaffProfileScreen clinicId={membership.clinic_id} staffRole="senior_doctor" onSaved={refreshData} />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Invites"
                  options={{
                    tabBarLabel: "Walk-in QR",
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="qr-code-2" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <InviteQrMobileScreen clinicId={membership.clinic_id} membershipRole={role} />
                    ) : null
                  }
                </Tab.Screen>
              </>
            ) : role === "clinic_admin" || role === "branch_admin" || role === "super_admin" ? (
              <>
                <Tab.Screen
                  name={role === "super_admin" ? "Platform" : role === "clinic_admin" ? "Clinic" : "Branch"}
                  options={{
                    tabBarIcon: ({ color, size }) => (
                      <MaterialIcons
                        name={role === "super_admin" ? "admin-panel-settings" : "business"}
                        size={size}
                        color={color}
                      />
                    ),
                  }}
                >
                  {() => (
                    <AdminMobileStatsScreen
                      title={
                        role === "super_admin"
                          ? "Platform administration"
                          : role === "clinic_admin"
                            ? "Clinic administration"
                            : "Branch administration"
                      }
                      subtitle={
                        role === "super_admin"
                          ? "Super admin · full mobile access"
                          : role === "clinic_admin"
                            ? "Clinic admin · mobile"
                            : "Branch admin · mobile"
                      }
                      stats={adminStats}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Patients"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="groups" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <AdminPatientsScreen clinicId={membership.clinic_id} refreshing={refreshing} onRefresh={refreshData} />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Calendar"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="calendar-month" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <StaffAppointmentsCalendarScreen
                        clinicId={membership.clinic_id}
                        doctorStaffId={doctorStaffId}
                        onStatusChange={onStatusChange}
                        onUploadDocument={onUploadDocument}
                        onGeneratePdf={onGenerateVisitPdf}
                        refreshing={refreshing}
                        onRefresh={refreshData}
                      />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Reports"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="picture-as-pdf" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <OwnerReportsScreen
                      reportsEnabled={clinicReportsEnabled}
                      visitSummaries={adminVisitSummaries}
                      onOpenVisitReport={onOpenVisitReport}
                      onDownloadAll={onDownloadAllAdminReports}
                      downloadingAll={downloadingAdminReports}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Reception"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="meeting-room" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <ReceptionQueueScreen
                      appointments={appointments}
                      doctors={doctors}
                      branches={branches}
                      onStatusChange={onStatusChange}
                      onUploadDocument={onUploadDocument}
                      onOpenPrescriptionForAppointment={onOpenLatestPrescriptionForAppointment}
                      onAssignDoctor={onAssignDoctor}
                      onWalkIn={onWalkIn}
                      pendingTimeChangeRequests={pendingTimeChangeRequests}
                      onApproveTimeChangeRequest={onApproveTimeChangeRequest}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Rx"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="medication" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <ClinicPrescriptionsScreen
                      prescriptions={clinicRecentPrescriptions}
                      onOpenPrescriptionPdf={onOpenPrescriptionPdf}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Consult"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="medical-services" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership.clinic_id ? (
                      <DoctorNavigator
                        appointments={appointments}
                        clinicId={membership.clinic_id}
                        doctorStaffId={doctorStaffId}
                        queueDate={doctorQueueDate}
                        onQueueDateChange={(date) => {
                          setDoctorQueueDate(date);
                          void loadData(date);
                        }}
                        ensureVisitForAppointment={ensureVisitForAppointment}
                        onUploadVisitImage={onUploadVisitImage}
                        onUploadDocument={onUploadDocument}
                        onStatusChange={onStatusChange}
                        onGeneratePdf={onGenerateVisitPdf}
                        notifications={doctorNotifications}
                        medicineNames={doctorMedicineNames}
                        refreshing={refreshing}
                        onRefresh={refreshData}
                      />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Invites"
                  options={{
                    tabBarLabel: "Walk-in QR",
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="qr-code-2" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <InviteQrMobileScreen clinicId={membership.clinic_id} membershipRole={role} />
                    ) : null
                  }
                </Tab.Screen>
              </>
            ) : role === "lab_technician" || role === "pharmacist" ? (
              <>
                <Tab.Screen
                  name={role === "lab_technician" ? "Lab" : "Pharmacy"}
                  options={{
                    tabBarIcon: ({ color, size }) => (
                      <MaterialIcons name={role === "lab_technician" ? "science" : "local-pharmacy"} size={size} color={color} />
                    ),
                  }}
                >
                  {() => (
                    <LabPharmacyHubScreen
                      role={role === "lab_technician" ? "lab_technician" : "pharmacist"}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Profile"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="badge" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <StaffProfileScreen
                        clinicId={membership.clinic_id}
                        staffRole={role === "lab_technician" ? "lab_technician" : "pharmacist"}
                        onSaved={refreshData}
                      />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Today"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="today" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <ReceptionistScreen
                      appointments={appointments}
                      onStatusChange={onStatusChange}
                      onUploadDocument={onUploadDocument}
                      onOpenPrescriptionForAppointment={onOpenLatestPrescriptionForAppointment}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                      screenTitle={role === "lab_technician" ? "Lab queue" : "Pharmacy queue"}
                      screenHint={
                        role === "lab_technician"
                          ? "Today’s visits and samples — coordinate with reception and doctors."
                          : "Today’s prescriptions and pickups — coordinate with reception."
                      }
                    />
                  )}
                </Tab.Screen>
              </>
            ) : role === "receptionist" ? (
              <>
                <Tab.Screen
                  name="Reception"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="meeting-room" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <ReceptionQueueScreen
                      appointments={appointments}
                      doctors={doctors}
                      branches={branches}
                      onStatusChange={onStatusChange}
                      onUploadDocument={onUploadDocument}
                      onOpenPrescriptionForAppointment={onOpenLatestPrescriptionForAppointment}
                      onAssignDoctor={onAssignDoctor}
                      onWalkIn={onWalkIn}
                      pendingTimeChangeRequests={pendingTimeChangeRequests}
                      onApproveTimeChangeRequest={onApproveTimeChangeRequest}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Invites"
                  options={{
                    tabBarLabel: "Walk-in QR",
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="qr-code-2" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <InviteQrMobileScreen clinicId={membership.clinic_id} membershipRole={role} />
                    ) : null
                  }
                </Tab.Screen>
              </>
            ) : (
              <Tab.Screen
                name="Reception"
                options={{
                  tabBarIcon: ({ color, size }) => <MaterialIcons name="meeting-room" size={size} color={color} />,
                }}
              >
                {() => (
                  <ReceptionQueueScreen
                    appointments={appointments}
                    doctors={doctors}
                    branches={branches}
                    onStatusChange={onStatusChange}
                    onUploadDocument={onUploadDocument}
                    onOpenPrescriptionForAppointment={onOpenLatestPrescriptionForAppointment}
                    onAssignDoctor={onAssignDoctor}
                    onWalkIn={onWalkIn}
                    pendingTimeChangeRequests={pendingTimeChangeRequests}
                    onApproveTimeChangeRequest={onApproveTimeChangeRequest}
                    refreshing={refreshing}
                    onRefresh={refreshData}
                  />
                )}
              </Tab.Screen>
            )}
          </Tab.Navigator>
        </NavigationContainer>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  /** No horizontal padding here — tab bar must be full-bleed; use topInset for header only. */
  page: { flex: 1, backgroundColor: "transparent" },
  topInset: { paddingHorizontal: 16, paddingTop: 8, zIndex: 2 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "transparent" },
  headerRowMinimal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    minHeight: 44,
  },
  brandHeaderRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 12,
    minWidth: 0,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  headerBrandName: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "800",
    color: theme.primary,
    letterSpacing: -0.3,
  },
  profileTrigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceBright,
    borderWidth: 2,
    borderColor: theme.primary,
    overflow: "hidden",
    ...shadows.card,
  },
  profileTriggerImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileModalRoot: { flex: 1 },
  profileModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 25, 22, 0.45)",
  },
  profileMenu: {
    position: "absolute",
    right: 16,
    width: 288,
    borderRadius: 18,
    backgroundColor: theme.surfaceContainerLow,
    paddingBottom: 12,
    paddingHorizontal: 18,
    paddingTop: 0,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}aa`,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  profileMenuAccent: {
    height: 5,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    marginHorizontal: -18,
    marginBottom: 14,
  },
  profileBrandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  profileMenuLogo: { width: 40, height: 40, borderRadius: 10 },
  profileBrand: { flex: 1, fontSize: 20, fontWeight: "800", color: theme.onSurface, letterSpacing: -0.3 },
  profileRoleLabel: { marginTop: 10, fontSize: 11, fontWeight: "700", color: theme.outline, textTransform: "uppercase", letterSpacing: 1 },
  profileRole: { marginTop: 4, fontSize: 17, fontWeight: "800", color: theme.primary, textTransform: "capitalize" },
  profileMeta: { marginTop: 8, fontSize: 12, color: theme.onSurfaceVariant, fontWeight: "500" },
  profileSignOut: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  profileSignOutText: { color: theme.onPrimary, fontWeight: "800", fontSize: 15 },
  profileClose: { marginTop: 10, paddingVertical: 8, alignItems: "center" },
  profileCloseText: { color: theme.onSurfaceVariant, fontWeight: "700", fontSize: 14 },
  banner: {
    backgroundColor: `${theme.primaryFixedDim}44`,
    borderWidth: 1,
    borderColor: `${theme.primary}33`,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  bannerText: {
    color: theme.onPrimaryContainer,
    fontWeight: "600",
    fontSize: 14,
  },
  noAccessTitle: { fontSize: 18, fontWeight: "800", color: theme.onSurface, marginBottom: 8, textAlign: "center" },
  noAccessBody: { fontSize: 14, color: theme.onSurfaceVariant, textAlign: "center", paddingHorizontal: 24, lineHeight: 20 },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.primary,
  },
  retryBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 15 },
  announcementModalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  announcementCard: {
    backgroundColor: theme.surfaceContainerLow,
    borderRadius: 20,
    padding: 20,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}aa`,
    ...shadows.card,
  },
  announcementOverline: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  announcementTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "800",
    color: theme.onSurface,
    letterSpacing: -0.3,
  },
  announcementTime: {
    marginTop: 6,
    fontSize: 12,
    color: theme.onSurfaceVariant,
    fontWeight: "600",
  },
  announcementScroll: {
    marginTop: 12,
    maxHeight: 280,
  },
  announcementBody: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.onSurface,
    fontWeight: "500",
  },
  announcementOk: {
    marginTop: 16,
    alignSelf: "stretch",
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  announcementOkText: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
});
