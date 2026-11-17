import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { get, put } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { PictureTarget, PicturesSheet } from '../pictures';
import { GENDER_POLICY, STAY_TYPE, unitLabelFor, useLookup } from '../lookups';
import { initialAmenities, pickedCodes, useTypeAmenities } from '../propertyForm';
import { PgInfo, PgUser, PropertyConfiguration } from '../types';
import { AddPropertyModal, Badge, Button, Card, Empty, FormModal, HeaderAction, Screen, SearchInput, colors, s } from '../ui';

const PAGE = 15;

const expiry = (iso: string | null) => {
  if (!iso) return { text: 'No licence', expired: true };
  const d = new Date(iso);
  const expired = d < new Date();
  return { text: `${expired ? 'Expired' : 'Valid until'} ${d.toISOString().slice(0, 10)}`, expired };
};

const roleColor = (r: string) => (r === 'OWNER' ? '#7c3aed' : r === 'MANAGER' ? '#2563eb' : r === 'RESIDENT' ? '#0d9488' : '#6b7280');

/** Lazily loads and lists everyone who can log in to one PG. */
function PgUsers({ pgId }: { pgId: number }) {
  const { data, loading, error } = useResource(() => get<PgUser[]>(`/api/admin/pgs/${pgId}/users`));
  if (loading) return <ActivityIndicator style={{ marginVertical: 8 }} />;
  if (error) return <Text style={[s.muted, { color: colors.bad }]}>{error}</Text>;
  if (!data || data.length === 0) return <Text style={s.muted}>No users.</Text>;
  return (
    <View style={{ gap: 4 }}>
      {data.map((u) => (
        <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ flex: 1, fontSize: 13, color: colors.text }} numberOfLines={1}>
            {u.username}
            <Text style={s.muted}>{u.mobile ? `  ${u.mobile}` : ''}</Text>
          </Text>
          <Badge text={u.role} color={roleColor(u.role)} />
          <Badge text={u.status === 'ACTIVE' ? 'Active' : 'Blocked'} color={u.status === 'ACTIVE' ? colors.good : colors.bad} />
        </View>
      ))}
    </View>
  );
}

