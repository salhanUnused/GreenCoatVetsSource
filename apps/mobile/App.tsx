import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { DEFAULT_PET_SPECIES_BOOKING_VALUE } from "@saasclinics/lib";
import { VetCareTabBar } from "./src/navigation/VetCareTabBar";
import { VetCareTabButton } from "./src/navigation/VetCareTabButton";
import { OwnerInboxScreen } from "./src/screens/OwnerInboxScreen";
import { OwnerHealthScreen } from "./src/screens/OwnerHealthScreen";
import { ReceptionistScreen } from "./src/screens/ReceptionistScreen";
import { OwnerBookingScreen } from "./src/screens/OwnerBookingScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { WebOnlySuperAdminScreen } from "./src/screens/WebOnlySuperAdminScreen";
import { DoctorNavigator } from "./src/screens/DoctorNavigator";
import { OwnerDashboardScreen } from "./src/screens/owner/OwnerDashboardScreen";
import { OwnerPetsScreen } from "./src/screens/owner/OwnerPetsScreen";
import { ReceptionDeskScreen } from "./src/screens/ReceptionDeskScreen";
import { AdminMobileStatsScreen } from "./src/screens/AdminMobileStatsScreen";
import { LabPharmacyHubScreen } from "./src/screens/LabPharmacyHubScreen";
import { InviteQrMobileScreen } from "./src/screens/InviteQrMobileScreen";
import { StaffProfileScreen } from "./src/screens/StaffProfileScreen";
import {
  AdminMobileStats,
  Appointment,
  DoctorNotification,
  Membership,
  Order,
  OwnerPrescription,
  OwnerVisitReport,
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
import { loadPlatformBranding, type PlatformBranding } from "./src/lib/platform-branding";
import { promptOpenOrSharePdf } from "./src/lib/open-or-share-document";
import { OwnerShopScreen } from "./src/screens/owner/OwnerShopScreen";

const Tab = createBottomTabNavigator();
const MOBILE_CONSENT_KEY = "saasclinics_mobile_data_consent_v1";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

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

  return (
    <SafeAreaProvider>
      {loading ? (
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
          <View style={styles.page}>
            <AppAmbientBackground />
            <View style={styles.center}>
              <PawCircularLoader size={88} message="Loading…" />
            </View>
          </View>
        </SafeAreaView>
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
      ) : (
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
          <StatusBar style="dark" />
          <MobileHome onSignOut={() => supabase.auth.signOut()} />
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}

function MobileHome({ onSignOut }: { onSignOut: () => void }) {
  const insets = useSafeAreaInsets();
  const [profileOpen, setProfileOpen] = useState(false);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [prescriptions, setPrescriptions] = useState<OwnerPrescription[]>([]);
  const [ownerVisitReports, setOwnerVisitReports] = useState<OwnerVisitReport[]>([]);
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
  const [doctorStaffId, setDoctorStaffId] = useState<string | null>(null);
  const [doctorNotifications, setDoctorNotifications] = useState<DoctorNotification[]>([]);
  const [doctorMedicineNames, setDoctorMedicineNames] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<StaffDoctorOption[]>([]);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [visitSummaries, setVisitSummaries] = useState<VisitSummary[]>([]);
  const [adminStats, setAdminStats] = useState<AdminMobileStats | null>(null);
  const [clinicRecentOrders, setClinicRecentOrders] = useState<
    Array<{ id: string; status: string; grand_total: number | null; placed_at: string | null }>
  >([]);
  const [clinicRecentPrescriptions, setClinicRecentPrescriptions] = useState<
    Array<{ id: string; issued_at: string; notes: string | null; pdf_url: string | null; pets?: { name?: string | null } | null }>
  >([]);
  const [platformBranding, setPlatformBranding] = useState<PlatformBranding | null>(null);
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

  async function loadData() {
    setLoading(true);
    setClinicRecentOrders([]);
    setClinicRecentPrescriptions([]);
    setMembership(null);
    setDoctorStaffId(null);
    setDoctorNotifications([]);
    setDoctorMedicineNames([]);
    setDoctors([]);
    setProducts([]);
    setVisitSummaries([]);
    setAdminStats(null);
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

    if (platformAdmin) {
      setMembership({ role: "super_admin", clinic_id: null });
      setLoading(false);
      return;
    }

    let { data: membershipData } = await supabase
      .from("user_clinic_memberships")
      .select("clinic_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          membershipData = retry.data;
        }
      }
    }

    if (!membershipData) {
      setLoading(false);
      return;
    }
    setMembership(membershipData);
    const { data: branchData } = await supabase
      .from("branches")
      .select("id, name")
      .eq("clinic_id", membershipData.clinic_id)
      .eq("is_active", true)
      .order("name", { ascending: true });
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
        ] = await Promise.all([
          supabase
            .from("pets")
            .select("id, name, species, breed, gender, age_months, date_of_birth, allergies, photo_url")
            .eq("clinic_id", membershipData.clinic_id)
            .eq("owner_id", resolvedOwnerId)
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
            .select("id, title, message, channel, created_at, read_at")
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
            .select("phone, email")
            .eq("id", resolvedOwnerId)
            .maybeSingle(),
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
          }>) ?? []
        );
        setOwnerTimeChangeRequests(
          (ownerAtcrData as Array<{ appointment_id: string; requested_starts_at: string; status: string }> | null) ?? [],
        );
        setOwnerPhone((ownerContactData as { phone?: string | null } | null)?.phone ?? null);
        setOwnerEmail((ownerContactData as { email?: string | null } | null)?.email ?? null);
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
      } else {
        setOwnerTimeChangeRequests([]);
      }
    } else if (role === "doctor") {
      const { data: doctor } = await supabase
        .from("staff_profiles")
        .select("id")
        .eq("clinic_id", membershipData.clinic_id)
        .eq("user_id", user.id)
        .eq("role", "doctor")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      setDoctorStaffId(doctor?.id ?? null);
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
      const [{ data: appointmentsData }, { data: notifData }, { data: medsData }] = await Promise.all([
        supabase
          .from("appointments")
          .select(appointmentSelect)
          .eq("clinic_id", membershipData.clinic_id)
          .eq("doctor_id", doctor?.id ?? "00000000-0000-0000-0000-000000000000")
          .gte("starts_at", dayStart.toISOString())
          .lte("starts_at", dayEnd.toISOString())
          .order("starts_at", { ascending: true })
          .limit(80),
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
        .eq("role", "doctor")
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      setDoctors((doctorList as StaffDoctorOption[]) ?? []);

      const today = new Date().toISOString().slice(0, 10);
      const [{ data: appointmentsData }, { data: ordersClinic }, { data: rxClinic }, { data: pendingAtcr }] = await Promise.all([
        supabase
          .from("appointments")
          .select(appointmentSelect)
          .eq("clinic_id", membershipData.clinic_id)
          .gte("starts_at", `${today}T00:00:00`)
          .lt("starts_at", `${today}T23:59:59`)
          .order("starts_at", { ascending: true })
          .limit(120),
        supabase
          .from("orders")
          .select("id, status, grand_total, placed_at")
          .eq("clinic_id", membershipData.clinic_id)
          .order("placed_at", { ascending: false })
          .limit(25),
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
      setClinicRecentOrders((ordersClinic as typeof clinicRecentOrders) ?? []);
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

      if (role === "clinic_admin" || role === "branch_admin") {
        const cid = membershipData.clinic_id;
        const { data: staffRows } = await supabase
          .from("staff_profiles")
          .select("id, role")
          .eq("clinic_id", cid)
          .eq("user_id", user.id)
          .eq("is_active", true);
        const preferredStaff =
          (staffRows ?? []).find((r: { role: string }) => r.role === "doctor") ?? (staffRows ?? [])[0];
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
        const [{ count: apptCount }, { data: ordersToday }, { data: invRows }] = await Promise.all([
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("clinic_id", cid)
            .gte("starts_at", dayStart.toISOString())
            .lte("starts_at", dayEnd.toISOString()),
          supabase
            .from("orders")
            .select("grand_total, status")
            .eq("clinic_id", cid)
            .gte("placed_at", dayStart.toISOString())
            .lte("placed_at", dayEnd.toISOString())
            .in("status", ["paid", "processing", "shipped", "delivered"]),
          supabase
            .from("inventory_items")
            .select("stock_quantity, reorder_level")
            .eq("clinic_id", cid)
            .eq("is_active", true)
            .limit(500),
        ]);
        const revenue = (ordersToday ?? []).reduce((sum, row) => sum + Number(row.grand_total ?? 0), 0);
        const lowStock = (invRows ?? []).filter((r) => r.stock_quantity <= r.reorder_level).length;
        setAdminStats({
          appointmentsToday: apptCount ?? 0,
          ordersRevenueToday: revenue,
          lowStockSkus: lowStock,
        });
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
    loadPlatformBranding().then((b) => {
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
    if (rl === "pet_owner" || rl === "super_admin") return;
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

  async function ensureVisitForAppointment(appointmentId: string, complete = false) {
    if (!membership?.clinic_id) return null;
    const { data: existing } = await supabase.from("visits").select("id").eq("appointment_id", appointmentId).limit(1).maybeSingle();
    if (existing?.id) return existing.id;

    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, branch_id, pet_id, owner_id, doctor_id")
      .eq("id", appointmentId)
      .eq("clinic_id", membership.clinic_id)
      .maybeSingle();
    if (!appointment) return null;

    const { data: created } = await supabase
      .from("visits")
      .insert({
        clinic_id: membership.clinic_id,
        branch_id: appointment.branch_id,
        appointment_id: appointment.id,
        pet_id: appointment.pet_id,
        owner_id: appointment.owner_id,
        doctor_id: appointment.doctor_id,
        started_at: new Date().toISOString(),
        completed_at: complete ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    return created?.id ?? null;
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
    startsAt: string;
    notes: string;
    chiefComplaint?: string;
    allergies?: string;
    currentMedications?: string;
    contactPhone: string;
    contactEmail?: string;
  }) {
    if (!membership?.clinic_id) return;

    const appointmentTypes = ["consultation", "vaccination", "surgery", "grooming", "emergency"] as const;

    const branchId = input.branchId?.trim();
    const startsAtRaw = input.startsAt?.trim();
    const existingPetId = input.petId?.trim();
    const newPetName = input.newPetName?.trim();
    const newPetSpecies = input.newPetSpecies?.trim();
    const appointmentType = input.appointmentType?.trim();
    const notes = input.notes?.trim() ?? "";
    const chiefComplaint = input.chiefComplaint?.trim();
    const allergies = input.allergies?.trim();
    const currentMedications = input.currentMedications?.trim();
    const contactPhone = input.contactPhone?.trim();
    const contactEmail = (input.contactEmail?.trim() ?? "").toLowerCase() || null;

    if (!branchId || !startsAtRaw) {
      Alert.alert("Missing details", "Choose a branch and a date & time before booking.");
      return;
    }
    if (!existingPetId && !newPetName) {
      Alert.alert("Missing details", "Branch, pet and time are required.");
      return;
    }
    if (!appointmentType || !appointmentTypes.includes(appointmentType as (typeof appointmentTypes)[number])) {
      Alert.alert("Invalid appointment type", "Please choose a valid appointment type.");
      return;
    }
    if (!contactPhone) {
      Alert.alert("Contact phone required", "Add a phone number so the clinic can reach you.");
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
          species: newPetSpecies || DEFAULT_PET_SPECIES_BOOKING_VALUE,
          breed: input.newPetBreed?.trim() || null,
          gender: input.newPetGender?.trim() || null,
          age_months:
            input.newPetAgeMonths != null && Number.isFinite(input.newPetAgeMonths)
              ? Math.round(input.newPetAgeMonths)
              : null,
          is_active: true,
        })
        .select("id")
        .single();

      if (petError || !createdPet) {
        Alert.alert("Pet create failed", petError?.message ?? "Unknown error");
        return;
      }
      petId = createdPet.id;
    }

    const ownerIntake = {
      chief_complaint: chiefComplaint || null,
      allergies: allergies || null,
      current_medications: currentMedications || null,
      contact_phone: contactPhone || null,
      contact_email: contactEmail,
    };

    const { error } = await supabase.from("appointments").insert({
      clinic_id: membership.clinic_id,
      branch_id: branchId,
      doctor_id: null,
      pet_id: petId,
      owner_id: resolvedOwnerId,
      appointment_type: appointmentType as "consultation" | "vaccination" | "surgery" | "grooming" | "emergency",
      status: "scheduled",
      starts_at: new Date(startsAtRaw).toISOString(),
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
    setActionMessage("Appointment booked.");
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
            <LinearGradient
              colors={[`${theme.primary}22`, `${theme.primaryContainer}44`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileTriggerInner}
            >
              <MaterialIcons name="person" size={22} color={theme.primary} />
            </LinearGradient>
          </Pressable>
        </View>
        {actionMessage ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{actionMessage}</Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={profileOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileOpen(false)}
      >
        <View style={styles.profileModalRoot}>
          <Pressable style={styles.profileModalBackdrop} onPress={() => setProfileOpen(false)} />
          <View style={[styles.profileMenu, { top: insets.top + 48 }]}>
            <LinearGradient colors={[theme.primary, theme.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileMenuAccent} />
            <View style={styles.profileBrandRow}>
              {platformBranding?.logo_url ? (
                <Image source={{ uri: platformBranding.logo_url }} style={styles.profileMenuLogo} resizeMode="contain" />
              ) : null}
              <Text style={styles.profileBrand}>{platformBranding?.product_name ?? "GreenCoatVets"}</Text>
            </View>
            <Text style={styles.profileRoleLabel}>Signed in as</Text>
            <Text style={styles.profileRole}>
              {(membership?.role ?? "guest").replace(/_/g, " ")}
            </Text>
            <Text style={styles.profileMeta} numberOfLines={1}>
              {membership?.clinic_id ? `Clinic ${membership.clinic_id.slice(0, 8)}…` : "Platform / no clinic"}
            </Text>
            <Pressable
              style={styles.profileSignOut}
              onPress={() => {
                setProfileOpen(false);
                onSignOut();
              }}
            >
              <MaterialIcons name="logout" size={20} color={theme.onPrimary} />
              <Text style={styles.profileSignOutText}>Sign out</Text>
            </Pressable>
            <Pressable style={styles.profileClose} onPress={() => setProfileOpen(false)}>
              <Text style={styles.profileCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
      ) : !membership ? (
        <View style={styles.center}>
          <Text style={styles.noAccessTitle}>No clinic access</Text>
          <Text style={styles.noAccessBody}>Ask your administrator to invite you or assign a role in the dashboard.</Text>
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
              tabBarStyle: {
                backgroundColor: "transparent",
                borderTopWidth: 0,
                elevation: 0,
                shadowOpacity: 0,
              },
              tabBarLabelStyle: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
              tabBarIconStyle: { marginBottom: 0 },
            }}
          >
            {role === "super_admin" ? (
              <Tab.Screen
                name="Web"
                options={{
                  tabBarIcon: ({ color, size }) => <MaterialIcons name="language" size={size} color={color} />,
                }}
              >
                {() => <WebOnlySuperAdminScreen onSignOut={onSignOut} />}
              </Tab.Screen>
            ) : role === "pet_owner" ? (
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
                      petOptions={pets.map((p) => ({ id: p.id, name: p.name, photo_url: p.photo_url }))}
                      branchOptions={branches}
                      appointments={appointments}
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
                  name="Shop"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="shopping-bag" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <OwnerShopScreen
                      orders={orders}
                      products={products}
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
                    <OwnerInboxScreen notifications={notifications} refreshing={refreshing} onRefresh={refreshData} />
                  )}
                </Tab.Screen>
              </>
            ) : role === "doctor" ? (
              <>
                <Tab.Screen
                  name="Doctor"
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
                        ensureVisitForAppointment={ensureVisitForAppointment}
                        onUploadVisitImage={onUploadVisitImage}
                        onStatusChange={onStatusChange}
                        notifications={doctorNotifications}
                        medicineNames={doctorMedicineNames}
                        refreshing={refreshing}
                        onRefresh={refreshData}
                      />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Profile"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="badge" size={size} color={color} />,
                  }}
                >
                  {() =>
                    membership?.clinic_id ? (
                      <StaffProfileScreen clinicId={membership.clinic_id} staffRole="doctor" onSaved={refreshData} />
                    ) : null
                  }
                </Tab.Screen>
                <Tab.Screen
                  name="Invites"
                  options={{
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
            ) : role === "clinic_admin" || role === "branch_admin" ? (
              <>
                <Tab.Screen
                  name={role === "clinic_admin" ? "Clinic" : "Branch"}
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="business" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <AdminMobileStatsScreen
                      title={role === "clinic_admin" ? "Clinic administration" : "Branch administration"}
                      subtitle={role === "clinic_admin" ? "Clinic admin · mobile" : "Branch admin · mobile"}
                      stats={adminStats}
                      refreshing={refreshing}
                      onRefresh={refreshData}
                    />
                  )}
                </Tab.Screen>
                <Tab.Screen
                  name="Front desk"
                  options={{
                    tabBarIcon: ({ color, size }) => <MaterialIcons name="meeting-room" size={size} color={color} />,
                  }}
                >
                  {() => (
                    <ReceptionDeskScreen
                      appointments={appointments}
                      doctors={doctors}
                      branches={branches}
                      onStatusChange={onStatusChange}
                      onUploadDocument={onUploadDocument}
                      onOpenPrescriptionForAppointment={onOpenLatestPrescriptionForAppointment}
                      onAssignDoctor={onAssignDoctor}
                      onWalkIn={onWalkIn}
                      clinicRecentOrders={clinicRecentOrders}
                      clinicRecentPrescriptions={clinicRecentPrescriptions}
                      onOpenPrescriptionPdf={onOpenPrescriptionPdf}
                      pendingTimeChangeRequests={pendingTimeChangeRequests}
                      onApproveTimeChangeRequest={onApproveTimeChangeRequest}
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
                        ensureVisitForAppointment={ensureVisitForAppointment}
                        onUploadVisitImage={onUploadVisitImage}
                        onStatusChange={onStatusChange}
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
                    <ReceptionDeskScreen
                      appointments={appointments}
                      doctors={doctors}
                      branches={branches}
                      onStatusChange={onStatusChange}
                      onUploadDocument={onUploadDocument}
                      onOpenPrescriptionForAppointment={onOpenLatestPrescriptionForAppointment}
                      onAssignDoctor={onAssignDoctor}
                      onWalkIn={onWalkIn}
                      clinicRecentOrders={clinicRecentOrders}
                      clinicRecentPrescriptions={clinicRecentPrescriptions}
                      onOpenPrescriptionPdf={onOpenPrescriptionPdf}
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
                  <ReceptionDeskScreen
                    appointments={appointments}
                    doctors={doctors}
                    branches={branches}
                    onStatusChange={onStatusChange}
                    onUploadDocument={onUploadDocument}
                    onOpenPrescriptionForAppointment={onOpenLatestPrescriptionForAppointment}
                    onAssignDoctor={onAssignDoctor}
                    onWalkIn={onWalkIn}
                    clinicRecentOrders={clinicRecentOrders}
                    clinicRecentPrescriptions={clinicRecentPrescriptions}
                    onOpenPrescriptionPdf={onOpenPrescriptionPdf}
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
  profileTrigger: { borderRadius: 22, overflow: "hidden", ...shadows.card },
  profileTriggerInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}88`,
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
