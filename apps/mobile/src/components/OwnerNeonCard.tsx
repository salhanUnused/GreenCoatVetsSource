import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme/theme";

export function OwnerNeonCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.shell, style]}>
      <LinearGradient
        colors={[`${theme.primary}55`, `${theme.primaryContainer}33`, `${theme.primary}44`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glowRing}
      />
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 16,
    padding: 1.5,
    shadowColor: theme.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    opacity: 0.9,
  },
  inner: {
    borderRadius: 14.5,
    padding: 16,
    backgroundColor: theme.surfaceContainerLow,
    borderWidth: 1,
    borderColor: `${theme.primary}28`,
  },
});
