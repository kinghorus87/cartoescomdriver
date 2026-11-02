import { SeedData } from '../types';
import {
  getInitialData as getLocalStorageData,
  saveAppData as saveLocalStorageData,
  getEmptySeedData,
} from './storage';

export async function loadAppData(): Promise<SeedData> {
  return getLocalStorageData();
}

export async function saveAppData(data: SeedData): Promise<{ success: boolean }> {
  saveLocalStorageData(data);
  return { success: true };
}

export async function resetToOriginalData(): Promise<SeedData> {
  const fresh = getEmptySeedData();
  saveLocalStorageData(fresh);
  return fresh;
}
