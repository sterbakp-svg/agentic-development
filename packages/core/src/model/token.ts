import { DefaultAzureCredential } from '@azure/identity';
import { ModelError } from './errors';

export type TokenProvider = () => Promise<string>;

const SCOPE = 'https://cognitiveservices.azure.com/.default';
const MESSAGE = 'Could not get an Entra ID token.';

interface TokenCredentialLike {
  getToken(scope: string | string[]): Promise<{ token: string } | null>;
}

/**
 * Token provider for Azure OpenAI using Entra ID (managed identity in Azure,
 * developer sign-in locally). The credential caches tokens; this function does not.
 * Failures become `auth` errors without the credential's own message.
 */
export function createEntraTokenProvider(credential?: TokenCredentialLike): TokenProvider {
  let cred = credential;
  return async () => {
    cred ??= new DefaultAzureCredential();
    let result: { token: string } | null;
    try {
      result = await cred.getToken(SCOPE);
    } catch {
      throw new ModelError('auth', MESSAGE);
    }
    if (!result || typeof result.token !== 'string' || result.token === '') {
      throw new ModelError('auth', MESSAGE);
    }
    return result.token;
  };
}
