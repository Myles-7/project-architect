import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-EYMmL3\\vague\\runtime\\planning\\run-c2d38ebc-b4ee-41c1-98cd-a4ab1be01fdf\\tasks\\task-a5708e74-60b4-47ac-86e6-a0900c1f08ea\\.agents\\planning-tools.json",'utf8')));
