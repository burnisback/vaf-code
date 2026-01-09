import { create } from 'zustand';
import type { ChatMessage, FileOperation, ToolCall } from './ai/types';

/**
 * Chat Store
 *
 * Zustand store for managing chat state in the IDE.
 */

export interface ChatState {
  // Conversation state
  conversationId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  // Streaming state
  isStreaming: boolean;
  streamingContent: string;

  // Tool/file operation state
  pendingToolCalls: ToolCall[];
  pendingFileOperations: FileOperation[];

  // Actions
  setConversationId: (id: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  setStreaming: (streaming: boolean) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  finalizeStreamingMessage: () => void;

  addToolCall: (toolCall: ToolCall) => void;
  updateToolCall: (index: number, toolCall: Partial<ToolCall>) => void;
  clearToolCalls: () => void;

  addFileOperation: (operation: FileOperation) => void;
  clearFileOperations: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  conversationId: null,
  messages: [
    {
      role: 'assistant' as const,
      content: 'What would you like to build today?',
    },
  ],
  isLoading: false,
  error: null,
  isStreaming: false,
  streamingContent: '',
  pendingToolCalls: [],
  pendingFileOperations: [],
};

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  setConversationId: (id) => set({ conversationId: id }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content,
        };
      }
      return { messages };
    }),

  setMessages: (messages) => set({ messages }),

  clearMessages: () =>
    set({
      messages: [
        {
          role: 'assistant',
          content: 'What would you like to build today?',
        },
      ],
      conversationId: null,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  appendStreamingContent: (content) =>
    set((state) => ({
      streamingContent: state.streamingContent + content,
    })),

  clearStreamingContent: () => set({ streamingContent: '' }),

  finalizeStreamingMessage: () => {
    const state = get();
    if (state.streamingContent) {
      set((state) => ({
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: state.streamingContent,
          },
        ],
        streamingContent: '',
        isStreaming: false,
      }));
    }
  },

  addToolCall: (toolCall) =>
    set((state) => ({
      pendingToolCalls: [...state.pendingToolCalls, toolCall],
    })),

  updateToolCall: (index, updates) =>
    set((state) => {
      const toolCalls = [...state.pendingToolCalls];
      if (toolCalls[index]) {
        toolCalls[index] = { ...toolCalls[index], ...updates };
      }
      return { pendingToolCalls: toolCalls };
    }),

  clearToolCalls: () => set({ pendingToolCalls: [] }),

  addFileOperation: (operation) =>
    set((state) => ({
      pendingFileOperations: [...state.pendingFileOperations, operation],
    })),

  clearFileOperations: () => set({ pendingFileOperations: [] }),

  reset: () => set(initialState),
}));
