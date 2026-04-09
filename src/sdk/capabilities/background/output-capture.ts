import { writeFile } from 'fs/promises';

export async function writeOutputFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf-8');
}

export function previewOutput(content: string, limit = 500): string {
  return content.slice(0, limit);
}
