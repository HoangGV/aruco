import JSZip from 'jszip';
import type { ClassItem, AppData } from '../types';

export const esc = (s: any) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c] || c));

export const downloadBlob = (filename: string, blob: Blob) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

export const downloadText = (filename: string, text: string, mimeType = 'text/plain;charset=utf-8') => {
  downloadBlob(filename, new Blob([text], { type: mimeType }));
};

const colN = (n: number) => {
  let s = '';
  for (n++; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
};

const cell = (v: any, r: number, c: number) =>
  typeof v === 'number'
    ? `<c r="${colN(c)}${r}"><v>${v}</v></c>`
    : `<c r="${colN(c)}${r}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;

const sheetXml = (rows: any[][]) =>
  `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows
    .map(
      (r, i) =>
        `<row r="${i + 1}">${r
          .map((v, c) => (v === '' || v == null ? '' : cell(v, i + 1, c)))
          .join('')}</row>`
    )
    .join('')}</sheetData></worksheet>`;

export const getStudentList = (c: ClassItem): string[] =>
  (c.names || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

export async function exportToXlsx(classes: ClassItem[], teacher = '') {
  const fmt = (t: number) => new Date(t).toLocaleString('vi-VN');
  const sh: [string, any[][]][] = [
    [
      'Thông tin',
      [
        ['Giáo viên', teacher || ''],
        ['Ngày xuất', fmt(Date.now())],
        [],
        ['Lớp', 'Môn học', 'Số học sinh'],
        ...classes.map(c => [c.name, c.subject || '', getStudentList(c).length])
      ]
    ]
  ];

  for (const c of classes) {
    const ns = getStudentList(c);
    const rs = c.results || [];
    sh.push([
      c.name,
      [
        ['Giáo viên', teacher || ''],
        ['Môn học', c.subject || ''],
        ['Lớp', c.name],
        [],
        ['Số thẻ', 'Học sinh', ...rs.map(r => fmt(r.at) + ' (' + r.total + ' câu)')],
        ...ns.map((n, i) => [
          i + 1,
          n,
          ...rs.map(r => {
            const x = r.rows.find(row => row.id === i + 1);
            return x ? x.score : '';
          })
        ])
      ]
    ]);
  }

  const used = new Set<string>();
  const zip = new JSZip();
  const names = sh.map(([n]) => {
    const b = n.replace(/[\\/?*[\]:]/g, '_').slice(0, 28) || 'Lop';
    let k = b;
    let i = 1;
    while (used.has(k.toLowerCase())) {
      k = b + '_' + ++i;
    }
    used.add(k.toLowerCase());
    return k;
  });

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sh
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join('')}</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
      .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sh
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join('')}</Relationships>`
  );

  sh.forEach(([, rows], i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(rows)));

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  downloadBlob('NDH-ket-qua.xlsx', blob);
}
