import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, 'WHITEPAPER.md');
const publicDir = path.join(rootDir, 'public');
const markdownOutput = path.join(publicDir, 'WHITEPAPER.md');
const htmlOutput = path.join(publicDir, 'whitepaper-full.html');
const docxOutput = path.join(publicDir, 'DrawTheChart_Whitepaper_v1.1.docx');
const legacyHtmlOutput = path.join(publicDir, 'whitepaper.html');

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function applyInlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html;
}

function flushParagraph(lines, parts) {
  if (lines.length === 0) return;
  parts.push(`<p>${applyInlineMarkdown(lines.join(' '))}</p>`);
  lines.length = 0;
}

function flushList(kind, items, parts) {
  if (!kind || items.length === 0) return;
  parts.push(`<${kind}>${items.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join('')}</${kind}>`);
  items.length = 0;
}

function flushTable(rows, parts) {
  if (rows.length === 0) return;

  const cleaned = rows
    .map((row) => row.trim())
    .filter((row) => row.startsWith('|') && row.endsWith('|'))
    .map((row) => row.slice(1, -1).split('|').map((cell) => cell.trim()));

  if (cleaned.length === 0) return;

  const [header, ...bodyRows] = cleaned;
  const filteredBody = bodyRows.filter(
    (row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)),
  );

  parts.push(
    `<table><thead><tr>${header
      .map((cell) => `<th>${applyInlineMarkdown(cell)}</th>`)
      .join('')}</tr></thead><tbody>${filteredBody
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${applyInlineMarkdown(cell)}</td>`).join('')}</tr>`,
      )
      .join('')}</tbody></table>`,
  );
}

function markdownToHtml(markdown) {
  const parts = [];
  const paragraph = [];
  const listItems = [];
  const tableRows = [];
  let listKind = null;

  const closeOpenBlocks = () => {
    flushParagraph(paragraph, parts);
    flushList(listKind, listItems, parts);
    listKind = null;
    flushTable(tableRows, parts);
    tableRows.length = 0;
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      closeOpenBlocks();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      closeOpenBlocks();
      const level = headingMatch[1].length;
      parts.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph(paragraph, parts);
      flushList(listKind, listItems, parts);
      listKind = null;
      tableRows.push(trimmed);
      continue;
    }

    const orderedMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (orderedMatch) {
      flushParagraph(paragraph, parts);
      flushTable(tableRows, parts);
      tableRows.length = 0;
      if (listKind && listKind !== 'ol') {
        flushList(listKind, listItems, parts);
      }
      listKind = 'ol';
      listItems.push(orderedMatch[1]);
      continue;
    }

    const bulletMatch = /^-\s+(.+)$/.exec(trimmed);
    if (bulletMatch) {
      flushParagraph(paragraph, parts);
      flushTable(tableRows, parts);
      tableRows.length = 0;
      if (listKind && listKind !== 'ul') {
        flushList(listKind, listItems, parts);
      }
      listKind = 'ul';
      listItems.push(bulletMatch[1]);
      continue;
    }

    flushList(listKind, listItems, parts);
    listKind = null;
    flushTable(tableRows, parts);
    tableRows.length = 0;
    paragraph.push(trimmed);
  }

  closeOpenBlocks();
  return parts.join('\n');
}

function buildHtmlDocument(body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Draw The Chart Whitepaper</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1d1a17;
      --muted: #635d54;
      --accent: #b96c2f;
      --rule: #ddd5c8;
      --page: #fbf8f1;
      --panel: #f4eee2;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--page);
      color: var(--ink);
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
      line-height: 1.6;
    }
    main {
      max-width: 900px;
      margin: 0 auto;
      padding: 56px 40px 80px;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif;
      line-height: 1.1;
      letter-spacing: -0.02em;
      margin: 1.35em 0 0.55em;
      color: #15120f;
    }
    h1 { font-size: 2.9rem; margin-top: 0; }
    h2 {
      font-size: 1.7rem;
      padding-top: 1.1rem;
      border-top: 1px solid var(--rule);
      margin-top: 2.2rem;
    }
    h3 { font-size: 1.15rem; color: var(--accent); }
    p, ul, ol, table { margin: 0 0 1rem; }
    ul, ol { padding-left: 1.4rem; }
    li { margin: 0.22rem 0; }
    a { color: var(--accent); text-decoration: none; }
    code {
      font-family: "SF Mono", "IBM Plex Mono", "Menlo", monospace;
      font-size: 0.92em;
      background: var(--panel);
      padding: 0.12rem 0.3rem;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.96rem;
      background: rgba(255,255,255,0.45);
    }
    th, td {
      text-align: left;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--rule);
      vertical-align: top;
    }
    th {
      font-family: "Avenir Next", "Helvetica Neue", Arial, sans-serif;
      font-size: 0.82rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      background: rgba(185, 108, 47, 0.08);
    }
    @media print {
      body { background: white; }
      main { padding: 0; max-width: none; }
      h2 { break-after: avoid; }
      table, ul, ol, p { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
${body}
  </main>
</body>
</html>`;
}

async function main() {
  const markdown = await fs.readFile(sourcePath, 'utf8');
  const body = markdownToHtml(markdown);
  const html = buildHtmlDocument(body);

  await fs.mkdir(publicDir, { recursive: true });
  await fs.rm(legacyHtmlOutput, { force: true });
  await fs.writeFile(markdownOutput, markdown, 'utf8');
  await fs.writeFile(htmlOutput, html, 'utf8');

  const result = spawnSync('textutil', ['-convert', 'docx', htmlOutput, '-output', docxOutput], {
    stdio: 'pipe',
  });

  if (result.error || result.status !== 0) {
    console.warn('Whitepaper DOCX export skipped or failed.');
    if (result.stderr?.length) {
      console.warn(result.stderr.toString('utf8').trim());
    }
  } else {
    console.log(`Exported ${path.relative(rootDir, docxOutput)}`);
  }

  console.log(`Exported ${path.relative(rootDir, markdownOutput)}`);
  console.log(`Exported ${path.relative(rootDir, htmlOutput)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
