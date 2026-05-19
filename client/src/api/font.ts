import { customFetch } from './http';
import type { Font } from './types';

const FONT_API_URL = '/api/font';

export async function getFonts(): Promise<Font[]> {
  const response = await customFetch(FONT_API_URL);

  if (!response.ok) {
    throw new Error('Failed to fetch fonts');
  }

  return response.json();
}

export async function uploadFont(
  fontName: string,
  file: File
): Promise<Font> {
  const formData = new FormData();
  formData.append('name', fontName);
  formData.append('file', file);

  const response = await customFetch(`${FONT_API_URL}/create`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to upload font');
  }

  return response.json();
}

export async function deleteFont(fontId: number): Promise<void> {
  const response = await customFetch(`${FONT_API_URL}/${fontId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete font');
  }
}
