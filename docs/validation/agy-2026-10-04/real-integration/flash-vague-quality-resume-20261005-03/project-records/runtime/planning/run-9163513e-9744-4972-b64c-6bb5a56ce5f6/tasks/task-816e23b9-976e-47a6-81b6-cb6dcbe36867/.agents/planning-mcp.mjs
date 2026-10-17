import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-EYMmL3\\vague\\runtime\\planning\\run-9163513e-9744-4972-b64c-6bb5a56ce5f6\\tasks\\task-816e23b9-976e-47a6-81b6-cb6dcbe36867\\.agents\\planning-tools.json",'utf8')));
