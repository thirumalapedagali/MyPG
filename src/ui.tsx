import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { subscribeNotifications } from './notificationStore';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  KeyboardTypeOptions,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { get, PickedFile, post, put } from './api';
import { useAuth } from './auth';
import { attempt } from './hooks';
import { DateField } from './dateField';
import { ImagePickerField, uploadPictures, ViewablePhoto } from './images';
import { LocationPickerField } from './locationPicker';
import { GENDER_POLICY, STAY_TYPE, useLookup } from './lookups';
import { newPropertyBody, newPropertySteps,newPropertyFields, upiIsValid, useTypeAmenities } from './propertyForm';
import { GeoPlace, PropertyCard } from './types';

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
  const { user, logout, changePassword, exitPg } = useAuth();
  const [profileVisible, setProfileVisible] = useState(false);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const isOwner = user?.role === 'OWNER';
  // Announcements belong to one property: not on the admin console, nor while an owner views "All Properties".
  const showAnnouncements = !!user && !user.allProperties && !(user.role === 'SUPER_ADMIN' && user.pgId == null);
  const headerName = user?.allProperties ? 'All Properties' : user?.pgName || 'MyStay';
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const [hasNotifications, setHasNotifications] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeNotifications((items) => {
      setHasNotifications(items.length > 0);
    });
  }, [user]);

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
    Alert.alert('Log out', 'Are you sure you want to log out of MyStay?', [
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

  // Inside a PG, a super admin goes back to the admin console; on the console itself this opens the PG list.
  const handleManagePgs = () => {
    setProfileVisible(false);
    if (user?.pgId == null) navigation?.navigate?.('Pgs');
    else attempt(() => exitPg());
  };

  const handleSupport = () => {
    setProfileVisible(false);
    Alert.alert(
      'Help & Support',
      'For assistance, questions, or PG setup guidance, please contact support:\n\n📧 Email: support@mypg.com\n📞 Phone: +91-9876543210\n⏰ Hours: 9 AM - 8 PM IST',
      [{ text: 'OK' }]
    );
  };

  const handleShareApp = async () => {
    setProfileVisible(false);
    try {
      await Share.share({
        message: 'Hey, check out MyStay! The best app to find and manage PG/Flat stays: http://192.168.1.4:8083',
      });
    } catch (error) {
      console.error('Error sharing app:', error);
    }
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

          {/* Center Title + Subtitle. Owners tap it to switch between their properties. */}
          <Pressable
            style={headerStyles.headerCenter}
            disabled={!isOwner}
            onPress={() => setSwitcherVisible(true)}
            accessibilityRole={isOwner ? 'button' : undefined}
            accessibilityLabel={isOwner ? 'Switch property' : undefined}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[headerStyles.headerTitle, { flexShrink: 1 }]} numberOfLines={1}>
                {headerName}
              </Text>
              {isOwner && <Ionicons name="chevron-down" size={15} color={colors.forest} />}
            </View>
            <Text style={headerStyles.headerSub} numberOfLines={1}>
              {subtitle || (title ? title : 'Manage Every Stay')}
            </Text>
          </Pressable>

          {/* Right Actions */}
          <View style={headerStyles.rightGroup}>
            {rightAction}

            {/* Notifications Bell */}
            {user && (
              <TouchableOpacity
                style={headerStyles.bellBtn}
                onPress={() => navigation?.navigate?.('Notifications')}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={{ position: 'relative' }}>
                  <Ionicons name="notifications-outline" size={22} color={colors.primary} />
                  {hasNotifications && (
                    <View
                      style={{
                        position: 'absolute',
                        right: 1,
                        top: 1,
                        backgroundColor: colors.bad,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: '#ffffff',
                      }}
                    />
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* Announcements: everyone inside a single property can read them (staff also post them there). */}
            {showAnnouncements && (
              <TouchableOpacity
                style={headerStyles.bellBtn}
                onPress={() => navigation?.navigate?.('Announcements')}
                accessibilityRole="button"
                accessibilityLabel="Announcements"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="megaphone-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            )}

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
                      <Text style={headerStyles.drawerInfoValue}>{headerName}</Text>
                    </View>
                  </View>
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
                {user && (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') && user.pgId !== null && !user.allProperties && (
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
                    <Text style={headerStyles.drawerItemLabel}>{user.pgId == null ? 'Manage PGs' : 'Admin Console'}</Text>
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

                {/* Share App */}
                <TouchableOpacity style={headerStyles.drawerItem} onPress={handleShareApp}>
                  <View style={[headerStyles.drawerItemIconWrap, { backgroundColor: '#fdf2f8' }]}>
                    <Ionicons name="share-social-outline" size={18} color="#db2777" />
                  </View>
                  <Text style={headerStyles.drawerItemLabel}>Share with a Friend</Text>
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
              <Text style={headerStyles.drawerBrandText}>MyStay • Manage Every Stay</Text>
            </View>
          </Pressable>

          {/* Right-side outside touch area */}
          <Pressable style={headerStyles.drawerRightOutside} onPress={() => setProfileVisible(false)} />
        </View>
      </Modal>

      {isOwner && <PropertySwitcher visible={switcherVisible} onClose={() => setSwitcherVisible(false)} />}

      {/* Change Password Form Modal */}
      {changePasswordVisible && (
        <FormModal
          visible={changePasswordVisible}
          title="Change Password"
          fields={[
            { key: 'old', label: 'Current Password', secure: true },
            { key: 'next', label: 'New Password (min 4 characters)', secure: true },
            { key: 'again', label: 'Repeat New Password', secure: true },
          ]}
          onClose={() => setChangePasswordVisible(false)}
          onSubmit={async (v) => {
            if (v.next.length < 4) {
              Alert.alert('Too short', 'Use at least 4 characters.');
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
  scrollable = true,
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
  scrollable?: boolean;
}) {
  return (
    <View style={s.screen}>
      <AppHeader title={title} subtitle={subtitle} showBack={showBack} rightAction={action} />
      {error && <View style={{ padding: 14 }}><ErrorNote text={error} onRetry={onRefresh} /></View>}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
      ) : scrollable ? (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 14 }}>
          {children}
        </View>
      )}
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

export function Avatar({ name, uri }: { name: string; uri?: string | null }) {
  return (
    <View style={[s.avatar, { backgroundColor: avatarColor(name), overflow: 'hidden' }]}>
      {uri ? (
        <ViewablePhoto uri={uri}>
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
        </ViewablePhoto>
      ) : (
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{name.charAt(0).toUpperCase()}</Text>
      )}
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
export function Stat({
  label,
  value,
  color,
  icon,
  sub,
  onPress,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: IconName;
  sub?: string;
  /** Makes the tile tappable. */
  onPress?: () => void;
}) {
  const accent = color ?? colors.primary;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [s.stat, { borderLeftColor: accent }, pressed && onPress ? { opacity: 0.7 } : null]}
    >
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
    </Pressable>
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

/** The field's name without the "*" and the example in brackets: "Owner mobile * (10-15 digits)" -> "Owner mobile". */
const plainLabel = (f: FieldDef) => f.label.replace(/\s*\(.*$/, '').replace(/\s*\*/g, '').trim() || f.label;
const requiredMessage = (f: FieldDef) => (f.options || f.date || f.checklist ? 'Please choose a value' : 'This field is required');

export type FieldDef = {
  key: string;
  label: string;
  keyboard?: KeyboardTypeOptions;
  initial?: string;
  /** Password field. */
  secure?: boolean;
  /** May be left blank. */
  optional?: boolean;
  /** Pick from a list (e.g. loaded from a lookup table) instead of typing. */
  options?: { code: string; label: string }[];
  /** Pick a date from the calendar instead of typing it. The value is `YYYY-MM-DD`. `min` / `max` are `YYYY-MM-DD` too. */
  date?: boolean;
  min?: string;
  max?: string;
  /** Tick any number of items. The value is the ticked codes joined by commas. `locked` items are always ticked. */
  checklist?: { code: string; label: string; group?: string; locked?: boolean }[];
  /** Key of a dropdown field; changing it clears what was ticked here, because the choices differ. */
  resetOn?: string;
  /** Takes half the width, so two consecutive `half` fields sit side by side. */
  half?: boolean;
  /** Several lines of text (wizard only). */
  multiline?: boolean;
  /** Shown but not typed into; the value comes from another field (e.g. the pincode). */
  readOnly?: boolean;
  /** Hint shown in an empty text box (wizard only); the default is built from the label. */
  placeholder?: string;
  /** Typed value of exactly `length` characters is looked up; the returned values fill the other fields by key. */
  autofill?: { length: number; fetch: (value: string) => Promise<Record<string, string> | null> };
};


export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View
          style={[
            s.sheet,
            {
              // Grows with its content and only stops at the screen edge, where the content scrolls.
              maxHeight: Math.min(
                height - insets.top - insets.bottom - 40,
                height * 0.95
              ),
            },
          ]}
        >
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <View style={{ flexShrink: 1 }}>
            {children}
          </View>
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
  onFieldChange,
  extra,
}: {
  visible: boolean;
  title: string;
  fields: FieldDef[];
  /** Anything else to show under the fields, e.g. a picture picker. */
  extra?: React.ReactNode;
  submitLabel?: string;
  onClose: () => void;
  /** Called when the user picks a value from a dropdown, so the caller can change what other fields offer. */
  onFieldChange?: (key: string, value: string) => void;
  onSubmit: (values: Record<string, string>) => void | boolean | Promise<void | boolean>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Required fields found empty on the last Save, so the form can say which ones instead of doing nothing.
  const [missing, setMissing] = useState<string[]>([]);
  // Progress/result text shown under a field that auto-fills others (e.g. pincode).
  const [notes, setNotes] = useState<Record<string, string>>({});
  const runAutofill = async (f: FieldDef, text: string) => {
    const auto = f.autofill;
    if (!auto) return;
    if (text.length !== auto.length) {
      setNotes((n) => ({ ...n, [f.key]: '' }));
      return;
    }
    setNotes((n) => ({ ...n, [f.key]: 'Looking up...' }));
    const found = await auto.fetch(text);
    // Ignore the answer if the user has typed something else meanwhile.
    setValues((v) => (v[f.key] === text && found ? { ...v, ...found } : v));
    setNotes((n) => ({ ...n, [f.key]: found ? 'Details filled in - edit if needed.' : 'Not found. Enter the details manually.' }));
  };
  const scroller = useRef<ScrollViewInstance>(null);
  const tops = useRef<Record<string, number>>({});
  const get = (f: FieldDef) => values[f.key] ?? f.initial ?? '';
  const setValue = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setMissing((m) => (m.includes(key) ? m.filter((k) => k !== key) : m));
  };
  const close = () => {
    setValues({});
    setOpenKey(null);
    setMissing([]);
    setNotes({});
    onClose();
  };
  const submit = async () => {
    if (busy) return;
    const out: Record<string, string> = {};
    fields.forEach((f) => (out[f.key] = f.secure ? get(f) : get(f).trim()));
    const empty = fields.filter((f) => !f.optional && !out[f.key]);
    if (empty.length) {
      setMissing(empty.map((f) => f.key));
      scroller.current?.scrollTo({ y: Math.max((tops.current[empty[0].key] ?? 0) - 12, 0), animated: true });
      return;
    }
    setMissing([]);
    setBusy(true);
    try {
      const r = await onSubmit(out);
      if (r !== false) {
        setValues({});
        setNotes({});
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} title={title} onClose={close}>
      <ScrollView
  ref={scroller}
  contentContainerStyle={[
    s.sheetBody,
    { paddingBottom: 40 },
  ]}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator
  nestedScrollEnabled
>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {fields.map((f) => (
          <View
            key={f.key}
            style={{ width: f.half ? '48%' : '100%' }}
            onLayout={(e) => (tops.current[f.key] = e.nativeEvent.layout.y)}
          >
            <Text style={s.label}>{f.label}</Text>
            {f.options ? (
              <>
                <Pressable style={[s.input, s.dropdown, missing.includes(f.key) && s.inputError]} onPress={() => setOpenKey(openKey === f.key ? null : f.key)}>
                  <Text style={{ flex: 1, fontSize: 14, color: get(f) ? colors.text : colors.muted }}>
                    {f.options.find((o) => o.code === get(f))?.label || get(f) || 'Select'}
                  </Text>
                  <Ionicons name={openKey === f.key ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                </Pressable>
                {openKey === f.key && (
                  <View style={s.dropdownList}>
                    {f.options.map((o) => (
                      <Pressable
                        key={o.code}
                        style={[s.dropdownRow, o.code === get(f) && { backgroundColor: colors.primaryLight }]}
                        onPress={() => {
                          // A checklist that depends on this dropdown (e.g. amenities on stay type) starts over.
                          setValues((v) => {
                            const next = { ...v, [f.key]: o.code };
                            if (o.code !== get(f)) fields.forEach((x) => x.resetOn === f.key && delete next[x.key]);
                            return next;
                          });
                          setMissing((m) => m.filter((k) => k !== f.key));
                          setOpenKey(null);
                          onFieldChange?.(f.key, o.code);
                        }}
                      >
                        <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{o.label}</Text>
                        {o.code === get(f) && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            ) : f.date ? (
              <DateField
                value={get(f)}
                onChange={(d) => setValue(f.key, d)}
                min={f.min}
                max={f.max}
                clearable={f.optional}
              />
            ) : f.checklist ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, marginTop: 4 }}>
                {f.checklist.length === 0 && <Text style={[s.muted, { padding: 10 }]}>Nothing to choose yet.</Text>}
                {f.checklist.map((o) => {
                  const ticked = new Set(get(f).split(',').filter(Boolean));
                  const on = o.locked || ticked.has(o.code);
                  return (
                    <TouchableOpacity
                      key={o.code}
                      disabled={o.locked}
                      style={[
                        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
                        on && { backgroundColor: '#2563eb', borderColor: '#2563eb' },
                      ]}
                      onPress={() => {
                        if (!ticked.delete(o.code)) ticked.add(o.code);
                        setValues((v) => ({ ...v, [f.key]: [...ticked].join(',') }));
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#fff' : '#334155' }}>
                        {on ? '✓ ' : '+ '}{o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
            <TextInput
              style={[s.input, missing.includes(f.key) && s.inputError, f.readOnly && { backgroundColor: '#f1f5f9' }]}
              value={get(f)}
              editable={!f.readOnly}
              placeholder={f.placeholder}
              keyboardType={f.keyboard}
              secureTextEntry={f.secure}
              autoCapitalize={f.secure || f.keyboard ? 'none' : undefined}
              autoCorrect={f.secure ? false : undefined}
              placeholderTextColor={colors.muted}
              maxLength={f.autofill?.length}
              onChangeText={(t) => {
                setValue(f.key, t);
                if (f.autofill) runAutofill(f, t.trim());
              }}
            />
            )}
            {!!notes[f.key] && <Text style={[s.muted, { fontSize: 12, marginBottom: 6 }]}>{notes[f.key]}</Text>}
            {missing.includes(f.key) && <Text style={s.fieldError}>{requiredMessage(f)}</Text>}
          </View>
        ))}
        </View>
        {extra}
        {missing.length > 0 && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.bad} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.bad }}>
              Please fill in: {fields.filter((f) => missing.includes(f.key)).map(plainLabel).join(', ')}
            </Text>
          </View>
        )}
        <Pressable style={[s.saveBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{submitLabel}</Text>}
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

let propertyCache: { owner: string; list: PropertyCard[] } | null = null;

/**
 * Owner's property switcher: "All My Properties" (consolidated) or one property, plus adding a new one.
 * Switching swaps the session token to that property; the app remounts so every screen reloads.
 */
export function PropertySwitcher({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, selectPg, viewAllProperties } = useAuth();
  const owner = user?.username ?? '';
  const [fetched, setList] = useState<PropertyCard[] | null>(null);
  const list = fetched ?? (propertyCache?.owner === owner ? propertyCache.list : null);
  const [adding, setAdding] = useState(false);
  // Leave room for the sheet's handle and title so a long list scrolls inside the sheet instead of being cut off.
  const listMaxHeight = Math.round(useWindowDimensions().height * 0.7);


  // The list rarely changes and the app remounts on every switch, so it is fetched once per sign-in and kept
  // in memory; adding a property (or signing in as someone else) refreshes it.
  React.useEffect(() => {
    if (!visible) return;
    if (propertyCache?.owner === owner) return;
    let live = true;
    get<PropertyCard[]>('/api/pg/properties')
      .then((r) => {
        propertyCache = { owner, list: r };
        if (live) setList(r);
      })
      .catch(() => live && setList([])); // a failed load is not cached, so the next open retries
    return () => {
      live = false;
    };
  }, [visible, owner]);

  const choose = async (pgId: number) => {
    onClose();
    if (!user?.allProperties && pgId === user?.pgId) return;
    await attempt(() => selectPg(pgId));
  };

  const chooseAll = async () => {
    onClose();
    if (!user?.allProperties) await attempt(() => viewAllProperties());
  };

  const count = list?.length ?? 0;
  const totalBeds = (list ?? []).reduce((n, p) => n + p.beds, 0);
  const totalResidents = (list ?? []).reduce((n, p) => n + p.residents, 0);

  return (
    <>
      <Sheet visible={visible && !adding} title="Switch Property" onClose={onClose}>
        <ScrollView
          style={{ maxHeight: listMaxHeight }}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
          showsVerticalScrollIndicator
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[s.muted, { marginBottom: 10 }]}>Select a property to view and manage</Text>

          {count > 1 && (
            <Pressable
              onPress={chooseAll}
              style={[switchStyles.row, user?.allProperties && switchStyles.rowOn]}
              accessibilityRole="button"
            >
              <View style={switchStyles.icon}>
                <Ionicons name="business" size={22} color={colors.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={switchStyles.name}>All My Properties</Text>
                <Text style={s.muted}>
                  Consolidated view · {count} properties · {totalBeds} beds · {totalResidents} residents
                </Text>
              </View>
              {user?.allProperties ? (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              )}
            </Pressable>
          )}

          {list === null && <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />}
          {(list ?? []).map((p) => {
            const on = !user?.allProperties && p.id === user?.pgId;
            return (
              <Pressable
                key={p.id}
                onPress={() => choose(p.id)}
                disabled={!p.licenseValid}
                style={[switchStyles.row, on && switchStyles.rowOn, !p.licenseValid && { opacity: 0.5 }]}
                accessibilityRole="button"
              >
                <View style={switchStyles.icon}>
                  <Ionicons name="business-outline" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={switchStyles.name} numberOfLines={1}>{p.name}</Text>
                  {!!(p.city || p.address) && (
                    <Text style={s.muted} numberOfLines={1}>{p.city || p.address}</Text>
                  )}
                  <Text style={s.muted}>
                    {p.licenseValid ? `${p.beds} Beds · ${p.residents} Residents` : 'Licence expired'}
                  </Text>
                </View>
                <Ionicons
                  name={on ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={on ? colors.primary : colors.border}
                />
              </Pressable>
            );
          })}

          <Pressable style={switchStyles.add} onPress={() => setAdding(true)} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={22} color={colors.blue} />
            <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 15 }}>Add New Property</Text>
          </Pressable>
        </ScrollView>
      </Sheet>

      <AddPropertyModal
        visible={visible && adding}
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          onClose();
        }}
      />
    </>
  );
}

/**
 * Four-step property wizard. By default it adds another property and switches the app to it; with `editing` it loads
 * the current property's profile and saves the changes back to it.
 */
export function AddPropertyModal({
  visible,
  onClose,
  onCreated,
  editing = false,
  registration = false,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
  editing?: boolean;
  /** "Register as Owner" (signed out): an extra first step takes the owner's login, and the request goes to the admin. */
  registration?: boolean;
}) {
  const registering = registration;
  // The account step comes first when registering, so the property steps are shifted by one.
  const offset = registering ? 1 : 0;
  const totalSteps = 4 + offset;
  const { selectPg } = useAuth();

  const stayTypes = useLookup(STAY_TYPE);
  const genderPolicies = useLookup(GENDER_POLICY);

  const defaultType =
    stayTypes.find(t => t.code === 'PG')?.code ??
    stayTypes[0]?.code ??
    '';

  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [type, setType] = useState<string | null>(null);
  const [pictures, setPictures] = useState<PickedFile[]>([]);
  const [place, setPlace] = useState<GeoPlace | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customAmenity, setCustomAmenity] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const customRowRef = useRef<React.ComponentRef<typeof View>>(null);

  // The keyboard covers the bottom of the screen without resizing the modal, so the card shrinks to what is left.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
      setKeyboardHeight(0);
    };
  }, [visible]);

  // Editing: fill the form with what is saved for the current property.
  useEffect(() => {
    if (!visible || !editing) return;
    let live = true;
    setLoading(true);
    get<any>('/api/pg/profile')
      .then((p) => {
        if (!live || !p) return;
        const text = (v: unknown) => (v == null ? '' : String(v));
        setType(p.stayType || null);
        setValues({
          name: text(p.name),
          stayType: p.stayType || 'PG',
          unitLabel: text(p.unitLabel),
          pincode: text(p.pincode),
          area: text(p.locality),
          address: text(p.address),
          city: text(p.city),
          state: text(p.state),
          totalFloors: text(p.totalFloors),
          description: text(p.description),
          amenities: text(p.amenities).split(',').map((a) => a.trim()).filter(Boolean).join(','),
          genderType: p.genderType || 'CO_LIVING',
          rules: text(p.rules),
          upiId: text(p.upiId),
          upiName: text(p.upiName),
          contactMobile: text(p.mobile),
          alternateMobile: text(p.alternateMobile),
          startingPrice: p.startingPrice ? String(p.startingPrice) : '5000',
        });
        setPlace(
          p.latitude != null && p.longitude != null
            ? {
                formattedAddress: [p.subLocality || p.locality, p.city].filter(Boolean).join(', ') || 'Saved location',
                latitude: p.latitude,
                longitude: p.longitude,
                locality: p.locality,
                subLocality: p.subLocality,
                city: p.city,
                state: p.state,
                pincode: p.pincode,
                country: p.country,
              }
            : null
        );
      })
      .catch(() => Alert.alert('Could not load', 'The property details could not be loaded. Try again.'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [visible, editing]);

  const amenities = useTypeAmenities(
    visible ? type ?? defaultType : undefined
  );

  const steps = newPropertySteps({
    stayTypes,
    genderPolicies,
    defaultType,
    amenities,
  });

  const pStep = step - offset; // -1 while on the account step
  const current = steps[Math.max(pStep, 0)];

  /** Owner's own login, kept apart from the property's contact details. */
  const accountFields: FieldDef[] = [
    { key: 'ownerName', label: 'Your Full Name *' },
    { key: 'mobile', label: 'Mobile Number * (your login)', keyboard: 'phone-pad' },
    { key: 'email', label: 'Email (optional)', keyboard: 'email-address', optional: true },
    { key: 'password', label: 'Password * (min 6 characters)', secure: true },
    { key: 'confirm', label: 'Confirm Password *', secure: true },
  ];

  const getValue = (key: string, initial = '') =>
    values[key] ?? initial;

  const updateValue = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setMissing(prev => prev.filter(k => k !== key));
  };

  const reset = () => {
    setStep(0);
    setValues({});
    setType(null);
    setPictures([]);
    setPlace(null);
    setBusy(false);
    setMissing([]);
    setNotes({});
    setOpenKey(null);
    setCustomAmenity('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const validateStep = () => {
    const stepFields = pStep < 0 ? accountFields : current.fields;
    const empty = stepFields.filter(field => {
      if (field.optional) return false;

      return !getValue(field.key, field.initial).trim();
    });

    if (empty.length) {
      setMissing(empty.map(field => field.key));

      Alert.alert(
        'Required information',
        `Please complete: ${empty.map(f => f.label.replace('*', '').trim()).join(', ')}`
      );

      return false;
    }

    if (pStep < 0) {
      if (!/^\d{10,15}$/.test(getValue('mobile').trim())) {
        setMissing(['mobile']);
        Alert.alert('Invalid mobile', 'Enter a 10-15 digit mobile number.');
        return false;
      }
      if (getValue('password').length < 6) {
        setMissing(['password']);
        Alert.alert('Password too short', 'Use at least 6 characters.');
        return false;
      }
      if (getValue('password') !== getValue('confirm')) {
        setMissing(['confirm']);
        Alert.alert('Passwords do not match', 'Enter the same password twice.');
        return false;
      }
    }

    if (pStep === 0) {
      if (!/^\d{6}$/.test(getValue('pincode').trim())) {
        setMissing(['pincode']);
        Alert.alert('Invalid pincode', 'Enter a valid 6-digit pincode.');
        return false;
      }

      // Area, city and state cannot be typed, so they are empty until the pincode has been found.
      if (!getValue('city').trim() || !getValue('state').trim()) {
        setMissing(['pincode']);
        Alert.alert(
          'Pincode not verified',
          notes.pincode === 'Looking up...'
            ? 'Please wait while the pincode is being looked up.'
            : 'We could not find this pincode. Check it and try again.'
        );
        return false;
      }

      if (!(parseInt(getValue('totalFloors'), 10) > 0)) {
        setMissing(['totalFloors']);
        Alert.alert('Number of floors', 'Enter how many floors the property has (1 or more).');
        return false;
      }

      if (!place) {
        Alert.alert('Property location', 'Choose the property location (use my location or search), so residents can find it.');
        return false;
      }
    }

    if (pStep === 3) {
      if (!upiIsValid(getValue('upiId'))) return false;

      // A saved number may carry a country code, so editing accepts 10 to 15 digits.
      const phoneOk = (n: string) => (editing ? /^\d{10,15}$/ : /^\d{10}$/).test(n);
      const phoneHint = editing ? '10 to 15 digits' : '10 digits';

      if (getValue('contactMobile') && !phoneOk(getValue('contactMobile').trim())) {
        Alert.alert('Invalid mobile', `Enter a valid contact number (${phoneHint}).`);
        return false;
      }

      if (getValue('alternateMobile') && !phoneOk(getValue('alternateMobile').trim())) {
        Alert.alert('Invalid alternate mobile', `Enter a valid alternate number (${phoneHint}).`);
        return false;
      }

      if (
        getValue('alternateMobile').trim() &&
        getValue('alternateMobile').trim() === getValue('contactMobile').trim()
      ) {
        Alert.alert('Same number', 'The alternate number must be different from the contact mobile.');
        return false;
      }
    }

    setMissing([]);
    return true;
  };

  const next = () => {
    if (!validateStep()) return;

    if (step < totalSteps - 1) {
      setStep(prev => prev + 1);
      setOpenKey(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const back = () => {
    if (step > 0) {
      setStep(prev => prev - 1);
      setOpenKey(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      close();
    }
  };

  const lookupPin = async (pin: string) => {
    const field = current.fields.find(f => f.key === 'pincode');

    if (!field?.autofill) return;
    if (pin.length !== field.autofill.length) return;

    setNotes(prev => ({ ...prev, pincode: 'Looking up...' }));

    const result = await field.autofill.fetch(pin);

    // Ignore the answer if the pincode was changed while it was being looked up.
    let stillCurrent = true;
    setValues(prev => {
      if (prev.pincode !== pin) {
        stillCurrent = false;
        return prev;
      }
      return result
        ? { ...prev, ...result }
        : { ...prev, area: '', city: '', state: '' };
    });
    if (!stillCurrent) return;

    setNotes(prev => ({
      ...prev,
      pincode: result
        ? 'Area, city and state filled from the pincode.'
        : 'Pincode not found. Check it and try again.',
    }));
  };

  const submit = async () => {
    if (!validateStep() || busy) return;

    setBusy(true);

    try {
      if (registering) {
        const sent = await attempt(() =>
          post(
            '/api/public/owner-registrations',
            {
              ...newPropertyBody(values, stayTypes, amenities, place),
              ownerName: (values.ownerName ?? '').trim(),
              mobile: (values.mobile ?? '').trim(),
              email: (values.email ?? '').trim() || undefined,
              password: values.password,
              contactMobile: (values.contactMobile ?? '').trim() || undefined,
            },
            { auth: false }
          )
        );
        if (!sent) return;
        const loginMobile = (values.mobile ?? '').trim();
        reset();
        onClose();
        Alert.alert(
          'Request sent',
          `Thank you! Your property is waiting for the administrator's approval. Sign in with ${loginMobile} and your password once it is approved.`
        );
        return;
      }

      if (editing) {
        const { amenityCodes: _codes, ...base } = newPropertyBody(values, stayTypes, amenities, place);
        const saved = await attempt(() =>
          put('/api/pg/profile', {
            ...base,
            // Blank values are sent as '' so a cleared box is cleared on the server too.
            locality: base.locality ?? '',
            pincode: base.pincode ?? '',
            address: (values.address ?? '').trim(),
            city: (values.city || place?.city || '').trim(),
            state: (values.state || place?.state || '').trim(),
            description: (values.description ?? '').trim(),
            upiName: (values.upiName ?? '').trim(),
            mobile: (values.contactMobile ?? '').trim(),
            alternateMobile: (values.alternateMobile ?? '').trim(),
            rules: (values.rules ?? '').trim(),
            amenities: (values.amenities ?? '').split(',').filter(Boolean).join(', '),
          })
        );
        if (!saved) return;
        propertyCache = null;
        reset();
        onCreated?.();
        Alert.alert('Saved', 'Property details updated.');
        return;
      }

      let createdId: number | null = null;

      const ok = await attempt(async () => {
        const created = await post<PropertyCard>(
          '/api/pg/properties',
          {
            ...newPropertyBody(
              values,
              stayTypes,
              amenities,
              place
            ),
            mobile: values.contactMobile || undefined,
          }
        );
        createdId = created.id;
      });

      if (!ok || createdId == null) return;

      propertyCache = null;

      if (pictures.length) {
        const problem = await uploadPictures(
          `/api/media/property/${createdId}`,
          pictures
        );

        if (problem) {
          Alert.alert('Property added', problem);
        }
      }

      reset();
      onCreated?.();

      await attempt(() => selectPg(createdId!));

    } finally {
      setBusy(false);
    }
  };

  /** Adds the typed name to the ticked amenities (commas are not allowed in a name; duplicates are ignored). */
  const addCustomAmenity = (field: FieldDef) => {
    const name = customAmenity.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name) return;

    const current = getValue(field.key, field.initial).split(',').filter(Boolean);
    const offered = (field.checklist ?? []).map(i => i.code);
    const existing = [...current, ...offered].find(
      c => c.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      // Already there or offered: just make sure it is ticked.
      if (!current.includes(existing)) {
        updateValue(field.key, [...current, existing].join(','));
      }
    } else {
      updateValue(field.key, [...current, name].join(','));
    }
    setCustomAmenity('');
  };


  const renderField = (field: FieldDef) => {
    const value = getValue(field.key, field.initial);

    const label = field.label;

    return (
      <View key={field.key} style={{ marginBottom: 16 }}>
        <Text style={wizardStyles.label}>{label}</Text>

        {field.options ? (
          <View style={wizardStyles.optionRow}>
            {field.options.map(option => {
              const selected = value === option.code;
              const optionIcons: Record<string, IconName> = {
                APARTMENT: 'business-outline',
                PG: 'bed-outline',
                HOSTEL: 'people-outline',
                COLIVING: 'home-outline',
                STUDIO: 'cube-outline',
                CO_LIVING: 'people-circle-outline',
                GENTS: 'man-outline',
                LADIES: 'woman-outline',
              };

              return (
                <Pressable
                  key={option.code}
                  onPress={() => {
                    updateValue(field.key, option.code);
                    setOpenKey(null);

                    if (field.key === 'stayType') {
                      setType(option.code);
                      updateValue('amenities', '');
                    }
                  }}
                  style={[
                    wizardStyles.option,
                    selected && wizardStyles.optionSelected,
                  ]}
                >
                  <Ionicons
                    name={optionIcons[option.code] || 'home-outline'}
                    size={18}
                    color={selected ? colors.primary : colors.muted}
                  />
                  <Text
                    style={{
                      color: selected ? colors.primary : colors.text,
                      fontWeight: selected ? '700' : '500',
                      fontSize: 13,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : field.checklist ? (
          <>
          <View style={wizardStyles.amenityGrid}>
            {field.checklist.map(item => {
              const selected =
                item.locked ||
                value.split(',').includes(item.code);

              const icons: Record<string, IconName> = {
                Lift: 'business-outline',
                'Bike Parking': 'bicycle-outline',
                'Car Parking': 'car-outline',
                Watchman: 'shield-checkmark-outline',
                'Wi-Fi': 'wifi-outline',
                'Power Backup': 'flash-outline',
                'RO Drinking Water': 'water-outline',
                'Washing Machine': 'shirt-outline',
                Fridge: 'snow-outline',
                'CCTV Security': 'videocam-outline',
                'Finger Print': 'finger-print-outline',
                Geyser: 'thermometer-outline',
                'Daily Cleaning': 'sparkles-outline',
                'Food / Mess': 'restaurant-outline',
                Gym: 'fitness-outline',
              };

              return (
                <Pressable
                  key={item.code}
                  disabled={item.locked}
                  onPress={() => {
                    const selectedCodes = value
                      .split(',')
                      .filter(Boolean);

                    const nextCodes = selectedCodes.includes(item.code)
                      ? selectedCodes.filter(c => c !== item.code)
                      : [...selectedCodes, item.code];

                    updateValue(
                      field.key,
                      [...new Set(nextCodes)].join(',')
                    );
                  }}
                  style={[
                    wizardStyles.amenity,
                    selected && wizardStyles.amenitySelected,
                  ]}
                >
                  <Ionicons
                    name={icons[item.code] || 'checkmark-circle-outline'}
                    size={14}
                    color={selected ? colors.primary : colors.muted}
                  />

                  <Text
                    style={{
                      fontSize: 11,
                      color: selected ? colors.primary : colors.text,
                      fontWeight: selected ? '700' : '600',
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}

            {/* Amenities the owner added themselves; tap one to remove it. */}
            {value
              .split(',')
              .filter(code => code && !field.checklist!.some(item => item.code === code))
              .map(code => (
                <Pressable
                  key={`custom-${code}`}
                  onPress={() =>
                    updateValue(
                      field.key,
                      value.split(',').filter(c => c && c !== code).join(',')
                    )
                  }
                  style={[wizardStyles.amenity, wizardStyles.amenitySelected]}
                >
                  <Ionicons name="star-outline" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                    {code}
                  </Text>
                  <Ionicons name="close" size={13} color={colors.primary} />
                </Pressable>
              ))}
          </View>

          <View ref={customRowRef} style={wizardStyles.customRow}>
            <TextInput
              style={[wizardStyles.input, { flex: 1, marginBottom: 0 }]}
              value={customAmenity}
              onChangeText={setCustomAmenity}
              onFocus={() => {
                // Wait for the keyboard to open and the card to shrink, then bring the box into view.
                setTimeout(() => {
                  const scroller = scrollRef.current;
                  if (!scroller || !customRowRef.current) return;
                  customRowRef.current.measureLayout(
                    scroller as any,
                    (_x: number, y: number) => scroller.scrollTo({ y: Math.max(0, y - 120), animated: true }),
                    () => {}
                  );
                }, 250);
              }}
              onSubmitEditing={() => addCustomAmenity(field)}
              placeholder="Add your own (e.g. Garden)"
              placeholderTextColor={colors.muted}
              maxLength={40}
              returnKeyType="done"
            />
            <Pressable
              onPress={() => addCustomAmenity(field)}
              style={wizardStyles.customAdd}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={wizardStyles.customAddText}>Add</Text>
            </Pressable>
          </View>
          </>
        ) : (
          <TextInput
            style={[
              wizardStyles.input,
              field.multiline && { height: 120, paddingTop: 12, textAlignVertical: 'top' },
              field.readOnly && { backgroundColor: '#f1f5f9', color: colors.text },
              missing.includes(field.key) && wizardStyles.inputError,
            ]}
            multiline={field.multiline}
            value={value}
            editable={!field.readOnly}
            onChangeText={text => {
              if (field.key === 'pincode') {
                const pin = text.replace(/\D/g, '');
                // Area, city and state belong to the pincode: drop them while it is incomplete or being changed.
                setValues(prev => ({
                  ...prev,
                  pincode: pin,
                  ...(pin.length === 6 ? {} : { area: '', city: '', state: '' }),
                }));
                setMissing(prev => prev.filter(k => k !== 'pincode'));
                setNotes(prev => ({ ...prev, pincode: '' }));
                if (pin.length === 6) lookupPin(pin);
                return;
              }

              updateValue(field.key, text);
            }}
            keyboardType={field.keyboard}
            secureTextEntry={field.secure}
            autoCorrect={field.secure ? false : undefined}
            placeholder={field.placeholder ?? `Enter ${label.replace('*', '').toLowerCase()}`}
            placeholderTextColor={colors.muted}
            autoCapitalize={
              field.secure ||
              field.keyboard === 'email-address' ||
              field.keyboard === 'url'
                ? 'none'
                : 'sentences'
            }
            maxLength={field.key === 'pincode' ? 6 : field.key === 'rules' ? 4000 : undefined}
          />
        )}

        {!!notes[field.key] && (
          <Text style={wizardStyles.note}>
            {notes[field.key]}
          </Text>
        )}

        {missing.includes(field.key) && (
          <Text style={wizardStyles.error}>
            This field is required.
          </Text>
        )}
      </View>
    );
  };

  const summaryRow = (label: string, value: string) => (
    <View style={wizardStyles.summaryRow} key={label}>
      <Text style={wizardStyles.summaryLabel}>{label}</Text>
      <Text style={wizardStyles.summaryValue}>
        {value || 'Not provided'}
      </Text>
    </View>
  );

  const selectedAmenityCount = getValue('amenities')
    .split(',')
    .filter(Boolean).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View
        style={[
          wizardStyles.backdrop,
          { paddingTop: insets.top + 24, paddingBottom: (keyboardHeight || insets.bottom) + 24 },
        ]}
      >
      <View
        style={[
          wizardStyles.dialog,
          {
            height: Math.min(
              windowHeight - insets.top - (keyboardHeight || insets.bottom) - 48,
              720
            ),
          },
        ]}
      >
        {/* HEADER */}
        <View style={wizardStyles.header}>
          <Pressable onPress={back} style={wizardStyles.headerBack}>
            <Ionicons name="arrow-back" size={23} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={wizardStyles.headerTitle}>
              {registering ? 'Register as Owner' : editing ? 'Edit Property' : 'Add New Property'}
            </Text>
            <Text style={wizardStyles.headerSubtitle}>
              Step {step + 1} of {totalSteps}
            </Text>
          </View>

          <Pressable onPress={close}>
            <Ionicons name="close-circle-outline" size={25} color={colors.muted} />
          </Pressable>
        </View>

        {/* PROGRESS */}
        <View style={wizardStyles.progressWrap}>
          <View style={wizardStyles.progressTrack}>
            <View
              style={[
                wizardStyles.progressFill,
                { width: `${((step + 1) / totalSteps) * 100}%` },
              ]}
            />
          </View>

          <View style={wizardStyles.stepLabels}>
            {[...(registering ? ['Account'] : []), 'Basic Info', 'Amenities', 'Policy', 'Payment'].map(
              (label, index) => (
                <Pressable
                  key={label}
                  onPress={() => {
                    if (index < step || editing) setStep(index);
                  }}
                  style={{ flex: 1 }}
                >
                  <View
                    style={[
                      wizardStyles.stepDot,
                      index <= step && wizardStyles.stepDotActive,
                    ]}
                  >
                    {index < step ? (
                      <Ionicons name="checkmark" size={13} color="#fff" />
                    ) : (
                      <Text
                        style={{
                          fontSize: 11,
                          color: index === step ? '#fff' : colors.muted,
                          fontWeight: '700',
                        }}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      wizardStyles.stepText,
                      index === step && { color: colors.primary, fontWeight: '800' },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </View>

        {/* CONTENT */}
        {loading ? (
          <ActivityIndicator style={{ marginVertical: 40, flex: 1 }} size="large" color={colors.primary} />
        ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={wizardStyles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={wizardStyles.intro}>
            <Text style={wizardStyles.title}>
              {pStep < 0 ? 'Your Account' : current.title}
            </Text>
            <Text style={wizardStyles.subtitle}>
              {pStep < 0 ? 'The login you will use once your property is approved' : current.subtitle}
            </Text>
          </View>

          {/* ACCOUNT (registration only) */}
          {pStep < 0 && (
            <Card>
              {accountFields.map(renderField)}
              <Text style={wizardStyles.note}>
                The administrator reviews every new property before it goes live. You can add pictures and rooms once it
                is approved and you have signed in.
              </Text>
            </Card>
          )}

          {/* STEP 1 */}
          {pStep === 0 && (
            <Card>
              {current.fields.map(renderField)}

              <View style={wizardStyles.locationCard}>
                <View style={wizardStyles.locationHeading}>
                  <Ionicons
                    name="location-outline"
                    size={21}
                    color={colors.primary}
                  />
                  <Text style={wizardStyles.cardHeading}>
                    Property Location <Text style={{ color: colors.bad }}>*</Text>
                  </Text>
                </View>
                <LocationPickerField
                  value={place}
                  onChange={setPlace}
                />
              </View>
            </Card>
          )}

          {/* STEP 2 */}
          {pStep === 1 && (
            <>
              <View style={wizardStyles.infoCard}>
                <Ionicons name="information-circle-outline" size={19} color={colors.primary} />
                <Text style={wizardStyles.infoText}>
                  Select the facilities available throughout your property.
                  Room-specific facilities can be added later.
                </Text>
              </View>

              <Card>
                {current.fields.map(renderField)}

                <Text style={wizardStyles.note}>
                  {selectedAmenityCount} amenities selected
                </Text>
              </Card>

              {!editing && !registering && (
                <ImagePickerField
                  label="Property Pictures (up to 10)"
                  files={pictures}
                  onChange={setPictures}
                  max={10}
                />
              )}
            </>
          )}

          {/* STEP 3 */}
          {pStep === 2 && (
            <Card>
              <Text style={wizardStyles.cardHeading}>
                Who can stay at this property?
              </Text>

              <Text style={[wizardStyles.subtitle, { marginBottom: 18 }]}>
                Choose your occupancy preference and write the house rules.
              </Text>

              {current.fields.map(renderField)}

              <View style={wizardStyles.infoCard}>
                <Ionicons name="information-circle-outline" size={19} color={colors.primary} />
                <Text style={wizardStyles.infoText}>
                  Rules are shown to residents on their Notice Board.
                  You can change them anytime from Account.
                </Text>
              </View>
            </Card>
          )}

          {/* STEP 4 */}
          {pStep === 3 && (
            <>
              <Card>
                <Text style={wizardStyles.cardHeading}>
                  Rent Collection Details
                </Text>
                {current.fields.map(renderField)}
              </Card>

              <Card>
                <Text style={wizardStyles.cardHeading}>
                  Property Summary
                </Text>

                {summaryRow('Property', getValue('name'))}
                {summaryRow(
                  'Stay Type',
                  stayTypes.find(t => t.code === getValue('stayType', defaultType))?.label ?? ''
                )}
                {summaryRow(
                  'Occupancy',
                  genderPolicies.find(p => p.code === getValue('genderType', 'CO_LIVING'))?.label ?? ''
                )}
                {summaryRow('City', getValue('city'))}
                {summaryRow('Starting Rent', `₹${getValue('startingPrice', '5000')}`)}
                {summaryRow('Amenities', `${selectedAmenityCount} selected`)}
                {!editing && !registering && summaryRow('Pictures', `${pictures.length} uploaded`)}
              </Card>
            </>
          )}
        </ScrollView>
        )}

        {/* FIXED BOTTOM ACTIONS */}
        <View style={wizardStyles.footer}>
          {step > 0 && (
            <Pressable
              onPress={back}
              disabled={busy}
              style={wizardStyles.backButton}
            >
              <Text style={wizardStyles.backButtonText}>Back</Text>
            </Pressable>
          )}

          <Pressable
            onPress={step === totalSteps - 1 ? submit : next}
            disabled={busy || loading}
            style={[
              wizardStyles.nextButton,
              { flex: 1 },
              busy && { opacity: 0.6 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={wizardStyles.nextButtonText}>
                  {step === totalSteps - 1
                    ? registering
                      ? 'Send for approval'
                      : editing
                      ? 'Save Changes'
                      : 'Create Property'
                    : 'Continue'}
                </Text>
                <Ionicons
                  name={step === totalSteps - 1 ? 'checkmark-circle-outline' : 'arrow-forward'}
                  size={19}
                  color="#fff"
                />
              </>
            )}
          </Pressable>
        </View>
      </View>
      </View>
    </Modal>
  );
}

/** Shown instead of a per-property screen while the owner is looking at "All Properties". */
export function PropertyRequired({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Screen title={title}>
      <Card>
        <Text style={s.h2}>Pick a property</Text>
        <Text style={[s.muted, { marginVertical: 6 }]}>
          {title} are managed one property at a time. Choose a property to continue.
        </Text>
        <Button label="Choose property" onPress={() => setOpen(true)} />
      </Card>
      <PropertySwitcher visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}

/* PROPERTY WIZARD STYLES */

const wizardStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    paddingHorizontal: 16,
  },
  dialog: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.bg,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  headerBack: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
  progressWrap: {
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  progressTrack: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  stepLabels: {
    flexDirection: 'row',
    marginTop: 13,
  },
  stepDot: {
    width: 25,
    height: 25,
    borderRadius: 14,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepText: {
    fontSize: 10,
    color: colors.muted,
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  intro: {
    marginBottom: 16,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 5,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 7,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.bg,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 14,
  },
  inputError: {
    borderColor: colors.bad,
  },
  error: {
    color: colors.bad,
    fontSize: 11,
    marginTop: 5,
  },
  note: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 7,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  optionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  customAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  customAddText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  amenityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  amenity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  amenitySelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 9,
    padding: 13,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    marginBottom: 13,
  },
  infoText: {
    flex: 1,
    color: colors.forest,
    fontSize: 12,
    lineHeight: 18,
  },
  locationCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  locationHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backButton: {
    minWidth: 85,
    height: 49,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  nextButton: {
    height: 49,
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});


const switchStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  rowOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
  },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.blue,
    backgroundColor: '#eff6ff',
    marginTop: 6,
  },
});


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
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 20,
  },
  sheet: {
  width: '100%',
  backgroundColor: '#fff',
  borderRadius: 24,
  overflow: 'hidden',
  paddingBottom: 8,
},
  handle: {
    height: 0,
    marginTop: 0,
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 16,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    height: 50,
    fontSize: 14,
    color: colors.text,
  },
  inputError: { borderColor: colors.bad, backgroundColor: '#fef2f2' },
  fieldError: { fontSize: 12, color: colors.bad, marginTop: 4 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.badLight, borderRadius: 12, padding: 12, marginTop: 16 },
  dropdown: { flexDirection: 'row', alignItems: 'center' },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    marginTop: 6,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    marginTop: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
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
  bellBtn: {
    padding: 4,
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
