const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
let ready = false;

export const basicGraphics = new URL(location.href).searchParams.get('renderer') === 'canvas';

export function loadingProgress(progress: number) {
  if (ready) return;
  const status = document.querySelector('#loading-status');
  if (status) status.textContent = `Loading artwork… ${Math.round(progress * 100)}%`;
}

export function startupComplete() { ready = true; }

export function startupFailed(error: unknown) {
  if (ready) return;
  const message = error instanceof Error ? error.message : String(error);
  overlay.innerHTML = `<div class="panel"><div class="gold">ELOWEN’S LAST STAND</div><h2>The game couldn’t start.</h2><p>Try basic graphics, or reload the page to retry.</p><p id="startup-error"></p><button class="primary" id="retry-loading">RELOAD</button><a class="primary" id="basic-graphics">USE BASIC GRAPHICS</a></div>`;
  document.querySelector('#startup-error')!.textContent = message;
  document.querySelector('#retry-loading')!.addEventListener('click', () => location.reload());
  const fallback = new URL(location.href);
  fallback.searchParams.set('renderer', 'canvas');
  (document.querySelector('#basic-graphics') as HTMLAnchorElement).href = fallback.href;
}

window.addEventListener('error', event => startupFailed(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => startupFailed(event.reason));
