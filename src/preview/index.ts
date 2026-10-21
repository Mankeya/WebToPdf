import { DEFAULT_PRINT_SETTINGS } from '../shared/settings';
import { parseSourceTabId } from '../shared/preview-url';
import './styles.css';

const settings = DEFAULT_PRINT_SETTINGS;
const setValue = (selector: string, value: string): void => {
  const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
  if (input) input.value = value;
};

setValue('#paper-size', settings.paperSize);
setValue('#orientation', settings.orientation);
setValue('#margin', String(settings.marginMm));
setValue('#scale', String(settings.scale * 100));

const backgrounds = document.querySelector<HTMLInputElement>('#backgrounds');
const headerFooter = document.querySelector<HTMLInputElement>('#header-footer');
if (backgrounds) backgrounds.checked = settings.printBackground;
if (headerFooter) headerFooter.checked = settings.displayHeaderFooter;

const status = document.querySelector<HTMLElement>('#status');
const params = new URLSearchParams(location.search);
if (status && params.get('error') === 'unsupported-page') {
  status.textContent = 'Página não compatível. Use a extensão em uma aba HTTP ou HTTPS. A conversão ainda está em desenvolvimento.';
} else if (status && parseSourceTabId(location.search) === null) {
  status.textContent = 'Abra esta tela pelo ícone da extensão em uma página HTTP ou HTTPS. A conversão ainda está em desenvolvimento.';
}
