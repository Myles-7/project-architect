import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-vCIqFr\\vague\\runtime\\planning\\run-46fba887-806c-4cf6-aa3e-5fb39de4471f\\tasks\\task-0a67dab6-402e-4b7b-8435-4856955883e6\\.agents\\planning-tools.json",'utf8')));
