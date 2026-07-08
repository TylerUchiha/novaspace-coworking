import { Category, LocationData, MenuItem, Room, Vendor } from '../types';

function mergeCategories(lists: Category[][]): Category[] {
  const byKey = new Map<string, Category>();
  for (const list of lists) {
    for (const cat of list) {
      const key = cat.id || cat.name;
      if (!byKey.has(key)) byKey.set(key, cat);
    }
  }
  return Array.from(byKey.values());
}

function mergeMenuItems(lists: MenuItem[][]): MenuItem[] {
  const byId = new Map<string, MenuItem>();
  for (const list of lists) {
    for (const item of list) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

/** Union vendor, branch, and optional room menus for customer-facing display. */
export function mergeMenuCatalog(options: {
  vendor?: Vendor | null;
  location?: LocationData | null;
  room?: Room | null;
}): { categories: Category[]; menu: MenuItem[] } {
  const { vendor, location, room } = options;
  const categoryLists: Category[][] = [
    vendor?.categories || [],
    location?.categories || [],
    room?.categories || [],
  ];
  const menuLists: MenuItem[][] = [
    vendor?.menu || [],
    location?.menu || [],
    room?.menu || [],
  ];
  return {
    categories: mergeCategories(categoryLists),
    menu: mergeMenuItems(menuLists),
  };
}

export function buildMenuItemLookup(options: {
  vendor?: Vendor | null;
  location?: LocationData | null;
  room?: Room | null;
}): Map<string, MenuItem> {
  const { categories: _c, menu } = mergeMenuCatalog(options);
  return new Map(menu.map((item) => [item.id, item]));
}

export function resolveMenuItemPrice(
  itemId: string,
  options: {
    vendor?: Vendor | null;
    locations?: LocationData[];
  },
): number {
  const { vendor, locations = [] } = options;
  const vendorItem = vendor?.menu?.find((m) => m.id === itemId);
  if (vendorItem) return vendorItem.price;

  for (const loc of locations) {
    const locItem = loc.menu?.find((m) => m.id === itemId);
    if (locItem) return locItem.price;
    for (const floor of loc.floors || []) {
      for (const room of floor.rooms || []) {
        const roomItem = room.menu?.find((m) => m.id === itemId);
        if (roomItem) return roomItem.price;
      }
    }
  }
  return 0;
}
