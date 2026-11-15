import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import { post } from '../api';
import { attempt } from '../hooks';
import { Button, Card, Chips, HeaderAction, Screen, colors, s } from '../ui';

const TYPES = ['Suggestion', 'Bug', 'Other'] as const;
const MAX = 2000;

/** Any signed-in user can tell the app's owner what to improve or what is broken. */
export default function Feedback() {
  const nav = useNavigation<NavigationProp<ParamListBase>>();
  const [type, setType] = useState<(typeof TYPES)[number]>('Suggestion');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!message.trim()) {
      Alert.alert('Feedback', 'Please write your feedback first.');
      return;
    }
    setSending(true);
    const ok = await attempt(() => post('/api/feedback', { type: type.toUpperCase(), message: message.trim() }));
    setSending(false);
    if (ok) {
      setMessage('');
      Alert.alert('Thank you', 'Your feedback has been sent.', [{ text: 'OK', onPress: () => nav.goBack() }]);
    }
  };

  return (
    <Screen title="Send Feedback" action={<HeaderAction label="Back" icon="chevron-back" onPress={() => nav.goBack()} />}>
      <Text style={[s.muted, { marginBottom: 10 }]}>
        Tell us what you like, what is not working, or how MyStay can be better.
      </Text>
      <Card>
        <Text style={s.h2}>What is it about?</Text>
        <Chips options={TYPES} value={type} onChange={setType} />
        <Text style={[s.h2, { marginTop: 4 }]}>Your feedback</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={MAX}
          placeholder="Write here..."
          placeholderTextColor={colors.muted}
          textAlignVertical="top"
        />
        <Text style={[s.muted, { textAlign: 'right', marginBottom: 10 }]}>
          {message.length}/{MAX}
        </Text>
        <Button label={sending ? 'Sending...' : 'Send feedback'} onPress={sending ? () => {} : send} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#fff',
  },
});
