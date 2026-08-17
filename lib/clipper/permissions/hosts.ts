import { browser } from 'wxt/browser';

interface HostPermissionDetails {
  origins: string[];
}

export interface HostPermissionsApi {
  contains(details: HostPermissionDetails): Promise<boolean>;
  request(details: HostPermissionDetails): Promise<boolean>;
}

export type HostPermissionErrorCode =
  | 'INVALID_HOST_URL'
  | 'INVALID_HOST_PERMISSION_CHECK'
  | 'HOST_PERMISSION_CHECK_CONSUMED'
  | 'HOST_PERMISSION_CHECK_EXPIRED'
  | 'HOST_PERMISSION_ORIGIN_CHANGED'
  | 'UNSUPPORTED_HOST_PERMISSIONS'
  | 'HOST_PERMISSION_CHECK_FAILED'
  | 'HOST_PERMISSION_REQUEST_FAILED';

export class HostPermissionError extends Error {
  constructor(
    readonly code: HostPermissionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HostPermissionError';
  }
}

declare const hostPermissionRequestBrand: unique symbol;

export interface GrantedHostPermissionCheck {
  readonly granted: true;
  readonly origins: readonly [string];
}

export interface HostPermissionRequestCapability {
  readonly [hostPermissionRequestBrand]: true;
  readonly granted: false;
  readonly origins: readonly [string];
}

export type HostPermissionCheck =
  | GrantedHostPermissionCheck
  | HostPermissionRequestCapability;

export interface EnsureHostPermissionOptions<T = unknown> {
  api?: HostPermissionsApi;
  currentUrl: URL | string;
  retry?: () => T | Promise<T>;
  onRetrySucceeded?: (result: T) => void | Promise<void>;
}

interface RegisteredHostPermissionCheck {
  consumed: boolean;
  issuedAt: number;
  pattern: string;
}

const DEFAULT_CHECK_TTL_MS = 30_000;
const registeredChecks = new WeakMap<
  HostPermissionRequestCapability,
  RegisteredHostPermissionCheck
>();

function internalMonotonicNow(): number {
  try {
    const monotonic = globalThis.performance;
    if (monotonic && typeof monotonic.now === 'function') {
      return monotonic.now();
    }
    return Date.now();
  } catch {
    return Number.NaN;
  }
}

function resolvePermissionsApi(api?: HostPermissionsApi): HostPermissionsApi {
  if (api) return api;
  const permissions = browser?.permissions;
  if (!permissions) {
    throw new HostPermissionError(
      'UNSUPPORTED_HOST_PERMISSIONS',
      'Runtime host permissions are unavailable in this context.',
    );
  }
  return permissions as unknown as HostPermissionsApi;
}

function invalidHostUrl(): HostPermissionError {
  return new HostPermissionError(
    'INVALID_HOST_URL',
    'Host permission requires an exact HTTP or HTTPS origin without credentials or wildcards.',
  );
}

export function originPattern(input: URL | string): string {
  let url: URL;
  try {
    url = new URL(typeof input === 'string' ? input : input.href);
  } catch {
    throw invalidHostUrl();
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:')
    || url.origin === 'null'
    || url.hostname === ''
    || url.hostname.includes('*')
    || url.username !== ''
    || url.password !== ''
  ) {
    throw invalidHostUrl();
  }

  return `${url.origin}/*`;
}

export async function checkHostPermission(
  input: URL | string,
  api?: HostPermissionsApi,
): Promise<HostPermissionCheck> {
  const pattern = originPattern(input);
  const permissions = resolvePermissionsApi(api);
  let granted: boolean;
  try {
    granted = await permissions.contains({ origins: [pattern] });
  } catch (error) {
    throw new HostPermissionError(
      'HOST_PERMISSION_CHECK_FAILED',
      'Unable to check host permission.',
      { cause: error },
    );
  }

  const origins = Object.freeze([pattern]) as readonly [string];
  if (granted) return Object.freeze({ granted: true, origins });

  const issuedAt = internalMonotonicNow();
  if (!Number.isFinite(issuedAt)) {
    throw new HostPermissionError(
      'HOST_PERMISSION_CHECK_FAILED',
      'Unable to check host permission.',
    );
  }
  const check = Object.freeze({
    granted: false,
    origins,
  }) as HostPermissionRequestCapability;
  registeredChecks.set(check, {
    consumed: false,
    issuedAt,
    pattern,
  });
  return check;
}

function consumeCheck(
  check: HostPermissionRequestCapability,
  currentUrl: URL | string,
): string {
  const registered = registeredChecks.get(check);
  if (!registered) {
    throw new HostPermissionError(
      'INVALID_HOST_PERMISSION_CHECK',
      'Host permission check is not valid in this context.',
    );
  }
  if (registered.consumed) {
    throw new HostPermissionError(
      'HOST_PERMISSION_CHECK_CONSUMED',
      'Host permission check has already been used.',
    );
  }
  registered.consumed = true;

  const currentPattern = originPattern(currentUrl);
  const elapsed = internalMonotonicNow() - registered.issuedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= DEFAULT_CHECK_TTL_MS) {
    throw new HostPermissionError(
      'HOST_PERMISSION_CHECK_EXPIRED',
      'Host permission check has expired.',
    );
  }
  if (currentPattern !== registered.pattern) {
    throw new HostPermissionError(
      'HOST_PERMISSION_ORIGIN_CHANGED',
      'Configured provider origin changed after the permission check.',
    );
  }
  return registered.pattern;
}

/**
 * Call directly from the permission button. The request is invoked before this
 * function returns, so no awaited preflight can consume transient activation.
 */
export function ensureHostPermission<T = unknown>(
  check: HostPermissionRequestCapability,
  options: EnsureHostPermissionOptions<T>,
): Promise<boolean> {
  let pattern: string;
  try {
    pattern = consumeCheck(
      check,
      options.currentUrl,
    );
  } catch (error) {
    return Promise.reject(error);
  }
  let api: HostPermissionsApi;
  try {
    api = resolvePermissionsApi(options.api);
  } catch (error) {
    return Promise.reject(error);
  }
  let requested: Promise<boolean>;
  try {
    requested = api.request({ origins: [pattern] });
  } catch (error) {
    return Promise.reject(new HostPermissionError(
      'HOST_PERMISSION_REQUEST_FAILED',
      'Unable to request host permission.',
      { cause: error },
    ));
  }

  return requested.then(
    async (granted) => {
      if (!granted) return false;
      if (options.retry) {
        const result = await options.retry();
        await options.onRetrySucceeded?.(result);
      }
      return true;
    },
    (error: unknown) => {
      throw new HostPermissionError(
        'HOST_PERMISSION_REQUEST_FAILED',
        'Unable to request host permission.',
        { cause: error },
      );
    },
  );
}
