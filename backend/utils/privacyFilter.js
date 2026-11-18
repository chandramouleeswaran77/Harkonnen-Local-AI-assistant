/**
 * Sensitive information detector to guarantee HARKONNEN never automatically
 * saves credentials, payment details, personal IDs, or private keys to memory.
 */
const SENSITIVE_PATTERNS = [
  // API keys & bearer tokens
  /\b(sk-[a-zA-Z0-9]{16,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\-_]{30,})\b/,
  /\b(api[_\s-]?key|secret[_\s-]?key|access[_\s-]?token|private[_\s-]?key|password|passphrase|passwd)\s*[:=]\s*\S+/i,
  /-----BEGIN\s+(RSA|EC|OPENSSH|PGP)?\s*PRIVATE KEY-----/i,
  // Credit card numbers (13-19 digits with optional spaces/dashes)
  /\b(?:\d[ -]*?){13,19}\b/,
  // SSN / Government ID patterns
  /\b\d{3}-\d{2}-\d{4}\b/,
  // Explicit sensitive keywords
  /\b(my password is|my pin is|social security|credit card|cvv|bank account|routing number|seed phrase|recovery phrase)\b/i,
];

export function containsSensitiveInfo(text) {
  if (!text || typeof text !== 'string') return false;
  return SENSITIVE_PATTERNS.some((regex) => regex.test(text));
}

export function sanitizeForMemory(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().slice(0, 500);
}
