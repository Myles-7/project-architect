import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\Temp\\User\\pa-real-integration-U51Xi0\\materials\\runtime\\planning\\run-e3cfb368-906f-4169-ad6e-1892fd2ca235\\tasks\\task-171344fc-c3e0-411f-b66c-bd33dfe86daf\\.agents\\planning-tools.json",'utf8')));
