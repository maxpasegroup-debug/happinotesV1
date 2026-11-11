import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { ActionButton, ScreenHeader } from '@/components/ui/action-button';
import { ChoiceField, Field } from '@/components/ui/field';
import { apiErrorMessage, request } from '@/lib/api';
import { fetchAdminHappyBites } from '@/lib/happy-bites';
import { clockTime } from '@/lib/format';
import type { HappyBite, HappyBiteDraft } from '@/lib/types';

const blankDraft = (): HappyBiteDraft => ({ title: '', description: '', thumbnailUrl: '', audioUrl: '', durationSeconds: 0, category: 'mindfulness', accessType: 'free', published: false, displayOrder: 0 });
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg'];

export default function AdminHappyBitesScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<HappyBite[]>([]);
  const [draft, setDraft] = useState<HappyBiteDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setItems(await fetchAdminHappyBites()); }
    catch (e) { setError(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  if (!user || user.role !== 'admin') return <Redirect href={user ? '/(tabs)' : '/auth'} />;

  const upload = async (kind: 'thumbnail' | 'audio') => {
    const isImage = kind === 'thumbnail';
    const picked = await DocumentPicker.getDocumentAsync({ type: isImage ? imageTypes : audioTypes, copyToCacheDirectory: true, multiple: false });
    if (picked.canceled || !picked.assets?.[0]) return;
    const file = picked.assets[0];
    const maxBytes = isImage ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
    const allowed = isImage ? imageTypes : audioTypes;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const extOk = isImage ? ['jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '') : ext === 'mp3';
    if ((file.mimeType && !allowed.includes(file.mimeType)) || !extOk) { setError(`Choose a supported ${isImage ? 'JPG, PNG, or WebP image' : 'MP3 audio file'}.`); return; }
    if (typeof file.size === 'number' && file.size > maxBytes) { setError(`${isImage ? 'Thumbnail images' : 'Audio files'} must be ${isImage ? '5' : '50'} MB or smaller.`); return; }
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('scope', isImage ? 'happy-bite-thumbnail' : 'happy-bite-audio');
      form.append('media', { uri: file.uri, name: file.name, type: file.mimeType || (isImage ? 'image/jpeg' : 'audio/mpeg') } as any);
      const result = await request<{ url?: string; durationSeconds?: number }>('/admin/contents/upload-media', { method: 'POST', body: form });
      if (!result.url) throw new Error('The upload did not return a file URL.');
      setDraft((current) => current ? ({ ...current, ...(isImage ? { thumbnailUrl: result.url! } : { audioUrl: result.url!, ...(result.durationSeconds ? { durationSeconds: result.durationSeconds } : {}) }) }) : current);
    } catch (e) { setError(apiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.description.trim() || !draft.thumbnailUrl || !draft.audioUrl || !draft.category.trim()) { setError('Add a title, description, thumbnail, audio file, and category.'); return; }
    setBusy(true); setError('');
    try {
      const body = JSON.stringify({ title: draft.title.trim(), description: draft.description.trim(), thumbnailUrl: draft.thumbnailUrl, audioUrl: draft.audioUrl, durationSeconds: Number(draft.durationSeconds) || 0, category: draft.category.trim(), published: draft.published, accessType: draft.accessType, displayOrder: Number(draft.displayOrder) || 0 });
      await request(draft.id ? `/admin/happy-bites/${encodeURIComponent(draft.id)}` : '/admin/happy-bites', { method: draft.id ? 'PUT' : 'POST', body });
      setDraft(null); await load();
    } catch (e) { setError(apiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  const remove = (bite: HappyBite) => Alert.alert('Delete Happy Bite?', `“${bite.title}” will be permanently removed.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void (async () => { setBusy(true); try { await request(`/admin/happy-bites/${encodeURIComponent(bite.id)}`, { method: 'DELETE' }); await load(); } catch (e) { setError(apiErrorMessage(e)); } finally { setBusy(false); } })(); } }]);

  const unpublish = async (bite: HappyBite) => {
    setBusy(true); setError('');
    try { await request(`/admin/happy-bites/${encodeURIComponent(bite.id)}`, { method: 'PUT', body: JSON.stringify({ published: false }) }); await load(); }
    catch (e) { setError(apiErrorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <ScreenHeader title="Content Management · Happy Bites" onBack={() => draft ? setDraft(null) : router.back()} />
      {draft ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-10 pt-2">
          <Text className="mb-4 text-xl font-black text-[#241F1C] dark:text-[#F8F5F0]">{draft.id ? 'Edit Happy Bite' : 'Create Happy Bite'}</Text>
          <Field label="Title *" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} autoCapitalize="sentences" />
          <Field label="Short description *" value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} multiline autoCapitalize="sentences" />
          <ChoiceField label="Category *" value={draft.category} options={['mindfulness', 'happiness', 'health', 'relationships', 'motivation', 'general']} onChange={(category) => setDraft({ ...draft, category })} />
          <Text className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-[#6B625C] dark:text-[#A8A29E]">Thumbnail *</Text>
          {draft.thumbnailUrl ? <Image source={{ uri: draft.thumbnailUrl }} contentFit="cover" style={{ width: '100%', height: 180, borderRadius: 14, marginBottom: 8 }} /> : null}
          <ActionButton label={busy ? 'Uploading…' : draft.thumbnailUrl ? 'Replace thumbnail' : 'Upload thumbnail'} icon="image" onPress={() => void upload('thumbnail')} disabled={busy} variant="secondary" />
          <View className="mt-4" />
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6B625C] dark:text-[#A8A29E]">Audio file *</Text>
          {draft.audioUrl ? <View className="mb-2 rounded-xl bg-[#F6F6F6] p-3 dark:bg-[#242424]"><Text numberOfLines={2} className="text-sm text-[#241F1C] dark:text-[#F8F5F0]">Audio uploaded · {clockTime(draft.durationSeconds)}</Text></View> : null}
          <ActionButton label={busy ? 'Uploading…' : draft.audioUrl ? 'Replace audio file' : 'Upload one audio file'} icon="musical-notes" onPress={() => void upload('audio')} disabled={busy} variant="secondary" />
          <View className="mt-4" />
          <Field label="Duration (seconds) · detected on upload when available" value={String(draft.durationSeconds || 0)} onChangeText={(v) => setDraft({ ...draft, durationSeconds: Number(v) || 0 })} keyboardType="number-pad" />
          <Field label="Display order" value={String(draft.displayOrder)} onChangeText={(v) => setDraft({ ...draft, displayOrder: Number(v) || 0 })} keyboardType="number-pad" />
          <View className="mb-4 rounded-2xl bg-[#F6F6F6] p-4 dark:bg-[#242424]">
            <View className="flex-row items-center justify-between">
              <View className="mr-3 flex-1"><Text className="font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">{draft.accessType === 'premium' ? 'Premium · Pro members' : 'Free · Everyone'}</Text><Text className="mt-1 text-xs leading-5 text-[#6B625C] dark:text-[#A8A29E]">Enable Premium to require an existing Pro subscription. No separate purchase.</Text></View>
              <Switch accessibilityLabel="Require a Pro subscription for this Happy Bite" value={draft.accessType === 'premium'} disabled={busy} onValueChange={(premium) => setDraft({ ...draft, accessType: premium ? 'premium' : 'free' })} trackColor={{ false: '#A8A29E', true: '#F25F45' }} thumbColor="#FFFFFF" />
            </View>
          </View>
          <ChoiceField label="Publish status" value={draft.published ? 'published' : 'draft'} options={['draft', 'published']} onChange={(v) => setDraft({ ...draft, published: v === 'published' })} />
          {error ? <Text className="mb-3 text-sm text-red-500">{error}</Text> : null}
          <ActionButton label={busy ? 'Saving…' : draft.id ? 'Save changes' : 'Create Happy Bite'} onPress={() => void save()} disabled={busy} />
        </ScrollView>
      ) : (
        <>
          <View className="flex-row items-center px-5 pb-2 pt-1"><Text className="flex-1 text-sm text-[#6B625C] dark:text-[#A8A29E]">Drafts and published short audio</Text><Pressable accessibilityRole="button" onPress={() => { setError(''); setDraft(blankDraft()); }} className="flex-row items-center rounded-xl bg-coral px-3.5 py-2.5"><Ionicons name="add" size={18} color="#fff" /><Text className="ml-1 font-extrabold text-white">New</Text></Pressable></View>
          {error ? <Text className="px-5 pb-2 text-sm text-red-500">{error}</Text> : null}
          {loading && items.length === 0 ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#F25F45" /></View> : <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#F25F45" />} contentContainerClassName="gap-3 px-4 pb-8 pt-2">{items.length === 0 ? <Text className="mt-12 text-center text-[#6B625C] dark:text-[#A8A29E]">No Happy Bites yet. Create the first one.</Text> : items.map((bite) => <View key={bite.id} className="flex-row items-center rounded-2xl border border-[#D9D0C8]/60 p-3 dark:border-[#4A4542]">{bite.thumbnailUrl ? <Image source={{ uri: bite.thumbnailUrl }} contentFit="cover" style={{ width: 62, height: 62, borderRadius: 12 }} /> : <View className="h-[62px] w-[62px] items-center justify-center rounded-xl bg-[#F6F6F6] dark:bg-[#242424]"><Ionicons name="sparkles" size={24} color="#F25F45" /></View>}<View className="ml-3 flex-1"><Text numberOfLines={1} className="font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">{bite.title}</Text><Text className="mt-1 text-xs capitalize text-[#6B625C] dark:text-[#A8A29E]">{bite.category} · {clockTime(bite.durationSeconds)} · {bite.accessType === 'premium' ? 'Premium' : 'Free'} · {bite.published ? 'Published' : 'Draft'}</Text><Text numberOfLines={1} className="mt-1 text-[10px] text-[#A8A29E]">ID {bite.id}</Text></View><Pressable accessibilityLabel="Edit Happy Bite" onPress={() => setDraft({ ...bite })} className="p-2"><Ionicons name="create-outline" size={21} color="#F25F45" /></Pressable>{bite.published ? <Pressable accessibilityLabel="Unpublish Happy Bite" onPress={() => void unpublish(bite)} className="p-2"><Ionicons name="eye-off-outline" size={21} color="#A8A29E" /></Pressable> : null}<Pressable accessibilityLabel="Delete Happy Bite" onPress={() => remove(bite)} className="p-2"><Ionicons name="trash-outline" size={20} color="#C62828" /></Pressable></View>)}</ScrollView>}
          {busy ? <ActivityIndicator className="pb-2" color="#F25F45" /> : null}
        </>
      )}
    </SafeAreaView>
  );
}
