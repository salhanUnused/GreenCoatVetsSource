import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { theme } from "../theme/theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Local-time YYYY-MM-DD key (avoids UTC offset shifting the day). */
export function localDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AppointmentMonthCalendar({
  month,
  onMonthChange,
  selectedDay,
  onSelectDay,
  countsByDay,
}: {
  month: Date;
  onMonthChange: (next: Date) => void;
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  countsByDay: Record<string, number>;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = startOfMonth(month);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, monthIndex, d));

  function shiftMonth(delta: number) {
    const next = new Date(month);
    next.setMonth(next.getMonth() + delta);
    onMonthChange(startOfMonth(next));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.navBtn}>
          <MaterialIcons name="chevron-left" size={24} color={theme.primary} />
        </Pressable>
        <Text style={styles.title}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
        <Pressable onPress={() => shiftMonth(1)} style={styles.navBtn}>
          <MaterialIcons name="chevron-right" size={24} color={theme.primary} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekLabel}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={`empty-${idx}`} style={styles.cell} />;
          const key = localDayKey(day);
          const count = countsByDay[key] ?? 0;
          const selected = sameDay(day, selectedDay);
          const today = sameDay(day, new Date());
          return (
            <Pressable key={key} style={[styles.cell, selected && styles.cellSelected]} onPress={() => onSelectDay(day)}>
              <Text style={[styles.dayNum, today && styles.dayToday, selected && styles.daySelected]}>{day.getDate()}</Text>
              {count > 0 ? (
                <View style={styles.dot}>
                  <Text style={styles.dotText}>{count > 9 ? "9+" : count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  navBtn: { padding: 6 },
  title: { fontSize: 17, fontWeight: "800", color: theme.onSurface },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", color: theme.onSurfaceVariant },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    padding: 2,
  },
  cellSelected: { backgroundColor: `${theme.primary}18` },
  dayNum: { fontSize: 14, fontWeight: "700", color: theme.onSurface },
  dayToday: { color: theme.primary },
  daySelected: { color: theme.primary, fontWeight: "900" },
  dot: {
    marginTop: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  dotText: { fontSize: 9, fontWeight: "800", color: theme.onPrimary },
});
