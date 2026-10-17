import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile, appendFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readPlanningContext, commitPlanningContextRead, commitPlanningContextReads, type PlanningContextAccess, type PlanningContextInput } from './PlanningContextAccess.js';

export interface ToolMaterial { id: string; path: string; extractedTextPath?: string; mimeType?: string; source?: string }
export interface PlanningToolsConfig { materialRoots: string[]; materials: ToolMaterial[]; experimentRoot: string; evidenceRoot: string; officialHosts?: string[]; dockerExecutable?: string; images?: Partial<Record<ExperimentRuntime, string>>; contextAccess?: PlanningContextAccess }
export type ExperimentRuntime = 'node' | 'python' | 'chromium';
export interface ExperimentInput { runtime: ExperimentRuntime; source: string; timeoutMs?: number; abortSignal?: AbortSignal }
export interface ExperimentResult { id: string; status: 'pass' | 'fail' | 'unavailable' | 'cancelled'; exitCode: number | null; directory: string; logPath: string; environment: { runtime: ExperimentRuntime; image: string; imageId?: string; network: 'none' }; reason?: string; startedAt: string; completedAt: string }
export interface EvidenceInput { source: string; content: string; scope: string; conclusion?: string }
export interface PreparedDependency { name: string; version: string }
const DEFAULT_IMAGES: Record<ExperimentRuntime, string> = { node: 'node:24.13.0-bookworm-slim', python: 'python:3.13.13-slim-bookworm', chromium: 'mcr.microsoft.com/playwright:v1.56.1-noble' };
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export function readableResearchContent(html:string):string {
  return html.replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--[^]*?-->/g,'').replace(/<\/(?:p|div|li|h[1-6]|section|tr)>|<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&#(x[\da-f]+|\d+);/gi,(_,n:string)=>{const code=n.charAt(0).toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/&(amp|lt|gt|quot|apos|nbsp);/gi,(_,n:string)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[n.toLowerCase()]??' ')).replace(/[\t ]+/g,' ').replace(/\n\s*\n/g,'\n\n').trim();
}
const contained = (root: string, target: string) => { const rel = relative(root, target); return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)); };

