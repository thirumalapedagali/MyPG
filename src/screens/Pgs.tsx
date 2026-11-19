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
import { AddPropertyModal, Badge, Button, Card, Chips, Empty, FormModal, HeaderAction, Screen, SearchInput, colors, s } from '../ui';

const PAGE = 15;
const FILTERS = ['All', 'Active', 'Expiring Soon', 'Expired', 'Blocked'] as const;
type Filter = (typeof FILTERS)[number];

const getLicenseInfo = (iso: string | null) => {
  if (!iso) return { text: 'No license', status: 'EXPIRED' as const, color: colors.bad };
  const expiryDate = new Date(iso);
  const now = new Date();
  const soon = new Date();
  soon.setDate(now.getDate() + 30);

  if (expiryDate < now) {
    return { text: `Expired (${iso.slice(0, 10)})`, status: 'EXPIRED' as const, color: colors.bad };
  }
  if (expiryDate < soon) {
    return { text: `Expiring soon (${iso.slice(0, 10)})`, status: 'SOON' as const, color: colors.warn };
  }
  return { text: `Valid until ${iso.slice(0, 10)}`, status: 'VALID' as const, color: colors.good };
};

const roleColor = (r: string) =>
  r === 'OWNER' ? '#7c3aed' : r === 'MANAGER' ? '#2563eb' : r === 'RESIDENT' ? '#0d9488' : '#6b7280';

