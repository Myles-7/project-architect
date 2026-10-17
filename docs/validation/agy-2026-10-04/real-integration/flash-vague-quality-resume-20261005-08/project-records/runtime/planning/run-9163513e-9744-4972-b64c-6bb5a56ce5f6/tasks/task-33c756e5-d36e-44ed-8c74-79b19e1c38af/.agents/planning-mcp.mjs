import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-EYMmL3\\vague\\runtime\\planning\\run-9163513e-9744-4972-b64c-6bb5a56ce5f6\\tasks\\task-33c756e5-d36e-44ed-8c74-79b19e1c38af\\.agents\\planning-tools.json",'utf8')));
