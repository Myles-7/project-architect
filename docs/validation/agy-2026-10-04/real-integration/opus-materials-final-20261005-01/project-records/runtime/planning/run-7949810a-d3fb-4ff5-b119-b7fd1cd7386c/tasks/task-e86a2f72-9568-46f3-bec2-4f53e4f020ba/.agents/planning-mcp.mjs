import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-RoZ3pP\\materials\\runtime\\planning\\run-7949810a-d3fb-4ff5-b119-b7fd1cd7386c\\tasks\\task-e86a2f72-9568-46f3-bec2-4f53e4f020ba\\.agents\\planning-tools.json",'utf8')));
