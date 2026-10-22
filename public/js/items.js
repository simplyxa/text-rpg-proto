const ITEM_ICON_DIR = '/images/items/';
const ITEM_ICON_SIZES = { inventory: 'inventory', shop: 'shop', equipment: 'equipment' };
const ITEM_ICON_BY_ID = {
  helmet: 'helmet',
  amulet: 'amulet',
  armor: 'armor',
  gloves: 'gloves',
  pants: 'pants',
  boots: 'boots',
  left_blade: 'sword',
  right_blade: 'shield'
};
const ITEM_ICON_BY_SLOT = {
  helmet: 'helmet',
  ring: 'amulet',
  chest: 'armor',
  hands: 'gloves',
  armor: 'pants',
  boots: 'boots',
  shield: 'sword',
  cloak: 'shield'
};

function getItemIconPath(item) {
  const id = typeof item === 'string' ? item : item?.id;
  let key = ITEM_ICON_BY_ID[id];
  if (!key && id) {
    const prefix = Object.keys(ITEM_ICON_BY_ID).find((candidate) => id.startsWith(`${candidate}_`));
    key = prefix && ITEM_ICON_BY_ID[prefix];
  }
  key = key || ITEM_ICON_BY_SLOT[item?.slot] || ITEM_ICON_BY_SLOT[id];
  return key ? `${ITEM_ICON_DIR}${key}.svg` : null;
}

function createItemIcon(item, size = 'inventory') {
  const path = getItemIconPath(item);
  if (!path) return null;
  const icon = document.createElement('img');
  icon.src = path;
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  icon.className = `item-icon item-icon-${ITEM_ICON_SIZES[size] || 'inventory'}`;
  if (item?.rarity && item.rarity !== 'common') icon.classList.add(`item-icon-${item.rarity}`);
  return icon;
}

function addIconsToRows(container, size) {
  container?.querySelectorAll('[data-icon-id], [data-icon-slot]').forEach((row) => {
    if (row.querySelector(':scope > .item-icon')) return;
    const icon = createItemIcon({
      id: row.dataset.iconId,
      slot: row.dataset.iconSlot,
      rarity: row.dataset.iconRarity
    }, size);
    if (!icon) return;
    row.classList.add('gear-row-with-icon');
    row.prepend(icon);
  });
}

function renderInventoryWithIcons(container) {
  addIconsToRows(container, 'inventory');
}

function renderShopWithIcons(container) {
  addIconsToRows(container, 'shop');
}

function renderEquipmentWithIcons(container) {
  addIconsToRows(container, 'equipment');
}
