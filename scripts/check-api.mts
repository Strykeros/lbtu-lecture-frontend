const res = await fetch('http://localhost:3001/api/schedule?refresh=1');
const j = await res.json();
console.log(
  JSON.stringify(
    {
      events: j.events?.length,
      directions: j.directions,
      withDirection: j.events?.filter((e) => e.directionCode).length,
      bizn: j.events?.filter((e) => e.directionCode === 'BiznVUzn').length,
      ilg: j.events?.filter((e) => e.directionCode === 'Ilgspe').length,
    },
    null,
    2,
  ),
);
