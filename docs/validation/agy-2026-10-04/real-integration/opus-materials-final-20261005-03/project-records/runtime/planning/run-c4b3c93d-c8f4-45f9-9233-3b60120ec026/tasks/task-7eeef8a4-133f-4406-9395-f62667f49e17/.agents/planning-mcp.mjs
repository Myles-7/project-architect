import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-9oe0qv\\materials\\runtime\\planning\\run-c4b3c93d-c8f4-45f9-9233-3b60120ec026\\tasks\\task-7eeef8a4-133f-4406-9395-f62667f49e17\\.agents\\planning-tools.json",'utf8')));
