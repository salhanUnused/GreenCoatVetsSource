import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { theme } from "../theme/theme";

export const APPOINTMENT_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "checked_in", label: "Checked in" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
] as const;

export function AppointmentStatusPicker({
  visible,
  currentStatus,
  onClose,
  onSelect,
}: {
  visible: boolean;
  currentStatus: string;
  onClose: () => void;
  onSelect: (status: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Change appointment status</Text>
          {APPOINTMENT_STATUSES.map((s) => {
            const active = currentStatus === s.value;
            return (
              <Pressable
                key={s.value}
                style={[styles.row, active && styles.rowOn]}
                onPress={() => {
                  onSelect(s.value);
                  onClose();
                }}
              >
                <Text style={[styles.rowText, active && styles.rowTextOn]}>{s.label}</Text>
                {active ? <MaterialIcons name="check" size={20} color={theme.primary} /> : null}
              </Pressable>
            );
          })}
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,16,14,0.45)" },
  card: {
    backgroundColor: theme.surfaceBright,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
  },
  title: { fontSize: 17, fontWeight: "800", color: theme.onSurface, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  rowOn: { backgroundColor: `${theme.primary}12` },
  rowText: { fontSize: 15, fontWeight: "600", color: theme.onSurface },
  rowTextOn: { color: theme.primary, fontWeight: "800" },
  cancelBtn: { marginTop: 10, alignItems: "center", paddingVertical: 10 },
  cancelText: { fontWeight: "700", color: theme.onSurfaceVariant },
});
