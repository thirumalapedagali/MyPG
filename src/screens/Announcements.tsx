import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { del, get, post } from '../api';
import { useAuth } from '../auth';
import { attempt, useResource } from '../hooks';
import { Announcement } from '../types';
import { Badge, Card, Empty, FormModal, HeaderAction, Screen, colors, s } from '../ui';

const CATEGORIES: Announcement['category'][] = ['ANNOUNCEMENT', 'MAINTENANCE', 'EVENT', 'RULE'];
const CATEGORY_COLOR: Record<Announcement['category'], string> = {
  ANNOUNCEMENT: colors.blue,
  MAINTENANCE: colors.warn,
  EVENT: colors.good,
  RULE: colors.bad,
};

/** Notices for the residents of the current property. Staff post and delete them; residents only read them. */
export default function Announcements({ route }: { route?: { params?: { add?: number } } }) {
  const { user } = useAuth();
  const canPost = user?.role !== 'RESIDENT';
  const { data, error, loading, refreshing, refresh, reload } = useResource(() => get<Announcement[]>('/api/announcements'));
  // Opened from a Dashboard quick action: go straight to the new-announcement form.
  const [open, setOpen] = useState(route?.params?.add != null);

  const confirmDelete = (a: Announcement) =>
    Alert.alert('Delete announcement', `Delete "${a.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await attempt(() => del(`/api/announcements/${a.id}`))) reload();
        },
      },
    ]);

  return (
    <Screen
      title="Announcements"
      action={canPost ? <HeaderAction label="New" icon="add-circle" onPress={() => setOpen(true)} /> : undefined}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {data && data.length === 0 && (
        <Empty text={canPost ? 'No announcements yet. Tap New to post one.' : 'No announcements yet.'} />
      )}
      {(data ?? []).map((a) => (
        <Card key={a.id}>
          <View style={[s.row, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Badge text={a.category} color={CATEGORY_COLOR[a.category]} />
                {a.important && <Badge text="IMPORTANT" color={colors.bad} />}
                <Text style={[s.muted, { fontSize: 11 }]}>{a.date}</Text>
              </View>
              <Text style={s.h2}>{a.title}</Text>
              <Text style={[s.muted, { marginTop: 4, fontSize: 13 }]}>{a.content}</Text>
            </View>
            {canPost && (
              <Pressable onPress={() => confirmDelete(a)} hitSlop={10} accessibilityLabel="Delete announcement">
                <Ionicons name="trash-outline" size={18} color={colors.bad} />
              </Pressable>
            )}
          </View>
        </Card>
      ))}

      <AddAnnouncementModal
        visible={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          reload();
        }}
      />
    </Screen>
  );
}

export function AddAnnouncementModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  return (
    <FormModal
      visible={visible}
      title="New announcement"
      submitLabel="Post"
      fields={[
        { key: 'title', label: 'Title' },
        { key: 'content', label: 'Message' },
        {
          key: 'category',
          label: 'Type',
          options: CATEGORIES.map((c) => ({
            code: c,
            label: c.charAt(0) + c.slice(1).toLowerCase(),
          })),
          initial: 'ANNOUNCEMENT',
        },
        {
          key: 'important',
          label: 'Is this announcement important?',
          options: [
            { code: 'no', label: 'No' },
            { code: 'yes', label: 'Yes' },
          ],
          initial: 'no',
        },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        const category = v.category.toUpperCase() as Announcement['category'];
        if (!CATEGORIES.includes(category)) {
          Alert.alert('Invalid', `Type must be one of: ${CATEGORIES.join(', ')}.`);
          return false;
        }
        const important = /^(y|yes|true|1)$/i.test(v.important ?? '');
        if (!(await attempt(() => post('/api/announcements', { title: v.title, content: v.content, category, important })))) {
          return false;
        }
        onCreated();
      }}
    />
  );
}
