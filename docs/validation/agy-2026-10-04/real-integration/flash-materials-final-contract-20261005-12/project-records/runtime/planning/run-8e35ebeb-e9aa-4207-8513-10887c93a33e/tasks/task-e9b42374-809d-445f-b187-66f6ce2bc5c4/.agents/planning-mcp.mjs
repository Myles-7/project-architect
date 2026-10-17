import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-A7Ubqe\\materials\\runtime\\planning\\run-8e35ebeb-e9aa-4207-8513-10887c93a33e\\tasks\\task-e9b42374-809d-445f-b187-66f6ce2bc5c4\\.agents\\planning-tools.json",'utf8')));
