import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-LF8ohl\\vague\\runtime\\planning\\run-899cca55-7931-45ae-867a-3e51a822cd9b\\tasks\\task-40b153b3-9c78-48c4-8fb0-97240a48c76f\\.agents\\planning-tools.json",'utf8')));
