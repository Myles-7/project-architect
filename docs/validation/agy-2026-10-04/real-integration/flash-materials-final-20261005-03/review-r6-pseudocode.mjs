import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';

// Direct audit of frozen specification pseudocode. This is neither the target
// application implementation nor a native browser, IME, focus, or timing test.
const directory = dirname(fileURLToPath(import.meta.url));
const snapshotBytes = readFileSync(join(directory, 'final-snapshot.json'));
const snapshot = JSON.parse(snapshotBytes);
const block = snapshot.planning.blueprint.blocks.find(block => block.id === 'blk-tech-interface');
const fence = String.fromCharCode(96).repeat(3);
const code = block.content.split(fence + 'javascript')[1].split(fence)[0];

function createHarness() {
  const timers = new Map();
  let nextTimer = 1;
  let fault = null;
  let document;
  class NodeStub {
    constructor(tag = 'div') {
      this.tag = tag;
      this.attrs = new Map();
      this.parentNode = null;
      this.children = [];
      this.value = '';
      this.textContent = '';
      this.style = {};
      this.listeners = new Map();
      const getClasses = () => new Set((this.attrs.get('class') ?? '').split(/\s+/).filter(Boolean));
      const writeClasses = values => this.attrs.set('class', [...values].join(' '));
      this.classList = {
        contains: value => getClasses().has(value),
        add: value => { const classes = getClasses(); classes.add(value); writeClasses(classes); },
        remove: value => { const classes = getClasses(); classes.delete(value); writeClasses(classes); },
      };
    }
    get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
    get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] ?? null; }
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    removeAttribute(name) { this.attrs.delete(name); }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    addEventListener(type, callback) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(callback);
      this.listeners.set(type, listeners);
    }
    emit(type, extra = {}) { for (const callback of this.listeners.get(type) ?? []) callback({ currentTarget: this, ...extra }); }
    remove() {
      if (this.parentNode) {
        this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
        this.parentNode = null;
      }
    }
    insertBefore(child, reference) {
      if (reference !== null && reference.parentNode !== this) throw new Error('NotFoundError');
      if (fault === 'rollback' && child === input) throw new Error('fixture rollback failure');
      child.remove();
      const index = reference === null ? this.children.length : this.children.indexOf(reference);
      this.children.splice(index, 0, child);
      child.parentNode = this;
      return child;
    }
    appendChild(child) { return this.insertBefore(child, null); }
    prepend(child) { return this.insertBefore(child, this.children[0] ?? null); }
    replaceChild(next, current) {
      if (current.parentNode !== this) throw new Error('NotFoundError');
      if (fault === 'rollback' && next === input) throw new Error('fixture rollback failure');
      next.remove();
      const index = this.children.indexOf(current);
      this.children.splice(index, 1, next);
      current.parentNode = null;
      next.parentNode = this;
      return current;
    }
    replaceWith(next) {
      if (fault === 'replace') throw new Error('fixture replacement failure');
      this.parentNode?.replaceChild(next, this);
    }
    focus() {
      if (fault === 'focus' && this !== input) throw new Error('fixture focus failure');
      document.activeElement = this;
    }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  }
  const root = new NodeStub();
  const banner = new NodeStub();
  banner.setAttribute('id', 'global-error-banner');
  const input = new NodeStub('input');
  for (const [name, value] of Object.entries({ id: 'project-name-input', name: 'projectName', 'aria-label': 'Project name', 'aria-describedby': 'help', 'aria-required': 'true', tabindex: '0', class: 'project-input', style: 'border-width:2px', 'data-test': 'project-input' })) input.setAttribute(name, value);
  const display = new NodeStub(), errors = new NodeStub(), reset = new NodeStub('button');
  for (const node of [input, display, errors, reset, banner]) root.appendChild(node);
  const allNodes = () => { const result = []; const visit = node => { result.push(node); node.children.forEach(visit); }; visit(root); return result; };
  document = {
    activeElement: null,
    body: root,
    getElementById(id) { return allNodes().find(node => node.getAttribute('id') === id) ?? null; },
    createElement(tag) { if (fault === 'create') throw new Error('fixture creation failure'); return new NodeStub(tag); },
  };
  const sandbox = {
    document, console: { error() {} },
    setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  runInNewContext(code + '\nglobalThis.auditApi = { AppController, ResetController, InputController, DisplayRenderer, FeedbackBanner, state: () => ({ node: activeInputNode, generation: inputGeneration, epoch: schedulerEpoch, pendingTimerId }) };', sandbox);
  const api = sandbox.auditApi;
  api.AppController.init({ displayElement: display, initialInputNode: input, errorContainer: errors, resetButton: reset });
  const initialRender = api.DisplayRenderer.renderPlaceholder;
  const initialClear = api.FeedbackBanner.clearInputError;
  const initialBind = api.InputController.bindInputNode;
  api.DisplayRenderer.renderPlaceholder = (...args) => {
    if (fault === 'render' || fault === 'rollback') throw new Error('fixture renderer failure');
    return initialRender(...args);
  };
  api.FeedbackBanner.clearInputError = (...args) => {
    if (fault === 'clear') { errors.textContent = ''; errors.style.display = 'none'; throw new Error('fixture clear failure'); }
    return initialClear(...args);
  };
  api.InputController.bindInputNode = (...args) => {
    if (fault === 'bind') throw new Error('fixture binding failure');
    return initialBind(...args);
  };
  const flush = () => { const jobs = [...timers.values()]; timers.clear(); for (const callback of jobs) callback(); };
  const fields = () => allNodes().filter(node => node.tag === 'input');
  const compact = () => ({
    inputCount: fields().length,
    matchingIdCount: fields().filter(node => node.getAttribute('id') === 'project-name-input').length,
    fieldValues: fields().map(node => node.value),
    activeIsOriginal: api.state().node === input,
    activeConnected: root.contains(api.state().node),
    originalConnected: root.contains(input),
    generation: api.state().generation,
    pendingTimers: timers.size,
    display: display.textContent,
    error: errors.textContent,
    banner: banner.textContent,
  });
  return { input, display, errors, reset, banner, root, document, api, timers, fields, flush, compact, setFault(value) { fault = value; } };
}

