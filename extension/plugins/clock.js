const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

export default {
  id: "clock",
  name: "Clock and date",
  defaults: { hour12: true, seconds: false, date: true },
  settings: [
    { key: "hour12", label: "12-hour clock", type: "checkbox" },
    { key: "seconds", label: "Show seconds", type: "checkbox" },
    { key: "date", label: "Show the date", type: "checkbox" },
  ],

  mount(el, { settings }) {
    const sep = (c) => `<span class="sep">${c}</span>`;
    const tick = () => {
      const now = new Date();
      let h = now.getHours();
      let suffix = "";
      if (settings.hour12) {
        suffix = ` <span class="suffix">${h < 12 ? "AM" : "PM"}</span>`;
        h = h % 12 || 12;
      }
      const two = (n) => String(n).padStart(2, "0");
      const parts = [settings.hour12 ? h : two(h), two(now.getMinutes())];
      if (settings.seconds) parts.push(two(now.getSeconds()));
      let html = `<div class="time">${parts.join(sep("|"))}${suffix}</div>`;
      if (settings.date) {
        const day = now.toLocaleDateString(undefined, { weekday: "long" });
        const month = now.toLocaleDateString(undefined, { month: "long" });
        html += `<div class="date">${[day, ordinal(now.getDate()), month].join(sep("/"))}</div>`;
      }
      el.innerHTML = html;
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  },
};
