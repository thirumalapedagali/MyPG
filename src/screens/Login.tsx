import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BASE_URL, errorMessage } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, colors } from '../ui';
import ExplorePgs from './ExplorePgs';
import PgDetails from './PgDetails';

export default function Login() {
  const { login, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isExploring, setIsExploring] = useState(false);
  const [selectedPgId, setSelectedPgId] = useState<number | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If currently browsing PG details
  if (selectedPgId !== null) {
    return (
      <PgDetails
        pgId={selectedPgId}
        onBack={() => setSelectedPgId(null)}
      />
    );
  }

  // If currently browsing all PGs
  if (isExploring) {
    return (
      <ExplorePgs
        showBack={true}
        onBack={() => setIsExploring(false)}
        onSelectPg={(id) => setSelectedPgId(id)}
      />
    );
  }

  const handleSignIn = async () => {
    if (busy) return;
    if (!username.trim() || !password) {
      return setError('Enter your username or mobile, and your password.');
    }
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    if (busy) return;
    if (!name.trim()) return setError('Please enter your full name.');
    const cleanMobile = mobile.trim();
    if (!cleanMobile || !/^\d{10,15}$/.test(cleanMobile)) {
      return setError('Please enter a valid 10-15 digit mobile number.');
    }
    if (!password || password.length < 6) {
      return setError('Password must be at least 6 characters long.');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), cleanMobile, password, email.trim() || undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={st.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        <View style={st.card}>
          <View style={st.brandIcon}>
            <Ionicons name="home" size={28} color="#2563eb" />
          </View>
          <Text style={st.title}>My PG</Text>
          <Text style={st.subtitle}>
            {isRegistering
              ? 'Create a Resident Account to find & book vacant PG beds'
              : 'Sign in to manage rooms, explore PGs & view dues'}
          </Text>

          {/* Toggle Tab: Sign in vs Register */}
          <View style={st.toggleRow}>
            <TouchableOpacity
              style={[st.toggleBtn, !isRegistering && st.toggleBtnActive]}
              onPress={() => {
                setIsRegistering(false);
                setError(null);
              }}
            >
              <Text style={[st.toggleText, !isRegistering && st.toggleTextActive]}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[st.toggleBtn, isRegistering && st.toggleBtnActive]}
              onPress={() => {
                setIsRegistering(true);
                setError(null);
              }}
            >
              <Text style={[st.toggleText, isRegistering && st.toggleTextActive]}>New Resident Register</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={{ width: '100%', marginBottom: 10 }}>
              <ErrorNote text={error} />
            </View>
          )}

          {isRegistering ? (
            /* ── RESIDENT REGISTRATION FORM ── */
            <>
              <Text style={st.label}>Full Name *</Text>
              <View style={st.inputWrap}>
                <Ionicons name="person-outline" size={18} color={colors.muted} />
                <TextInput
                  style={st.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Text style={st.label}>Mobile Number *</Text>
              <View style={st.inputWrap}>
                <Ionicons name="call-outline" size={18} color={colors.muted} />
                <TextInput
                  style={st.input}
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="phone-pad"
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Text style={st.label}>Email Address (Optional)</Text>
              <View style={st.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.muted} />
                <TextInput
                  style={st.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="e.g. rahul@example.com"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Text style={st.label}>Password (min 6 chars) *</Text>
              <View style={st.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <TextInput
                  style={st.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!show}
                  placeholder="Create a password"
                  placeholderTextColor={colors.muted}
                />
                <Pressable onPress={() => setShow((v) => !v)} hitSlop={10}>
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
                </Pressable>
              </View>

              <Text style={st.label}>Confirm Password *</Text>
              <View style={st.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <TextInput
                  style={st.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!show}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Pressable
                style={[st.btn, { backgroundColor: '#16a34a' }, busy && { opacity: 0.6 }]}
                onPress={handleRegister}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.btnText}>Create Resident Account</Text>}
              </Pressable>
            </>
          ) : (
            /* ── SIGN IN FORM ── */
            <>
              <Text style={st.label}>Username or Mobile</Text>
              <View style={st.inputWrap}>
                <Ionicons name="person-outline" size={18} color={colors.muted} />
                <TextInput
                  style={st.input}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  returnKeyType="next"
                  placeholder="e.g. 9876543210 or owner"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Text style={st.label}>Password</Text>
              <View style={st.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <TextInput
                  style={st.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!show}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSignIn}
                  placeholder="Your password"
                  placeholderTextColor={colors.muted}
                />
                <Pressable onPress={() => setShow((v) => !v)} hitSlop={10}>
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
                </Pressable>
              </View>

              <Pressable style={[st.btn, busy && { opacity: 0.6 }]} onPress={handleSignIn} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.btnText}>Sign in</Text>}
              </Pressable>
            </>
          )}

          {/* ── Public Exploration Button ── */}
          <View style={st.dividerRow}>
            <View style={st.dividerLine} />
            <Text style={st.dividerText}>OR</Text>
            <View style={st.dividerLine} />
          </View>

          <TouchableOpacity style={st.exploreBtn} onPress={() => setIsExploring(true)}>
            <Ionicons name="business-outline" size={18} color="#2563eb" />
            <Text style={st.exploreBtnText}>Browse All PGs, Amenities & Vacant Beds</Text>
          </TouchableOpacity>

          <Text style={st.footer}>© {new Date().getFullYear()} My PG</Text>
          {__DEV__ && <Text style={st.dev}>API: {BASE_URL}</Text>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  brandIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 16, textAlign: 'center', lineHeight: 18 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    width: '100%',
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  toggleTextActive: { color: '#0f172a', fontWeight: '800' },
  label: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 5, marginTop: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    height: 46,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  input: { flex: 1, fontSize: 14, color: '#0f172a', paddingVertical: 0 },
  btn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { marginHorizontal: 10, fontSize: 11, fontWeight: '700', color: colors.muted },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
  },
  exploreBtnText: { color: '#2563eb', fontSize: 13, fontWeight: '700' },
  footer: { marginTop: 18, fontSize: 12, color: colors.muted },
  dev: { marginTop: 4, fontSize: 10, color: colors.muted },
});
