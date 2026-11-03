import { SeedData } from '../types';
import {
  getInitialData as getLocalStorageData,
  saveAppData as saveLocalStorageData,
  getEmptySeedData,
  getDefaultSeedData,
  buildZeroedData,
  clearOperationalBackups,
  isStoredDataEmpty,
} from './storage';

const DATABASE_NAME = 'cartoes-browser-files-v1';
const STORE_NAME = 'handles';
const FILE_KEY = 'data-file';

type Permission = 'granted' | 'denied' | 'prompt';

export interface DataFileHandle {
  name: string;
  queryPermission(options: { mode: 'readwrite' }): Promise<Permission>;
  requestPermission(options: { mode: 'readwrite' }): Promise<Permission>;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

export type DataFileStatus = {
  state: 'unsupported' | 'not-connected' | 'connected' | 'permission-required' | 'missing-file' | 'empty-file' | 'invalid-file';
  fileName?: string;
  lastWriteError?: string;
};

export type PendingDataFile = {
  file: DataFileHandle;
  data: SeedData | null;
  emptyFile?: boolean;
  invalidFile?: boolean;
};

let fileWriteEnabled = false;
let writeQueue: Promise<void> = Promise.resolve();
let lastWriteError: string | undefined;
let cachedFileHandle: DataFileHandle | null = null;

function supportsFilePickers(): boolean {
  return typeof window !== 'undefined' &&
    typeof (window as any).showOpenFilePicker === 'function' &&
    typeof (window as any).showSaveFilePicker === 'function';
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível acessar o armazenamento do navegador.'));
  });
}

async function getSavedFile(): Promise<DataFileHandle | null> {
  const database = await openHandleDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(FILE_KEY);
    request.onsuccess = () => {
      database.close();
      cachedFileHandle = (request.result as DataFileHandle | undefined) || null;
      resolve(cachedFileHandle);
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error('Não foi possível recuperar o arquivo selecionado.'));
    };
  });
}

async function storeFile(file: DataFileHandle): Promise<void> {
  const database = await openHandleDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(file, FILE_KEY);
    transaction.oncomplete = () => {
      database.close();
      cachedFileHandle = file;
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Não foi possível memorizar o arquivo escolhido.'));
    };
  });
}

function notifyFileStatusChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('cartoes:data-file-status-change'));
  }
}

export async function disconnectDataFile(): Promise<void> {
  const database = await openHandleDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(FILE_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Não foi possível desconectar o arquivo.'));
    };
  });
  fileWriteEnabled = false;
  cachedFileHandle = null;
  lastWriteError = undefined;
  notifyFileStatusChange();
}

async function readDataFile(fileHandle: DataFileHandle): Promise<PendingDataFile> {
  const file = await fileHandle.getFile();
  if (file.size === 0) return { file: fileHandle, data: null, emptyFile: true };

  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.cards)) {
      return { file: fileHandle, data: null, invalidFile: true };
    }
    return { file: fileHandle, data: parsed as SeedData };
  } catch {
    return { file: fileHandle, data: null, invalidFile: true };
  }
}

async function writeDataFile(fileHandle: DataFileHandle, data: SeedData): Promise<void> {
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function getFilePermission(fileHandle: DataFileHandle): Promise<Permission> {
  try {
    return await fileHandle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'prompt';
  }
}

export async function getDataFileStatus(): Promise<DataFileStatus> {
  if (!supportsFilePickers()) return { state: 'unsupported' };
  const fileHandle = await getSavedFile();
  if (!fileHandle) return { state: 'not-connected' };

  if ((await getFilePermission(fileHandle)) !== 'granted') {
    return { state: 'permission-required', fileName: fileHandle.name };
  }

  try {
    const loaded = await readDataFile(fileHandle);
    if (loaded.emptyFile) return { state: 'empty-file', fileName: fileHandle.name };
    if (loaded.invalidFile) return { state: 'invalid-file', fileName: fileHandle.name };
    return { state: 'connected', fileName: fileHandle.name, lastWriteError };
  } catch {
    return { state: 'missing-file', fileName: fileHandle.name };
  }
}

const jsonPickerTypes = [{
  description: 'Arquivo JSON do Cartões',
  accept: { 'application/json': ['.json'] },
}];

export async function openSavedDataFileLocation(): Promise<void> {
  if (!supportsFilePickers()) {
    throw new Error('Seu navegador não permite abrir o seletor de arquivos. Use Chrome ou Edge em localhost ou HTTPS.');
  }
  // getDataFileStatus loads this handle before the user clicks, keeping the picker call
  // directly in the click flow so the browser's user-activation requirement is met.
  const fileHandle = cachedFileHandle || await getSavedFile();
  if (!fileHandle) throw new Error('Ainda não há um arquivo de dados conectado.');
  await (window as any).showOpenFilePicker({
    id: 'cartoes-data-location',
    startIn: fileHandle,
    multiple: false,
    types: jsonPickerTypes,
  });
}

export async function chooseExistingDataFile(): Promise<PendingDataFile> {
  if (!supportsFilePickers()) {
    throw new Error('Seu navegador não permite escolher arquivos para leitura e gravação. Use Chrome ou Edge em localhost ou HTTPS.');
  }
  const [fileHandle] = await (window as any).showOpenFilePicker({
    id: 'cartoes-data-file',
    multiple: false,
    types: jsonPickerTypes,
  }) as DataFileHandle[];
  const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') {
    throw new Error('O navegador precisa de permissão de leitura e gravação para usar esse arquivo.');
  }
  return readDataFile(fileHandle);
}