const failureScenarios = ['create', 'bind', 'replace', 'render', 'clear', 'focus'].map(fault => {
  const h = createHarness();
  h.input.value = 'Keep me'; h.input.emit('input'); h.flush();
  h.setFault(fault); h.reset.emit('click');
  const immediatelyAfterFailure = h.compact();
  const firstVisibleInput = h.fields()[0];
  firstVisibleInput.value = 'Typed in first visible input'; firstVisibleInput.emit('input');
  const scheduledByFirstVisibleInput = h.timers.size;
  h.setFault(null);
  h.input.value = 'Edited after failure'; h.input.emit('input'); h.flush();
  const afterContinuingOriginal = h.compact();
  h.input.value = ''; h.input.emit('input'); h.flush();
  const afterManualEmpty = h.compact();
  h.reset.emit('click');
  const afterRetry = h.compact();
  return { fault, immediatelyAfterFailure, scheduledByFirstVisibleInput, afterContinuingOriginal, afterManualEmpty, afterRetry };
});

const pendingDraftScenarios = ['', '   ', 'New pending draft'].map(draft => {
  const h = createHarness();
  h.input.value = 'Old displayed value'; h.input.emit('input'); h.flush();
  h.input.value = draft; h.input.emit('input');
  const beforeFailure = h.compact();
  h.setFault('replace'); h.reset.emit('click');
  const afterFailure = h.compact();
  h.setFault(null); h.flush();
  return { draft, beforeFailure, afterFailure, afterPendingWork: h.compact() };
});

const h = createHarness();
h.input.emit('compositionstart'); h.reset.emit('click');
const newInput = h.api.state().node;
newInput.value = 'Brand-New'; newInput.emit('input');
h.input.value = 'Stale text'; h.input.emit('compositionend'); h.input.emit('input');
const timersBeforeFlush = h.timers.size; h.flush();
const normalSuccessAndOldClosureIsolation = { state: h.compact(), timersBeforeFlush, attributes: Object.fromEntries(newInput.attrs) };

const fallback = createHarness();
fallback.input.value = 'Critical\n  raw draft'; fallback.input.emit('input'); fallback.flush();
fallback.setFault('rollback'); fallback.reset.emit('click');
const rollbackFailure = { state: fallback.compact(), readonlyTextareaCount: fallback.root.children.filter(node => node.tag === 'textarea').length };

const results = {
  kind: 'synthetic frozen specification audit; no target application or native browser/IME/performance validation',
  sourceSnapshotSha256: createHash('sha256').update(snapshotBytes).digest('hex'),
  blockId: block.id,
  failureScenarios, pendingDraftScenarios, normalSuccessAndOldClosureIsolation, rollbackFailure,
  blockers: ['R6-B1', 'R6-B2'], contentPassed: false,
};
writeFileSync(join(directory, 'review-r6-pseudocode-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ sourceSnapshotSha256: results.sourceSnapshotSha256, failures: failureScenarios.map(result => ({ fault: result.fault, fieldsAfterFailure: result.immediatelyAfterFailure.inputCount, fieldsAfterRetry: result.afterRetry.inputCount, firstFieldScheduled: result.scheduledByFirstVisibleInput })), pendingDrafts: pendingDraftScenarios.map(result => ({ draft: result.draft, restoredTimers: result.afterFailure.pendingTimers, displayAfterWork: result.afterPendingWork.display })), blockers: results.blockers, contentPassed: results.contentPassed }, null, 2));
