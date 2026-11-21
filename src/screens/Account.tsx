import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { get, post, put } from '../api';
import { useAuth } from '../auth';
import { attempt } from '../hooks';
import { WhatsappConfig } from '../types';
import { useSubscription } from '../subscription';
import { AddPropertyModal, Button, Card, FormModal, HeaderAction, Screen, colors, s } from '../ui';

const ROLE_LABEL = { SUPER_ADMIN: 'Super admin', OWNER: 'Owner', MANAGER: 'Manager', RESIDENT: 'Resident' } as const;

/** Old + new password form shared by the Account screen and the forced first-login gate. */
function ChangePasswordForm({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone?: () => void }) {
  const { changePassword } = useAuth();
  return (
    <FormModal
      visible={visible}
      title="Change password"
      fields={[
        { key: 'old', label: 'Current password', secure: true },
        { key: 'next', label: 'New password (min 4 characters)', secure: true },
        { key: 'again', label: 'Repeat new password', secure: true },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        if (v.next.length < 4) {
          Alert.alert('Too short', 'Use at least 4 characters.');
          return false;
        }
        if (v.next !== v.again) {
          Alert.alert('Mismatch', 'The new passwords do not match.');
          return false;
        }
        if (!(await attempt(() => changePassword(v.old, v.next)))) return false;
        onClose();
        Alert.alert('Done', 'Your password was updated.');
        onDone?.();
      }}
    />
  );
}

/** Admin-only paths: one WhatsApp configuration that every property uses. */
const WHATSAPP_PATH = '/api/admin/notification-config/whatsapp';

