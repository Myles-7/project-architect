import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';

// Synthetic checks of frozen specification pseudocode, never target app or native IME tests.
const directory = dirname(fileURLToPath(import.meta.url));
const snapshotBytes = readFileSync(join(directory, 'final-snapshot.json'));
const snapshot = JSON.parse(snapshotBytes);
const block = snapshot.planning.blueprint.blocks.find(block => block.id === 'blk-tech-interface');
const fence = String.fromCharCode(96).repeat(3);
const code = block.content.split(fence + 'javascript')[1].split(fence)[0];
let nextTimer = 1;
const timers = new Map();
const banner = { textContent: '', style: {} };
const document = {
  activeElement: null,
  body: { contains(node) { return node.connected; }, prepend() {} },
  getElementById() { return banner; },
  createElement(tag) { return new NodeStub(tag); },
};
class NodeStub {
  constructor(tag = 'input') {
    this.tag = tag; this.attrs = new Map(); this.connected = true;
    this.value = ''; this.textContent = ''; this.style = {}; this.listeners = new Map();
    this.classList = { add: () => {}, remove: () => {} };
  }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  setAttribute(name, value) { this.attrs.set(name, value); }
  removeAttribute(name) { this.attrs.delete(name); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  emit(type, extra = {}) { this.listeners.get(type)?.({ currentTarget: this, ...extra }); }
  replaceWith(next) {
    if (this.failReplacement) throw new Error('fixture replacement failure');
    this.connected = false; next.connected = true;
  }
  focus() { document.activeElement = this; }
}
const sandbox = {
  document,
  console: { error() {} },
  setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
  clearTimeout(id) { timers.delete(id); },
};
runInNewContext(code + '\nglobalThis.auditApi = {AppController, ResetController, InputController, DisplayRenderer, state: () => ({value:activeInputNode?.value, connected:activeInputNode?.connected, generation:inputGeneration, epoch:schedulerEpoch})};', sandbox);
const input = new NodeStub();
for (const [name, value] of Object.entries({ id: 'project-name-input', name: 'projectName', 'aria-describedby': 'help', 'aria-required': 'true', tabindex: '0', style: 'border-width:2px', 'data-test': 'project-input' })) input.setAttribute(name, value);
const display = new NodeStub('div'), errors = new NodeStub('div'), reset = new NodeStub('button');
sandbox.auditApi.AppController.init({ displayElement: display, initialInputNode: input, errorContainer: errors, resetButton: reset });
const flush = () => { const jobs = [...timers.values()]; timers.clear(); for (const job of jobs) job(); };
input.value = 'Normal'; input.emit('input'); flush();
const normal = { result: display.textContent, expected: 'Normal' };
reset.emit('click');
const active = document.activeElement;
const attributes = Object.fromEntries(active.attrs);
active.value = 'Keep me'; active.emit('input'); flush();
active.failReplacement = true; reset.emit('click');
active.value = 'Edited after failure'; active.emit('input');
const failedBeforeReplacement = { banner: banner.textContent, inputConnected: active.connected, inputValue: active.value, scheduledAfterEditing: timers.size, display: display.textContent, state: sandbox.auditApi.state() };
active.failReplacement = false;
const originalRender = sandbox.auditApi.DisplayRenderer.renderPlaceholder;
sandbox.auditApi.DisplayRenderer.renderPlaceholder = () => { throw new Error('fixture renderer failure'); };
reset.emit('click');
const failedAfterReplacement = { banner: banner.textContent, oldInputConnected: active.connected, oldInputValue: active.value, state: sandbox.auditApi.state() };
sandbox.auditApi.DisplayRenderer.renderPlaceholder = originalRender;
const results = {
  kind: 'synthetic frozen specification audit; no target implementation or native browser validation',
  sourceSnapshotSha256: createHash('sha256').update(snapshotBytes).digest('hex'),
  blockId: block.id, normal, attributes, failedBeforeReplacement, failedAfterReplacement,
  blockers: ['R5-B1', 'R5-B2'], contentPassed: false,
};
writeFileSync(join(directory, 'review-r5-pseudocode-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
