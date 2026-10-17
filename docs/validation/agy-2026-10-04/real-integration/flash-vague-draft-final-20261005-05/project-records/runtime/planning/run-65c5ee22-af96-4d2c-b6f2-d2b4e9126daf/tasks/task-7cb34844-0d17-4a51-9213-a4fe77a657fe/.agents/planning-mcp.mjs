import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-EYMmL3\\vague\\runtime\\planning\\run-65c5ee22-af96-4d2c-b6f2-d2b4e9126daf\\tasks\\task-7cb34844-0d17-4a51-9213-a4fe77a657fe\\.agents\\planning-tools.json",'utf8')));
