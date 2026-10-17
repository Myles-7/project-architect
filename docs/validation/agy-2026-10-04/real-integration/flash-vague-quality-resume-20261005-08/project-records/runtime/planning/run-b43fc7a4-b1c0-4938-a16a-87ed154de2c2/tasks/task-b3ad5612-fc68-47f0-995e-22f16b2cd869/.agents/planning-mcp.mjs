import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-EYMmL3\\vague\\runtime\\planning\\run-b43fc7a4-b1c0-4938-a16a-87ed154de2c2\\tasks\\task-b3ad5612-fc68-47f0-995e-22f16b2cd869\\.agents\\planning-tools.json",'utf8')));
