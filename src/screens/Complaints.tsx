import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { get, put } from '../api';
import { attempt, useDebounced, usePaged, useResource } from '../hooks';
import { Complaint, ComplaintStatus } from '../types';
import { Badge, Card, Chips, Empty, FormModal, Screen, SearchInput, colors, s } from '../ui';

const TABS = ['Open', 'In progress', 'Resolved', 'All'] as const;

const STATUS_LABEL: Record<ComplaintStatus, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved' };
const STATUS_COLOR: Record<ComplaintStatus, string> = { OPEN: colors.warn, IN_PROGRESS: colors.blue, RESOLVED: colors.good };
const PRIORITY_COLOR: Record<Complaint['priority'], string> = { LOW: colors.muted, MEDIUM: colors.warn, HIGH: colors.bad };

/**
 * Complaints raised by residents of the current property. The owner or manager takes one up, and resolving it
 * (with a note) tells the resident who raised it.
 */
export default function Complaints() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Open');
  const [search, setSearch] = useState('');
  const [resolving, setResolving] = useState<Complaint | null>(null);
  // Only the selected tab's first page is fetched; other tabs load when tapped, more rows on "Show more".
  const list = usePaged<Complaint>('/api/complaints', {
    status: tab === 'Open' ? 'OPEN' : tab === 'In progress' ? 'IN_PROGRESS' : tab === 'Resolved' ? 'RESOLVED' : 'ALL',
    search: useDebounced(search.trim()),
  });
  const counts = useResource(() => get<{ pending: number }>('/api/complaints/count').catch(() => ({ pending: 0 })));
  const open = counts.data?.pending ?? 0;
  const visible = list.items;
  const reload = () => {
    list.reload();
    counts.reload();
  };
  const refresh = () => {
    list.refresh();
    counts.reload();
  };

  const setStatus = async (c: Complaint, status: ComplaintStatus, resolutionNotes?: string | null) => {
    const ok = await attempt(() =>
      put(`/api/complaints/${c.id}`, { status, resolutionNotes: resolutionNotes ?? c.resolutionNotes ?? null })
    );
    if (ok) reload();
    return ok;
  };

  return (
    <Screen title="Complaints" loading={list.initialLoading} error={list.error} refreshing={list.refreshing} onRefresh={refresh}>
      {!list.initialLoading && (
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Search resident, room, title or category" />
          <Chips options={TABS} value={tab} onChange={setTab} />
          <Text style={[s.muted, { marginBottom: 8 }]}>
            {open} waiting · {list.total} {tab === 'All' ? 'total' : tab.toLowerCase()}
          </Text>
          {list.loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />}
          {!list.loading && visible.length === 0 && (
            <Empty
              text={
                tab === 'Open' && !search.trim()
                  ? 'No open complaints. When a resident raises one, it will appear here for you to resolve.'
                  : 'No complaints match your filter.'
              }
            />
          )}
          {visible.map((c) => {
            const where = [c.roomNumber ? `Room ${c.roomNumber}` : null, c.bedNumber ? `${c.bedNumber}` : null]
              .filter(Boolean)
              .join(' · ');
            return (
              <Card key={c.id} style={{ marginBottom: 8, paddingVertical: 10 }}>
                <View style={s.row}>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                    <Badge text={c.categoryLabel} color={colors.blue} />
                    <Badge text={c.priority} color={PRIORITY_COLOR[c.priority]} />
                  </View>
                  <Badge text={STATUS_LABEL[c.status]} color={STATUS_COLOR[c.status]} />
                </View>
                <Text style={[s.h2, { fontSize: 15, marginTop: 6 }]}>{c.title}</Text>
                <Text style={styles.desc}>{c.description}</Text>
                <Line icon="person-outline" text={[c.residentName, where].filter(Boolean).join(' · ') || 'Resident'} />
                <Line icon="calendar-outline" text={`Raised ${c.createdAt?.slice(0, 10)}`} />
                {c.resolutionNotes ? (
                  <View style={styles.note}>
                    <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.good} />
                    <Text style={styles.noteText}>
                      {c.resolutionNotes}
                      {c.handledBy ? ` — ${c.handledBy}` : ''}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.actions}>
                  {c.residentPhone ? (
                    <Pill icon="call" label="Call" onPress={() => Linking.openURL(`tel:${c.residentPhone}`)} />
                  ) : null}
                  {c.status === 'OPEN' && (
                    <Pill icon="construct" label="Start work" onPress={() => setStatus(c, 'IN_PROGRESS')} />
                  )}
                  {c.status !== 'RESOLVED' && <Pill icon="checkmark-circle" label="Resolve" solid onPress={() => setResolving(c)} />}
                  {c.status === 'RESOLVED' && <Pill icon="refresh" label="Reopen" danger onPress={() => setStatus(c, 'OPEN')} />}
                </View>
              </Card>
            );
          })}
          {list.hasMore && (
            <TouchableOpacity style={styles.moreBtn} onPress={list.loadMore} disabled={list.loadingMore}>
              {list.loadingMore ? <ActivityIndicator color={colors.blue} /> : <Text style={styles.moreBtnText}>Show more</Text>}
            </TouchableOpacity>
          )}
        </>
      )}

      <FormModal
        visible={!!resolving}
        title={resolving ? `Resolve: ${resolving.title}` : 'Resolve'}
        submitLabel="Mark resolved & notify"
        fields={[{ key: 'notes', label: 'What was done? (the resident will see this)', initial: resolving?.resolutionNotes ?? '' }]}
        onClose={() => setResolving(null)}
        onSubmit={async (v) => {
          if (!resolving) return false;
          if (!(await setStatus(resolving, 'RESOLVED', v.notes))) return false;
          setResolving(null);
        }}
      />
    </Screen>
  );
}

function Line({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={13} color={colors.muted} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

function Pill({
  icon,
  label,
  onPress,
  solid,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  solid?: boolean;
  danger?: boolean;
}) {
  const fg = solid ? '#fff' : danger ? colors.bad : colors.good;
  return (
    <TouchableOpacity
      style={[styles.pill, solid && { backgroundColor: colors.good, borderColor: colors.good }, danger && { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={13} color={fg} />
      <Text style={[styles.pillText, { color: solid || danger ? fg : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  desc: { fontSize: 13, color: '#475569', marginTop: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  lineText: { fontSize: 12, color: colors.muted, flex: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: '#f0fdf4' },
  noteText: { fontSize: 12, color: '#166534', flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  moreBtn: {
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    marginTop: 4,
  },
  moreBtnText: { fontSize: 13, fontWeight: '700', color: colors.blue },
});
