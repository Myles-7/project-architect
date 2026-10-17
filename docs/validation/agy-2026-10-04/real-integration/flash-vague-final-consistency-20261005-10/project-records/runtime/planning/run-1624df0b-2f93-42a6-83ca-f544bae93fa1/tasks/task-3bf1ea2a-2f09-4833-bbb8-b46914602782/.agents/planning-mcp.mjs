import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-EYMmL3\\vague\\runtime\\planning\\run-1624df0b-2f93-42a6-83ca-f544bae93fa1\\tasks\\task-3bf1ea2a-2f09-4833-bbb8-b46914602782\\.agents\\planning-tools.json",'utf8')));
