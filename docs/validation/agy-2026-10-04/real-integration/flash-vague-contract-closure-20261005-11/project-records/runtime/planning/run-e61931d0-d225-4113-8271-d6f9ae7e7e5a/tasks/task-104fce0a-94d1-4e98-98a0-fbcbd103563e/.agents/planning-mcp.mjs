import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-tkyU3y\\vague\\runtime\\planning\\run-e61931d0-d225-4113-8271-d6f9ae7e7e5a\\tasks\\task-104fce0a-94d1-4e98-98a0-fbcbd103563e\\.agents\\planning-tools.json",'utf8')));
