import { SeedData } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_NAME = 'Cartões - backup.json';
const APP_PROPERTY_KEY = 'cartoesBackup';
const APP_PROPERTY_VALUE = 'v1';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

interface DriveFilesResponse {
  files?: DriveFile[];
}

function getClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
}

async function getAccessToken(): Promise<string> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Configure VITE_GOOGLE_CLIENT_ID para conectar o Google Drive.');
  }

  const google = (window as any).google;
  if (!google?.accounts?.oauth2?.initTokenClient) {
    throw new Error('Não foi possível carregar a autenticação do Google. Atualize a página e tente novamente.');
  }

  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response: GoogleTokenResponse) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'O Google não autorizou o acesso ao Drive.'));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (error: { message?: string }) => {
        reject(new Error(error.message || 'A janela de autorização do Google foi fechada.'));
      },
    });
    client.requestAccessToken();
  });
}

async function driveRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body instanceof Blob && !headers.has('Content-Type')) {
    headers.set('Content-Type', init.body.type || 'application/json');
  }
  const response = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Drive respondeu ${response.status}: ${detail.slice(0, 240)}`);
  }
  return response.json() as Promise<T>;
}

async function findBackup(token: string): Promise<DriveFile | undefined> {
  const query = `name = '${BACKUP_NAME}' and appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' } and trashed = false`;
  const params = new URLSearchParams({
    q: query,
    orderBy: 'modifiedTime desc',
    pageSize: '10',
    fields: 'files(id,name,modifiedTime)',
  });
  const response = await driveRequest<DriveFilesResponse>(`/files?${params.toString()}`, token);
  return response.files?.[0];
}

export async function saveBackupToGoogleDrive(data: SeedData): Promise<{ modifiedTime?: string }> {
  const token = await getAccessToken();
  let file = await findBackup(token);

  if (!file) {
    file = await driveRequest<DriveFile>('/files?fields=id,name,modifiedTime', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: BACKUP_NAME,
        mimeType: 'application/json',
        appProperties: { [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE },
      }),
    });
  }

  const response = await fetch(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(file.id)}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data, null, 2),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Não foi possível salvar o backup no Drive (${response.status}): ${detail.slice(0, 240)}`);
  }
  const saved = await response.json() as DriveFile;
  return { modifiedTime: saved.modifiedTime };
}

export async function loadBackupFromGoogleDrive(): Promise<{ data: SeedData; modifiedTime?: string }> {
  const token = await getAccessToken();
  const file = await findBackup(token);
  if (!file) {
    throw new Error('Nenhum backup do Cartões foi encontrado nesta conta do Google Drive.');
  }

  const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Não foi possível ler o backup do Drive (${response.status}): ${detail.slice(0, 240)}`);
  }

  const data = await response.json() as SeedData;
  if (!data || !Array.isArray(data.cards)) {
    throw new Error('O arquivo encontrado no Drive não contém um backup válido do Cartões.');
  }
  return { data, modifiedTime: file.modifiedTime };
}
