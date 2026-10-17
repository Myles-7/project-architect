import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-ueIZBt\\vague\\runtime\\planning\\run-1e2cf17c-8da9-489d-986b-21d4f161acbd\\tasks\\task-87004353-d8ba-4f01-b174-bcb35e2fb8a4\\.agents\\planning-tools.json",'utf8')));
