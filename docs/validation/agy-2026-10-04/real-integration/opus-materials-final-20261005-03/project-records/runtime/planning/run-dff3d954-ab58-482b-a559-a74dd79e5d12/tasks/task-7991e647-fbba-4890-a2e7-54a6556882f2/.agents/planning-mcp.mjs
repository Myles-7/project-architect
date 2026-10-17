import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-KljO4N\\materials\\runtime\\planning\\run-dff3d954-ab58-482b-a559-a74dd79e5d12\\tasks\\task-7991e647-fbba-4890-a2e7-54a6556882f2\\.agents\\planning-tools.json",'utf8')));
