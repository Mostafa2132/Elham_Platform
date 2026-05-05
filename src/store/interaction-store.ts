import { create } from "zustand";

type InteractionState = {
  savedPostIds: Set<string>;
  likedPostIds: Set<string>;
  unreadCountsByUser: Record<string, number>;
  activeChatId: string | null;
  
  // Actions
  setSavedPosts: (ids: string[]) => void;
  addSavedPost: (id: string) => void;
  addSavedPosts: (ids: string[]) => void;
  removeSavedPost: (id: string) => void;
  
  setLikedPosts: (ids: string[]) => void;
  addLikedPost: (id: string) => void;
  addLikedPosts: (ids: string[]) => void;
  removeLikedPost: (id: string) => void;

  incrementUnreadForUser: (userId: string) => void;
  resetUnreadForUser: (userId: string) => void;
  setUnreadCounts: (counts: Record<string, number>) => void;
  setActiveChatId: (id: string | null) => void;
  getGlobalUnreadCount: () => number;
  
  isSaved: (id: string) => boolean;
  isLiked: (id: string) => boolean;
};

export const useInteractionStore = create<InteractionState>((set, get) => ({
  savedPostIds: new Set(),
  likedPostIds: new Set(),
  unreadCountsByUser: {},
  activeChatId: null,

  setSavedPosts: (ids) => set({ savedPostIds: new Set(ids) }),
  addSavedPost: (id) => set((state) => {
    const next = new Set(state.savedPostIds);
    next.add(id);
    return { savedPostIds: next };
  }),
  addSavedPosts: (ids) => set((state) => {
    const next = new Set(state.savedPostIds);
    ids.forEach(id => next.add(id));
    return { savedPostIds: next };
  }),
  removeSavedPost: (id) => set((state) => {
    const next = new Set(state.savedPostIds);
    next.delete(id);
    return { savedPostIds: next };
  }),

  setLikedPosts: (ids) => set({ likedPostIds: new Set(ids) }),
  addLikedPost: (id) => set((state) => {
    const next = new Set(state.likedPostIds);
    next.add(id);
    return { likedPostIds: next };
  }),
  addLikedPosts: (ids) => set((state) => {
    const next = new Set(state.likedPostIds);
    ids.forEach(id => next.add(id));
    return { likedPostIds: next };
  }),
  removeLikedPost: (id) => set((state) => {
    const next = new Set(state.likedPostIds);
    next.delete(id);
    return { likedPostIds: next };
  }),

  incrementUnreadForUser: (userId) => set((state) => ({
    unreadCountsByUser: {
      ...state.unreadCountsByUser,
      [userId]: (state.unreadCountsByUser[userId] ?? 0) + 1
    }
  })),
  resetUnreadForUser: (userId) => set((state) => ({
    unreadCountsByUser: {
      ...state.unreadCountsByUser,
      [userId]: 0
    }
  })),
  setUnreadCounts: (counts) => set({ unreadCountsByUser: counts }),
  setActiveChatId: (id) => set({ activeChatId: id }),
  getGlobalUnreadCount: () => {
    const counts = get().unreadCountsByUser;
    return Object.values(counts).reduce((acc, val) => acc + val, 0);
  },

  isSaved: (id) => get().savedPostIds.has(id),
  isLiked: (id) => get().likedPostIds.has(id),
}));
