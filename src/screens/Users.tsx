
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { del, get, post, put } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { ManagedUser, Resident, Role } from '../types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  FormModal,
  HeaderAction,
  PickerModal,
  Screen,
  colors,
  s,
} from '../ui';

type RoleChoice = { id: Role; label: string };

type UserFilter =
  | 'ALL'
  | 'RESIDENT'
  | 'OWNER'
  | 'MANAGER'
  | 'ACTIVE'
  | 'BLOCKED';

const FILTERS: { id: UserFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'RESIDENT', label: 'Residents' },
  { id: 'OWNER', label: 'Owners' },
  { id: 'MANAGER', label: 'Managers' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'BLOCKED', label: 'Blocked' },
];

export default function Users() {
  const { user: me } = useAuth();
  const nav = useNavigation<NavigationProp<ParamListBase>>();

  const {
    data,
    error,
    loading,
    refreshing,
    refresh,
    reload,
  } = useResource(async () => {
    const [users, residents] = await Promise.all([
      get<ManagedUser[]>('/api/users'),
      get<Resident[]>('/api/residents'),
    ]);

    return { users, residents };
  });

  // Search and filters
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('ALL');
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  // Existing form states
  const [pickRole, setPickRole] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [pickResident, setPickResident] = useState(false);
  const [residentId, setResidentId] = useState<number | null>(null);
  const [form, setForm] = useState(false);
  const [resetFor, setResetFor] = useState<ManagedUser | null>(null);

  const roles: RoleChoice[] = [
    { id: 'MANAGER', label: 'Manager (day-to-day operations)' },
    { id: 'RESIDENT', label: 'Resident (sees own dues)' },
    ...(me?.role === 'SUPER_ADMIN'
      ? [{ id: 'OWNER' as Role, label: 'Owner (full access)' }]
      : []),
  ];

  const withLogin = new Set(
    (data?.users ?? [])
      .map((u) => u.residentId)
      .filter((x): x is number => x !== null)
  );

  const freeResidents = (data?.residents ?? []).filter(
    (r) => !withLogin.has(r.id)
  );

  const stats = useMemo(() => {
    const users = data?.users ?? [];

    return {
      total: users.length,
      active: users.filter((u) => u.status === 'ACTIVE').length,
      blocked: users.filter((u) => u.status === 'BLOCKED').length,
    };
  }, [data]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];

    const query = search.trim().toLowerCase();

    return data.users.filter((u) => {
      const resident = data.residents.find(
        (r) => r.id === u.residentId
      );

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
          matchesFilter = u.role === 'OWNER' || u.role === 'SUPER_ADMIN';
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
  }, [data, search, filter]);

  const reset = () => {
    setPickRole(false);
    setPickResident(false);
    setForm(false);
    setRole(null);
    setResidentId(null);
  };

  const toggle = async (u: ManagedUser) => {
    const status =
      u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';

    if (
      await attempt(() => put(`/api/users/${u.id}`, { status }))
    ) {
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

  const renderStat = (
    label: string,
    value: number,
    color: string,
    icon: string
  ) => (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 13,
        borderWidth: 1,
        borderColor: '#E8EBEF',
        gap: 7,
      }}
    >
      <Text style={{ fontSize: 19, color }}>{icon}</Text>
      <Text style={{ fontSize: 23, fontWeight: '800', color: '#202833' }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: '#687382' }}>
        {label}
      </Text>
    </View>
  );

  const renderUser = (u: ManagedUser) => {
    const self = u.id === me?.userId;

    const resident = data?.residents.find(
      (r) => r.id === u.residentId
    );

    const expanded = expandedUser === u.id;
    const owner = u.role === 'OWNER' || u.role === 'SUPER_ADMIN';

    return (
      <Card key={u.id}>
        <Pressable
          onPress={() =>
            setExpandedUser(expanded ? null : u.id)
          }
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
          }}
        >
          <Avatar name={u.username} />

          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#202833',
              }}
              numberOfLines={1}
            >
              {u.username}
              {self ? ' (You)' : ''}
            </Text>

            <Text style={{ fontSize: 13, color: '#6B7280' }}>
              {u.mobile}
            </Text>

            {resident?.name ? (
              <Text style={{ fontSize: 12, color: '#8A929D' }}>
                Resident: {resident.name}
              </Text>
            ) : null}
          </View>

          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Badge
              text={u.role}
              color={owner ? colors.blue : '#287C48'}
            />

            <Badge
              text={u.status}
              color={
                u.status === 'ACTIVE'
                  ? colors.good
                  : colors.bad
              }
            />
          </View>

          <Text
            style={{
              fontSize: 22,
              color: '#6B7280',
              marginLeft: 3,
            }}
          >
            ⋮
          </Text>
        </Pressable>

        {!self && expanded && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: '#EEF0F3',
              marginTop: 12,
              paddingTop: 10,
              gap: 8,
            }}
          >
            <Button
              small
              kind="ghost"
              label="Reset password"
              onPress={() => {
                setResetFor(u);
                setExpandedUser(null);
              }}
            />

            <Button
              small
              kind="ghost"
              label={
                u.status === 'ACTIVE'
                  ? 'Block user'
                  : 'Unblock user'
              }
              onPress={() => toggle(u)}
            />

            <Button
              small
              kind="danger"
              label="Delete user"
              onPress={() => confirmDelete(u)}
            />
          </View>
        )}
      </Card>
    );
  };

  return (
    <Screen
      title="Users"
      action={
        <View style={{ flexDirection: 'row' }}>
          <HeaderAction
            label="Add"
            icon="person-add"
            onPress={() => setPickRole(true)}
          />
          <HeaderAction
            label="Back"
            icon="chevron-back"
            onPress={() => nav.goBack()}
          />
        </View>
      }
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <View style={{ gap: 16, paddingBottom: 20 }}>

        {/* Page heading */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 23,
                fontWeight: '800',
                color: '#202833',
              }}
            >
              Manage users
            </Text>

            <Text style={{ color: '#7B8491', fontSize: 13 }}>
              Manage residents and access
            </Text>
          </View>

          <Text style={{ color: '#287C48', fontWeight: '700' }}>
            {stats.total} Users
          </Text>
        </View>

        {/* Summary cards */}
        <View style={{ flexDirection: 'row', gap: 9 }}>
          {renderStat('Total users', stats.total, '#247C43', '♙')}
          {renderStat('Active', stats.active, '#26934D', '✓')}
          {renderStat('Blocked', stats.blocked, '#D83B3B', '⊘')}
        </View>

        {/* Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E4E8ED',
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 48,
          }}
        >
          <Text style={{ fontSize: 20, color: '#7A8490' }}>
            ⌕
          </Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or mobile number"
            placeholderTextColor="#929AA5"
            style={{
              flex: 1,
              marginLeft: 9,
              fontSize: 14,
              color: '#202833',
              paddingVertical: 8,
            }}
            autoCapitalize="none"
          />

          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Text style={{ color: '#287C48', fontWeight: '600' }}>
                Clear
              </Text>
            </Pressable>
          )}
        </View>

        {/* Filters */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {FILTERS.map((item) => {
            const selected = filter === item.id;

            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setFilter(item.id);
                  setExpandedUser(null);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 22,
                  backgroundColor: selected
                    ? '#287C3C'
                    : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: selected
                    ? '#287C3C'
                    : '#E1E5EA',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: selected ? '#FFFFFF' : '#59616D',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* User list heading */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: '#202833',
            }}
          >
            User accounts
          </Text>

          <Text style={{ fontSize: 12, color: '#7B8491' }}>
            {filteredUsers.length} results
          </Text>
        </View>

        {/* User list */}
        {filteredUsers.length === 0 ? (
          <Empty
            text={
              search
                ? 'No matching users found.'
                : 'No users in this category.'
            }
          />
        ) : (
          <View style={{ gap: 10 }}>
            {filteredUsers.map(renderUser)}
          </View>
        )}

      </View>

      {/* Existing Add User workflow */}
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
        label={(r) =>
          `${r.name} · Room ${r.roomNumber ?? '-'}`
        }
        onClose={reset}
        onPick={(r) => {
          setPickResident(false);
          setResidentId(r.id);
          setForm(true);
        }}
      />

      <FormModal
        visible={form}
        title={
          role === 'RESIDENT'
            ? 'Resident login'
            : `New ${role?.toLowerCase() ?? 'user'}`
        }
        fields={[
          { key: 'username', label: 'Username' },
          {
            key: 'mobile',
            label: 'Mobile (10-15 digits)',
            keyboard: 'phone-pad',
          },
          {
            key: 'password',
            label: 'Temporary password (min 4 characters)',
            secure: true,
          },
        ]}
        onClose={reset}
        onSubmit={async (v) => {
          if (v.password.length < 4) {
            Alert.alert(
              'Too short',
              'Use at least 4 characters.'
            );
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

          Alert.alert(
            'User created',
            'They will be asked to choose a new password at first login.'
          );
        }}
      />

      {/* Existing Reset Password workflow */}
      <FormModal
        visible={resetFor !== null}
        title={`Reset password · ${resetFor?.username ?? ''}`}
        fields={[
          {
            key: 'password',
            label: 'New temporary password (min 4 characters)',
            secure: true,
          },
        ]}
        onClose={() => setResetFor(null)}
        onSubmit={async (v) => {
          if (v.password.length < 4) {
            Alert.alert(
              'Too short',
              'Use at least 4 characters.'
            );
            return false;
          }

          if (
            !(await attempt(() =>
              put(`/api/users/${resetFor!.id}`, {
                newPassword: v.password,
              })
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
