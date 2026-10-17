import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-quality-copy-94H5Ow\\materials\\runtime\\planning\\run-628f9e7b-e73e-41c0-8d7a-958179616dca\\tasks\\task-a0e5f34e-6ac5-4568-b105-fa6f086eac8d\\.agents\\planning-tools.json",'utf8')));
