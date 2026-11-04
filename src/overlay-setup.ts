import './overlay-setup.css';

type Panel = 'status' | 'boss' | 'board';
export type OverlaySetupOptions = {
  layout: 'bar' | 'card';
  scale: number;
  show: Panel[];
  bg: 'transparent' | 'dark';
};

const panels: Panel[] = ['status', 'boss', 'board'];

/** Always uses this app's origin; the copied source never points to an external preview. */
export function buildOverlayUrl(origin: string, options: OverlaySetupOptions): string {
  const url = new URL('/overlay', origin);
  url.searchParams.set('layout', options.layout);
  url.searchParams.set('scale', String(options.scale));
  url.searchParams.set('show', options.show.join(','));
  url.searchParams.set('bg', options.bg);
  return url.href;
}

function initialOptions(): OverlaySetupOptions {
  const query = new URLSearchParams(window.location.search);
  const scale = Number(query.get('scale') || 1);
  const requested = query.has('show') ? query.get('show')!.split(',') : panels;
  const show = panels.filter(panel => requested.includes(panel));
  return {
    layout: query.get('layout') === 'card' ? 'card' : 'bar',
    scale: Number.isFinite(scale) ? Math.min(2, Math.max(0.5, scale)) : 1,
    show: show.length ? show : [...panels],
    bg: query.get('bg') === 'dark' ? 'dark' : 'transparent',
  };
}

const wheel = `<svg viewBox="0 0 40 40" fill="none" shape-rendering="crispEdges" aria-hidden="true"><path d="M12 2h16v4h6v6h4v16h-4v6h-6v4H12v-4H6v-6H2V12h4V6h6V2Z" stroke="currentColor" stroke-width="2"/><path d="M8 28h24M20 5v8M7 14l8 4m18-4-8 4" stroke="currentColor" stroke-width="2"/><path fill="#e4c18e" d="M13 15h5v3h5v-3h5v12H13z"/><path fill="#fff0d5" d="M16 24h9v5h-9z"/><path fill="#171121" d="M16 20h2v3h-2zm8 0h2v3h-2z"/><path fill="#e5a1af" d="M20 24h3v2h-3z"/></svg>`;

