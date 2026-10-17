import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-6YJuk0\\materials\\runtime\\planning\\run-167084dd-7b42-4c3b-a43c-0fae51d1040a\\tasks\\task-33fb7ec3-42bf-4909-8c96-e1b61514f90d\\.agents\\planning-tools.json",'utf8')));
