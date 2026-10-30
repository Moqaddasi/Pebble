// The costumed characters have their own personalities instead of cat/dog: their own things to do,
// their own way in and out. Their traits still set energy, timing and favorite spot.

export type Hero = 'vader' | 'spider' | 'bat';

export const HERO_ACTIVITIES = {
  // Dramatic and slow.
  vader: ['saber', 'saberSpin', 'stare', 'patrol', 'breathe', 'forceLift', 'meditate', 'nap'],
  // A bouncy show-off.
  spider: ['hang', 'webShot', 'flip', 'crouch', 'scurry', 'wallCrawl', 'spiderSense', 'nap'],
  // Quiet and watchful.
  bat: ['brood', 'lookout', 'grapple', 'capeSwish', 'patrol', 'shadowStep', 'nap'],
} as const;

export type HeroActivity = (typeof HERO_ACTIVITIES)[Hero][number];

export const HERO_ENTRANCES = { vader: 'march', spider: 'webDrop', bat: 'glide' } as const;
export const HERO_EXITS = { vader: 'walkAway', spider: 'webZip', bat: 'vanish' } as const;

export type HeroEntrance = (typeof HERO_ENTRANCES)[Hero];
export type HeroExit = (typeof HERO_EXITS)[Hero];

/** How likely each of the hero's activities is, given its energy right now. */
export function heroWeights(hero: Hero, energy: number): Record<string, number> {
  const restful = (1.8 - energy * 1.6) ** 2;
  switch (hero) {
    case 'vader':
      return { saber: 1.2, saberSpin: 0.6 + energy * 0.4, stare: 0.7, patrol: 0.5 + energy * 0.6, breathe: 0.8, forceLift: 0.8, meditate: 0.5 + restful * 0.3, nap: restful * 0.6 };
    case 'spider':
      return { hang: 1, webShot: 0.8, flip: 0.4 + energy, crouch: 0.7, scurry: 0.4 + energy * 0.8, wallCrawl: 0.7, spiderSense: 0.8, nap: restful * 0.6 };
    case 'bat':
      return { brood: 1.1, lookout: 1, grapple: 0.8, capeSwish: 0.6, patrol: 0.4 + energy * 0.5, shadowStep: 0.7, nap: restful * 0.5 };
  }
}

/** A short sound the hero makes to itself now and then. */
export const HERO_MURMURS: Record<Hero, readonly string[]> = {
  vader: ['kooh… pahh…', 'kshhh…'],
  spider: ['thwip!', 'hup!'],
  bat: ['…', 'hmph.'],
};
