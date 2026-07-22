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
import { MaterialIcons, FontAwesome } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { theme, shadows } from "../theme/theme";
import { AppAmbientBackground } from "../components/AppAmbientBackground";
import { PawCircularLoader } from "../components/PawCircularLoader";
import { loadAppBranding, type AppBranding } from "../lib/app-branding";
import { mapAuthError } from "../lib/mapAuthError";
import { ensurePrimaryClinicMembership } from "../lib/ensure-clinic-membership";
import { forceAssignOnlyClinic } from "../lib/membership";
import { syncWebsiteAccountForMobile } from "../lib/owner-profile";
import { signInWithGoogle } from "../lib/google-auth";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<AppBranding | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAppBranding().then((b) => {
      if (!cancelled) setBranding(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function ensurePrimaryClinicCustomerLink(name?: string, phoneNumber?: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      try {
        await syncWebsiteAccountForMobile(supabase, user);
      } catch {
        /* continue to force-assign */
      }
    }
    try {
      await ensurePrimaryClinicMembership(name, phoneNumber);
    } catch {
      /* continue to force-assign */
    }
    try {
      await forceAssignOnlyClinic("pet_owner");
    } catch {
      /* loadData will retry */
    }
  }

  async function onGoogleAuth() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      await ensurePrimaryClinicCustomerLink();
    } catch (e) {
      setError(e instanceof Error ? mapAuthError(e.message) : "Google sign-in failed.");
    }
    setLoading(false);
  }

  async function onAuth() {
    setLoading(true);
    setError(null);
    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(mapAuthError(signInError.message));
      } else {
        await ensurePrimaryClinicCustomerLink();
      }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(mapAuthError(signUpError.message));
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(mapAuthError(signInError.message));
          setLoading(false);
          return;
        }

        await ensurePrimaryClinicCustomerLink(fullName, phone);
      }
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <AppAmbientBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.centerWrap}>
          <View style={styles.brandBlock}>
            {branding?.logo_url ? (
              <Image source={{ uri: branding.logo_url }} style={styles.logoImage} resizeMode="contain" />
            ) : (
              <View style={styles.logoIcon}>
                <MaterialIcons name="pets" size={34} color={theme.primary} />
              </View>
            )}
            <Text style={styles.brandTitle}>{branding?.product_name ?? "GreenCoatVets"}</Text>
            <Text style={styles.tagline}>Clinical operations, simplified.</Text>
            <Text style={styles.hint}>Already registered on greencoatvets.com? Use Continue with Google or log in with the same email.</Text>
          </View>

          <View style={styles.cardBlock}>
            {mode === "signup" ? (
              <>
                <View style={styles.signupFields}>
                  <Text style={styles.label}>Full name</Text>
                  <View style={styles.inputShell}>
                    <TextInput
                      style={styles.input}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="For your pet owner profile"
                      placeholderTextColor={theme.outline}
                    />
                    <MaterialIcons name="person-outline" size={22} color={theme.outline} style={styles.inputIcon} />
                  </View>
                  <Text style={styles.label}>Phone</Text>
                  <View style={styles.inputShell}>
                    <TextInput
                      style={styles.input}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="Optional"
                      placeholderTextColor={theme.outline}
                      keyboardType="phone-pad"
                    />
                    <MaterialIcons name="phone-android" size={22} color={theme.outline} style={styles.inputIcon} />
                  </View>
                </View>
              </>
            ) : null}

            <Text style={[styles.label, { marginTop: mode === "login" ? 8 : 4 }]}>Email address</Text>
            <View style={styles.inputShell}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@clinic.com"
                placeholderTextColor={theme.outline}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <MaterialIcons name="mail-outline" size={22} color={theme.outline} style={styles.inputIcon} />
            </View>

            <View style={styles.passwordRow}>
              <Text style={styles.label}>Password</Text>
              <Pressable
                onPress={() =>
                  Alert.alert("Password reset", "Use “Forgot password” on the web app or contact your clinic admin.")
                }
                hitSlop={8}
              >
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </Pressable>
            </View>
            <View style={styles.inputShell}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={theme.outline}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={styles.eyeToggle}
                onPress={() => setPasswordVisible((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                hitSlop={8}
              >
                <MaterialIcons
                  name={passwordVisible ? "visibility-off" : "visibility"}
                  size={22}
                  color={theme.outline}
                />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={18} color={theme.onErrorContainer} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable onPress={onAuth} disabled={loading} style={({ pressed }) => [{ opacity: pressed || loading ? 0.88 : 1 }]}>
              <LinearGradient
                colors={[theme.gradientStart, theme.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}
              >
                {loading ? (
                  <PawCircularLoader size={34} style={{ gap: 0 }} />
                ) : (
                  <>
                    <Text style={styles.ctaText}>{mode === "login" ? "Log in" : "Create account"}</Text>
                    <MaterialIcons name="arrow-forward" size={22} color={theme.onPrimary} />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={onGoogleAuth}
              disabled={loading}
              style={({ pressed }) => [styles.googleBtn, { opacity: pressed || loading ? 0.88 : 1 }]}
            >
              <FontAwesome name="google" size={20} color="#4285F4" />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </Pressable>

          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {mode === "login" ? "New to the practice? " : "Already registered? "}
              <Text
                style={styles.footerLink}
                onPress={() => {
                  setMode((m) => {
                    return m === "login" ? "signup" : "login";
                  });
                  setError(null);
                }}
              >
                {mode === "login" ? "Create account" : "Sign in"}
              </Text>
            </Text>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "transparent" },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
    justifyContent: "center",
  },
  centerWrap: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  brandBlock: {
    marginBottom: 18,
    alignItems: "center",
  },
  logoIcon: {
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 72,
    height: 72,
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: theme.primary,
    letterSpacing: 0.2,
  },
  tagline: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "500",
    color: theme.onSurfaceVariant,
    textAlign: "center",
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: theme.onSurfaceVariant,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  cardBlock: {
    gap: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}cc`,
    backgroundColor: "#ffffffee",
    padding: 14,
  },
  signupFields: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.onSurfaceVariant,
    marginLeft: 2,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  passwordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.primary,
  },
  inputShell: {
    position: "relative",
    borderRadius: 6,
    backgroundColor: theme.surfaceBright,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}b3`,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingRight: 48,
    fontSize: 15,
    color: theme.onSurface,
    borderRadius: 6,
  },
  inputIcon: {
    position: "absolute",
    right: 14,
    top: "50%",
    marginTop: -11,
  },
  eyeToggle: {
    position: "absolute",
    right: 10,
    top: "50%",
    marginTop: -16,
    padding: 6,
    borderRadius: 10,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: theme.errorContainer,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: `${theme.error}33`,
  },
  errorText: {
    flex: 1,
    color: theme.onErrorContainer,
    fontSize: 14,
    fontWeight: "500",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 6,
    marginTop: 4,
    ...shadows.fab,
  },
  ctaText: {
    color: theme.onPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.outlineVariant,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.onSurface,
  },
  footer: {
    marginTop: 16,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: theme.onSurfaceVariant,
    textAlign: "center",
  },
  footerLink: {
    fontWeight: "800",
    color: theme.primary,
  },
});
