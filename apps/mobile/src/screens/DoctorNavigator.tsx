import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DoctorStackParamList } from "../navigation/types";
import { StaffAppointmentsCalendarScreen } from "./staff/StaffAppointmentsCalendarScreen";
import { DoctorConsultScreen } from "./DoctorConsultScreen";
import { Appointment, DoctorNotification } from "../types/app";
import { theme } from "../theme/theme";

const Stack = createNativeStackNavigator<DoctorStackParamList>();

function CalendarEntry({
  clinicId,
  doctorStaffId,
  onStatusChange,
  onUploadDocument,
  onGeneratePdf,
  refreshing,
  onRefresh,
}: {
  clinicId: string;
  doctorStaffId: string | null;
  onStatusChange: (appointmentId: string, status: string) => Promise<void>;
  onUploadDocument: (appointmentId: string) => Promise<void>;
  onGeneratePdf?: (appointmentId: string) => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<DoctorStackParamList>>();
  return (
    <StaffAppointmentsCalendarScreen
      clinicId={clinicId}
      doctorStaffId={doctorStaffId}
      onStatusChange={onStatusChange}
      onUploadDocument={onUploadDocument}
      onGeneratePdf={onGeneratePdf}
      onOpenConsult={(appointmentId) => navigation.navigate("Consult", { appointmentId })}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

export function DoctorNavigator({
  clinicId,
  doctorStaffId,
  ensureVisitForAppointment,
  onUploadVisitImage,
  onUploadDocument,
  onStatusChange,
  onGeneratePdf,
  medicineNames,
  refreshing,
  onRefresh,
}: {
  appointments: Appointment[];
  clinicId: string;
  doctorStaffId: string | null;
  queueDate: Date;
  onQueueDateChange: (date: Date) => void;
  ensureVisitForAppointment: (appointmentId: string, complete?: boolean, checkIn?: boolean) => Promise<string | null>;
  onUploadVisitImage: (appointmentId: string, uri: string, mimeType?: string, base64?: string | null) => Promise<void>;
  onUploadDocument: (appointmentId: string) => Promise<void>;
  onStatusChange: (appointmentId: string, status: string) => Promise<void>;
  onGeneratePdf?: (appointmentId: string) => Promise<void>;
  notifications: DoctorNotification[];
  medicineNames: string[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTintColor: theme.primary,
        headerStyle: { backgroundColor: theme.surfaceContainerHigh },
        headerTitleStyle: { fontWeight: "800" },
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      <Stack.Screen name="Queue" options={{ title: "Calendar", headerShown: false }}>
        {() => (
          <CalendarEntry
            clinicId={clinicId}
            doctorStaffId={doctorStaffId}
            onStatusChange={onStatusChange}
            onUploadDocument={onUploadDocument}
            onGeneratePdf={onGeneratePdf}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Consult" options={{ title: "Consultation" }}>
        {() => (
          <DoctorConsultScreen
            clinicId={clinicId}
            doctorStaffId={doctorStaffId}
            ensureVisitForAppointment={ensureVisitForAppointment}
            onUploadVisitImage={onUploadVisitImage}
            onUploadDocument={onUploadDocument}
            onStatusChange={onStatusChange}
            medicineNames={medicineNames}
            onRefresh={onRefresh}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
