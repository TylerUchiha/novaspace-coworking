export type AppTab =
  | 'blueprint'
  | 'staff_registry'
  | 'property_config'
  | 'menu_config'
  | 'analytics'
  | 'shift_summary'
  | 'profile'
  | 'my_bookings'
  | 'credits'
  | 'favorites'
  | 'staff_management'
  | 'cancellation_policies';

export const CUSTOMER_TABS: AppTab[] = ['blueprint', 'my_bookings', 'credits', 'favorites', 'profile'];
export const EMPLOYEE_TABS: AppTab[] = ['staff_registry', 'blueprint', 'menu_config', 'shift_summary'];
export const OWNER_TABS: AppTab[] = [
  'property_config',
  'menu_config',
  'analytics',
  'shift_summary',
  'staff_management',
  'cancellation_policies',
];

export function defaultTabForRole(role: 'customer' | 'employee' | 'owner' | null): AppTab {
  if (role === 'employee') return 'staff_registry';
  if (role === 'owner') return 'property_config';
  return 'blueprint';
}

export function isValidTabForRole(tab: string, role: 'customer' | 'employee' | 'owner' | null): tab is AppTab {
  if (role === 'owner') return OWNER_TABS.includes(tab as AppTab);
  if (role === 'employee') return EMPLOYEE_TABS.includes(tab as AppTab);
  return CUSTOMER_TABS.includes(tab as AppTab);
}

export function buildNetworkPath(vendorId: string, locationId: string, tab: AppTab): string {
  return `/network/${encodeURIComponent(vendorId)}/${encodeURIComponent(locationId)}/${tab}`;
}

export function buildVendorPath(vendorId: string): string {
  return `/network/${encodeURIComponent(vendorId)}`;
}

export function parseNetworkPath(pathname: string): {
  vendorId?: string;
  locationId?: string;
  tab?: string;
} | null {
  const match = pathname.match(/^\/network\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?/);
  if (!match) return null;
  return {
    vendorId: decodeURIComponent(match[1]),
    locationId: match[2] ? decodeURIComponent(match[2]) : undefined,
    tab: match[3] ? decodeURIComponent(match[3]) : undefined,
  };
}

export function isStaticPagePath(pathname: string): boolean {
  return ['/privacy', '/terms', '/support', '/api-status'].includes(pathname);
}
