import "server-only";
import {
  deleteProfilePhotoFile,
  normalizeProfilePhoto,
  writeProfilePhoto,
} from "./storage";
import {
  removeCandidateProfilePhoto,
  replaceCandidateProfilePhoto,
} from "./repository";

interface ProfilePhotoDependencies {
  normalize(file: File): Promise<Buffer>;
  write(buffer: Buffer): Promise<string>;
  replace(candidateId: string, photo: { storageKey: string; byteSize: number }): Promise<string | null>;
  remove(candidateId: string): Promise<string | null>;
  deleteFile(storageKey: string | null | undefined): Promise<void>;
}

const productionDependencies: ProfilePhotoDependencies = {
  normalize: normalizeProfilePhoto,
  write: writeProfilePhoto,
  replace: replaceCandidateProfilePhoto,
  remove: removeCandidateProfilePhoto,
  deleteFile: deleteProfilePhotoFile,
};

export async function uploadCandidateProfilePhoto(
  candidateId: string,
  file: File,
  dependencies: ProfilePhotoDependencies = productionDependencies,
) {
  const buffer = await dependencies.normalize(file);
  const storageKey = await dependencies.write(buffer);
  try {
    const oldStorageKey = await dependencies.replace(candidateId, { storageKey, byteSize: buffer.length });
    await dependencies.deleteFile(oldStorageKey);
    return storageKey;
  } catch (error) {
    await dependencies.deleteFile(storageKey);
    throw error;
  }
}

export async function deleteCandidateProfilePhoto(
  candidateId: string,
  dependencies: ProfilePhotoDependencies = productionDependencies,
) {
  const oldStorageKey = await dependencies.remove(candidateId);
  await dependencies.deleteFile(oldStorageKey);
  return Boolean(oldStorageKey);
}
