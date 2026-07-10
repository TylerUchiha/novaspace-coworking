# Catalog assets to supply (human)

Do **not** invent venue copy in code. Fill real data via owner UI after audit.

**Protect production:** never clear `meta/catalog.seeded` or force `seedCatalog` on live data.

## Audit first (Firebase Console)

- [ ] List `vendors` document IDs
- [ ] List `locations` document IDs
- [ ] Note leftover demo IDs (`v-novaspace`, `v-zenith`, `v-orbit`, `sf-main`, `ny-main`, `ldn-sh`, “Beta Lab”, etc.)
- [ ] Plan: create real venues first, then edit/delete demo docs

## Per vendor (Brand Settings / Create Space)

| Field | Your value | Done |
|-------|------------|------|
| Name | _TODO_ | [ ] |
| Logo image file | _TODO_ | [ ] |
| Description | _TODO_ | [ ] |
| Brand color | _TODO_ | [ ] |
| Access label (e.g. 24/7) | _TODO_ | [ ] |
| Network tags | _TODO_ | [ ] |

## Per branch (Branch Settings)

| Field | Your value | Done |
|-------|------------|------|
| Name | _TODO_ | [ ] |
| Address | _TODO_ | [ ] |
| City | _TODO_ | [ ] |
| Map URL | _TODO_ | [ ] |
| Hero / branch image | _TODO_ | [ ] |
| Description | _TODO_ | [ ] |
| Staff access code | _TODO_ | [ ] |
| Branch tags | _TODO_ | [ ] |

## Floors & rooms (Space Architecture)

| Room | Type | Capacity | EGP/hr | Photos | Done |
|------|------|----------|--------|--------|------|
| _TODO_ | Meeting / Lounge / … | | | _TODO_ | [ ] |

## Menus (Menu Config)

| Item | Category | Price (EGP) | Photo | Done |
|------|----------|-------------|-------|------|
| _TODO_ | | | _TODO_ | [ ] |

## Soft launch without card payments

- [ ] Staff can top up credits (`topUpCredits`), **or**
- [ ] Room prices set to `0` for invite-only launch

## Where to enter data

1. Owner login → Create Space / network picker  
2. `/network/{vendorId}/{locationId}/property_config` — brand, branch, layout, tags  
3. `/network/.../menu_config` — categories and menu items  
4. Upload images through the UI (Storage paths under `vendors/` and `locations/`)

Dev fixtures only (not for production content): `constants.ts`, `functions/src/seed-data.json`.