/** Standalone OBS setup page. It intentionally boots no game, music, or wallet code. */
export function mountOverlaySetup(root: HTMLElement = document.querySelector<HTMLDivElement>('#app')!): () => void {
  if (!root) return () => {};
  const previousTitle = document.title;
  document.title = 'Stream overlay setup · Squeekspire';
  document.body.classList.add('os-body');
  const options = initialOptions();
  let disposed = false;
  root.innerHTML = `<div class="os-page">
    <header class="os-header"><a class="os-brand" href="/" aria-label="Squeekspire home"><span>${wheel}</span><strong>SQUEEK<span>SPIRE</span></strong></a><a class="os-back" href="/leaderboard">Leaderboard <span aria-hidden="true">↗</span></a></header>
    <main class="os-main">
      <section class="os-hero"><div><p class="os-eyebrow"><i></i> THE WHEEL, ON AIR</p><h1>Bring the wheel<br>to your <em>stream.</em></h1><p class="os-intro">One tiny overlay. Live hamster energy, today’s challenge,<br class="os-wide-break"> and the climbers chasing the crown.</p></div><div class="os-hero-badge"><span>${wheel}</span><div><strong>BUILT FOR OBS</strong><small>READ-ONLY · NO WALLET</small></div></div></section>
      <div class="os-workbench">
        <section class="os-config" aria-labelledby="os-config-title"><div class="os-section-heading"><span class="os-step">01</span><div><p class="os-eyebrow">MAKE IT YOURS</p><h2 id="os-config-title">Configure your overlay</h2></div></div>
          <form data-os-form>
            <fieldset class="os-fieldset"><legend>LAYOUT</legend><div class="os-layouts"><label><input type="radio" name="layout" value="bar" ${options.layout === 'bar' ? 'checked' : ''}><span class="os-layout-choice"><i class="os-layout-icon os-icon-bar" aria-hidden="true"><b></b><b></b><b></b></i><strong>Bar</strong><small>Across your scene</small></span></label><label><input type="radio" name="layout" value="card" ${options.layout === 'card' ? 'checked' : ''}><span class="os-layout-choice"><i class="os-layout-icon os-icon-card" aria-hidden="true"><b></b><b></b><b></b></i><strong>Card</strong><small>In your corner</small></span></label></div></fieldset>
            <div class="os-scale-row"><label for="os-scale">SCALE</label><output for="os-scale" data-os-scale-label>${options.scale}×</output></div><input id="os-scale" class="os-range" type="range" name="scale" min="0.5" max="2" step="0.05" value="${options.scale}"><div class="os-range-labels"><span>0.5×</span><span>2×</span></div>
            <fieldset class="os-fieldset os-show"><legend>ON YOUR STREAM</legend>${(['status', 'boss', 'board'] as Panel[]).map((panel, i) => `<label><input type="checkbox" name="show" value="${panel}" ${options.show.includes(panel) ? 'checked' : ''}><span class="os-check" aria-hidden="true"></span><span>${['Live hamster status', 'Daily boss & map', 'Today’s top climbers'][i]}</span></label>`).join('')}<p data-os-show-note class="os-show-note" aria-live="polite"></p></fieldset>
            <fieldset class="os-fieldset"><legend>BACKGROUND</legend><div class="os-bg-switch"><label><input type="radio" name="bg" value="transparent" ${options.bg === 'transparent' ? 'checked' : ''}><span><i class="os-transparent-swatch" aria-hidden="true"></i>Transparent</span></label><label><input type="radio" name="bg" value="dark" ${options.bg === 'dark' ? 'checked' : ''}><span><i class="os-dark-swatch" aria-hidden="true"></i>Dark</span></label></div></fieldset>
          </form>
        </section>
        <section class="os-preview-panel" aria-labelledby="os-preview-title"><div class="os-preview-heading"><div><span class="os-live-dot"></span><h2 id="os-preview-title">Live preview</h2></div><span data-os-size>1200 × 260 PX</span></div><div class="os-preview-stage" data-os-stage><span class="os-stage-label">YOUR SCENE / TRANSPARENCY PREVIEW</span><div class="os-scene" aria-hidden="true"><div class="os-moon"></div><div class="os-mountain os-mountain-back"></div><div class="os-mountain os-mountain-front"></div><div class="os-ground"></div><span class="os-scene-hud">FLOOR 03 <i>■■■□□</i></span></div><div class="os-frame-position"><iframe title="Live Squeekspire overlay preview" data-os-preview loading="eager" referrerpolicy="same-origin" tabindex="-1"></iframe></div><span class="os-stage-corner" aria-hidden="true">+</span></div><p class="os-preview-caption"><span>LIVE DATA · REFRESHES ABOUT EVERY 15 SECONDS</span><span>Preview fitted to this window</span></p>
          <div class="os-url-block"><label for="os-url">YOUR BROWSER SOURCE URL</label><div class="os-url-row"><input id="os-url" data-os-url type="url" readonly spellcheck="false" aria-describedby="os-copy-status"><button type="button" data-os-copy><span aria-hidden="true">▣</span> Copy URL</button></div><div class="os-url-foot"><p id="os-copy-status" data-os-copy-status role="status" aria-live="polite">Ready to paste into OBS.</p><a data-os-open target="_blank" rel="noopener noreferrer">Open overlay <span aria-hidden="true">↗</span></a></div></div>
        </section>
      </div>
      <section class="os-instructions" aria-labelledby="os-instructions-title"><div class="os-section-heading"><span class="os-step">02</span><div><p class="os-eyebrow">THREE LITTLE STEPS</p><h2 id="os-instructions-title">Put it on air</h2></div></div><ol><li><span>1</span><div><h3>Add a Browser Source</h3><p>In OBS, open <strong>Sources → + → Browser</strong>. Give your overlay a name.</p></div></li><li><span>2</span><div><h3>Paste your URL</h3><p>Use the URL above. Set width to <strong data-os-width>1200</strong> and height to <strong data-os-height>260</strong>. Keep “Local file” off.</p></div></li><li><span>3</span><div><h3>Find its happy place</h3><p>Position it over your game. Transparency works automatically; no custom CSS needed.</p></div></li></ol></section>
      <footer class="os-footer"><span><i></i> A LITTLE LIVE ENERGY FOR YOUR SCENE</span><p>Daily challenge & rankings reset at 00:00 UTC. If an API takes a nap, the overlay recovers automatically.</p><a href="/leaderboard">Meet today’s climbers <span aria-hidden="true">↗</span></a></footer>
    </main>
  </div>`;

  const form = root.querySelector<HTMLFormElement>('[data-os-form]')!;
  const iframe = root.querySelector<HTMLIFrameElement>('[data-os-preview]')!;
  const stage = root.querySelector<HTMLElement>('[data-os-stage]')!;
  const urlInput = root.querySelector<HTMLInputElement>('[data-os-url]')!;
  const status = root.querySelector<HTMLElement>('[data-os-copy-status]')!;
  const copyButton = root.querySelector<HTMLButtonElement>('[data-os-copy]')!;
  let sourceWidth = 1200;
  let sourceHeight = 260;
  let copySequence = 0;
  const sizePreview = () => {
    const availableWidth = Math.max(100, stage.clientWidth - 40);
    const availableHeight = options.layout === 'card' ? 390 : 260;
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
    sourceWidth = Math.ceil((options.layout === 'bar' ? 1200 : 440) * options.scale);
    sourceHeight = Math.ceil((options.layout === 'bar' ? 260 : 800) * options.scale);
    iframe.src = url;
    urlInput.value = url;
    root.querySelector<HTMLAnchorElement>('[data-os-open]')!.href = url;
    root.querySelector<HTMLElement>('[data-os-scale-label]')!.textContent = `${options.scale}×`;
    root.querySelector<HTMLElement>('[data-os-size]')!.textContent = `${sourceWidth} × ${sourceHeight} PX`;
    root.querySelector<HTMLElement>('[data-os-width]')!.textContent = String(sourceWidth);
    root.querySelector<HTMLElement>('[data-os-height]')!.textContent = String(sourceHeight);
    stage.dataset.layout = options.layout;
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
    options.layout = data.get('layout') === 'card' ? 'card' : 'bar';
    options.scale = Math.min(2, Math.max(0.5, Number(data.get('scale')) || 1));
    options.bg = data.get('bg') === 'dark' ? 'dark' : 'transparent';
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
  // Range updates feel immediate, while radio and checkbox changes retain native keyboard behavior.
  const rangeInput = (event: Event) => { if ((event.target as HTMLInputElement).name === 'scale') update(); };
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
