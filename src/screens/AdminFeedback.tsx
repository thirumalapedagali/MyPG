import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { get, put } from '../api';
import { attempt, useDebounced, usePaged, useResource } from '../hooks';
import { FeedbackItem } from '../types';
import { Badge, Card, Chips, Empty, HeaderAction, Screen, SearchInput, colors, s } from '../ui';

const TABS = ['New', 'Reviewed', 'All'] as const;
const TYPE_COLOR: Record<FeedbackItem['type'], string> = { SUGGESTION: colors.blue, BUG: colors.bad, OTHER: colors.muted };

/** Super admin: everything users sent through "Send feedback", newest first. */
export default function AdminFeedback() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const [tab, setTab] = useState<(typeof TABS)[number]>('New');
  const [search, setSearch] = useState('');
  const list = usePaged<FeedbackItem>('/api/admin/feedback', {
    status: tab === 'New' ? 'NEW' : tab === 'Reviewed' ? 'REVIEWED' : 'ALL',
    search: useDebounced(search.trim()),
  });
  const counts = useResource(() => get<{ pending: number }>('/api/admin/feedback/count').catch(() => ({ pending: 0 })));
  const waiting = counts.data?.pending ?? 0;

  const refresh = () => {
    list.refresh();
    counts.reload();
  };

  const mark = async (f: FeedbackItem, status: FeedbackItem['status']) => {
    if (await attempt(() => put(`/api/admin/feedback/${f.id}`, { status }))) {
      list.reload();
      counts.reload();
    }
  };

  return (
    <Screen
      title="Feedback"
      action={<HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />}
      loading={list.initialLoading}
      error={list.error}
      refreshing={list.refreshing}
      onRefresh={refresh}
    >
      {!list.initialLoading && (
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Search message, user or property" />
          <Chips options={TABS} value={tab} onChange={setTab} />
          <Text style={[s.muted, { marginBottom: 8 }]}>
            {waiting} new · {list.total} {tab === 'All' ? 'total' : tab.toLowerCase()}
          </Text>
          {list.loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />}
          {!list.loading && list.items.length === 0 && (
            <Empty text={tab === 'New' && !search.trim() ? 'No new feedback.' : 'No feedback matches your filter.'} />
          )}
          {list.items.map((f) => (
            <Card key={f.id} style={{ marginBottom: 8, paddingVertical: 10 }}>
              <View style={s.row}>
                <View style={{ flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                  <Badge text={f.type} color={TYPE_COLOR[f.type]} />
                  <Badge text={f.role} color={colors.primary} />
                </View>
                <Badge text={f.status === 'NEW' ? 'New' : 'Reviewed'} color={f.status === 'NEW' ? colors.warn : colors.good} />
              </View>
              <Text style={styles.message}>{f.message}</Text>
              <Text style={styles.meta}>
                {f.username}
                {f.pgName ? ` · ${f.pgName}` : ''} · {f.createdAt?.slice(0, 10)}
              </Text>
              <View style={styles.actions}>
                {f.status === 'NEW' ? (
                  <TouchableOpacity style={styles.pill} onPress={() => mark(f, 'REVIEWED')} activeOpacity={0.7}>
                    <Text style={styles.pillText}>Mark reviewed</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.pill} onPress={() => mark(f, 'NEW')} activeOpacity={0.7}>
                    <Text style={styles.pillText}>Mark as new</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))}
          {list.hasMore && (
            <TouchableOpacity style={styles.moreBtn} onPress={list.loadMore} disabled={list.loadingMore}>
              {list.loadingMore ? <ActivityIndicator color={colors.blue} /> : <Text style={styles.moreBtnText}>Show more</Text>}
            </TouchableOpacity>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 14, color: colors.text, marginTop: 8 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 10 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.text },
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
