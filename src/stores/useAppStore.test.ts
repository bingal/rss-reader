import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useAppStore, Feed } from '@/stores/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      theme: 'system',
      selectedFeedId: null,
      filter: 'all',
      isSettingsOpen: false,
      readArticleIds: new Set(),
      feeds: [],
    });
  });

  it('should have default values', () => {
    const state = useAppStore.getState();
    expect(state.theme).toBe('system');
    expect(state.selectedFeedId).toBeNull();
    expect(state.filter).toBe('all');
    expect(state.readArticleIds.size).toBe(0);
  });

  it('should set theme correctly', () => {
    act(() => {
      useAppStore.getState().setTheme('dark');
    });
    expect(useAppStore.getState().theme).toBe('dark');
  });

  it('should set selected feed id', () => {
    act(() => {
      useAppStore.getState().setSelectedFeedId('feed-123');
    });
    expect(useAppStore.getState().selectedFeedId).toBe('feed-123');
    expect(useAppStore.getState().filter).toBe('all'); // Should reset filter
  });

  it('should set filter', () => {
    act(() => {
      useAppStore.getState().setFilter('unread');
    });
    expect(useAppStore.getState().filter).toBe('unread');
  });

  it('should mark article as read', () => {
    act(() => {
      useAppStore.getState().markArticleAsRead('article-123');
    });
    expect(useAppStore.getState().isArticleRead('article-123')).toBe(true);
    expect(useAppStore.getState().isArticleRead('article-456')).toBe(false);
  });

  it('should set feeds', () => {
    const feeds: Feed[] = [
      {
        id: 'feed-1',
        title: 'Test Feed',
        url: 'https://example.com/feed.xml',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    act(() => {
      useAppStore.getState().setFeeds(feeds);
    });
    expect(useAppStore.getState().feeds).toHaveLength(1);
    expect(useAppStore.getState().feeds[0].title).toBe('Test Feed');
  });

  it('should toggle settings open', () => {
    expect(useAppStore.getState().isSettingsOpen).toBe(false);
    act(() => {
      useAppStore.getState().setSettingsOpen(true);
    });
    expect(useAppStore.getState().isSettingsOpen).toBe(true);
  });
});
