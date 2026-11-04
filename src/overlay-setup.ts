import './overlay-setup.css';
import { parseOverlayOptions, type OverlayOptions } from './overlay-data';
import { getOverlaySourceSize } from './overlay-geometry';

type Panel = OverlayOptions['show'][number];
export type OverlaySetupOptions = OverlayOptions;
const panels: Panel[] = ['status', 'boss', 'board'];
const canvases = [
  { value: '1920x1080', label: '1920 × 1080 · 1080p', width: 1920, height: 1080 },
  { value: '1280x720', label: '1280 × 720 · 720p', width: 1280, height: 720 },
  { value: '2560x1440', label: '2560 × 1440 · 1440p', width: 2560, height: 1440 },
  { value: '1080x1920', label: '1080 × 1920 · vertical', width: 1080, height: 1920 },
];
const anchors = [
  ['top-left', 'Top left'], ['top', 'Top center'], ['top-right', 'Top right'],
  ['left', 'Middle left'], ['center', 'Center'], ['right', 'Middle right'],
  ['bottom-left', 'Bottom left'], ['bottom', 'Bottom center'], ['bottom-right', 'Bottom right'],
];

/** Always uses this app's origin; the copied source never points to an external preview. */
export function buildOverlayUrl(origin: string, options: OverlaySetupOptions): string {
  const url = new URL('/overlay', origin);
  for (const name of ['layout', 'scale', 'bg', 'pos', 'opacity', 'density', 'safe', 'motion'] as const) {
    url.searchParams.set(name, String(options[name]));
  }
  url.searchParams.set('show', options.show.join(','));
  return url.href;
}

const wheel = `<svg viewBox="0 0 40 40" fill="none" shape-rendering="crispEdges" aria-hidden="true"><path d="M12 2h16v4h6v6h4v16h-4v6h-6v4H12v-4H6v-6H2V12h4V6h6V2Z" stroke="currentColor" stroke-width="2"/><path d="M8 28h24M20 5v8M7 14l8 4m18-4-8 4" stroke="currentColor" stroke-width="2"/><path fill="#e4c18e" d="M13 15h5v3h5v-3h5v12H13z"/><path fill="#fff0d5" d="M16 24h9v5h-9z"/><path fill="#171121" d="M16 20h2v3h-2zm8 0h2v3h-2z"/><path fill="#e5a1af" d="M20 24h3v2h-3z"/></svg>`;

