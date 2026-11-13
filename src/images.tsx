import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, type ScrollViewInstance, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { del, errorMessage, get, PickedFile, upload } from './api';

const colors = { primary: '#2e7d32', primaryLight: '#e8f5e9', muted: '#57606a', border: '#e5e7eb', bad: '#c62828' };

const THUMB = 76;

async function pick(fromCamera: boolean, limit: number): Promise<PickedFile[]> {
  const perm = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', `Allow access to your ${fromCamera ? 'camera' : 'photos'} in Settings to add pictures.`);
    return [];
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
  const result = fromCamera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: limit > 1, selectionLimit: limit });
  if (result.canceled) return [];
  return result.assets.map((a, i) => ({
    uri: a.uri,
    name: a.fileName ?? `picture-${Date.now()}-${i}.jpg`,
    type: a.mimeType ?? 'image/jpeg',
  }));
}

/**
 * Pictures chosen on the device but not uploaded yet. The owner of the form keeps the list in state and calls
 * `uploadPictures` once the record exists and has an id.
 */
export function ImagePickerField({
  label,
  files,
  onChange,
  max = 1,
}: {
  label: string;
  files: PickedFile[];
  onChange: (files: PickedFile[]) => void;
  /** How many pictures can be added; 1 means choosing another replaces the current one. */
  max?: number;
}) {
  const add = async (fromCamera: boolean) => {
    try {
      const room = Math.max(max - files.length, 1);
      const picked = await pick(fromCamera, room);
      if (picked.length) onChange(max === 1 ? picked.slice(0, 1) : [...files, ...picked].slice(0, max));
    } catch (e) {
      Alert.alert('Could not add the picture', errorMessage(e));
    }
  };
  const [viewing, setViewing] = useState<number | null>(null);
  const choose = () =>
    Alert.alert(label, undefined, [
      { text: 'Take a photo', onPress: () => add(true) },
      { text: 'Choose from gallery', onPress: () => add(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <View>
      <ImageViewer images={files.map((f) => f.uri)} index={viewing} onClose={() => setViewing(null)} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6, marginTop: 14 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {files.map((f, i) => (
          <View key={f.uri + i} style={{ width: THUMB, height: THUMB }}>
            <Pressable onPress={() => setViewing(i)}>
              <Image source={{ uri: f.uri }} style={{ width: THUMB, height: THUMB, borderRadius: 10, backgroundColor: colors.border }} />
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => onChange(files.filter((_, j) => j !== i))}
              style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 11 }}
            >
              <Ionicons name="close-circle" size={22} color={colors.bad} />
            </Pressable>
          </View>
        ))}
        {(files.length < max || max === 1) && (
          <Pressable
            onPress={choose}
            style={{
              width: THUMB,
              height: THUMB,
              borderRadius: 10,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primaryLight,
            }}
          >
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700', marginTop: 2 }}>
              {files.length && max === 1 ? 'Change' : 'Add'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Uploads the chosen pictures to `/api/media/...`. The record is already saved, so a failure must not look like the
 * record was lost: this returns a message to show (or null when everything went up).
 */
export async function uploadPictures(path: string, files: PickedFile[], afterCreate = true): Promise<string | null> {
  let failed = 0;
  let reason = '';
  for (const f of files) {
    try {
      await upload(path, f);
    } catch (e) {
      failed++;
      reason = errorMessage(e);
    }
  }
  if (!failed) return null;
  return `${failed} of ${files.length} picture${files.length === 1 ? '' : 's'} could not be uploaded (${reason}).${afterCreate ? ' The record was saved; open Pictures on it to add them again.' : ''}`;
}

type Saved = { id: number; kind: string; url: string };

/**
 * The pictures already saved for a record (`path` is e.g. `/api/media/room/7`), with add and remove. Each picture is
 * uploaded the moment it is chosen, so a picture that failed when the record was created can simply be added again.
 * `kind` limits it to one slot (a resident's PHOTO or ID_CARD); `max` 1 means a new picture replaces the old one.
 */
export function PictureManager({ path, kind, max = 10 }: { path: string; kind?: string; max?: number }) {
  const [items, setItems] = useState<Saved[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const load = () => setVersion((v) => v + 1);
  const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);
  const pictures = (items ?? []).filter((i) => !isPdf(i.url));

  useEffect(() => {
    let current = true;
    get<Saved[]>(path)
      .then((all) => {
        if (!current) return;
        setItems(kind ? all.filter((i) => i.kind === kind) : all);
        setError(null);
      })
      .catch((e) => current && setError(errorMessage(e)));
    return () => {
      current = false;
    };
  }, [path, kind, version]);

  const onPicked = async (files: PickedFile[]) => {
    if (!files.length) return;
    setBusy(true);
    const problem = await uploadPictures(kind ? `${path}?kind=${kind}` : path, files, false);
    setBusy(false);
    if (problem) Alert.alert('Upload failed', problem);
    load();
  };

  const remove = (i: Saved) =>
    Alert.alert('Remove picture', 'Remove this picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await del(`${path}/${i.id}`);
          } catch (e) {
            Alert.alert('Could not remove the picture', errorMessage(e));
          }
          load();
        },
      },
    ]);

  return (
    <View>
      <ImageViewer images={pictures.map((p) => p.url)} index={viewing} onClose={() => setViewing(null)} />
      {items === null && !error && <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} />}
      {error && (
        <Pressable onPress={load}>
          <Text style={{ color: colors.bad, marginTop: 14, fontSize: 13 }}>{error} Tap to retry.</Text>
        </Pressable>
      )}
      {items && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {items.map((i) => (
              <View key={i.id} style={{ width: THUMB, height: THUMB, marginTop: 10 }}>
                {isPdf(i.url) ? (
                  <Pressable
                    onPress={() => Linking.openURL(i.url).catch(() => Alert.alert('Could not open the file'))}
                    style={{
                      width: THUMB,
                      height: THUMB,
                      borderRadius: 10,
                      backgroundColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="document-text-outline" size={28} color={colors.muted} />
                    <Text style={{ fontSize: 10, color: colors.muted }}>PDF</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setViewing(pictures.findIndex((p) => p.id === i.id))}>
                    <Image source={{ uri: i.url }} style={{ width: THUMB, height: THUMB, borderRadius: 10, backgroundColor: colors.border }} />
                  </Pressable>
                )}
                <Pressable
                  hitSlop={8}
                  onPress={() => remove(i)}
                  style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 11 }}
                >
                  <Ionicons name="close-circle" size={22} color={colors.bad} />
                </Pressable>
              </View>
            ))}
          </View>
          {items.length === 0 && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 10 }}>No pictures yet.</Text>}
          {busy ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : (
            (items.length < max || max === 1) && (
              <PickerButtons replace={max === 1 && items.length > 0} room={max - items.length} onPicked={onPicked} />
            )
          )}
        </>
      )}
    </View>
  );
}

