import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-NFD8mD\\materials\\runtime\\planning\\run-80094931-1ed4-4b40-bfe3-14a90886e7da\\tasks\\task-1a9bf758-f6a0-4d95-8a9e-6ada83374a83\\.agents\\planning-tools.json",'utf8')));
