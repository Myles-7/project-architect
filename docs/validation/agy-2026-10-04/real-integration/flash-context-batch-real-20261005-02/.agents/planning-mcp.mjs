import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/.validation/context-batch-build-v2-20261005/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\桌面\\项目构思\\docs\\validation\\agy-2026-10-04\\real-integration\\flash-context-batch-real-20261005-02\\.agents\\planning-tools.json",'utf8')));
