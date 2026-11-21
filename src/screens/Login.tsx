import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import OwnerRegisterModal from './OwnerRegister';
import PgDetails from './PgDetails';

export default function Login() {
  const { login } = useAuth();
  const [isExploring, setIsExploring] = useState(false);
  const [selectedPgId, setSelectedPgId] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Browsing public stays needs no account.
  if (selectedPgId !== null) {
    return <PgDetails pgId={selectedPgId} onBack={() => setSelectedPgId(null)} />;
  }
  if (isExploring) {
    return <ExplorePgs showBack={true} onBack={() => setIsExploring(false)} onSelectPg={(id) => setSelectedPgId(id)} />;
  }

  // One sign-in for everyone: owners, managers and residents all use the same username or mobile + password.
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

  return (
    <KeyboardAvoidingView style={st.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        {/* ── Brand ── */}
        <View style={st.brand}>
          <Image source={require('../../assets/MyStay.png')} style={st.logo} resizeMode="contain" />
          <Text style={st.tagline}>Manage Every Stay</Text>
          <Text style={st.tagSub}>PG • Hostel • Co-living • Rooms</Text>
        </View>

        {/* ── Sign in (same for owners, managers and residents) ── */}
        <View style={st.card}>
          <Text style={st.h1}>Sign In</Text>
          <Text style={st.sub}>Owners, managers and residents sign in here</Text>

          {error && (
            <View style={{ marginTop: 12 }}>
              <ErrorNote text={error} />
            </View>
          )}

          <View style={[st.inputWrap, { marginTop: 14 }]}>
            <Ionicons name="person-outline" size={18} color={colors.muted} />
            <TextInput
              style={st.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              returnKeyType="next"
              placeholder="Username or Mobile"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={[st.inputWrap, { marginTop: 10 }]}>
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
              placeholder="Password"
              placeholderTextColor={colors.muted}
            />
            <Pressable
              onPress={() => setShow((v) => !v)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={show ? 'Hide password' : 'Show password'}
            >
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
            </Pressable>
          </View>

          <Pressable style={[st.btn, busy && { opacity: 0.6 }]} onPress={handleSignIn} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={st.btnText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </Pressable>

          {/* ── New here ── */}
          <View style={st.dividerRow}>
            <View style={st.dividerLine} />
            <Text style={st.dividerText}>NEW HERE?</Text>
            <View style={st.dividerLine} />
          </View>

          <View style={st.tileRow}>
            <TouchableOpacity
              style={st.tile}
              onPress={() => setRegistering(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="I am an owner. Register your property"
            >
              <View style={st.tileIcon}>
                <Ionicons name="business-outline" size={22} color={colors.primary} />
              </View>
              <Text style={st.tileTitle}>I am an Owner</Text>
              <Text style={st.tileSub}>Register your property</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.tile}
              onPress={() => setIsExploring(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Looking for a stay. Browse verified stays"
            >
              <View style={st.tileIcon}>
                <Ionicons name="search-outline" size={22} color={colors.primary} />
              </View>
              <Text style={st.tileTitle}>Find a stay</Text>
              <Text style={st.tileSub}>Browse verified stays</Text>
            </TouchableOpacity>
          </View>

          <View style={st.note}>
            <Ionicons name="information-circle-outline" size={16} color={colors.blue} />
            <Text style={st.noteText}>
              Owners: your registration is reviewed by the administrator, and you can sign in after approval.
              Residents: sign in with the login your owner created for you.
            </Text>
          </View>
        </View>

        <Text style={st.footer}>© {new Date().getFullYear()} MyStay</Text>
        {__DEV__ && <Text style={st.dev}>API: {BASE_URL}</Text>}
      </ScrollView>

      <OwnerRegisterModal visible={registering} onClose={() => setRegistering(false)} />
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingVertical: 20 },
  brand: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 104, height: 104 },
  tagline: { fontSize: 18, fontWeight: '800', color: colors.forest, marginTop: 2 },
  tagSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  h1: { fontSize: 22, fontWeight: '800', color: colors.forest },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.bg,
  },
  input: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  btn: {
    flexDirection: 'row',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: 10, fontSize: 11, fontWeight: '700', color: colors.muted },

  // two equal entry tiles: owner registration and stay search
  tileRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileTitle: { fontSize: 14, fontWeight: '800', color: colors.primary },
  tileSub: { fontSize: 11, color: colors.muted, textAlign: 'center' },

  note: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#e3f2fd',
  },
  noteText: { flex: 1, fontSize: 11, color: colors.blue, lineHeight: 16 },
  footer: { marginTop: 14, fontSize: 12, color: colors.muted, textAlign: 'center' },
  dev: { marginTop: 4, fontSize: 10, color: colors.muted, textAlign: 'center' },
});