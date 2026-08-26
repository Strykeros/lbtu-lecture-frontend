import { getLbtuSchedule } from '../server/services/lbtu/getSchedule.ts';

async function main() {
  const d = await getLbtuSchedule();
  const sample = d.events.find((e) => e.courseCode === 'VadZ5096');
  console.log(
    JSON.stringify(
      {
        updatedAt: d.updatedAt,
        events: d.events.length,
        programs: d.programs,
        byProgram: {
          G0108: d.events.filter((e) => e.programCode === 'G0108').length,
          G0405: d.events.filter((e) => e.programCode === 'G0405').length,
        },
        sample,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
