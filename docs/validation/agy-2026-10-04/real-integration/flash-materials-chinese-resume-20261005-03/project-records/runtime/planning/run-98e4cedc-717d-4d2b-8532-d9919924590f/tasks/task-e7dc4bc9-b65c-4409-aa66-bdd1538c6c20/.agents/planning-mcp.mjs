import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-AiRDUO\\项目构思\\runtime\\planning\\run-98e4cedc-717d-4d2b-8532-d9919924590f\\tasks\\task-e7dc4bc9-b65c-4409-aa66-bdd1538c6c20\\.agents\\planning-tools.json",'utf8')));
