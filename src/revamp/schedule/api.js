// One door for the Schedule page: the real API (work.*) or, when localStorage.revamp_mock === "1", the fixtures.
import { work } from "../api/work.js";
import { mockApi } from "./fixtures.js";

const mocked = () => { try { return localStorage.getItem("revamp_mock") === "1"; } catch { return false; } };
const pick = (live, mock) => (...a) => (mocked() ? mock : live)(...a);

export const sched = {
  people: pick(() => work.people(), () => mockApi.people()),
  load: pick((from, to) => work.schedule(from, to), () => mockApi.schedule()),
  add: pick((items) => work.addScheduleItems(items), (items) => mockApi.addItems(items)),
  update: pick((id, b) => work.updateScheduleItem(id, b), (id, b) => mockApi.updateItem(id, b)),
  remove: pick((id) => work.deleteScheduleItem(id), (id) => mockApi.deleteItem(id)),
  addType: pick((b) => work.addScheduleType(b), (b) => mockApi.addType(b)),
  requestSwap: pick((id, note) => work.requestSwap(id, note), (id, note) => mockApi.requestSwap(id, note)),
  swaps: pick(() => work.swaps(), () => mockApi.swaps()),
  decideSwap: pick((id, st) => work.decideSwap(id, st), (id, st) => mockApi.decideSwap(id, st)),
};
export const isMock = mocked;
