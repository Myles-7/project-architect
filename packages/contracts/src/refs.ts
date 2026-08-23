/**
 * Canonical Typed Reference system for Project Architect.
 * Eliminates cross-file duplicate text by strictly referencing entities with typed prefixes.
 */

export type DecisionRef = `decision:${string}`;
export type AssumptionRef = `assumption:${string}`;
export type GapRef = `gap:${string}`;
export type ConflictRef = `conflict:${string}`;
export type TensionRef = `tension:${string}`;
export type RiskRef = `risk:${string}`;
export type QuestionRef = `question:${string}`;
export type InputRefId = `input:${string}`;

export type TypedRef =
  | DecisionRef
  | AssumptionRef
  | GapRef
  | ConflictRef
  | TensionRef
  | RiskRef
  | QuestionRef
  | InputRefId;

export type TypedRefKind =
  | 'decision'
  | 'assumption'
  | 'gap'
  | 'conflict'
  | 'tension'
  | 'risk'
  | 'question'
  | 'input';

export interface ParsedTypedRef {
  kind: TypedRefKind;
  id: string;
  raw: TypedRef;
}

const VALID_PREFIXES = new Set<TypedRefKind>([
  'decision',
  'assumption',
  'gap',
  'conflict',
  'tension',
  'risk',
  'question',
  'input',
]);

/**
 * Checks if a string is a valid TypedRef format (<kind>:<id>).
 */
export function isTypedRef(str: string): str is TypedRef {
  if (typeof str !== 'string') return false;
  const colonIndex = str.indexOf(':');
  if (colonIndex <= 0 || colonIndex === str.length - 1) return false;
  const prefix = str.slice(0, colonIndex) as TypedRefKind;
  return VALID_PREFIXES.has(prefix);
}

/**
 * Parses a TypedRef into its constituent kind and ID.
 * Throws Error if format is invalid.
 */
export function parseTypedRef(ref: TypedRef | string): ParsedTypedRef {
  if (!isTypedRef(ref)) {
    throw new Error(`Invalid TypedRef format: "${ref}". Expected format: "<kind>:<id>" (e.g. "decision:dec-01")`);
  }
  const colonIndex = ref.indexOf(':');
  const kind = ref.slice(0, colonIndex) as TypedRefKind;
  const id = ref.slice(colonIndex + 1);
  return { kind, id, raw: ref };
}

/**
 * Helper to build a TypedRef.
 */
export function createTypedRef(kind: TypedRefKind, id: string): TypedRef {
  if (!id || id.includes(':')) {
    throw new Error(`Invalid entity ID "${id}" for TypedRef. Must be non-empty and not contain colons.`);
  }
  return `${kind}:${id}` as TypedRef;
}
