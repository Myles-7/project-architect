import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-oJp8aj\\vague\\runtime\\planning\\run-d568e599-2b93-4bc1-bc3c-03e6b741c26c\\tasks\\task-e519b30a-0946-43f7-ae08-5077ac8e4c01\\.agents\\planning-tools.json",'utf8')));
