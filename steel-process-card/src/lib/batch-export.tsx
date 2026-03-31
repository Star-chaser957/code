import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import type { OperationDefinition, ProcessCardPayload } from '../../shared/types';
import { PrintTemplate } from '../components/PrintTemplate';

type ExportOptions = {
  cards: ProcessCardPayload[];
  definitions: OperationDefinition[];
  onProgress?: (current: number, total: number, card: ProcessCardPayload) => void;
};

const logoUrl = '/logo.png';

const waitForFonts = async () => {
  if ('fonts' in document) {
    await document.fonts.ready;
  }
};

const waitForPaint = async () => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const waitForImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete) {
        return;
      }

      await new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
};

const readBlobAsDataUrl = async (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const getLogoDataUrl = async () => {
  const response = await fetch(logoUrl);
  if (!response.ok) {
    throw new Error('无法读取导出所需的 logo 图片。');
  }

  return readBlobAsDataUrl(await response.blob());
};

const sanitizeFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

const buildPdfFileName = (card: ProcessCardPayload, index: number) => {
  const base = sanitizeFileName(
    [card.planNumber, card.productName, card.specification].filter(Boolean).join('-'),
  );
  return `${base || `工艺卡-${index + 1}`}.pdf`;
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export async function exportProcessCardsZip({
  cards,
  definitions,
  onProgress,
}: ExportOptions) {
  const host = document.createElement('div');
  host.className = 'batch-export-host';
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = '210mm';
  host.style.background = '#ffffff';
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  const root = createRoot(host);
  const zip = new JSZip();

  try {
    await waitForFonts();
    const logoSrc = await getLogoDataUrl();

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      onProgress?.(index + 1, cards.length, card);

      root.render(<PrintTemplate card={card} definitions={definitions} logoSrc={logoSrc} />);
      await waitForPaint();
      await waitForFonts();
      await waitForImages(host);

      const page = host.querySelector('.print-page') as HTMLElement | null;
      if (!page) {
        throw new Error('打印模板渲染失败，无法导出 PDF。');
      }

      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        foreignObjectRendering: true,
        backgroundColor: '#ffffff',
        width: page.scrollWidth,
        height: page.scrollHeight,
        windowWidth: page.scrollWidth,
        windowHeight: page.scrollHeight,
        onclone: (_document, clonedPage) => {
          clonedPage.classList.add('print-page--export');
        },
      });

      const imageData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      pdf.addImage(imageData, 'PNG', 0, 0, 210, 297);
      zip.file(buildPdfFileName(card, index), pdf.output('arraybuffer'));
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const timestamp = new Date().toISOString().slice(0, 10);
    triggerDownload(zipBlob, `工艺卡批量导出-${timestamp}.zip`);
  } finally {
    root.unmount();
    host.remove();
  }
}
