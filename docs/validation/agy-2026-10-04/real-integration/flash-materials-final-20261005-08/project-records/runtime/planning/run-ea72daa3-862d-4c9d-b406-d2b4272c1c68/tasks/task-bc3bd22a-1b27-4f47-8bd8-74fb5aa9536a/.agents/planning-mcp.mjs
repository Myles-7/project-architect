import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-mJswsX\\materials\\runtime\\planning\\run-ea72daa3-862d-4c9d-b406-d2b4272c1c68\\tasks\\task-bc3bd22a-1b27-4f47-8bd8-74fb5aa9536a\\.agents\\planning-tools.json",'utf8')));
