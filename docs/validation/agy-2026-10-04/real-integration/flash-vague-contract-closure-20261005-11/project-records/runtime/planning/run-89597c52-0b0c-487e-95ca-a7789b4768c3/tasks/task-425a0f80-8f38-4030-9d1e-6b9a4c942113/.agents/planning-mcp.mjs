import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-V5HCMO\\vague\\runtime\\planning\\run-89597c52-0b0c-487e-95ca-a7789b4768c3\\tasks\\task-425a0f80-8f38-4030-9d1e-6b9a4c942113\\.agents\\planning-tools.json",'utf8')));