export async function chooseNewDataFile(): Promise<PendingDataFile> {
  if (!supportsFilePickers()) {
    throw new Error('Seu navegador não permite escolher arquivos para leitura e gravação. Use Chrome ou Edge em localhost ou HTTPS.');
  }
  const fileHandle = await (window as any).showSaveFilePicker({
    id: 'cartoes-data-file',
    suggestedName: 'dados-cartoes.json',
    types: jsonPickerTypes,
  }) as DataFileHandle;
  const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') {
    throw new Error('O navegador precisa de permissão de leitura e gravação para usar esse arquivo.');
  }
  return readDataFile(fileHandle);
}

export async function requestSavedDataFile(): Promise<PendingDataFile> {
  const fileHandle = await getSavedFile();
  if (!fileHandle) throw new Error('Escolha primeiro o arquivo de dados.');
  const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') {
    throw new Error('O navegador não concedeu acesso ao arquivo. Tente novamente e permita leitura e gravação.');
  }
  return readDataFile(fileHandle);
}

export async function activateFileWithExistingData(pending: PendingDataFile): Promise<SeedData> {
  if (!pending.data) throw new Error('Não há dados válidos para carregar.');
  await storeFile(pending.file);
  saveLocalStorageData(pending.data);
  fileWriteEnabled = true;
  lastWriteError = undefined;
  notifyFileStatusChange();
  return pending.data;
}

export async function activateFileWithCurrentData(pending: PendingDataFile, currentData: SeedData): Promise<void> {
  await writeDataFile(pending.file, currentData);
  await storeFile(pending.file);
  saveLocalStorageData(currentData);
  fileWriteEnabled = true;
  lastWriteError = undefined;
  notifyFileStatusChange();
}

export async function loadAppData(): Promise<SeedData> {
  const fileHandle = await getSavedFile().catch(() => null);
  if (fileHandle && (await getFilePermission(fileHandle)) === 'granted') {
    try {
      const loaded = await readDataFile(fileHandle);
      if (loaded.data) {
        fileWriteEnabled = true;
        lastWriteError = undefined;
        saveLocalStorageData(loaded.data);
        notifyFileStatusChange();
        return loaded.data;
      }
    } catch (error) {
      console.error('Não foi possível ler o arquivo de dados selecionado:', error);
    }
  }
  fileWriteEnabled = false;
  return getLocalStorageData();
}

export async function saveAppData(data: SeedData): Promise<{ success: boolean; error?: string }> {
  saveLocalStorageData(data);
  if (!fileWriteEnabled) return { success: true };

  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const fileHandle = await getSavedFile();
      if (!fileHandle || (await getFilePermission(fileHandle)) !== 'granted') {
        fileWriteEnabled = false;
        throw new Error('O navegador precisa de nova autorização para gravar no arquivo escolhido.');
      }
      await writeDataFile(fileHandle, data);
    });

  try {
    await writeQueue;
    const hadError = Boolean(lastWriteError);
    lastWriteError = undefined;
    if (hadError) notifyFileStatusChange();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Falha ao gravar o arquivo de dados.';
    const changed = lastWriteError !== errorMessage;
    lastWriteError = errorMessage;
    if (changed) notifyFileStatusChange();
    return { success: false, error: lastWriteError };
  }
}

export async function resetToOriginalData(): Promise<SeedData> {
  const fresh = getDefaultSeedData();
  await saveAppData(fresh);
  return fresh;
}

/**
 * "Zerar todas as tabelas": apaga os dados operacionais (cartões, lançamentos, parcelas, pagadores,
 * faturas, despesas fixas, simulador e cópias de segurança da correção de parcelas) e preserva
 * tema, preferências e demais configurações.
 *
 * Grava no localStorage e, se houver arquivo de dados conectado, também no arquivo (senão o arquivo
 * restauraria os registros antigos na próxima abertura). Se qualquer gravação falhar, desfaz e lança erro.
 */
export async function resetOperationalData(current: SeedData): Promise<SeedData> {
  const zeroed = buildZeroedData(current);
  const result = await saveAppData(zeroed);
  if (!result.success) {
    saveLocalStorageData(current);
    throw new Error(result.error || 'Não foi possível gravar os dados zerados. Nada foi apagado.');
  }
  if (!isStoredDataEmpty()) {
    saveLocalStorageData(current);
    throw new Error('O navegador não confirmou a gravação dos dados zerados. Nada foi apagado.');
  }
  clearOperationalBackups();
  return zeroed;
}

export async function resetToEmptyData(): Promise<SeedData> {
  const fresh = getEmptySeedData();
  await saveAppData(fresh);
  return fresh;
}
