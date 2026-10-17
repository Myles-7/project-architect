import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-RJKkqZ\\materials\\runtime\\planning\\run-5c440d90-be7f-40d0-a561-5a4d8dd508c5\\tasks\\task-251e5a5a-7992-44e8-9a54-94ac8477d73e\\.agents\\planning-tools.json",'utf8')));
