// ══════════════════════════════════════════════
// WEBAUTHN / FIDO2 UTILITIES
// Usa Secure Enclave (iOS) / TEE-StrongBox (Android) / TPM (Desktop)
// ══════════════════════════════════════════════

export function webAuthnSuportado(): boolean {
  return !!(window.PublicKeyCredential && navigator.credentials?.create);
}

export async function webAuthnPlataformaDisponivel(): Promise<boolean> {
  if (!webAuthnSuportado()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

function ab2b64(ab: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(ab)));
}

function b642ab(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const ab = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) ab[i] = bin.charCodeAt(i);
  return ab.buffer;
}

export interface WaCredencial {
  credId: string;
  rpId: string;
}

export async function webAuthnCriarCredencial(): Promise<WaCredencial | null> {
  if (!webAuthnSuportado()) return null;
  const rpId = window.location.hostname || 'localhost';
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        rp: { name: 'Enquete Eleitoral', id: rpId },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'votante-anonimo',
          displayName: 'Votante',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7  },  // ES256 — Secure Enclave / TEE
          { type: 'public-key', alg: -257 }, // RS256 — fallback
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
          residentKey: 'discouraged',
        },
        timeout: 90_000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null;

    if (!cred) return null;
    return { credId: ab2b64(cred.rawId), rpId };
  } catch (e) {
    console.warn('[WebAuthn] Criação cancelada:', (e as Error).name);
    return null;
  }
}

export async function webAuthnVerificarCredencial(
  credId: string,
  rpId: string
): Promise<boolean> {
  if (!webAuthnSuportado() || !credId) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: rpId || window.location.hostname || 'localhost',
        allowCredentials: [{ type: 'public-key', id: b642ab(credId) }],
        userVerification: 'preferred',
        timeout: 60_000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