function PickerButtons({ replace, room, onPicked }: { replace: boolean; room: number; onPicked: (f: PickedFile[]) => void }) {
  const run = async (fromCamera: boolean) => {
    try {
      onPicked(await pick(fromCamera, Math.max(room, 1)));
    } catch (e) {
      Alert.alert('Could not add the picture', errorMessage(e));
    }
  };
  const btn = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  };
  const text = { color: colors.primary, fontWeight: '700' as const, fontSize: 13 };
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
      <Pressable style={btn} onPress={() => run(false)}>
        <Ionicons name="images-outline" size={18} color={colors.primary} />
        <Text style={text}>{replace ? 'Replace from gallery' : 'Add from gallery'}</Text>
      </Pressable>
      <Pressable style={btn} onPress={() => run(true)}>
        <Ionicons name="camera-outline" size={18} color={colors.primary} />
        <Text style={text}>Take a photo</Text>
      </Pressable>
    </View>
  );
}

/**
 * Swipeable pictures with a "2 / 5" counter. Renders nothing when there are no pictures, so callers can place it
 * unconditionally. Picture width follows the space the parent gives it.
 */
export function ImageGallery({ images, height = 160, radius = 12 }: { images?: string[]; height?: number; radius?: number }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  if (!images || images.length === 0) return null;
  return (
    <View
      style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.border }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {images.map((uri, i) => (
            <Pressable key={uri + i} onPress={() => setViewing(i)}>
              <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      )}
      <ImageViewer images={images} index={viewing} onClose={() => setViewing(null)} />
      {images.length > 1 && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
            {index + 1} / {images.length}
          </Text>
        </View>
      )}
    </View>
  );
}
/** Full-screen picture viewer: swipe between pictures, pinch to zoom on iOS, close with the X or the back button. */
export function ImageViewer({ images, index, onClose }: { images: string[]; index: number | null; onClose: () => void }) {
  if (index === null || images.length === 0) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <ViewerBody images={images} start={Math.min(Math.max(index, 0), images.length - 1)} onClose={onClose} />
    </Modal>
  );
}

function ViewerBody({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(start);
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={() => scroller.current?.scrollTo({ x: start * width, animated: false })}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {images.map((uri, i) => (
          <ScrollView
            key={uri + i}
            style={{ width, height }}
            contentContainerStyle={{ width, height, alignItems: 'center', justifyContent: 'center' }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
          </ScrollView>
        ))}
      </ScrollView>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityLabel="Close picture"
        style={{ position: 'absolute', top: insets.top + 12, right: 16, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: 6 }}
      >
        <Ionicons name="close" size={26} color="#fff" />
      </Pressable>
      {images.length > 1 && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', bottom: insets.bottom + 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
            {page + 1} / {images.length}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Wraps a small picture (e.g. an avatar) so tapping it opens it full screen. */
export function ViewablePhoto({ uri, children }: { uri: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={{ width: '100%', height: '100%' }}>
        {children}
      </Pressable>
      <ImageViewer images={[uri]} index={open ? 0 : null} onClose={() => setOpen(false)} />
    </>
  );
}