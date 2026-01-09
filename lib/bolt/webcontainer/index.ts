/**
 * WebContainer Module Exports
 */

export { BoltWebContainerProvider, useBoltWebContainer } from './context';
export { getTemplate, getTemplateFiles } from './templates';
export {
  buildFileTree,
  getAllFilePaths,
  readFileContent,
  getRelevantFiles,
  detectFramework,
  detectStyling,
} from './fileTree';
