import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-hvYzoh\\materials\\runtime\\planning\\run-5385470e-f751-4ebb-a405-62174dc63145\\tasks\\task-7ae33f47-f818-4952-9a1a-c538cd62f05c\\.agents\\planning-tools.json",'utf8')));
