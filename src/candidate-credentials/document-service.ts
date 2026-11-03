import "server-only";
import {
  removeOwnedCredentialDocument,
  replaceOwnedCredentialDocument,
} from "./repository";
import {
  deleteCredentialDocumentFile,
  normalizeCredentialDocument,
  writeCredentialDocument,
} from "./storage";

interface Dependencies {
  normalize(file: File): Promise<Buffer>;
  write(buffer: Buffer): Promise<string>;
  replace(candidateId: string, credentialId: string, next: { storageKey: string; byteSize: number }): Promise<{ found: boolean; oldStorageKey: string | null }>;
  remove(candidateId: string, credentialId: string): Promise<{ found: boolean; storageKey: string | null }>;
  deleteFile(storageKey: string | null | undefined): Promise<void>;
}

const production: Dependencies = {
  normalize: normalizeCredentialDocument,
  write: writeCredentialDocument,
  replace: replaceOwnedCredentialDocument,
  remove: removeOwnedCredentialDocument,
  deleteFile: deleteCredentialDocumentFile,
};

export async function uploadCredentialDocument(candidateId: string, credentialId: string, file: File, dependencies: Dependencies = production) {
  const buffer = await dependencies.normalize(file);
  const storageKey = await dependencies.write(buffer);
  try {
    const result = await dependencies.replace(candidateId, credentialId, { storageKey, byteSize: buffer.length });
    if (!result.found) {
      await dependencies.deleteFile(storageKey);
      return false;
    }
    await dependencies.deleteFile(result.oldStorageKey);
    return true;
  } catch (error) {
    await dependencies.deleteFile(storageKey);
    throw error;
  }
}

export async function deleteCredentialDocument(candidateId: string, credentialId: string, dependencies: Dependencies = production) {
  const result = await dependencies.remove(candidateId, credentialId);
  if (!result.found) return false;
  await dependencies.deleteFile(result.storageKey);
  return true;
}
