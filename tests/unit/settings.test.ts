import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PAPER,
  DEFAULT_PRINT_SETTINGS,
  LIMITS,
  PAPER_SIZES,
  parsePrintSettings,
  resolvePaperSize,
  resolvePaperSizeOriented,
} from '../../src/shared/settings';

describe('configurações iniciais', () => {
  it('respeita os padrões aprovados', () => {
    expect(DEFAULT_PRINT_SETTINGS).toEqual({
      paperSize: 'A4',
      customWidthMm: 210,
      customHeightMm: 297,
      orientation: 'portrait',
      marginMm: 10,
      scale: 1,
      printBackground: true,
      displayHeaderFooter: false,
    });
  });

  it('impede alteração acidental dos padrões', () => {
    expect(Object.isFrozen(DEFAULT_PRINT_SETTINGS)).toBe(true);
  });
});

describe('tamanhos de papel', () => {
  it('cobre o conjunto aprovado com as medidas corretas', () => {
    expect(PAPER_SIZES.map((paper) => paper.id)).toEqual(['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid']);
    const byId = new Map(PAPER_SIZES.map((paper) => [paper.id, paper]));
    expect(byId.get('A4')).toMatchObject({ widthMm: 210, heightMm: 297 });
    expect(byId.get('A3')).toMatchObject({ widthMm: 297, heightMm: 420 });
    expect(byId.get('A5')).toMatchObject({ widthMm: 148, heightMm: 210 });
    expect(byId.get('Letter')).toMatchObject({ widthMm: 215.9, heightMm: 279.4 });
    expect(byId.get('Legal')).toMatchObject({ widthMm: 215.9, heightMm: 355.6 });
    expect(byId.get('Tabloid')).toMatchObject({ widthMm: 279.4, heightMm: 431.8 });
  });

  it('usa as medidas do papel escolhido', () => {
    expect(resolvePaperSize({ ...DEFAULT_PRINT_SETTINGS, paperSize: 'A3' })).toEqual({ widthMm: 297, heightMm: 420 });
    expect(resolvePaperSize({ ...DEFAULT_PRINT_SETTINGS, paperSize: 'A5' })).toEqual({ widthMm: 148, heightMm: 210 });
  });

  it('mantém as medidas em retrato e troca só na versão orientada', () => {
    const landscape = { ...DEFAULT_PRINT_SETTINGS, paperSize: 'A4' as const, orientation: 'landscape' as const };
    expect(resolvePaperSize(landscape)).toEqual({ widthMm: 210, heightMm: 297 });
    expect(resolvePaperSizeOriented(landscape)).toEqual({ widthMm: 297, heightMm: 210 });
    expect(resolvePaperSizeOriented(DEFAULT_PRINT_SETTINGS)).toEqual({ widthMm: 210, heightMm: 297 });
  });

  it('usa as medidas personalizadas quando o papel é personalizado', () => {
    const settings = { ...DEFAULT_PRINT_SETTINGS, paperSize: 'Custom' as const, customWidthMm: 120, customHeightMm: 400 };
    expect(resolvePaperSize(settings)).toEqual({ widthMm: 120, heightMm: 400 });
  });

  it('usa A4 como fallback para um papel desconhecido', () => {
    const settings = { ...DEFAULT_PRINT_SETTINGS, paperSize: 'Inexistente' as never };
    expect(resolvePaperSize(settings)).toEqual({ widthMm: 210, heightMm: 297 });
  });

  it('mantém o papel personalizado com os limites declarados', () => {
    expect(CUSTOM_PAPER.id).toBe('Custom');
    expect(LIMITS.minCustomMm).toBeLessThan(210);
  });
});

describe('parsePrintSettings', () => {
  const valid = { ...DEFAULT_PRINT_SETTINGS };

  it('aceita as configurações completas', () => {
    expect(parsePrintSettings(valid)).toEqual(valid);
  });

  it('aceita papel de página inteira', () => {
    expect(parsePrintSettings({ ...valid, paperSize: 'FullPage' })?.paperSize).toBe('FullPage');
  });

  it('recusa papel desconhecido', () => {
    expect(parsePrintSettings({ ...valid, paperSize: 'B7' })).toBeNull();
  });

  it('recusa orientação inválida', () => {
    expect(parsePrintSettings({ ...valid, orientation: 'diagonal' })).toBeNull();
  });

  it('recusa margem fora do intervalo', () => {
    expect(parsePrintSettings({ ...valid, marginMm: -1 })).toBeNull();
    expect(parsePrintSettings({ ...valid, marginMm: LIMITS.maxMarginMm + 1 })).toBeNull();
  });

  it('recusa escala fora do intervalo', () => {
    expect(parsePrintSettings({ ...valid, scale: 0.05 })).toBeNull();
    expect(parsePrintSettings({ ...valid, scale: 2.5 })).toBeNull();
  });

  it('recusa medidas personalizadas fora do intervalo', () => {
    expect(parsePrintSettings({ ...valid, customWidthMm: 5 })).toBeNull();
    expect(parsePrintSettings({ ...valid, customHeightMm: 5000 })).toBeNull();
  });

  it('recusa valores ausentes ou de tipos errados', () => {
    expect(parsePrintSettings(undefined)).toBeNull();
    expect(parsePrintSettings(null)).toBeNull();
    expect(parsePrintSettings({ ...valid, printBackground: 'sim' })).toBeNull();
    expect(parsePrintSettings({ ...valid, marginMm: Number.NaN })).toBeNull();
  });
});
