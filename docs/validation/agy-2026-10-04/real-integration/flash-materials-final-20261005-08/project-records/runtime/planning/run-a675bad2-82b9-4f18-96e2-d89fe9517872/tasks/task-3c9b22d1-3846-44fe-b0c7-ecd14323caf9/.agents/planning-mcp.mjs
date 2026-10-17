import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-70XBDp\\materials\\runtime\\planning\\run-a675bad2-82b9-4f18-96e2-d89fe9517872\\tasks\\task-3c9b22d1-3846-44fe-b0c7-ecd14323caf9\\.agents\\planning-tools.json",'utf8')));
