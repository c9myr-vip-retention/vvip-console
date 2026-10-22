// One API object for the Schedule page: the real client (src/revamp/api/work.js), or the fixtures when localStorage.revamp_mock === "1".
import { work } from "../api/work.js";
import * as mock from "./fixtures.js";

export const isMock = () => { try { return localStorage.getItem("revamp_mock") === "1"; } catch { return false; } };
const pick = (real, fake) => (...a) => (isMock() ? fake(...a) : real(...a));

export const api = {
  setMe: (me) => { if (isMock()) mock.setMe(me); },
  people: pick(() => work.people(), mock.people),
  schedule: pick((f, t) => work.schedule(f, t), mock.schedule),
  addItems: pick((l) => work.addScheduleItems(l), mock.addScheduleItems),
  updateItem: pick((id, b) => work.updateScheduleItem(id, b), mock.updateScheduleItem),
  deleteItem: pick((id) => work.deleteScheduleItem(id), mock.deleteScheduleItem),
  deleteMany: pick((b) => work.deleteScheduleItems(b), mock.deleteScheduleItems),
  addType: pick((b) => work.addScheduleType(b), mock.addScheduleType),
  addShift: pick((b) => work.addShiftPreset(b), mock.addShiftPreset),
  updateShift: pick((k, b) => work.updateShiftPreset(k, b), mock.updateShiftPreset),
  deleteShift: pick((k) => work.deleteShiftPreset(k), mock.deleteShiftPreset),
  requestSwap: pick((id, note) => work.requestSwap(id, note), mock.requestSwap),
  swaps: pick(() => work.swaps(), mock.swapsList),
  decideSwap: pick((id, s) => work.decideSwap(id, s), mock.decideSwap),
};
