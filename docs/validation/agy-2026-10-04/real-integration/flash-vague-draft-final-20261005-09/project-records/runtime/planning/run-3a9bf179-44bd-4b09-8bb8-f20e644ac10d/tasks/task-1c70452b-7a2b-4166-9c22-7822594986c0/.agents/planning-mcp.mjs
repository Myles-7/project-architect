import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-EYMmL3\\vague\\runtime\\planning\\run-3a9bf179-44bd-4b09-8bb8-f20e644ac10d\\tasks\\task-1c70452b-7a2b-4166-9c22-7822594986c0\\.agents\\planning-tools.json",'utf8')));
