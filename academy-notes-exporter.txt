/* Academy Notes Exporter — browser-based learning notes for Obsidian.
 * Run on a signed-in HTTPS lesson page using the documented API v2 contract.
 * Choose the vault root; notes go under Notes/<notebook>.
 * Only accessible content is read; access restrictions are not bypassed.
 */
(() => {
  'use strict';
  if (location.protocol !== 'https:') { alert('Open a signed-in HTTPS lesson page first.'); return; }
  window.__academyObsidianExporter?.remove?.();
  const moduleId = Number(location.pathname.match(/\/app\/module\/(\d+)/)?.[1]) || null;
  let PATH_ID = null;
  const panel = document.createElement('div');
  panel.id = 'academy-obsidian-exporter';
  panel.style.cssText = 'position:fixed;right:20px;top:20px;z-index:2147483647;width:340px;max-height:85vh;overflow:auto;padding:16px;background:#20252d;color:#fff;border:1px solid #9fef00;border-radius:10px;box-shadow:0 8px 30px #0008;font:14px system-ui,sans-serif';
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>Academy → Obsidian</strong><button id="academy-close" type="button" aria-label="Close">×</button></div><p>Export accessible lessons with inline walkthroughs.</p><label>Learning path ID<input id="academy-path" type="number" min="1" style="display:block;width:100%;box-sizing:border-box"></label><label>Notebook folder (under Notes)<input id="academy-folder" value="Academy" style="display:block;width:100%;box-sizing:border-box"></label><label>Asset origin (optional; auto-detected when possible)<input id="academy-assets" placeholder="Paste an image URL or asset origin" style="display:block;width:100%;box-sizing:border-box"></label><label><input id="academy-overwrite" type="checkbox"> Replace existing lesson notes</label><br><button id="academy-export" type="button">Export this module</button><br><button id="academy-export-path" type="button">Export unlocked path modules</button><div id="academy-status" role="status" style="margin-top:10px;white-space:pre-wrap">Ready. Enter the path ID and choose your vault root when prompted.</div>`;
  document.body.appendChild(panel);
  window.__academyObsidianExporter = panel;
  const $ = id => panel.querySelector('#' + id);
  const status = message => { $('academy-status').textContent = message; };
  $('academy-close').onclick = () => panel.remove();
  $('academy-export').disabled = !moduleId;
  const safeName = value => String(value || 'Untitled').replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled';
  const yaml = value => JSON.stringify(String(value ?? ''));
  const unwrap = json => json?.data ?? json;
  const request = async path => {
    const response = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('json')) throw new Error(`${path}: non-JSON response; check your Academy login`);
    return unwrap(await response.json());
  };
  const inline = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const body = [...node.childNodes].map(inline).join('');
    if (tag === 'a') return `[${body}](${node.getAttribute('href') || ''})`;
    if (tag === 'code') { const ticks = '`'.repeat(Math.max(1, ...[...body.matchAll(/`+/g)].map(m => m[0].length + 1))); return ticks + (body.includes('`') ? ' ' : '') + body + (body.includes('`') ? ' ' : '') + ticks; }
    if (tag === 'strong' || tag === 'b') return `**${body}**`;
    if (tag === 'em' || tag === 'i') return `*${body}*`;
    if (tag === 'br') return '<br>';
    if (tag === 'img') return `![${(node.getAttribute('alt') || 'Image').replace(/\]/g, '\\]')}](${node.getAttribute('src') || ''})`;
    return body;
  };
  const htmlToMarkdown = html => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style').forEach(node => node.remove());
    const render = node => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim();
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) return '#'.repeat(Math.min(6, Number(tag[1]) + 1)) + ' ' + inline(node).trim();
      if (tag === 'p' || tag === 'img') return inline(node).trim();
      if (tag === 'pre') { const body = node.textContent.replace(/^\n|\n$/g, ''); const fence = '`'.repeat(Math.max(3, ...[...body.matchAll(/`+/g)].map(m => m[0].length + 1))); return fence + ((node.className + ' ' + (node.querySelector('code')?.className || '')).match(/language-([\w-]+)/)?.[1] || '') + '\n' + body + '\n' + fence; }
      if (tag === 'hr') return '---';
      if (tag === 'ul' || tag === 'ol') return [...node.children].filter(li => li.tagName === 'LI').map((li, i) => {
        const marker = tag === 'ol' ? `${i + 1}. ` : '- ';
        const content = [...li.childNodes].map(child => /^(UL|OL|PRE|P)$/.test(child.nodeName) ? '\n' + render(child) : inline(child)).join('').trim();
        return marker + content.replace(/\n/g, '\n' + ' '.repeat(marker.length));
      }).join('\n');
      if (tag === 'table') {
        const rows = [...node.querySelectorAll('tr')].map(tr => [...tr.children].map(cell => inline(cell).trim().replace(/\|/g, '\\|').replace(/\n/g, '<br>')));
        return rows.length ? '| ' + rows[0].join(' | ') + ' |\n| ' + rows[0].map(() => '---').join(' | ') + ' |\n' + rows.slice(1).map(row => '| ' + row.join(' | ') + ' |').join('\n') : '';
      }
      if (tag === 'blockquote') return [...node.childNodes].map(render).filter(Boolean).join('\n\n').split('\n').map(line => '> ' + line).join('\n');
      return [...node.childNodes].map(render).filter(Boolean).join('\n\n');
    };
    return [...doc.body.childNodes].map(render).filter(Boolean).join('\n\n');
  };
  const maskCode = markdown => {
    const masked = markdown.split('');
    const hide = (start, end) => { for (let n = start; n < end; n++) if (markdown[n] !== '\n') masked[n] = ' '; };
    let offset = 0, fence = null;
    for (const line of markdown.match(/[^\n]*(?:\n|$)/g) || []) {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fence) {
        hide(offset, offset + line.length);
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && line.slice(marker[0].length).trim() === '') fence = null;
      } else if (marker) { fence = marker[1]; hide(offset, offset + line.length); }
      offset += line.length;
    }
    const searchable = masked.join('');
    // Backtick code spans cannot cross a blank-line paragraph boundary. An
    // unmatched backtick in Academy prose must not hide images in later paragraphs.
    for (const paragraph of searchable.matchAll(/[\s\S]+?(?:\n[ \t]*\n|$)/g)) {
      const ticks = [...paragraph[0].matchAll(/`+/g)];
      for (let t = 0; t < ticks.length; t++) {
        const open = ticks[t];
        let backslashes = 0;
        for (let k = open.index - 1; k >= 0 && paragraph[0][k] === '\\'; k--) backslashes++;
        if (backslashes % 2) continue;
        const closeIndex = ticks.findIndex((candidate, index) => index > t && candidate[0].length === open[0].length);
        if (closeIndex < 0) continue;
        const close = ticks[closeIndex];
        hide(paragraph.index + open.index, paragraph.index + close.index + close[0].length);
        t = closeIndex;
      }
    }
    return masked.join('');
  };
  const asMarkdown = value => {
    if (typeof value !== 'string') return '';
    if (/^\s*<(?:p|div|h[1-6]|table|pre|ul|ol|blockquote)\b/i.test(value)) return htmlToMarkdown(value);
    const searchable = maskCode(value);
    return value.replace(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, (markup, offset) => {
      if (searchable[offset] !== '<') return markup;
      const img = new DOMParser().parseFromString(markup, 'text/html').querySelector('img');
      return img ? inline(img) : markup;
    });
  };
  let assetOrigin = '';
  const detectAssetOrigin = () => {
    for (const img of document.images) {
      try { const u = new URL(img.currentSrc || img.src, location.origin);
        if (/^\/content\/(modules|walkthroughs)\//.test(u.pathname) && u.protocol === 'https:') return u.origin;
      } catch {}
    }
    return '';
  };
  const imageUrl = (src, id) => {
    const absolute = /^(https?:)?\/\//i.test(src) || src.startsWith('/');
    const u = new URL(src, absolute ? location.origin : (assetOrigin || location.origin) + '/content/modules/' + id + '/');
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Unsupported image protocol');
    if (assetOrigin && u.origin === location.origin && /^\/storage\/(modules|walkthroughs)\//.test(u.pathname))
      return assetOrigin + u.pathname.replace(/^\/storage\//, '/content/') + u.search;
    if (assetOrigin && src.startsWith('/content/')) return assetOrigin + u.pathname + u.search;
    return u.href;
  };
  // Parse inline Markdown labels and destinations with balanced brackets and
  // parentheses. Labels such as "[InsightNexus]" and disk "[64GB SCSI]" occur in Academy.
  const destinations = markdown => {
    const found = [];
    const searchable = maskCode(markdown);
    const escapedAt = index => {
      let slashes = 0;
      for (let k = index - 1; k >= 0 && markdown[k] === '\\'; k--) slashes++;
      return slashes % 2 === 1;
    };
    for (let start = 0; start < searchable.length; start++) {
      const image = searchable[start] === '!' && searchable[start + 1] === '[';
      if (!image && searchable[start] !== '[') continue;
      if (escapedAt(start)) continue;
      const labelStart = start + (image ? 2 : 1);
      let labelEnd = labelStart, brackets = 1;
      for (; labelEnd < searchable.length; labelEnd++) {
        if (escapedAt(labelEnd)) continue;
        if (searchable[labelEnd] === '[') brackets++;
        else if (searchable[labelEnd] === ']' && --brackets === 0) break;
      }
      if (brackets || searchable[labelEnd + 1] !== '(') continue;
      const alt = markdown.slice(labelStart, labelEnd);
      // Let the nested image be processed separately; overlapping rewrites of
      // an image wrapped in a link would corrupt the outer link.
      if (!image && alt.includes('![')) continue;
      let cursor = labelEnd + 2;
      while (/\s/.test(markdown[cursor] || '') && cursor < markdown.length) cursor++;
      const sourceStart = cursor;
      let source;
      if (markdown[cursor] === '<') {
        cursor++;
        const from = cursor;
        while (cursor < markdown.length && (markdown[cursor] !== '>' || escapedAt(cursor)) && markdown[cursor] !== '\n') cursor++;
        if (markdown[cursor] !== '>') continue;
        source = markdown.slice(from, cursor++);
      } else {
        let parens = 0;
        for (; cursor < markdown.length; cursor++) {
          if (escapedAt(cursor)) continue;
          const c = markdown[cursor];
          if (c === '(') parens++;
          else if (c === ')') { if (!parens) break; parens--; }
          else if (/\s/.test(c) && !parens) break;
        }
        if (parens) continue;
        source = markdown.slice(sourceStart, cursor);
      }
      while (/\s/.test(markdown[cursor] || '') && cursor < markdown.length) cursor++;
      if (markdown[cursor] !== ')') {
        const quote = markdown[cursor], closing = quote === '(' ? ')' : quote;
        if (!['"', "'", '('].includes(quote)) continue;
        cursor++;
        while (cursor < markdown.length && (markdown[cursor] !== closing || escapedAt(cursor))) cursor++;
        if (cursor >= markdown.length) continue;
        cursor++;
        while (/\s/.test(markdown[cursor] || '') && cursor < markdown.length) cursor++;
      }
      if (markdown[cursor] !== ')') continue;
      found.push({ start, end: cursor + 1, image, alt, source: source.replace(/\\([()[\]<>\\])/g, '$1') });
      start = cursor;
    }
    return found;
  };
  const exists = async (directory, filename) => {
    try { await directory.getFileHandle(filename); return true; }
    catch (error) { if (error.name === 'NotFoundError') return false; throw error; }
  };
  const write = async (directory, filename, content) => {
    const file = await directory.getFileHandle(filename, { create: true });
    const writer = await file.createWritable();
    try { await writer.write(content); } finally { await writer.close(); }
  };
  const localize = async (markdown, assetsDir, prefix, id, baseUrl, warnings, imageStats) => {
    const edits = [];
    let number = 0;
    const matches = destinations(markdown);
    const imageStarts = new Set(matches.filter(match => match.image).map(match => match.start));
    for (const marker of maskCode(markdown).matchAll(/!\[/g)) {
      let slashes = 0;
      for (let k = marker.index - 1; k >= 0 && markdown[k] === '\\'; k--) slashes++;
      if (!(slashes % 2) && !imageStarts.has(marker.index)) warnings.push(`${prefix}: image markup near character ${marker.index} could not be parsed; original markup was preserved`);
    }
    for (const match of matches) {
      if (!match.source || /^(data:|#|mailto:|obsidian:)/i.test(match.source)) continue;
      if (!match.image) {
        if (!/^[a-z][a-z0-9+.-]*:/i.test(match.source)) {
          try { edits.push({ ...match, value: `[${match.alt}](<${new URL(match.source, baseUrl).href}>)` }); } catch {}
        }
        continue;
      }
      number++;
      imageStats.expected++;
      let url;
      try {
        url = imageUrl(match.source, id);
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const type = (response.headers.get('content-type') || '').split(';')[0];
        if (!type.startsWith('image/')) throw new Error(`unexpected content type ${type}`);
        const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif' })[type] || 'img';
        const filename = `${prefix}-image-${String(number).padStart(2, '0')}.${extension}`;
        await write(assetsDir, filename, await response.blob());
        imageStats.saved++;
        edits.push({ ...match, value: `![${match.alt}](assets/${filename})` });
      } catch (error) {
        warnings.push(`${prefix}: Could not save image ${url || match.source}: ${error.message}`);
        if (url) edits.push({ ...match, value: `![${match.alt}](<${url}>)` });
      }
    }
    for (const edit of edits.reverse()) markdown = markdown.slice(0, edit.start) + edit.value + markdown.slice(edit.end);
    return markdown;
  };
  const WALK_START = '<!-- academy-notes-walkthrough:start -->';
  const WALK_END = '<!-- academy-notes-walkthrough:end -->';
  const REF_START = '<!-- academy-notes-walkthrough-reference:start -->';
  const REF_END = '<!-- academy-notes-walkthrough-reference:end -->';
  const FOOTER = '\n\n---\n[Module index](<00 - Module Index.md>)\n';
  const read = async (directory, filename) => (await (await directory.getFileHandle(filename)).getFile()).text();
  const managed = (text, start, end) => {
    const from = text.indexOf(start), to = text.indexOf(end, from + start.length);
    return from >= 0 && to >= 0 ? text.slice(from, to + end.length) : '';
  };
  const stripFooter = text => text.replace(/\n+---\s*\n\[Module index\]\(<00 - Module Index\.md>\)\s*$/, '').trimEnd();
  const normalizeTitle = value => {
    const doc = new DOMParser().parseFromString(String(value), 'text/html');
    return doc.body.textContent.normalize('NFKC').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  };
  const scanLines = (markdown, callback) => {
    let fence = null;
    for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      const inCode = Boolean(fence || marker);
      callback(line, inCode);
      if (fence) {
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && line.slice(marker[0].length).trim() === '') fence = null;
      } else if (marker) fence = marker[1];
    }
  };
  const shiftHeadings = markdown => {
    const lines = [];
    scanLines(markdown, (line, inCode) => {
      if (!inCode) line = line.replace(/^(#{1,6})\s+(.*)$/, (_, marks, title) => '#'.repeat(Math.min(6, Math.max(3, marks.length + 1))) + ' ' + title);
      lines.push(line);
    });
    return lines.join('\n').trim();
  };
  const splitWalkthrough = (markdown, lessons, moduleName, moduleId) => {
    const keys = new Map();
    for (const lesson of lessons) {
      for (const key of new Set([normalizeTitle(lesson.title), normalizeTitle(safeName(lesson.title))])) {
        const entries = keys.get(key) || [];
        if (!entries.includes(lesson)) entries.push(lesson);
        keys.set(key, entries);
      }
    }
    const matched = new Map(), reference = [], uncertain = [];
    let target = null, started = false;
    scanLines(stripFooter(markdown), (line, inCode) => {
      const heading = !inCode && line.match(/^(#{1,2})\s+(.*)$/);
      if (heading) {
        const headingText = heading[2];
        const key = normalizeTitle(headingText);
        const candidates = keys.get(key) || keys.get(normalizeTitle(safeName(headingText))) || [];
        if (candidates.length === 1) {
          target = candidates[0]; started = true;
          if (!matched.has(target)) matched.set(target, []);
          matched.get(target).push('');
          return;
        }
        // Some Academy walkthroughs use H1 instead of H2 for question headings.
        const isModuleHeading = key === normalizeTitle(moduleName) || key === normalizeTitle(moduleName + ' Module');
        if (heading[1].length === 1 && !/^question(?:\s|$)/i.test(key) && (started || !isModuleHeading)) {
          target = null;
          uncertain.push(headingText);
        }
        if (candidates.length > 1) { target = null; uncertain.push(headingText + ' (ambiguous lesson title)'); }
      }
      (target ? matched.get(target) : reference).push(line);
    });
    return { matched: new Map([...matched].map(([lesson, lines]) => [lesson, shiftHeadings(lines.join('\n'))])), reference: shiftHeadings(reference.join('\n')), uncertain };
  };
  const embedWalkthrough = (note, body, walkthroughId, moduleId) => {
    const prior = managed(note, WALK_START, WALK_END);
    const block = `${WALK_START}\n## Walkthrough\n\nSource: [Academy module](${location.origin}/app/module/${moduleId}) · Walkthrough ID ${walkthroughId}\n\n${body.trim()}\n${WALK_END}`;
    if (prior) return note.replace(prior, block);
    const base = stripFooter(note);
    return `${base}\n\n${block}${FOOTER}`;
  };
  const moduleFolder = (name, order) => `${String(order).padStart(2, '0')} - ${safeName(name)}`;
  const mdLink = (label, path) => `[${label.replace(/\]/g, '\\]')}](<${path}>)`;
  const exportModule = async (root, entry, order, total, overwrite, warnings) => {
    const id = Number(entry.id || entry.module_id);
    const result = { id, order, name: safeName(entry.name || entry.title || `Module ${id}`), expected: 0, written: 0, skipped: 0, missing: 0, locked: 0, walkthrough: 'not offered', walkthroughLessonsWritten: 0, walkthroughLessonsKept: 0, images: { expected: 0, saved: 0 } };
    if (entry?.state === 'locked' || entry?.is_unlocked === false) { result.locked = 1; return result; }
    let detail;
    try { detail = await request(`/api/v2/modules/${id}`); } catch (error) { result.error = error.message; warnings.push(`${result.name}: ${error.message}`); return result; }
    result.name = safeName(detail?.name || detail?.title || result.name);
    if (detail?.is_unlocked === false || detail?.state === 'locked') { result.locked = 1; return result; }
    const folder = moduleFolder(result.name, order);
    result.folder = folder;
    const directory = await root.getDirectoryHandle(folder, { create: true });
    const assets = await directory.getDirectoryHandle('assets', { create: true });
    let sections;
    try {
      const data = await request(`/api/v2/modules/${id}/sections`);
      sections = Array.isArray(data) ? data : data?.sections || data?.items || [];
      if (!Array.isArray(sections) || !sections.length) throw new Error('Section list is empty or unavailable');
    } catch (error) { result.error = error.message; warnings.push(`${result.name}: ${error.message}`); return result; }
    result.expected = sections.length;
    const lessons = [];
    const previousIndex = await exists(directory, '00 - Module Index.md') ? await read(directory, '00 - Module Index.md') : '';
    const index = [`# ${result.name}`, '', '[← Academy Export Index](<../00 - Academy Export Index.md>)', '', `Module ID: ${id}`, ''];
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionId = section.id || section.section_id;
      const number = String(i + 1).padStart(2, '0');
      const title = safeName(section.title || section.name || `Section ${sectionId || i + 1}`);
      const filename = `${number} - ${title}.md`;
      const source = `${location.origin}/app/module/${id}/section/${sectionId}`;
      if (sectionId) lessons.push({ id: sectionId, title: section.title || section.name || title, filename });
      status(`Module ${order}/${total}: ${result.name}\nSection ${i + 1}/${sections.length}: ${title}`);
      if (!sectionId) { result.missing++; warnings.push(`${result.name}: section ${i + 1} has no ID`); index.push(`- ${title} — missing section ID`); continue; }
      if (!overwrite && await exists(directory, filename)) { result.skipped++; index.push('- ' + mdLink(title, filename)); continue; }
      try {
        const item = await request(`/api/v2/sections/${sectionId}`);
        let body = asMarkdown(item?.content || item?.body || item?.text || '').trim();
        if (!body) throw new Error('No accessible section content');
        if (body.split(/\r?\n/, 1)[0].replace(/^#\s+/, '').trim().toLowerCase() === title.toLowerCase()) body = body.replace(/^#[^\r\n]*\r?\n+(?:---\r?\n+)?/, '');
        const questions = item?.questions || [];
        if (Array.isArray(questions) && questions.length) body += '\n\n## Practice Questions\n\n' + questions.map((q, qi) => `### Question ${qi + 1}\n\n${asMarkdown(q.content || q.question || q.text || '')}`).join('\n\n');
        body = await localize(body, assets, number, id, source, warnings, result.images);
        await write(directory, filename, `---\ntags: [Academy, cybersecurity]\nmodule: ${yaml(result.name)}\nmodule_id: ${id}\nsection_id: ${sectionId}\nsource: ${source}\n---\n# ${title}\n\n${body.trim()}\n\n---\n[Module index](<00 - Module Index.md>)\n`);
        result.written++;
        index.push('- ' + mdLink(title, filename));
      } catch (error) { result.missing++; warnings.push(`${result.name}: section ${sectionId}: ${error.message}`); index.push(`- ${title} — unavailable (${error.message})`); }
    }
    if (detail?.walkthrough_id) {
      try {
        status(`Module ${order}/${total}: ${result.name}\nAdding walkthroughs beneath matching lessons…`);
        const data = await request(`/api/v2/walkthroughs/${detail.walkthrough_id}`);
        const raw = asMarkdown(data?.instructions || data?.content || data?.body || '').trim();
        if (!raw) throw new Error('No accessible instructions');
        const split = splitWalkthrough(raw, lessons, result.name, id);
        let reference = split.reference;
        for (const title of split.uncertain) warnings.push(`${result.name}: walkthrough heading could not be matched safely: ${title}; kept in module index`);
        for (const [lesson, content] of split.matched) {
          if (!content.trim()) continue;
          try {
            if (!(await exists(directory, lesson.filename))) throw new Error('Lesson note was not exported');
            const note = await read(directory, lesson.filename);
            const prior = managed(note, WALK_START, WALK_END);
            if (prior && !overwrite) { result.walkthroughLessonsKept++; continue; }
            if (!prior && /^## Walkthrough\s*$/m.test(note)) throw new Error('An unmarked walkthrough already exists; leaving it unchanged');
            const body = await localize(content, assets, `walkthrough-${lesson.id}`, id, `${location.origin}/app/module/${id}`, warnings, result.images);
            await write(directory, lesson.filename, embedWalkthrough(note, body, detail.walkthrough_id, id));
            result.walkthroughLessonsWritten++;
          } catch (error) {
            warnings.push(`${result.name}: walkthrough for ${lesson.title}: ${error.message}; kept in module index`);
            reference += `\n\n### Walkthrough for ${lesson.title}\n\n${content}`;
          }
        }
        const priorReference = managed(previousIndex, REF_START, REF_END);
        // Keep prior reference on a normal rerun only when every current lesson block was handled.
        if (!overwrite && priorReference && !split.uncertain.length && !reference.includes('### Walkthrough for ')) index.push('', priorReference);
        else if (reference.trim()) {
          reference = await localize(reference, assets, 'walkthrough-reference', id, `${location.origin}/app/module/${id}`, warnings, result.images);
          index.push('', `${REF_START}\n## Walkthrough reference\n\nWalkthrough ID: ${detail.walkthrough_id}\n\n${reference}\n${REF_END}`);
        }
        result.walkthrough = result.walkthroughLessonsWritten + result.walkthroughLessonsKept ? 'embedded' : 'reference only';
        if (!split.matched.size) warnings.push(`${result.name}: no walkthrough lesson headings matched; complete walkthrough kept in module index`);
      } catch (error) {
        result.walkthrough = 'unavailable';
        const priorReference = managed(previousIndex, REF_START, REF_END);
        if (priorReference) index.push('', priorReference);
        warnings.push(`${result.name}: walkthrough ${detail.walkthrough_id}: ${error.message}`);
      }
    }
    index.push('', `Sections: ${result.written + result.skipped}/${result.expected} saved. Walkthrough: ${result.walkthrough}; ${result.walkthroughLessonsWritten} lesson blocks added, ${result.walkthroughLessonsKept} existing blocks kept.`, '', 'Generated by the Academy exporter. Lesson notes are skipped on rerun unless replacement is selected.');
    await write(directory, '00 - Module Index.md', index.join('\n') + '\n');
    return result;
  };
  const run = async mode => {
    PATH_ID = Number($('academy-path').value);
    if (!Number.isSafeInteger(PATH_ID) || PATH_ID < 1) { status('Enter the numeric path ID from your learning path URL.'); return; }
    const notebook = safeName($('academy-folder').value);
    if (notebook === '.' || notebook === '..') { status('Choose a normal notebook folder name.'); return; }
    try {
      const custom = $('academy-assets').value.trim();
      const u = custom ? new URL(custom) : null;
      if (u && (u.protocol !== 'https:' || u.username || u.password)) throw new Error('Use an HTTPS image URL without embedded credentials.');
      assetOrigin = u ? u.origin : detectAssetOrigin();
    } catch (error) { status(error.message); return; }
    if (!window.showDirectoryPicker) { status('Use a current version of Chrome to select the vault folder.'); return; }
    let vault;
    try { vault = await window.showDirectoryPicker({ mode: 'readwrite' }); }
    catch (error) { status(`Folder selection stopped: ${error.message}`); return; }
    try { await vault.getDirectoryHandle('.obsidian'); }
    catch { status('That folder is not an Obsidian vault root. Select the folder containing .obsidian.'); return; }
    $('academy-export').disabled = $('academy-export-path').disabled = true;
    const warnings = [], results = [], started = new Date().toISOString();
    const overwrite = $('academy-overwrite').checked;
    let root = null;
    try {
      const notes = await vault.getDirectoryHandle('Notes', { create: true });
      root = await notes.getDirectoryHandle(notebook, { create: true });
      const path = await request(`/api/v2/paths/${PATH_ID}`);
      if (path?.id && Number(path.id) !== PATH_ID) throw new Error('The server returned a different path ID');
      const modules = path?.modules || path?.module_groups?.flatMap(group => group.modules || []) || [];
      if (!Array.isArray(modules) || !modules.length) throw new Error('The selected path returned no modules');
      const selected = modules.map((module, i) => ({ module, order: i + 1 })).filter(({ module }) => mode === 'path' || Number(module.id || module.module_id) === moduleId);
      if (!selected.length) throw new Error('The open module is not in the selected path');
      for (const { module, order } of selected) {
        try { results.push(await exportModule(root, module, order, modules.length, overwrite, warnings)); }
        catch (error) { const id = module.id || module.module_id; results.push({ id, order, name: module.name || module.title || `Module ${id}`, error: error.message, expected: 0, written: 0, skipped: 0, missing: 0, locked: 0, walkthrough: 'not checked', walkthroughLessonsWritten: 0, walkthroughLessonsKept: 0, images: { expected: 0, saved: 0 } }); warnings.push(`Module ${id}: ${error.message}`); }
      }
      const totals = results.reduce((a, r) => { for (const key of ['expected', 'written', 'skipped', 'missing', 'locked']) a[key] += r[key]; a.walkthrough += r.walkthrough === 'embedded' ? 1 : 0; a.walkthroughLessonsWritten += r.walkthroughLessonsWritten; a.walkthroughLessonsKept += r.walkthroughLessonsKept; a.images += r.images.saved; a.imageExpected += r.images.expected; return a; }, { expected: 0, written: 0, skipped: 0, missing: 0, locked: 0, walkthrough: 0, walkthroughLessonsWritten: 0, walkthroughLessonsKept: 0, images: 0, imageExpected: 0 });
      const index = ['# Academy — Course Notes', '', `Source: ${location.origin}/app/paths/${PATH_ID}/path-progress`, '', 'Course notes exported from accessible Academy modules.', '', '[Latest export report](<00 - Academy Export Report.md>)', ''];
      for (let i = 0; i < modules.length; i++) {
        const module = modules[i], result = results.find(r => Number(r.id) === Number(module.id || module.module_id));
        const folder = result?.folder || moduleFolder(module.name || module.title || `Module ${module.id || module.module_id}`, i + 1);
        let accessible = false;
        try { const dir = await root.getDirectoryHandle(folder); accessible = await exists(dir, '00 - Module Index.md'); } catch {}
        index.push('- ' + (accessible ? mdLink(folder, `${folder}/00 - Module Index.md`) : folder + (result?.locked || module.state === 'locked' || module.is_unlocked === false ? ' — locked' : ' — not exported')));
      }
      await write(root, '00 - Academy Export Index.md', index.join('\n') + '\n');
      const report = ['# Academy Export Report', '', `Started: ${started}`, `Finished: ${new Date().toISOString()}`, `Destination: ${vault.name}/Notes/${notebook}`, `Mode: ${mode}; replace existing lesson notes: ${overwrite}`, '', `Expected sections in accessible, listed modules: ${totals.expected}`, `Written: ${totals.written}; existing sections kept: ${totals.skipped}; missing: ${totals.missing}.`, `Locked modules skipped: ${totals.locked}. Modules with embedded walkthroughs: ${totals.walkthrough}; lesson walkthrough blocks added: ${totals.walkthroughLessonsWritten}; existing blocks kept: ${totals.walkthroughLessonsKept}.`, `Images saved this run: ${totals.images}/${totals.imageExpected}. Images in skipped notes were not rechecked.`, '', '| Module | Expected sections | Written | Existing kept | Missing | Walkthrough |', '| --- | ---: | ---: | ---: | ---: | --- |', ...results.map(r => `| ${r.order}. ${r.name.replace(/\|/g, '\\|')}${r.locked ? ' (locked)' : ''}${r.error ? ' (error)' : ''} | ${r.expected} | ${r.written} | ${r.skipped} | ${r.missing} | ${r.walkthrough} (${r.walkthroughLessonsWritten} added, ${r.walkthroughLessonsKept} kept) |`), '', '## Warnings', '', ...(warnings.length ? warnings.map(w => '- ' + w.replace(/\n/g, ' ')) : ['None.']), '', 'Live walkthrough {hidden} placeholders are preserved. Locked or inaccessible content is not bypassed. This export does not include lab instances, downloadable exercise archives, video media, or answers hidden by Academy. Generated indexes and this report are refreshed on every run.'];
      await write(root, '00 - Academy Export Report.md', report.join('\n') + '\n');
      window.__academyNotesExportResult = { started, finished: new Date().toISOString(), destination: `${vault.name}/Notes/${notebook}`, totals, results, warnings };
      console.info('Academy export results:', window.__academyNotesExportResult);
      status(`Done: ${totals.written} sections written, ${totals.skipped} existing kept, ${totals.missing} missing, ${totals.walkthrough} modules with inline walkthroughs (${totals.walkthroughLessonsWritten} added, ${totals.walkthroughLessonsKept} kept), ${totals.locked} locked modules skipped.\nImages: ${totals.images}/${totals.imageExpected}. Warnings: ${warnings.length}.\nSaved in ${vault.name}/Notes/${notebook}.\nRead 00 - Academy Export Report.md for full details.`);
    } catch (error) {
      warnings.push(error.message);
      if (root) {
        try {
          await write(root, '00 - Academy Export Report.md', ['# Academy Export Report — stopped', '', `Started: ${started}`, `Stopped: ${new Date().toISOString()}`, '', 'The export did not complete. Any completed files remain saved.', '', ...results.map(r => `- ${r.name}: ${r.written}/${r.expected} sections written, ${r.skipped} existing kept, ${r.missing} missing; walkthrough ${r.walkthrough}${r.error ? '; error: ' + r.error : ''}`), '', '## Warnings', '', ...warnings.map(w => '- ' + w)].join('\n') + '\n');
        } catch (reportError) { warnings.push(`Could not save failure report: ${reportError.message}`); }
      }
      window.__academyNotesExportResult = { started, stopped: new Date().toISOString(), destination: `${vault.name}/Notes/${notebook}`, results, warnings, error: error.message };
      status(`Export stopped: ${error.message}\nExisting lesson notes were kept unless replacement was selected.\n${warnings.join('\n')}`);
      console.error('Academy export stopped:', window.__academyNotesExportResult);
    }
    finally { $('academy-export').disabled = !moduleId; $('academy-export-path').disabled = false; }
  };
  $('academy-export').onclick = () => run('module');
  $('academy-export-path').onclick = () => run('path');
})();
