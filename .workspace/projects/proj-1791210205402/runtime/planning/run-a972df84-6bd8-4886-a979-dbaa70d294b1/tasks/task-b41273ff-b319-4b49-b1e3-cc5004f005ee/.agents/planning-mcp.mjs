import {readFile} from 'node:fs/promises';
import {startPlanningToolsStdio} from "file:///D:/%E6%A1%8C%E9%9D%A2/%E9%A1%B9%E7%9B%AE%E6%9E%84%E6%80%9D/packages/agent/dist/tools/PlanningToolsMcpServer.js";
await startPlanningToolsStdio(JSON.parse(await readFile("D:\\桌面\\项目构思\\.workspace\\projects\\proj-1791210205402\\runtime\\planning\\run-a972df84-6bd8-4886-a979-dbaa70d294b1\\tasks\\task-b41273ff-b319-4b49-b1e3-cc5004f005ee\\.agents\\planning-tools.json",'utf8')));
