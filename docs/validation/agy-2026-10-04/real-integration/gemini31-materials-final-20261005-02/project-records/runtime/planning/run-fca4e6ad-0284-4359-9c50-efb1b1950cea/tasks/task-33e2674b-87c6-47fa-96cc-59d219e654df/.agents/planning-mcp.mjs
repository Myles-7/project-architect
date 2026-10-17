import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-hNZPps\\materials\\runtime\\planning\\run-fca4e6ad-0284-4359-9c50-efb1b1950cea\\tasks\\task-33e2674b-87c6-47fa-96cc-59d219e654df\\.agents\\planning-tools.json",'utf8')));
