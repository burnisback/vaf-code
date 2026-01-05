import { create } from 'zustand';

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

interface EditorState {
  files: FileNode[];
  currentFile: string | null;
  fileContents: Record<string, string>;
  previewUrl: string | null;
  terminalOutput: string[];
  isWebContainerReady: boolean;
  theme: 'light' | 'dark';
  setFiles: (files: FileNode[]) => void;
  setCurrentFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  setPreviewUrl: (url: string | null) => void;
  addTerminalOutput: (output: string) => void;
  clearTerminalOutput: () => void;
  setWebContainerReady: (ready: boolean) => void;
  toggleTheme: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  files: [],
  currentFile: null,
  fileContents: {},
  previewUrl: null,
  terminalOutput: [],
  isWebContainerReady: false,
  theme: 'dark',
  setFiles: (files) => set({ files }),
  setCurrentFile: (path) => set({ currentFile: path }),
  updateFileContent: (path, content) =>
    set((state) => ({ fileContents: { ...state.fileContents, [path]: content } })),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  addTerminalOutput: (output) =>
    set((state) => ({ terminalOutput: [...state.terminalOutput, output] })),
  clearTerminalOutput: () => set({ terminalOutput: [] }),
  setWebContainerReady: (ready) => set({ isWebContainerReady: ready }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}));
