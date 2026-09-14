// src/data/floorLayout.ts
//
// This file extracts ONLY the layout portion (position, mobilePosition,
// rotation, scale, zIndex) of the 35 hand-placed products that used to
// live in the mock `data/products.ts` catalog. It intentionally drops
// name/price/image — those are irrelevant for layout purposes.
//
// WHY THIS EXISTS:
// The original 35-slot layout was hand-placed by a human, not generated
// by a formula (irregular `top` spacing within a row, shifting `left`
// offsets between rows, etc). There is no way to "continue the pattern"
// for product #36+ because there never was an underlying pattern to
// continue — just 35 specific hand-tuned positions.
//
// THE FIX:
// Treat these 35 slots as a repeating cycle. When the database has more
// products than there are slots, product #36 reuses slot #1's exact
// position, #37 reuses slot #2, and so on. This means the floor always
// fills in a layout that looks exactly like the original mock did,
// instead of collapsing new products to `0px` / `0%`.
//
// The order below matches the order products appeared in `products.ts`
// (ids 1–11, then 13–36 — id 12 was never used in the original mock).

export interface FloorSlot {
  position: {
    top: string;
    left: string;
  };
  mobilePosition: {
    top: string;
    left: string;
  };
  rotation: number;
  scale: number;
  zIndex: number;
}

