const PAGE_SIZE = 100;
const MALE = "#3da2ed";
const FEMALE = "#f486a0";

const { createApp, nextTick } = Vue;

function parseRunner(runner) {
  const match = String(runner.country || "").match(/,\s*([MF])(\d+)$/i);
  const gender = match ? (match[1].toLowerCase() === "m" ? "male" : "female") : "unknown";
  const age = match ? Number(match[2]) : null;
  const country = String(runner.country || "").replace(/,\s*[MF]\d+$/i, "").trim() || "Не указано";
  const finishParts = String(runner.finish_time || "").match(/^(\d+):(\d{2}):(\d{2})$/);
  const finishSeconds = finishParts
    ? Number(finishParts[1]) * 3600 + Number(finishParts[2]) * 60 + Number(finishParts[3])
    : null;

  return { ...runner, gender, age, country, finishSeconds };
}

function showTooltip(event, html) {
  let tooltip = document.querySelector(".tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    document.body.appendChild(tooltip);
  }
  tooltip.innerHTML = html;
  tooltip.style.display = "block";
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}

function hideTooltip() {
  const tooltip = document.querySelector(".tooltip");
  if (tooltip) tooltip.style.display = "none";
}

function drawAgeChart(element, runners) {
  const width = Math.max(element.clientWidth, 260);
  const height = 350;
  const margin = { top: 5, right: 35, bottom: 24, left: 35 };
  const ages = d3.range(17, 86);
  const counts = ages.map((age) => ({
    age,
    male: runners.filter((d) => d.age === age && d.gender === "male").length,
    female: runners.filter((d) => d.age === age && d.gender === "female").length,
  }));
  const maxCount = d3.max(counts, (d) => Math.max(d.male, d.female)) || 1;
  const x = d3.scaleLinear().domain([-maxCount, maxCount]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(ages).range([margin.top, height - margin.bottom]).padding(0.16);
  const svg = d3.select(element).html("").append("svg").attr("width", "100%").attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  svg.append("g").selectAll("line")
    .data([17, 25, 35, 45, 55, 65, 75, 85])
    .join("line")
    .attr("class", "grid-line")
    .attr("x1", margin.left).attr("x2", width - margin.right)
    .attr("y1", (d) => y(d) + y.bandwidth() / 2).attr("y2", (d) => y(d) + y.bandwidth() / 2);

  const bars = [
    { key: "male", color: MALE, side: "left" },
    { key: "female", color: FEMALE, side: "right" },
  ];
  bars.forEach(({ key, color, side }) => {
    svg.append("g").selectAll("rect")
      .data(counts)
      .join("rect")
      .attr("x", (d) => side === "left" ? x(-d[key]) : x(0))
      .attr("y", (d) => y(d.age))
      .attr("width", (d) => Math.abs(x(d[key]) - x(0)))
      .attr("height", y.bandwidth())
      .attr("fill", color)
      .on("mousemove", (event, d) => showTooltip(event, `<strong>${d.age} лет</strong><br>${key === "male" ? "Мужчины" : "Женщины"}: ${d[key].toLocaleString("ru-RU")}`))
      .on("mouseleave", hideTooltip);
  });

  svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", margin.top).attr("y2", height - margin.bottom).attr("stroke", "#b8bec6");
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(3).tickFormat((d) => Math.abs(d)));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${width - margin.right + 5},0)`).call(d3.axisRight(y).tickValues([20, 30, 35, 40, 45, 50, 55, 60, 70, 80]).tickSize(0));
}

function drawCountryChart(element, runners) {
  const width = Math.max(element.clientWidth, 240);
  const rowHeight = 29;
  const counts = Array.from(d3.rollup(runners, (values) => values.length, (d) => d.country), ([country, count]) => ({ country, count }))
    .sort((a, b) => d3.descending(a.count, b.count));
  const top = counts.slice(0, 8);
  const height = Math.max(250, top.length * rowHeight + 16);
  const total = runners.length;
  const svg = d3.select(element).html("").append("svg").attr("width", "100%").attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);
  const rows = svg.append("g").attr("transform", "translate(0,8)").selectAll("g").data(top).join("g").attr("transform", (_, i) => `translate(0,${i * rowHeight})`);
  rows.append("text").attr("x", 0).attr("y", 19).attr("fill", "#252930").attr("font-size", 16).text((d) => d.country);
  rows.append("text").attr("x", width - 68).attr("y", 19).attr("text-anchor", "end").attr("fill", "#8a929d").attr("font-size", 15).text((d) => d.count.toLocaleString("ru-RU"));
  rows.append("text").attr("x", width - 4).attr("y", 19).attr("text-anchor", "end").attr("fill", "#252930").attr("font-size", 15).text((d) => `${Math.round((d.count / total) * 100)}%`);
  rows.on("mousemove", (event, d) => showTooltip(event, `<strong>${d.country}</strong><br>${d.count.toLocaleString("ru-RU")} участников`)).on("mouseleave", hideTooltip);
}

function drawFinishChart(element, runners) {
  const valid = runners.filter((d) => d.finishSeconds !== null).sort((a, b) => {
    const minuteDiff = Math.floor(a.finishSeconds / 60) - Math.floor(b.finishSeconds / 60);
    if (minuteDiff) return minuteDiff;
    const genderDiff = (a.gender === "male" ? 0 : 1) - (b.gender === "male" ? 0 : 1);
    return genderDiff || (a.age || 0) - (b.age || 0);
  });
  const width = Math.max(element.clientWidth, 760);
  const height = 390;
  const margin = { top: 12, right: 10, bottom: 35, left: 10 };
  const minTime = d3.min(valid, (d) => d.finishSeconds) || 0;
  const maxTime = d3.max(valid, (d) => d.finishSeconds) || 1;
  const x = d3.scaleLinear().domain([minTime - 10, maxTime + 10]).range([margin.left, width - margin.right]);
  const grouped = d3.group(valid, (d) => Math.floor(d.finishSeconds / 60));
  const maxBin = d3.max(Array.from(grouped.values(), (v) => v.length)) || 1;
  const y = d3.scaleLinear().domain([0, maxBin]).range([height - margin.bottom, margin.top]);
  const svg = d3.select(element).html("").append("svg").attr("width", "100%").attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  svg.append("g").selectAll("line").data(d3.range(Math.ceil(minTime / 3600) * 3600, maxTime, 3600)).join("line")
    .attr("class", "grid-line").attr("x1", x).attr("x2", x).attr("y1", margin.top).attr("y2", height - margin.bottom);
  svg.append("g").selectAll("rect").data(valid).join("rect")
    .attr("x", (d) => x(d.finishSeconds) - 1)
    .attr("y", (_, i) => y((grouped.get(Math.floor(valid[i].finishSeconds / 60)) || []).indexOf(valid[i]) + 1))
    .attr("width", 2.2)
    .attr("height", 5)
    .attr("fill", (d) => d.gender === "female" ? FEMALE : MALE)
    .on("mousemove", (event, d) => showTooltip(event, `<strong>${d.name}</strong><br>${d.finish_time} · ${d.age || "—"} лет<br>${d.gender === "female" ? "Женщины" : "Мужчины"} · №${d.bib_number}`))
    .on("mouseleave", hideTooltip);

  const tickValues = d3.ticks(minTime, maxTime, 8);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickValues(tickValues).tickFormat((seconds) => d3.timeFormat("%H:%M:%S")(new Date(seconds * 1000))));
}

createApp({
  data() {
    return { runners: [], loading: true, error: "" };
  },
  computed: {
    totalCount() { return this.runners.length; },
    visibleRunners() { return this.runners.slice(0, PAGE_SIZE); },
    firstShown() { return this.visibleRunners.length ? 1 : 0; },
    lastShown() { return this.visibleRunners.length; },
    genderCounts() {
      return {
        male: this.runners.filter((d) => d.gender === "male").length,
        female: this.runners.filter((d) => d.gender === "female").length,
      };
    },
    ageRange() {
      const ages = this.runners.map((d) => d.age).filter(Boolean);
      return ages.length ? `${d3.min(ages)}–${d3.max(ages)} лет` : "—";
    },
    podium() {
      const male = this.runners.filter((d) => d.gender === "male" && d.finishSeconds !== null).slice(0, 3).map((d, i) => ({ ...d, podiumPlace: i + 1 }));
      const female = this.runners.filter((d) => d.gender === "female" && d.finishSeconds !== null).slice(0, 3).map((d, i) => ({ ...d, podiumPlace: i + 1 }));
      return [...male, ...female];
    },
  },
  async mounted() {
    try {
      const data = await d3.json("results.json");
      this.runners = data.map(parseRunner);
      this.loading = false;
      await nextTick();
      drawAgeChart(this.$refs.ageChart, this.runners);
      drawCountryChart(this.$refs.countryChart, this.runners);
      drawFinishChart(this.$refs.finishChart, this.runners);
    } catch (error) {
      this.error = "Не удалось загрузить results.json. Откройте страницу через локальный сервер.";
      console.error(error);
    } finally {
      this.loading = false;
    }
  },
}).mount("#app");
