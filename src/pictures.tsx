import React from 'react';
import { ScrollView, Text } from 'react-native';
import { PictureManager } from './images';
import { Sheet, s } from './ui';

/** Which pictures to manage: a property or room gallery, or a resident's photo and ID card. */
export type PictureTarget = { type: 'property' | 'room' | 'resident'; id: number; title: string };

/** Bottom sheet to view, add and remove the saved pictures of one property, room or resident. */
export function PicturesSheet({ target, onClose }: { target: PictureTarget | null; onClose: () => void }) {
  return (
    <Sheet visible={!!target} title={target ? `Pictures · ${target.title}` : 'Pictures'} onClose={onClose}>
      {target && (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>
          {target.type === 'resident' ? (
            <>
              <Text style={s.label}>Photo</Text>
              <PictureManager path={`/api/media/resident/${target.id}`} kind="PHOTO" max={1} />
              <Text style={s.label}>ID card</Text>
              <Text style={s.muted}>Up to 4 files, e.g. the front and back of the Aadhaar card.</Text>
              <PictureManager path={`/api/media/resident/${target.id}`} kind="ID_CARD" max={4} />
            </>
          ) : (
            <>
              <Text style={s.muted}>Up to 10 pictures.</Text>
              <PictureManager path={`/api/media/${target.type}/${target.id}`} />
            </>
          )}
        </ScrollView>
      )}
    </Sheet>
  );
}
