import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-EYMmL3\\vague\\runtime\\planning\\run-1624df0b-2f93-42a6-83ca-f544bae93fa1\\tasks\\task-e3bc208e-36c4-4269-9ccf-07903a7a1ed3\\.agents\\planning-tools.json",'utf8')));
