import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import type { YahooOAuthTokens } from '../league-sync/providers/yahoo.provider';

const ALGORITHM = 'aes-256-gcm';
const FORMAT_VERSION = 'v1';
const IV_BYTES = 12;

export class CredentialEncryptionConfigurationError extends Error {
  constructor(message = 'Yahoo credential encryption is not configured') {
    super(message);
    this.name = 'CredentialEncryptionConfigurationError';
  }
}

function encryptionKey(encodedKey?: string): Buffer {
  if (!encodedKey) throw new CredentialEncryptionConfigurationError();

  const normalized = encodedKey.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new CredentialEncryptionConfigurationError(
      'YAHOO_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
    );
  }

  const key = Buffer.from(normalized, 'base64');
  if (key.length !== 32) {
    throw new CredentialEncryptionConfigurationError(
      'YAHOO_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
    );
  }
  return key;
}

/** Encrypts OAuth credentials for storage. The key remains server-side. */
export function encryptYahooCredentials(
  credentials: YahooOAuthTokens,
  encodedKey = env.YAHOO_CREDENTIAL_ENCRYPTION_KEY,
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    FORMAT_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/** Decrypts stored OAuth credentials and authenticates the payload before use. */
export function decryptYahooCredentials(
  encrypted: string,
  encodedKey = env.YAHOO_CREDENTIAL_ENCRYPTION_KEY,
): YahooOAuthTokens {
  const [version, ivValue, authTagValue, ciphertextValue, extra] = encrypted.split('.');
  if (
    version !== FORMAT_VERSION ||
    !ivValue ||
    !authTagValue ||
    !ciphertextValue ||
    extra !== undefined
  ) {
    throw new Error('Unsupported encrypted credential format');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(encodedKey),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  const parsed = JSON.parse(plaintext) as Partial<YahooOAuthTokens>;

  if (
    typeof parsed.accessToken !== 'string' ||
    typeof parsed.tokenSecret !== 'string' ||
    !(typeof parsed.sessionHandle === 'string' || parsed.sessionHandle === null) ||
    !(typeof parsed.expiresAt === 'number' || parsed.expiresAt === null)
  ) {
    throw new Error('Invalid encrypted credential payload');
  }
  return parsed as YahooOAuthTokens;
}
