import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-AiRDUO\\项目构思\\runtime\\planning\\run-61512c88-a371-461b-be4a-0a18237f2b2e\\tasks\\task-950d1e71-3df2-4504-9d63-bbe334fe095e\\.agents\\planning-tools.json",'utf8')));
