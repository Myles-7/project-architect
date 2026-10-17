// Controlled Experiment: Reset Transaction State Machine & Failure Rollback Simulation
const assert = require('assert');

// 1. Mock DOM Node
class MockNode {
  constructor(id, tag = 'input') {
    this.id = id;
    this.tagName = tag;
    this.value = '';
    this.attributes = {};
    this.parentNode = null;
    this.isConnected = false;
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  replaceWith(newNode) {
    if (!this.parentNode) throw new Error("HierarchyRequestError: node has no parent");
    const parent = this.parentNode;
    const idx = parent.children.indexOf(this);
    if (idx === -1) throw new Error("Node not found in parent");
    this.isConnected = false;
    this.parentNode = null;
    newNode.parentNode = parent;
    newNode.isConnected = true;
    parent.children.splice(idx, 1, newNode);
  }
}

class MockParent {
  constructor() {
    this.children = [];
  }
  appendChild(node) {
    node.parentNode = this;
    node.isConnected = true;
    this.children.push(node);
  }
  insertBefore(newNode, refNode) {
    newNode.parentNode = this;
    newNode.isConnected = true;
    if (!refNode) {
      this.children.push(newNode);
    } else {
      const idx = this.children.indexOf(refNode);
      if (idx === -1) throw new Error("refNode not found");
      this.children.splice(idx, 0, newNode);
    }
  }
  removeChild(node) {
    const idx = this.children.indexOf(node);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      node.parentNode = null;
      node.isConnected = false;
    }
  }
}

// 2. Transaction state controller
class ResetTransactionController {
  constructor(container, initialInput) {
    this.container = container;
    this.activeInputNode = initialInput;
    this.inputGeneration = 0;
    this.schedulerEpoch = 0;
    this.pendingTimer = null;
    this.pendingDraft = null;
    this.lastRendered = "Old Value";
    this.banner = { message: "", severeFallbackDraft: null };
  }

  schedule(draft) {
    this.pendingDraft = draft;
    this.pendingTimer = { epoch: this.schedulerEpoch, draft };
  }

  cancel() {
    this.schedulerEpoch++;
    this.pendingTimer = null;
  }

  captureSnapshot() {
    const node = this.activeInputNode;
    return {
      node,
      bornGeneration: this.inputGeneration,
      draft: this.pendingDraft !== null ? this.pendingDraft : node.value,
      hadPendingTimer: this.pendingTimer !== null,
      parent: node.parentNode,
      nextSibling: node.parentNode ? (node.parentNode.children[node.parentNode.children.indexOf(node) + 1] || null) : null,
      lastRendered: this.lastRendered
    };
  }

  handleReset(shouldFailStage = null) {
    const snapshot = this.captureSnapshot();
    let mountedReplacementNode = null;

    try {
      // Stage 1: Prep
      if (shouldFailStage === 'prep') throw new Error("Prep failed");
      const newNode = new MockNode("project-name-input");
      const nextGen = this.inputGeneration + 1; // Not committed yet!

      // Stage 2: Cancel pending
      this.cancel();

      // Stage 3: Replace
      if (shouldFailStage === 'replace') throw new Error("replaceWith failed");
      snapshot.node.replaceWith(newNode);
      mountedReplacementNode = newNode;

      // Stage 4: Post-replace steps (renderPlaceholder / clear error / focus)
      if (shouldFailStage === 'post-replace') throw new Error("renderPlaceholder failed");
      this.lastRendered = "Project Name Placeholder";

      // Stage 5: Commit
      this.activeInputNode = newNode;
      this.inputGeneration = nextGen;
      this.pendingDraft = "";
      return { success: true };
    } catch (err) {
      // Rollback
      return this.rollback(snapshot, mountedReplacementNode, err);
    }
  }

  rollback(snapshot, mountedReplacementNode, err) {
    try {
      if (mountedReplacementNode && mountedReplacementNode.isConnected) {
        // Atomic DOM rollback: replace newNode back with oldNode
        const parent = snapshot.parent;
        if (!parent) throw new Error("Parent lost during rollback");
        parent.insertBefore(snapshot.node, mountedReplacementNode);
        parent.removeChild(mountedReplacementNode);
      }
      
      // Restore state
      this.activeInputNode = snapshot.node;
      // Do NOT increment inputGeneration! Keep snapshot.bornGeneration
      this.inputGeneration = snapshot.bornGeneration;
      
      // Restore pending task WITHOUT trim filter (preserves empty/whitespace validation)
      if (snapshot.hadPendingTimer) {
        this.schedule(snapshot.draft);
      }
      
      this.banner.message = "清空未成功，已恢复先前输入与任务";
      return { success: false, recovered: true };
    } catch (severeErr) {
      // Severe rollback failure: provide readonly fallback draft
      this.banner.message = "界面恢复遇到异常，主输入框未完全恢复，但已保留草稿供复制";
      this.banner.severeFallbackDraft = snapshot.draft;
      return { success: false, recovered: false, severe: true };
    }
  }
}

// Test Case 1: Post-replace failure rollback restores single input and pending whitespace task
const parent = new MockParent();
const input0 = new MockNode("project-name-input");
input0.value = "   ";
parent.appendChild(input0);

const controller = new ResetTransactionController(parent, input0);
controller.schedule("   "); // whitespace pending task
assert.strictEqual(controller.pendingTimer.draft, "   ");

// Trigger post-replace failure
const res1 = controller.handleReset('post-replace');
assert.strictEqual(res1.success, false);
assert.strictEqual(res1.recovered, true);

// Verify DOM topology: exactly 1 child in parent, and it is input0
assert.strictEqual(parent.children.length, 1);
assert.strictEqual(parent.children[0], input0);
assert.strictEqual(parent.children[0].id, "project-name-input");
assert.strictEqual(controller.activeInputNode, input0);
assert.strictEqual(controller.inputGeneration, 0); // Generation not advanced prematurely!
// Verify pending task was NOT dropped due to whitespace trim
assert.notStrictEqual(controller.pendingTimer, null);
assert.strictEqual(controller.pendingTimer.draft, "   ");

// Test Case 2: User can continue typing after rollback
controller.activeInputNode.value = "Edited after failure";
controller.schedule("Edited after failure");
assert.strictEqual(controller.pendingTimer.draft, "Edited after failure");

// Test Case 3: Severe rollback failure fallback
const parent2 = new MockParent();
const input1 = new MockNode("project-name-input");
input1.value = "Important Draft \n with spaces";
parent2.appendChild(input1);
const controller2 = new ResetTransactionController(parent2, input1);

// Break parent during rollback to trigger severe error
parent2.insertBefore = () => { throw new Error("DOM mutation lock"); };
const res2 = controller2.handleReset('post-replace');
assert.strictEqual(res2.success, false);
assert.strictEqual(res2.recovered, false);
assert.strictEqual(res2.severe, true);
assert.strictEqual(controller2.banner.severeFallbackDraft, "Important Draft \n with spaces");

console.log("ALL_CONTROLLED_EXPERIMENT_TESTS_PASSED");
