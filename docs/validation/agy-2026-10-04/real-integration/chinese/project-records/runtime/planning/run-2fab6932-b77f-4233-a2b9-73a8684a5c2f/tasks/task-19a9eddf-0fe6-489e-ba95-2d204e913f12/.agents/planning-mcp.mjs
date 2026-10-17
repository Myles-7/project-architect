import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-8vZft4\\项目构思\\runtime\\planning\\run-2fab6932-b77f-4233-a2b9-73a8684a5c2f\\tasks\\task-19a9eddf-0fe6-489e-ba95-2d204e913f12\\.agents\\planning-tools.json",'utf8')));
