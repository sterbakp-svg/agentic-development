import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';
import { ModelError } from './errors';

export type TokenProvider = (options?: { abortSignal?: AbortSignal }) => Promise<string>;

const SCOPE = 'https://cognitiveservices.azure.com/.default';
const MESSAGE = 'Could not get an Entra ID token.';

interface TokenCredentialLike {
  getToken(
    scope: string | string[],
    options?: { abortSignal?: AbortSignal },
  ): Promise<{ token: string } | null>;
}

export interface EntraTokenOptions {
  /** `managed_identity` builds only ManagedIdentityCredential; `developer` builds DefaultAzureCredential. */
  mode: 'managed_identity' | 'developer';
  /** Client ID of a user-assigned managed identity (managed_identity mode only). */
  clientId?: string | undefined;
  /** Replaces the built credential. For tests. */
  credential?: TokenCredentialLike;
}

/**
 * Token provider for Azure OpenAI using Entra ID. In Azure use `managed_identity`
 * (the developer credential chain is never built); locally use `developer`.
 * The credential caches tokens; this function does not.
 * Failures become `auth` errors without the credential's own message.
 */
export function createEntraTokenProvider(options: EntraTokenOptions): TokenProvider {
  let cred = options.credential;
  return async (callOptions) => {
    if (!cred) {
      cred =
        options.mode === 'managed_identity'
          ? options.clientId
            ? new ManagedIdentityCredential(options.clientId)
            : new ManagedIdentityCredential()
          : new DefaultAzureCredential();
    }
    let result: { token: string } | null;
    try {
      result = await cred.getToken(
        SCOPE,
        callOptions?.abortSignal ? { abortSignal: callOptions.abortSignal } : undefined,
      );
    } catch {
      throw new ModelError('auth', MESSAGE);
    }
    if (!result || typeof result.token !== 'string' || result.token === '') {
      throw new ModelError('auth', MESSAGE);
    }
    return result.token;
  };
}
