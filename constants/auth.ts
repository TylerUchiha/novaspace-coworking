/** Display / dev reference — production validation is server-only via validateAccessCode. */
export const GLOBAL_ACCESS_PASSCODE = 'Global Access';

export const CODE_SESSION_KEY = 'novaspace_code_session';
export const STAFF_BRANCH_SESSION_KEY = 'novaspace_staff_branch';
export const STAFF_ACCESS_CODE_KEY = 'novaspace_staff_access_code';

export type CodeSessionRole = 'employee' | 'owner';

export interface StoredCodeSession {
  role: CodeSessionRole;
}

export interface StoredStaffBranch {
  vendorId: string;
  locationId: string;
  floorId: string;
}


export function isGlobalAccessPasscode(code: string): boolean {
  const normalized = code.trim();
  const expected = GLOBAL_ACCESS_PASSCODE.trim();
  if (!normalized) return false;
  if (normalized === expected) return true;
  if (normalized.toLowerCase() === expected.toLowerCase()) return true;
  return normalized.replace(/\s+/g, '') === expected.replace(/\s+/g, '');
}

export function saveCodeSession(role: CodeSessionRole): void {
  sessionStorage.setItem(CODE_SESSION_KEY, JSON.stringify({ role }));
}

export function loadCodeSession(): StoredCodeSession | null {
  try {
    const raw = sessionStorage.getItem(CODE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCodeSession;
    if (parsed.role === 'employee' || parsed.role === 'owner') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearCodeSession(): void {
  sessionStorage.removeItem(CODE_SESSION_KEY);
  clearStaffBranchSession();
  clearStaffAccessCode();
}

export function saveStaffBranchSession(branch: StoredStaffBranch): void {
  sessionStorage.setItem(STAFF_BRANCH_SESSION_KEY, JSON.stringify(branch));
}

export function loadStaffBranchSession(): StoredStaffBranch | null {
  try {
    const raw = sessionStorage.getItem(STAFF_BRANCH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredStaffBranch;
    if (parsed.vendorId && parsed.locationId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearStaffBranchSession(): void {
  sessionStorage.removeItem(STAFF_BRANCH_SESSION_KEY);
}

export function saveStaffAccessCode(code: string): void {
  sessionStorage.setItem(STAFF_ACCESS_CODE_KEY, code.trim());
}

export function loadStaffAccessCode(): string | null {
  try {
    const raw = sessionStorage.getItem(STAFF_ACCESS_CODE_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function clearStaffAccessCode(): void {
  sessionStorage.removeItem(STAFF_ACCESS_CODE_KEY);
}