export const FLOOR_LAYOUT: FloorSlot[] = [
  // slot 1  (was product id '1')
  {
    position: { top: 'calc(22.5dvh - 72px)', left: '2%' },
    mobilePosition: { top: 'calc(15dvh - 70px)', left: '5%' },
    rotation: -8,
    scale: 0.9,
    zIndex: 5,
  },
  // slot 2  (was product id '2')
  {
    position: { top: 'calc(33dvh - 96px)', left: '18%' },
    mobilePosition: { top: 'calc(15dvh - 70px)', left: '38%' },
    rotation: 15,
    scale: 0.85,
    zIndex: 3,
  },
  // slot 3  (was product id '3')
  {
    position: { top: 'calc(18dvh - 96px)', left: '34%' },
    mobilePosition: { top: 'calc(15dvh - 70px)', left: '71%' },
    rotation: 2,
    scale: 0.95,
    zIndex: 7,
  },
  // slot 4  (was product id '4')
  {
    position: { top: 'calc(28.5dvh - 96px)', left: '50%' },
    mobilePosition: { top: 'calc(37.5dvh - 70px)', left: '5%' },
    rotation: -3,
    scale: 0.88,
    zIndex: 4,
  },
  // slot 5  (was product id '5')
  {
    position: { top: 'calc(21dvh - 96px)', left: '66%' },
    mobilePosition: { top: 'calc(37.5dvh - 70px)', left: '38%' },
    rotation: -12,
    scale: 0.98,
    zIndex: 6,
  },
  // slot 6  (was product id '6')
  {
    position: { top: 'calc(21dvh - 96px)', left: '82%' },
    mobilePosition: { top: 'calc(37.5dvh - 70px)', left: '71%' },
    rotation: 8,
    scale: 0.82,
    zIndex: 2,
  },
  // slot 7  (was product id '7')
  {
    position: { top: 'calc(63dvh - 96px)', left: '8%' },
    mobilePosition: { top: 'calc(60dvh - 70px)', left: '5%' },
    rotation: 45,
    scale: 0.75,
    zIndex: 8,
  },
  // slot 8  (was product id '8')
  {
    position: { top: 'calc(69dvh - 96px)', left: '24%' },
    mobilePosition: { top: 'calc(60dvh - 70px)', left: '38%' },
    rotation: -5,
    scale: 0.92,
    zIndex: 3,
  },
  // slot 9  (was product id '9')
  {
    position: { top: 'calc(81dvh - 96px)', left: '40%' },
    mobilePosition: { top: 'calc(60dvh - 70px)', left: '71%' },
    rotation: 12,
    scale: 0.96,
    zIndex: 5,
  },
  // slot 10  (was product id '10')
  {
    position: { top: 'calc(72dvh - 96px)', left: '56%' },
    mobilePosition: { top: 'calc(82.5dvh - 70px)', left: '5%' },
    rotation: -8,
    scale: 0.84,
    zIndex: 4,
  },
  // slot 11  (was product id '11')
  {
    position: { top: 'calc(72dvh - 96px)', left: '72%' },
    mobilePosition: { top: 'calc(82.5dvh - 70px)', left: '38%' },
    rotation: -35,
    scale: 0.7,
    zIndex: 9,
  },
  // slot 12  (was product id '13' — original mock skipped id 12)
  {
    position: { top: 'calc(114dvh - 96px)', left: '4%' },
    mobilePosition: { top: 'calc(105dvh - 70px)', left: '5%' },
    rotation: -10,
    scale: 0.93,
    zIndex: 4,
  },
  // slot 13  (was product id '14')
  {
    position: { top: 'calc(120dvh - 96px)', left: '20%' },
    mobilePosition: { top: 'calc(105dvh - 70px)', left: '38%' },
    rotation: 25,
    scale: 0.85,
    zIndex: 7,
  },
  // slot 14  (was product id '15')
  {
    position: { top: 'calc(111dvh - 96px)', left: '36%' },
    mobilePosition: { top: 'calc(105dvh - 70px)', left: '71%' },
    rotation: 4,
    scale: 0.91,
    zIndex: 2,
  },
  // slot 15  (was product id '16')
  {
    position: { top: 'calc(123dvh - 96px)', left: '52%' },
    mobilePosition: { top: 'calc(127.5dvh - 70px)', left: '5%' },
    rotation: -7,
    scale: 0.98,
    zIndex: 6,
  },
  // slot 16  (was product id '17')
  {
    position: { top: 'calc(117dvh - 96px)', left: '68%' },
    mobilePosition: { top: 'calc(127.5dvh - 70px)', left: '38%' },
    rotation: 9,
    scale: 0.86,
    zIndex: 3,
  },
  // slot 17  (was product id '18')
  {
    position: { top: 'calc(117dvh - 96px)', left: '84%' },
    mobilePosition: { top: 'calc(127.5dvh - 70px)', left: '71%' },
    rotation: -2,
    scale: 0.94,
    zIndex: 5,
  },
  // slot 18  (was product id '19')
  {
    position: { top: 'calc(163.5dvh - 96px)', left: '2%' },
    mobilePosition: { top: 'calc(150dvh - 70px)', left: '5%' },
    rotation: -6,
    scale: 0.89,
    zIndex: 5,
  },
  // slot 19  (was product id '20')
  {
    position: { top: 'calc(169.5dvh - 96px)', left: '18%' },
    mobilePosition: { top: 'calc(150dvh - 70px)', left: '38%' },
    rotation: 11,
    scale: 0.94,
    zIndex: 4,
  },
  // slot 20  (was product id '21')
  {
    position: { top: 'calc(162.5dvh - 96px)', left: '34%' },
    mobilePosition: { top: 'calc(150dvh - 70px)', left: '71%' },
    rotation: -3,
    scale: 0.86,
    zIndex: 7,
  },
  // slot 21  (was product id '22')
  {
    position: { top: 'calc(172.5dvh - 96px)', left: '50%' },
    mobilePosition: { top: 'calc(172.5dvh - 70px)', left: '5%' },
    rotation: -9,
    scale: 0.91,
    zIndex: 3,
  },
  // slot 22  (was product id '23')
  {
    position: { top: 'calc(165dvh - 96px)', left: '66%' },
    mobilePosition: { top: 'calc(172.5dvh - 70px)', left: '38%' },
    rotation: 7,
    scale: 0.84,
    zIndex: 6,
  },
  // slot 23  (was product id '24')
  {
    position: { top: 'calc(166.5dvh - 96px)', left: '82%' },
    mobilePosition: { top: 'calc(172.5dvh - 70px)', left: '71%' },
    rotation: 14,
    scale: 0.8,
    zIndex: 2,
  },
  // slot 24  (was product id '25')
  {
    position: { top: 'calc(210dvh - 96px)', left: '4%' },
    mobilePosition: { top: 'calc(195dvh - 70px)', left: '5%' },
    rotation: -14,
    scale: 0.92,
    zIndex: 4,
  },
  // slot 25  (was product id '26')
  {
    position: { top: 'calc(216dvh - 96px)', left: '20%' },
    mobilePosition: { top: 'calc(195dvh - 70px)', left: '38%' },
    rotation: 18,
    scale: 0.87,
    zIndex: 7,
  },
  // slot 26  (was product id '27')
  {
    position: { top: 'calc(208dvh - 96px)', left: '36%' },
    mobilePosition: { top: 'calc(195dvh - 70px)', left: '71%' },
    rotation: -5,
    scale: 0.82,
    zIndex: 3,
  },
  // slot 27  (was product id '28')
  {
    position: { top: 'calc(220.5dvh - 96px)', left: '50%' },
    mobilePosition: { top: 'calc(217.5dvh - 70px)', left: '5%' },
    rotation: 5,
    scale: 0.95,
    zIndex: 6,
  },
  // slot 28  (was product id '29')
  {
    position: { top: 'calc(212.5dvh - 96px)', left: '66%' },
    mobilePosition: { top: 'calc(217.5dvh - 70px)', left: '38%' },
    rotation: -16,
    scale: 0.9,
    zIndex: 5,
  },
  // slot 29  (was product id '30')
  {
    position: { top: 'calc(214dvh - 96px)', left: '82%' },
    mobilePosition: { top: 'calc(217.5dvh - 70px)', left: '71%' },
    rotation: 9,
    scale: 0.78,
    zIndex: 8,
  },
  // slot 30  (was product id '31')
  {
    position: { top: 'calc(253dvh - 96px)', left: '2%' },
    mobilePosition: { top: 'calc(240dvh - 70px)', left: '5%' },
    rotation: -8,
    scale: 0.94,
    zIndex: 4,
  },
  // slot 31  (was product id '32')
  {
    position: { top: 'calc(259dvh - 96px)', left: '18%' },
    mobilePosition: { top: 'calc(240dvh - 70px)', left: '38%' },
    rotation: 13,
    scale: 0.86,
    zIndex: 7,
  },
  // slot 32  (was product id '33')
  {
    position: { top: 'calc(252dvh - 96px)', left: '34%' },
    mobilePosition: { top: 'calc(240dvh - 70px)', left: '71%' },
    rotation: -11,
    scale: 0.9,
    zIndex: 2,
  },
  // slot 33  (was product id '34')
  {
    position: { top: 'calc(263.5dvh - 96px)', left: '50%' },
    mobilePosition: { top: 'calc(262.5dvh - 70px)', left: '5%' },
    rotation: 6,
    scale: 0.97,
    zIndex: 6,
  },
  // slot 34  (was product id '35')
  {
    position: { top: 'calc(255.5dvh - 96px)', left: '66%' },
    mobilePosition: { top: 'calc(262.5dvh - 70px)', left: '38%' },
    rotation: -7,
    scale: 0.88,
    zIndex: 5,
  },
  // slot 35  (was product id '36')
  {
    position: { top: 'calc(257dvh - 96px)', left: '82%' },
    mobilePosition: { top: 'calc(262.5dvh - 70px)', left: '71%' },
    rotation: 16,
    scale: 0.81,
    zIndex: 3,
  },
];

