import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-xb3uFL\\materials\\runtime\\planning\\run-74f4dbbe-386f-446e-ae39-69f23c31893a\\tasks\\task-de9a51b5-525f-4534-a086-f9238833dcad\\.agents\\planning-tools.json",'utf8')));
