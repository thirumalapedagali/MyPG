import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { del, get, post, put } from '../api';
import { attempt, useResource } from '../hooks';
import { AdminUser, PgInfo, Role } from '../types';
import { Avatar, Badge, Button, Card, Chips, Empty, FormModal, HeaderAction, Screen, SearchInput, Sheet, colors, s } from '../ui';

const FILTERS = ['All', 'Owners', 'Managers', 'Residents', 'Blocked'] as const;
type Filter = (typeof FILTERS)[number];
const PAGE = 20;

const roleColor = (r: string) => (r === 'OWNER' ? '#7c3aed' : r === 'MANAGER' ? colors.blue : '#0d9488');

type Form = {
  id: number | null;
  role: Role;
  username: string;
  mobile: string;
  email: string;
  password: string;
  pgIds: number[];
};
const EMPTY: Form = { id: null, role: 'OWNER', username: '', mobile: '', email: '', password: '', pgIds: [] };

/** Super admin: every owner, manager and resident login across all PGs; add logins and assign them PGs. */
export default function AdminUsers() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const { data, error, loading, refreshing, refresh, reload } = useResource(async () => {
    const [users, pgs] = await Promise.all([get<AdminUser[]>('/api/admin/users'), get<PgInfo[]>('/api/admin/pgs')]);
    return { users, pgs };
  });
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [pgSearch, setPgSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = (data?.users ?? []).filter((u) => {
    if (filter === 'Owners' && u.role !== 'OWNER') return false;
    if (filter === 'Managers' && u.role !== 'MANAGER') return false;
    if (filter === 'Residents' && u.role !== 'RESIDENT') return false;
    if (filter === 'Blocked' && u.status === 'ACTIVE') return false;
    return !q || [u.username, u.mobile, u.pgName, u.email].some((v) => v?.toLowerCase().includes(q));
  });

  const toggle = async (u: AdminUser) => {
    const status = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    if (await attempt(() => put(`/api/admin/users/${u.id}`, { status }))) reload();
  };

  const confirmDelete = (u: AdminUser) =>
    Alert.alert('Delete user', `Delete ${u.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/admin/users/${u.id}`))) reload();
        },
      },
    ]);

  const openAdd = () => {
    setForm(EMPTY);
    setFormError('');
    setPgSearch('');
  };
  const openEdit = (u: AdminUser) => {
    setForm({ id: u.id, role: u.role, username: u.username, mobile: u.mobile, email: u.email ?? '', password: '', pgIds: u.pgIds });
    setFormError('');
    setPgSearch('');
  };
  const patch = (p: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...p } : f));
    setFormError('');
  };

  /** Owners can hold several PGs; a manager exactly one. */
  const togglePg = (f: Form, id: number) => {
    if (f.role === 'MANAGER') return patch({ pgIds: [id] });
    patch({ pgIds: f.pgIds.includes(id) ? f.pgIds.filter((x) => x !== id) : [...f.pgIds, id] });
  };
  const setRole = (f: Form, role: Role) => patch({ role, pgIds: role === 'MANAGER' ? f.pgIds.slice(0, 1) : f.pgIds });

  const save = async () => {
    if (!form) return;
    const adding = form.id === null;
    const assignable = form.role === 'OWNER' || form.role === 'MANAGER';
    if (adding && !form.username.trim()) return setFormError('Username is required');
    if (!/^\d{10,15}$/.test(form.mobile.trim())) return setFormError('Enter a valid mobile number (10-15 digits)');
    if (adding && form.password.length < 4) return setFormError('Password must be at least 4 characters');
    if (assignable && form.pgIds.length === 0) return setFormError('Select at least one PG');

    setSaving(true);
    setFormError('');
    try {
      if (adding) {
        await post('/api/admin/users', {
          username: form.username.trim(),
          mobile: form.mobile.trim(),
          email: form.email.trim() || undefined,
          password: form.password,
          role: form.role,
          pgIds: form.pgIds,
        });
      } else {
        await put(`/api/admin/users/${form.id}`, {
          mobile: form.mobile.trim(),
          email: form.email.trim(),
          ...(assignable ? { pgIds: form.pgIds } : {}),
        });
      }
      setForm(null);
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save the user');
    } finally {
      setSaving(false);
    }
  };

  const pgq = pgSearch.trim().toLowerCase();
  const pgChoices = (data?.pgs ?? []).filter((p) => !pgq || [p.name, p.city].some((v) => v?.toLowerCase().includes(pgq)));
  const pgNames = (ids: number[]) => ids.map((id) => data?.pgs.find((p) => p.id === id)?.name).filter(Boolean).join(', ');

  return (
    <Screen
      title="Users"
      action={
        <View style={{ flexDirection: 'row' }}>
          <HeaderAction label="Add" icon="person-add" onPress={openAdd} />
          <HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />
        </View>
      }
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <SearchInput
        value={search}
        onChange={(t) => {
          setSearch(t);
          setShown(PAGE);
        }}
        placeholder="Search by username, mobile or PG"
      />
      <Chips
        options={FILTERS}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setShown(PAGE);
        }}
      />
      {data && <Text style={[s.muted, { marginBottom: 8 }]}>{filtered.length} of {data.users.length} users</Text>}
      {data && filtered.length === 0 && <Empty text="No users match." />}
      {filtered.slice(0, shown).map((u) => (
        <Card key={u.id} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
          <View style={[s.row, { justifyContent: 'flex-start', gap: 10 }]}>
            <Avatar name={u.username} />
            <View style={{ flex: 1 }}>
              <Text style={s.h2} numberOfLines={1}>{u.username}</Text>
              <Text style={s.muted} numberOfLines={1}>{u.mobile}</Text>
            </View>
            <View style={{ gap: 4, alignItems: 'flex-end' }}>
              <Badge text={u.role} color={roleColor(u.role)} />
              <Badge text={u.status === 'ACTIVE' ? 'Active' : 'Blocked'} color={u.status === 'ACTIVE' ? colors.good : colors.bad} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Ionicons name="business-outline" size={14} color={u.pgName ? colors.primary : colors.warn} />
            <Text style={[s.muted, { flex: 1 }, !u.pgName && { color: colors.warn, fontStyle: 'italic' }]} numberOfLines={2}>
              {u.pgName ? `${u.pgIds.length > 1 ? `${u.pgIds.length} PGs: ` : ''}${u.pgName}` : 'No PG assigned'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Button small label="Edit" onPress={() => openEdit(u)} />
            <Button small kind="ghost" label="Reset password" onPress={() => setResetFor(u)} />
            <Button small kind="ghost" label={u.status === 'ACTIVE' ? 'Block' : 'Unblock'} onPress={() => toggle(u)} />
            <Button small kind="danger" label="Delete" onPress={() => confirmDelete(u)} />
          </View>
        </Card>
      ))}
      {filtered.length > shown && (
        <Button kind="ghost" label={`Show more (${filtered.length - shown})`} onPress={() => setShown(shown + PAGE)} />
      )}

      {/* ── Add / edit user, with PG assignment ── */}
      <Sheet
        visible={form !== null}
        title={form?.id === null ? 'Add User' : `Edit · ${form?.username ?? ''}`}
        onClose={() => setForm(null)}
      >
        {form && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>
            {!!formError && (
              <View style={{ backgroundColor: colors.badLight, borderRadius: 10, padding: 10, marginTop: 10 }}>
                <Text style={{ color: colors.bad, fontSize: 13 }}>{formError}</Text>
              </View>
            )}

            {form.id === null && (
              <>
                <Text style={s.label}>Role</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['OWNER', 'MANAGER'] as Role[]).map((r) => {
                    const on = form.role === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setRole(form, r)}
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: on ? roleColor(r) : colors.border,
                          backgroundColor: on ? roleColor(r) + '18' : '#fff',
                        }}
                      >
                        <Text style={{ fontWeight: '700', fontSize: 13, color: on ? roleColor(r) : colors.text }}>{r === 'OWNER' ? 'Owner' : 'Manager'}</Text>
                        <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>
                          {r === 'OWNER' ? 'Full access, one or more PGs' : 'Day-to-day operations, one PG'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={s.label}>Username</Text>
                <TextInput style={s.input} value={form.username} autoCapitalize="none" autoCorrect={false} onChangeText={(t) => patch({ username: t })} />
              </>
            )}

            <Text style={s.label}>Mobile (10-15 digits)</Text>
            <TextInput style={s.input} value={form.mobile} keyboardType="phone-pad" onChangeText={(t) => patch({ mobile: t.replace(/\D/g, '') })} />
            <Text style={s.label}>Email (optional)</Text>
            <TextInput style={s.input} value={form.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(t) => patch({ email: t })} />
            {form.id === null && (
              <>
                <Text style={s.label}>Temporary password (min 4 characters)</Text>
                <TextInput style={s.input} value={form.password} secureTextEntry autoCapitalize="none" onChangeText={(t) => patch({ password: t })} />
              </>
            )}

            {(form.role === 'OWNER' || form.role === 'MANAGER') && (
              <>
                <Text style={s.label}>
                  {form.role === 'OWNER' ? `PG access · ${form.pgIds.length} selected` : 'PG (choose one)'}
                </Text>
                {!!form.pgIds.length && (
                  <Text style={[s.muted, { marginBottom: 6 }]} numberOfLines={2}>{pgNames(form.pgIds)}</Text>
                )}
                <SearchInput value={pgSearch} onChange={setPgSearch} placeholder="Search PGs" />
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, maxHeight: 240, overflow: 'hidden' }}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {pgChoices.length === 0 && <Text style={[s.muted, { padding: 12 }]}>No PGs found.</Text>}
                    {pgChoices.map((p) => {
                      const on = form.pgIds.includes(p.id);
                      const single = form.role === 'MANAGER';
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => togglePg(form, p.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                        >
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={[{ fontSize: 14, color: colors.text }, on && { color: colors.primary, fontWeight: '700' }]}>{p.name}</Text>
                            {!!(p.city || p.address) && (
                              <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>{p.city || p.address}</Text>
                            )}
                          </View>
                          <Ionicons
                            name={single ? (on ? 'radio-button-on' : 'radio-button-off') : on ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={on ? colors.primary : colors.muted}
                          />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
                {form.role === 'OWNER' && (
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                    <Pressable onPress={() => patch({ pgIds: (data?.pgs ?? []).map((p) => p.id) })}>
                      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Select all</Text>
                    </Pressable>
                    <Pressable onPress={() => patch({ pgIds: [] })}>
                      <Text style={{ color: colors.bad, fontWeight: '700', fontSize: 12 }}>Clear</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
            {form.role === 'RESIDENT' && (
              <Text style={[s.muted, { marginTop: 14 }]}>Resident logins belong to one PG and are added by its owner.</Text>
            )}

            <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{form.id === null ? 'Create User' : 'Save Changes'}</Text>}
            </Pressable>
          </ScrollView>
        )}
      </Sheet>

      <FormModal
        visible={resetFor !== null}
        title={`Reset password · ${resetFor?.username ?? ''}`}
        fields={[{ key: 'password', label: 'New temporary password (min 4 characters)', secure: true }]}
        onClose={() => setResetFor(null)}
        onSubmit={async (v) => {
          if (v.password.length < 4) {
            Alert.alert('Too short', 'Use at least 4 characters.');
            return false;
          }
          if (!(await attempt(() => put(`/api/admin/users/${resetFor!.id}`, { newPassword: v.password })))) return false;
          setResetFor(null);
          reload();
        }}
      />
    </Screen>
  );
}
