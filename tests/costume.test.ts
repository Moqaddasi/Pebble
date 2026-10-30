import { describe, expect, it } from 'vitest';
import { CHARACTERS, characterName, type CharacterId, type Pose } from '../src/shared/catalog';
import { petSvg } from '../src/shared/pet';

const POSES: Pose[] = [
  'idle', 'walk', 'wave', 'handshake', 'bye', 'sleep', 'surprised', 'happy', 'sad', 'tumble', 'loaf', 'lookAround',
  'lookLeft', 'lookRight', 'lookUp', 'groom', 'sniff', 'content', 'annoyed', 'blink', 'drowsy', 'away', 'glance', 'tilt',
  'kneadL', 'kneadR', 'bellyUp', 'swat', 'hiss', 'bow', 'yawn', 'saber', 'offer', 'force', 'hang', 'crouch', 'meditate',
  'webShoot', 'scratch', 'dig',
];
const IDS: CharacterId[] = ['pip', 'vader', 'spider', 'bat'];

describe('characters', () => {
  it('names follow the pet name', () => {
    expect(characterName('vader', 'Mochi')).toBe('Mochi Vader');
    expect(characterName('spider', 'Mochi')).toBe('Spider-Mochi');
    expect(characterName('bat', 'Mochi')).toBe('Bat-Mochi');
    expect(characterName('pip', 'Mochi')).toBe('Mochi');
  });

  it('lists all four, Classic first', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual(IDS);
  });

  it('draws every pose for every character without broken values', () => {
    for (const character of IDS) {
      for (const pose of POSES) {
        const svg = petSvg({ character, pose });
        expect(svg, `${character} ${pose}`).not.toMatch(/undefined|NaN/);
        expect(svg.match(/<svg/g)?.length).toBe(svg.match(/<\/svg>/g)?.length);
      }
    }
  });

  it('costumes hide the sprout; Classic keeps it', () => {
    expect(petSvg({ character: 'pip' })).toContain('pp-sprout');
    for (const c of ['vader', 'spider', 'bat'] as const) expect(petSvg({ character: c })).not.toContain('pp-sprout');
  });

  it('gives each drawing its own clip-path id', () => {
    const ids = (s: string) => [...s.matchAll(/clipPath id="([^"]+)"/g)].map((m) => m[1]);
    const a = ids(petSvg({ character: 'spider' }));
    const b = ids(petSvg({ character: 'spider' }));
    expect(a.length).toBeGreaterThan(0);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it('draws held props', () => {
    expect(petSvg({ character: 'vader', pose: 'saber', prop: 'saber' })).toContain('#FF4D4D');
    expect(petSvg({ character: 'bat', pose: 'offer', prop: 'glass' })).toContain('#7CC4F2');
  });
});
