import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-AiRDUO\\项目构思\\runtime\\planning\\run-17d98e59-12ea-4a62-8cdf-8b4e2911cd23\\tasks\\task-26bd0084-a129-4d4c-8ee1-6c1907078587\\.agents\\planning-tools.json",'utf8')));