/** One service per registered task, with explicit source roots and an isolated experiment area. */
export class PlanningToolsService {
  readonly config: PlanningToolsConfig;
  private events: Promise<void> = Promise.resolve();
  private researchCache=new Map<string,{source:string;fetchedAt:string;sha256:string;content:string;links:string[];evidencePath:string}>();
  constructor(config: PlanningToolsConfig) {
    if (!config.materialRoots.length && config.materials.length) throw new Error('Material roots are required');
    if (new Set(config.materials.map(material => material.id)).size !== config.materials.length) throw new Error('Material ids must be unique');
    this.config = { ...config, materialRoots: config.materialRoots.map(root => resolve(root)), experimentRoot: resolve(config.experimentRoot), evidenceRoot: resolve(config.evidenceRoot) };
    if (config.materialRoots.some(root => contained(resolve(root), this.config.experimentRoot) || contained(this.config.experimentRoot, resolve(root)))) throw new Error('Experiment and material roots must be separate');
  }
  private async record(action: string, details: unknown): Promise<void> {
    this.events = this.events.then(async () => { await mkdir(this.config.evidenceRoot, { recursive: true }); await appendFile(join(this.config.evidenceRoot, 'tool-events.ndjson'), JSON.stringify({ at: new Date().toISOString(), action, details }) + '\n'); });
    return this.events;
  }
  private material(id: string): ToolMaterial { const material = this.config.materials.find(item => item.id === id); if (!material) throw new Error(`Unknown material: ${id}`); return material; }
  async readContext(input: PlanningContextInput) {
    if (!this.config.contextAccess) throw new Error('No frozen planning context registered for this invocation');
    const result = readPlanningContext(this.config.contextAccess, input, false);
    await this.record('planning_context', { contextSha256: result.contextSha256, ...input, ...('content' in result ? { returnedCharacters: result.content.length } : 'parts' in result ? { returnedRecords:result.parts.length,returnedCharacters:result.parts.reduce((sum,part)=>sum+part.content.length,0) } : {}) });
    if ('content' in result) commitPlanningContextRead(this.config.contextAccess, result);
    if ('parts' in result) commitPlanningContextReads(this.config.contextAccess,result.parts.map(part=>({...part,contextSha256:result.contextSha256})));
    return result;
  }
  private async confined(path: string): Promise<string> {
    const canonical = await realpath(resolve(path));
    const roots = await Promise.all(this.config.materialRoots.map(root => realpath(root)));
    if (!roots.some(root => contained(root, canonical))) throw new Error('Material path escapes its allowed roots');
    if (!(await stat(canonical)).isFile()) throw new Error('Material must be a regular file');
    return canonical;
  }
  async materialIndex(): Promise<Array<{ id: string; path: string; mimeType: string; source: string; sha256: string; bytes: number; readTool: string }>> {
    const values = await Promise.all(this.config.materials.map(async item => { const path = await this.confined(item.path); const content = await readFile(path); return { id: item.id, path, mimeType: item.mimeType || 'application/octet-stream', source: item.source || path, sha256: hash(content), bytes: content.length, readTool: item.mimeType?.startsWith('image/') ? 'material_image' : 'material_read' }; }));
    await this.record('material_index', { ids: values.map(item => item.id) }); return values;
  }
  async readMaterial(id: string, offset = 0, length = 2000): Promise<{ id: string; content: string; offset: number; nextOffset: number | null; totalCharacters: number; sha256: string; sourceSha256: string; source: string; readAt: string }> {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(length) || length < 1 || length > 262_144) throw new Error('Invalid material range');
    const item = this.material(id); const sourcePath = await this.confined(item.path);
    if (!item.extractedTextPath && /^(image\/|application\/(pdf|vnd\.openxmlformats))/.test(item.mimeType || '')) throw new Error('Binary material requires material_image or an extracted text artifact');
    const path = await this.confined(item.extractedTextPath || item.path); const original = await readFile(sourcePath); const bytes = await readFile(path); const full = bytes.toString('utf8');
    const content = full.slice(offset, offset + length); const result = { id, content, offset, nextOffset: offset + content.length < full.length ? offset + content.length : null, totalCharacters: full.length, sha256: hash(bytes), sourceSha256: hash(original), source: item.source || sourcePath, readAt: new Date().toISOString() };
    await this.record('material_read', { id, offset, length: content.length, sha256: result.sha256 }); return result;
  }
  async readImage(id: string): Promise<{ id: string; path: string; mimeType: string; data: string; sha256: string; source: string; readAt: string }> {
    const item = this.material(id); const path = await this.confined(item.path); const bytes = await readFile(path);
    const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' ? 'image/webp' : null;
    if (!mimeType) throw new Error('Unsupported image bytes; PNG, JPEG or WebP required');
    if (bytes.length > 20 * 1024 * 1024) throw new Error('Image exceeds the explicit 20MB tool payload limit');
    const result = { id, path, mimeType, data: bytes.toString('base64'), sha256: hash(bytes), source: item.source || path, readAt: new Date().toISOString() };
    await this.record('material_image', { id, path, sha256: result.sha256 }); return result;
  }
  private officialUrl(value: string): URL {
    const url = new URL(value); const hosts = this.config.officialHosts || ['antigravity.google', 'modelcontextprotocol.io', 'nodejs.org', 'docs.docker.com', 'docs.python.org', 'playwright.dev'];
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) throw new Error('Research URL must use HTTPS on an explicitly allowed official host');
    return url;
  }
  async readResearch(value: string,offset=0,length=2000): Promise<{ source: string; fetchedAt: string; sha256: string; content: string; links: string[]; evidencePath: string; offset:number;nextOffset:number|null;totalCharacters:number }> {
    if(!Number.isInteger(offset)||offset<0||!Number.isInteger(length)||length<1||length>32768)throw new Error('Invalid official material range');
    this.officialUrl(value);
    const slice=async(record:{source:string;fetchedAt:string;sha256:string;content:string;links:string[];evidencePath:string})=>{const content=record.content.slice(offset,offset+length);await this.record('research_read',{source:record.source,fetchedAt:record.fetchedAt,sha256:record.sha256,evidencePath:record.evidencePath,offset,length:content.length,totalCharacters:record.content.length});return {...record,links:record.links.slice(0,8),content,offset,nextOffset:offset+content.length<record.content.length?offset+content.length:null,totalCharacters:record.content.length};};
    const cached=this.researchCache.get(value);if(cached)return slice(cached);
    let url = this.officialUrl(value); let response: Response | undefined;
    for (let count = 0; count <= 4; count++) {
      response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) { url = this.officialUrl(new URL(response.headers.get('location')!, url).href); continue; }
      break;
    }
    if (!response?.ok) throw new Error(`Official research fetch failed (${response?.status ?? 'no response'})`);
    const reader = response.body?.getReader(); if (!reader) throw new Error('Empty research body');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > 2_097_152) { await reader.cancel(); throw new Error('Official page exceeds the explicit 2MB tool payload limit'); } chunks.push(chunk.value); }
    const raw = Buffer.concat(chunks).toString('utf8'); const fetchedAt = new Date().toISOString(); const sha256 = hash(raw);
    const content=/(?:text\/html|<html|<!doctype)/i.test((response.headers.get('content-type')??'')+raw.slice(0,300))?readableResearchContent(raw):raw;
    const links = [...raw.matchAll(/href=["']([^"']+)["']/g)].flatMap(match => { try { return [this.officialUrl(new URL(match[1]!, url).href).href]; } catch { return []; } });
    await mkdir(this.config.evidenceRoot, { recursive: true }); const evidencePath = join(this.config.evidenceRoot, `research-${sha256}.txt`); await writeFile(evidencePath, raw);await writeFile(join(this.config.evidenceRoot,`research-${sha256}.readable.txt`),content);
    const record={source:url.href,fetchedAt,sha256,content,links:[...new Set(links)],evidencePath};this.researchCache.set(value,record);return slice(record);
  }
  async recordEvidence(input: EvidenceInput): Promise<{ id: string; source: string; capturedAt: string; sha256: string; scope: string; path: string; approval: 'candidate' }> {
    if (!input.source || !input.scope || !input.content) throw new Error('Evidence requires source, scope and content');
    const id = `evidence-${randomUUID()}`; const path = join(this.config.evidenceRoot, `${id}.json`); const record = { id, source: input.source, capturedAt: new Date().toISOString(), sha256: hash(input.content), scope: input.scope, path, approval: 'candidate' as const };
    await mkdir(this.config.evidenceRoot, { recursive: true }); await writeFile(path, JSON.stringify({ ...record, content: input.content, conclusion: input.conclusion }, null, 2)); await this.record('evidence_record', record); return record;
  }
  private image(runtime: ExperimentRuntime, usePrepared = true): string {
    const environmentPath = join(this.config.experimentRoot, '.environments', `${runtime}.json`);
    const prepared = usePrepared && existsSync(environmentPath) ? (JSON.parse(readFileSync(environmentPath, 'utf8')) as { image?: string }).image : undefined;
    const image = prepared || this.config.images?.[runtime] || DEFAULT_IMAGES[runtime];
    if (!/^[a-z0-9][a-z0-9./_-]*:[a-zA-Z0-9._-]+(?:@sha256:[a-f0-9]{64})?$/.test(image)) throw new Error('Image must be an explicitly versioned container reference'); return image;
  }
  private docker(args: string[], logPath: string, timeoutMs: number, abortSignal?: AbortSignal): Promise<{ code: number | null; output: string; reason?: string; cancelled?: boolean }> {
    return new Promise(done => {
      const child = spawn(this.config.dockerExecutable || 'docker', args, { shell: false, windowsHide: true, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP } });
      let output = ''; let settled = false; let writes = Promise.resolve();
      const kill = () => { if (child.pid && process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, timeout: 5000, stdio: 'ignore' }); else child.kill('SIGKILL'); };
      const finish = (value: { code: number | null; output?: string; reason?: string; cancelled?: boolean }, terminate = false) => { if (settled) return; settled = true; clearTimeout(timer); abortSignal?.removeEventListener('abort', abort); if (terminate) kill(); void writes.then(() => done({ output, ...value })).catch(error => done({ code: null, output, reason: `Experiment log failed: ${String(error)}` })); };
      const abort = () => finish({ code: null, cancelled: true, reason: 'Cancelled' }, true);
      const timer = setTimeout(() => finish({ code: null, reason: `Experiment command timed out after ${timeoutMs}ms` }, true), timeoutMs);
      const collect = (stream: string, chunk: Buffer) => { output = (output + chunk.toString()).slice(-65536); writes = writes.then(() => appendFile(logPath, JSON.stringify({ at: new Date().toISOString(), stream, data: chunk.toString() }) + '\n')); };
      child.stdout.on('data', chunk => collect('stdout', chunk)); child.stderr.on('data', chunk => collect('stderr', chunk)); child.on('error', error => finish({ code: null, reason: error.message })); child.on('close', code => finish({ code }));
      if (abortSignal?.aborted) abort(); else abortSignal?.addEventListener('abort', abort, { once: true });
    });
  }
  /** Explicit online preparation builds only fixed package-manager commands. Submitted
   * experiment source never enters this build context and executes only offline. */
  async prepareEnvironment(runtime: ExperimentRuntime, abortSignal?: AbortSignal, dependencies: PreparedDependency[] = []): Promise<{ status: 'available' | 'unavailable' | 'cancelled'; image: string; logPath: string; reason?: string }> {
    const required = [...dependencies, ...(runtime === 'chromium' ? [{ name: 'playwright', version: '1.56.1' }] : [])];
    if (required.some(dep => !/^(?:@[a-z0-9._-]+\/)?[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(dep.name) || !/^\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.-]+)?$/.test(dep.version))) throw new Error('Dependencies require explicit package names and exact versions; URLs, paths and ranges are disabled');
    let image = this.image(runtime, false); await mkdir(this.config.experimentRoot, { recursive: true }); const logPath = join(this.config.experimentRoot, `prepare-${randomUUID()}.ndjson`);
    const probe = await this.docker(['version', '--format', '{{.Server.Version}}'], logPath, 15_000, abortSignal);
    if (probe.code !== 0) { const result = { status: probe.cancelled ? 'cancelled' as const : 'unavailable' as const, image, logPath, reason: probe.reason || probe.output }; await this.record('environment_prepare', result); return result; }
    const pull = await this.docker(['pull', image], logPath, 600_000, abortSignal);
    if (pull.code !== 0) { const result = { status: pull.cancelled ? 'cancelled' as const : 'unavailable' as const, image, logPath, reason: pull.reason || pull.output }; await this.record('environment_prepare', result); return result; }
    if (required.length) {
      const environmentDirectory = join(this.config.experimentRoot, '.environments', `build-${randomUUID()}`); await mkdir(environmentDirectory, { recursive: true });
      const command = runtime === 'python' ? ['python', '-m', 'pip', 'install', '--only-binary=:all:', ...required.map(dep => `${dep.name}==${dep.version}`)] : ['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', '/opt/pa-runtime', ...required.map(dep => `${dep.name}@${dep.version}`)];
      const dockerfile = `FROM ${image}\nRUN ${JSON.stringify(command)}\n${runtime === 'python' ? '' : 'ENV NODE_PATH=/opt/pa-runtime/node_modules\n'}`;
      await writeFile(join(environmentDirectory, 'Dockerfile'), dockerfile); await writeFile(join(environmentDirectory, 'dependencies.json'), JSON.stringify(required, null, 2));
      image = `project-architect-${runtime}:${hash(dockerfile).slice(0, 16)}`;
      const build = await this.docker(['build', '--network', 'default', '--tag', image, environmentDirectory], logPath, 600_000, abortSignal);
      if (build.code !== 0) { const result = { status: build.cancelled ? 'cancelled' as const : 'unavailable' as const, image, logPath, reason: build.reason || build.output }; await this.record('environment_prepare', result); return result; }
      await writeFile(join(this.config.experimentRoot, '.environments', `${runtime}.json`), JSON.stringify({ image, dependencies: required, preparedAt: new Date().toISOString(), logPath }, null, 2));
    }
    const result = { status: 'available' as const, image, logPath }; await this.record('environment_prepare', result); return result;
  }
  async runExperiment(input: ExperimentInput): Promise<ExperimentResult> {
    if (!['node', 'python', 'chromium'].includes(input.runtime)) throw new Error('Unknown experiment runtime');
    if (!input.source.trim() || Buffer.byteLength(input.source) > 1_048_576) throw new Error('Experiment source is required and limited to 1MB');
    const id = `experiment-${randomUUID()}`; const directory = join(this.config.experimentRoot, id); await mkdir(directory, { recursive: true });
    const canonicalRoot = await realpath(this.config.experimentRoot); const canonicalDirectory = await realpath(directory);
    if (!contained(canonicalRoot, canonicalDirectory) || canonicalRoot === canonicalDirectory) throw new Error('Experiment path escaped its independent root');
    if (canonicalDirectory.includes(',')) throw new Error('Experiment mount path contains an unsupported Docker delimiter');
    const materialRoots = await Promise.all(this.config.materialRoots.map(root => realpath(root)));
    if (materialRoots.some(root => contained(root, canonicalDirectory) || contained(canonicalDirectory, root))) throw new Error('Experiment mount overlaps a material root');
    const image = this.image(input.runtime); const logPath = join(directory, 'events.ndjson'); const startedAt = new Date().toISOString(); const sourceName = input.runtime === 'python' ? 'main.py' : 'main.mjs'; await writeFile(join(directory, sourceName), input.source);
    const environment: ExperimentResult['environment'] = { runtime: input.runtime, image, network: 'none' };
    const save = async (status: ExperimentResult['status'], exitCode: number | null, reason?: string) => { const result: ExperimentResult = { id, status, exitCode, directory, logPath, environment, startedAt, completedAt: new Date().toISOString(), ...(reason ? { reason } : {}) }; await writeFile(join(directory, 'result.json'), JSON.stringify(result, null, 2)); await this.record('experiment_result', result); return result; };
    const probe = await this.docker(['image', 'inspect', '--format', '{{.Id}}', image], logPath, 15_000, input.abortSignal);
    if (probe.code !== 0) return save(probe.cancelled ? 'cancelled' : 'unavailable', probe.code, probe.reason || probe.output);
    environment.imageId = probe.output.trim();
    const name = `pa-${randomUUID()}`;
    const runtimeArgs = input.runtime === 'python' ? ['python', '-B', `/experiment/${sourceName}`] : input.runtime === 'chromium' ? ['node', '--input-type=module', '-e', `const {chromium}=await import('/opt/pa-runtime/node_modules/playwright/index.mjs'); globalThis.browser=await chromium.launch({headless:true,args:['--no-sandbox']}); try{await import('/experiment/main.mjs')}finally{await browser.close()}`] : ['node', `/experiment/${sourceName}`];
    const args = ['run', '--rm', '--name', name, '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '128', '--memory', '1g', '--cpus', '1', '--tmpfs', '/tmp:rw,noexec,nosuid,size=256m', '--mount', `type=bind,source=${canonicalDirectory},target=/experiment,readonly`, '--workdir', '/experiment', '--env', 'HOME=/tmp', ...(input.runtime === 'chromium' ? ['--ipc', 'private'] : ['--user', '65534:65534']), image, ...runtimeArgs];
    await writeFile(join(directory, 'environment.json'), JSON.stringify({ ...environment, command: args, sourceSha256: hash(input.source) }, null, 2));
    const run = await this.docker(args, logPath, Math.max(1000, Math.min(input.timeoutMs ?? 60_000, 600_000)), input.abortSignal);
    // Killing the local Docker client does not stop its daemon-side container.
    if (run.cancelled || run.reason) await this.docker(['rm', '--force', name], logPath, 15_000);
    return save(run.cancelled ? 'cancelled' : run.code === 0 ? 'pass' : 'fail', run.code, run.reason || (run.code === 0 ? undefined : run.output));
  }
}
