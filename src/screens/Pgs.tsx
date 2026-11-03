import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { get, post, put } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { PgInfo } from '../types';
import { Badge, Button, Card, Empty, FormModal, HeaderAction, Screen, colors, s } from '../ui';

const expiry = (iso: string | null) => {
  if (!iso) return 'No licence';
  const d = new Date(iso);
  return `${d < new Date() ? 'Expired' : 'Valid until'} ${d.toISOString().slice(0, 10)}`;
};

/** Shop Management equivalent (SUPER_ADMIN only): create PGs, open one, block it, extend its licence. */
export default function Pgs() {
  const { user, selectPg, logout } = useAuth();
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const { data, error, loading, refreshing, refresh, reload } = useResource(() => get<PgInfo[]>('/api/admin/pgs'));
  const [open, setOpen] = useState(false);
  const [extend, setExtend] = useState<PgInfo | null>(null);
  const [editingPg, setEditingPg] = useState<PgInfo | null>(null);

  const openPg = async (pg: PgInfo) => {
    if (await attempt(() => selectPg(pg.id))) {
      if (nav.canGoBack()) {
        nav.goBack();
      } else {
        nav.navigate('Main' as never);
      }
    }
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
      {data && data.length === 0 && <Empty text="No PGs yet. Tap Add to create the first one." />}
      {data?.map((pg) => (
        <Card key={pg.id}>
          <View style={s.row}>
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
              <Text style={s.muted}>
                {pg.ownerName ?? 'Owner'}
                {pg.city ? ` · ${pg.city}` : ''}
                {pg.address ? ` · ${pg.address}` : ''}
                {pg.totalFloors ? ` · ${pg.totalFloors} Floors` : ''}
                {pg.amenities ? ` · Amenities: ${pg.amenities}` : ''}
                {pg.upiId ? ` · UPI: ${pg.upiId}` : ''}
              </Text>
              <Text style={s.muted}>{expiry(pg.licenseExpiry)}</Text>
            </View>
            <Badge text={user?.pgId === pg.id ? 'Open' : pg.active ? 'Active' : 'Blocked'} color={pg.active ? colors.good : colors.bad} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Button small label="Open" onPress={() => openPg(pg)} />
            <Button small kind="ghost" label="Edit" onPress={() => setEditingPg(pg)} />
            <Button small kind="ghost" label="Extend licence" onPress={() => setExtend(pg)} />
            <Button small kind={pg.active ? 'danger' : 'ghost'} label={pg.active ? 'Block' : 'Activate'} onPress={() => toggle(pg)} />
          </View>
        </Card>
      ))}

      <FormModal
        visible={open}
        title="New Property / Stay"
        fields={[
          { key: 'name', label: 'Property / Stay Name (e.g. Siri)' },
          { key: 'stayType', label: 'Stay Type (APARTMENT / PG / HOSTEL / COLIVING / STUDIO)', initial: 'APARTMENT' },
          { key: 'address', label: 'Address (e.g. Siri Building, Main Road)', optional: true },
          { key: 'locationUrl', label: 'Map / Google Location URL (https://maps...)', optional: true },
          { key: 'amenities', label: 'Amenities (e.g. Lift, Bike Parking, Watchman, Wi-Fi)', initial: 'Lift, Bike Parking, Watchman, Wi-Fi' },
          { key: 'genderType', label: 'Occupancy Policy (CO_LIVING / GENTS / LADIES)', initial: 'CO_LIVING' },
          { key: 'upiId', label: 'UPI ID for rent collections (e.g. siri@upi)', optional: true },
          { key: 'city', label: 'City', optional: true },
          { key: 'totalFloors', label: 'Number of Floors (e.g. 3)', keyboard: 'number-pad', initial: '3' },
          { key: 'ownerUsername', label: 'Owner username' },
          { key: 'ownerMobile', label: 'Owner mobile (10-15 digits)', keyboard: 'phone-pad' },
          { key: 'ownerPassword', label: 'Owner temporary password (min 8 characters)', secure: true },
        ]}
        onClose={() => setOpen(false)}
        onSubmit={async (v) => {
          if (v.ownerPassword.length < 8) {
            Alert.alert('Too short', 'Use at least 8 characters.');
            return false;
          }
          const floors = parseInt(v.totalFloors, 10);
          const body = {
            name: v.name,
            stayType: v.stayType?.toUpperCase() || 'PG',
            unitLabel: v.stayType?.toUpperCase() === 'APARTMENT' ? 'Flat' : v.stayType?.toUpperCase() === 'HOSTEL' ? 'Dorm' : 'Room',
            address: v.address || undefined,
            locationUrl: v.locationUrl || undefined,
            amenities: v.amenities || undefined,
            city: v.city || undefined,
            genderType: v.genderType?.toUpperCase() || 'CO_LIVING',
            upiId: v.upiId || undefined,
            totalFloors: floors > 0 ? floors : 3,
            mobile: v.ownerMobile,
            ownerName: v.ownerUsername,
            ownerUsername: v.ownerUsername,
            ownerMobile: v.ownerMobile,
            ownerPassword: v.ownerPassword,
          };
          if (!(await attempt(() => post('/api/admin/pgs', body)))) return false;
          setOpen(false);
          reload();
          Alert.alert('Property Created', 'Property registered successfully. The owner can log in and configure units/flats/rooms.');
        }}
      />

      {editingPg && (
        <FormModal
          visible={editingPg !== null}
          title={`Edit · ${editingPg.name}`}
          submitLabel="Save Changes"
          fields={[
            { key: 'name', label: 'Property Name', initial: editingPg.name },
            { key: 'stayType', label: 'Stay Type (APARTMENT / PG / HOSTEL / COLIVING / STUDIO)', initial: editingPg.stayType || 'PG' },
            { key: 'address', label: 'Address', initial: editingPg.address || '', optional: true },
            { key: 'locationUrl', label: 'Map / Google Location URL', initial: editingPg.locationUrl || '', optional: true },
            { key: 'amenities', label: 'Amenities (e.g. Lift, Bike Parking, Watchman)', initial: editingPg.amenities || '', optional: true },
            { key: 'genderType', label: 'Policy (CO_LIVING / GENTS / LADIES)', initial: editingPg.genderType || 'CO_LIVING' },
            { key: 'upiId', label: 'UPI ID for rent collections', initial: editingPg.upiId || '', optional: true },
            { key: 'upiName', label: 'UPI Account / Payee Name', initial: editingPg.upiName || '', optional: true },
            { key: 'city', label: 'City', initial: editingPg.city || '', optional: true },
            { key: 'totalFloors', label: 'Number of Floors', keyboard: 'number-pad', initial: String(editingPg.totalFloors || 3) },
          ]}
          onClose={() => setEditingPg(null)}
          onSubmit={async (v) => {
            const floors = parseInt(v.totalFloors, 10);
            const body = {
              name: v.name,
              stayType: v.stayType?.toUpperCase() || 'PG',
              unitLabel: v.stayType?.toUpperCase() === 'APARTMENT' ? 'Flat' : v.stayType?.toUpperCase() === 'HOSTEL' ? 'Dorm' : 'Room',
              address: v.address || undefined,
              locationUrl: v.locationUrl || undefined,
              amenities: v.amenities || undefined,
              genderType: v.genderType?.toUpperCase() || 'CO_LIVING',
              upiId: v.upiId || undefined,
              upiName: v.upiName || undefined,
              city: v.city || undefined,
              totalFloors: floors > 0 ? floors : 3,
            };
            if (!(await attempt(() => put(`/api/admin/pgs/${editingPg.id}`, body)))) return false;
            setEditingPg(null);
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
