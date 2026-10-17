import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-publish-N6k3tL\\projects\\proj-1791129999032\\runtime\\planning\\run-c0db49e0-1a0c-42d1-8771-8a8ee2cd2a83\\tasks\\task-a72f2869-4fbe-4520-8f39-de8981fb0ebb\\.agents\\planning-tools.json",'utf8')));
