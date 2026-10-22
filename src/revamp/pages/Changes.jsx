// Changes: day-over-day movers. Re-houses the live Delta (Player changes, Movement grid, Lost & gone) unchanged:
// the comparison, mover bands and money totals all come from its own logic (classifyAll on today vs the previous snapshot).
import React from "react";
import { Delta } from "../../App.jsx";
import { Head, Live, Empty } from "../daily2/common.jsx";
import { useDailyBase } from "../daily/hooks.js";

export default function Changes({ ctx }) {
  const base = useDailyBase(ctx);
  if (!base.snap) return <Empty>No snapshot loaded yet.</Empty>;
  return (
    <>
      <Head title="Changes" sub="Who came back, who cooled and who is new since the previous snapshot." />
      <Live>
        <Delta data={base.data} brandOrder={ctx.teamBrands} snap={base.snap} dates={ctx.dates || []} contacts={base.contacts}
          me={base.me} team={base.team} viewTeam={ctx.viewTeam} onSaveContact={ctx.saveContact} onClearContact={ctx.clearContact} readOnly={base.readOnly} />
      </Live>
    </>
  );
}