/**
 * Returns the floor slot a product at the given zero-based catalog index
 * should occupy. Cycles through FLOOR_LAYOUT once the index exceeds the
 * number of hand-placed slots, so slot 1 repeats for index 35, slot 2
 * repeats for index 36, etc.
 *
 * `index` should be the product's position in creation order (e.g. the
 * count of products that existed in the table before this one was
 * inserted — so the very first product ever added gets index 0).
 */
export const getFloorSlot = (index: number): FloorSlot => {
  const length = FLOOR_LAYOUT.length;

  // Guard against negative/invalid input rather than throwing.
  const safeIndex =
    Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;

  return FLOOR_LAYOUT[safeIndex % length];
};

/**
 * Returns the first slot in FLOOR_LAYOUT not currently occupied by any
 * existing product's position, so deleted/gap positions get backfilled
 * before new slots are used.
 *
 * When every base slot is occupied, the function starts a new layout lap
 * and moves that lap further down the floor instead of placing products
 * directly on top of existing products.
 */
export const getNextAvailableFloorSlot = (
  occupiedPositions: { top: string; left: string }[]
): FloorSlot => {
  const occupied = new Set(
    occupiedPositions.map(p => `${p.top}|${p.left}`)
  );

  // First, use any genuinely empty base slot.
  for (const slot of FLOOR_LAYOUT) {
    const key = `${slot.position.top}|${slot.position.left}`;

    if (!occupied.has(key)) {
      return slot;
    }
  }

  // Every base slot is occupied.
  //
  // Start another lap through the layout, but push the entire lap
  // further down the floor so the new product cannot be perfectly
  // stacked on top of an existing product.
  const lap = Math.floor(
    occupiedPositions.length / FLOOR_LAYOUT.length
  );

  const slotIndex =
    occupiedPositions.length % FLOOR_LAYOUT.length;

  const baseSlot = FLOOR_LAYOUT[slotIndex];

  // Each additional lap gets its own vertical section.
  // 20dvh gives plenty of separation from the previous lap.
  const verticalNudgeVh = lap * -20;

  return {
    ...baseSlot,

    position: {
      top: `calc(${baseSlot.position.top} + ${verticalNudgeVh}dvh)`,
      left: baseSlot.position.left,
    },

    mobilePosition: {
      top: `calc(${baseSlot.mobilePosition.top} + ${verticalNudgeVh}dvh)`,
      left: baseSlot.mobilePosition.left,
    },
  };
};