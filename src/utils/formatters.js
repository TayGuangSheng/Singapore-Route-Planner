export const formatDistance = (meters, t) => {
  if (typeof meters !== "number" || Number.isNaN(meters)) {
    return "-";
  }
  const km = meters / 1000;
  const value = km < 10 ? km.toFixed(2) : km.toFixed(1);
  return `${value} ${t("kmUnit")}`;
};

export const formatDuration = (seconds, t) => {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "-";
  }
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours} ${t("hourUnit")} ${minutes} ${t("minUnit")}`;
  }
  return `${minutes} ${t("minUnit")}`;
};
