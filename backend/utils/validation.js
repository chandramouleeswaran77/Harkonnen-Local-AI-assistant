export function assertString(val, fieldName, { min = 0, max = 50000, required = false } = {}) {
  if (val === undefined || val === null) {
    if (required) throw createValidationError(`${fieldName} is required.`);
    return undefined;
  }
  if (typeof val !== 'string') {
    throw createValidationError(`${fieldName} must be a string.`);
  }
  const trimmed = val.trim();
  if (required && trimmed.length === 0) {
    throw createValidationError(`${fieldName} cannot be empty.`);
  }
  if (trimmed.length < min) {
    throw createValidationError(`${fieldName} must be at least ${min} characters.`);
  }
  if (trimmed.length > max) {
    throw createValidationError(`${fieldName} exceeds maximum length of ${max}.`);
  }
  return val;
}

export function assertNumber(val, fieldName, { min = -Infinity, max = Infinity, required = false } = {}) {
  if (val === undefined || val === null) {
    if (required) throw createValidationError(`${fieldName} is required.`);
    return undefined;
  }
  const num = Number(val);
  if (Number.isNaN(num)) {
    throw createValidationError(`${fieldName} must be a valid number.`);
  }
  if (num < min || num > max) {
    throw createValidationError(`${fieldName} must be between ${min} and ${max}.`);
  }
  return num;
}

export function isValidModelName(name) {
  if (typeof name !== 'string') return false;
  return /^[a-zA-Z0-9._:/-]{1,120}$/.test(name.trim());
}

export function createValidationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = 'VALIDATION_ERROR';
  return err;
}
