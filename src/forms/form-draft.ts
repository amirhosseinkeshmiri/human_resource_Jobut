export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface FormDraftScope {
  accountId: string;
  formId: string;
  entityId: string;
}

interface FormDraftEnvelope {
  schemaVersion: number;
  scope: FormDraftScope;
  updatedAt: number;
  values: Record<string, unknown>;
}

export interface FormDraftOptions {
  scope: FormDraftScope;
  allowedFields: readonly string[];
  schemaVersion?: number;
  maxAgeMs?: number;
  now?: () => number;
}

export interface RestoredFormDraft<T extends Record<string, unknown>> {
  values: Partial<T>;
  updatedAt: number;
}

const KEY_PREFIX = "jobut:form-draft";
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const SAFE_SCOPE_PART = /^[a-zA-Z0-9_-]{1,128}$/;
const SENSITIVE_FIELD = /(otp|password|passcode|token|secret|credential|api.?key|session|payment|card|cvv)/i;

function assertOptions(options: FormDraftOptions) {
  for (const value of Object.values(options.scope)) {
    if (!SAFE_SCOPE_PART.test(value)) throw new Error("Invalid form draft scope");
  }
  if (options.allowedFields.length === 0 || options.allowedFields.some((field) => SENSITIVE_FIELD.test(field))) {
    throw new Error("Sensitive or empty form draft allowlist");
  }
}

export function getFormDraftKey(scope: FormDraftScope) {
  for (const value of Object.values(scope)) {
    if (!SAFE_SCOPE_PART.test(value)) throw new Error("Invalid form draft scope");
  }
  return `${KEY_PREFIX}:${scope.accountId}:${scope.formId}:${scope.entityId}`;
}

function pickAllowedValues(values: Record<string, unknown>, allowedFields: readonly string[]) {
  return Object.fromEntries(
    allowedFields
      .filter((field) => Object.prototype.hasOwnProperty.call(values, field))
      .map((field) => [field, values[field]]),
  );
}

export function saveFormDraft(
  storage: BrowserStorage,
  options: FormDraftOptions,
  values: Record<string, unknown>,
) {
  try {
    assertOptions(options);
    const envelope: FormDraftEnvelope = {
      schemaVersion: options.schemaVersion ?? 1,
      scope: options.scope,
      updatedAt: (options.now ?? Date.now)(),
      values: pickAllowedValues(values, options.allowedFields),
    };
    storage.setItem(getFormDraftKey(options.scope), JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function loadFormDraft<T extends Record<string, unknown>>(
  storage: BrowserStorage,
  options: FormDraftOptions,
  newerThan = 0,
): RestoredFormDraft<T> | null {
  let key: string;
  try {
    assertOptions(options);
    key = getFormDraftKey(options.scope);
    const raw = storage.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Partial<FormDraftEnvelope>;
    const now = (options.now ?? Date.now)();
    const valid = envelope.schemaVersion === (options.schemaVersion ?? 1)
      && envelope.scope?.accountId === options.scope.accountId
      && envelope.scope.formId === options.scope.formId
      && envelope.scope.entityId === options.scope.entityId
      && typeof envelope.updatedAt === "number"
      && envelope.updatedAt > newerThan
      && now - envelope.updatedAt <= (options.maxAgeMs ?? DEFAULT_MAX_AGE_MS)
      && envelope.values !== null
      && typeof envelope.values === "object"
      && !Array.isArray(envelope.values)
      && Object.keys(envelope.values).every((field) => options.allowedFields.includes(field));
    if (!valid) {
      storage.removeItem(key);
      return null;
    }
    return {
      values: pickAllowedValues(envelope.values as Record<string, unknown>, options.allowedFields) as Partial<T>,
      updatedAt: envelope.updatedAt!,
    };
  } catch {
    try {
      if (key!) storage.removeItem(key);
    } catch {
      // Browser storage may be unavailable or blocked. Drafts are best-effort only.
    }
    return null;
  }
}

export function clearFormDraft(storage: BrowserStorage, scope: FormDraftScope) {
  try {
    storage.removeItem(getFormDraftKey(scope));
    return true;
  } catch {
    return false;
  }
}
