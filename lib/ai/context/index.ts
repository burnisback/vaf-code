/**
 * Context Module Exports
 * Centralizes file tree scanning and key file detection utilities
 */

export {
  scanFileTree,
  formatFileTreeForPrompt,
  flattenTree,
  countFiles
} from './fileTreeScanner';

export type { FileNode, FileTreeOptions } from './fileTreeScanner';

export {
  KEY_FILE_PATTERNS,
  getKeyFileContents,
  formatKeyFilesForPrompt,
  detectProjectType,
  getSuggestedEntryPoint,
  detectProjectTypeWithPackageJson
} from './keyFiles';

export type { KeyFileContent } from './keyFiles';
