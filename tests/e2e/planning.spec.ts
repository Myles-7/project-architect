import { test,expect } from '@playwright/test';

test('idea → keyboard choice → three stage approvals → document preview and ZIP',async({page,request})=>{
  await page.goto('/');await page.locator('#idea-input').fill('  我想做一个个人笔记工具。\n');
  const created=page.waitForResponse(r=>r.url().endsWith('/api/projects')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'开始澄清构思'}).click();const project=(await (await created).json()).data.projectId;
  await expect(page.getByRole('region',{name:'待回答的问题'})).toBeVisible();
  await expect(page.getByRole('radio').first()).toBeInViewport();
  await expect(page.getByRole('button',{name:'生成产品与体验草案'})).toBeDisabled();
  expect(await page.getByRole('radio').count()).toBe(2);await expect(page.getByRole('radio').first()).not.toBeChecked();
  for(const label of ['做法：','收益：','代价：','影响：','可逆性：'])await expect(page.getByText(label,{exact:false}).first()).toBeVisible();
  await page.screenshot({path:'docs/validation/workbench-questions.png',fullPage:true});
  await page.getByRole('radio').first().focus();await page.keyboard.press('Space');await page.getByRole('button',{name:/提交 1 个回答/}).click();
  await expect(page.getByText('目标与边界已澄清，可以生成产品与体验。',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'生成产品与体验草案'})).toBeEnabled();
  for(const phase of ['产品与体验','技术与接口','任务与验收']){
    await page.getByRole('button',{name:`生成${phase}草案`}).click();
    const approve=page.getByRole('button',{name:/批准选中分组/});await expect(approve).toBeVisible();await expect(approve).toBeDisabled();
    if(phase==='产品与体验')await page.screenshot({path:'docs/validation/workbench-draft.png',fullPage:true});
    if(phase==='产品与体验'){
      await page.getByRole('button',{name:'编辑草案',exact:true}).click();
      await page.locator('.planning-edit-fields').filter({has:page.locator('input[value="笔记管理"]')}).getByRole('checkbox',{name:'批准后锁定此区块'}).check();
      await page.getByRole('button',{name:'保存草案编辑',exact:true}).click();
      await expect(page.getByRole('button',{name:'编辑草案',exact:true})).toBeVisible();
      const pending=(await (await request.get(`/api/projects/${project}/planning`)).json()).data;
      expect(pending.state.blueprint.blocks).toHaveLength(0);
      expect(pending.state.changeSets.at(-1).groups.flatMap((group:any)=>group.blocks).find((block:any)=>block.id==='notes').locked).toBe(true);
    }
    if(phase==='任务与验收'){
      await page.getByRole('button',{name:'编辑草案',exact:true}).click();
      await page.getByText('编辑任务范围、验证与完成条件',{exact:true}).first().click();
      await page.getByRole('textbox',{name:'完成条件（每行一项）',exact:true}).first().fill('重新打开后可读到已保存的正文\n写入失败保留输入，修复故障后重试成功');
      await page.getByRole('button',{name:'保存草案编辑',exact:true}).click();
      await expect(page.getByRole('button',{name:'编辑草案',exact:true})).toBeVisible();
    }
    await page.locator('.planning-group-select input').last().check();await approve.click();
    await expect(page.locator('.planning-changeset')).toHaveCount(0);
  }
  await page.getByRole('button',{name:'生成开发包',exact:true}).click();await expect(page.getByRole('link',{name:'下载开发包 ZIP'})).toBeVisible();
  const view=(await (await request.get(`/api/projects/${project}/planning`)).json()).data;
  expect(view.state.blueprint.blocks.find((block:any)=>block.id==='notes').locked).toBe(true);
  const start=await request.get(`/api/projects/${project}/planning/package/files/START_HERE.md`);expect(start.status()).toBe(200);expect(await start.text()).toContain('首个可执行任务');expect(view.state.package.files).toHaveLength(10);
  const taskData=await request.get(`/api/projects/${project}/planning/package/files/tasks.json`);expect(taskData.status()).toBe(200);expect((await taskData.json()).tasks[0].completionCriteria).toEqual(['重新打开后可读到已保存的正文','写入失败保留输入，修复故障后重试成功']);
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'下载开发包 ZIP'}).click();expect((await download).suggestedFilename()).toContain('.zip');
  await page.getByRole('button',{name:'开发反馈 / 需求变更'}).click();await page.locator('#planning-input').fill('  开发反馈：保存失败时需要明确提示。\n');await page.getByRole('button',{name:'分析变更影响'}).click();await expect(page.getByText('保存提示修订',{exact:true})).toBeVisible();
  await page.locator('.planning-group-select input').last().check();await expect(page.getByRole('button',{name:/批准选中分组/})).toBeDisabled();
  await page.getByRole('checkbox',{name:'解锁：笔记管理'}).check();await expect(page.getByRole('button',{name:/批准选中分组/})).toBeEnabled();await page.getByRole('button',{name:/批准选中分组/}).click();
  await expect(page.locator('.planning-changeset')).toHaveCount(0);
  const changed=(await (await request.get(`/api/projects/${project}/planning`)).json()).data;expect(changed.state.blueprint.blocks.filter((b:any)=>b.id==='notes')).toHaveLength(1);expect(changed.state.blueprint.stages.technical).toBe('needs-revision');expect(changed.state.inputs.at(-1).raw).toBe('  开发反馈：保存失败时需要明确提示。\n');
});