/** Standalone OBS setup page. It intentionally boots no game, music, or wallet code. */
export function mountOverlaySetup(root: HTMLElement = document.querySelector<HTMLDivElement>('#app')!): () => void {
  if (!root) return () => {};
  const previousTitle = document.title;
  document.title = 'Stream overlay setup · Squeekspire';
  document.body.classList.add('os-body');
  const initialQuery = new URLSearchParams(window.location.search);
  const options = parseOverlayOptions(window.location.search);
  // OBS has no use for decorative motion by default. An explicit source URL keeps its setting.
  if (!initialQuery.has('motion')) options.motion = 'low';
  const selectedCanvas = canvases.find(canvas => canvas.value === initialQuery.get('canvas')) || canvases[0];
  let sourceMode = initialQuery.get('source') === 'tight' ? 'tight' : 'canvas';
  let canvas = selectedCanvas;
  let disposed = false;
  root.innerHTML = `<div class="os-page">
    <header class="os-header"><a class="os-brand" href="/" aria-label="Squeekspire home"><span>${wheel}</span><strong>SQUEEK<span>SPIRE</span></strong></a><a class="os-back" href="/leaderboard">Leaderboard <span aria-hidden="true">→</span></a></header>
    <main class="os-main">
      <section class="os-hero"><div><p class="os-eyebrow"><i></i> THE WHEEL, ON AIR</p><h1>Bring the wheel<br>to your <em>stream.</em></h1><p class="os-intro">Live hamster energy, today's challenge, and the climbers chasing the crown.<br class="os-wide-break"> Set it against your game before you go live.</p></div><div class="os-hero-badge"><span>${wheel}</span><div><strong>BUILT FOR OBS</strong><small>READ-ONLY · NO WALLET</small></div></div></section>
      <div class="os-workbench">
        <section class="os-config" aria-labelledby="os-config-title"><div class="os-section-heading"><span class="os-step">01</span><div><p class="os-eyebrow">MAKE IT YOURS</p><h2 id="os-config-title">Configure your overlay</h2></div></div>
          <form data-os-form>
            <fieldset class="os-fieldset"><legend>LAYOUT</legend><div class="os-layouts">${(['bar', 'card'] as const).map(layout => `<label><input type="radio" name="layout" value="${layout}" ${options.layout === layout ? 'checked' : ''}><span class="os-layout-choice"><i class="os-layout-icon os-icon-${layout}" aria-hidden="true"><b></b><b></b><b></b></i><strong>${layout === 'bar' ? 'Bar' : 'Card'}</strong><small>${layout === 'bar' ? 'Across your scene' : 'In your corner'}</small></span></label>`).join('')}</div></fieldset>
            <label class="os-select-label" for="os-density">DETAIL LEVEL<select id="os-density" name="density"><option value="full" ${options.density === 'full' ? 'selected' : ''}>Full · all details</option><option value="compact" ${options.density === 'compact' ? 'selected' : ''}>Compact · fewer details</option><option value="min" ${options.density === 'min' ? 'selected' : ''}>Minimal · essentials</option></select></label>
            <div class="os-scale-row"><label for="os-scale">SCALE</label><output for="os-scale" data-os-scale-label>${options.scale}×</output></div><input id="os-scale" class="os-range" type="range" name="scale" min="0.5" max="2" step="0.05" value="${options.scale}"><div class="os-range-labels"><span>0.5×</span><span>2×</span></div>
            <fieldset class="os-fieldset os-show"><legend>ON YOUR STREAM</legend>${panels.map((panel, i) => `<label><input type="checkbox" name="show" value="${panel}" ${options.show.includes(panel) ? 'checked' : ''}><span class="os-check" aria-hidden="true"></span><span>${['Live hamster status', 'Daily boss & map', "Today's top climbers"][i]}</span></label>`).join('')}<p data-os-show-note class="os-show-note" aria-live="polite"></p></fieldset>
            <label class="os-select-label" for="os-source">OBS SOURCE SIZE<select id="os-source" name="source"><option value="canvas" ${sourceMode === 'canvas' ? 'selected' : ''}>Full canvas · anchors & safe areas</option><option value="tight" ${sourceMode === 'tight' ? 'selected' : ''}>Tight source · position in OBS</option></select></label>
            <label class="os-select-label" for="os-canvas">STREAM CANVAS<select id="os-canvas" name="canvas">${canvases.map(item => `<option value="${item.value}" ${canvas.value === item.value ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>
            <label class="os-select-label" for="os-pos">ANCHOR<select id="os-pos" name="pos">${anchors.map(([value, label]) => `<option value="${value}" ${options.pos === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
            <label class="os-select-label" for="os-safe">SAFE AREA<select id="os-safe" name="safe"><option value="none" ${options.safe === 'none' ? 'selected' : ''}>None · place freely</option><option value="moba" ${options.safe === 'moba' ? 'selected' : ''}>MOBA · reserve lower HUD & right map</option><option value="fps" ${options.safe === 'fps' ? 'selected' : ''}>FPS · reserve upper & lower HUD</option></select></label>
            <fieldset class="os-fieldset"><legend>BACKGROUND</legend><div class="os-bg-switch"><label><input type="radio" name="bg" value="transparent" ${options.bg === 'transparent' ? 'checked' : ''}><span><i class="os-transparent-swatch" aria-hidden="true"></i>Transparent</span></label><label><input type="radio" name="bg" value="dark" ${options.bg === 'dark' ? 'checked' : ''}><span><i class="os-dark-swatch" aria-hidden="true"></i>Dark scene</span></label></div><p class="os-control-help" data-os-bg-note></p></fieldset>
            <div class="os-scale-row"><label for="os-opacity">PANEL OPACITY</label><output for="os-opacity" data-os-opacity-label>${Math.round(options.opacity * 100)}%</output></div><input id="os-opacity" class="os-range" type="range" name="opacity" min="0.25" max="1" step="0.05" value="${options.opacity}"><p class="os-control-help">Changes the panel fill only; text stays solid. Use 100% on bright games.</p>
            <label class="os-select-label" for="os-motion">MOTION<select id="os-motion" name="motion"><option value="low" ${options.motion === 'low' ? 'selected' : ''}>Low · recommended for OBS</option><option value="normal" ${options.motion === 'normal' ? 'selected' : ''}>Normal</option></select></label>
          </form>
        </section>
        <section class="os-preview-panel" aria-labelledby="os-preview-title"><div class="os-preview-heading"><div><span class="os-live-dot"></span><h2 id="os-preview-title">Live preview</h2></div><span data-os-size></span></div><div class="os-preview-stage" data-os-stage><span class="os-stage-label">SCENE MOCKUP / LIVE OVERLAY</span><div class="os-frame-position"><div class="os-scene" aria-hidden="true"><div class="os-moon"></div><div class="os-mountain os-mountain-back"></div><div class="os-mountain os-mountain-front"></div><div class="os-ground"></div><span class="os-scene-webcam">WEBCAM</span><span class="os-scene-abilities">ABILITIES / HEALTH</span><span class="os-scene-map">MINIMAP</span></div><iframe title="Live Squeekspire overlay preview" data-os-preview loading="eager" referrerpolicy="same-origin" tabindex="-1"></iframe></div><span class="os-stage-corner" aria-hidden="true">+</span></div><p class="os-preview-caption"><span>LIVE DATA · REFRESHES ABOUT EVERY 15 SECONDS</span><span>Preview scaled to fit</span></p>
          <div class="os-advice" aria-live="polite"><p data-os-placement></p><p data-os-readability></p><p data-os-source-note></p></div>
          <div class="os-url-block"><label for="os-url">YOUR BROWSER SOURCE URL</label><div class="os-url-row"><input id="os-url" data-os-url type="url" readonly spellcheck="false" aria-describedby="os-copy-status"><button type="button" data-os-copy>Copy URL</button></div><div class="os-url-foot"><p id="os-copy-status" data-os-copy-status role="status" aria-live="polite">Ready to paste into OBS.</p><a data-os-open target="_blank" rel="noopener noreferrer">Open overlay <span aria-hidden="true">→</span></a></div></div>
          <div class="os-preview-check"><h3>Check your actual scene</h3><p>The mockup marks common HUD areas. A MOBA minimap is often bottom right, abilities bottom center, and a webcam may occupy any corner. Try a compact bar near the top or a card in a free side area. Avoid the webcam and leave the game scoreboard visible. Safe presets reserve space; inspect your own HUD before going live.</p><p>Preview text is reduced to fit this page. Judge legibility at your final OBS output resolution, especially when a 1080p canvas is streamed at 720p.</p></div>
        </section>
      </div>
      <section class="os-instructions" aria-labelledby="os-instructions-title"><div class="os-section-heading"><span class="os-step">02</span><div><p class="os-eyebrow">THREE LITTLE STEPS</p><h2 id="os-instructions-title">Put it on air</h2></div></div><ol><li><span>1</span><div><h3>Add a Browser Source</h3><p>In OBS, open <strong>Sources → + → Browser</strong>. Give your overlay a name. Leave <strong>Local file</strong> off and paste the URL above.</p></div></li><li><span>2</span><div><h3>Match the source dimensions</h3><p>Set width to <strong data-os-width></strong> and height to <strong data-os-height></strong>. Use <strong>30 FPS</strong>. Full canvas mode matches your scene; tight mode can be moved within OBS.</p></div></li><li><span>3</span><div><h3>Keep the aspect ratio</h3><p>Use <strong>Transform → Reset Transform</strong>, then <strong>Fit to Screen</strong> for full canvas. Avoid Stretch to Screen or dragging handles with Shift. A smaller browser viewport fits the panel uniformly; stretching the OBS source still distorts it.</p></div></li></ol></section>
      <section class="os-obs-notes"><h2>Browser Source notes</h2><p>Transparency works with the default OBS custom CSS; no extra CSS is needed. The overlay uses local system fonts, so there is no webfont download or font installation. Live data still needs a connection, and unavailable feeds are labeled.</p><p>Enable <strong>Shutdown source when not visible</strong> to save work between scenes; it reconnects when shown. Leave it off if you want the source ready during scene changes. <strong>Refresh browser when scene becomes active</strong> reloads the source and can briefly show its connecting state; leave it off for smoother switches. While the browser document is hidden, refresh timers pause and resume with an immediate update when visible.</p><p>Use a current OBS release with Browser Source support. Browser checks here cannot guarantee every OBS Chromium/CEF version or custom plugin setup. Test a scene switch and a source refresh before going live.</p></section>
      <footer class="os-footer"><span><i></i> A LITTLE LIVE ENERGY FOR YOUR SCENE</span><p>Daily challenge & rankings reset at 00:00 UTC. If an API takes a nap, the overlay recovers automatically.</p><a href="/leaderboard">Meet today's climbers <span aria-hidden="true">→</span></a></footer>
    </main>
  </div>`;

  const form = root.querySelector<HTMLFormElement>('[data-os-form]')!;
  const iframe = root.querySelector<HTMLIFrameElement>('[data-os-preview]')!;
  const stage = root.querySelector<HTMLElement>('[data-os-stage]')!;
  const urlInput = root.querySelector<HTMLInputElement>('[data-os-url]')!;
  const status = root.querySelector<HTMLElement>('[data-os-copy-status]')!;
  const copyButton = root.querySelector<HTMLButtonElement>('[data-os-copy]')!;
  let sourceWidth = canvas.width;
  let sourceHeight = canvas.height;
  let copySequence = 0;
  const sizePreview = () => {
    const availableWidth = Math.max(100, stage.clientWidth - 32);
    const availableHeight = Math.max(100, stage.clientHeight - 64);
    const fit = Math.min(1, availableWidth / sourceWidth, availableHeight / sourceHeight);
    iframe.style.width = `${sourceWidth}px`;
    iframe.style.height = `${sourceHeight}px`;
    iframe.style.transform = `scale(${fit})`;
    const position = root.querySelector<HTMLElement>('.os-frame-position')!;
    position.style.width = `${sourceWidth * fit}px`;
    position.style.height = `${sourceHeight * fit}px`;
  };
  const render = () => {
    const url = buildOverlayUrl(window.location.origin, options);
    const size = sourceMode === 'canvas' ? canvas : getOverlaySourceSize(options);
    sourceWidth = size.width;
    sourceHeight = size.height;
    if (iframe.src !== url) iframe.src = url;
    urlInput.value = url;
    root.querySelector<HTMLAnchorElement>('[data-os-open]')!.href = url;
    root.querySelector<HTMLElement>('[data-os-scale-label]')!.textContent = `${options.scale}×`;
    root.querySelector<HTMLElement>('[data-os-opacity-label]')!.textContent = `${Math.round(options.opacity * 100)}%`;
    root.querySelector<HTMLElement>('[data-os-size]')!.textContent = `${sourceWidth} × ${sourceHeight} PX`;
    root.querySelector<HTMLElement>('[data-os-width]')!.textContent = String(sourceWidth);
    root.querySelector<HTMLElement>('[data-os-height]')!.textContent = String(sourceHeight);
    root.querySelector<HTMLElement>('[data-os-bg-note]')!.textContent = options.bg === 'dark'
      ? 'Dark scene fills the entire source. Choose Transparent to keep gameplay visible around the panel.'
      : 'Transparent keeps the area around the panel clear.';
    root.querySelector<HTMLSelectElement>('#os-canvas')!.disabled = sourceMode === 'tight';
    stage.dataset.layout = options.layout;
    stage.dataset.source = sourceMode;
    root.querySelector<HTMLElement>('[data-os-placement]')!.textContent = options.safe === 'moba'
      ? 'MOBA safe area reserves the right 22%, bottom 24%, top 12%, and left 3%. A top or side anchor can still meet a webcam; check your scene.'
      : options.safe === 'fps'
        ? 'FPS safe area reserves the top 12%, bottom 20%, and 3% at each side. Keep the crosshair and your webcam clear.'
        : 'Free placement: bottom right may cover a minimap, bottom center may cover abilities, and any corner may contain a webcam.';
    root.querySelector<HTMLElement>('[data-os-readability]')!.textContent = options.scale < 1
      ? 'Small text warning: scale below 1 can be hard to read at 720p or after downscaling. Prefer a Compact bar or Minimal card at scale 1 or higher; check the final output at 100%.'
      : `For 720p output, prefer a Compact bar or Minimal card at scale 1 or higher. Larger labels help, but Full detail can still be too small after auto-fit or downscaling.${options.layout === 'card' && options.density !== 'min' ? ' Compact/Full cards can reach a bottom-left webcam at 720p; check your scene or choose Minimal.' : ''} Keep panel opacity at 100% over bright action.`;
    root.querySelector<HTMLElement>('[data-os-source-note]')!.textContent = sourceMode === 'canvas'
      ? `Set the OBS browser source to ${sourceWidth} × ${sourceHeight}. Anchors are inside this canvas. If space is tight, the panel fits uniformly and may become smaller than the chosen scale.`
      : 'Tight source dimensions include the selected panels and scale. Move this source in OBS without stretching. Safe presets are intended for a full canvas of at least 1000 × 600; use None for tight sources.';
    status.textContent = 'Ready to paste into OBS.';
    copySequence++;
    sizePreview();
  };
  const update = () => {
    const data = new FormData(form);
    const checked = data.getAll('show').filter((value): value is Panel => panels.includes(value as Panel));
    if (!checked.length) {
      const previous = form.querySelector<HTMLInputElement>(`input[name="show"][value="${options.show[0]}"]`)!;
      previous.checked = true;
      root.querySelector<HTMLElement>('[data-os-show-note]')!.textContent = 'Keep at least one panel on your stream.';
    } else {
      options.show = checked;
      root.querySelector<HTMLElement>('[data-os-show-note]')!.textContent = '';
    }
    const parsed = parseOverlayOptions(new URLSearchParams([...data].filter(([key]) => key !== 'show').map(([key, value]) => [key, String(value)])).toString());
    Object.assign(options, parsed, { show: options.show });
    sourceMode = data.get('source') === 'tight' ? 'tight' : 'canvas';
    canvas = canvases.find(item => item.value === data.get('canvas')) || canvas;
    render();
  };
  const copy = async () => {
    const sequence = ++copySequence;
    const url = urlInput.value;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      if (!disposed && sequence === copySequence) status.textContent = 'URL copied. Your wheel is ready for OBS.';
    } catch {
      if (disposed || sequence !== copySequence) return;
      urlInput.focus();
      urlInput.select();
      let copied = false;
      try { copied = typeof document.execCommand === 'function' && document.execCommand('copy'); } catch { /* Keep the URL selected for a manual copy. */ }
      status.textContent = copied ? 'URL copied. Your wheel is ready for OBS.' : 'URL selected — press Ctrl+C (⌘C on Mac) to copy.';
    }
  };
  const rangeInput = (event: Event) => { if (['scale', 'opacity'].includes((event.target as HTMLInputElement).name)) update(); };
  form.addEventListener('change', update);
  form.addEventListener('input', rangeInput);
  const onCopy = () => { void copy(); };
  copyButton.addEventListener('click', onCopy);
  window.addEventListener('resize', sizePreview);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(sizePreview) : undefined;
  observer?.observe(stage);
  render();
  return () => {
    disposed = true;
    copySequence++;
    observer?.disconnect();
    window.removeEventListener('resize', sizePreview);
    form.removeEventListener('change', update);
    form.removeEventListener('input', rangeInput);
    copyButton.removeEventListener('click', onCopy);
    iframe.src = 'about:blank';
    document.body.classList.remove('os-body');
    document.title = previousTitle;
    root.innerHTML = '';
  };
}
