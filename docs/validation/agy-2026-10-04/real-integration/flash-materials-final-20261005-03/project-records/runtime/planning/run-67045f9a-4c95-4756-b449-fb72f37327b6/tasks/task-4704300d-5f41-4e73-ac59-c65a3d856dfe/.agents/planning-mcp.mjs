import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-AiRDUO\\项目构思\\runtime\\planning\\run-67045f9a-4c95-4756-b449-fb72f37327b6\\tasks\\task-4704300d-5f41-4e73-ac59-c65a3d856dfe\\.agents\\planning-tools.json",'utf8')));