test('delegation is unconfirmed; cancelling and starting again stays operable',async({page,request})=>{
  await page.goto('/');await page.locator('#idea-input').fill('个人笔记工具，普通设计交给 AI。');const created=page.waitForResponse(r=>r.url().endsWith('/api/projects')&&r.request().method()==='POST');await page.getByRole('button',{name:'开始澄清构思'}).click();const id=(await (await created).json()).data.projectId;
  await page.getByRole('button',{name:'委托 AI 提议'}).click();await page.getByRole('button',{name:/提交 1 个回答/}).click();await expect(page.getByText('目标与边界已澄清，可以生成产品与体验。',{exact:true})).toBeVisible();
  const before=(await (await request.get(`/api/projects/${id}`)).json()).data.snapshot;expect(before.decisions.items.filter((d:any)=>d.status==='confirmed')).toHaveLength(0);
  await page.getByRole('button',{name:'生成产品与体验草案'}).click();await page.getByRole('button',{name:'取消运行',exact:true}).click();await expect(page.getByRole('button',{name:'基于当前状态重新运行'})).toBeVisible();await page.getByRole('button',{name:'基于当前状态重新运行'}).click();await expect(page.getByRole('button',{name:/批准选中分组/})).toBeVisible();
});

test('material-only start succeeds and corrupt documents are explicitly reported',async({page})=>{
  await page.goto('/');
  await page.locator('input[type=file]').filter({hasNot:page.locator('[accept=".pa.zip"]')}).first().setInputFiles({name:'bad.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});
  await page.getByRole('button',{name:'开始澄清构思'}).click();
  await expect(page.getByText('初始设置需要检查',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'检查并重新上传材料'})).toBeVisible();
  await expect(page.getByRole('region',{name:'待回答的问题'})).toHaveCount(0);
});

test('review content renders Markdown and clipboard failure stays visible', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('clipboard denied'); } } }));
  await page.goto('/');
  await page.locator('#idea-input').fill('个人笔记工具，检查方案可读性。');
  await page.getByRole('button', { name: '开始澄清构思' }).click();
  await expect(page.getByRole('radio').first()).toBeVisible();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: /提交 1 个回答/ }).click();
  await expect(page.getByRole('button', { name: '生成产品与体验草案' })).toBeEnabled();
  await page.getByRole('button', { name: '生成产品与体验草案' }).click();
  await page.getByRole('button', { name: '编辑草案', exact: true }).click();
  await page.getByRole('textbox', { name: '草案内容', exact: true }).first().fill('## 失败恢复规则\n\n1. **保留草稿**\n2. 显示重试入口\n\n```ts\nkeepDraft();\n```\n\n[安全来源](https://react.dev) [危险链接](javascript:alert)');
  await page.getByRole('button', { name: '保存草案编辑' }).click();
  const preview = page.locator('.planning-after').first();
  await expect(preview.getByRole('heading', { name: '失败恢复规则' })).toBeVisible();
  await expect(preview.locator('ol li')).toHaveCount(2);
  await expect(preview.locator('code')).toHaveText('keepDraft();');
  await expect(preview.getByRole('link', { name: '安全来源' })).toHaveAttribute('href', 'https://react.dev');
  await expect(preview.getByRole('link', { name: '危险链接' })).toHaveCount(0);
  await preview.getByRole('button', { name: '复制', exact: true }).click();
  await expect(page.getByText('复制失败，请选择代码后手动复制。', { exact: true })).toBeVisible();
  await expect(preview.getByRole('button', { name: '已复制', exact: true })).toHaveCount(0);
});
