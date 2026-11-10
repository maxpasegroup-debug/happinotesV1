import { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { useAdmin } from '@/providers/admin';
import { useToast } from '@/providers/toast';
import { ActionButton, ScreenHeader } from '@/components/ui/action-button';
import { ChoiceField, Field } from '@/components/ui/field';

export default function AdminBookEditorScreen() {
  const { user } = useAuth();
  const {
    draft,
    busy,
    error,
    updateDraft,
    updateEpisode,
    removeEpisode,
    uploadCover,
    uploadEpisode,
    saveBook,
  } = useAdmin();
  const { showToast } = useToast();

  useEffect(() => {
    // Keep the form usable if the route is opened directly.
    if (!draft.title && !draft.id) {
      updateDraft({});
    }
  }, [draft.id, draft.title, updateDraft]);

  if (!user || user.role !== 'admin') {
    return <Redirect href={user ? '/(tabs)' : '/auth'} />;
  }

  const save = async () => {
    const result = await saveBook();
    showToast(
      result.ok
        ? result.success ?? 'Saved'
        : result.error ?? 'Could not save',
      result.ok,
    );
    if (result.ok) router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#111111]">
      <ScreenHeader
        title={draft.id ? 'Edit book' : 'Add new book'}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerClassName="px-5 pb-10 pt-2">
        <Field
          label="Title *"
          value={draft.title}
          onChangeText={(value) => updateDraft({ title: value })}
        />
        <Field
          label="Description *"
          value={draft.description}
          onChangeText={(value) => updateDraft({ description: value })}
          multiline
        />
        <ChoiceField
          label="Language"
          value={draft.language}
          options={['english', 'malayalam', 'hindi']}
          onChange={(value) => updateDraft({ language: value })}
        />
        <ChoiceField
          label="Category"
          value={draft.category}
          options={['health', 'wealth', 'happiness', 'mindfulness']}
          onChange={(value) => updateDraft({ category: value })}
        />
        <ChoiceField
          label="Status"
          value={draft.status}
          options={['draft', 'coming_soon', 'live']}
          onChange={(value) => updateDraft({ status: value })}
        />
        <ChoiceField
          label="Access"
          value={draft.accessType}
          options={['free', 'premium']}
          onChange={(value) =>
            updateDraft({
              accessType: value,
              ...(value === 'free' ? { priceInr: '0' } : {}),
            })
          }
        />
        {draft.accessType === 'premium' ? (
          <Text className="-mt-1 mb-3 text-[13px] text-[#6B625C] dark:text-[#A8A29E]">
            Premium stories are unlocked through the monthly subscription.
          </Text>
        ) : null}

        <Text className="mb-2 mt-1 text-xs font-bold uppercase tracking-wide text-[#6B625C] dark:text-[#A8A29E]">
          Cover image
        </Text>
        {draft.coverImageUrl ? (
          <Image
            source={{ uri: draft.coverImageUrl }}
            contentFit="contain"
            style={{ width: '100%', height: 180, marginBottom: 8 }}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void uploadCover()}
          className="min-h-[50px] flex-row items-center justify-center gap-2 rounded-[15px] border border-[#D9D0C8] px-4 active:opacity-70 dark:border-[#4A4542]"
        >
          <Ionicons name="image-outline" size={20} color="#F25F45" />
          <Text className="font-extrabold text-coral">
            {draft.coverImageUrl ? 'Replace image' : 'Choose image'}
          </Text>
        </Pressable>

        <View className="mb-2 mt-4 flex-row items-center justify-between">
          <Text className="text-[16px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
            Story episodes
          </Text>
          <Text className="text-[13px] text-[#A8A29E]">
            {draft.episodes.length} added
          </Text>
        </View>

        {draft.episodes.map((episode, index) => (
          <View
            key={`${index}-${episode.mediaUrl}`}
            className="mb-3 rounded-[14px] border border-[#D9D0C8]/50 p-3 dark:border-[#4A4542]"
          >
            <View className="mb-2 flex-row items-center">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-[#E8E2DE] dark:bg-[#2C2C2C]">
                <Text className="text-[13px] font-bold text-[#241F1C] dark:text-[#F8F5F0]">
                  {index + 1}
                </Text>
              </View>
              <Text className="ml-2.5 flex-1 text-[15px] font-extrabold text-[#241F1C] dark:text-[#F8F5F0]">
                Episode {index + 1}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove episode ${index + 1}`}
                disabled={busy}
                hitSlop={8}
                onPress={() => removeEpisode(index)}
                className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
              >
                <Ionicons name="trash-outline" size={20} color="#C62828" />
              </Pressable>
            </View>
            <Field
              label="Episode title"
              value={episode.title}
              onChangeText={(value) => updateEpisode(index, 'title', value)}
            />
            <Field
              label="Episode description"
              value={episode.description}
              onChangeText={(value) => updateEpisode(index, 'description', value)}
              multiline
            />
            <Text className="text-[13px] text-[#A8A29E]">
              {episode.fileName ?? 'MP3 uploaded'}
            </Text>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void uploadEpisode()}
          className="min-h-[50px] flex-row items-center justify-center gap-2 rounded-[15px] border border-[#D9D0C8] px-4 active:opacity-70 dark:border-[#4A4542]"
        >
          <Ionicons name="add-circle-outline" size={20} color="#F25F45" />
          <Text className="font-extrabold text-coral">Add episode MP3</Text>
        </Pressable>

        <View className="mt-4" />
        <Field
          label="Duration in seconds"
          value={draft.duration}
          onChangeText={(value) => updateDraft({ duration: value })}
          keyboardType="number-pad"
        />
        <Field
          label="Sort order"
          value={draft.sortOrder}
          onChangeText={(value) => updateDraft({ sortOrder: value })}
          keyboardType="number-pad"
        />
        <Field
          label="Tags separated by commas"
          value={draft.tags}
          onChangeText={(value) => updateDraft({ tags: value })}
        />

        <View className="flex-row items-center py-1">
          <Text className="flex-1 text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">
            Featured
          </Text>
          <Switch
            value={draft.featured}
            onValueChange={(value) => updateDraft({ featured: value })}
            trackColor={{ false: '#D9D0C8', true: '#F25F4580' }}
            thumbColor={draft.featured ? '#F25F45' : '#F4F3F4'}
          />
        </View>
        <View className="flex-row items-center py-1">
          <Text className="flex-1 text-[15px] text-[#241F1C] dark:text-[#F8F5F0]">
            Trending
          </Text>
          <Switch
            value={draft.trending}
            onValueChange={(value) => updateDraft({ trending: value })}
            trackColor={{ false: '#D9D0C8', true: '#F25F4580' }}
            thumbColor={draft.trending ? '#F25F45' : '#F4F3F4'}
          />
        </View>

        {error ? (
          <Text className="my-3 text-[14px] text-red-500">{error}</Text>
        ) : null}

        <ActionButton
          label={
            busy
              ? 'Saving...'
              : draft.id
                ? 'Update book'
                : 'Create book'
          }
          onPress={() => void save()}
          disabled={busy}
          className="mt-3"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
