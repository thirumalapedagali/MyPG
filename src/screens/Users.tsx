import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { del, get, post, put } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { ManagedUser, Resident, Role, Room } from '../types';
import { ALL_FLOORS, buildFloorNames, shortFloor } from './Rooms';
import {
  Avatar,
  Badge,
  Chips,
  Empty,
  FormModal,
  HeaderAction,
  PickerModal,
  Screen,
  colors,
} from '../ui';

type RoleChoice = { id: Role; label: string };

type UserFilter = 'ALL' | 'RESIDENT' | 'OWNER' | 'MANAGER' | 'ACTIVE' | 'BLOCKED';

const FILTERS: { id: UserFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'RESIDENT', label: 'Residents' },
  { id: 'OWNER', label: 'Owners' },
  { id: 'MANAGER', label: 'Managers' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'BLOCKED', label: 'Blocked' },
];

const isOwnerRole = (role: Role) => role === 'OWNER' || role === 'SUPER_ADMIN';

export default function Users() {
  const { user: me } = useAuth();
  const nav = useNavigation<NavigationProp<ParamListBase>>();

  const { data, error, loading, refreshing, refresh, reload } = useResource(async () => {
    const [users, residents, rooms] = await Promise.all([
      get<ManagedUser[]>('/api/users'),
      get<Resident[]>('/api/residents'),
      get<Room[]>('/api/rooms'),
    ]);

    return { users, residents, rooms };
  });

  // Search and filters
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>(ALL_FLOORS);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  // Add user / reset password flow
  const [pickRole, setPickRole] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [pickResident, setPickResident] = useState(false);
  const [residentId, setResidentId] = useState<number | null>(null);
  const [form, setForm] = useState(false);
  const [resetFor, setResetFor] = useState<ManagedUser | null>(null);

  const roles: RoleChoice[] = [
    { id: 'MANAGER', label: 'Manager (day-to-day operations)' },
    { id: 'RESIDENT', label: 'Resident (sees own dues)' },
    ...(me?.role === 'SUPER_ADMIN' ? [{ id: 'OWNER' as Role, label: 'Owner (full access)' }] : []),
  ];

  const withLogin = new Set(
    (data?.users ?? []).map((u) => u.residentId).filter((x): x is number => x !== null),
  );

  const freeResidents = (data?.residents ?? []).filter((r) => !withLogin.has(r.id));

  // Counts for the stats strip and the filter pills
  const counts = useMemo(() => {
    const users = data?.users ?? [];
    return {
      ALL: users.length,
      RESIDENT: users.filter((u) => u.role === 'RESIDENT').length,
      OWNER: users.filter((u) => isOwnerRole(u.role)).length,
      MANAGER: users.filter((u) => u.role === 'MANAGER').length,
      ACTIVE: users.filter((u) => u.status === 'ACTIVE').length,
      BLOCKED: users.filter((u) => u.status === 'BLOCKED').length,
    } as Record<UserFilter, number>;
  }, [data]);

  // Floor chips follow the property's floor count; floors found on rooms but not in the list are appended.
  const floorChips = useMemo(() => {
    const names = buildFloorNames(me?.totalFloors);
    for (const r of data?.rooms ?? []) {
      const f = r.floorName?.trim() || 'Ground Floor';
      if (!names.includes(f)) names.push(f);
    }
    return [ALL_FLOORS, ...names.map(shortFloor)];
  }, [data, me?.totalFloors]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];

    const query = search.trim().toLowerCase();

    return data.users.filter((u) => {
      const resident = data.residents.find((r) => r.id === u.residentId);

      // A floor filter keeps only users linked to a resident living on that floor.
      if (floorFilter !== ALL_FLOORS) {
        const room = resident ? data.rooms.find((r) => r.id === resident.roomId) : undefined;
        if (!room || shortFloor(room.floorName?.trim() || 'Ground Floor') !== floorFilter) return false;
      }

      const matchesSearch =
        !query ||
        u.username?.toLowerCase().includes(query) ||
        u.mobile?.toLowerCase().includes(query) ||
        resident?.name?.toLowerCase().includes(query);

      let matchesFilter = true;

      switch (filter) {
        case 'RESIDENT':
          matchesFilter = u.role === 'RESIDENT';
          break;
        case 'OWNER':
          matchesFilter = isOwnerRole(u.role);
          break;
        case 'MANAGER':
          matchesFilter = u.role === 'MANAGER';
          break;
        case 'ACTIVE':
          matchesFilter = u.status === 'ACTIVE';
          break;
        case 'BLOCKED':
          matchesFilter = u.status === 'BLOCKED';
          break;
        default:
          matchesFilter = true;
      }

      return matchesSearch && matchesFilter;
    });
  }, [data, search, filter, floorFilter]);

  const changeFilter = (next: UserFilter) => {
    setFilter(next);
    setExpandedUser(null);
  };

  const reset = () => {
    setPickRole(false);
    setPickResident(false);
    setForm(false);
    setRole(null);
    setResidentId(null);
  };

  const toggle = async (u: ManagedUser) => {
    const status = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';

    if (await attempt(() => put(`/api/users/${u.id}`, { status }))) {
      setExpandedUser(null);
      reload();
    }
  };

  const confirmDelete = (u: ManagedUser) =>
    Alert.alert('Delete user', `Delete ${u.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/users/${u.id}`))) {
            setExpandedUser(null);
            reload();
          }
        },
      },
    ]);

  const renderUser = (u: ManagedUser) => {
    const self = u.id === me?.userId;
    const resident = data?.residents.find((r) => r.id === u.residentId);
    const expanded = expandedUser === u.id;
    const blocked = u.status === 'BLOCKED';
    const meta = [u.mobile, resident?.name ? `Resident: ${resident.name}` : null]
      .filter(Boolean)
      .join(' · ');

    return (
      <View key={u.id} style={[st.row, blocked && st.rowBlocked]}>
        <Pressable
          style={st.rowMain}
          onPress={() => setExpandedUser(expanded ? null : u.id)}
          disabled={self}
          accessibilityRole="button"
          accessibilityLabel={`${u.username}, ${u.role}, ${u.status.toLowerCase()}`}
          accessibilityState={{ expanded }}
        >
          <Avatar name={u.username} />

          <View style={{ flex: 1 }}>
            <View style={st.nameRow}>
              <Text style={st.name} numberOfLines={1}>
                {u.username}
                {self ? ' (You)' : ''}
              </Text>
              <Badge text={u.role} color={isOwnerRole(u.role) ? colors.blue : '#287C48'} />
              {blocked ? <Badge text="Blocked" color={colors.bad} /> : null}
            </View>
            {meta ? (
              <Text style={st.meta} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>

          {!self && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'ellipsis-vertical'}
              size={18}
              color={colors.muted}
            />
          )}
        </Pressable>

        {!self && expanded && (
          <View style={st.actions}>
            <ActionChip
              icon="key-outline"
              label="Reset password"
              onPress={() => {
                setResetFor(u);
                setExpandedUser(null);
              }}
            />
            <ActionChip
              icon={blocked ? 'checkmark-circle-outline' : 'ban-outline'}
              label={blocked ? 'Unblock' : 'Block'}
              tone={blocked ? 'good' : 'neutral'}
              onPress={() => toggle(u)}
            />
            <ActionChip
              icon="trash-outline"
              label="Delete"
              tone="danger"
              onPress={() => confirmDelete(u)}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen
      title="Users"
      action={
        <View style={{ flexDirection: 'row' }}>
          <HeaderAction label="Add" icon="person-add" onPress={() => setPickRole(true)} />
          <HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />
        </View>
      }
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <View style={{ paddingBottom: 20 }}>
        {/* Stats strip: tap a cell to filter */}
        <View style={st.strip}>
          <StatCell label="Total users" value={counts.ALL} color="#0f172a" onPress={() => changeFilter('ALL')} />
          <StatCell label="Active" value={counts.ACTIVE} color="#16a34a" onPress={() => changeFilter('ACTIVE')} divider />
          <StatCell
            label="Blocked"
            value={counts.BLOCKED}
            color={counts.BLOCKED > 0 ? '#dc2626' : '#64748b'}
            onPress={() => changeFilter('BLOCKED')}
            divider
          />
        </View>

        {/* Search */}
        <View style={st.searchBar}>
          <Ionicons name="search-outline" size={17} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or mobile number"
            placeholderTextColor={colors.muted}
            style={st.searchInput}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills: one scrolling row with counts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={st.pillScroll}
          contentContainerStyle={st.pillContent}
        >
          {FILTERS.map((item) => {
            const on = filter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[st.pill, on && st.pillOn]}
                onPress={() => changeFilter(item.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[st.pillText, on && st.pillTextOn]}>
                  {item.label} ({counts[item.id]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Floor filter: shows users whose resident lives on that floor */}
        {floorChips.length > 2 && <Chips options={floorChips} value={floorFilter} onChange={setFloorFilter} />}

        {/* List */}
        {filteredUsers.length === 0 ? (
          <Empty text={search ? 'No matching users found.' : 'No users in this category.'} />
        ) : (
          <View style={{ gap: 6 }}>{filteredUsers.map(renderUser)}</View>
        )}
      </View>

      {/* Add user workflow (unchanged) */}
      <PickerModal
        visible={pickRole}
        title="New user type"
        items={roles}
        label={(r) => r.label}
        onClose={reset}
        onPick={(r) => {
          setPickRole(false);
          setRole(r.id);

          if (r.id === 'RESIDENT') {
            setPickResident(true);
          } else {
            setForm(true);
          }
        }}
      />

      <PickerModal
        visible={pickResident}
        title="Which resident is this login for?"
        items={freeResidents}
        label={(r) => `${r.name} · Room ${r.roomNumber ?? '-'}`}
        onClose={reset}
        onPick={(r) => {
          setPickResident(false);
          setResidentId(r.id);
          setForm(true);
        }}
      />

      <FormModal
        visible={form}
        title={role === 'RESIDENT' ? 'Resident login' : `New ${role?.toLowerCase() ?? 'user'}`}
        fields={[
          { key: 'username', label: 'Username' },
          { key: 'mobile', label: 'Mobile (10-15 digits)', keyboard: 'phone-pad' },
          { key: 'password', label: 'Temporary password (min 4 characters)', secure: true },
        ]}
        onClose={reset}
        onSubmit={async (v) => {
          if (v.password.length < 4) {
            Alert.alert('Too short', 'Use at least 4 characters.');
            return false;
          }

          const body = {
            username: v.username,
            mobile: v.mobile,
            password: v.password,
            role,
            residentId,
          };

          if (!(await attempt(() => post('/api/users', body)))) {
            return false;
          }

          reset();
          reload();

          Alert.alert('User created', 'They will be asked to choose a new password at first login.');
        }}
      />

      {/* Reset password workflow (unchanged) */}
      <FormModal
        visible={resetFor !== null}
        title={`Reset password · ${resetFor?.username ?? ''}`}
        fields={[
          { key: 'password', label: 'New temporary password (min 4 characters)', secure: true },
        ]}
        onClose={() => setResetFor(null)}
        onSubmit={async (v) => {
          if (v.password.length < 4) {
            Alert.alert('Too short', 'Use at least 4 characters.');
            return false;
          }

          if (
            !(await attempt(() =>
              put(`/api/users/${resetFor!.id}`, {
                newPassword: v.password,
              }),
            ))
          ) {
            return false;
          }

          setResetFor(null);
          reload();
        }}
      />
    </Screen>
  );
}

/** One figure in the stats strip. */
function StatCell({
  label,
  value,
  color,
  onPress,
  divider,
}: {
  label: string;
  value: number;
  color: string;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[st.stripCell, divider && st.stripLeft]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}, tap to filter`}
    >
      <Text style={st.stripLabel}>{label}</Text>
      <Text style={[st.stripValue, { color }]}>{value}</Text>
    </TouchableOpacity>
  );
}

/** Compact action button used in the expanded row. */
function ActionChip({
  icon,
  label,
  tone = 'neutral',
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  tone?: 'neutral' | 'good' | 'danger';
  onPress: () => void;
}) {
  const palette =
    tone === 'danger'
      ? { bg: '#fef2f2', fg: '#dc2626' }
      : tone === 'good'
        ? { bg: '#f0fdf4', fg: '#15803d' }
        : { bg: '#f1f5f9', fg: '#0f172a' };

  return (
    <TouchableOpacity
      style={[st.chip, { backgroundColor: palette.bg }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={15} color={palette.fg} />
      <Text style={[st.chipText, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  // stats strip
  strip: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 8,
  },
  stripCell: { flex: 1, paddingVertical: 8, paddingHorizontal: 12 },
  stripLeft: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#e2e8f0' },
  stripLabel: { fontSize: 10, fontWeight: '600', color: colors.muted },
  stripValue: { fontSize: 20, fontWeight: '800', marginTop: 1 },

  // search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 12,
    marginBottom: 6,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a', paddingVertical: 0, marginLeft: 6 },

  // pills
  pillScroll: { flexGrow: 0, marginBottom: 8 },
  pillContent: { gap: 6, paddingRight: 8 },
  pill: {
    minHeight: 32,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillOn: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  pillTextOn: { color: '#15803d', fontWeight: '700' },

  // user row
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  rowBlocked: { backgroundColor: '#fffafa', borderColor: '#fecaca' },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, minHeight: 56 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  name: { fontSize: 14, fontWeight: '700', color: '#0f172a', flexShrink: 1 },
  meta: { fontSize: 11, color: '#475569', marginTop: 2 },

  // expanded actions: three compact buttons in one row
  actions: {
    flexDirection: 'row',
    gap: 6,
    padding: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  chip: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  chipText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
});