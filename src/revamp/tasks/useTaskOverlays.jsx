// Task drawer + New task popup for a page, plus the global events the work-setup pages dispatch:
//   rv-new-task  detail { template_id } | { flow_id } | { project_id }   -> open the New task popup, prefilled
//   rv-open-task detail { id }                                          -> open the task drawer
// A page calls this hook once and renders `overlays`.
import React, { useEffect, useRef, useState } from "react";
import TaskPanel from "./TaskPanel.jsx";
import NewTaskModal from "./NewTaskModal.jsx";

export default function useTaskOverlays({ me, people, projects, tasks, onChange }) {
  const [openId, setOpenId] = useState(null);
  const [nt, setNt] = useState(null);                 // null | initial prefill object
  const ch = useRef(onChange); ch.current = onChange;

  useEffect(() => {
    const a = (e) => { const id = Number(e.detail?.id); if (id) setOpenId(id); };
    const b = (e) => setNt(e.detail || {});
    window.addEventListener("rv-open-task", a); window.addEventListener("rv-new-task", b);
    return () => { window.removeEventListener("rv-open-task", a); window.removeEventListener("rv-new-task", b); };
  }, []);

  const overlays = (
    <>
      {openId !== null && <TaskPanel id={openId} me={me} people={people} projects={projects} tasks={tasks} onClose={() => setOpenId(null)} onOpen={setOpenId} onChange={() => ch.current && ch.current()} />}
      {nt !== null && <NewTaskModal me={me} people={people} projects={projects} initial={nt} onClose={() => setNt(null)} onCreated={() => ch.current && ch.current()} />}
    </>
  );
  return { overlays, openTask: setOpenId, newTask: (initial = {}) => setNt(initial) };
}