/** Modal where the super admin sets the common WhatsApp Cloud API settings and notification preferences. */
export function WhatsappSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [apiVersion, setApiVersion] = useState('v22.0');
  const [hasToken, setHasToken] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [notifyOnPayment, setNotifyOnPayment] = useState(true);
  const [notifyOnDueReminder, setNotifyOnDueReminder] = useState(true);
  const [notifyOnOnboarding, setNotifyOnOnboarding] = useState(true);
  const [notifyOnMove, setNotifyOnMove] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    get<WhatsappConfig>(WHATSAPP_PATH)
      .then((cfg) => {
        if (!active) return;
        if (cfg) {
          setPhoneNumberId(cfg.phoneNumberId || '');
          setWabaId(cfg.wabaId || '');
          setApiVersion(cfg.apiVersion || 'v22.0');
          setHasToken(!!cfg.hasAccessToken);
          setEnabled(!!cfg.enabled);
          setNotifyOnPayment(cfg.notifyOnPayment ?? true);
          setNotifyOnDueReminder(cfg.notifyOnDueReminder ?? true);
          setNotifyOnOnboarding(cfg.notifyOnOnboarding ?? true);
          setNotifyOnMove(cfg.notifyOnMove ?? true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await attempt(() =>
      put(WHATSAPP_PATH, {
        phoneNumberId,
        wabaId,
        apiVersion,
        accessToken: accessToken ? accessToken : undefined,
        enabled,
        notifyOnPayment,
        notifyOnDueReminder,
        notifyOnOnboarding,
        notifyOnMove,
      }),
    );
    setSaving(false);
    if (ok) {
      Alert.alert('Saved', 'The common WhatsApp configuration was updated. Every property uses it.');
      onClose();
    }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) {
      Alert.alert('Test Phone Required', 'Enter a 10-digit mobile number to send a test message.');
      return;
    }
    setTesting(true);
    const ok = await attempt(() => post(`${WHATSAPP_PATH}/test?testPhone=${encodeURIComponent(testPhone.trim())}`));
    setTesting(false);
    if (ok) {
      Alert.alert('Test Sent', `Test WhatsApp message sent to ${testPhone.trim()}. Check the recipient's phone.`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>WhatsApp (all properties)</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 18, color: colors.muted, fontWeight: '700' }}>âœ•</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
          ) : (
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Enable WhatsApp Cloud API</Text>
                  <Text style={styles.toggleSub}>Send automated receipts & dues notifications</Text>
                </View>
                <Switch value={enabled} onValueChange={setEnabled} trackColor={{ true: '#16a34a' }} />
              </View>

              <Text style={styles.fieldLabel}>Phone Number ID *</Text>
              <TextInput
                style={styles.input}
                value={phoneNumberId}
                onChangeText={setPhoneNumberId}
                placeholder="e.g. 104829104812345"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>WhatsApp Business Account ID (WABA ID)</Text>
              <TextInput
                style={styles.input}
                value={wabaId}
                onChangeText={setWabaId}
                placeholder="e.g. 109827346152345 (optional)"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>
                Access Token {hasToken ? '(leave blank to keep existing)' : '*'}
              </Text>
              <TextInput
                style={styles.input}
                value={accessToken}
                onChangeText={setAccessToken}
                placeholder={hasToken ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' : 'Meta Cloud API access token'}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>API Version</Text>
              <TextInput
                style={styles.input}
                value={apiVersion}
                onChangeText={setApiVersion}
                placeholder="v22.0"
                autoCapitalize="none"
              />

              <Text style={[styles.sectionHeading, { marginTop: 14 }]}>Notification Triggers</Text>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Payment Receipts</Text>
                <Switch value={notifyOnPayment} onValueChange={setNotifyOnPayment} trackColor={{ true: '#16a34a' }} />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Payment Due Reminders</Text>
                <Switch value={notifyOnDueReminder} onValueChange={setNotifyOnDueReminder} trackColor={{ true: '#16a34a' }} />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Resident Welcome / Check-in</Text>
                <Switch value={notifyOnOnboarding} onValueChange={setNotifyOnOnboarding} trackColor={{ true: '#16a34a' }} />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Room Shift / Relocation</Text>
                <Switch value={notifyOnMove} onValueChange={setNotifyOnMove} trackColor={{ true: '#16a34a' }} />
              </View>

              <Text style={[styles.sectionHeading, { marginTop: 14 }]}>Send Test Message</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={testPhone}
                  onChangeText={setTestPhone}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                />
                <Button label={testing ? 'Testing...' : 'Test'} onPress={testing ? () => {} : handleTest} />
              </View>

              <View style={{ height: 16 }} />
              <Button label={saving ? 'Saving...' : 'Save Configuration'} onPress={saving ? () => {} : handleSave} />
              <View style={{ height: 8 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Shown instead of the app while the server says this login must pick a new password. */
export function MustChangePassword() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <Screen title="Set a new password" action={<HeaderAction label="Log out" icon="log-out-outline" onPress={logout} />}>
      <Card>
        <Text style={s.h2}>Welcome, {user?.username}</Text>
        <Text style={[s.muted, { marginVertical: 8 }]}>
          Your password was set by an administrator. Choose your own password to continue.
        </Text>
        <Button label="Choose new password" onPress={() => setOpen(true)} />
      </Card>
      <ChangePasswordForm visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}

export default function Account() {
  const { user, logout, exitPg } = useAuth();
  const { openPlans } = useSubscription();
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const [open, setOpen] = useState(false);
  const [pgProfileOpen, setPgProfileOpen] = useState(false);
  if (!user) return null;

  // These act on one property, so they are hidden while an owner views "All Properties".
  const canManageStaff = (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') && user.pgId !== null && !user.allProperties;
  const canManagePg =
    (user.role === 'OWNER' || user.role === 'MANAGER' || user.role === 'SUPER_ADMIN') && user.pgId !== null && !user.allProperties;
  const confirmLogout = () =>
    Alert.alert('Log out', 'Log out of MyStay?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);

  const tiles: ConfigTileProps[] = [];
  if (canManagePg)
    tiles.push({ icon: 'business', color: '#2e7d32', title: 'Profile & UPI Settings', sub: 'Update PG details, UPI, billing', onPress: () => setPgProfileOpen(true) });
  if (canManageStaff)
    tiles.push({ icon: 'people', color: '#1565c0', title: 'Manage Users', sub: 'Add, edit & assign roles', onPress: () => nav.navigate('Users') });
  if (user.role === 'OWNER' && user.pgId !== null && !user.allProperties)
    tiles.push({ icon: 'card', color: '#ea580c', title: 'Subscription', sub: 'Plans, renewal & expiry date', onPress: openPlans });
  if (user.role === 'SUPER_ADMIN')
    tiles.push({ icon: 'home', color: '#6a1b9a', title: 'Admin Console', sub: 'Add, edit & manage properties', onPress: () => attempt(() => exitPg()) });

  return (
    <Screen title="Account">
      <View style={acct.profile}>
        <View style={acct.avatar}>
          <Ionicons name={user.role === 'RESIDENT' ? 'person' : 'ribbon'} size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={acct.name} numberOfLines={1}>{user.username}</Text>
          <Text style={s.muted} numberOfLines={1}>
            {ROLE_LABEL[user.role]}
            {user.pgName ? ` Â· ${user.pgName}` : ''}
          </Text>
        </View>
        <View style={acct.roleBadge}>
          <Text style={acct.roleBadgeText}>{user.role === 'SUPER_ADMIN' ? 'Admin' : ROLE_LABEL[user.role]}</Text>
        </View>
      </View>

      {tiles.length > 0 && (
        <>
          <Text style={acct.section}>Manage & Configure</Text>
          <View style={acct.grid}>
            {tiles.map((t) => (
              <ConfigTile key={t.title} {...t} />
            ))}
          </View>
        </>
      )}

      <Text style={acct.section}>Security</Text>
      <TouchableOpacity style={acct.passwordRow} activeOpacity={0.7} onPress={() => setOpen(true)}>
        <View style={[acct.tileIcon, { backgroundColor: '#fff3e0' }]}>
          <Ionicons name="lock-closed" size={22} color="#f57c00" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={acct.tileTitle}>Change Password</Text>
          <Text style={acct.tileSub}>Update your account password</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </TouchableOpacity>

      <Text style={acct.section}>Help us improve</Text>
      <TouchableOpacity style={acct.feedbackRow} activeOpacity={0.7} onPress={() => nav.navigate('Feedback')}>
        <View style={[acct.tileIcon, { backgroundColor: '#e3f2fd' }]}>
          <Ionicons name="chatbubble-ellipses" size={22} color="#1565c0" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={acct.tileTitle}>Send Feedback</Text>
          <Text style={acct.tileSub}>Suggest an improvement or report a problem</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </TouchableOpacity>

      <TouchableOpacity style={acct.logout} activeOpacity={0.7} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={22} color={colors.bad} />
        <Text style={acct.logoutText}>Log out</Text>
      </TouchableOpacity>
      <ChangePasswordForm visible={open} onClose={() => setOpen(false)} />
      <AddPropertyModal editing visible={pgProfileOpen} onClose={() => setPgProfileOpen(false)} onCreated={() => setPgProfileOpen(false)} />
    </Screen>
  );
}

type ConfigTileProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  title: string;
  sub: string;
  onPress: () => void;
};

/** Settings tile with a coloured left accent, round icon, title/subtitle and chevron. */
function ConfigTile({ icon, color, title, sub, onPress }: ConfigTileProps) {
  return (
    <TouchableOpacity style={[acct.tile, { borderLeftColor: color }]} activeOpacity={0.7} onPress={onPress}>
      <View style={[acct.tileIcon, { backgroundColor: color + '1f' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={acct.tileTitle} numberOfLines={2}>{title}</Text>
        <Text style={acct.tileSub} numberOfLines={2}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

const acct = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    elevation: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  roleBadge: { backgroundColor: colors.primaryLight, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  roleBadgeText: { color: colors.primaryDark, fontWeight: '800', fontSize: 12 },
  section: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 20, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: 10,
    minHeight: 80,
    elevation: 1,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  tileSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f3f8ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cfe2fb',
    padding: 12,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fffbf2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f5e6c8',
    padding: 12,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fde2e2',
  },
  logoutText: { color: colors.bad, fontSize: 16, fontWeight: '800' },
});

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  toggleSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
    marginBottom: 4,
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
