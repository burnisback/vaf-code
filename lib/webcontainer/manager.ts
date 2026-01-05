import { WebContainer } from '@webcontainer/api';
import { reactViteTemplate } from '../templates/react-vite';

let webcontainerInstance: WebContainer | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  if (!webcontainerInstance) {
    webcontainerInstance = await WebContainer.boot();
  }
  return webcontainerInstance;
}

export async function initializeProject(
  onOutput: (output: string) => void
): Promise<string> {
  const webcontainer = await getWebContainer();

  // Mount the template directly - it's already in FileSystemTree format
  await webcontainer.mount(reactViteTemplate);
  onOutput('Project files loaded\\n');

  const installProcess = await webcontainer.spawn('npm', ['install']);
  installProcess.output.pipeTo(new WritableStream({ write(data) { onOutput(data); } }));
  await installProcess.exit;
  onOutput('\\nDependencies installed\\n');

  const devProcess = await webcontainer.spawn('npm', ['run', 'dev']);
  devProcess.output.pipeTo(new WritableStream({ write(data) { onOutput(data); } }));

  return new Promise((resolve) => {
    webcontainer.on('server-ready', (port, url) => {
      onOutput(`\\nServer running at ${url}\\n`);
      resolve(url);
    });
  });
}

export async function writeFile(path: string, content: string): Promise<void> {
  const webcontainer = await getWebContainer();
  await webcontainer.fs.writeFile(path, content);
}

export async function readFile(path: string): Promise<string> {
  const webcontainer = await getWebContainer();
  return await webcontainer.fs.readFile(path, 'utf-8');
}

export async function readdir(path: string): Promise<string[]> {
  const webcontainer = await getWebContainer();
  return await webcontainer.fs.readdir(path);
}
