import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { del, get, post, put } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { ManagedUser, Resident, Role } from '../types';
import { Avatar, Badge, Button, Card, Empty, FormModal, HeaderAction, PickerModal, Screen, colors, s } from '../ui';

type RoleChoice = { id: Role; label: string };

/** User management for the current PG (owner, or a super admin who has opened a PG). */
export default function Users() {
  const { user: me } = useAuth();
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const { data, error, loading, refreshing, refresh, reload } = useResource(async () => {
    const [users, residents] = await Promise.all([get<ManagedUser[]>('/api/users'), get<Resident[]>('/api/residents')]);
    return { users, residents };
  });

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
  const withLogin = new Set((data?.users ?? []).map((u) => u.residentId).filter((x): x is number => x !== null));
  const freeResidents = (data?.residents ?? []).filter((r) => !withLogin.has(r.id));

  const reset = () => {
    setPickRole(false);
    setPickResident(false);
    setForm(false);
    setRole(null);
    setResidentId(null);
  };

  const toggle = async (u: ManagedUser) => {
    const status = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    if (await attempt(() => put(`/api/users/${u.id}`, { status }))) reload();
  };

  const confirmDelete = (u: ManagedUser) =>
    Alert.alert('Delete user', `Delete ${u.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/users/${u.id}`))) reload();
        },
      },
    ]);

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
      {data && data.users.length === 0 && <Empty text="No users yet." />}
      {data?.users.map((u) => {
        const self = u.id === me?.userId;
        const resident = data.residents.find((r) => r.id === u.residentId);
        return (
          <Card key={u.id}>
            <View style={[s.row, { justifyContent: 'flex-start' }]}>
              <Avatar name={u.username} />
              <View style={{ flex: 1 }}>
                <Text style={s.h2}>
                  {u.username}
                  {self ? ' (you)' : ''}
                </Text>
                <Text style={s.muted}>
                  {u.mobile}
                  {resident ? ` · ${resident.name}` : ''}
                </Text>
              </View>
              <View style={{ gap: 4, alignItems: 'flex-end' }}>
                <Badge text={u.role} color={colors.blue} />
                <Badge text={u.status} color={u.status === 'ACTIVE' ? colors.good : colors.bad} />
              </View>
            </View>
            {!self && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Button small kind="ghost" label="Reset password" onPress={() => setResetFor(u)} />
                <Button small kind="ghost" label={u.status === 'ACTIVE' ? 'Block' : 'Unblock'} onPress={() => toggle(u)} />
                <Button small kind="danger" label="Delete" onPress={() => confirmDelete(u)} />
              </View>
            )}
          </Card>
        );
      })}

      <PickerModal
        visible={pickRole}
        title="New user type"
        items={roles}
        label={(r) => r.label}
        onClose={reset}
        onPick={(r) => {
          setPickRole(false);
          setRole(r.id);
          if (r.id === 'RESIDENT') setPickResident(true);
          else setForm(true);
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
          { key: 'password', label: 'Temporary password (min 8 characters)', secure: true },
        ]}
        onClose={reset}
        onSubmit={async (v) => {
          if (v.password.length < 8) {
            Alert.alert('Too short', 'Use at least 8 characters.');
            return false;
          }
          const body = { username: v.username, mobile: v.mobile, password: v.password, role, residentId };
          if (!(await attempt(() => post('/api/users', body)))) return false;
          reset();
          reload();
          Alert.alert('User created', 'They will be asked to choose a new password at first login.');
        }}
      />
      <FormModal
        visible={resetFor !== null}
        title={`Reset password · ${resetFor?.username ?? ''}`}
        fields={[{ key: 'password', label: 'New temporary password (min 8 characters)', secure: true }]}
        onClose={() => setResetFor(null)}
        onSubmit={async (v) => {
          if (v.password.length < 8) {
            Alert.alert('Too short', 'Use at least 8 characters.');
            return false;
          }
          if (!(await attempt(() => put(`/api/users/${resetFor!.id}`, { newPassword: v.password })))) return false;
          setResetFor(null);
          reload();
        }}
      />
    </Screen>
  );
}
