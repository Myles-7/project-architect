import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-EYMmL3\\vague\\runtime\\planning\\run-a28bf7b6-44c3-4461-be52-0f24fe6081f4\\tasks\\task-00d411d8-7a03-4b80-9c2f-a8d04d90e6c4\\.agents\\planning-tools.json",'utf8')));
