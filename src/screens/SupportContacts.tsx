import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { del, get, post, put } from '../api';
import { attempt, useResource } from '../hooks';
import { SupportContact } from '../types';
import { Card, Empty, FormModal, HeaderAction, Screen, colors, s } from '../ui';

/** Contacts the owner chooses to share with residents in Support & Helpline. */
export default function SupportContacts() {
  const { data, error, loading, refreshing, refresh, reload } = useResource(() => get<SupportContact[]>('/api/support-contacts'));
  // `null` = form closed, `{}` = adding, a contact = editing it.
  const [editing, setEditing] = useState<Partial<SupportContact> | null>(null);

  const confirmDelete = (c: SupportContact) =>
    Alert.alert('Delete contact', `Remove ${c.name} from Support & Helpline?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/support-contacts/${c.id}`))) reload();
        },
      },
    ]);

  return (
    <Screen
      title="Support Contacts"
      action={<HeaderAction label="Add" icon="add-circle" onPress={() => setEditing({})} />}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <Text style={[s.muted, { fontSize: 12, marginBottom: 8 }]}>
        Residents see these numbers under Support &amp; Helpline on their home screen.
      </Text>
      {data && data.length === 0 && <Empty text="No contacts yet. Tap Add to share a number with your residents." />}
      {(data ?? []).map((c) => (
        <Card key={c.id}>
          <View style={[s.row, { alignItems: 'center' }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={s.h2}>{c.name}</Text>
              <Text style={[s.muted, { marginTop: 2 }]}>{c.phone}</Text>
              {!!c.note && <Text style={[s.muted, { marginTop: 2, fontSize: 12 }]}>{c.note}</Text>}
            </View>
            <Pressable onPress={() => setEditing(c)} hitSlop={10} accessibilityLabel="Edit contact" style={{ marginRight: 16 }}>
              <Ionicons name="create-outline" size={18} color={colors.blue} />
            </Pressable>
            <Pressable onPress={() => confirmDelete(c)} hitSlop={10} accessibilityLabel="Delete contact">
              <Ionicons name="trash-outline" size={18} color={colors.bad} />
            </Pressable>
          </View>
        </Card>
      ))}

      <FormModal
        visible={editing != null}
        title={editing?.id ? 'Edit contact' : 'New contact'}
        fields={[
          { key: 'name', label: 'Name / role (e.g. Warden, Plumber)', initial: editing?.name },
          { key: 'phone', label: 'Phone number', keyboard: 'phone-pad', initial: editing?.phone },
          { key: 'note', label: 'Note (e.g. Available 24/7)', initial: editing?.note ?? undefined, optional: true },
        ]}
        onClose={() => setEditing(null)}
        onSubmit={async (v) => {
          const phone = v.phone.replace(/[\s-]/g, '');
          if (!/^\+?\d{3,15}$/.test(phone)) {
            Alert.alert('Invalid', 'Enter a valid phone number (digits only, optionally starting with +).');
            return false;
          }
          const body = { name: v.name, phone, note: v.note ?? '' };
          const ok = await attempt(() =>
            editing?.id ? put(`/api/support-contacts/${editing.id}`, body) : post('/api/support-contacts', body),
          );
          if (!ok) return false;
          setEditing(null);
          reload();
        }}
      />
    </Screen>
  );
}
