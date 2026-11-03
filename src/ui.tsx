import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardTypeOptions,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './auth';

/** Palette shared with AgroMobileApp so both apps look the same. */
export const colors = {
  primary: '#2e7d32',
  primaryDark: '#1b5e20',
  primaryLight: '#e8f5e9',
  forest: '#1b4332',
  tab: '#1b873f',
  tabActiveBg: '#dcfce7',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#1f2328',
  muted: '#57606a',
  border: '#e5e7eb',
  good: '#2e7d32',
  bad: '#c62828',
  badLight: '#ffebee',
  warn: '#e65100',
  blue: '#1565c0',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const AVATAR_COLORS = ['#2e7d32', '#1565c0', '#6a1b9a', '#c62828', '#e65100', '#00695c'];
const avatarColor = (name: string) => AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Owner',
  MANAGER: 'Manager',
  RESIDENT: 'Resident',
};

/**
 * Top AppHeader with Left Menu/Back, Brand, Center PG Title, Action,
 * and Left Drawer Modal showing profile & PG details.
 */
export function AppHeader({
  title,
  subtitle,
  showBack,
  rightAction,
}: {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}) {
  let navigation: any = null;
  try {
    navigation = useNavigation();
  } catch {
    navigation = null;
  }

  const { user, logout, changePassword } = useAuth();
  const [profileVisible, setProfileVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const initials =
    user?.username
      ?.split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    user?.username?.slice(0, 2)?.toUpperCase() ||
    'PG';

  let canGoBack = false;
  try {
    canGoBack = showBack !== undefined ? showBack : (navigation?.canGoBack?.() ?? false);
  } catch {
    canGoBack = false;
  }

  const handleLeftPress = () => {
    if (canGoBack && navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      setProfileVisible(true);
    }
  };

  const handleLogout = () => {
    setProfileVisible(false);
    Alert.alert('Log out', 'Are you sure you want to log out of My PG?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleManageUsers = () => {
    setProfileVisible(false);
    navigation?.navigate?.('Users');
  };

  const handleManagePgs = () => {
    setProfileVisible(false);
    navigation?.navigate?.('Pgs');
  };

  const handleSupport = () => {
    setProfileVisible(false);
    Alert.alert(
      'Help & Support',
      'For assistance, questions, or PG setup guidance, please contact support:\n\n📧 Email: support@mypg.com\n📞 Phone: +91-9876543210\n⏰ Hours: 9 AM - 8 PM IST',
      [{ text: 'OK' }]
    );
  };

  return (
    <>
      <View style={[headerStyles.safeArea, { paddingTop: insets.top }]}>
        <View style={headerStyles.header}>
          {/* Left: Menu / Back Button */}
          <TouchableOpacity
            style={headerStyles.leftBtn}
            onPress={handleLeftPress}
            accessibilityRole="button"
            accessibilityLabel={canGoBack ? 'Go back' : 'Open menu'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {canGoBack ? (
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            ) : (
              <Ionicons name="menu-outline" size={26} color={colors.primary} />
            )}
          </TouchableOpacity>

          {/* Logo / Brand Icon */}
          <View style={headerStyles.brandIconWrap}>
            <View style={headerStyles.logoBox}>
              <Ionicons name="home" size={18} color="#ffffff" />
            </View>
          </View>

          {/* Center Title + Subtitle */}
          <View style={headerStyles.headerCenter}>
            <Text style={headerStyles.headerTitle} numberOfLines={1}>
              {user?.pgName || 'My PG'}
            </Text>
            <Text style={headerStyles.headerSub} numberOfLines={1}>
              {subtitle || (title ? title : 'Smart PG Management')}
            </Text>
          </View>

          {/* Right Actions */}
          <View style={headerStyles.rightGroup}>
            {rightAction}

            {/* Profile Avatar Button — Opens Side Drawer */}
            <TouchableOpacity
              style={headerStyles.profileAvatarBtn}
              onPress={() => setProfileVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={headerStyles.headerAvatarCircle}>
                <Text style={headerStyles.headerAvatarInitials}>{initials}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Left Side Profile & PG Details Drawer Modal ── */}
      <Modal
        visible={profileVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileVisible(false)}
      >
        <View style={headerStyles.drawerBackdrop}>
          {/* Full-screen backdrop touch to close */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileVisible(false)} />

          {/* Left Drawer Container */}
          <Pressable
            style={[
              headerStyles.drawerContainer,
              {
                paddingTop: Math.max(insets.top, 20),
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
            onPress={(e) => e.stopPropagation?.()}
          >
            {/* Drawer Header */}
            <View style={headerStyles.drawerHeader}>
              <View style={headerStyles.drawerUserRow}>
                <View style={headerStyles.drawerAvatar}>
                  <Text style={headerStyles.drawerAvatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={headerStyles.drawerUserName} numberOfLines={1}>
                    {user?.username || 'PG User'}
                  </Text>
                  <View style={headerStyles.drawerRoleBadge}>
                    <Text style={headerStyles.drawerRoleText}>
                      {user?.role ? ROLE_LABEL[user.role] || user.role : 'USER'}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={headerStyles.drawerCloseBtn}
                onPress={() => setProfileVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={headerStyles.drawerDivider} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* PG / Property Details Card */}
              <View style={headerStyles.drawerSection}>
                <Text style={headerStyles.drawerSectionTitle}>PG & Property Details</Text>

                <View style={headerStyles.drawerInfoCard}>
                  <View style={headerStyles.drawerInfoRow}>
                    <View style={[headerStyles.drawerMiniIcon, { backgroundColor: '#dcfce7' }]}>
                      <Ionicons name="business" size={16} color={colors.primary} />
                    </View>
                    <View style={headerStyles.drawerInfoTextWrap}>
                      <Text style={headerStyles.drawerInfoLabel}>Current PG</Text>
                      <Text style={headerStyles.drawerInfoValue}>{user?.pgName || 'My PG'}</Text>
                    </View>
                  </View>

                  {user?.pgId != null && (
                    <View style={headerStyles.drawerInfoRow}>
                      <View style={[headerStyles.drawerMiniIcon, { backgroundColor: '#eff6ff' }]}>
                        <Ionicons name="id-card-outline" size={16} color="#2563eb" />
                      </View>
                      <View style={headerStyles.drawerInfoTextWrap}>
                        <Text style={headerStyles.drawerInfoLabel}>PG ID</Text>
                        <Text style={headerStyles.drawerInfoValue}>#{user.pgId}</Text>
                      </View>
                    </View>
                  )}

                  {user?.residentId != null && (
                    <View style={headerStyles.drawerInfoRow}>
                      <View style={[headerStyles.drawerMiniIcon, { backgroundColor: '#fef3c7' }]}>
                        <Ionicons name="bed-outline" size={16} color="#d97706" />
                      </View>
                      <View style={headerStyles.drawerInfoTextWrap}>
                        <Text style={headerStyles.drawerInfoLabel}>Resident ID</Text>
                        <Text style={headerStyles.drawerInfoValue}>#{user.residentId}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <View style={headerStyles.drawerDivider} />

              {/* Account Details */}
              <View style={headerStyles.drawerSection}>
                <Text style={headerStyles.drawerSectionTitle}>Account Details</Text>

                <View style={headerStyles.drawerInfoCard}>
                  <View style={headerStyles.drawerInfoRow}>
                    <View style={[headerStyles.drawerMiniIcon, { backgroundColor: '#f3e8ff' }]}>
                      <Ionicons name="person-outline" size={16} color="#9333ea" />
                    </View>
                    <View style={headerStyles.drawerInfoTextWrap}>
                      <Text style={headerStyles.drawerInfoLabel}>Username</Text>
                      <Text style={headerStyles.drawerInfoValue}>{user?.username || '—'}</Text>
                    </View>
                  </View>

                  <View style={headerStyles.drawerInfoRow}>
                    <View style={[headerStyles.drawerMiniIcon, { backgroundColor: '#e0f2fe' }]}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#0284c7" />
                    </View>
                    <View style={headerStyles.drawerInfoTextWrap}>
                      <Text style={headerStyles.drawerInfoLabel}>Access Role</Text>
                      <Text style={headerStyles.drawerInfoValue}>
                        {user?.role ? ROLE_LABEL[user.role] || user.role : 'User'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={headerStyles.drawerDivider} />

              {/* Drawer Menu Navigation Items */}
              <View style={headerStyles.drawerMenuItems}>
                {/* Manage Users (Owners & Super Admins) */}
                {user && (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') && user.pgId !== null && (
                  <TouchableOpacity style={headerStyles.drawerItem} onPress={handleManageUsers}>
                    <View style={[headerStyles.drawerItemIconWrap, { backgroundColor: '#eff6ff' }]}>
                      <Ionicons name="people-outline" size={18} color="#2563eb" />
                    </View>
                    <Text style={headerStyles.drawerItemLabel}>Manage Users</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.muted} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}

                {/* Manage PGs (Super Admin) */}
                {user && user.role === 'SUPER_ADMIN' && (
                  <TouchableOpacity style={headerStyles.drawerItem} onPress={handleManagePgs}>
                    <View style={[headerStyles.drawerItemIconWrap, { backgroundColor: '#fdf4ff' }]}>
                      <Ionicons name="business-outline" size={18} color="#a855f7" />
                    </View>
                    <Text style={headerStyles.drawerItemLabel}>Switch / Manage PGs</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.muted} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}

                {/* Change Password */}
                <TouchableOpacity
                  style={headerStyles.drawerItem}
                  onPress={() => {
                    setProfileVisible(false);
                    setChangePasswordVisible(true);
                  }}
                >
                  <View style={[headerStyles.drawerItemIconWrap, { backgroundColor: '#fef3c7' }]}>
                    <Ionicons name="lock-closed-outline" size={18} color="#d97706" />
                  </View>
                  <Text style={headerStyles.drawerItemLabel}>Change Password</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.muted} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>

                {/* Help & Support */}
                <TouchableOpacity style={headerStyles.drawerItem} onPress={handleSupport}>
                  <View style={[headerStyles.drawerItemIconWrap, { backgroundColor: '#ecfdf5' }]}>
                    <Ionicons name="help-buoy-outline" size={18} color="#059669" />
                  </View>
                  <Text style={headerStyles.drawerItemLabel}>Help & Support</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.muted} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Logout Button at bottom of drawer */}
            <View style={headerStyles.drawerFooter}>
              <TouchableOpacity style={headerStyles.drawerLogoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={18} color={colors.bad} />
                <Text style={headerStyles.drawerLogoutText}>Logout</Text>
              </TouchableOpacity>
              <Text style={headerStyles.drawerBrandText}>My PG • Smart PG Management</Text>
            </View>
          </Pressable>

          {/* Right-side outside touch area */}
          <Pressable style={headerStyles.drawerRightOutside} onPress={() => setProfileVisible(false)} />
        </View>
      </Modal>

      {/* Change Password Form Modal */}
      {changePasswordVisible && (
        <FormModal
          visible={changePasswordVisible}
          title="Change Password"
          fields={[
            { key: 'old', label: 'Current Password', secure: true },
            { key: 'next', label: 'New Password (min 8 characters)', secure: true },
            { key: 'again', label: 'Repeat New Password', secure: true },
          ]}
          onClose={() => setChangePasswordVisible(false)}
          onSubmit={async (v) => {
            if (v.next.length < 8) {
              Alert.alert('Too short', 'Use at least 8 characters.');
              return false;
            }
            if (v.next !== v.again) {
              Alert.alert('Mismatch', 'The new passwords do not match.');
              return false;
            }
            try {
              await changePassword(v.old, v.next);
              setChangePasswordVisible(false);
              Alert.alert('Done', 'Your password was updated.');
              return true;
            } catch (e: any) {
              Alert.alert('Failed', e?.message || 'Failed to update password');
              return false;
            }
          }}
        />
      )}
    </>
  );
}

/**
 * App header (brand + screen name + optional right action) above scrolling content.
 * Pass `loading`/`error`/`onRefresh` for server-backed screens: first load shows a spinner, failures show a
 * retry note, and pull-to-refresh reloads.
 */
export function Screen({
  title,
  subtitle,
  showBack,
  children,
  action,
  loading,
  error,
  refreshing,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <View style={s.screen}>
      <AppHeader title={title} subtitle={subtitle} showBack={showBack} rightAction={action} />
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          ) : undefined
        }
      >
        {error && <ErrorNote text={error} onRetry={onRefresh} />}
        {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} /> : children}
      </ScrollView>
    </View>
  );
}

export function HeaderAction({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.headerAction} hitSlop={8}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  small,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  small?: boolean;
}) {
  const bg = kind === 'primary' ? colors.primary : kind === 'danger' ? colors.badLight : 'transparent';
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? colors.bad : colors.primary;
  return (
    <Pressable onPress={onPress} style={[s.btn, small && s.btnSmall, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 12 : 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: color + '22' }]}>
      <Text style={{ color, fontSize: 10, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <View style={[s.avatar, { backgroundColor: avatarColor(name) }]}>
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/** Section card with a coloured left-border heading, as in Agro's Business Overview. */
export function Section({ title, icon, color = colors.primary, children }: { title: string; icon: IconName; color?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={[s.sectionHead, { borderLeftColor: color }]}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={{ fontSize: 12, fontWeight: '700', color }}>{title}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

/** KPI tile: accent bar on the left, tinted icon, small label, bold value, optional sub-label. */
export function Stat({ label, value, color, icon, sub }: { label: string; value: string; color?: string; icon?: IconName; sub?: string }) {
  const accent = color ?? colors.primary;
  return (
    <View style={[s.stat, { borderLeftColor: accent }]}>
      {icon && (
        <View style={[s.statIcon, { backgroundColor: accent + '22' }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.statLabel}>{label}</Text>
        <Text style={[s.statValue, { color: accent, fontSize: 16, marginTop: 1 }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {sub ? <Text style={{ fontSize: 9, color: colors.muted, marginTop: 1 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={{ backgroundColor: colors.badLight, borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <Text style={{ color: colors.bad, fontSize: 13 }}>{text}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} hitSlop={8} style={{ marginTop: 6 }}>
          <Text style={{ color: colors.bad, fontWeight: '700', fontSize: 13 }}>Tap to retry</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
      <Ionicons name="file-tray-outline" size={40} color={colors.border} />
      <Text style={[s.muted, { textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (t: string) => void; placeholder: string }) {
  return (
    <View style={s.searchWrap}>
      <Ionicons name="search" size={16} color={colors.muted} />
      <TextInput
        style={s.searchInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

/** Horizontal single-select filter chips. */
export function Chips<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, flexGrow: 0 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[s.chip, on && s.chipOn]}>
            <Text style={[s.chipText, on && { color: '#fff' }]}>{o}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export type FieldDef = {
  key: string;
  label: string;
  keyboard?: KeyboardTypeOptions;
  initial?: string;
  /** Password field. */
  secure?: boolean;
  /** May be left blank. */
  optional?: boolean;
};

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Form in a bottom sheet. `onSubmit` may be async: the button is disabled while it runs, and returning `false`
 * keeps the typed values so the user can fix them and retry.
 */
export function FormModal({
  visible,
  title,
  fields,
  submitLabel = 'Save',
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  fields: FieldDef[];
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void | boolean | Promise<void | boolean>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const get = (f: FieldDef) => values[f.key] ?? f.initial ?? '';
  const close = () => {
    setValues({});
    onClose();
  };
  const submit = async () => {
    if (busy) return;
    const out: Record<string, string> = {};
    fields.forEach((f) => (out[f.key] = f.secure ? get(f) : get(f).trim()));
    if (fields.some((f) => !f.optional && !out[f.key])) return;
    setBusy(true);
    try {
      const r = await onSubmit(out);
      if (r !== false) setValues({});
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} title={title} onClose={close}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>
        {fields.map((f) => (
          <View key={f.key}>
            <Text style={s.label}>{f.label}</Text>
            <TextInput
              style={s.input}
              value={get(f)}
              keyboardType={f.keyboard}
              secureTextEntry={f.secure}
              autoCapitalize={f.secure || f.keyboard ? 'none' : undefined}
              autoCorrect={f.secure ? false : undefined}
              placeholderTextColor={colors.muted}
              onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
            />
          </View>
        ))}
        <Pressable style={[s.saveBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{submitLabel}</Text>}
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

/** Simple modal list picker. */
export function PickerModal<T extends { id: string | number }>({
  visible,
  title,
  items,
  label,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: T[];
  label: (i: T) => string;
  onPick: (i: T) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 28 }}>
        {items.length === 0 && <Empty text="Nothing to choose from yet." />}
        {items.map((i) => (
          <Pressable key={i.id} style={s.pickRow} onPress={() => onPick(i)}>
            <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{label(i)}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  brand: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandTitle: { fontSize: 15, fontWeight: '800', color: colors.forest, letterSpacing: -0.2 },
  brandSub: { fontSize: 10, color: '#6c757d', marginTop: 1, fontWeight: '500' },
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muted: { color: colors.muted, fontSize: 12 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  section: { backgroundColor: colors.card, borderRadius: 12, padding: 10, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, borderLeftWidth: 3, paddingLeft: 8, marginBottom: 8 },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 10, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h2: { fontSize: 14, fontWeight: '700', color: colors.text },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, alignSelf: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sheetBody: { paddingHorizontal: 18, paddingBottom: 28 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: colors.text,
  },
  saveBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 14, height: 50, marginTop: 20 },
  saveText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
});

const headerStyles = StyleSheet.create({
  safeArea: { backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  leftBtn: {
    paddingRight: 8,
    paddingVertical: 4,
  },
  brandIconWrap: {
    marginRight: 6,
  },
  logoBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 4,
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: colors.forest, letterSpacing: -0.2 },
  headerSub: { fontSize: 10, color: '#6c757d', marginTop: 1, fontWeight: '500' },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileAvatarBtn: {
    padding: 2,
    marginLeft: 2,
  },
  headerAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  headerAvatarInitials: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  // Drawer modal styles
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
  },
  drawerContainer: {
    width: '82%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    height: '100%',
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 16,
    zIndex: 2,
  },
  drawerRightOutside: {
    flex: 1,
    height: '100%',
    zIndex: 1,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  drawerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  drawerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAvatarText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  drawerUserName: { fontSize: 16, fontWeight: '800', color: colors.forest },
  drawerRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  drawerRoleText: { fontSize: 10, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' },
  drawerCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  drawerSection: {
    gap: 8,
  },
  drawerSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  drawerInfoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  drawerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawerMiniIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerInfoTextWrap: { flex: 1 },
  drawerInfoLabel: { fontSize: 10, color: '#94a3b8' },
  drawerInfoValue: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  drawerMenuItems: {
    gap: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  drawerItemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  drawerItemLabel: { fontSize: 13, fontWeight: '600', color: '#1e293b', flex: 1 },
  drawerFooter: {
    marginTop: 'auto',
    paddingTop: 14,
    gap: 10,
  },
  drawerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingVertical: 11,
    borderRadius: 10,
  },
  drawerLogoutText: { fontSize: 14, fontWeight: '700', color: colors.bad },
  drawerBrandText: { textAlign: 'center', fontSize: 11, color: '#94a3b8', fontWeight: '500' },
});
