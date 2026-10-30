export const INK = '#2B2A26';

export type Pose =
  | 'idle'
  | 'walk'
  | 'wave'
  | 'handshake'
  | 'bye'
  | 'sleep'
  | 'surprised'
  | 'happy'
  | 'sad'
  | 'tumble'
  | 'loaf'
  | 'lookAround'
  | 'lookLeft'
  | 'lookRight'
  | 'lookUp'
  | 'groom'
  | 'sniff'
  | 'content'
  | 'annoyed'
  | 'blink'
  | 'drowsy'
  | 'away'
  | 'glance'
  | 'tilt'
  | 'kneadL'
  | 'kneadR'
  | 'bellyUp'
  | 'swat'
  | 'hiss'
  | 'bow'
  | 'yawn'
  | 'saber'
  | 'offer'
  | 'force'
  | 'hang'
  | 'crouch'
  | 'meditate'
  | 'webShoot'
  | 'scratch'
  | 'dig';

export type CharacterId = 'pip' | 'vader' | 'spider' | 'bat';

/** Classic Pip and the costumed characters. `short` labels the picker cards. */
export const CHARACTERS: { id: CharacterId; short: string; tagline: string }[] = [
  { id: 'pip', short: 'Classic', tagline: 'Calm, curious, yours.' },
  { id: 'vader', short: 'Vader', tagline: 'Tries so hard to be scary.' },
  { id: 'spider', short: 'Spider', tagline: 'Acts tough. Is tiny.' },
  { id: 'bat', short: 'Bat', tagline: 'Glares at everything. Secretly soft.' },
];

/** The name the character goes by: Mochi, Mochi Vader, Spider-Mochi, Bat-Mochi. */
export function characterName(id: CharacterId, petName: string): string {
  switch (id) {
    case 'vader':
      return `${petName} Vader`;
    case 'spider':
      return `Spider-${petName}`;
    case 'bat':
      return `Bat-${petName}`;
    default:
      return petName;
  }
}

export type Accessory = 'none' | 'hat' | 'scarf' | 'glasses';
export type SkinId = 'plain' | 'polka' | 'stripes' | 'cloud' | 'starry' | 'berry';

export const COLORS = [
  { hex: '#E8B04B', name: 'Honey' },
  { hex: '#A9C5A0', name: 'Sage' },
  { hex: '#C9B8FF', name: 'Lilac' },
  { hex: '#FFD872', name: 'Butter' },
  { hex: '#A8D4FF', name: 'Sky' },
] as const;

/** Colors from the first character, mapped to their nearest replacement. */
export const RETIRED_COLORS: Record<string, string> = {
  '#FFB38A': '#E8B04B', // Peach → Honey
  '#9FE0C4': '#A9C5A0', // Mint → Sage
};

export const ACCESSORIES: { id: Accessory; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'hat', label: 'Hat' },
  { id: 'scarf', label: 'Scarf' },
  { id: 'glasses', label: 'Glasses' },
];

export interface Skin {
  id: SkinId;
  name: string;
  /** How a locked skin is earned; absent for free skins. */
  unlock?: 'share' | 'petting';
}

export const SKINS: Skin[] = [
  { id: 'plain', name: 'Classic' },
  { id: 'polka', name: 'Polka' },
  { id: 'stripes', name: 'Stripes' },
  { id: 'cloud', name: 'Cloud' },
  { id: 'starry', name: 'Starry', unlock: 'share' },
  { id: 'berry', name: 'Berry', unlock: 'petting' },
];

export const FREE_SKINS: SkinId[] = SKINS.filter((s) => !s.unlock).map((s) => s.id);

export function skinName(id: SkinId): string {
  return SKINS.find((s) => s.id === id)?.name ?? id;
}

/** Labels for the 1–5 frequency slider, and the visits per hour each one means. */
export const FREQUENCIES = [
  { label: 'About 1 visit an hour', perHour: 1 },
  { label: 'About 2 visits an hour', perHour: 2 },
  { label: '3–4 visits an hour', perHour: 3.5 },
  { label: '5–6 visits an hour', perHour: 5.5 },
  { label: 'Up to 8 visits an hour', perHour: 8 },
] as const;

export const PET_NAME_SUGGESTIONS = ['Pip', 'Mochi', 'Bean', 'Tofu', 'Sprout', 'Nori', 'Biscuit'];

export const NAME_MAX = 20;
