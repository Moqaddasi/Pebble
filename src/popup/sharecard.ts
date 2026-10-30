import { INK } from '../shared/catalog';
import { PRODUCT_NAME, SHARE_URL } from '../shared/config';
import { petSvg, type PetLook } from '../shared/pet';

const W = 1200;
const H = 630;

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Largest font size (≤ max) at which `text` fits in `width`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number, max: number, width: number): number {
  let size = max;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 40 && ctx.measureText(text).width > width) {
    size -= 4;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** Draws the "Say hi to Pip" card from the design canvas as a PNG blob. */
export async function renderShareCard(look: PetLook, petName: string, userName: string): Promise<Blob> {
  await Promise.all([
    document.fonts.load('600 180px Fredoka'),
    document.fonts.load('700 34px Nunito'),
    document.fonts.load('800 22px Nunito'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFE6D3';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#F7CDB0';
  for (let y = 17; y < H; y += 34) {
    for (let x = 17; x < W; x += 34) {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.beginPath();
  ctx.arc(290, 290, 230, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF7EE';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();

  const pet = await loadImage(petSvg({ ...look, pose: 'wave', size: 380 }));
  ctx.drawImage(pet, 100, 104, 380, 380);

  const left = 590;
  const right = W - 70;
  ctx.textBaseline = 'alphabetic';

  // "SAY HI TO" pill
  ctx.font = '800 22px Nunito';
  ctx.letterSpacing = '1.3px';
  const tagW = ctx.measureText('SAY HI TO').width + 32;
  roundRect(ctx, left, 92, tagW, 42, 21);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.fillStyle = '#FFF7EE';
  ctx.fillText('SAY HI TO', left + 16, 121);
  ctx.letterSpacing = '0px';

  // Pet name
  const nameSize = fitFont(ctx, petName, 'Fredoka', 600, 180, right - left);
  ctx.fillStyle = INK;
  ctx.fillText(petName, left, 144 + nameSize * 0.82);

  // Tagline
  ctx.font = '700 34px Nunito';
  ctx.fillStyle = '#4F4566';
  const who = userName.trim() ? `${userName.trim()}'s tiny browsing buddy.` : 'A tiny browsing buddy.';
  const y0 = 144 + nameSize * 0.82 + 60;
  ctx.fillText(who, left, y0, right - left);
  ctx.fillText('Drops by, says hi, never', left, y0 + 42, right - left);
  ctx.fillText('gets in the way.', left, y0 + 84, right - left);

  // Footer: product name, and the link in a pill beside it (or above it when the link is long).
  ctx.font = '600 28px Fredoka';
  ctx.fillStyle = INK;
  const product = `${PRODUCT_NAME} · for Chrome`;
  ctx.fillText(product, left, H - 66);
  const productW = ctx.measureText(product).width;
  const link = new URL(SHARE_URL).hostname.replace(/^www\./, '');
  let size = 22;
  const pillW = () => {
    ctx.font = `800 ${size}px Nunito`;
    return ctx.measureText(link).width + 32;
  };
  while (size > 16 && pillW() > right - left - productW - 24) size -= 1;
  const linkW = pillW();
  const beside = linkW <= right - left - productW - 24;
  const pillX = beside ? right - linkW : left;
  const pillY = beside ? H - 98 : H - 156;
  roundRect(ctx, pillX, pillY, linkW, 44, 14);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillText(link, pillX + 16, pillY + 22 + size * 0.35);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