/** Lazily loads and lists everyone who can log in to one PG. */
function PgUsers({ pgId }: { pgId: number }) {
  const { data, loading, error } = useResource(() => get<PgUser[]>(`/api/admin/pgs/${pgId}/users`));
  if (loading) return <ActivityIndicator style={{ marginVertical: 8 }} />;
  if (error) return <Text style={[s.muted, { color: colors.bad }]}>{error}</Text>;
  if (!data || data.length === 0) return <Text style={s.muted}>No assigned users found for this property.</Text>;
  return (
    <View style={{ gap: 6 }}>
      {data.map((u) => (
        <View
          key={u.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
            borderRadius: 8,
            paddingVertical: 6,
            paddingHorizontal: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Ionicons name="person-outline" size={14} color={colors.muted} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>
              {u.username}
            </Text>
            {!!u.mobile && <Text style={{ fontSize: 12, color: colors.muted }}>({u.mobile})</Text>}
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Badge text={u.role} color={roleColor(u.role)} />
            <Badge text={u.status === 'ACTIVE' ? 'Active' : 'Blocked'} color={u.status === 'ACTIVE' ? colors.good : colors.bad} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Super Admin property management console. */
export default function Pgs() {
  const { user, selectPg, logout } = useAuth();
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const stayTypes = useLookup(STAY_TYPE);
  const genderPolicies = useLookup(GENDER_POLICY);
  const { data, error, loading, refreshing, refresh, reload } = useResource(() => get<PgInfo[]>('/api/admin/pgs'));

  const [open, setOpen] = useState(false);
  const [extend, setExtend] = useState<PgInfo | null>(null);
  const [editingPg, setEditingPg] = useState<PgInfo | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [usersOpen, setUsersOpen] = useState<number | null>(null);
  const [picturesOf, setPicturesOf] = useState<PictureTarget | null>(null);
  const [editType, setEditType] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: number; codes: string[] } | null>(null);
  const editAmenities = useTypeAmenities(editingPg ? editType ?? editingPg.stayType ?? 'PG' : undefined);

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
  const allList = data ?? [];

  const filtered = allList.filter((pg) => {
    const lic = getLicenseInfo(pg.licenseExpiry);
    if (filter === 'Active' && !pg.active) return false;
    if (filter === 'Blocked' && pg.active) return false;
    if (filter === 'Expired' && lic.status !== 'EXPIRED') return false;
    if (filter === 'Expiring Soon' && lic.status !== 'SOON') return false;

    if (!q) return true;
    return [pg.name, pg.city, pg.ownerName, pg.address, pg.mobile, pg.email].some((v) =>
      v?.toLowerCase().includes(q)
    );
  });

  const totalCount = allList.length;
  const activeCount = allList.filter((p) => p.active).length;
  const blockedCount = allList.filter((p) => !p.active).length;
  const expiringSoonCount = allList.filter((p) => p.active && getLicenseInfo(p.licenseExpiry).status === 'SOON').length;
  const expiredCount = allList.filter((p) => getLicenseInfo(p.licenseExpiry).status === 'EXPIRED').length;

  const openPg = async (pg: PgInfo) => {
    const ok = await attempt(() => selectPg(pg.id));
    if (ok) {
      if ((nav as any).popToTop) {
        (nav as any).popToTop();
      } else {
        nav.navigate('Main');
      }
    }
  };

  const toggle = async (pg: PgInfo) => {
    if (await attempt(() => put(`/api/admin/pgs/${pg.id}/status?active=${!pg.active}`))) reload();
  };

  return (
    <Screen
      title="Manage Properties"
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
      {/* ── Summary Stats Overview ── */}
      {data && (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 64, backgroundColor: '#f1f5f9', borderRadius: 8, padding: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{totalCount}</Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>Total</Text>
          </View>
          <View style={{ flex: 1, minWidth: 64, backgroundColor: '#dcfce7', borderRadius: 8, padding: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.good }}>{activeCount}</Text>
            <Text style={{ fontSize: 11, color: colors.good }}>Active</Text>
          </View>
          <View style={{ flex: 1, minWidth: 64, backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.warn }}>{expiringSoonCount}</Text>
            <Text style={{ fontSize: 11, color: colors.warn }}>Soon</Text>
          </View>
          <View style={{ flex: 1, minWidth: 64, backgroundColor: '#fee2e2', borderRadius: 8, padding: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.bad }}>{expiredCount}</Text>
            <Text style={{ fontSize: 11, color: colors.bad }}>Expired</Text>
          </View>
          <View style={{ flex: 1, minWidth: 64, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.muted }}>{blockedCount}</Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>Blocked</Text>
          </View>
        </View>
      )}

      {/* ── Search & Filter Chips ── */}
      <SearchInput
        value={search}
        onChange={(t) => {
          setSearch(t);
          setShown(PAGE);
        }}
        placeholder="Search by name, city, address or owner..."
      />

      <Chips
        options={FILTERS}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setShown(PAGE);
        }}
      />

      {data && (
        <Text style={[s.muted, { marginBottom: 8 }]}>
          Showing {filtered.length} of {data.length} properties
        </Text>
      )}

      {data && data.length === 0 && <Empty text="No properties yet. Tap Add to create the first one." />}
      {data && data.length > 0 && filtered.length === 0 && <Empty text="No properties match your filter/search." />}

      {/* ── Property Cards Grid ── */}
      {filtered.slice(0, shown).map((pg) => {
        const lic = getLicenseInfo(pg.licenseExpiry);
        const showUsers = usersOpen === pg.id;
        const isOpen = user?.pgId === pg.id;

        return (
          <Card key={pg.id} style={{ padding: 14, marginBottom: 12 }}>
            {/* Header: Name + Badges */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[s.h2, { fontSize: 17 }]} numberOfLines={1}>
                    {pg.name}
                  </Text>
                  {isOpen && <Badge text="Currently Opened" color={colors.primary} />}
                  <Badge
                    text={pg.active ? 'Active' : 'Blocked'}
                    color={pg.active ? colors.good : colors.bad}
                  />
                </View>
              </View>
            </View>

            {/* Badges & License Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: lic.color + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Ionicons name="calendar-outline" size={12} color={lic.color} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: lic.color }}>{lic.text}</Text>
              </View>
            </View>

            {/* Details Grid Section */}
            <View
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: 10,
                padding: 10,
                marginTop: 10,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600', flex: 1 }}>
                  Owner: {pg.ownerName ?? 'Unassigned'}
                  {pg.mobile ? <Text style={{ color: colors.muted, fontWeight: '400' }}> · {pg.mobile}</Text> : null}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location-outline" size={16} color={colors.muted} />
                <Text style={{ fontSize: 12, color: colors.muted, flex: 1 }} numberOfLines={1}>
                  {pg.city ? `${pg.city}` : 'No city'}
                  {pg.address ? ` · ${pg.address}` : ''}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="layers-outline" size={14} color={colors.muted} />
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {pg.totalFloors ? `${pg.totalFloors} Floors` : 'Single Floor'}
                  </Text>
                </View>
                {pg.startingPrice ? (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.good }}>
                    From ₹{pg.startingPrice}/mo
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Collapsible Users Accordion */}
            <Pressable
              onPress={() => setUsersOpen(showUsers ? null : pg.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 8,
                paddingHorizontal: 4,
                marginTop: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people-outline" size={15} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                  {showUsers ? 'Hide Assigned Users' : 'View Assigned Logins'}
                </Text>
              </View>
              <Ionicons name={showUsers ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
            </Pressable>

            {showUsers && (
              <View style={{ marginBottom: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
                <PgUsers pgId={pg.id} />
              </View>
            )}

            {/* Actions Toolbar */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <Button small label="Open PG" onPress={() => openPg(pg)} />
              <Button small kind="ghost" label="Edit" onPress={() => setEditingPg(pg)} />
              <Button small kind="ghost" label="Photos" onPress={() => setPicturesOf({ type: 'property', id: pg.id, title: pg.name })} />
              <Button small kind="ghost" label="Extend License" onPress={() => setExtend(pg)} />
              <Button
                small
                kind={pg.active ? 'danger' : 'ghost'}
                label={pg.active ? 'Block' : 'Activate'}
                onPress={() => toggle(pg)}
              />
            </View>
          </Card>
        );
      })}

      {filtered.length > shown && (
        <Button
          kind="ghost"
          label={`Show more (${filtered.length - shown})`}
          onPress={() => setShown(shown + PAGE)}
        />
      )}

      {/* ── Modals ── */}
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
