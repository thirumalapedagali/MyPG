import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { get, post, put } from '../api';
import { attempt, useResource } from '../hooks';
import { LookupRow } from '../types';
import { Badge, Button, Card, Chips, Empty, FormModal, HeaderAction, Screen, colors, s } from '../ui';

const ALL = 'All';
const KEY = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Form state: `null` = closed, no `id` = adding, with `id` = editing that value. */
type Editing = { id?: number; category?: string; code?: string; label?: string; extra?: string | null; sortOrder?: number };

/**
 * Super admin: maintain the lookup table behind every dropdown. Any category name works, so a new kind of option
 * list can be created here and then read by the app with `useLookup('<CATEGORY>')`.
 */
export default function Lookups() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const { data, error, loading, refreshing, refresh, reload } = useResource(() => get<LookupRow[]>('/api/admin/lookups'));
  const [category, setCategory] = useState(ALL);
  const [editing, setEditing] = useState<Editing | null>(null);

  const rows = data ?? [];
  const categories = Array.from(new Set(rows.map((r) => r.category))).sort();
  const shown = rows.filter((r) => category === ALL || r.category === category);

  const toggle = async (r: LookupRow) => {
    if (await attempt(() => put(`/api/admin/lookups/${r.id}`, { active: !r.active }))) reload();
  };

  const confirmHide = (r: LookupRow) =>
    Alert.alert('Hide option', `${r.label} will no longer appear in dropdowns. Records that already use it keep their value.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Hide', style: 'destructive', onPress: () => toggle(r) },
    ]);

  const adding = editing != null && editing.id == null;

  return (
    <Screen
      title="Lookup Data"
      action={
        <View style={{ flexDirection: 'row' }}>
          <HeaderAction label="Add" icon="add-circle" onPress={() => setEditing({ category: category === ALL ? '' : category })} />
          <HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />
        </View>
      }
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <Text style={[s.muted, { fontSize: 12, marginBottom: 8 }]}>
        Options for the dropdowns in the app. Add a value to an existing category, or type a new category name to create one.
      </Text>
      {categories.length > 0 && <Chips options={[ALL, ...categories]} value={category} onChange={setCategory} />}
      {data && <Text style={[s.muted, { marginBottom: 8 }]}>{shown.length} values</Text>}
      {data && shown.length === 0 && <Empty text="No values yet. Tap Add to create one." />}

      {shown.map((r) => (
        <Card key={r.id} style={{ paddingVertical: 10, paddingHorizontal: 12, opacity: r.active ? 1 : 0.6 }}>
          <View style={[s.row, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={s.h2}>{r.label}</Text>
              <Text style={[s.muted, { fontSize: 12, marginTop: 2 }]}>
                {r.category} · {r.code} · order {r.sortOrder}
              </Text>
              {!!r.extra && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="pricetag-outline" size={12} color={colors.muted} />
                  <Text style={[s.muted, { fontSize: 12 }]}>{r.extra}</Text>
                </View>
              )}
            </View>
            <Badge text={r.active ? 'Active' : 'Hidden'} color={r.active ? colors.good : colors.muted} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
            <Button small label="Edit" onPress={() => setEditing(r)} />
            <Button small kind="ghost" label={r.active ? 'Hide' : 'Show'} onPress={() => (r.active ? confirmHide(r) : toggle(r))} />
          </View>
        </Card>
      ))}

      <FormModal
        visible={editing != null}
        title={adding ? 'Add lookup value' : `Edit · ${editing?.label ?? ''}`}
        fields={[
          ...(adding
            ? [
                { key: 'category', label: 'Category (e.g. VEHICLE_TYPE)', initial: editing?.category },
                { key: 'code', label: 'Code (stored on records, e.g. BIKE)' },
              ]
            : []),
          { key: 'label', label: 'Label (shown to users)', initial: editing?.label },
          { key: 'extra', label: 'Extra (optional, e.g. a default value)', initial: editing?.extra ?? undefined, optional: true },
          { key: 'sortOrder', label: 'Sort order (smaller shows first)', keyboard: 'number-pad', initial: String(editing?.sortOrder ?? 0), optional: true },
        ]}
        onClose={() => setEditing(null)}
        onSubmit={async (v) => {
          if (adding && (!KEY.test(v.category) || !KEY.test(v.code))) {
            Alert.alert('Invalid', 'Category and code must start with a letter and use only letters, digits and _.');
            return false;
          }
          const sortOrder = parseInt(v.sortOrder || '0', 10);
          if (Number.isNaN(sortOrder)) {
            Alert.alert('Invalid', 'Sort order must be a number.');
            return false;
          }
          const body = { label: v.label, extra: v.extra ?? '', sortOrder };
          const ok = await attempt(() =>
            adding
              ? post('/api/admin/lookups', { ...body, category: v.category, code: v.code })
              : put(`/api/admin/lookups/${editing!.id}`, body),
          );
          if (!ok) return false;
          if (adding) setCategory(v.category.toUpperCase());
          setEditing(null);
          reload();
        }}
      />
    </Screen>
  );
}
