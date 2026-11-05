import type { OverlayOptions } from './overlay-data';

type SizeOptions = Pick<OverlayOptions, 'layout' | 'scale' | 'show' | 'density'>;
export const OVERLAY_PADDING = 16;

/** Fixed panel slots prevent loading, fallback and long text from changing source bounds. */
export function getOverlayGeometry(options: SizeOptions) {
  const widths = { full: [408, 788, 1168], compact: [356, 668, 980], min: [320, 560, 800] };
  const panelHeights = {
    full: { status: 184, boss: 188, board: 236 },
    compact: { status: 132, boss: 152, board: 164 },
    min: { status: 88, boss: 108, board: 88 },
  }[options.density];
  const header = options.density === 'full' ? 44 : options.density === 'compact' ? 36 : 30;
  const footer = options.density === 'full' ? 28 : 0;
  const width = options.layout === 'card' ? widths[options.density][0] : widths[options.density][options.show.length - 1];
  const panelHeight = options.layout === 'card' ? options.show.reduce((height, section) => height + panelHeights[section], 0)
    : options.density === 'full' ? 176 : options.density === 'compact' ? 148 : 108;
  const height = header + panelHeight + footer + 4;
  return { width, height, header, footer, panelHeights, stageWidth: width + OVERLAY_PADDING * 2, stageHeight: height + OVERLAY_PADDING * 2 };
}

/** OBS tight-source dimensions, including a shadow gutter, at the requested scale. */
export function getOverlaySourceSize(options: SizeOptions): { width: number; height: number } {
  const geometry = getOverlayGeometry(options);
  return { width: Math.ceil(geometry.stageWidth * options.scale), height: Math.ceil(geometry.stageHeight * options.scale) };
}

/** Game presets are full-canvas guides, not promises about custom HUDs or webcams. */
export function getOverlaySafeArea(width: number, height: number, safe: OverlayOptions['safe']) {
  // A tight Browser Source is itself the placement box; only canvas-sized sources need HUD gutters.
  const preset = safe !== 'none' && width >= 1000 && height >= 600;
  const left = preset ? width * 0.03 : 0;
  const top = preset ? height * 0.12 : 0;
  const right = preset ? width * (safe === 'moba' ? 0.22 : 0.03) : 0;
  const bottom = preset ? height * (safe === 'moba' ? 0.24 : 0.2) : 0;
  return { left, top, width: width - left - right, height: height - top - bottom };
}

/** One uniform scale preserves pixel art and type even if OBS uses the wrong aspect ratio. */
export function fitOverlay(options: OverlayOptions, width: number, height: number) {
  const geometry = getOverlayGeometry(options);
  const area = getOverlaySafeArea(width, height, options.safe);
  const scale = Math.max(0, Math.min(options.scale, area.width / geometry.stageWidth, area.height / geometry.stageHeight));
  const horizontal = options.pos.endsWith('right') || options.pos === 'right' ? 1
    : options.pos.endsWith('left') || options.pos === 'left' ? 0 : 0.5;
  const vertical = options.pos.startsWith('bottom') ? 1 : options.pos.startsWith('top') ? 0 : 0.5;
  return { scale, left: area.left + (area.width - geometry.stageWidth * scale) * horizontal,
    top: area.top + (area.height - geometry.stageHeight * scale) * vertical };
}
