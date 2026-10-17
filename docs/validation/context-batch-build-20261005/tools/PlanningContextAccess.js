import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const digest = (text) => createHash('sha256').update(text).digest('hex');
const wireBytes = (value) => Buffer.byteLength(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(value) }] }));
/** Freeze the complete input once per invocation. Paging is transport, never a usage budget. */
export function preparePlanningContextAccess(text, directory, requestId) {
    const source = JSON.parse(text);
    if (!source || Array.isArray(source) || typeof source !== 'object')
        throw new Error('Planning context must be an object');
    const entries = [];
    const pointerKey = (key) => key.replace(/~/g, '~0').replace(/\//g, '~1');
    const visit = (value, path) => {
        const content = JSON.stringify(value);
        if (content === undefined)
            throw new Error('Planning context contains an undefined value');
        if (Array.isArray(value) && value.length) {
            add(JSON.stringify({ structure: 'array', length: value.length }), path, undefined, 'structure');
            value.forEach((item, index) => visit(item, `${path}/${index}`));
        }
        else if (value && typeof value === 'object' && Buffer.byteLength(content) > 6000) {
            add(JSON.stringify({ structure: 'object', keys: Object.keys(value) }), path, undefined, 'structure');
            Object.entries(value).forEach(([key, item]) => visit(item, `${path}/${pointerKey(key)}`));
        }
        else {
            const record = value;
            add(content, path, record && typeof record === 'object' ? [record.id, record.title].filter(item => typeof item === 'string').join(' · ').slice(0, 80) || undefined : undefined);
        }
    };
    const add = (content, path, label, encoding = 'json') => entries.push({ key: `c${entries.length}`, path, ...(label ? { label } : {}), encoding, content, characters: content.length, sha256: digest(content) });
    Object.entries(source).forEach(([key, value]) => visit(value, `/${pointerKey(key)}`));
    const tag = digest(requestId).slice(0, 16);
    const sourcePath = resolve(directory, `context-${tag}.json`), entriesPath = resolve(directory, `context-${tag}-entries.json`), readsPath = resolve(directory, `context-${tag}-reads.ndjson`);
    const entryText = JSON.stringify(entries);
    writeFileSync(sourcePath, text, 'utf8');
    writeFileSync(entriesPath, entryText, 'utf8');
    writeFileSync(readsPath, '', 'utf8');
    const review = !!source.workerResults?.draft && !Object.prototype.hasOwnProperty.call(source, 'currentDraft');
    // Historical observations remain available, but are not current requirements.
    const historical = new Set(['taskHistory', 'historicalReviewFindings']);
    const requiredKeys = review ? entries.filter(entry => !historical.has(entry.path.split('/')[1])).map(entry => entry.key) : [];
    const access = { sourcePath, sourceSha256: digest(text), entriesPath, entriesSha256: digest(entryText), readsPath, requiredKeys };
    const sections = Object.keys(source).map(name => ({ prefix: `/${pointerKey(name)}`, records: entries.filter(entry => entry.path === `/${pointerKey(name)}` || entry.path.startsWith(`/${pointerKey(name)}/`)).length }));
    return { access, overview: { transport: 'immutable-indexed-context-v2', contextSha256: access.sourceSha256, sections, reviewRequiresCompleteRead: review,
            instructions: 'Prefer planning_context action=scan to read multiple records per bounded page. For a relevant section set prefix; continue with offset=nextOffset and characterOffset=nextCharacterOffset until nextOffset is null. Independent review should scan requiredOnly=true to read all mandatory nonhistorical records. For selective lookup, action=index lists keys and action=read pages one key. JSON Pointer paths are escaped; structure records describe parent shape and json records contain actual values. No content was omitted. Missing required coverage prevents finish; historical observations remain available, not automatically unresolved current issues.' } };
}
function verifiedEntries(access) {
    if (digest(readFileSync(access.sourcePath, 'utf8')) !== access.sourceSha256)
        throw new Error('Frozen planning context was modified');
    const text = readFileSync(access.entriesPath, 'utf8');
    if (digest(text) !== access.entriesSha256)
        throw new Error('Frozen planning context index was modified');
    return JSON.parse(text);
}
export function readPlanningContext(access, input, commitRead = true) {
    const entries = verifiedEntries(access), offset = input.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0)
        throw new Error('Invalid planning context offset');
    if (input.action === 'scan') {
        if (input.requiredOnly !== undefined && typeof input.requiredOnly !== 'boolean')
            throw new Error('Required-only selector must be boolean');
        if (input.requiredOnly && !access.requiredKeys.length)
            throw new Error('Required-only scan requires an independent review context');
        const required = new Set(access.requiredKeys);
        const selected = entries.filter(entry => (!input.prefix || entry.path === input.prefix || entry.path.startsWith(input.prefix + '/')) && (!input.requiredOnly || required.has(entry.key)));
        const length = input.length ?? 30;
        if (!Number.isInteger(length) || length < 1 || length > 30)
            throw new Error('Invalid planning context scan page');
        let cursor = offset, characterOffset = input.characterOffset ?? 0;
        if (!Number.isInteger(characterOffset) || characterOffset < 0 || cursor > selected.length || (cursor === selected.length ? characterOffset !== 0 : characterOffset >= selected[cursor].characters))
            throw new Error('Invalid planning context scan cursor');
        const parts = [];
        const envelope = () => ({ contextSha256: access.sourceSha256, parts, nextOffset: cursor < selected.length ? cursor : null, nextCharacterOffset: characterOffset, totalEntries: selected.length });
        while (cursor < selected.length && parts.length < length) {
            const entry = selected[cursor];
            if (characterOffset > 0 && /[\uDC00-\uDFFF]/.test(entry.content.charAt(characterOffset)) && /[\uD800-\uDBFF]/.test(entry.content.charAt(characterOffset - 1)))
                throw new Error('Invalid planning context Unicode boundary');
            let content = entry.content.slice(characterOffset, characterOffset + 4000);
            const part = { key: entry.key, path: entry.path, encoding: entry.encoding, sha256: entry.sha256, content: '', offset: characterOffset, nextOffset: null, totalCharacters: entry.characters };
            parts.push(part);
            const update = () => { part.content = content; part.nextOffset = characterOffset + content.length < entry.characters ? characterOffset + content.length : null; };
            const trialEnvelope = () => ({ ...envelope(), nextOffset: part.nextOffset !== null ? cursor : cursor + 1 < selected.length ? cursor + 1 : null, nextCharacterOffset: part.nextOffset ?? 0 });
            update();
            while (wireBytes(trialEnvelope()) > 6000 && content.length > 2) {
                content = content.slice(0, Math.max(2, Math.floor(content.length * .9)));
                update();
            }
            if (characterOffset + content.length < entry.characters && /[\uD800-\uDBFF]$/.test(content)) {
                content = content.slice(0, -1);
                update();
            }
            if (wireBytes(trialEnvelope()) > 6000 || !content.length) {
                parts.pop();
                if (!parts.length)
                    throw new Error('Planning context metadata exceeds the visible transport page; unsupported record path');
                break;
            }
            characterOffset += content.length;
            if (characterOffset === entry.characters) {
                cursor++;
                characterOffset = 0;
            }
            // A long record continues at its exact character offset on the next page.
            else
                break;
        }
        const result = envelope();
        if (wireBytes(result) > 6000)
            throw new Error('Planning context scan envelope exceeds the visible transport page');
        if (commitRead && parts.length)
            commitPlanningContextReads(access, parts.map(part => ({ ...part, contextSha256: access.sourceSha256 })));
        return result;
    }
    if (input.action === 'index') {
        const prefix = input.prefix ?? '', selected = entries.filter(entry => !prefix || entry.path === prefix || entry.path.startsWith(prefix + '/'));
        const length = input.length ?? 15;
        if (!Number.isInteger(length) || length < 1 || length > 30)
            throw new Error('Invalid planning context index page');
        const page = selected.slice(offset, offset + length).map(({ content: _content, ...entry }) => ({ ...entry, requiredForReview: access.requiredKeys.includes(entry.key) }));
        const result = () => ({ contextSha256: access.sourceSha256, entries: page, offset, nextOffset: offset + page.length < selected.length ? offset + page.length : null, totalEntries: selected.length });
        while (page.length > 1 && wireBytes(result()) > 6000)
            page.pop();
        if (wireBytes(result()) > 6000)
            throw new Error('Planning context metadata exceeds the visible transport page; unsupported record path');
        return result();
    }
    const entry = entries.find(item => item.key === input.key);
    if (!entry)
        throw new Error('Unknown planning context key');
    const length = input.length ?? 2000;
    if (!Number.isInteger(length) || length < 1 || length > 4000 || offset > entry.characters)
        throw new Error('Invalid planning context range');
    if (offset > 0 && /[\uDC00-\uDFFF]/.test(entry.content.charAt(offset)) && /[\uD800-\uDBFF]/.test(entry.content.charAt(offset - 1)))
        throw new Error('Invalid planning context Unicode boundary');
    // Stay below the CLI's tool-output offload boundary even for Unicode. No total-read limit.
    let content = entry.content.slice(offset, offset + length);
    const envelope = () => ({ contextSha256: access.sourceSha256, key: entry.key, path: entry.path, encoding: entry.encoding, sha256: entry.sha256, content, offset, nextOffset: offset + content.length < entry.characters ? offset + content.length : null, totalCharacters: entry.characters });
    while (wireBytes(envelope()) > 6000 && content.length > 2)
        content = content.slice(0, Math.max(2, Math.floor(content.length * .9)));
    if (offset + content.length < entry.characters && /[\uD800-\uDBFF]$/.test(content))
        content = content.slice(0, -1);
    if (!content.length && offset < entry.characters)
        content = entry.content.slice(offset, offset + 2);
    const result = envelope();
    if (wireBytes(result) > 6000)
        throw new Error('Planning context metadata exceeds the visible transport page; unsupported record path');
    if (commitRead)
        commitPlanningContextRead(access, result);
    return result;
}
export function commitPlanningContextRead(access, result) {
    const entry = verifiedEntries(access).find(item => item.key === result.key);
    if (!entry || result.contextSha256 !== access.sourceSha256 || result.sha256 !== entry.sha256 || result.content !== entry.content.slice(result.offset, result.offset + result.content.length))
        throw new Error('Planning context read receipt does not match frozen input');
    appendFileSync(access.readsPath, JSON.stringify({ sourceSha256: access.sourceSha256, key: entry.key, sha256: entry.sha256, offset: result.offset, length: result.content.length }) + '\n');
}
/** Validate every part first; one ledger frame never credits an unreturned partial batch. */
export function commitPlanningContextReads(access, parts) {
    const entries = new Map(verifiedEntries(access).map(entry => [entry.key, entry]));
    const reads = parts.map(part => {
        const entry = entries.get(part.key);
        if (!entry || part.contextSha256 !== access.sourceSha256 || part.sha256 !== entry.sha256 || !Number.isInteger(part.offset) || part.offset < 0 || !part.content.length || part.offset + part.content.length > entry.characters || part.content !== entry.content.slice(part.offset, part.offset + part.content.length))
            throw new Error('Planning context batch receipt does not match frozen input');
        return { sourceSha256: access.sourceSha256, key: entry.key, sha256: entry.sha256, offset: part.offset, length: part.content.length };
    });
    if (reads.length)
        appendFileSync(access.readsPath, JSON.stringify({ reads }) + '\n');
}
export function planningContextReadIssues(access) {
    const entries = verifiedEntries(access);
    const reads = existsSync(access.readsPath) ? readFileSync(access.readsPath, 'utf8').split('\n').filter(Boolean).flatMap(line => { const record = JSON.parse(line); return 'reads' in record ? record.reads : [record]; }) : [];
    return entries.filter(entry => access.requiredKeys.includes(entry.key)).filter(entry => {
        let end = 0;
        const ranges = reads.filter(read => read.sourceSha256 === access.sourceSha256 && read.key === entry.key && read.sha256 === entry.sha256)
            .sort((a, b) => a.offset - b.offset);
        for (const range of ranges) {
            if (range.offset > end)
                break;
            end = Math.max(end, range.offset + range.length);
        }
        return end < entry.characters;
    }).map(entry => `${entry.key} ${entry.path}`);
}
//# sourceMappingURL=PlanningContextAccess.js.map