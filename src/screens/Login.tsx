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

type Who = 'OWNER' | 'RESIDENT';

const WHO: { key: Who; title: string; sub: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'OWNER', title: 'Owner / Manager', sub: 'Manage property, residents, rooms, dues & expenses', icon: 'business-outline' },
  { key: 'RESIDENT', title: 'Resident', sub: 'Access your stay, dues, requests & announcements', icon: 'people-outline' },
];

export default function Login() {
  const { login } = useAuth();
  const [who, setWho] = useState<Who>('OWNER');
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

  const owner = who === 'OWNER';

  return (
    <KeyboardAvoidingView style={st.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        {/* ── Brand ── */}
        <View style={st.brand}>
          <Image source={require('../../assets/MyStay.png')} style={st.logo} resizeMode="contain" />
          <Text style={st.tagline}>Manage Every Stay</Text>
          <Text style={st.tagSub}>PG • Hostel • Co-living • Rooms</Text>
        </View>

        {/* ── Who is signing in ── */}
        <View style={st.whoRow}>
          {WHO.map((w) => {
            const on = who === w.key;
            return (
              <Pressable
                key={w.key}
                onPress={() => {
                  setWho(w.key);
                  setError(null);
                }}
                style={[st.whoCard, on && st.whoCardOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                {on && (
                  <View style={st.whoTick}>
                    <Ionicons name="checkmark" size={12} color={colors.primary} />
                  </View>
                )}
                <Ionicons name={w.icon} size={28} color={on ? '#fff' : colors.primary} />
                <Text style={[st.whoTitle, on && { color: '#fff' }]}>{w.title}</Text>
                <Text style={[st.whoSub, on && { color: '#ffffffcc' }]}>{w.sub}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Sign in ── */}
        <View style={st.card}>
          <Text style={st.h1}>Sign In</Text>
          <Text style={st.sub}>Continue to your MyStay account</Text>

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
            <Pressable onPress={() => setShow((v) => !v)} hitSlop={10}>
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

          {owner ? (
            <>
              <TouchableOpacity style={st.outlineBtn} onPress={() => setRegistering(true)} activeOpacity={0.7}>
                <Ionicons name="business-outline" size={18} color={colors.primary} />
                <Text style={st.outlineText}>Register as Owner</Text>
              </TouchableOpacity>
              <Text style={st.hint}>
                Send your property details once. The administrator reviews them, and you can sign in after approval.
              </Text>
            </>
          ) : (
            <View style={st.note}>
              <Ionicons name="information-circle-outline" size={18} color={colors.blue} />
              <Text style={st.noteText}>
                Residents sign in once the owner has added them to a stay. Until then you can explore verified stays below.
              </Text>
            </View>
          )}

          <TouchableOpacity style={st.exploreBtn} onPress={() => setIsExploring(true)} activeOpacity={0.7}>
            <Ionicons name="search-outline" size={18} color={colors.primary} />
            <Text style={st.exploreText}>Browse Verified Stays, Amenities & Vacant Beds</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
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
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingVertical: 28 },
  brand: { alignItems: 'center', marginBottom: 14 },
  logo: { width: 130, height: 130 },
  tagline: { fontSize: 18, fontWeight: '800', color: colors.forest, marginTop: 2 },
  tagSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  whoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  whoCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  whoCardOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  whoTick: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 2 },
  whoSub: { fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 15 },
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: 10, fontSize: 11, fontWeight: '700', color: colors.muted },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  outlineText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  hint: { fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 17 },
  note: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#e3f2fd',
  },
  noteText: { flex: 1, fontSize: 12, color: colors.blue, lineHeight: 17 },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  exploreText: { flex: 1, color: colors.primary, fontSize: 13, fontWeight: '700' },
  footer: { marginTop: 16, fontSize: 12, color: colors.muted, textAlign: 'center' },
  dev: { marginTop: 4, fontSize: 10, color: colors.muted, textAlign: 'center' },
});