/** Shop Management equivalent (SUPER_ADMIN only): create PGs, open one, block it, extend its licence, see its users. */
export default function Pgs() {
  const { user, selectPg, logout } = useAuth();
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const stayTypes = useLookup(STAY_TYPE);
  const genderPolicies = useLookup(GENDER_POLICY);
  const { data, error, loading, refreshing, refresh, reload } = useResource(() => get<PgInfo[]>('/api/admin/pgs'));
  const [open, setOpen] = useState(false);
  const [extend, setExtend] = useState<PgInfo | null>(null);
  const [editingPg, setEditingPg] = useState<PgInfo | null>(null);
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [usersOpen, setUsersOpen] = useState<number | null>(null);
  const [picturesOf, setPicturesOf] = useState<PictureTarget | null>(null);
  const [editType, setEditType] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: number; codes: string[] } | null>(null);
  const editAmenities = useTypeAmenities(editingPg ? editType ?? editingPg.stayType ?? 'PG' : undefined);

  // What the edited property has ticked now (empty for properties that only have the old free-text list).
  const editingId = editingPg?.id;
  useEffect(() => {
    if (!editingId) return;
    let alive = true;
    get<PropertyConfiguration>(`/api/properties/${editingId}/configuration`)
      .then((c) => alive && setSaved({ id: editingId, codes: c.amenities.filter((a) => a.selected).map((a) => a.amenity.code) }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [editingId]);
  const savedCodes = saved && saved.id === editingId ? saved.codes : [];
  const q = search.trim().toLowerCase();
  const filtered = (data ?? []).filter(
    (p) => !q || [p.name, p.city, p.ownerName, p.address].some((v) => v?.toLowerCase().includes(q)),
  );

  const openPg = async (pg: PgInfo) => {
    // Opening a PG swaps the token and remounts the navigator onto that PG's screens.
    await attempt(() => selectPg(pg.id));
  };

  const toggle = async (pg: PgInfo) => {
    if (await attempt(() => put(`/api/admin/pgs/${pg.id}/status?active=${!pg.active}`))) reload();
  };

  return (
    <Screen
      title="Manage PGs"
      action={
        <View style={{ flexDirection: 'row' }}>
          <HeaderAction label="Add" icon="add-circle" onPress={() => setOpen(true)} />
          {nav.canGoBack() ? (
            <HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />
          ) : (
            <HeaderAction label="Log out" icon="log-out-outline" onPress={logout} />
          )}
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
        placeholder="Search by name, city or owner"
      />
      {data && <Text style={[s.muted, { marginBottom: 8 }]}>{filtered.length} of {data.length} properties</Text>}
      {data && data.length === 0 && <Empty text="No PGs yet. Tap Add to create the first one." />}
      {data && data.length > 0 && filtered.length === 0 && <Empty text="No PGs match your search." />}
      {filtered.slice(0, shown).map((pg) => {
        const lic = expiry(pg.licenseExpiry);
        const showUsers = usersOpen === pg.id;
        return (
          <Card key={pg.id} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
            <View style={[s.row, { alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                  <Text style={s.h2}>{pg.name}</Text>
                  <Badge
                    text={pg.stayType || 'PG'}
                    color={pg.stayType === 'APARTMENT' ? '#7c3aed' : pg.stayType === 'HOSTEL' ? '#ea580c' : '#2563eb'}
                  />
                  {pg.genderType ? (
                    <Badge
                      text={pg.genderType === 'GENTS' ? 'Gents' : pg.genderType === 'LADIES' ? 'Ladies' : 'Unisex'}
                      color={pg.genderType === 'GENTS' ? '#2563eb' : pg.genderType === 'LADIES' ? '#db2777' : '#0d9488'}
                    />
                  ) : null}
                </View>
                <Text style={s.muted} numberOfLines={2}>
                  {pg.ownerName ?? 'Owner'}
                  {pg.city ? ` · ${pg.city}` : ''}
                  {pg.address ? ` · ${pg.address}` : ''}
                  {pg.totalFloors ? ` · ${pg.totalFloors} Floors` : ''}
                </Text>
              </View>
              <Badge text={user?.pgId === pg.id ? 'Open' : pg.active ? 'Active' : 'Blocked'} color={pg.active ? colors.good : colors.bad} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="calendar-outline" size={14} color={lic.expired ? colors.bad : colors.muted} />
              <Text style={[s.muted, lic.expired && { color: colors.bad }]}>{lic.text}</Text>
            </View>
            <Pressable
              onPress={() => setUsersOpen(showUsers ? null : pg.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}
            >
              <Ionicons name="people-outline" size={14} color={colors.blue} />
              <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '600', flex: 1 }}>{showUsers ? 'Hide users' : 'Users'}</Text>
              <Ionicons name={showUsers ? 'chevron-up' : 'chevron-down'} size={14} color={colors.blue} />
            </Pressable>
            {showUsers && (
              <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
                <PgUsers pgId={pg.id} />
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <Button small label="Open" onPress={() => openPg(pg)} />
              <Button small kind="ghost" label="Edit" onPress={() => setEditingPg(pg)} />
              <Button small kind="ghost" label="Pictures" onPress={() => setPicturesOf({ type: 'property', id: pg.id, title: pg.name })} />
              <Button small kind="ghost" label="Extend licence" onPress={() => setExtend(pg)} />
              <Button small kind={pg.active ? 'danger' : 'ghost'} label={pg.active ? 'Block' : 'Activate'} onPress={() => toggle(pg)} />
            </View>
          </Card>
        );
      })}
      {filtered.length > shown && (
        <Button kind="ghost" label={`Show more (${filtered.length - shown})`} onPress={() => setShown(shown + PAGE)} />
      )}

      <PicturesSheet target={picturesOf} onClose={() => setPicturesOf(null)} />

      <AddPropertyModal
        adminCreate
        visible={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          reload();
        }}
      />

      {editingPg && (
        <FormModal
          visible={editingPg !== null}
          title={`Edit · ${editingPg.name}`}
          submitLabel="Save Changes"
          fields={[
            { key: 'name', label: 'Property Name', initial: editingPg.name },
            { key: 'stayType', label: 'Stay Type', initial: editingPg.stayType || 'PG', options: stayTypes },
            { key: 'address', label: 'Address', initial: editingPg.address || '', optional: true },
            { key: 'locationUrl', label: 'Map / Google Location URL', initial: editingPg.locationUrl || '', optional: true },
            {
              key: 'amenities',
              label: 'Amenities',
              optional: true,
              resetOn: 'stayType',
              initial: initialAmenities(editAmenities, savedCodes, editingPg.amenities),
              checklist: editAmenities,
            },
            { key: 'genderType', label: 'Occupancy Policy', initial: editingPg.genderType || 'CO_LIVING', options: genderPolicies },
            { key: 'upiId', label: 'UPI ID for rent collections', initial: editingPg.upiId || '', optional: true },
            { key: 'upiName', label: 'UPI Account / Payee Name', initial: editingPg.upiName || '', optional: true },
            { key: 'city', label: 'City', initial: editingPg.city || '', optional: true },
            { key: 'totalFloors', label: 'Number of Floors', keyboard: 'number-pad', initial: String(editingPg.totalFloors || 3) },
          ]}
          onClose={() => {
            setEditingPg(null);
            setEditType(null);
          }}
          onFieldChange={(k, c) => k === 'stayType' && setEditType(c)}
          onSubmit={async (v) => {
            const floors = parseInt(v.totalFloors, 10);
            const body = {
              name: v.name,
              stayType: v.stayType?.toUpperCase() || 'PG',
              unitLabel: unitLabelFor(stayTypes, v.stayType),
              address: v.address || undefined,
              locationUrl: v.locationUrl || undefined,
              amenityCodes: editAmenities.length ? pickedCodes(v.amenities, editAmenities) : undefined,
              genderType: v.genderType?.toUpperCase() || 'CO_LIVING',
              upiId: v.upiId || undefined,
              upiName: v.upiName || undefined,
              city: v.city || undefined,
              totalFloors: floors > 0 ? floors : 3,
            };
            if (!(await attempt(() => put(`/api/admin/pgs/${editingPg.id}`, body)))) return false;
            setEditingPg(null);
            setEditType(null);
            reload();
          }}
        />
      )}
      <FormModal
        visible={extend !== null}
        title={`Extend licence · ${extend?.name ?? ''}`}
        submitLabel="Extend"
        fields={[{ key: 'months', label: 'Months to add (1-120)', keyboard: 'number-pad', initial: '1' }]}
        onClose={() => setExtend(null)}
        onSubmit={async (v) => {
          const months = parseInt(v.months, 10);
          if (!(months >= 1 && months <= 120)) {
            Alert.alert('Invalid', 'Enter 1 to 120 months.');
            return false;
          }
          if (!(await attempt(() => put(`/api/admin/pgs/${extend!.id}/license?months=${months}`)))) return false;
          setExtend(null);
          reload();
        }}
      />
    </Screen>
  );
}
