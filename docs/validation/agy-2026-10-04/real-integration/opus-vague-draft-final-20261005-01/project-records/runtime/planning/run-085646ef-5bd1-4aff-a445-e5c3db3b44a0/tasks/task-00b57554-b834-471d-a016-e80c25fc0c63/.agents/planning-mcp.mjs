import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-w6WyXd\\vague\\runtime\\planning\\run-085646ef-5bd1-4aff-a445-e5c3db3b44a0\\tasks\\task-00b57554-b834-471d-a016-e80c25fc0c63\\.agents\\planning-tools.json",'utf8')));
