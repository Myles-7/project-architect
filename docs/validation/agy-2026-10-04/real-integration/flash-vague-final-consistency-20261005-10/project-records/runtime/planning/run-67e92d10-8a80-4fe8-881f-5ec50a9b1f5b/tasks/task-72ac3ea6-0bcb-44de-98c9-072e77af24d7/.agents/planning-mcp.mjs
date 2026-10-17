import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-AA2hmZ\\vague\\runtime\\planning\\run-67e92d10-8a80-4fe8-881f-5ec50a9b1f5b\\tasks\\task-72ac3ea6-0bcb-44de-98c9-072e77af24d7\\.agents\\planning-tools.json",'utf8')));
