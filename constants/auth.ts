/** @deprecated Client-side passcode check removed — validation is server-only via validateAccessCode. */
export const GLOBAL_ACCESS_PASSCODE = '';

export const CODE_SESSION_KEY = 'novaspace_code_session';
export const STAFF_BRANCH_SESSION_KEY = 'novaspace_staff_branch';

export type CodeSessionRole = 'employee' | 'owner';

export interface StoredCodeSession {
  role: CodeSessionRole;
}

export interface StoredStaffBranch {
  vendorId: string;
  locationId: string;
  floorId: string;
}


export function isGlobalAccessPasscode(_code: string): boolean {
  return false;
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
