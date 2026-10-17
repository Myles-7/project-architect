import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-wLmf6U\\vague\\runtime\\planning\\run-0590a6d7-0b0d-4992-bf21-360c582eb7b6\\tasks\\task-9b05ef0b-d2f0-455b-85e0-e107c2430214\\.agents\\planning-tools.json",'utf8')));
