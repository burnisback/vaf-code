/**
 * File Operation Executor Module
 *
 * Provides execution of file operations against WebContainer filesystem.
 */

export {
  initializeExecutor,
  executeFileOperation,
  executeFileOperations,
  writeFile,
  editFile,
  deleteFile,
  readFile,
  fileExists,
  listDirectory,
  isConfigFile,
  getConfigChangeType,
  EditError
} from './fileOperations';

export type { EditMatchResult } from './fileOperations';

export {
  OperationHistory,
  operationHistory,
  useOperationHistory
} from './operationHistory';

export type { OperationSnapshot, OperationHistoryState } from './operationHistory';
