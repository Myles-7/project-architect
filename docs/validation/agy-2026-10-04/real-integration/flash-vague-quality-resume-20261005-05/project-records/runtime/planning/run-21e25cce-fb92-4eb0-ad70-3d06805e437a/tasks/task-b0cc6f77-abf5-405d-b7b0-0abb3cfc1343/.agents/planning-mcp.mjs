import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-EYMmL3\\vague\\runtime\\planning\\run-21e25cce-fb92-4eb0-ad70-3d06805e437a\\tasks\\task-b0cc6f77-abf5-405d-b7b0-0abb3cfc1343\\.agents\\planning-tools.json",'utf8')));
